/**
 * DOM管理モジュール
 *
 * Twitchページの要素操作に関する機能を提供します。
 * チャット要素の検索、メッセージの抽出、翻訳表示などを担当します。
 */

/**
 * チャットコンテナ要素を検索
 * @returns {Element|null} チャットコンテナ要素
 */
export function findChatContainer() {
  // Twitchのチャットコンテナを探す - より詳細なセレクタを使用
  const selectors = [
    ".chat-scrollable-area__message-container", // 一般的なセレクタ
    ".Layout-sc-1xcs6mc-0", // DOMサンプルから得た構造
    '[role="log"]', // チャットコンテナの一般的な属性
    ".stream-chat", // 古いインターフェースでの可能性
    ".chat-list", // さらに別の可能性
  ];

  for (const selector of selectors) {
    const container = document.querySelector(selector);
    if (container) {
      return container;
    }
  }

  return null;
}

/**
 * チャットメッセージからテキストを抽出
 * @param {HTMLElement} messageNode メッセージ要素
 * @returns {{text: string, username: string, timestamp: string}} 抽出されたメッセージ情報
 */
export function extractMessageInfo(messageNode) {
  if (!messageNode) return null;

  try {
    // メッセージテキストを抽出 - サンプルDOMに基づき優先順位付け
    const textSelectors = [
      ".text-fragment",
      '[data-a-target="chat-message-text"]',
      ".message", // 追加の可能性
      "span:not(.chat-author__display-name):not(.chat-line__timestamp)", // 一般的なspan
    ];

    let textElement = null;
    for (const selector of textSelectors) {
      const element = messageNode.querySelector(selector);
      if (element && element.textContent.trim()) {
        textElement = element;
        break;
      }
    }

    // セレクタで見つからない場合、ネストされたspanを探索
    if (!textElement) {
      const spans = messageNode.querySelectorAll("span");
      for (const span of spans) {
        // ユーザー名やタイムスタンプ以外のspanを対象に
        if (
          span.textContent.trim() &&
          !span.classList.contains("chat-author__display-name") &&
          !span.classList.contains("chat-line__timestamp")
        ) {
          textElement = span;
          break;
        }
      }
    }

    if (!textElement || !textElement.textContent.trim()) {
      return null;
    }

    // ユーザー名を抽出 - サンプルDOMに基づき優先順位付け
    const usernameSelectors = [
      ".chat-author__display-name",
      '[data-a-target="chat-message-username"]',
      ".chat-line__username",
    ];

    let usernameElement = null;
    for (const selector of usernameSelectors) {
      const element = messageNode.querySelector(selector);
      if (element && element.textContent.trim()) {
        usernameElement = element;
        break;
      }
    }

    // タイムスタンプを抽出 - サンプルDOMに基づき優先順位付け
    const timestampSelectors = [
      ".chat-line__timestamp",
      '[data-a-target="chat-timestamp"]',
    ];

    let timestampElement = null;
    for (const selector of timestampSelectors) {
      const element = messageNode.querySelector(selector);
      if (element && element.textContent.trim()) {
        timestampElement = element;
        break;
      }
    }

    // メッセージIDを取得
    let messageId = messageNode.dataset.aUser || messageNode.dataset.messageId;
    if (!messageId) {
      // ユーザー名とタイムスタンプから生成
      const username = usernameElement
        ? usernameElement.textContent.trim()
        : "";
      const timestamp = timestampElement
        ? timestampElement.textContent.trim()
        : "";
      messageId = `${username}_${timestamp}_${Date.now()}`;
    }

    return {
      text: textElement.textContent.trim(),
      username: usernameElement
        ? usernameElement.textContent.trim()
        : "Unknown",
      timestamp: timestampElement ? timestampElement.textContent.trim() : "",
      messageId,
    };
  } catch (error) {
    console.error("Gemini Twitch Translator: メッセージ情報抽出エラー", error);
    return null;
  }
}

/**
 * 翻訳結果の表示
 * @param {HTMLElement} messageNode メッセージ要素
 * @param {string} translatedText 翻訳テキスト
 * @param {Object} displayStyle 表示スタイル設定
 */
export function displayTranslation(
  messageNode,
  translatedText,
  displayStyle = {}
) {
  if (!translatedText || !messageNode) return;

  const {
    textColor = "#6c757d",
    backgroundColor = "transparent",
    fontStyle = "normal",
    prefix = "🌐 ",
  } = displayStyle;

  try {
    // 既存の翻訳要素を確認
    const existingTranslation = messageNode.querySelector(
      ".gemini-translation"
    );
    if (existingTranslation) {
      existingTranslation.textContent = `${prefix}${translatedText}`;
      return;
    }

    // 翻訳要素の作成
    const translationElement = document.createElement("div");
    translationElement.className = "gemini-translation";
    translationElement.textContent = `${prefix}${translatedText}`;

    // スタイルの適用
    Object.assign(translationElement.style, {
      color: textColor,
      backgroundColor,
      fontStyle,
      fontSize: "0.9em",
      marginTop: "2px",
      padding: "2px 0",
      wordBreak: "break-word",
    });

    // 挿入位置の特定
    const messageContainer = findMessageContainer(messageNode);

    // 翻訳要素を追加
    messageContainer.appendChild(translationElement);
  } catch (error) {
    console.error("Gemini Twitch Translator: 翻訳表示エラー", error);
  }
}

/**
 * メッセージコンテナ要素を検索
 * @param {HTMLElement} messageNode メッセージ要素
 * @returns {HTMLElement} メッセージコンテナ要素
 */
function findMessageContainer(messageNode) {
  // アップロードされたDOMサンプルに基づいてセレクタを追加
  const containerSelectors = [
    ".chat-line__message-container",
    ".chat-line__no-background",
    ".Layout-sc-1xcs6mc-0.jCLQvB",
    ".Layout-sc-1xcs6mc-0.cVmNmw",
    ".Layout-sc-1xcs6mc-0.cwtKyw",
  ];

  for (const selector of containerSelectors) {
    const container = messageNode.querySelector(selector);
    if (container) {
      return container;
    }
  }

  // 親要素を探す
  let parent = messageNode;
  // 最大5階層まで親を遡って適切なコンテナを探す
  for (let i = 0; i < 5; i++) {
    if (!parent || parent === document.body) break;

    // Layout関連のクラスを持つ親要素をコンテナとして使用
    if (
      parent.classList.contains("Layout-sc-1xcs6mc-0") ||
      parent.classList.contains("chat-line__message-container") ||
      parent.classList.contains("chat-line__no-background")
    ) {
      return parent;
    }

    parent = parent.parentElement;
  }

  // 適切なコンテナが見つからない場合は元のメッセージノードを返す
  return messageNode;
}

/**
 * メッセージ要素がチャットメッセージかどうかを判定
 * @param {HTMLElement} node 検査対象の要素
 * @returns {boolean} チャットメッセージの場合はtrue
 */
export function isChatMessage(node) {
  if (!node || !(node instanceof HTMLElement)) return false;

  // アップロードされたDOMサンプルを参考にした条件を追加
  return (
    node.classList.contains("chat-line__message") ||
    node.getAttribute("data-a-target") === "chat-line-message" ||
    node.querySelector(".chat-author__display-name") !== null ||
    node.querySelector('[data-a-target="chat-message-username"]') !== null ||
    node.querySelector(".text-fragment") !== null ||
    node.querySelector('[data-a-target="chat-message-text"]') !== null ||
    node.querySelector(".chat-line__message-container") !== null ||
    node.querySelector(".chat-line__username-container") !== null ||
    node.querySelector(
      ".Layout-sc-1xcs6mc-0.cwtKyw.chat-line__message-container"
    ) !== null
  );
}

/**
 * エラーメッセージの表示
 * @param {string} message エラーメッセージ
 */
export function showErrorMessage(message) {
  // エラー通知要素を作成
  const errorNotification = document.createElement("div");
  errorNotification.className = "gemini-translator-error";
  errorNotification.textContent = `Gemini Twitch Translator: ${message}`;

  // スタイルの適用
  Object.assign(errorNotification.style, {
    position: "fixed",
    bottom: "10px",
    right: "10px",
    backgroundColor: "rgba(220, 53, 69, 0.9)",
    color: "white",
    padding: "10px 15px",
    borderRadius: "4px",
    zIndex: "9999",
    boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
    fontSize: "14px",
    maxWidth: "300px",
  });

  // 既存のエラー通知を削除
  const existingError = document.querySelector(".gemini-translator-error");
  if (existingError) {
    existingError.remove();
  }

  // ページにエラー通知を追加
  document.body.appendChild(errorNotification);

  // 5秒後に自動的に消える
  setTimeout(() => {
    if (errorNotification.parentNode) {
      errorNotification.remove();
    }
  }, 5000);
}
