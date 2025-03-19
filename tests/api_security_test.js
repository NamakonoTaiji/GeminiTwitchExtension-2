/**
 * APIキーセキュリティ機能テスト
 */
import { encryptApiKey, decryptApiKey } from "../utils/crypto.js";
import {
  secureStoreApiKey,
  secureRetrieveApiKey,
  hasApiKey,
  migrateApiKeyFromSync,
} from "../background/modules/api/keyManager.js";
import { STORAGE_KEYS } from "../shared/constant.js";

// 結果表示用の要素
const resultContent = document.getElementById("result-content");

// テスト用のサンプルAPIキー
const SAMPLE_API_KEY = "AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6";

/**
 * テスト結果をHTMLに出力
 * @param {string} testName - テスト名
 * @param {boolean} success - 成功か失敗か
 * @param {string} message - メッセージ
 */
function reportResult(testName, success, message) {
  const resultClass = success ? "success" : "failure";
  const resultStatus = success ? "成功" : "失敗";
  
  const resultElement = document.createElement("div");
  resultElement.innerHTML = `
    <p><strong>${testName}:</strong> <span class="${resultClass}">${resultStatus}</span></p>
    <p>${message}</p>
  `;
  
  resultContent.appendChild(resultElement);
  
  // コンソールにも出力
  console.log(`${testName}: ${resultStatus} - ${message}`);
}

/**
 * テスト環境のチェック
 */
async function checkTestEnvironment() {
  resultContent.innerHTML = "<h3>テスト環境をチェック中...</h3>";
  
  try {
    // Chrome API のチェック
    if (!chrome || !chrome.storage || !chrome.runtime) {
      throw new Error("Chrome API が利用できません。拡張機能のコンテキスト内で実行してください。");
    }
    
    // chrome.runtime.id のチェック
    if (!chrome.runtime.id) {
      throw new Error("拡張機能 ID が取得できません。デバッグモードで拡張機能をロードしてください。");
    }
    
    reportResult("環境チェック", true, "テスト環境が正常です。Chrome 拡張機能 API が利用可能です。");
    return true;
    
  } catch (error) {
    console.error("テスト環境チェック中にエラーが発生しました:", error);
    reportResult("環境チェック", false, `エラー: ${error.message}`);
    return false;
  }
}

/**
 * 暗号化・復号化のテスト
 */
async function testCryptoModule() {
  resultContent.innerHTML = "<h3>暗号化・復号化テスト開始</h3>";
  
  try {
    console.log("暗号化・復号化テスト開始...");
    
    // 暗号化テスト
    console.log("APIキーの暗号化中:", SAMPLE_API_KEY);
    const encryptedData = await encryptApiKey(SAMPLE_API_KEY);
    
    console.log("暗号化結果:", encryptedData);
    
    if (!encryptedData || !encryptedData.encryptedData || !encryptedData.iv) {
      throw new Error("暗号化に失敗しました。暗号化データが不完全です。");
    }
    
    console.log("暗号化成功:", encryptedData);
    reportResult("暗号化テスト", true, "APIキーの暗号化に成功しました。");
    
    // 復号化テスト
    console.log("暗号化されたAPIキーの復号化中...");
    const decryptedApiKey = await decryptApiKey(encryptedData);
    
    console.log("復号化結果:", decryptedApiKey);
    
    if (decryptedApiKey !== SAMPLE_API_KEY) {
      throw new Error(`復号化されたAPIキーが元のキーと一致しません。復号結果: ${decryptedApiKey}`);
    }
    
    console.log("復号化成功:", decryptedApiKey);
    reportResult("復号化テスト", true, "暗号化されたAPIキーの復号化に成功しました。元のキーと一致しています。");
    
    // エラーケースのテスト
    console.log("不正なデータでの復号化テスト...");
    try {
      const invalidData = { encryptedData: [1, 2, 3], iv: [4, 5, 6] };
      await decryptApiKey(invalidData);
      reportResult("不正データテスト", false, "不正なデータでの復号化が例外をスローせずに完了しました。");
    } catch (error) {
      console.log("予期された例外が発生:", error);
      reportResult("不正データテスト", true, "不正なデータでの復号化が期待通り失敗しました。");
    }
    
  } catch (error) {
    console.error("暗号化モジュールテスト中にエラーが発生しました:", error);
    reportResult("暗号化モジュールテスト", false, `エラー: ${error.message}`);
  }
}

/**
 * キー管理モジュールのテスト
 */
async function testKeyManagerModule() {
  resultContent.innerHTML = "<h3>キー管理テスト開始</h3>";
  
  try {
    console.log("キー管理モジュールテスト開始...");
    
    // 一度クリーンアップしておく
    await chrome.storage.local.remove("encrypted_api_key");
    
    // APIキー保存テスト
    console.log("APIキーを保存中:", SAMPLE_API_KEY);
    await secureStoreApiKey(SAMPLE_API_KEY);
    reportResult("APIキー保存テスト", true, "APIキーの保存に成功しました。");
    
    // APIキー存在確認テスト
    const keyExists = await hasApiKey();
    console.log("APIキー存在確認:", keyExists);
    
    if (!keyExists) {
      throw new Error("APIキーが保存されていますが、存在確認に失敗しました。");
    }
    
    reportResult("APIキー存在確認テスト", true, "APIキーの存在確認に成功しました。");
    
    // APIキー取得テスト
    console.log("保存されたAPIキーを取得中...");
    const retrievedKey = await secureRetrieveApiKey();
    console.log("取得されたAPIキー:", retrievedKey);
    
    if (retrievedKey !== SAMPLE_API_KEY) {
      throw new Error(`取得されたAPIキーが元のキーと一致しません。取得結果: ${retrievedKey}`);
    }
    
    reportResult("APIキー取得テスト", true, "保存されたAPIキーの取得に成功しました。元のキーと一致しています。");
    
    // APIキー削除テスト
    console.log("APIキーを削除中...");
    await secureStoreApiKey(null); // nullを保存して削除
    
    const keyExistsAfterDelete = await hasApiKey();
    console.log("削除後のAPIキー存在確認:", keyExistsAfterDelete);
    
    if (keyExistsAfterDelete) {
      throw new Error("APIキー削除後も存在確認がtrueを返しています。");
    }
    
    reportResult("APIキー削除テスト", true, "APIキーの削除に成功しました。");
    
  } catch (error) {
    console.error("キー管理モジュールテスト中にエラーが発生しました:", error);
    reportResult("キー管理モジュールテスト", false, `エラー: ${error.message}`);
  }
}

/**
 * 移行機能のテスト
 */
async function testMigrationFunction() {
  resultContent.innerHTML = "<h3>移行機能テスト開始</h3>";
  
  try {
    console.log("移行機能テスト開始...");
    
    // テストの前に古いAPIキーを設定
    console.log("テスト用に古いストレージ形式でAPIキーを設定中...");
    await chrome.storage.sync.set({ [STORAGE_KEYS.API_KEY]: SAMPLE_API_KEY });
    
    // 移行前に新しいストレージからキーを削除
    await chrome.storage.local.remove("encrypted_api_key");
    
    // キーの移行を実行
    console.log("APIキーの移行を実行中...");
    const migrationResult = await migrateApiKeyFromSync();
    console.log("移行結果:", migrationResult);
    
    if (!migrationResult) {
      throw new Error("APIキーの移行に失敗しました。");
    }
    
    reportResult("APIキー移行テスト", true, "古いストレージからのAPIキー移行に成功しました。");
    
    // 移行後の確認テスト
    const keyExistsAfterMigration = await hasApiKey();
    console.log("移行後のAPIキー存在確認:", keyExistsAfterMigration);
    
    if (!keyExistsAfterMigration) {
      throw new Error("移行後のAPIキー存在確認に失敗しました。");
    }
    
    // 移行後のキー取得テスト
    const retrievedKeyAfterMigration = await secureRetrieveApiKey();
    console.log("移行後に取得されたAPIキー:", retrievedKeyAfterMigration);
    
    if (retrievedKeyAfterMigration !== SAMPLE_API_KEY) {
      throw new Error(`移行後のAPIキーが元のキーと一致しません。取得結果: ${retrievedKeyAfterMigration}`);
    }
    
    reportResult("移行後のAPIキー取得テスト", true, "移行後のAPIキー取得に成功しました。元のキーと一致しています。");
    
    // 古いストレージのキーが削除されたか確認
    const oldStorageResult = await chrome.storage.sync.get(STORAGE_KEYS.API_KEY);
    const oldKeyExists = !!oldStorageResult[STORAGE_KEYS.API_KEY];
    console.log("古いストレージのキー存在確認:", oldKeyExists);
    
    if (oldKeyExists) {
      throw new Error("移行後も古いストレージにAPIキーが残っています。");
    }
    
    reportResult("古いストレージ削除テスト", true, "移行後、古いストレージからAPIキーが正常に削除されました。");
    
  } catch (error) {
    console.error("移行機能テスト中にエラーが発生しました:", error);
    reportResult("移行機能テスト", false, `エラー: ${error.message}`);
  } finally {
    // テスト後のクリーンアップ
    await chrome.storage.sync.remove(STORAGE_KEYS.API_KEY);
    await chrome.storage.local.remove("encrypted_api_key");
  }
}

/**
 * すべてのテストを実行
 */
async function runAllTests() {
  resultContent.innerHTML = "<h3>すべてのテストを実行中...</h3>";
  
  // 環境チェック
  const environmentOk = await checkTestEnvironment();
  if (!environmentOk) {
    resultContent.innerHTML += "<h3>テスト環境に問題があるため、テストを中止します。</h3>";
    return;
  }
  
  // 暗号化・復号化テスト
  await testCryptoModule();
  
  // キー管理テスト
  await testKeyManagerModule();
  
  // 移行テスト
  await testMigrationFunction();
  
  resultContent.innerHTML += "<h3>すべてのテストが完了しました。</h3>";
}

// ボタンにイベントリスナーを設定
document.getElementById("run-all-tests").addEventListener("click", runAllTests);
document.getElementById("run-crypto-test").addEventListener("click", testCryptoModule);
document.getElementById("run-key-manager-test").addEventListener("click", testKeyManagerModule);
document.getElementById("run-migration-test").addEventListener("click", testMigrationFunction);

// ページロード時に環境チェックを実行
checkTestEnvironment();

console.log("APIキーセキュリティ機能テストスクリプトがロードされました。");
