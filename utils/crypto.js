/**
 * APIキーの暗号化・復号化機能を提供するモジュール
 * Web Crypto APIを使用して安全な暗号化を行います
 */

// 拡張機能IDをsaltとして使用（固有の値として利用）
const SALT_PREFIX = "gemini-twitch-translator-";

/**
 * 拡張機能固有のsaltを生成
 * @returns {Uint8Array} - salt値
 */
function generateSalt() {
  const encoder = new TextEncoder();
  return encoder.encode(SALT_PREFIX + chrome.runtime.id);
}

/**
 * 暗号化用のキーを導出
 * @returns {Promise<CryptoKey>} - 暗号化キー
 */
async function deriveEncryptionKey() {
  const encoder = new TextEncoder();
  const salt = generateSalt();

  // キーマテリアルを生成
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(chrome.runtime.id),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // 暗号化キーを導出
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * APIキーを暗号化する
 * @param {string} apiKey - 暗号化するAPIキー
 * @returns {Promise<Object>} - 暗号化されたデータ（暗号文とIV）
 */
async function encryptApiKey(apiKey) {
  try {
    if (!apiKey) {
      throw new Error("APIキーが指定されていません");
    }

    const encoder = new TextEncoder();
    const cryptoKey = await deriveEncryptionKey();

    // 初期化ベクトル（IV）を生成
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 暗号化を実行
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      cryptoKey,
      encoder.encode(apiKey)
    );

    // バイナリデータを扱いやすい形式に変換（保存用）
    const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
    const ivArray = Array.from(iv);

    return {
      encryptedData: encryptedArray,
      iv: ivArray,
    };
  } catch (error) {
    console.error("APIキーの暗号化に失敗しました:", error);
    throw error;
  }
}

/**
 * 暗号化されたAPIキーを復号する
 * @param {Object} encryptedData - 暗号化されたデータ（暗号文とIV）
 * @returns {Promise<string>} - 復号されたAPIキー
 */
async function decryptApiKey(encryptedData) {
  try {
    if (!encryptedData || !encryptedData.encryptedData || !encryptedData.iv) {
      throw new Error("暗号化データが不正です");
    }

    const { encryptedData: encryptedArray, iv: ivArray } = encryptedData;

    // 配列をUint8Arrayに変換
    const encryptedBuffer = new Uint8Array(encryptedArray).buffer;
    const iv = new Uint8Array(ivArray);

    const cryptoKey = await deriveEncryptionKey();

    // 復号を実行
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      cryptoKey,
      encryptedBuffer
    );

    // 復号されたデータを文字列に変換
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error("APIキーの復号に失敗しました:", error);
    throw error;
  }
}

export { encryptApiKey, decryptApiKey };
