# Drive Markdown Editor

Google Drive 上の Markdown ファイル（`.md`）を、Drive の「アプリで開く」から起動してブラウザで閲覧・編集するための独立した Web アプリ。

> **現在のフェーズ: フェーズ1（Drive からの起動と閲覧 / Read-Only）**
> CodeMirror による編集と上書き保存（PATCH）はフェーズ2で追加予定。

## 技術スタック

| 領域 | 採用 |
|---|---|
| フレームワーク | React + Vite + TypeScript |
| Markdown プレビュー | react-markdown + remark-gfm |
| データフェッチ / 状態管理 | TanStack Query (React Query) |
| 認証 | Google Identity Services (GIS) / OAuth 2.0 |
| スコープ | `https://www.googleapis.com/auth/drive.file` |
| ホスティング | Cloudflare Pages（静的サイト） |

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. Google OAuth クライアント ID

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成。
2. **APIs & Services > Library** で **Google Drive API** を有効化。
3. **APIs & Services > Credentials > Create Credentials > OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins** に以下を登録:
     - 開発: `http://localhost:5173`
     - 本番: `https://<your-project>.pages.dev`(デプロイ後の URL)
4. 発行された **Client ID** を環境変数に設定:

```bash
cp .env.example .env.local
# .env.local を編集し VITE_GOOGLE_CLIENT_ID を設定
```

### 3. 開発サーバー

```bash
npm run dev
```

`state` パラメータをローカルで再現するには、Drive が渡す JSON を URL エンコードして付与する:

```
http://localhost:5173/?state=%7B%22ids%22%3A%5B%22<FILE_ID>%22%5D%2C%22action%22%3A%22open%22%7D
```

（デコード後: `{"ids":["<FILE_ID>"],"action":"open"}`）

> **注意 (drive.file スコープ):** このスコープでは「このアプリで開いた/作成したファイル」のみアクセスできます。
> 任意のファイル ID を直接渡すと **403** になります。実運用では Drive の「アプリで開く」経由で起動してください。

## Google Drive UI との統合（本番）

Drive の「アプリで開く」に表示するには、Google Workspace Marketplace SDK の
**Drive UI Integration** で以下を設定します（デプロイ後）:

- **Open URL**: デプロイ URL（例 `https://<your-project>.pages.dev`）
- 対応する MIME タイプ / 拡張子: `text/markdown`, `.md`
- Drive はこの URL に `?state={"ids":[...],"action":"open",...}` を付けて起動します。

## Cloudflare Pages へのデプロイ

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Environment variables**: `VITE_GOOGLE_CLIENT_ID` を設定
- SPA ルーティングは `public/_redirects` で担保。

## ディレクトリ構成

```
src/
  lib/
    driveState.ts     # ?state= のパース → fileId 抽出
    driveApi.ts       # Drive REST API v3 ラッパ（meta / alt=media）
  hooks/
    useGoogleAuth.ts  # GIS OAuth トークンクライアント
    useDriveFile.ts   # TanStack Query によるファイル取得
  components/
    LoginButton.tsx
    MarkdownPreview.tsx
    ErrorFallback.tsx  # 401 / 403 / 404 / ネットワークエラーの UI
  App.tsx             # 状態遷移のオーケストレーション
  main.tsx            # QueryClientProvider ルート
```

## ロードマップ

- [x] **フェーズ1**: Drive からの起動・OAuth・閲覧（Read-Only）
- [ ] **フェーズ2**: CodeMirror 6 統合・`PATCH` による上書き保存
- [ ] **フェーズ3**: Editor/Preview 分割・AST スクロール同期
