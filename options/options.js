/**
 * Gemini Twitch Translator オプションページスクリプト
 * 
 * 拡張機能の設定を管理するUIロジックを提供します。
 */

// importするモジュールのパスは拡張機能のルートからの相対パスで指定
import { STORAGE_KEYS, DEFAULT_SETTINGS, TRANSLATION_MODE } from "../shared/constant.js";
import { testApiKey } from "../background/modules/api/gemini.js";
import { secureStoreApiKey, secureRetrieveApiKey } from "../background/modules/api/keyManager.js";

// DOMが完全に読み込まれたら実行
document.addEventListener("DOMContentLoaded", initialize);

// 現在の設定を保存する変数
let currentSettings = {};

/**
 * 初期化処理
 */
async function initialize() {
  try {
    // 現在の設定を読み込む
    await loadSettings();
    
    // UIに設定を反映
    populateUI();
    
    // イベントリスナーを設定
    setupEventListeners();
    
    console.log("オプションページの初期化が完了しました");
  } catch (error) {
    console.error("初期化エラー:", error);
    showStatus("オプションページの初期化中にエラーが発生しました", "error");
  }
}

/**
 * 現在の設定を読み込む
 */
async function loadSettings() {
  try {
    // 基本設定を取得 (APIキー以外)
    const syncKeys = Object.values(STORAGE_KEYS).filter(
      key => key !== STORAGE_KEYS.API_KEY
    );
    const result = await chrome.storage.sync.get(syncKeys);
    
    // APIキーを安全に取得
    const apiKey = await secureRetrieveApiKey();
    
    // デフォルト設定とマージ
    currentSettings = {
      ...DEFAULT_SETTINGS,
      ...result,
      [STORAGE_KEYS.API_KEY]: apiKey || ""
    };
    
    console.log("設定を読み込みました");
  } catch (error) {
    console.error("設定の読み込みに失敗しました:", error);
    showStatus("設定の読み込みに失敗しました", "error");
    
    // エラー時はデフォルト設定を使用
    currentSettings = { ...DEFAULT_SETTINGS };
    currentSettings[STORAGE_KEYS.API_KEY] = "";
  }
}

/**
 * UIに設定を反映
 */
function populateUI() {
  // APIキー設定
  document.getElementById("api-key").value = currentSettings[STORAGE_KEYS.API_KEY] || "";
  
  // 翻訳モード設定
  const translationMode = currentSettings[STORAGE_KEYS.TRANSLATION_MODE] || TRANSLATION_MODE.NON_JAPANESE;
  document.getElementById("translation-mode").value = translationMode;
  
  // 翻訳モードに応じてUIを更新
  updateTranslationModeUI(translationMode);
  
  // ソース言語の設定（選択的翻訳モードの場合）
  const sourceLanguages = currentSettings[STORAGE_KEYS.SOURCE_LANGUAGES] || [];
  sourceLanguages.forEach(lang => {
    const element = document.getElementById(`lang-${lang}`);
    if (element) {
      element.checked = true;
    }
  });
  
  // 翻訳先言語設定
  document.getElementById("target-language").value = 
    currentSettings[STORAGE_KEYS.TARGET_LANGUAGE] || "ja";
  
  // 表示設定
  const displayStyle = currentSettings[STORAGE_KEYS.DISPLAY_STYLE] || DEFAULT_SETTINGS[STORAGE_KEYS.DISPLAY_STYLE];
  document.getElementById("text-color").value = displayStyle.textColor;
  document.getElementById("prefix").value = displayStyle.prefix;
  document.getElementById("font-style").value = displayStyle.fontStyle;
  
  // キャッシュ設定
  const cacheSettings = currentSettings[STORAGE_KEYS.CACHE_SETTINGS] || DEFAULT_SETTINGS[STORAGE_KEYS.CACHE_SETTINGS];
  document.getElementById("enable-cache").checked = cacheSettings.enabled;
  document.getElementById("cache-size").value = cacheSettings.maxSize;
  
  // キャッシュ有効期間を時間単位で表示
  const expirationHours = Math.floor(cacheSettings.expirationTime / (60 * 60 * 1000));
  document.getElementById("cache-expiration").value = expirationHours;
}

/**
 * 翻訳モードに応じたUIの更新
 * @param {string} mode - 翻訳モード
 */
function updateTranslationModeUI(mode) {
  // ソース言語設定の表示/非表示
  const sourceLanguagesContainer = document.getElementById("source-languages-container");
  if (mode === TRANSLATION_MODE.SELECTED_LANGUAGES) {
    sourceLanguagesContainer.classList.remove("hidden");
  } else {
    sourceLanguagesContainer.classList.add("hidden");
  }
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 翻訳モード変更時の処理
  document.getElementById("translation-mode").addEventListener("change", function(e) {
    updateTranslationModeUI(e.target.value);
  });

  // APIキーの表示/非表示切り替え
  document.getElementById("toggle-api-key").addEventListener("click", toggleApiKeyVisibility);
  
  // APIキーテスト
  document.getElementById("test-api-key").addEventListener("click", testCurrentApiKey);
  
  // 設定保存
  document.getElementById("save-settings").addEventListener("click", saveSettings);
  
  // 設定リセット
  document.getElementById("reset-settings").addEventListener("click", resetSettings);
}

/**
 * APIキーの表示/非表示を切り替え
 */
function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById("api-key");
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
  } else {
    apiKeyInput.type = "password";
  }
}

/**
 * 現在入力されているAPIキーをテスト
 */
async function testCurrentApiKey() {
  const apiKeyInput = document.getElementById("api-key");
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showApiKeyStatus("APIキーが入力されていません", "error");
    return;
  }
  
  try {
    showApiKeyStatus("APIキーをテスト中...", "info");
    
    const result = await testApiKey(apiKey);
    
    if (result.success) {
      showApiKeyStatus("APIキーは有効です", "success");
      // APIキーセットフラグを更新
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY_SET]: true });
      currentSettings[STORAGE_KEYS.API_KEY_SET] = true;
    } else {
      showApiKeyStatus(`APIキーテスト失敗: ${result.error || "不明なエラー"}`, "error");
      // APIキーセットフラグを更新
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY_SET]: false });
      currentSettings[STORAGE_KEYS.API_KEY_SET] = false;
    }
  } catch (error) {
    console.error("APIキーテストエラー:", error);
    showApiKeyStatus(`APIキーテスト中にエラーが発生しました: ${error.message}`, "error");
  }
}

/**
 * APIキーのステータスを表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ（success, error, info）
 */
function showApiKeyStatus(message, type = "info") {
  const statusElement = document.getElementById("api-key-status");
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
}

/**
 * 設定を保存
 */
async function saveSettings() {
  try {
    // UIから値を取得
    const newSettings = collectSettingsFromUI();
    
    // APIキーを安全に保存
    if (newSettings[STORAGE_KEYS.API_KEY] !== undefined) {
      await secureStoreApiKey(newSettings[STORAGE_KEYS.API_KEY]);
      // APIキーはAPIキー管理モジュールに保存したので、同期設定オブジェクトからは削除
      delete newSettings[STORAGE_KEYS.API_KEY];
    }
    
    // その他の設定を同期ストレージに保存
    await chrome.storage.sync.set(newSettings);
    
    // 現在の設定を更新
    currentSettings = {
      ...currentSettings,
      ...newSettings,
      [STORAGE_KEYS.API_KEY]: document.getElementById("api-key").value
    };
    
    // 保存成功メッセージを表示
    showStatus("設定が保存されました", "success");
    
    // バックグラウンドに設定変更を通知（通信エラーは無視）
    try {
      await chrome.runtime.sendMessage({
        type: "settings_change",
        data: { settings: newSettings }
      });
    } catch (notificationError) {
      // バックグラウンドへの通知が失敗しても設定は保存されているので、ログだけ残す
      console.warn("バックグラウンドへの通知に失敗しましたが、設定は正常に保存されています:", notificationError);
      // エラーを上位に伝播させない
    }
    
  } catch (error) {
    console.error("設定の保存に失敗しました:", error);
    showStatus(`設定の保存に失敗しました: ${error.message}`, "error");
  }
}

/**
 * UIから設定値を収集
 */
function collectSettingsFromUI() {
  const settings = {};
  
  // APIキー
  settings[STORAGE_KEYS.API_KEY] = document.getElementById("api-key").value.trim();
  
  // 翻訳モード
  settings[STORAGE_KEYS.TRANSLATION_MODE] = document.getElementById("translation-mode").value;
  
  // 翻訳元言語（選択的翻訳モードの場合）
  if (settings[STORAGE_KEYS.TRANSLATION_MODE] === TRANSLATION_MODE.SELECTED_LANGUAGES) {
    const sourceLanguages = [];
    const checkboxes = document.querySelectorAll('input[name="source-languages"]:checked');
    checkboxes.forEach(checkbox => {
      sourceLanguages.push(checkbox.value);
    });
    settings[STORAGE_KEYS.SOURCE_LANGUAGES] = sourceLanguages;
  }
  
  // 翻訳先言語
  settings[STORAGE_KEYS.TARGET_LANGUAGE] = document.getElementById("target-language").value;
  
  // 表示設定
  settings[STORAGE_KEYS.DISPLAY_STYLE] = {
    textColor: document.getElementById("text-color").value,
    backgroundColor: "transparent", // 現在UIで設定不可
    fontStyle: document.getElementById("font-style").value,
    prefix: document.getElementById("prefix").value
  };
  
  // キャッシュ設定
  const expirationHours = parseInt(document.getElementById("cache-expiration").value, 10) || 24;
  settings[STORAGE_KEYS.CACHE_SETTINGS] = {
    enabled: document.getElementById("enable-cache").checked,
    maxSize: parseInt(document.getElementById("cache-size").value, 10) || 1000,
    expirationTime: expirationHours * 60 * 60 * 1000 // 時間をミリ秒に変換
  };
  
  return settings;
}

/**
 * 設定を初期設定に戻す
 */
async function resetSettings() {
  if (confirm("すべての設定を初期状態に戻しますか？この操作は元に戻せません。")) {
    try {
      // APIキーはリセットしない選択肢を与える
      const keepApiKey = confirm("Gemini APIキーは保持しますか？");
      const currentApiKey = keepApiKey ? currentSettings[STORAGE_KEYS.API_KEY] : "";
      
      // デフォルト設定を適用
      currentSettings = { ...DEFAULT_SETTINGS };
      
      // APIキーを保持するかどうか
      if (keepApiKey && currentApiKey) {
        currentSettings[STORAGE_KEYS.API_KEY] = currentApiKey;
      } else {
        currentSettings[STORAGE_KEYS.API_KEY] = "";
        await secureStoreApiKey(""); // APIキーを削除
      }
      
      // UIを更新
      populateUI();
      
      // その他の設定をストレージに保存
      const settingsToSave = { ...DEFAULT_SETTINGS };
      delete settingsToSave[STORAGE_KEYS.API_KEY]; // APIキーは除外
      await chrome.storage.sync.set(settingsToSave);
      
      showStatus("設定を初期状態に戻しました", "success");
      
      // バックグラウンドに設定変更を通知（通信エラーは無視）
      try {
        await chrome.runtime.sendMessage({
          type: "settings_change",
          data: { settings: settingsToSave }
        });
      } catch (notificationError) {
        // バックグラウンドへの通知が失敗しても設定は保存されているので、ログだけ残す
        console.warn("バックグラウンドへの通知に失敗しましたが、設定は正常に保存されています:", notificationError);
      }
      
    } catch (error) {
      console.error("設定のリセットに失敗しました:", error);
      showStatus(`設定のリセットに失敗しました: ${error.message}`, "error");
    }
  }
}

/**
 * ステータスメッセージを表示
 * @param {string} message - 表示するメッセージ
 * @param {string} type - メッセージタイプ（success, error, info）
 */
function showStatus(message, type = "info") {
  const statusElement = document.getElementById("save-status");
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  
  // 3秒後にメッセージをクリア（成功メッセージの場合）
  if (type === "success") {
    setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "status-message";
    }, 3000);
  }
}