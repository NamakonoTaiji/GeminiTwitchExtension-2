/**
 * APIキーの安全な管理を担当するモジュール
 */

import { encryptApiKey, decryptApiKey } from "../../../utils/crypto.js";
import { STORAGE_KEYS } from "../../../shared/constant.js"; // ファイル名を正しく修正

// 暗号化されたAPIキー用のストレージキー
const ENCRYPTED_API_KEY_STORAGE_KEY = "encrypted_api_key";

/**
 * APIキーを安全に保存する
 * @param {string} apiKey - 保存するAPIキー
 * @returns {Promise<void>}
 */
async function secureStoreApiKey(apiKey) {
  try {
    if (!apiKey) {
      // APIキーが空の場合、保存されている暗号化キーを削除
      await chrome.storage.local.remove(ENCRYPTED_API_KEY_STORAGE_KEY);
      return;
    }

    // APIキーを暗号化
    const encryptedData = await encryptApiKey(apiKey);

    // 暗号化されたデータをlocalストレージに保存
    await chrome.storage.local.set({
      [ENCRYPTED_API_KEY_STORAGE_KEY]: encryptedData,
    });

    console.log("APIキーを安全に保存しました");
  } catch (error) {
    console.error("APIキーの保存に失敗しました:", error);
    throw error;
  }
}

/**
 * 保存されたAPIキーを安全に取得する
 * @returns {Promise<string|null>} - 復号されたAPIキー、またはnull
 */
async function secureRetrieveApiKey() {
  try {
    // 暗号化されたデータを取得
    const result = await chrome.storage.local.get(
      ENCRYPTED_API_KEY_STORAGE_KEY
    );
    const encryptedData = result[ENCRYPTED_API_KEY_STORAGE_KEY];

    if (!encryptedData) {
      return null;
    }

    // データを復号
    const apiKey = await decryptApiKey(encryptedData);
    return apiKey;
  } catch (error) {
    console.error("APIキーの取得に失敗しました:", error);
    return null;
  }
}

/**
 * APIキーが設定されているかを確認する
 * @returns {Promise<boolean>} - APIキーが設定されていればtrue
 */
async function hasApiKey() {
  try {
    const result = await chrome.storage.local.get(
      ENCRYPTED_API_KEY_STORAGE_KEY
    );
    return !!result[ENCRYPTED_API_KEY_STORAGE_KEY];
  } catch (error) {
    console.error("APIキー存在確認に失敗しました:", error);
    return false;
  }
}

/**
 * 以前のストレージ（sync）からAPIキーを移行する
 * @returns {Promise<boolean>} - 移行が成功したらtrue
 */
async function migrateApiKeyFromSync() {
  try {
    // 古いストレージからAPIキーを取得
    const result = await chrome.storage.sync.get(STORAGE_KEYS.API_KEY);
    const oldApiKey = result[STORAGE_KEYS.API_KEY];

    if (!oldApiKey) {
      return false; // 移行するAPIキーがない
    }

    // 新しい形式で保存
    await secureStoreApiKey(oldApiKey);

    // 古いストレージからAPIキーを削除
    await chrome.storage.sync.remove(STORAGE_KEYS.API_KEY);

    console.log("APIキーを古いストレージから新しいストレージに移行しました");
    return true;
  } catch (error) {
    console.error("APIキーの移行に失敗しました:", error);
    return false;
  }
}

/**
 * APIキーを安全に保存し、API_KEY_SETフラグも同時に更新する
 * @param {string} apiKey - 保存するAPIキー
 * @returns {Promise<void>}
 */
async function secureStoreApiKeyAndUpdateFlag(apiKey) {
  try {
    // APIキーを保存
    await secureStoreApiKey(apiKey);
    
    // API_KEY_SETフラグを更新
    const isSet = !!apiKey;
    await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY_SET]: isSet });
    
    console.log(`APIキーを保存し、API_KEY_SETフラグを${isSet ? '有効' : '無効'}に設定しました`);
    
    // フラグの状態を確認する
    const checkResult = await chrome.storage.sync.get([STORAGE_KEYS.API_KEY_SET]);
    console.log('API_KEY_SETフラグ確認結果:', checkResult);
  } catch (error) {
    console.error("APIキーの保存とフラグ更新に失敗しました:", error);
    throw error;
  }
}

/**
 * APIキーの存在状態とAPI_KEY_SETフラグを同期する
 * @returns {Promise<boolean>} - 同期後のAPIキー設定状態
 */
async function syncApiKeyFlag() {
  try {
    // 実際のAPIキーの存在状態を確認
    const hasKeyResult = await hasApiKey();
    
    // 現在のフラグ状態を取得
    const settings = await chrome.storage.sync.get([STORAGE_KEYS.API_KEY_SET]);
    const currentFlag = settings[STORAGE_KEYS.API_KEY_SET] || false;
    
    console.log(`APIキーフラグ同期 - 実際: ${hasKeyResult}, 設定値: ${currentFlag}`);
    
    // 状態が異なる場合は更新
    if (hasKeyResult !== currentFlag) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY_SET]: hasKeyResult });
      console.log(`API_KEY_SETフラグを${hasKeyResult}に更新しました`);
    }
    
    return hasKeyResult;
  } catch (error) {
    console.error("APIキーフラグの同期に失敗しました:", error);
    return false;
  }
}

export {
  secureStoreApiKey,
  secureRetrieveApiKey,
  hasApiKey,
  migrateApiKeyFromSync,
  secureStoreApiKeyAndUpdateFlag,
  syncApiKeyFlag
};
