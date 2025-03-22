/**
 * メッセージング モジュール
 *
 * バックグラウンドスクリプトとの通信機能を提供します。
 * 翻訳リクエストの送信や設定データの取得などを担当します。
 */

import { MESSAGE_TYPE, STORAGE_KEYS } from "../../shared/constant.js";
import * as DOMManager from "./domManager.js";

// リトライとタイムアウトの設定
const COMMUNICATION_SETTINGS = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  TIMEOUT: 10000,
};

/**
 * バックグラウンドへのメッセージ送信（リトライとタイムアウト機能付き）
 * @param {Object} message 送信するメッセージ
 * @param {number} retryCount リトライ回数
 * @returns {Promise<Object>} 応答オブジェクト
 */
function sendMessageWithRetry(message, retryCount = 0) {
  return new Promise((resolve, reject) => {
    // タイムアウト処理
    const timeoutId = setTimeout(() => {
      const error = new Error("メッセージ送信がタイムアウトしました");
      if (retryCount < COMMUNICATION_SETTINGS.MAX_RETRIES) {
        console.warn(
          `Gemini Twitch Translator: 通信タイムアウト - リトライ ${
            retryCount + 1
          }/${COMMUNICATION_SETTINGS.MAX_RETRIES}`
        );
        clearTimeout(timeoutId);
        // リトライ
        setTimeout(() => {
          sendMessageWithRetry(message, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, COMMUNICATION_SETTINGS.RETRY_DELAY);
      } else {
        reject(error);
        // エラーをUIに表示
        DOMManager.showErrorMessage(
          "バックグラウンドとの通信に失敗しました。拡張機能を再読み込みしてください。"
        );
      }
    }, COMMUNICATION_SETTINGS.TIMEOUT);

    // メッセージ送信
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeoutId);

      // 通信エラー処理
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError;
        console.error("Gemini Twitch Translator: メッセージ送信エラー", error);

        // 拡張機能コンテキストの無効化対策
        if (
          error.message.includes("context invalidated") ||
          error.message.includes("disconnected")
        ) {
          // 深刻なエラー - 拡張機能の再起動が必要
          DOMManager.showErrorMessage(
            "拡張機能のコンテキストが無効になりました。ページを再読み込みしてください。"
          );
          reject(error);
          return;
        }

        // その他のエラー - リトライ
        if (retryCount < COMMUNICATION_SETTINGS.MAX_RETRIES) {
          console.warn(
            `Gemini Twitch Translator: 通信エラー - リトライ ${
              retryCount + 1
            }/${COMMUNICATION_SETTINGS.MAX_RETRIES}`
          );
          setTimeout(() => {
            sendMessageWithRetry(message, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, COMMUNICATION_SETTINGS.RETRY_DELAY);
        } else {
          reject(error);
        }
        return;
      }

      // 正常なレスポンス
      resolve(response);
    });
  });
}

/**
 * 翻訳リクエストを送信（改良版）
 * @param {Object} messageInfo メッセージ情報
 * @returns {Promise<Object>} 翻訳結果を含むオブジェクト
 */
export async function requestTranslation(messageInfo) {
  const { text, messageId, username, timestamp } = messageInfo;

  // 送信するメッセージを作成
  const message = {
    type: MESSAGE_TYPE.TRANSLATION_REQUEST,
    payload: {
      text,
      messageId: messageId || Date.now().toString(),
      username,
      timestamp: timestamp || Date.now(),
    },
  };

  try {
    // バックグラウンドスクリプトにリクエストを送信
    const response = await sendMessageWithRetry(message);

    // レスポンスの検証
    if (response && response.type === MESSAGE_TYPE.TRANSLATION_RESPONSE) {
      return response.payload;
    } else if (response && response.type === MESSAGE_TYPE.ERROR) {
      throw new Error(response.payload.message);
    } else {
      throw new Error("不明なレスポンス形式");
    }
  } catch (error) {
    console.error("Gemini Twitch Translator: 翻訳リクエストエラー", error);
    // エラーの種類に応じた処理
    if (error.message.includes("APIキー")) {
      DOMManager.showErrorMessage(
        "APIキーが設定されていないか無効です。設定を確認してください。"
      );
    } else if (error.message.includes("タイムアウト")) {
      DOMManager.showErrorMessage(
        "翻訳リクエストがタイムアウトしました。再試行してください。"
      );
    } else {
      DOMManager.showErrorMessage("翻訳処理中にエラーが発生しました。");
    }

    // エラー時はデフォルト値を返す
    return {
      translatedText: "(翻訳エラー)",
      sourceLanguage: "unknown",
      error: error.message,
    };
  }
}

/**
 * 拡張機能の設定を取得（キャッシュと同期機能付き）
 * @returns {Promise<Object>} 設定オブジェクト
 */
let cachedSettings = null;
let lastSettingsUpdate = 0;

export async function getSettings() {
  // 設定キャッシュが有効か確認（5秒以内）
  const now = Date.now();
  if (cachedSettings && now - lastSettingsUpdate < 5000) {
    return cachedSettings;
  }

  try {
    // ストレージから設定を取得
    const settings = await chrome.storage.sync.get([
      STORAGE_KEYS.TRANSLATION_MODE,
      STORAGE_KEYS.TARGET_LANGUAGE,
      STORAGE_KEYS.SOURCE_LANGUAGES,
      STORAGE_KEYS.DISPLAY_STYLE,
      STORAGE_KEYS.EXTENSION_STATE,
      STORAGE_KEYS.API_KEY_SET,
      STORAGE_KEYS.CUSTOM_SETTINGS,
    ]);

    // キャッシュを更新
    cachedSettings = settings;
    lastSettingsUpdate = now;

    return settings;
  } catch (error) {
    console.error("Gemini Twitch Translator: 設定取得エラー", error);

    // キャッシュがある場合は古いキャッシュを返す
    if (cachedSettings) {
      console.warn(
        "Gemini Twitch Translator: キャッシュされた設定を使用します"
      );
      return cachedSettings;
    }

    throw error;
  }
}

/**
 * 拡張機能の状態をバックグラウンドに問い合わせる（改良版）
 * @returns {Promise<Object>} 拡張機能の状態
 */
export async function requestStatus() {
  try {
    const message = {
      type: MESSAGE_TYPE.STATUS_REQUEST,
    };

    const response = await sendMessageWithRetry(message);

    if (response && response.type === MESSAGE_TYPE.STATUS_RESPONSE) {
      return response.payload;
    } else {
      throw new Error("無効なステータスレスポンス");
    }
  } catch (error) {
    console.error(
      "Gemini Twitch Translator: ステータスリクエストエラー",
      error
    );
    throw error;
  }
}

/**
 * バックグラウンドスクリプトとの接続状態を確認
 * @returns {Promise<boolean>} 接続状態（成功時はtrue）
 */
export async function checkBackgroundConnection() {
  try {
    // 短いタイムアウトでステータスリクエストを試行
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Connection timeout")), 3000);
    });

    const statusPromise = requestStatus();
    await Promise.race([statusPromise, timeoutPromise]);
    return true;
  } catch (error) {
    console.error(
      "Gemini Twitch Translator: バックグラウンド接続エラー",
      error
    );
    return false;
  }
}

/**
 * エラーをバックグラウンドに報告（拡張版）
 * @param {Error} error エラーオブジェクト
 * @param {string} context エラーが発生したコンテキスト
 */
export function reportError(error, context) {
  const errorReport = {
    type: MESSAGE_TYPE.ERROR,
    payload: {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
  };

  // リトライなしで送信（エラー報告のエラーはログのみ）
  chrome.runtime.sendMessage(errorReport, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Gemini Twitch Translator: エラー報告の送信に失敗しました",
        chrome.runtime.lastError
      );
    }
  });
}
