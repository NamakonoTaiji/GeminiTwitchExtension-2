/**
 * コンテンツスクリプトローダー
 * 
 * このスクリプトはTwitchページに直接挿入され、チャットメッセージを監視して翻訳機能を提供します。
 * MutationObserverを使用してDOMの変更を監視し、新しいチャットメッセージを検出します。
 */

// モジュールは動的にロードします

// グレースピリオド状態の管理
let inGracePeriod = false;
let gracePeriodTimer = null;
const GRACE_PERIOD_DURATION = 5000; // 5秒
const INITIAL_GRACE_PERIOD_DURATION = 8000; // 初回読み込み時はより長く設定（8秒）

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
    // 初回読み込み時にグレースピリオドを開始
    // ページ読み込み時に遅れて読み込まれるコメントを既存コメントとして処理するため
    startGracePeriod(location.href, 'initial-load');
    
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
    
    // URL監視を設定
    setupUrlMonitor();
    
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
    // 現在のグレースピリオド状態をログに記録
    console.log(`Gemini Twitch Translator: メッセージ監視中 - グレースピリオド状態: ${inGracePeriod}`);
    
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // 追加された各ノードを処理
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            // 直接チャットメッセージの場合
            if (DOMManager.isChatMessage(node)) {
              // グレースピリオド中ならメッセージにマークを付ける
              if (inGracePeriod) {
                node.dataset.addedDuringGracePeriod = 'true';
                console.log('Gemini Twitch Translator: グレースピリオド中のメッセージを検出し、マークを設定しました');
              } else {
                console.log('Gemini Twitch Translator: 通常時のメッセージを検出、翻訳を開始します');
                processChatMessage(node, modules);
              }
            } else {
              // 子要素にチャットメッセージがあるか確認
              const chatMessages = node.querySelectorAll('.chat-line__message, [data-a-target="chat-line-message"]');
              if (chatMessages.length > 0) {
                console.log(`Gemini Twitch Translator: 子要素に${chatMessages.length}件のメッセージを検出しました`);
                
                chatMessages.forEach(message => {
                  // グレースピリオド中ならメッセージにマークを付ける
                  if (inGracePeriod) {
                    message.dataset.addedDuringGracePeriod = 'true';
                    console.log('Gemini Twitch Translator: グレースピリオド中の子メッセージを検出、マークを設定しました');
                  } else {
                    console.log('Gemini Twitch Translator: 通常時の子メッセージを検出、翻訳を開始します');
                    processChatMessage(message, modules);
                  }
                });
              }
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
  console.log(`Gemini Twitch Translator: ${existingMessages.length}件の既存メッセージが見つかりました`);
  
  // 実際に処理は行わない。
  // MutationObserverがグレースピリオド中にこれらを再度検出し、
  // その時にグレースピリオドマークが付与される
  
  // ログだけ記録する
  console.log('Gemini Twitch Translator: 既存メッセージを検出しました。これらはグレースピリオド中に翻訳から除外されます');
}

/**
 * メッセージをバッチで処理（パフォーマンス対策）
 * 注: 現在は使用しないが、将来的に必要になる可能性があるため残しておく
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
  
  // グレースピリオド中の場合、メッセージにマークを付けて処理をスキップ
  if (inGracePeriod) {
    // グレースピリオド中に追加されたメッセージとしてマーク
    messageNode.dataset.addedDuringGracePeriod = 'true';
    return; // 翻訳しない
  }
  
  // グレースピリオド中に追加されたメッセージは翻訳しない
  if (messageNode.dataset.addedDuringGracePeriod === 'true') {
    return; // 翻訳しない
  }
  
  try {
    // メッセージ情報を抽出
    const messageInfo = DOMManager.extractMessageInfo(messageNode);
    if (!messageInfo) return;
    
    const { text, username } = messageInfo;
    
    console.log(`[${username}]: ${text}`);
    
    // 処理済みフラグのチェック（二重処理防止）
    if (messageNode.dataset.geminiProcessed === 'true') {
      console.log('Gemini Twitch Translator: 既に処理済みのメッセージをスキップします');
      return;
    }
    
    // 処理中としてマーク
    messageNode.dataset.geminiProcessing = 'true';
    
    try {
      // 翻訳設定を取得
      const settings = await Messaging.getSettings();
      
      // テキストが翻訳可能か確認
      if (!MessageProcessor.isTextTranslatable(text)) {
        messageNode.dataset.geminiProcessed = 'true'; // 処理済みとしてマーク
        delete messageNode.dataset.geminiProcessing; // 処理中フラグを削除
        return;
      }
      
      // 翻訳条件に合致するか確認
      if (!MessageProcessor.shouldTranslate(text, {
        translationMode: settings[STORAGE_KEYS.TRANSLATION_MODE] || TRANSLATION_MODE.NON_JAPANESE,
        targetLanguage: settings[STORAGE_KEYS.TARGET_LANGUAGE] || 'ja',
        sourceLanguages: settings[STORAGE_KEYS.SOURCE_LANGUAGES] || []
      })) {
        messageNode.dataset.geminiProcessed = 'true'; // 処理済みとしてマーク
        delete messageNode.dataset.geminiProcessing; // 処理中フラグを削除
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
      
      // 処理済みとしてマーク
      messageNode.dataset.geminiProcessed = 'true';
      delete messageNode.dataset.geminiProcessing; // 処理中フラグを削除
    } catch (settingsError) {
      console.error('Gemini Twitch Translator: 設定取得または翻訳処理エラー', settingsError);
      
      // エラーの種類によって処理を分ける
      if (settingsError.message && settingsError.message.includes('context invalidated')) {
        // コンテキスト無効化エラーの場合は特別な処理
        console.warn('Gemini Twitch Translator: 拡張機能コンテキストの無効化を検出しました');
        
        // フラグをクリア（将来の処理で再試行できるように）
        delete messageNode.dataset.geminiProcessed;
        delete messageNode.dataset.geminiProcessing;
        
        // エラーを報告
        Messaging.reportError(settingsError, 'processChatMessage_contextInvalidated');
      } else {
        // その他のエラー
        console.error('Gemini Twitch Translator: メッセージ処理中のエラー', settingsError);
        
        // 処理済みとしてマーク（エラーメッセージの場合も二度と処理しない）
        messageNode.dataset.geminiProcessed = 'true';
        delete messageNode.dataset.geminiProcessing;
        
        // エラーを報告
        Messaging.reportError(settingsError, 'processChatMessage');
      }
    }
  } catch (error) {
    // 外側のtry-catchでキャッチする致命的なエラー
    console.error('Gemini Twitch Translator: 深刻なメッセージ処理エラー', error);
    
    // 処理済みとマーク
    if (messageNode) {
      messageNode.dataset.geminiProcessed = 'true';
      delete messageNode.dataset.geminiProcessing;
    }
    
    Messaging.reportError(error, 'processChatMessage_fatal');
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
 * URL変更時にグレースピリオドを開始する
 * ページ遷移中の不安定な状態での誤処理を防止するための機能
 * 
 * @param {string} newUrl 新しいURL
 * @param {string} method 変更方法（pushState, replaceState, popstate, initial-loadなど）
 */
function startGracePeriod(newUrl, method) {
  console.log(`Gemini Twitch Translator: グレースピリオド開始 - ${method}`);
  
  // 既存のグレースピリオドタイマーをクリア
  if (gracePeriodTimer) {
    clearTimeout(gracePeriodTimer);
    console.log('Gemini Twitch Translator: 以前のグレースピリオドタイマーをクリアしました');
  }
  
  // グレースピリオド状態を設定
  inGracePeriod = true;
  console.log(`Gemini Twitch Translator: グレースピリオドフラグをtrueに設定しました - 現在の状態: ${inGracePeriod}`);
  
  // ページ初回読み込み時はより長いグレースピリオドを設定
  const duration = method === 'initial-load' ? INITIAL_GRACE_PERIOD_DURATION : GRACE_PERIOD_DURATION;
  console.log(`Gemini Twitch Translator: ${duration/1000}秒のグレースピリオドを設定しました`);
  
  // 指定された時間後にグレースピリオドを終了
  gracePeriodTimer = setTimeout(() => {
    endGracePeriod();
  }, duration);
}

/**
 * グレースピリオドを終了する
 */
function endGracePeriod() {
  console.log('Gemini Twitch Translator: グレースピリオド終了 - 通常処理を再開');
  inGracePeriod = false;
  gracePeriodTimer = null;
  console.log(`Gemini Twitch Translator: グレースピリオドフラグをfalseに設定しました - 現在の状態: ${inGracePeriod}`);
}

/**
 * URL監視機能を設定する
 * History APIをオーバーライドしてURL変更を検出する
 */
function setupUrlMonitor() {
  // 現在のURLを記録
  let currentUrl = location.href;
  console.log(`Gemini Twitch Translator: URL監視開始 - 現在のURL: ${currentUrl}`);
  
  // popstateイベントのリスナー設定
  window.addEventListener('popstate', function(event) {
    const newUrl = location.href;
    if (newUrl !== currentUrl) {
      console.log(`Gemini Twitch Translator: URL変更検出 (popstate): ${currentUrl} -> ${newUrl}`);
      currentUrl = newUrl;
      
      // グレースピリオドを開始
      startGracePeriod(newUrl, 'popstate');
    }
  });
  
  // History APIのオーバーライド
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  // pushStateをオーバーライド
  history.pushState = function() {
    // 元のメソッドを呼び出す
    const result = originalPushState.apply(this, arguments);
    
    // 遅延を入れてURL変更をチェック（pushState後に実際のURLが更新されるのを待つ）
    setTimeout(() => {
      const newUrl = location.href;
      if (newUrl !== currentUrl) {
        console.log(`Gemini Twitch Translator: URL変更検出 (pushState): ${currentUrl} -> ${newUrl}`);
        currentUrl = newUrl;
        
        // グレースピリオドを開始
        startGracePeriod(newUrl, 'pushState');
      }
    }, 0);
    
    return result;
  };
  
  // replaceStateをオーバーライド
  history.replaceState = function() {
    // 元のメソッドを呼び出す
    const result = originalReplaceState.apply(this, arguments);
    
    // 遅延を入れてURL変更をチェック
    setTimeout(() => {
      const newUrl = location.href;
      if (newUrl !== currentUrl) {
        console.log(`Gemini Twitch Translator: URL変更検出 (replaceState): ${currentUrl} -> ${newUrl}`);
        currentUrl = newUrl;
        
        // グレースピリオドを開始
        startGracePeriod(newUrl, 'replaceState');
      }
    }, 0);
    
    return result;
  };
  
  // 定期的なURLチェック（別の方法でURL変更が発生した場合を検出するため）
  setInterval(() => {
    const newUrl = location.href;
    if (newUrl !== currentUrl) {
      console.log(`Gemini Twitch Translator: URL変更検出 (polling): ${currentUrl} -> ${newUrl}`);
      currentUrl = newUrl;
      
      // グレースピリオドを開始
      startGracePeriod(newUrl, 'polling');
    }
  }, 1000); // 1秒ごとにチェック
  
  console.log('Gemini Twitch Translator: URL監視機能を設定しました');
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
