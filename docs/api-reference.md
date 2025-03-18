# Gemini Twitch Translator - API リファレンス

このドキュメントでは、Gemini Twitch Translator拡張機能のモジュールとそのパブリックAPIについて説明します。拡張機能の開発やメンテナンスの際に参照してください。

## 目次

1. [バックグラウンドAPI](#1-バックグラウンドapi)
2. [コンテンツスクリプトAPI](#2-コンテンツスクリプトapi)
3. [共有モジュールAPI](#3-共有モジュールapi)
4. [ユーティリティAPI](#4-ユーティリティapi)
5. [メッセージングプロトコル](#5-メッセージングプロトコル)
6. [データ構造](#6-データ構造)

## 1. バックグラウンドAPI

バックグラウンドスクリプトで提供される主要なAPIです。

### 1.1 translator.js

翻訳機能を提供するモジュール。

#### `translateText(text, options)`

テキストを翻訳します。

**パラメータ:**
- `text` (string): 翻訳するテキスト
- `options` (object, optional): 翻訳オプション
  - `model` (string, optional): 使用するGeminiモデル名 (デフォルト: 設定値)
  - `sourceLanguage` (string, optional): ソース言語 (デフォルト: "auto")
  - `targetLanguage` (string, optional): ターゲット言語 (デフォルト: "ja")

**戻り値:** (Promise<object>)
- `success` (boolean): 翻訳が成功したかどうか
- `translation` (string, 成功時): 翻訳されたテキスト
- `model` (string, 成功時): 使用されたモデル
- `detectedLanguage` (string, 成功時): 検出された言語
- `engine` (string, 成功時): 翻訳エンジン名 ("gemini")
- `error` (string, 失敗時): エラーメッセージ

**使用例:**
```javascript
import { translateText } from './modules/translator.js';

const result = await translateText('Hello, world!', { 
  sourceLanguage: 'EN',
  model: 'gemini-2.0-flash-lite'
});

if (result.success) {
  console.log(`翻訳結果: ${result.translation}`);
} else {
  console.error(`翻訳エラー: ${result.error}`);
}
```

#### `testApiKey(apiKey)`

APIキーが有効かどうかをテストします。

**パラメータ:**
- `apiKey` (string): テストするGemini APIキー

**戻り値:** (Promise<object>)
- `valid` (boolean): APIキーが有効かどうか
- `translatedText` (string, 成功時): テスト翻訳の結果
- `error` (string, 失敗時): エラーメッセージ

**使用例:**
```javascript
import { testApiKey } from './modules/translator.js';

const result = await testApiKey('your-api-key');
if (result.valid) {
  console.log('APIキーは有効です');
} else {
  console.error(`APIキーテスト失敗: ${result.error}`);
}
```

### 1.2 settings.js

拡張機能の設定を管理するモジュール。

#### `initSettings()`

設定を初期化します。

**戻り値:** (Promise<boolean>)
- 初期化が成功したかどうか

**使用例:**
```javascript
import { initSettings } from './modules/settings.js';

await initSettings();
```

#### `getSettings()`

現在の設定を取得します。

**戻り値:** (object)
- 現在の設定オブジェクト

**使用例:**
```javascript
import { getSettings } from './modules/settings.js';

const settings = getSettings();
console.log(`APIキー設定済み: ${!!settings.apiKey}`);
console.log(`有効状態: ${settings.enabled}`);
```

#### `saveSettings(newSettings)`

設定を保存します。

**パラメータ:**
- `newSettings` (object): 保存する設定

**戻り値:** (Promise<boolean>)
- 保存が成功したかどうか

**使用例:**
```javascript
import { saveSettings } from './modules/settings.js';

await saveSettings({
  enabled: true,
  geminiModel: 'gemini-2.0-flash'
});
```

#### `resetSettings()`

設定をデフォルト値にリセットします。

**戻り値:** (Promise<boolean>)
- リセットが成功したかどうか

**使用例:**
```javascript
import { resetSettings } from './modules/settings.js';

await resetSettings();
```

### 1.3 cache.js

翻訳キャッシュを管理するモジュール。

#### `initCache()`

キャッシュを初期化します。

**戻り値:** (Promise<boolean>)
- 初期化が成功したかどうか

**使用例:**
```javascript
import { initCache } from './modules/cache.js';

await initCache();
```

#### `getCachedTranslation(text, sourceLang)`

キャッシュから翻訳を取得します。

**パラメータ:**
- `text` (string): 翻訳元テキスト
- `sourceLang` (string): ソース言語

**戻り値:** (object|null)
- キャッシュに存在する場合は翻訳結果、それ以外の場合はnull

**使用例:**
```javascript
import { getCachedTranslation } from './modules/cache.js';

const cached = getCachedTranslation('Hello', 'EN');
if (cached) {
  console.log(`キャッシュから取得: ${cached.translation}`);
}
```

#### `cacheTranslation(text, sourceLang, result)`

翻訳結果をキャッシュに保存します。

**パラメータ:**
- `text` (string): 翻訳元テキスト
- `sourceLang` (string): ソース言語
- `result` (object): 翻訳結果

**使用例:**
```javascript
import { cacheTranslation } from './modules/cache.js';

cacheTranslation('Hello', 'EN', {
  success: true,
  translation: 'こんにちは',
  engine: 'gemini'
});
```

#### `clearCache()`

キャッシュをクリアします。

**戻り値:** (Promise<boolean>)
- クリアが成功したかどうか

**使用例:**
```javascript
import { clearCache } from './modules/cache.js';

await clearCache();
```

#### `getCacheSize()`

現在のキャッシュサイズを取得します。

**戻り値:** (number)
- キャッシュに保存されているエントリ数

**使用例:**
```javascript
import { getCacheSize } from './modules/cache.js';

const size = getCacheSize();
console.log(`キャッシュサイズ: ${size}件`);
```

### 1.4 stats.js

翻訳統計情報を管理するモジュール。

#### `initStats()`

統計情報を初期化します。

**戻り値:** (Promise<boolean>)
- 初期化が成功したかどうか

**使用例:**
```javascript
import { initStats } from './modules/stats.js';

await initStats();
```

#### `getStats()`

現在の統計情報を取得します。

**戻り値:** (object)
- 統計情報オブジェクト

**使用例:**
```javascript
import { getStats } from './modules/stats.js';

const stats = getStats();
console.log(`総リクエスト数: ${stats.totalRequests}`);
console.log(`キャッシュヒット率: ${stats.cacheHits / stats.totalRequests * 100}%`);
```

#### `incrementApiRequests(charCount)`

API呼び出し数とキャラクター数を増加させます。

**パラメータ:**
- `charCount` (number): 翻訳文字数

**使用例:**
```javascript
import { incrementApiRequests } from './modules/stats.js';

incrementApiRequests(text.length);
```

#### `incrementCacheHits()`

キャッシュヒット数を増加させます。

**使用例:**
```javascript
import { incrementCacheHits } from './modules/stats.js';

incrementCacheHits();
```

#### `resetStats()`

統計情報をリセットします。

**戻り値:** (Promise<boolean>)
- リセットが成功したかどうか

**使用例:**
```javascript
import { resetStats } from './modules/stats.js';

await resetStats();
```

### 1.5 urlUtils.js

URL判定ユーティリティモジュール。

#### `isStreamPage(url)`

URLがストリーミングページかどうかを判定します。

**パラメータ:**
- `url` (string): 判定するURL

**戻り値:** (boolean)
- ストリーミングページかどうか

**使用例:**
```javascript
import { isStreamPage } from './modules/urlUtils.js';

const url = 'https://www.twitch.tv/channelname';
if (isStreamPage(url)) {
  console.log('ストリーミングページです');
}
```

#### `getChannelFromUrl(url)`

URLからチャンネル名を抽出します。

**パラメータ:**
- `url` (string): 対象URL

**戻り値:** (string)
- チャンネル名、見つからない場合は空文字

**使用例:**
```javascript
import { getChannelFromUrl } from './modules/urlUtils.js';

const channel = getChannelFromUrl('https://www.twitch.tv/channelname');
console.log(`チャンネル名: ${channel}`);
```

## 2. コンテンツスクリプトAPI

コンテンツスクリプトで提供される主要なAPIです。

### 2.1 domManager.js

DOM操作を担当するモジュール。

#### `displayTranslation(messageElement, translation, options)`

翻訳結果をDOM上に表示します。

**パラメータ:**
- `messageElement` (Element): 翻訳対象のメッセージ要素
- `translation` (string): 翻訳テキスト
- `options` (object, optional): 表示オプション
  - `model` (string, optional): 使用されたモデル
  - `sourceLanguage` (string, optional): ソース言語

**使用例:**
```javascript
import { displayTranslation } from './modules/domManager.js';

displayTranslation(
  messageElement, 
  'こんにちは',
  { model: 'gemini-2.0-flash', sourceLanguage: 'EN' }
);
```

#### `findChatContainer()`

チャットコンテナ要素を検索します。

**戻り値:** (Element|null)
- チャットコンテナ要素、見つからない場合はnull

**使用例:**
```javascript
import { findChatContainer } from './modules/domManager.js';

const container = findChatContainer();
if (container) {
  console.log('チャットコンテナを検出しました');
}
```

#### `extractMessageText(messageElement)`

メッセージ要素からテキストを抽出します。

**パラメータ:**
- `messageElement` (Element): メッセージ要素

**戻り値:** (string|null)
- メッセージテキスト、抽出できない場合はnull

**使用例:**
```javascript
import { extractMessageText } from './modules/domManager.js';

const text = extractMessageText(messageElement);
if (text) {
  console.log(`メッセージテキスト: ${text}`);
}
```

### 2.2 messageProcessor.js

メッセージ処理を担当するモジュール。

#### `shouldTranslateBasedOnMode(text, mode, thresholds)`

テキストを翻訳すべきかどうかを判定します。

**パラメータ:**
- `text` (string): 対象テキスト
- `mode` (string): 翻訳モード ("selective", "all", "english")
- `thresholds` (object, optional): 言語判定のしきい値
  - `japaneseThreshold` (number): 日本語判定のしきい値 (0-100)
  - `englishThreshold` (number): 英語判定のしきい値 (0-100)

**戻り値:** (boolean)
- 翻訳すべきかどうか

**使用例:**
```javascript
import { shouldTranslateBasedOnMode } from './modules/messageProcessor.js';

const shouldTranslate = shouldTranslateBasedOnMode(
  'Hello, world!',
  'selective',
  { japaneseThreshold: 30, englishThreshold: 50 }
);

if (shouldTranslate) {
  // 翻訳処理を実行
}
```

#### `processMessage(messageElement, options)`

メッセージ要素を処理し、必要に応じて翻訳します。

**パラメータ:**
- `messageElement` (Element): メッセージ要素
- `options` (object, optional): 処理オプション
  - `forceTranslate` (boolean): 強制的に翻訳するかどうか

**戻り値:** (Promise<boolean>)
- 処理が成功したかどうか

**使用例:**
```javascript
import { processMessage } from './modules/messageProcessor.js';

await processMessage(messageElement);
```

### 2.3 urlMonitor.js

URL変更を監視するモジュール。

#### `initUrlMonitor(options)`

URL監視を初期化します。

**パラメータ:**
- `options` (object): 初期化オプション
  - `onUrlChanged` (function): URL変更時のコールバック
  - `debug` (boolean, optional): デバッグモード
  - `pollingFrequency` (number, optional): ポーリング間隔（ミリ秒）

**戻り値:** (boolean)
- 初期化が成功したかどうか

**使用例:**
```javascript
import { initUrlMonitor } from '../utils/urlMonitor.js';

initUrlMonitor({
  onUrlChanged: (url, method) => {
    console.log(`URL変更を検出: ${url} (${method})`);
    // 変更処理
  },
  debug: true,
  pollingFrequency: 2000
});
```

#### `stopUrlMonitor()`

URL監視を停止します。

**使用例:**
```javascript
import { stopUrlMonitor } from '../utils/urlMonitor.js';

stopUrlMonitor();
```

## 3. 共有モジュールAPI

複数のコンポーネント間で共有される主要なAPIです。

### 3.1 settingsManager.js

設定管理の共通機能を提供するモジュール。

#### `loadSettings(defaultSettings)`

設定を読み込みます。

**パラメータ:**
- `defaultSettings` (object, optional): デフォルト設定

**戻り値:** (Promise<object>)
- 読み込まれた設定

**使用例:**
```javascript
import { loadSettings } from '../shared/settingsManager.js';

const settings = await loadSettings({
  enabled: false,
  geminiModel: 'gemini-2.0-flash-lite'
});
```

#### `saveSettings(settings)`

設定を保存します。

**パラメータ:**
- `settings` (object): 保存する設定

**戻り値:** (Promise<boolean>)
- 保存が成功したかどうか

**使用例:**
```javascript
import { saveSettings } from '../shared/settingsManager.js';

await saveSettings({
  enabled: true,
  geminiModel: 'gemini-2.0-flash'
});
```

#### `validateSettings(settings, schema)`

設定が有効かどうかを検証します。

**パラメータ:**
- `settings` (object): 検証する設定
- `schema` (object): 検証スキーマ

**戻り値:** (object)
- `valid` (boolean): 検証が成功したかどうか
- `errors` (Array, 失敗時): エラーメッセージのリスト

**使用例:**
```javascript
import { validateSettings } from '../shared/settingsManager.js';

const schema = {
  apiKey: { type: 'string', required: true },
  enabled: { type: 'boolean', required: true }
};

const result = validateSettings(settings, schema);
if (!result.valid) {
  console.error('設定が無効です:', result.errors);
}
```

### 3.2 messaging.js

メッセージング共通機能を提供するモジュール。

#### `sendMessage(action, data)`

バックグラウンドスクリプトにメッセージを送信します。

**パラメータ:**
- `action` (string): アクション名
- `data` (object, optional): 追加データ

**戻り値:** (Promise<any>)
- バックグラウンドからのレスポンス

**使用例:**
```javascript
import { sendMessage } from '../shared/messaging.js';

const response = await sendMessage('translateMessage', {
  message: 'Hello, world!'
});

if (response.success) {
  console.log(`翻訳結果: ${response.translation}`);
}
```

#### `sendMessageToTabs(action, data)`

アクティブなタブにメッセージを送信します。

**パラメータ:**
- `action` (string): アクション名
- `data` (object, optional): 追加データ

**戻り値:** (Promise<Array>)
- 各タブからのレスポンスの配列

**使用例:**
```javascript
import { sendMessageToTabs } from '../shared/messaging.js';

await sendMessageToTabs('settingsUpdated', {
  settings: updatedSettings
});
```

### 3.3 constants.js

共通定数を定義するモジュール。

#### `ACTION_TYPES`

メッセージアクションタイプの定数を定義します。

**使用例:**
```javascript
import { ACTION_TYPES } from '../shared/constants.js';

sendMessage(ACTION_TYPES.TRANSLATE_MESSAGE, {
  message: 'Hello, world!'
});
```

#### `TRANSLATION_MODES`

翻訳モードの定数を定義します。

**使用例:**
```javascript
import { TRANSLATION_MODES } from '../shared/constants.js';

if (settings.translationMode === TRANSLATION_MODES.SELECTIVE) {
  // 選択的翻訳モードの処理
}
```

#### `ERROR_TYPES`

エラータイプの定数を定義します。

**使用例:**
```javascript
import { ERROR_TYPES } from '../shared/constants.js';

if (error.type === ERROR_TYPES.API_ERROR) {
  // API関連エラーの処理
}
```

## 4. ユーティリティAPI

汎用的なヘルパー関数を提供するユーティリティモジュールのAPIです。

### 4.1 language.js

言語判定ユーティリティ。

#### `isJapanese(text, threshold)`

テキストが日本語かどうかを判定します。

**パラメータ:**
- `text` (string): 判定するテキスト
- `threshold` (number, optional): 判定しきい値 (0-1、デフォルト: 0.3)

**戻り値:** (boolean)
- 日本語かどうか

**使用例:**
```javascript
import { isJapanese } from '../utils/language.js';

if (isJapanese(text, 0.5)) {
  console.log('日本語のテキストです');
}
```

#### `isEnglish(text, threshold)`

テキストが英語かどうかを判定します。

**パラメータ:**
- `text` (string): 判定するテキスト
- `threshold` (number, optional): 判定しきい値 (0-1、デフォルト: 0.5)

**戻り値:** (boolean)
- 英語かどうか

**使用例:**
```javascript
import { isEnglish } from '../utils/language.js';

if (isEnglish(text)) {
  console.log('英語のテキストです');
}
```

### 4.2 logger.js

ロギングユーティリティ。

#### `log(message, data)`

通常ログを出力します。

**パラメータ:**
- `message` (string): ログメッセージ
- `data` (any, optional): 追加データ

**使用例:**
```javascript
import { log } from '../utils/logger.js';

log('処理を開始しました', { userId: 123 });
```

#### `debug(message, data)`

デバッグログを出力します（デバッグモード時のみ）。

**パラメータ:**
- `message` (string): ログメッセージ
- `data` (any, optional): 追加データ

**使用例:**
```javascript
import { debug } from '../utils/logger.js';

debug('詳細情報', { result: response });
```

#### `error(message, data)`

エラーログを出力します。

**パラメータ:**
- `message` (string): エラーメッセージ
- `data` (any, optional): 追加データ

**使用例:**
```javascript
import { error } from '../utils/logger.js';

error('エラーが発生しました', { error: e });
```

#### `setLogLevel(level)`

ログレベルを設定します。

**パラメータ:**
- `level` (string): ログレベル ('debug', 'info', 'warn', 'error')

**使用例:**
```javascript
import { setLogLevel } from '../utils/logger.js';

setLogLevel('debug'); // すべてのログを表示
```

### 4.3 errorHandler.js

エラー処理ユーティリティ。

#### `handleError(error, context)`

エラーを処理します。

**パラメータ:**
- `error` (Error|object): エラーオブジェクト
- `context` (object, optional): エラーコンテキスト

**戻り値:** (object)
- `handled` (boolean): エラーが処理されたかどうか
- `recovery` (boolean): 回復処理が実行されたかどうか
- `message` (string): 処理結果メッセージ

**使用例:**
```javascript
import { handleError } from '../utils/errorHandler.js';

try {
  // エラー発生処理
} catch (e) {
  const result = handleError(e, { component: 'translator' });
  if (result.recovery) {
    console.log('エラーから回復しました');
  }
}
```

#### `createError(type, message, data)`

構造化されたエラーオブジェクトを作成します。

**パラメータ:**
- `type` (string): エラータイプ
- `message` (string): エラーメッセージ
- `data` (any, optional): 追加データ

**戻り値:** (object)
- 構造化されたエラーオブジェクト

**使用例:**
```javascript
import { createError } from '../utils/errorHandler.js';
import { ERROR_TYPES } from '../shared/constants.js';

throw createError(
  ERROR_TYPES.API_ERROR,
  'APIリクエストに失敗しました',
  { statusCode: 401 }
);
```

## 5. メッセージングプロトコル

拡張機能のコンポーネント間で使用されるメッセージプロトコルを説明します。

### 5.1 コンテンツスクリプト → バックグラウンド

#### translateMessage

テキストの翻訳をリクエストします。

**リクエスト:**
```javascript
{
  action: 'translateMessage',
  message: string,    // 翻訳するテキスト
  sourceLang?: string // ソース言語（省略時は自動検出）
}
```

**レスポンス:**
```javascript
{
  success: boolean,        // 成功したかどうか
  translation?: string,    // 翻訳テキスト
  model?: string,          // 使用されたモデル
  sourceLanguage?: string, // ソース言語
  engine?: string,         // 翻訳エンジン名
  error?: string           // エラーメッセージ
}
```

#### getSettings

設定を取得します。

**リクエスト:**
```javascript
{
  action: 'getSettings'
}
```

**レスポンス:**
```javascript
{
  success: boolean,  // 成功したかどうか
  settings?: object, // 設定オブジェクト
  error?: string     // エラーメッセージ
}
```

#### checkCurrentUrl

現在のURLがストリーミングページかどうかを確認します。

**リクエスト:**
```javascript
{
  action: 'checkCurrentUrl',
  url: string  // 確認するURL
}
```

**レスポンス:**
```javascript
{
  success: boolean,       // 成功したかどうか
  isStreamPage?: boolean, // ストリーミングページかどうか
  error?: string          // エラーメッセージ
}
```

### 5.2 バックグラウンド → コンテンツスクリプト

#### settingsUpdated

設定が更新されたことを通知します。

**メッセージ:**
```javascript
{
  action: 'settingsUpdated',
  settings: object  // 更新された設定
}
```

#### apiKeyUpdated

APIキーが更新されたことを通知します。

**メッセージ:**
```javascript
{
  action: 'apiKeyUpdated'
}
```

## 6. データ構造

拡張機能全体で使用される主要なデータ構造を説明します。

### 6.1 Settings

拡張機能の設定を表すオブジェクト。

```typescript
interface Settings {
  apiKey: string;                    // Gemini APIキー
  enabled: boolean;                  // 有効/無効状態
  geminiModel: string;               // 使用するGeminiモデル
  translationMode: string;           // 翻訳モード
  displayPrefix: string;             // 翻訳の接頭辞
  textColor: string;                 // テキスト色
  accentColor: string;               // アクセント色
  fontSize: string;                  // フォントサイズ
  useCache: boolean;                 // キャッシュ使用
  maxCacheAge: number;               // キャッシュ有効期間（時間）
  autoToggle: boolean;               // 自動ON/OFF
  processExistingMessages: boolean;  // 既存メッセージ処理
  requestDelay: number;              // リクエスト間隔（ms）
  debugMode: boolean;                // デバッグモード
}
```

### 6.2 TranslationResult

翻訳結果を表すオブジェクト。

```typescript
interface TranslationResult {
  success: boolean;          // 成功したかどうか
  translation?: string;      // 翻訳テキスト
  model?: string;            // 使用されたモデル
  detectedLanguage?: string; // 検出された言語
  engine?: string;           // 翻訳エンジン名
  error?: string;            // エラーメッセージ
}
```

### 6.3 Stats

翻訳統計情報を表すオブジェクト。

```typescript
interface Stats {
  totalRequests: number;        // 総リクエスト数
  cacheHits: number;            // キャッシュヒット数
  apiRequests: number;          // API呼び出し数
  errors: number;               // エラー数
  charactersTranslated: number; // 翻訳文字数
  lastReset: number;            // 最終リセット時間（タイムスタンプ）
}
```

### 6.4 CacheEntry

キャッシュエントリを表すオブジェクト。

```typescript
interface CacheEntry {
  translation: TranslationResult; // 翻訳結果
  timestamp: number;              // キャッシュ時間（タイムスタンプ）
}
```

### 6.5 AppError

アプリケーションエラーを表すオブジェクト。

```typescript
interface AppError {
  type: string;        // エラータイプ
  message: string;     // エラーメッセージ
  data?: any;          // 追加データ
  recoverable: boolean; // 回復可能かどうか
}
```

## 7. 参考情報

### 7.1 エラータイプ

```javascript
const ERROR_TYPES = {
  NETWORK_ERROR: 'network_error',           // ネットワークエラー
  API_ERROR: 'api_error',                   // API関連エラー
  AUTH_ERROR: 'auth_error',                 // 認証エラー
  RATE_LIMIT_ERROR: 'rate_limit_error',     // レート制限エラー
  PARSE_ERROR: 'parse_error',               // パースエラー
  DOM_ERROR: 'dom_error',                   // DOM操作エラー
  CONTEXT_INVALIDATED_ERROR: 'context_invalidated_error', // コンテキスト無効化エラー
  STORAGE_ERROR: 'storage_error',           // ストレージエラー
  UNKNOWN_ERROR: 'unknown_error'            // 不明なエラー
};
```

### 7.2 翻訳モード

```javascript
const TRANSLATION_MODES = {
  SELECTIVE: 'selective', // 選択的翻訳（日本語以外のメッセージのみ）
  ALL: 'all',             // すべてのメッセージを翻訳
  ENGLISH: 'english'      // 英語メッセージのみ翻訳
};
```

### 7.3 アクションタイプ

```javascript
const ACTION_TYPES = {
  TRANSLATE_MESSAGE: 'translateMessage',   // メッセージの翻訳
  GET_SETTINGS: 'getSettings',             // 設定の取得
  TEST_API_KEY: 'testApiKey',              // APIキーのテスト
  CHECK_API_KEY: 'checkApiKey',            // 現在のAPIキーの確認
  SETTINGS_UPDATED: 'settingsUpdated',     // 設定更新通知
  GET_STATS: 'getStats',                   // 統計の取得
  RESET_STATS: 'resetStats',               // 統計のリセット
  CLEAR_CACHE: 'clearCache',               // キャッシュのクリア
  CHECK_CURRENT_URL: 'checkCurrentUrl',    // URL確認
  PING: 'ping'                             // 接続確認
};
```
