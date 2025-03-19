/**
 * Gemini API連携モジュール
 *
 * このモジュールはGoogle Gemini APIと通信し、テキスト翻訳機能を提供します。
 * Gemini Flash APIを使用して、低レイテンシーの翻訳処理を実現します。
 */

// APIエンドポイントとデフォルトパラメータ
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_TOP_K = 40;
const MAX_OUTPUT_TOKENS = 256;

// 翻訳プロンプトテンプレート
const TRANSLATION_PROMPT = `
あなたは翻訳のプロフェッショナルです。以下のテキストを日本語に翻訳してください：
入力言語は自動的に検出します。翻訳は自然で流暢な日本語にしてください。
テキストにはインターネットスラングやミームが含まれている可能性があり、
これらは日本語の等価な表現に変換してください。

ただし、翻訳結果は翻訳テキストのみを返してください。余分な説明や注釈は不要です。

テキスト: "{{text}}"
`;

/**
 * Gemini APIを使用してテキストを翻訳する
 * @param {string} text - 翻訳するテキスト
 * @param {string} apiKey - Gemini APIキー
 * @param {Object} options - 翻訳オプション
 * @returns {Promise<Object>} - 翻訳結果
 */
async function translateText(text, apiKey, options = {}) {
  if (!text || !apiKey) {
    return {
      success: false,
      error: "テキストまたはAPIキーが指定されていません",
      originalText: text,
    };
  }

  // 空文字や短すぎるテキストのチェック
  if (text.trim().length < 2) {
    return {
      success: false,
      error: "テキストが短すぎます",
      originalText: text,
    };
  }

  // 翻訳プロンプトの準備
  const prompt = TRANSLATION_PROMPT.replace("{{text}}", text);

  // リクエストパラメータの設定
  const params = new URLSearchParams({
    key: apiKey,
  }).toString();

  // リクエストボディの構築
  const requestBody = {
    // 1. プロンプトの設定
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],

    // 2. 生成設定
    generationConfig: {
      temperature: options.temperature || DEFAULT_TEMPERATURE, // 0.2: 応答の創造性（低いほど一貫性が高い）
      topP: options.topP || DEFAULT_TOP_P, // 0.95: トークン選択の多様性
      topK: options.topK || DEFAULT_TOP_K, // 40: 考慮する次のトークンの数
      maxOutputTokens: options.maxOutputTokens || MAX_OUTPUT_TOKENS, // 256: 最大出力トークン数
    },

    // 3. セーフティ設定
    safetySettings: [
      // すべてのカテゴリで制限を無効化（翻訳には不要なため）
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  try {
    // Gemini APIにリクエストを送信
    const response = await fetch(`${GEMINI_API_URL}?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // レスポンスが成功しなかった場合
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error:", errorData);

      // APIキーが無効または不正な場合
      if (
        response.status === 400 &&
        errorData.error &&
        (errorData.error.message.includes("API key") ||
          errorData.error.message.includes("Invalid value"))
      ) {
        return {
          success: false,
          error:
            "APIキーが無効です。オプションページで有効なAPIキーを設定してください。",
          originalText: text,
          status: response.status,
        };
      }

      // APIクォータ超過の場合
      if (response.status === 429) {
        return {
          success: false,
          error:
            "APIリクエスト制限に達しました。しばらく待ってから再試行してください。",
          originalText: text,
          status: response.status,
        };
      }

      return {
        success: false,
        error: `API エラー: ${response.status} ${response.statusText}`,
        originalText: text,
        status: response.status,
      };
    }

    // レスポンスデータの解析
    const data = await response.json();

    // 1. レスポンスデータの構造を確認
    if (
      data.candidates && // candidates配列が存在する
      data.candidates[0] && // 最初の候補が存在する
      data.candidates[0].content && // contentオブジェクトが存在する
      data.candidates[0].content.parts && // parts配列が存在する
      data.candidates[0].content.parts[0] && // 最初のpartが存在する
      data.candidates[0].content.parts[0].text // textプロパティが存在する
    ) {
      // 2. 翻訳テキストを取り出して空白を削除
      const translatedText = data.candidates[0].content.parts[0].text.trim();

      // 3. 成功レスポンスを返す
      return {
        success: true, // 処理成功
        translatedText: translatedText, // 翻訳されたテキスト
        originalText: text, // 元のテキスト
      };
    } else {
      // 4. レスポンス形式が予期しないものだった場合
      console.error("Unexpected API response format:", data); // デバッグ用ログ
      return {
        success: false, // 処理失敗
        error: "予期しないAPIレスポンス形式", // エラーメッセージ
        originalText: text, // 元のテキスト
        apiResponse: data, // デバッグ用の生のレスポンスデータ
      };
    }
  } catch (error) {
    console.error("Gemini API request error:", error);
    return {
      success: false,
      error: `リクエストエラー: ${error.message}`,
      originalText: text,
    };
  }
}

/**
 * APIキーの有効性をテストする
 * @param {string} apiKey - テストするAPIキー
 * @returns {Promise<Object>} - テスト結果
 */
async function testApiKey(apiKey) {
  if (!apiKey) {
    return {
      success: false,
      error: "APIキーが指定されていません",
    };
  }

  try {
    // シンプルなプロンプトでAPIキーをテスト
    const testResult = await translateText("Hello world", apiKey);
    return {
      success: testResult.success,
      message: testResult.success ? "APIキーは有効です" : testResult.error,
    };
  } catch (error) {
    console.error("API key test error:", error);
    return {
      success: false,
      error: `APIキーテスト中にエラーが発生しました: ${error.message}`,
    };
  }
}

export { translateText, testApiKey };
