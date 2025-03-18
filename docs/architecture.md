# Gemini Twitch Translator - アーキテクチャ設計

## 1. システム概要

Gemini Twitch Translatorは、Twitchのライブチャットをリアルタイムで監視し、Gemini AIを用いて翻訳するChrome拡張機能です。本ドキュメントでは、拡張機能の内部アーキテクチャと各コンポーネントの関係性を詳細に説明します。

## 2. 全体アーキテクチャ

拡張機能は以下の主要コンポーネントで構成されています：

```
                              [Chrome Browser]
                                     |
                 ┌────────────────────────────────────────┐
                 |                                        |
          [Content Script]                      [Background Script]
                 |                                        |
     ┌────────────────────────┐              ┌────────────────────────┐
     |                        |              |                        |
[DOM Interaction]    [Message Processing]    [API Communication]   [Settings Management]
     |                        |              |                        |
     └─────────┬──────────────┘              └───────────┬────────────┘
               |                                         |
               └────────────── [Shared Modules] ─────────┘
                                     |
                          ┌─────────────────────┐
                          |                     |
                     [Popup UI]          [Options Page]
```

### 2.1 コンポーネント分離の原則

拡張機能は「関心の分離」原則に基づき、以下のように機能を分離しています：

1. **プレゼンテーション層**: ユーザーインターフェース（ポップアップ、オプションページ）
2. **ビジネスロジック層**: 翻訳処理、言語判定、キャッシュ管理（バックグラウンドスクリプト）
3. **データアクセス層**: API通信、ストレージ操作（バックグラウンドスクリプト）
4. **インテグレーション層**: DOM操作、イベント処理（コンテンツスクリプト）

## 3. モジュール構造

```
gemini-twitch-translator/
├── background/             # バックグラウンドスクリプト関連
│   ├── background.js       # バックグラウンドのエントリーポイント
│   └── modules/            # バックグラウンドのモジュール
│       ├── cache.js        # 翻訳キャッシュ管理
│       ├── errorHandler.js # エラー処理
│       ├── logger.js       # ロギング機能
│       ├── requestQueue.js # リクエスト管理
│       ├── settings.js     # 設定管理
│       ├── stats.js        # 統計情報管理
│       ├── translator.js   # 翻訳処理
│       ├── urlUtils.js     # URL判定ユーティリティ
│       └── utils.js        # 共通ユーティリティ
├── content/                # コンテンツスクリプト関連
│   ├── content.js          # 従来のコンテンツスクリプト
│   ├── content_loader.js   # コンテンツのエントリーポイント
│   ├── content_refactored.js # リファクタリング中のスクリプト
│   └── modules/            # コンテンツのモジュール
│       ├── domManager.js   # DOM操作
│       ├── messageProcessor.js # メッセージ処理
│       ├── messaging.js    # バックグラウンド通信
│       └── settingsManager.js # 設定アクセス
├── icons/                  # アイコンリソース
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon_placeholder.txt
├── options/                # オプションページ関連
│   ├── options.css         # オプションページのスタイル
│   ├── options.html        # オプションページのHTML
│   └── options.js          # オプションページのスクリプト
├── popup/                  # ポップアップUI関連
│   ├── popup.css           # ポップアップのスタイル
│   ├── popup.html          # ポップアップのHTML
│   └── popup.js            # ポップアップのスクリプト
├── shared/                 # 共有モジュール
│   ├── constants.js        # 共通定数
│   ├── messaging.js        # メッセージング共通処理
│   ├── settingsManager.js  # 設定管理共通処理
│   └── ui/                 # UI共通処理
│       ├── formManager.js  # フォーム共通処理
│       ├── index.js        # UIモジュールのエントリーポイント
│       └── uiManager.js    # UI更新共通処理
├── utils/                  # 拡張機能全体のユーティリティ
│   ├── cache.js            # キャッシュユーティリティ
│   ├── domObserver.js      # DOM監視ユーティリティ
│   ├── errorHandler.js     # エラー処理ユーティリティ
│   ├── language.js         # 言語判定ユーティリティ
│   ├── logger.js           # ロギングユーティリティ
│   ├── session.js          # セッション管理ユーティリティ
│   ├── urlMonitor.js       # URL監視ユーティリティ
│   ├── urlUtils.js         # URL処理ユーティリティ
│   └── utils.js            # 一般ユーティリティ
├── docs/                   # プロジェクトドキュメント
│   ├── architecture.md     # アーキテクチャ設計書
│   ├── progress.md         # 進捗管理
│   ├── project-description.md # プロジェクト概要
│   ├── specifications.md   # 機能仕様書
│   └── workflow.md         # ワークフロー説明
├── manifest.json           # 拡張機能マニフェスト
├── README.md               # プロジェクト概要
└── project-description.md  # プロジェクト詳細説明
```

## 4. コアモジュールの責務

### 4.1 バックグラウンドスクリプト (background.js)

バックグラウンドスクリプトはService Workerとして実行され、主に以下の責務を持ちます：

- メッセージハンドラの登録と管理
- 各モジュールの初期化
- イベントリスナーの設定
- 拡張機能のグローバル状態管理
- コンテンツスクリプトとの通信仲介

```javascript
// background.js の簡略構造
import { initSettings, getSettings } from './modules/settings.js';
import { translateText, testApiKey } from './modules/translator.js';
import { initCache } from './modules/cache.js';
import { initStats } from './modules/stats.js';
import { initRequestQueue } from './modules/requestQueue.js';
import { isStreamPage } from './modules/urlUtils.js';

// 初期化
async function initialize() {
  await initSettings();
  await initCache();
  await initStats();
  initRequestQueue();
  
  console.log('Twitch Gemini Translator: バックグラウンドスクリプト初期化完了');
}

// メッセージハンドラ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'translateMessage':
      handleTranslateMessage(message, sendResponse);
      break;
    case 'getSettings':
      sendResponse({ success: true, settings: getSettings() });
      break;
    // その他のハンドラ...
  }
  return true; // 非同期レスポンスのためにtrue
});

// 初期化の実行
initialize();
```

### 4.2 翻訳モジュール (translator.js)

Gemini APIとの通信と翻訳処理を担当します：

- 翻訳用プロンプトの構築
- Gemini APIへのリクエスト送信
- レスポンスの解析と翻訳テキストの抽出
- エラーハンドリング
- APIキーの検証

```javascript
// translator.js の簡略構造
import { getSettings } from './settings.js';
import { incrementApiRequests, incrementErrors } from './stats.js';
import { getCachedTranslation, cacheTranslation } from './cache.js';

// Gemini API関連の定数
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const GEMINI_API_GENERATE = ":generateContent";

// 翻訳用プロンプトテンプレート
const TRANSLATION_PROMPT_TEMPLATE = `Translate the following {{SOURCE_LANG}} to Japanese...`;

// 翻訳を実行する関数
export async function translateText(text, options = {}) {
  // キャッシュをチェック
  const cachedResult = getCachedTranslation(text, options.sourceLanguage);
  if (cachedResult) {
    return cachedResult;
  }
  
  // 設定を取得
  const settings = getSettings();
  
  // APIキーの確認
  if (!settings.apiKey) {
    return { success: false, error: "Gemini APIキーが設定されていません" };
  }
  
  // 統計を更新
  incrementApiRequests(text.length);
  
  try {
    // Gemini APIで翻訳
    const result = await translateWithGeminiAPI(text, settings.apiKey, options.sourceLanguage);
    
    // キャッシュに保存
    if (result.success) {
      cacheTranslation(text, options.sourceLanguage, result);
    }
    
    return result;
  } catch (error) {
    incrementErrors();
    return { success: false, error: error.message };
  }
}

// 他の関数...
```

### 4.3 コンテンツスクリプト (content_loader.js)

Twitchページに挿入され、以下の処理を行います：

- DOMの監視とチャットメッセージの検出
- メッセージの言語判定
- バックグラウンドスクリプトへの翻訳リクエスト送信
- 翻訳結果の表示
- URL変更の検出

```javascript
// content_loader.js の簡略構造
import { initUrlMonitor } from '../utils/urlMonitor.js';

// アプリケーション状態
const appState = {
  initialized: false,
  enabled: true,
  settings: { /* デフォルト設定 */ },
  processingMessages: new Set(),
  observer: null,
  channelName: getChannelFromUrl(),
  // その他の状態...
};

// 拡張機能を初期化
async function initializeExtension() {
  try {
    // 設定を取得
    const response = await sendMessageToBackground("getSettings");
    if (response && response.success) {
      appState.settings = { ...appState.settings, ...response.settings };
    }
    
    // URL監視を初期化
    initUrlMonitor({
      onUrlChanged: handleUrlChanged,
      debug: appState.debugMode,
      pollingFrequency: 1000
    });
    
    // チャット監視を開始
    if (appState.enabled) {
      startChatObserver();
    }
    
    appState.initialized = true;
    
    return true;
  } catch (error) {
    console.error("初期化エラー:", error);
    return false;
  }
}

// メッセージ処理
async function processMessage(messageElement) {
  // メッセージIDの取得
  const messageId = /* ID取得ロジック */;
  
  // 既に処理中のメッセージをスキップ
  if (appState.processingMessages.has(messageId)) {
    return;
  }
  
  // 処理中としてマーク
  appState.processingMessages.add(messageId);
  
  try {
    // テキスト抽出
    const messageText = extractMessageText(messageElement);
    
    // 翻訳リクエスト
    const response = await sendMessageToBackground("translateMessage", {
      message: messageText
    });
    
    if (response && response.success) {
      // 翻訳を表示
      displayTranslation(messageElement, response.translation, {
        model: response.model,
        sourceLanguage: response.sourceLanguage
      });
    }
  } catch (error) {
    console.error("メッセージ処理エラー:", error);
  }
  
  // 処理完了
  appState.processingMessages.delete(messageId);
}

// 初期化を実行
initializeExtension();
```

### 4.4 設定管理モジュール (settings.js)

拡張機能全体の設定を管理します：

- 設定の読み込みと保存
- デフォルト値の提供
- 設定変更通知の処理
- 設定検証

```javascript
// settings.js の簡略構造
// デフォルト設定
const DEFAULT_SETTINGS = {
  apiKey: '',
  enabled: false,
  geminiModel: 'gemini-2.0-flash-lite',
  translationMode: 'selective',
  displayPrefix: '🇯🇵',
  textColor: '#9b9b9b',
  accentColor: '#4db6ac',
  fontSize: 'medium',
  useCache: true,
  maxCacheAge: 24,
  autoToggle: true,
  processExistingMessages: false,
  requestDelay: 100,
  debugMode: false
};

// 現在の設定
let currentSettings = { ...DEFAULT_SETTINGS };

// 設定の初期化
export async function initSettings() {
  try {
    const storedSettings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    currentSettings = { ...DEFAULT_SETTINGS, ...storedSettings };
    return true;
  } catch (error) {
    console.error('設定の初期化エラー:', error);
    return false;
  }
}

// 設定の取得
export function getSettings() {
  return { ...currentSettings };
}

// 設定の保存
export async function saveSettings(newSettings) {
  try {
    // 古い設定をバックアップ
    const oldSettings = { ...currentSettings };
    
    // 設定を更新
    currentSettings = { ...currentSettings, ...newSettings };
    
    // Chromeストレージに保存
    await chrome.storage.sync.set(currentSettings);
    
    // 変更を通知
    notifySettingsChanged(oldSettings, currentSettings);
    
    return true;
  } catch (error) {
    console.error('設定の保存エラー:', error);
    return false;
  }
}

// 他の関数...
```

### 4.5 URL監視モジュール (urlMonitor.js)

Twitchページの変更を検知するためのモジュールです：

- History APIの変更検出
- popstateイベントリスナー
- 定期的なURLチェック
- URLタイプの判別

```javascript
// urlMonitor.js の簡略構造
let config = {
  onUrlChanged: () => {},
  debug: false,
  pollingFrequency: 2000
};

let currentUrl = '';
let isMonitoring = false;
let pollingInterval = null;

// URL監視を初期化
export function initUrlMonitor(options = {}) {
  // 設定をマージ
  config = { ...config, ...options };
  
  // 現在のURLを記録
  currentUrl = window.location.href;
  
  // History APIをオーバーライド
  overrideHistoryMethods();
  
  // popstateイベントリスナーを登録
  setupPopstateListener();
  
  // 定期的なポーリングを開始
  startUrlPolling();
  
  isMonitoring = true;
  
  // デバッグログ
  if (config.debug) {
    console.log(`URL監視を開始: ${currentUrl}`);
  }
  
  return true;
}

// History APIのオーバーライド
function overrideHistoryMethods() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  // pushStateをオーバーライド
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    handleUrlChange(window.location.href, 'pushState');
  };
  
  // replaceStateをオーバーライド
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    handleUrlChange(window.location.href, 'replaceState');
  };
}

// popstateイベントリスナー
function setupPopstateListener() {
  window.addEventListener('popstate', () => {
    handleUrlChange(window.location.href, 'popstate');
  });
}

// 他の関数...
```

## 5. データフロー

### 5.1 翻訳プロセスのデータフロー

```
[Twitchページ] → [MutationObserver] → [新規メッセージ検出]
                                       ↓
[テキスト抽出] → [言語判定] → [translateMessage リクエスト]
                              ↓
[バックグラウンドスクリプト] → [キャッシュチェック] → [ヒット] → [キャッシュ結果を返す]
                              ↓                     ↓
                        [キャッシュミス]       [翻訳を表示]
                              ↓
                      [Gemini API リクエスト]
                              ↓
                      [翻訳結果を受け取る]
                              ↓
                      [キャッシュに保存]
                              ↓
                      [翻訳結果を返す]
                              ↓
                        [翻訳を表示]
```

### 5.2 設定変更のデータフロー

```
[ユーザー操作] → [ポップアップ/オプションページ] → [設定変更]
                                                 ↓
[chrome.storage.sync.set] → [保存完了] → [settingsUpdated メッセージ]
                                         ↓
[バックグラウンドスクリプト] → [設定再読み込み] → [新しい設定を適用]
                                                ↓
[アクティブなタブに通知] → [コンテンツスクリプト] → [設定の再読み込み]
                                                ↓
                                          [監視の再設定]
```

### 5.3 URL変更のデータフロー

```
[ユーザー操作] → [Twitch内ページ移動] → [URL変更検出]
                                       ↓
[URL判定] → [checkCurrentUrl メッセージ] → [バックグラウンドスクリプト]
                                           ↓
[isStreamPage判定] → [結果を返す] → [コンテンツスクリプト]
                                    ↓
[ストリームページか？] → [Yes] → [拡張機能有効化] → [監視開始]
                        ↓
                      [No] → [拡張機能無効化] → [監視停止]
```

## 6. モジュール間の依存関係

```
[background.js] → [translator.js] → [cache.js]
                                   → [stats.js]
                 → [settings.js]
                 → [requestQueue.js]
                 → [urlUtils.js]

[content_loader.js] → [urlMonitor.js]
                    → [settingsManager.js]
                    → [messageProcessor.js] → [domManager.js]

[popup.js] → [shared/messaging.js]
           → [shared/settingsManager.js]
           → [shared/ui/uiManager.js]

[options.js] → [shared/messaging.js]
             → [shared/settingsManager.js]
             → [shared/ui/formManager.js]
```

## 7. エラーハンドリング戦略

拡張機能全体で一貫したエラーハンドリング戦略を採用しています：

### 7.1 エラーの種類

1. **ネットワークエラー**: API通信時の接続問題
2. **認証エラー**: APIキーの問題
3. **レート制限エラー**: API制限超過
4. **パースエラー**: データ解析の問題
5. **DOM操作エラー**: 要素の取得や操作に関する問題
6. **コンテキスト無効化エラー**: 拡張機能のコンテキスト無効化
7. **設定エラー**: 設定の読み込みや保存の問題

### 7.2 エラー処理フロー

```
[エラー発生] → [エラータイプの特定] → [ロギング]
                                     ↓
[リカバリー可能か？] → [Yes] → [リカバリー処理] → [処理続行]
                      ↓
                    [No] → [ユーザーへの通知] → [処理中断]
```

### 7.3 コンテキスト無効化からの復旧

```
[コンテキスト無効化検出] → [ローカルストレージから設定読み込み]
                         ↓
[処理の一時停止] → [バックオフ時間の計算] → [再初期化試行]
                                         ↓
[再試行回数 > 閾値] → [Yes] → [長いバックオフ時間で再試行]
                      ↓
                    [No] → [短いバックオフ時間で再試行]
```

## 8. 今後のリファクタリング計画

### 8.1 コード一貫性の向上

- `content.js`と`content_loader.js`の統合
- モジュール間の命名規則の統一
- 型定義の追加

### 8.2 エラーハンドリングの強化

- エラー種別の明確な定義
- ユーザーフレンドリーなエラーメッセージ
- リカバリーメカニズムの強化

### 8.3 パフォーマンス最適化

- メモリ使用量の削減
- リクエスト頻度の最適化
- DOM操作の効率化

## 9. まとめ

Gemini Twitch Translatorは、モジュール化された設計と明確な責務分離により、保守性と拡張性を重視したアーキテクチャを採用しています。コンポーネント間の疎結合を維持しつつ、共通機能を共有モジュールとして抽出することで、コードの重複を最小限に抑えています。

今後のリファクタリングでは、コードの一貫性をさらに向上させ、型安全性を強化することで、より堅牢で維持しやすいコードベースを目指します。
