# Gemini Twitch Translator - 開発者セットアップガイド

このガイドは、Gemini Twitch Translator 拡張機能の開発環境のセットアップと開発プロセスについて説明します。

## 1. 前提条件

以下のツールとアカウントが必要です：

- **Git**: バージョン管理
- **Node.js**: 最新のLTS版
- **npm** または **yarn**: パッケージ管理
- **Google Cloud Platform アカウント**: Gemini API キー取得用
- **Chrome ブラウザ**: 拡張機能の開発とテスト用
- **テキストエディタ/IDE**: Visual Studio Code 推奨
- **Twitch アカウント**: テスト用

## 2. リポジトリのクローン

```bash
git clone https://github.com/yourusername/gemini-twitch-translator.git
cd gemini-twitch-translator
```

## 3. 開発環境のセットアップ

### 3.1 依存パッケージのインストール

本プロジェクトは最小限の依存関係を持ちますが、開発ツールをインストールします：

```bash
npm install
```

または

```bash
yarn
```

### 3.2 Gemini API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. Gemini API を有効化
4. API キーを作成
5. API キーをメモ（次のステップで使用）

### 3.3 環境変数の設定

1. リポジトリのルートディレクトリに `.env` ファイルを作成
2. 以下の内容を追加（APIキーを自分のものに置き換え）

```
GEMINI_API_KEY=your_api_key_here
```

**注意**: `.env` ファイルは `.gitignore` に追加されており、リポジトリにコミットされません。

## 4. 拡張機能のビルドと実行

### 4.1 開発モードでのビルド

```bash
npm run dev
```

または

```bash
yarn dev
```

これにより、`dist` ディレクトリにビルドされた拡張機能が生成されます。

### 4.2 Chrome での拡張機能の読み込み

1. Chrome ブラウザで `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. リポジトリの `dist` ディレクトリを選択

これで拡張機能がブラウザに読み込まれ、開発とテストができるようになります。

### 4.3 変更の自動反映

現在は自動ビルドシステムが実装されていないため、コードを変更した後は手動でビルドし、Chrome で拡張機能を更新（リロード）する必要があります。

1. コードを変更
2. `npm run dev` または `yarn dev` を実行してビルド
3. Chrome の拡張機能ページで、拡張機能の「更新」ボタンをクリック

## 5. ディレクトリ構造

```
gemini-twitch-translator/
├── background/             # バックグラウンドスクリプト
│   ├── background.js       # メインエントリーポイント
│   └── modules/            # バックグラウンドのモジュール
├── content/                # コンテンツスクリプト
│   ├── content_loader.js   # メインエントリーポイント
│   └── modules/            # コンテンツのモジュール
├── shared/                 # 共有モジュール
│   ├── constants.js        # 定数定義
│   └── ...                 # その他の共有機能
├── utils/                  # ユーティリティモジュール
├── popup/                  # ポップアップUI
├── options/                # オプションページ
├── icons/                  # アイコンリソース
├── docs/                   # ドキュメント
├── tests/                  # テスト
├── .gitignore              # Git除外設定
├── manifest.json           # 拡張機能マニフェスト
├── package.json            # npm設定
└── README.md               # 説明文
```

## 6. 開発ワークフロー

### 6.1 機能実装

1. 新しいブランチを作成：`git checkout -b feature/feature-name`
2. コードを実装
3. 動作をテスト
4. コードをコミット：`git commit -m "[ComponentName] 変更内容の説明"`
5. リモートにプッシュ：`git push origin feature/feature-name`
6. プルリクエストを作成

### 6.2 バグ修正

1. バグ修正用ブランチを作成：`git checkout -b fix/bug-description`
2. 修正を実装
3. 修正をテスト
4. コードをコミット：`git commit -m "[ComponentName] バグ修正の説明"`
5. リモートにプッシュ：`git push origin fix/bug-description`
6. プルリクエストを作成

### 6.3 コミットメッセージの形式

コミットメッセージは以下の形式に従ってください：

```
[コンポーネント] タイトル

詳細な説明（必要な場合）

関連課題: #課題番号
```

例：
```
[ContentScript] チャットメッセージ検出ロジックを改善

- 複数のセレクタパターンを追加
- 検出失敗時のフォールバック処理を実装
- エラーログを詳細化

関連課題: #42
```

## 7. デバッグ

### 7.1 コンテンツスクリプトのデバッグ

1. Twitch ページを開く
2. Chrome DevTools を開く（F12 または右クリック→「検証」）
3. 「Sources」タブで、`content_scripts` → `content_loader.js` を探す
4. ブレークポイントを設定してデバッグ

### 7.2 バックグラウンドスクリプトのデバッグ

1. Chrome の拡張機能ページ（`chrome://extensions`）を開く
2. Gemini Twitch Translator の「詳細」をクリック
3. 「バックグラウンドページを検証」をクリック
4. 表示された DevTools でブレークポイントを設定してデバッグ

### 7.3 ログの確認

拡張機能は、重要な情報をコンソールログに出力します：

- コンテンツスクリプトのログ：Twitch ページの DevTools コンソールに表示
- バックグラウンドスクリプトのログ：バックグラウンドページの DevTools コンソールに表示

デバッグモードを有効にすると、より詳細なログが出力されます。

## 8. テスト

### 8.1 手動テスト

現在、テストは主に手動で行われます：

1. 拡張機能を Twitch ページで有効化
2. チャットでの翻訳機能をテスト
3. 設定の変更と効果を確認
4. エラー処理をテスト（APIキーの無効化など）

### 8.2 自動テスト

将来的には、Jest を使った自動テスト環境を導入する予定です。

## 9. コードスタイルとベストプラクティス

### 9.1 JavaScript

- ES Modules を使用
- async/await を優先して使用
- 型注釈にJSDocを使用
- 短い関数と明確な責務分割

### 9.2 命名規則

- ファイル名：キャメルケース（例：`translationHandler.js`）
- 関数：キャメルケース（例：`processMessage()`）
- 定数：大文字スネークケース（例：`MAX_CACHE_SIZE`）
- クラス：パスカルケース（例：`MessageProcessor`）

### 9.3 コメント

- 公開API：JSDocスタイルのコメント
- 複雑なロジック：「なぜ」それを行うのかを説明するコメント
- TODOコメント：改善点や将来の変更点

## 10. 貢献ガイドライン

プロジェクトに貢献する際は、以下のガイドラインに従ってください：

1. 実装前に課題を作成または選択
2. 課題に基づいて作業ブランチを作成
3. コードスタイルとベストプラクティスに従って実装
4. 変更を十分にテスト
5. プルリクエストを作成し、詳細な説明を含める
6. コードレビューのフィードバックに基づいて調整
7. 承認後、変更がマージされる

## 11. トラブルシューティング

### 11.1 よくある問題

#### 拡張機能が読み込まれない
- manifest.json の構文エラーを確認
- コンソールエラーを確認
- 拡張機能を更新または再インストール

#### 翻訳が機能しない
- APIキーが正しく設定されているか確認
- バックグラウンドコンソールでエラーを確認
- ネットワーク接続を確認

#### コンテキスト無効化エラー
- Service Workerの制約に注意
- 長期実行コードをバックグラウンドスクリプトに移動
- 状態の保存と復元メカニズムを使用

### 11.2 サポートリソース

- プロジェクトの課題トラッカー
- Chrome拡張機能開発ドキュメント
- Gemini API ドキュメント

## 12. リリースプロセス

### 12.1 バージョニング

セマンティックバージョニングを使用：

- メジャー(x.0.0)：後方互換性のない変更
- マイナー(0.x.0)：後方互換性のある新機能
- パッチ(0.0.x)：バグ修正

### 12.2 リリース手順

1. `manifest.json` のバージョンを更新
2. 変更ログを更新
3. リリースブランチを作成：`release/vX.Y.Z`
4. 最終テストを実行
5. プロダクションビルドを生成：`npm run build`
6. Chrome Web Store にアップロード

## 13. 参考ドキュメント

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [MutationObserver API](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)

## 14. プロジェクト連絡先

- プロジェクト管理者：[メールアドレス]
- 課題トラッカー：[URL]
- コミュニケーションチャンネル：[Slack/Discord/その他]
