/**
 * メッセージ処理モジュール
 * 
 * チャットメッセージの処理ロジックを提供します。
 * 言語判定や翻訳条件の確認などを担当します。
 */

import { TRANSLATION_MODE } from '../../shared/constant.js';

// 言語パターン（簡易的な判定用）
const LANGUAGE_PATTERNS = {
  JAPANESE: /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/,
  ENGLISH: /^[a-zA-Z0-9\s.,!?'"&()*+\-\/:;<=>@[\\\]^_`{|}~％＆'（）＊＋－／：；＜＝＞＠［＼］＾＿｀｛｜｝～]*$/,
  EMOJI: /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u
};

/**
 * メッセージの言語を判定
 * @param {string} text メッセージテキスト
 * @returns {string} 言語コード（'ja', 'en', 'other'）
 */
export function detectLanguage(text) {
  if (!text) return 'unknown';
  
  // 日本語を含むかどうか
  if (LANGUAGE_PATTERNS.JAPANESE.test(text)) {
    return 'ja';
  }
  
  // 英語のみ（記号、数字含む）かどうか
  if (LANGUAGE_PATTERNS.ENGLISH.test(text)) {
    return 'en';
  }
  
  // その他の言語
  return 'other';
}

/**
 * 翻訳が必要かどうかを判定
 * @param {string} text メッセージテキスト
 * @param {Object} settings 翻訳設定
 * @returns {boolean} 翻訳が必要な場合はtrue
 */
export function shouldTranslate(text, settings) {
  if (!text) return false;
  
  const { translationMode, targetLanguage, sourceLanguages } = settings;
  const detectedLanguage = detectLanguage(text);
  
  switch (translationMode) {
    case TRANSLATION_MODE.ALL:
      // すべてのメッセージを翻訳
      return true;
      
    case TRANSLATION_MODE.NON_JAPANESE:
      // 日本語以外を翻訳
      return detectedLanguage !== 'ja';
      
    case TRANSLATION_MODE.SELECTED_LANGUAGES:
      // 選択された言語のみ翻訳
      if (!sourceLanguages || sourceLanguages.length === 0) {
        return detectedLanguage !== targetLanguage;
      }
      return sourceLanguages.includes(detectedLanguage);
      
    case TRANSLATION_MODE.CUSTOM:
      // カスタム条件（現在は実装なし、必要に応じて拡張）
      return detectedLanguage !== targetLanguage;
      
    default:
      return false;
  }
}

/**
 * 翻訳条件を満たす言語かどうかを確認
 * @param {string} text メッセージテキスト
 * @returns {boolean} 翻訳条件を満たす場合はtrue
 */
export function isTextTranslatable(text) {
  if (!text || text.length === 0) return false;
  
  // テキストが短すぎる場合は翻訳しない
  if (text.length < 2) return false;
  
  // 絵文字のみの場合は翻訳しない
  if (text.replace(LANGUAGE_PATTERNS.EMOJI, '').trim().length === 0) return false;
  
  // URLが大部分を占める場合は翻訳しない
  const urlPattern = /https?:\/\/\S+/g;
  const textWithoutUrls = text.replace(urlPattern, '').trim();
  if (textWithoutUrls.length < text.length * 0.3) return false;
  
  return true;
}

/**
 * メッセージ情報のキャッシュキーを生成
 * @param {Object} messageInfo メッセージ情報
 * @returns {string} キャッシュキー
 */
export function generateCacheKey(messageInfo) {
  const { text, username } = messageInfo;
  // テキストをハッシュ化したキャッシュキーを返す
  return `${text}_${username}`;
}
