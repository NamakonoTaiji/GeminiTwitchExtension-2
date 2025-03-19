/**
 * popup.js
 * ポップアップUI制御のためのスクリプト
 * 拡張機能の有効/無効の切り替えや設定の変更を行う
 */

// 共通定数の読み込み
import { EXTENSION_STATE, MESSAGE_TYPE, STORAGE_KEYS } from '../shared/constant.js';

// DOM要素
const elements = {
  translationToggle: document.getElementById('translationToggle'),
  status: document.getElementById('status'),
  apiKeyStatus: document.getElementById('apiKeyStatus'),
  targetLanguage: document.getElementById('targetLanguage'),
  optionsBtn: document.getElementById('optionsBtn')
};

/**
 * ポップアップの初期化
 * 保存された設定を読み込み、UIの状態を更新する
 */
async function initPopup() {
  try {
    // 現在の設定を取得
    const settings = await chrome.storage.sync.get([
      STORAGE_KEYS.EXTENSION_STATE,
      STORAGE_KEYS.TARGET_LANGUAGE,
      STORAGE_KEYS.API_KEY_SET
    ]);

    // 拡張機能の状態を設定
    const isEnabled = settings[STORAGE_KEYS.EXTENSION_STATE] === EXTENSION_STATE.ENABLED;
    elements.translationToggle.checked = isEnabled;
    updateStatusDisplay(isEnabled);

    // APIキーのステータスを設定
    const apiKeySet = settings[STORAGE_KEYS.API_KEY_SET] === true;
    updateApiKeyStatusDisplay(apiKeySet);

    // ターゲット言語の設定（デフォルトは日本語）
    if (settings[STORAGE_KEYS.TARGET_LANGUAGE]) {
      elements.targetLanguage.value = settings[STORAGE_KEYS.TARGET_LANGUAGE];
    }

    // 現在のタブ情報を取得（TwitchページかどうかをチェックするためのもとになるURL）
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    const isTwitchTab = currentTab.url.includes('twitch.tv');

    // Twitchページでない場合は、トグルを無効化
    if (!isTwitchTab) {
      elements.translationToggle.disabled = true;
      elements.translationToggle.title = 'Twitchページ以外では利用できません';
    }

  } catch (error) {
    console.error('ポップアップの初期化中にエラーが発生しました:', error);
  }
}

/**
 * ステータス表示を更新
 * @param {boolean} isEnabled 拡張機能が有効かどうか
 */
function updateStatusDisplay(isEnabled) {
  elements.status.textContent = isEnabled ? '有効' : '無効';
  elements.status.className = isEnabled 
    ? 'status-value enabled' 
    : 'status-value disabled';
}

/**
 * APIキーのステータス表示を更新
 * @param {boolean} isSet APIキーが設定されているかどうか
 */
function updateApiKeyStatusDisplay(isSet) {
  elements.apiKeyStatus.textContent = isSet ? '設定済み' : '未設定';
  elements.apiKeyStatus.className = isSet 
    ? 'api-key-value set' 
    : 'api-key-value not-set';
}

/**
 * 拡張機能の状態を切り替え
 * @param {boolean} isEnabled 有効にするかどうか
 */
async function toggleExtensionState(isEnabled) {
  try {
    // ストレージに状態を保存
    await chrome.storage.sync.set({
      [STORAGE_KEYS.EXTENSION_STATE]: isEnabled 
        ? EXTENSION_STATE.ENABLED 
        : EXTENSION_STATE.DISABLED
    });

    // UI表示を更新
    updateStatusDisplay(isEnabled);

    // 現在のアクティブなTwitchタブにメッセージを送信
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab.url.includes('twitch.tv')) {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: MESSAGE_TYPE.EXTENSION_STATE_CHANGE,
        isEnabled: isEnabled
      });
    }

    // バックグラウンドスクリプトに状態変更を通知
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPE.EXTENSION_STATE_CHANGE,
      state: isEnabled ? EXTENSION_STATE.ENABLED : EXTENSION_STATE.DISABLED
    });

  } catch (error) {
    console.error('拡張機能の状態切り替え中にエラーが発生しました:', error);
  }
}

/**
 * ターゲット言語を変更
 * @param {string} language 言語コード
 */
async function changeTargetLanguage(language) {
  try {
    // ストレージに言語設定を保存
    await chrome.storage.sync.set({
      [STORAGE_KEYS.TARGET_LANGUAGE]: language
    });

    // バックグラウンドスクリプトに言語変更を通知
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPE.SETTINGS_CHANGE,
      settings: {
        targetLanguage: language
      }
    });

    // アクティブなTwitchタブに言語変更を通知
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab.url.includes('twitch.tv')) {
      await chrome.tabs.sendMessage(currentTab.id, {
        type: MESSAGE_TYPE.SETTINGS_CHANGE,
        settings: {
          targetLanguage: language
        }
      });
    }

  } catch (error) {
    console.error('言語設定の変更中にエラーが発生しました:', error);
  }
}

/**
 * オプションページを開く
 */
function openOptionsPage() {
  chrome.runtime.openOptionsPage();
}

// イベントリスナーの設定
elements.translationToggle.addEventListener('change', (e) => {
  toggleExtensionState(e.target.checked);
});

elements.targetLanguage.addEventListener('change', (e) => {
  changeTargetLanguage(e.target.value);
});

elements.optionsBtn.addEventListener('click', openOptionsPage);

// メッセージリスナー
chrome.runtime.onMessage.addListener((message) => {
  // APIキーの状態が変更された場合
  if (message.type === MESSAGE_TYPE.API_KEY_CHANGE) {
    updateApiKeyStatusDisplay(message.isSet);
  }
  
  // 拡張機能の状態が変更された場合
  if (message.type === MESSAGE_TYPE.EXTENSION_STATE_CHANGE) {
    const isEnabled = message.state === EXTENSION_STATE.ENABLED;
    elements.translationToggle.checked = isEnabled;
    updateStatusDisplay(isEnabled);
  }
});

// ポップアップ初期化
document.addEventListener('DOMContentLoaded', initPopup);
