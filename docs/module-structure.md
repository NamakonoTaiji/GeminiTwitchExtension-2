# Gemini Twitch Translator - モジュール構造設計

## 1. モジュール設計の目的

本文書では、Gemini Twitch Translatorの各モジュールの役割、責務、およびインターフェースを明確にします。モジュール間の依存関係を最小限に抑え、高い保守性と拡張性を実現するために、各モジュールの詳細な設計を記述します。

## 2. モジュール概要

拡張機能のコードベースは以下の主要なモジュールカテゴリに分類されます：

1. **バックグラウンドモジュール**: Service Workerとして実行される長期稼働コンポーネント
2. **コンテンツモジュール**: Twitchページに挿入されるDOM操作コンポーネント
3. **共有モジュール**: 複数のコンポーネント間で共有される機能
4. **UIモジュール**: ポップアップとオプションページの機能
5. **ユーティリティモジュール**: 汎用的なヘルパー関数群

## 3. バックグラウンドモジュール

バックグラウンドモジュールはService Workerとして実行され、拡張機能のコアロジックを提供します。

### 3.1 background.js

**目的**: バックグラウンドのエントリーポイント。他のモジュールを初期化し、メッセージハンドラを管理します。

**インターフェース**:
- `initialize()`: バックグラウンドスクリプトを初期化
- メッセージハンドラ（`chrome.runtime.onMessage` リスナー）

**依存モジュール**:
- `settings.js`
- `translator.js`
- `cache.js`
- `stats.js`
- `requestQueue.js`
- `urlUtils.js`

### 3.2 translator.js

**目的**: Gemini APIとの通信と翻訳処理を担当します。

**インターフェース**:
- `translateText(text, options)`: テキストを翻訳
- `testApiKey(apiKey)`: APIキーのテスト

**依存モジュール**:
- `settings.js`
- `stats.js`
- `cache.js`

**データ構造**:
```typescript
// 翻訳オプション
interface TranslationOptions {
  model?: string;           // Geminiモデル名
  sourceLanguage?: string;  // ソース言語
  targetLanguage?: string;  // ターゲット言語
}

// 翻訳結果
interface TranslationResult {
  success: boolean;         // 成功したか
  translation?: string;     // 翻訳テキスト
  model?: string;           // 使用したモデル
  detectedLanguage?: string; // 検出された言語
  engine?: string;          // 翻訳エンジン名
  error?: string;           // エラーメッセージ
}
```

### 3.3 settings.js

**目的**: 拡張機能全体の設定を管理します。

**インターフェース**:
- `initSettings()`: 設定を初期化
- `getSettings()`: 現在の設定を取得
- `saveSettings(newSettings)`: 設定を保存
- `resetSettings()`: 設定をリセット

**データ構造**:
```typescript
// 設定オブジェクト
interface Settings {
  apiKey: string;            // Gemini APIキー
  enabled: boolean;          // 有効/無効状態
  geminiModel: string;       // 使用するGeminiモデル
  translationMode: string;   // 翻訳モード
  displayPrefix: string;     // 翻訳の接頭辞
  textColor: string;         // テキスト色
  accentColor: string;       // アクセント色
  fontSize: string;          // フォントサイズ
  useCache: boolean;         // キャッシュ使用
  maxCacheAge: number;       // キャッシュ有効期間（時間）
  autoToggle: boolean;       // 自動ON/OFF
  processExistingMessages: boolean; // 既存メッセージ処理
  requestDelay: number;      // リクエスト間隔（ms）
  debugMode: boolean;        // デバッグモード
}
```

### 3.4 cache.js

**目的**: 翻訳キャッシュの管理を担当します。

**インターフェース**:
- `initCache()`: キャッシュを初期化
- `getCachedTranslation(text, sourceLang)`: キャッシュから翻訳を取得
- `cacheTranslation(text, sourceLang, result)`: 翻訳をキャッシュに保存
- `clearCache()`: キャッシュをクリア
- `saveCache()`: キャッシュを永続化
- `getCacheSize()`: キャッシュサイズを取得

**データ構造**:
```typescript
// キャッシュエントリ
interface CacheEntry {
  translation: TranslationResult; // 翻訳結果
  timestamp: number;             // キャッシュ時間（ミリ秒）
}

// キャッシュマップ
type TranslationCache = Map<string, CacheEntry>;
```

### 3.5 stats.js

**目的**: 翻訳統計情報の管理を担当します。

**インターフェース**:
- `initStats()`: 統計を初期化
- `getStats()`: 統計を取得
- `incrementApiRequests(charCount)`: API呼び出し数とキャラクター数を増加
- `incrementCacheHits()`: キャッシュヒット数を増加
- `incrementErrors()`: エラー数を増加
- `resetStats()`: 統計をリセット
- `saveStats()`: 統計を永続化

**データ構造**:
```typescript
// 統計オブジェクト
interface Stats {
  totalRequests: number;       // 総リクエスト数
  cacheHits: number;           // キャッシュヒット数
  apiRequests: number;         // API呼び出し数
  errors: number;              // エラー数
  charactersTranslated: number; // 翻訳文字数
  lastReset: number;           // 最終リセット時間
}
```

### 3.6 requestQueue.js

**目的**: 翻訳リクエストのキュー管理と並行処理の制御を担当します。

**インターフェース**:
- `initRequestQueue()`: リクエストキューを初期化
- `enqueueRequest(request)`: リクエストをキューに追加
- `processQueue()`: キューを処理
- `setPendingState(value)`: 処理中状態を設定
- `getQueueLength()`: キューの長さを取得

**データ構造**:
```typescript
// リクエスト構造
interface QueuedRequest {
  text: string;           // 翻訳するテキスト
  sourceLang: string;     // ソース言語
  resolve: Function;      // 成功コールバック
  reject: Function;       // エラーコールバック
  timestamp: number;      // リクエスト時間
}
```

### 3.7 urlUtils.js

**目的**: URL判定ロジックを提供します。

**インターフェース**:
- `isStreamPage(url)`: ストリーミングページかどうかを判定
- `isDirectoryPage(url)`: ディレクトリページかどうかを判定
- `isHomePage(url)`: ホームページかどうかを判定
- `getChannelFromUrl(url)`: URLからチャンネル名を抽出

## 4. コンテンツモジュール

コンテンツモジュールはTwitchページに挿入され、DOMを操作します。

### 4.1 content_loader.js

**目的**: コンテンツスクリプトのエントリーポイント。初期化と高レベルのフロー制御を担当します。

**インターフェース**:
- `initializeExtension()`: 拡張機能を初期化
- `processMessage(messageElement)`: メッセージを処理
- `startChatObserver()`: チャット監視を開始
- `handleUrlChanged(url, method)`: URL変更ハンドラ

**依存モジュール**:
- `urlMonitor.js`
- Twitchページ内のDOM要素

### 4.2 domManager.js

**目的**: DOMの操作と要素の取得を担当します。

**インターフェース**:
- `findChatContainer()`: チャットコンテナを検索
- `extractMessageText(messageElement)`: メッセージテキストを抽出
- `displayTranslation(messageElement, translation, options)`: 翻訳を表示
- `markProcessedMessage(messageElement, messageId)`: 処理済みメッセージをマーク

### 4.3 messageProcessor.js

**目的**: メッセージの処理ロジックを提供します。

**インターフェース**:
- `shouldTranslateMessage(text, mode)`: 翻訳すべきかを判定
- `processNewMessage(messageElement)`: 新規メッセージを処理
- `processExistingMessages()`: 既存メッセージを処理

### 4.4 messaging.js

**目的**: バックグラウンドスクリプトとの通信を担当します。

**インターフェース**:
- `sendMessageToBackground(action, data)`: バックグラウンドにメッセージを送信
- `handleBackgroundMessage(message, sender, sendResponse)`: バックグラウンドからのメッセージを処理

## 5. 共有モジュール

共有モジュールは、複数のコンポーネント間で共有される機能を提供します。

### 5.1 constants.js

**目的**: 拡張機能全体で使用される定数を定義します。

**インターフェース**:
- `ACTION_TYPES`: メッセージアクション名
- `TRANSLATION_MODES`: 翻訳モード
- `ERROR_TYPES`: エラー種別
- `DEFAULT_SETTINGS`: デフォルト設定値

### 5.2 messaging.js

**目的**: メッセージングの共通機能を提供します。

**インターフェース**:
- `sendMessage(action, data)`: メッセージを送信
- `sendMessageToTabs(action, data)`: アクティブなタブにメッセージを送信
- `createResponse(success, data, error)`: レスポンスオブジェクトを作成

### 5.3 settingsManager.js

**目的**: 設定管理の共通機能を提供します。

**インターフェース**:
- `loadSettings()`: 設定を読み込み
- `saveSettings(settings)`: 設定を保存
- `validateSettings(settings)`: 設定を検証
- `getDefaultSettings()`: デフォルト設定を取得

## 6. UIモジュール

UIモジュールは、ポップアップとオプションページのユーザーインターフェースを提供します。

### 6.1 uiManager.js

**目的**: UI要素の更新と管理を担当します。

**インターフェース**:
- `updateElement(elementId, value, property)`: 要素を更新
- `showStatusMessage(message, type, duration)`: ステータスメッセージを表示
- `toggleVisibility(elementId, visible)`: 要素の表示/非表示を切り替え
- `updateToggle(elementId, checked)`: トグルスイッチを更新

### 6.2 formManager.js

**目的**: フォーム処理を担当します。

**インターフェース**:
- `getFormValues(formSelectors)`: フォーム値を取得
- `setFormValues(formValues)`: フォーム値を設定
- `validateForm(formValues, schema)`: フォームを検証
- `registerFormListeners(formId, submitCallback)`: フォームリスナーを登録

## 7. ユーティリティモジュール

ユーティリティモジュールは、汎用的なヘルパー関数を提供します。

### 7.1 domObserver.js

**目的**: DOM変更の監視機能を提供します。

**インターフェース**:
- `initObserver(target, config, callback)`: 監視を初期化
- `stopObserver()`: 監視を停止
- `isObserving()`: 監視中かどうかを返す

### 7.2 language.js

**目的**: 言語判定機能を提供します。

**インターフェース**:
- `isJapanese(text, threshold)`: 日本語かどうかを判定
- `isEnglish(text, threshold)`: 英語かどうかを判定
- `detectLanguage(text)`: 言語を検出

### 7.3 logger.js

**目的**: ロギング機能を提供します。

**インターフェース**:
- `log(message, data)`: 通常ログを出力
- `debug(message, data)`: デバッグログを出力
- `warn(message, data)`: 警告ログを出力
- `error(message, data)`: エラーログを出力
- `setLogLevel(level)`: ログレベルを設定

### 7.4 urlMonitor.js

**目的**: URL変更の監視機能を提供します。

**インターフェース**:
- `initUrlMonitor(options)`: URL監視を初期化
- `stopUrlMonitor()`: URL監視を停止
- `isMonitoring()`: 監視中かどうかを返す

### 7.5 errorHandler.js

**目的**: エラー処理機能を提供します。

**インターフェース**:
- `handleError(error, context)`: エラーを処理
- `createError(type, message, data)`: エラーを作成
- `isRecoverableError(error)`: 回復可能なエラーかどうかを判定

## 8. モジュール間の相互作用

### 8.1 翻訳プロセスにおけるモジュール連携

1. `content_loader.js`がDOMからメッセージを検出
2. `messageProcessor.js`がメッセージを処理
3. `messaging.js`がバックグラウンドに翻訳リクエストを送信
4. `background.js`がメッセージを受信し、`translator.js`に処理を委譲
5. `translator.js`が`cache.js`をチェックし、キャッシュミスの場合はGemini APIにリクエスト
6. 翻訳結果を`cache.js`に保存し、`stats.js`を更新
7. 結果を`background.js`に返し、`content_loader.js`に転送
8. `domManager.js`が翻訳結果をDOM上に表示

### 8.2 設定変更の伝播

1. `options.js`が`formManager.js`からフォーム値を取得
2. `shared/settingsManager.js`が設定を検証し保存
3. `shared/messaging.js`が設定変更をバックグラウンドに通知
4. `background.js`が`settings.js`を更新
5. `background.js`がアクティブなタブに変更を通知
6. `content_loader.js`が新しい設定を適用

## 9. 型定義

以下の主要な型定義を拡張機能全体で共有します：

```typescript
// 設定オブジェクト
interface Settings {
  apiKey: string;
  enabled: boolean;
  geminiModel: string;
  translationMode: string;
  displayPrefix: string;
  textColor: string;
  accentColor: string;
  fontSize: string;
  useCache: boolean;
  maxCacheAge: number;
  autoToggle: boolean;
  processExistingMessages: boolean;
  requestDelay: number;
  debugMode: boolean;
}

// 翻訳結果
interface TranslationResult {
  success: boolean;
  translation?: string;
  model?: string;
  detectedLanguage?: string;
  engine?: string;
  error?: string;
}

// メッセージオブジェクト
interface Message {
  action: string;
  [key: string]: any;
}

// エラーオブジェクト
interface AppError {
  type: string;
  message: string;
  data?: any;
  recoverable: boolean;
}

// 統計オブジェクト
interface Stats {
  totalRequests: number;
  cacheHits: number;
  apiRequests: number;
  errors: number;
  charactersTranslated: number;
  lastReset: number;
}
```

## 10. 今後の実装計画

### 10.1 短期的なリファクタリング目標

- `content.js`と`content_loader.js`の統合
- 共通のエラー処理スキームの実装
- より厳格な型チェックの導入
- 命名規則の統一
- コードレビューとベストプラクティスの適用

### 10.2 中期的な機能改善

- テスト自動化インフラの構築
- パフォーマンスプロファイリングと最適化
- ユーザーフィードバックシステムの実装
- 多言語サポートの拡張
- UI改善とアクセシビリティ強化

## 11. まとめ

本設計書で定義されたモジュール構造と責務分離に従うことで、拡張機能のコードベースは以下の特性を獲得します：

1. **高い保守性**: 各モジュールは単一の責務を持ち、変更の影響範囲が限定される
2. **拡張性**: 既存のインターフェースを維持しながら個別のモジュールを拡張可能
3. **テスト容易性**: 明確なインターフェースにより単体テストが容易
4. **理解しやすさ**: 責務の明確な分離により、コードの理解が容易

今後のリファクタリングとエンハンスメントは、この設計原則に従って進めていきます。
