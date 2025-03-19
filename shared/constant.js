/**
 * 共通定数モジュール
 *
 * 拡張機能全体で使用する定数を定義します。
 */

// 拡張機能の状態
const EXTENSION_STATE = {
  ENABLED: "enabled",
  DISABLED: "disabled",
  ERROR: "error",
};

// メッセージタイプ
const MESSAGE_TYPE = {
  TRANSLATION_REQUEST: "translation_request",
  TRANSLATION_RESPONSE: "translation_response",
  EXTENSION_STATE_CHANGE: "extension_state_change",
  API_KEY_CHANGE: "api_key_change",
  SETTINGS_CHANGE: "settings_change",
  STATUS_REQUEST: "status_request",
  STATUS_RESPONSE: "status_response",
  ERROR: "error",
};

// 翻訳モード
const TRANSLATION_MODE = {
  ALL: "all", // すべてのメッセージを翻訳
  NON_JAPANESE: "non_japanese", // 日本語以外のメッセージを翻訳
  SELECTED_LANGUAGES: "selected_languages", // 選択した言語のメッセージのみ翻訳
  CUSTOM: "custom", // カスタム条件で翻訳
};

// ストレージキー
const STORAGE_KEYS = {
  API_KEY: "api_key",
  API_KEY_SET: "api_key_set",
  EXTENSION_STATE: "extension_state",
  TRANSLATION_MODE: "translation_mode",
  TARGET_LANGUAGE: "target_language",
  SOURCE_LANGUAGES: "source_languages",
  CUSTOM_SETTINGS: "custom_settings",
  DISPLAY_STYLE: "display_style",
  CACHE_SETTINGS: "cache_settings",
  STATISTICS: "statistics",
};

// デフォルト設定
const DEFAULT_SETTINGS = {
  [STORAGE_KEYS.EXTENSION_STATE]: EXTENSION_STATE.DISABLED,
  [STORAGE_KEYS.TRANSLATION_MODE]: TRANSLATION_MODE.NON_JAPANESE,
  [STORAGE_KEYS.TARGET_LANGUAGE]: "ja",
  [STORAGE_KEYS.SOURCE_LANGUAGES]: [],
  [STORAGE_KEYS.CUSTOM_SETTINGS]: {},
  [STORAGE_KEYS.DISPLAY_STYLE]: {
    textColor: "#6c757d",
    backgroundColor: "transparent",
    fontStyle: "normal",
    prefix: "🌐 ",
  },
  [STORAGE_KEYS.CACHE_SETTINGS]: {
    enabled: true,
    maxSize: 1000,
    expirationTime: 24 * 60 * 60 * 1000, // 24時間（ミリ秒）
  },
  [STORAGE_KEYS.API_KEY_SET]: false,
};

// URLパターン
const URL_PATTERNS = {
  STREAM_PAGE: /^https?:\/\/(www\.)?twitch\.tv\/[a-zA-Z0-9_-]+$/,
  DIRECTORY_PAGE: /^https?:\/\/(www\.)?twitch\.tv\/directory/,
  NON_STREAM_PAGES:
    /^https?:\/\/(www\.)?twitch\.tv\/[a-zA-Z0-9_-]+\/(about|schedule|videos)/,
};

export {
  EXTENSION_STATE,
  MESSAGE_TYPE,
  TRANSLATION_MODE,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  URL_PATTERNS,
};
