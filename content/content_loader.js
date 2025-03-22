/**
 * コンテンツスクリプトローダー
 * 
 * このスクリプトはTwitchページに直接挿入され、チャットメッセージを監視して翻訳機能を提供します。
 * MutationObserverを使用してDOMの変更を監視し、新しいチャットメッセージを検出します。
 */

// モジュールは動的にロードします

// モジュールをロードする関数
async function loadModules() {
  // モジュールを動的にロード
  const [constantModule, domManagerModule, messageProcessorModule, messagingModule] = await Promise.all([
    import(chrome.runtime.getURL('shared/constant.js')),
    import(chrome.runtime.getURL('content/modules/domManager.js')),
    import(chrome.runtime.getURL('content/modules/messageProcessor.js')),
    import(chrome.runtime.getURL('content/modules/messaging.js'))
  ]);
  
  // モジュールを取り出す
  const { EXTENSION_STATE, MESSAGE_TYPE, STORAGE_KEYS, TRANSLATION_MODE } = constantModule;
  const DOMManager = domManagerModule;
  const MessageProcessor = messageProcessorModule;
  const Messaging = messagingModule;
  
  return {
    constants: { EXTENSION_STATE, MESSAGE_TYPE, STORAGE_KEYS, TRANSLATION_MODE },
    DOMManager,
    MessageProcessor,
    Messaging
  };
}

// モジュールの初期化
(async function init() {
  console.log('Gemini Twitch Translator: コンテンツスクリプトを初期化中...');
  
  try {
    // スタイルシートを追加
    injectStylesheet();
    
    // モジュールをロード
    const modules = await loadModules();
    const { constants, DOMManager, MessageProcessor, Messaging } = modules;
    const { EXTENSION_STATE, MESSAGE_TYPE, STORAGE_KEYS, TRANSLATION_MODE } = constants;
    
    // グローバルスコープにモジュールを保存（後で参照するため）
    window._geminiTwitchTranslator = {
      modules,
      constants: { EXTENSION_STATE, MESSAGE_TYPE, STORAGE_KEYS, TRANSLATION_MODE }
    };
    
    // 拡張機能の状態を取得
    const settings = await Messaging.getSettings();
    console.log('Gemini Twitch Translator: 設定読み込み結果', settings);
    const extensionState = settings[STORAGE_KEYS.EXTENSION_STATE] || EXTENSION_STATE.DISABLED;
    const apiKeySet = settings[STORAGE_KEYS.API_KEY_SET] || false;
    console.log('Gemini Twitch Translator: APIキー設定状態', apiKeySet, STORAGE_KEYS.API_KEY_SET);
    
    // APIキーがセットされているか確認
    if (!apiKeySet) {
      console.warn('Gemini Twitch Translator: APIキーが設定されていません。オプションページで設定してください。');
    }
    
    // 拡張機能が有効な場合、チャット監視を開始
    if (extensionState === EXTENSION_STATE.ENABLED) {
      initChatObserver(modules);
    }
    
    // 拡張機能の状態変更を監視
    listenForStateChanges(modules);
    
    console.log('Gemini Twitch Translator: コンテンツスクリプトの初期化が完了しました');
  } catch (error) {
    console.error('Gemini Twitch Translator: 初期化エラー', error);
  }
})();

/**
 * チャット監視の初期化
 * MutationObserverを使用してTwitchチャットの変更を監視します
 * @param {Object} modules ロードされたモジュール
 */
function initChatObserver(modules) {
  const { DOMManager } = modules;
  console.log('Gemini Twitch Translator: チャット監視を開始します');
  
  // 一定間隔でチャットコンテナを探索
  let findAttempts = 0;
  const MAX_FIND_ATTEMPTS = 30; // 30秒タイムアウト
  
  const findChatInterval = setInterval(() => {
    findAttempts++;
    const chatContainer = findChatContainer(DOMManager);
    if (chatContainer) {
      console.log('Gemini Twitch Translator: チャットコンテナを発見しました');
      clearInterval(findChatInterval);
      observeChatMessages(chatContainer, modules);
    } else if (findAttempts >= MAX_FIND_ATTEMPTS) {
      clearInterval(findChatInterval);
      console.warn('Gemini Twitch Translator: チャットコンテナが見つかりませんでした');
    }
  }, 1000);
}

/**
 * チャットコンテナ要素を検索
 * @param {Object} DOMManager DOM管理モジュール
 * @returns {Element|null} チャットコンテナ要素（存在しない場合はnull）
 */
function findChatContainer(DOMManager) {
  // DOMManagerのメソッドを使用してチャットコンテナを探す
  return DOMManager.findChatContainer();
}

/**
 * チャットメッセージの監視
 * @param {Element} chatContainer チャットコンテナ要素
 * @param {Object} modules モジュールオブジェクト
 */
function observeChatMessages(chatContainer, modules) {
  const { DOMManager } = modules;
  
  // 既存のメッセージを処理
  processExistingMessages(chatContainer, modules);
  
  // MutationObserverの設定
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // 追加された各ノードを処理
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // 直接チャットメッセージの場合
            if (DOMManager.isChatMessage(node)) {
              processChatMessage(node, modules);
            } else {
              // 子要素にチャットメッセージがあるか確認
              const chatMessages = node.querySelectorAll('.chat-line__message, [data-a-target="chat-line-message"]');
              chatMessages.forEach(message => {
                processChatMessage(message, modules);
              });
            }
          }
        }
      }
    }
  });
  
  // 監視の開始 - 子要素も監視対象にする
  observer.observe(chatContainer, {
    childList: true,
    subtree: true
  });
  
  console.log('Gemini Twitch Translator: チャットメッセージの監視を開始しました');
  
  // グローバル参照として保存（後で停止できるように）
  window._geminiTwitchObserver = observer;
}

/**
 * 既存のチャットメッセージを処理
 * @param {Element} chatContainer チャットコンテナ要素
 * @param {Object} modules モジュールオブジェクト
 */
function processExistingMessages(chatContainer, modules) {
  // 既存のチャットメッセージを取得
  const existingMessages = chatContainer.querySelectorAll('.chat-line__message, [data-a-target="chat-line-message"]');
  console.log(`Gemini Twitch Translator: ${existingMessages.length}件の既存メッセージを処理します`);
  
  // メッセージ数が多い場合は処理を適切に分散させる
  if (existingMessages.length > 20) {
    // 100ms間隔でバッチで処理（パフォーマンス対策）
    processMessageBatch(Array.from(existingMessages), 0, 5, modules);
  } else {
    // 少数の場合はすぐに処理
    existingMessages.forEach(message => {
      processChatMessage(message, modules);
    });
  }
}

/**
 * メッセージをバッチで処理（パフォーマンス対策）
 * @param {Array<HTMLElement>} messages メッセージ要素の配列
 * @param {number} startIndex 開始インデックス
 * @param {number} batchSize バッチサイズ
 * @param {Object} modules モジュールオブジェクト
 */
function processMessageBatch(messages, startIndex, batchSize, modules) {
  const endIndex = Math.min(startIndex + batchSize, messages.length);
  
  // 現在のバッチを処理
  for (let i = startIndex; i < endIndex; i++) {
    processChatMessage(messages[i], modules);
  }
  
  // メッセージがまだ残っていれば次のバッチをスケジュール
  if (endIndex < messages.length) {
    setTimeout(() => {
      processMessageBatch(messages, endIndex, batchSize, modules);
    }, 100);
  }
}

/**
 * チャットメッセージの処理
 * @param {HTMLElement} messageNode メッセージ要素
 * @param {Object} modules モジュールオブジェクト
 */
async function processChatMessage(messageNode, modules) {
  const { DOMManager, MessageProcessor, Messaging, constants } = modules;
  const { STORAGE_KEYS, TRANSLATION_MODE } = constants;
  
  // チャットメッセージ要素かどうかを確認
  if (!DOMManager.isChatMessage(messageNode)) {
    return;
  }
  
  try {
    // メッセージ情報を抽出
    const messageInfo = DOMManager.extractMessageInfo(messageNode);
    if (!messageInfo) return;
    
    const { text, username } = messageInfo;
    
    console.log(`[${username}]: ${text}`);
    
    // 翻訳設定を取得
    const settings = await Messaging.getSettings();
    
    // テキストが翻訳可能か確認
    if (!MessageProcessor.isTextTranslatable(text)) {
      return;
    }
    
    // 翻訳条件に合致するか確認
    if (!MessageProcessor.shouldTranslate(text, {
      translationMode: settings[STORAGE_KEYS.TRANSLATION_MODE] || TRANSLATION_MODE.NON_JAPANESE,
      targetLanguage: settings[STORAGE_KEYS.TARGET_LANGUAGE] || 'ja',
      sourceLanguages: settings[STORAGE_KEYS.SOURCE_LANGUAGES] || []
    })) {
      return;
    }
    
    // 翻訳リクエストを送信
    const translationResult = await Messaging.requestTranslation(messageInfo);
    
    // 翻訳結果を表示
    DOMManager.displayTranslation(
      messageNode, 
      translationResult.translatedText, 
      settings[STORAGE_KEYS.DISPLAY_STYLE]
    );
    
  } catch (error) {
    console.error('Gemini Twitch Translator: メッセージ処理エラー', error);
    Messaging.reportError(error, 'processChatMessage');
  }
}

// 翻訳リクエストと表示はMessagingモジュールとDOMManagerモジュールに移動

/**
 * 拡張機能の状態変更リスナー
 * @param {Object} modules モジュールオブジェクト
 */
function listenForStateChanges(modules) {
  const { constants } = modules;
  const { MESSAGE_TYPE, EXTENSION_STATE } = constants;
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPE.EXTENSION_STATE_CHANGE) {
      const newState = message.payload.state;
      
      if (newState === EXTENSION_STATE.ENABLED) {
        // 拡張機能が有効化された場合
        if (!window._geminiTwitchObserver) {
          initChatObserver(modules);
        }
      } else if (newState === EXTENSION_STATE.DISABLED) {
        // 拡張機能が無効化された場合
        stopChatObserver();
      }
      
      sendResponse({ success: true });
    }
    
    // 非同期レスポンスのためにtrueを返す
    return true;
  });
}

/**
 * チャット監視の停止
 */
function stopChatObserver() {
  if (window._geminiTwitchObserver) {
    window._geminiTwitchObserver.disconnect();
    window._geminiTwitchObserver = null;
    console.log('Gemini Twitch Translator: チャット監視を停止しました');
  }
}

/**
 * スタイルシートをページに挿入
 */
function injectStylesheet() {
  const styleElement = document.createElement('style');
  styleElement.id = 'gemini-twitch-translator-styles';
  
  // chrome.runtime.getURLを使用して拡張機能のスタイルシートを読み込む
  fetch(chrome.runtime.getURL('content/styles.css'))
    .then(response => response.text())
    .then(css => {
      styleElement.textContent = css;
      document.head.appendChild(styleElement);
      console.log('Gemini Twitch Translator: スタイルシートを読み込みました');
    })
    .catch(error => {
      console.error('Gemini Twitch Translator: スタイルシートの読み込みエラー', error);
      
      // エラー時は基本スタイルを直接設定
      styleElement.textContent = `
        .gemini-translation {
          color: #6c757d;
          font-size: 0.9em;
          margin-top: 2px;
          word-break: break-word;
        }
      `;
      document.head.appendChild(styleElement);
    });
}
