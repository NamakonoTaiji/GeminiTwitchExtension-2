/**
 * バックグラウンドスクリプト
 *
 * 拡張機能のバックグラウンド処理を担当します。
 * - Gemini APIとの通信
 * - メッセージング処理
 * - 設定の管理
 * - 翻訳キャッシュの管理
 */

import { translateText, testApiKey } from "./modules/api/gemini.js";
import {
  EXTENSION_STATE,
  MESSAGE_TYPE,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
} from "../shared/constant.js";
import {
  secureStoreApiKey,
  secureRetrieveApiKey,
  hasApiKey,
  migrateApiKeyFromSync,
  secureStoreApiKeyAndUpdateFlag,
  syncApiKeyFlag
} from "./modules/api/keyManager.js";

// キャッシュの初期化
const translationCache = new Map();

// 設定の初期化
let settings = { ...DEFAULT_SETTINGS };
// メモリ内のAPIキー（必要な時だけロード）
let inMemoryApiKey = null;

/**
 * 設定を読み込む
 */
async function loadSettings() {
  try {
    // storage.syncから基本設定を読み込む(APIキー以外)
    const syncKeys = Object.values(STORAGE_KEYS).filter(
      (key) => key !== STORAGE_KEYS.API_KEY
    );
    const result = await chrome.storage.sync.get(syncKeys);

    // デフォルト設定とマージ
    settings = {
      ...DEFAULT_SETTINGS,
      ...result,
    };

    // APIキーの設定とフラグの同期を完全する
    await syncApiKeyFlag();

    console.log("Settings loaded:", settings);
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

/**
 * APIキーをメモリにロードする（必要な時だけ）
 */
async function loadApiKeyToMemory() {
  if (inMemoryApiKey === null) {
    inMemoryApiKey = await secureRetrieveApiKey();
  }
  return inMemoryApiKey;
}

/**
 * メモリからAPIキーをクリアする
 */
function clearApiKeyFromMemory() {
  inMemoryApiKey = null;
}

/**
 * 拡張機能の初期化
 */
async function initialize() {
  try {
    await loadSettings();
    
    // APIキーの存在確認とAPI_KEY_SETフラグの同期
    const hasKeyResult = await syncApiKeyFlag();
    console.log(`初期化時のAPIキー確認結果: ${hasKeyResult}`);
    
    // 現在の設定に反映させる
    settings[STORAGE_KEYS.API_KEY_SET] = hasKeyResult;
    
    // 必要なら古いストレージからの移行を試行
    if (!hasKeyResult) {
      // APIキーがないか確認できない場合は移行を試行
      const migrated = await migrateApiKeyFromSync();
      if (migrated) {
        // 移行成功した場合は再度同期
        const newKeyResult = await syncApiKeyFlag();
        settings[STORAGE_KEYS.API_KEY_SET] = newKeyResult;
      }
    }
    
    // キャッシュチェックと初期化
    if (settings[STORAGE_KEYS.CACHE_SETTINGS]?.enabled) {
      console.log('翻訳キャッシュを初期化します');
      // 古いキャッシュエントリの削除などを行うことができます
    }
    
    console.log('Gemini Twitch Translator: バックグラウンドスクリプトが正常に初期化されました');
  } catch (error) {
    console.error('Gemini Twitch Translator: 初期化中にエラーが発生しました', error);
    
    // 初期化失敗時にデフォルト設定を使用
    settings = { ...DEFAULT_SETTINGS };
  }

  // インストール/アップデート時の処理
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      // 初回インストール時のデフォルト設定を保存
      chrome.storage.sync.set(DEFAULT_SETTINGS);

      // オプションページを開く
      chrome.runtime.openOptionsPage();
    }
  });

  // メッセージリスナーを設定
  setupMessageListeners();
}

/**
 * メッセージリスナーを設定
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // メッセージタイプに基づいて処理を分岐
    switch (message.type) {
      case MESSAGE_TYPE.TRANSLATION_REQUEST:
        handleTranslationRequest(message, sender, sendResponse);
        return true; // 非同期レスポンスを使用

      case MESSAGE_TYPE.API_KEY_CHANGE:
        handleApiKeyChange(message);
        sendResponse({ success: true });
        return true;

      case MESSAGE_TYPE.EXTENSION_STATE_CHANGE:
        handleExtensionStateChange(message);
        sendResponse({ success: true });
        return true;

      case MESSAGE_TYPE.SETTINGS_CHANGE:
        handleSettingsChange(message);
        sendResponse({ success: true });
        return true;

      case MESSAGE_TYPE.STATUS_REQUEST:
        handleStatusRequest(sendResponse);
        return true; // 非同期レスポンスを使用

      default:
        console.warn("Unknown message type:", message.type);
        sendResponse({ success: false, error: "Unknown message type" });
    }
  });
}

/**
 * 翻訳リクエストを処理
 * @param {Object} message - リクエストメッセージ
 * @param {Object} sender - 送信者情報
 * @param {Function} sendResponse - レスポンスコールバック
 */
async function handleTranslationRequest(message, sender, sendResponse) {
  const { text, messageId } = message.payload || message.data;

  if (!text || !messageId) {
    sendResponse({
      type: MESSAGE_TYPE.TRANSLATION_RESPONSE,
      payload: {
        success: false,
        error: "無効なリクエスト：テキストまたはメッセージIDが不足しています",
        messageId,
      }
    });
    return;
  }

  // 拡張機能が無効の場合
  if (settings[STORAGE_KEYS.EXTENSION_STATE] !== EXTENSION_STATE.ENABLED) {
    sendResponse({
      type: MESSAGE_TYPE.TRANSLATION_RESPONSE,
      payload: {
        success: false,
        error: "拡張機能は現在無効になっています",
        messageId,
      }
    });
    return;
  }

  // APIキーが設定されていない場合
  const apiKeySet = settings[STORAGE_KEYS.API_KEY_SET];
  if (!apiKeySet) {
    sendResponse({
      type: MESSAGE_TYPE.TRANSLATION_RESPONSE,
      payload: {
        success: false,
        error: "APIキーが設定されていません。オプションページで設定してください。",
        messageId,
      }
    });
    return;
  }

  // キャッシュをチェック
  const cacheEnabled = settings[STORAGE_KEYS.CACHE_SETTINGS]?.enabled;
  if (cacheEnabled && translationCache.has(text)) {
    const cachedResult = translationCache.get(text);
    sendResponse({
      type: MESSAGE_TYPE.TRANSLATION_RESPONSE,
      payload: {
        success: true,
        translatedText: cachedResult.translatedText,
        originalText: text,
        messageId,
        fromCache: true,
      }
    });
    return;
  }

  try {
    // Gemini APIを使用して翻訳
    const result = await translateText(text, await loadApiKeyToMemory());

    // APIキーの使用が終わったらメモリからクリア
    clearApiKeyFromMemory();

    // 翻訳が成功した場合、キャッシュに保存
    if (result.success && cacheEnabled) {
      translationCache.set(text, {
        translatedText: result.translatedText,
        timestamp: Date.now(),
      });

      // キャッシュサイズを確認し、必要に応じて古いエントリを削除
      const maxCacheSize =
        settings[STORAGE_KEYS.CACHE_SETTINGS]?.maxSize || 1000;
      if (translationCache.size > maxCacheSize) {
        const oldestKey = findOldestCacheEntry();
        if (oldestKey) {
          translationCache.delete(oldestKey);
        }
      }
    }

    // メッセージIDを追加してレスポンスを送信
    sendResponse({
      type: MESSAGE_TYPE.TRANSLATION_RESPONSE,
      payload: {
        ...result,
        messageId,
      }
    });
  } catch (error) {
    console.error("Translation error:", error);

    // APIキーの使用が終わったらメモリからクリア
    clearApiKeyFromMemory();

    sendResponse({
      type: MESSAGE_TYPE.TRANSLATION_RESPONSE,
      payload: {
        success: false,
        error: `翻訳処理エラー: ${error.message}`,
        messageId,
      }
    });
  }
}

/**
 * キャッシュから最も古いエントリのキーを見つける
 * @returns {string|null} - 最も古いエントリのキー、またはnull
 */
function findOldestCacheEntry() {
  let oldestKey = null;
  let oldestTime = Infinity;

  for (const [key, value] of translationCache.entries()) {
    if (value.timestamp < oldestTime) {
      oldestTime = value.timestamp;
      oldestKey = key;
    }
  }

  return oldestKey;
}

/**
 * APIキー変更を処理
 * @param {Object} message - キー変更メッセージ
 */
async function handleApiKeyChange(message) {
  const { apiKey } = message.payload || message.data;

  // 新しいAPIキーを保存し、フラグも更新
  await secureStoreApiKeyAndUpdateFlag(apiKey);

  // メモリ内のAPIキーを更新
  inMemoryApiKey = apiKey;

  // キャッシュをクリア
  translationCache.clear();
}

/**
 * 拡張機能の状態変更を処理
 * @param {Object} message - 状態変更メッセージ
 */
async function handleExtensionStateChange(message) {
  const { state } = message.payload || message.data;

  if (Object.values(EXTENSION_STATE).includes(state)) {
    // 新しい状態を保存
    await chrome.storage.sync.set({ [STORAGE_KEYS.EXTENSION_STATE]: state });

    // 設定を再読み込み
    await loadSettings();
  }
}

/**
 * 設定変更を処理
 * @param {Object} message - 設定変更メッセージ
 */
async function handleSettingsChange(message) {
  const { settings: newSettings } = message.payload || message.data;

  // 新しい設定を保存
  await chrome.storage.sync.set(newSettings);

  // 設定を再読み込み
  await loadSettings();

  // キャッシュ設定が変更された場合、キャッシュを調整
  if (newSettings[STORAGE_KEYS.CACHE_SETTINGS]) {
    // キャッシュが無効になった場合、クリア
    if (newSettings[STORAGE_KEYS.CACHE_SETTINGS].enabled === false) {
      translationCache.clear();
    }

    // キャッシュサイズが縮小された場合、古いエントリを削除
    const newMaxSize = newSettings[STORAGE_KEYS.CACHE_SETTINGS].maxSize;
    if (newMaxSize && translationCache.size > newMaxSize) {
      trimCache(newMaxSize);
    }
  }
}

/**
 * キャッシュサイズを調整
 * @param {number} maxSize - 最大キャッシュサイズ
 */
function trimCache(maxSize) {
  if (translationCache.size <= maxSize) return;

  // 古い順にエントリを削除
  const entriesToRemove = translationCache.size - maxSize;
  const entries = Array.from(translationCache.entries()).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );

  for (let i = 0; i < entriesToRemove; i++) {
    translationCache.delete(entries[i][0]);
  }
}

/**
 * ステータスリクエストを処理
 * @param {Function} sendResponse - レスポンスコールバック
 */
async function handleStatusRequest(sendResponse) {
  // 最新の設定を読み込み
  await loadSettings();

  sendResponse({
    type: MESSAGE_TYPE.STATUS_RESPONSE,
    payload: {
      success: true,
      state: settings[STORAGE_KEYS.EXTENSION_STATE],
      hasApiKey: !!settings[STORAGE_KEYS.API_KEY_SET],
      translationMode: settings[STORAGE_KEYS.TRANSLATION_MODE],
      cacheSize: translationCache.size,
      cacheEnabled: settings[STORAGE_KEYS.CACHE_SETTINGS]?.enabled,
    }
  });
}

// 拡張機能の初期化
initialize();
