# Drive Markdown Editor 設計書

> 本書は、このアプリケーションを（LLM を含む）第三者がゼロから再作成しても、
> 同等の機能・操作性・デザインが再現できることを目的とした完全な設計仕様である。
> バージョン: 2026-07-23 時点の実装（コミット `62914be`）に基づく。

---

## 1. 目的とコンセプト

Google Drive 上の Markdown（`.md`）ファイルを、Drive の「アプリで開く」から起動して
ブラウザ上で閲覧・編集・上書き保存できる独立 Web アプリケーション。

- **起動経路が本質**: ユーザーは Drive UI でファイルを右クリック →「アプリで開く」で起動する。
  アプリ単体で開いた場合はファイルを開けない（後述の `drive.file` スコープ設計による意図的制約）。
- **ローカル同期との共存**: ユーザーは Drive を rclone 等でローカル同期し、Obsidian などでも
  同じファイルを開く。ゆえに「Markdown の可搬性」（相対パス画像・標準記法）を最優先する。
- **編集を邪魔しない UX**: Lint 警告等はステータスバーに件数のみ。詳細はユーザーが意思を
  持って開く。

## 2. 技術スタックとインフラ

| 領域 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | React 18 + Vite 5 + TypeScript 5 | SPA・静的ビルド |
| エディタ | CodeMirror 6（`codemirror` メタパッケージ + `@codemirror/lang-markdown` + `@codemirror/language-data` + `@codemirror/theme-one-dark` + `@codemirror/commands`） | |
| プレビュー | react-markdown 9 + remark-gfm + rehype-highlight | |
| 図 | mermaid 11（遅延 import） | MIT |
| Lint | markdownlint（`markdownlint/promise`、遅延 import） | MIT |
| Formatter | prettier standalone + `prettier/plugins/markdown`（遅延 import） | MIT |
| 状態管理 | TanStack Query 5（fetch は useQuery / 保存は useMutation） | |
| 認証 | Google Identity Services (GIS) トークンフロー | `index.html` で `https://accounts.google.com/gsi/client` を async 読込 |
| ホスティング | Cloudflare Pages（git 連携、`npm run build` → `dist`） | SPA リダイレクトは `public/_redirects` |

環境変数: `VITE_GOOGLE_CLIENT_ID`（OAuth Web クライアント ID）。ローカルは `.env.local`、
本番は Pages の環境変数に設定してビルド時埋め込み。

### 外部設定（コード外・再現に必須）

1. **Google Cloud Console**
   - Google Drive API を有効化。
   - OAuth クライアント（Web application）を作成し、承認済み JavaScript 生成元に
     `http://localhost:5173` と本番 URL を登録。
   - **Drive API の「Drive UI Integration」タブ**（Marketplace SDK 経由ではない）で設定:
     Open URL = 本番 URL、Default MIME types = `text/markdown`,`text/x-markdown`、
     Default file extensions = `md`,`markdown`、アイコン登録。
   - Drive は Open URL に `?state={"ids":["<fileId>"],"action":"open",...}` を付与して起動する。
2. **Marketplace 公開は不要**: `drive.install` スコープに同意した時点で、そのユーザーの
   Drive の「アプリで開く」メニューに登録される（個人向けインストール）。
3. **Cloudflare Pages**: GitHub 連携で `main` ブランチを自動デプロイ。
   Build command `npm run build` / Output `dist` / env `VITE_GOOGLE_CLIENT_ID`。

## 3. OAuth / スコープ設計（重要な意思決定）

- 要求スコープは 2 つ:
  `https://www.googleapis.com/auth/drive.file`（アプリが開いた/作成したファイルのみ）
  `https://www.googleapis.com/auth/drive.install`（「アプリで開く」への登録）
- **フルスコープ `drive` は採用しない**（ユーザー決定）。その帰結として:
  - 外部ツール（rclone 等）が作成した `images` フォルダ・画像はアプリから**不可視**。
    プレビューで解決できない相対画像は「🖼 …（このアプリでは表示できません）」チップ表示。
  - `images` フォルダの重複作成リスクがある（同名フォルダ共存可のため）。
  - 将来的にフルスコープへ切り替える escape hatch を README/設計に明記しておく。
- GIS は `initTokenClient`（トークンフロー）。取得トークンはメモリ保持のみ
  （localStorage に保存しない）。有効期限切れ（401）は UI から再ログイン導線で回復。

## 4. データフロー

### 起動〜表示
1. `driveState.ts` が `?state=` を JSON パースし、`action === "open"` を検証して
   `ids[0]` を fileId として取り出す。不正・欠落時は null。
2. fileId 無しの直アクセス時は案内画面 + **ログインボタンを必ず表示**する
   （drive.install 同意＝インストール導線。これが無いと初回登録が不可能になる）。
3. 認証後、`useDriveFile` が useQuery で
   `GET /drive/v3/files/{id}?fields=id,name,mimeType,modifiedTime,parents`（メタ）と
   `GET /drive/v3/files/{id}?alt=media`（本文）を並列取得。
   queryKey は `["driveFile", fileId, accessToken]`。401/403/404 はリトライしない。
4. エラーは `DriveApiError`（status 保持）で分岐し、`ErrorFallback` が
   401（再ログイン）/403（アプリで開き直す案内）/404/ネットワークをそれぞれ説明。

### 編集〜保存
- `draft: string | null` が編集バッファ（null = 未編集）。CodeMirror の updateListener →
  `onChange` → `setDraft` の一方向。**外部から draft を書き換えない**
  （変更は必ず CodeMirror トランザクション経由。インライン編集も同様）。
- `isDirty = draft !== null && draft !== savedContent`。
- 保存: `PATCH /upload/drive/v3/files/{id}?uploadType=media&fields=...`、
  Content-Type `text/markdown; charset=UTF-8`。リビジョンは Drive 側が自動保持。
- `useSaveDriveFile`（useMutation）の onSuccess で `setQueryData` によりキャッシュの
  content/meta を保存値へ差し替え → dirty が自然に解消し「最終保存」時刻も更新される。
- `Ctrl/Cmd+S` は window レベルでも捕捉（エディタ外フォーカス対応）。
  インライン編集ポップオーバー表示中は文書保存を抑止（ポップオーバー側の適用が優先）。
- dirty 中のタブクローズは `beforeunload` で警告。

## 5. 画面構造と UI 仕様

```
┌─ header ──────────────────────────────────────────────────────┐
│ [文書タイトル(1.3rem bold) ●dirty]      [保存状態][保存][✏️◫👁][?][🌙] │
│  └ 最終保存 yyyy/mm/dd hh:mm                                   │
├─ toolbar ─────────────────────────────────────────────────────┤
│ ↶ ↷ │ B I S <> │ H1 H2 H3 │ ・ 1. ☑ " │ 🔗 ― ▦ │ 🪄            │
├─ workspace（グリッド、モードでアニメーション） ────────────────┤
│ ┌ pane-editor ┐  ┌ pane-preview ┐                             │
│ │ CodeMirror  │  │ react-markdown│                            │
│ └─────────────┘  └──────────────┘                             │
├─ lint-panel（開いた時のみ・max-height 30vh） ──────────────────┤
└─ status-bar: [✓/⚠ Lint: N件] ……………………… [12,345 文字] ─────────┘
```

- `.app` は `max-width: 1500px` 中央寄せ、`height: 100vh` の flex column。
  ヘッダ・ツールバー固定、ペイン内部スクロール。
- **文書タイトルが主役**（Joplin/Inkdrop に倣う）: ファイル名を大きく表示し、
  ブラウザタブも `{ファイル名} - Drive Markdown Editor` に同期。
  アプリ名はファイル未オープン時のみタイトルに出す。
- **モード切替と書式操作は場所を分離**（Kobito に倣う）: モードはヘッダ右、書式はツールバー。

### 表示モード（3種）とアニメーション

- `edit` / `split` / `preview`。初期値は `window.innerWidth >= 960 ? "split" : "edit"`。
- **両ペインは常時マウント**し、`.workspace` の `grid-template-columns` を
  `1fr 0fr`（edit）/ `1fr 1fr`（split）/ `0fr 1fr`（preview）で切替、
  `transition: grid-template-columns 0.3s ease, gap 0.3s ease` + 非表示ペイン opacity 0。
  - 効果1: モード切替がスムーズにアニメーションする。
  - 効果2: **エディタが再マウントされないため、カーソル・undo 履歴・スクロールが保持される**。
- 900px 以下では split は縦積み（1fr / 1fr 行）。
- エディタの再マウントは「ファイル ID が変わった時」のみ（`key={meta.id}`）。

### 入力性能

- プレビューへ渡す内容は `useDeferredValue` で低優先度化（大きい文書でも入力が引っかからない）。

## 6. エディタ設計（CodeMirror 6）

### ラッパーの原則（`MarkdownEditor.tsx`）
- EditorView は **mount 時に 1 回だけ生成**。`onChange`/`onSave`/`onViewReady`/`onPasteImage`
  は ref 経由で最新を参照させ、再レンダーで view を壊さない。
- 拡張: 独自 keymap（basicSetup より前に置いて優先）、basicSetup、
  `markdown({ base: markdownLanguage, codeLanguages: languages })`（コードブロック内
  ハイライトは言語別遅延ロード）、`EditorView.lineWrapping`、updateListener、
  テーマ用 `Compartment`（dark 切替時に `oneDark ⇄ []` を reconfigure。view は再生成しない）。
- 画像ペースト: `EditorView.domEventHandlers({ paste })` で clipboard の `image/*` を検出 →
  プレースホルダ `![アップロード中…](uploading-<ts>)` を挿入 → アップロード完了で
  `![](images/xxx.png)` に置換（失敗時はプレースホルダ除去 + alert）。

### コマンドレジストリ / ショートカット Config（単一ソース原則）

```
lib/editorCommands.ts  … 全コマンド { id, label, hint?, run(view, ctx) } の配列
lib/shortcutConfig.ts  … Record<CommandId, キー表記> を DEFAULT + localStorage
                         "shortcut-overrides" のマージで解決
```
この 2 つから **(a) CodeMirror keymap (b) ツールバーのツールチップ (c) ヘルプモーダルの表**
がすべて導出される。ショートカット変更 UI は未実装だが localStorage 上書きは既に機能する。

デフォルト割当（著名エディタの慣習準拠。Mod = Ctrl / macOS ⌘）:

| コマンド | キー | 由来 |
|---|---|---|
| save | Mod-s | 共通 |
| undo / redo | Mod-z / Mod-y | 共通 |
| bold / italic | Mod-b / Mod-i | 共通 |
| strikethrough | Mod-Shift-x | Obsidian/Slack |
| code（スマート） | Mod-e | Typora |
| heading1..3 | Mod-1..3 | Typora/Obsidian |
| orderedList / bulletList / taskList | Mod-Shift-7 / 8 / 9 | Google Docs |
| quote | Mod-Shift-q | Typora |
| link | Mod-k | 共通 |
| table（3列×2行） | Mod-Alt-t | Ctrl+T はブラウザ予約のため Alt 変形 |
| horizontalRule | Mod-Alt-h | — |
| formatDoc | Shift-Alt-f | VS Code |
| （固定）リストインデント | Tab / Shift-Tab | Config 非管理 |

表示は macOS 判定で `⌘⇧8` 形式、それ以外は `Ctrl+Shift+8` 形式に整形。

### Markdown 編集コマンドの動作仕様（`lib/markdownCommands.ts`）

- **toggleInlineMark(mark)**: 選択の外側または内側にマークがあれば剥がす（トグル）。
  無ければ包む。空選択ではペアを挿入しカーソルを内側へ。複数選択レンジ対応
  （`changeByRange`）。
- **スマートコード**: 選択に改行を含めば `toggleCodeBlock`、それ以外はインライン ` ` `。
- **toggleCodeBlock**: 選択行の直前後がフェンス（```）ならフェンス除去。無ければ
  前後にフェンス挿入し、カーソルを開始フェンス直後（言語名を即入力できる位置）へ。
- **setHeading(level)**: 選択行の既存 `#{1,6} ` を置換。全行が同レベルなら解除（トグル）。
- **toggleLinePrefix("- " / "> ")**: 選択行すべてに付与、全行が既に持つ場合は除去。
  空行はスキップ（単一行選択時を除く）。
- **toggleOrderedList**: `1. 2. 3.` を連番で付与 / `^\d+\.\s` を除去。
- **toggleTaskList**: `- [ ] ` をトグル。既存の `- ` 行は `[ ] ` を挿入して**昇格**
  （二重プレフィックスにしない）。
- **changeListIndent(±1)**: 選択行がすべてリスト項目（`[-*+]` または `\d+.`）の時のみ
  4 スペース増減。リスト外では false を返し Tab は既定動作へ。
- **insertLink**: 選択有 → `[選択](│)`（カーソルは URL 席）。選択無 → `[│]()`（テキスト席）。
- **insertHorizontalRule**: 現在行の後に空行 + `---` を挿入。
- **insertTable(rows, cols)**: ヘッダ行 + `| --- |` 区切り + 空ボディ rows 行を挿入、
  カーソルは先頭セル。ツールバーの表ボタンは 6×5 の Excel 風サイズピッカー
  （ホバーで範囲ハイライト・下部に「c 列 × r 行（+ヘッダ）」表示）。
- すべて 1 トランザクション（undo 単位）で `userEvent: "input"`、実行後に `view.focus()`。

### ツールバー構成

グループを縦区切り線で分離（Joplin/Inkdrop に倣う）:
`[undo redo] | [B I S code] | [H1 H2 H3 ←テキストボタン] | [ul ol task quote] | [link hr] [tablePicker] | [formatDoc]`
アイコンは 16px・stroke 2px の lucide 風インライン SVG（外部アイコン依存なし）。
プレビューモード中は全ボタン disabled。

## 7. プレビュー設計

### レンダリングパイプライン
```
react-markdown
  remarkPlugins: [remark-gfm]
  rehypePlugins: [rehypeSourceLine, [rehypeHighlight, { plainText: ["mermaid"] }]]
  components: { img: DriveImage, code: CodeOrMermaid }
```

- **rehypeSourceLine（自作・約15行）**: hast の全 element に
  `data-line = position.start.line` を付与。これが**スクロール同期とインライン編集の基盤**。
- **シンタックスハイライト**: rehype-highlight（hljs クラス出力）。配色は CSS で自前定義
  （GitHub 風パレット。light: keyword #cf222e / string #0a3069 / title #8250df /
  number #0550ae / attr #116329 / comment #6e7781、dark: #ff7b72 / #a5d6ff / #d2a8ff /
  #79c0ff / #7ee787 / #8b949e）。`[data-theme="dark"]` セレクタで切替。
- **Mermaid**: ` ```mermaid ` フェンスを `MermaidBlock` が SVG 描画。
  mermaid は初回使用時に動的 import。`securityLevel: "strict"`、テーマは dark ⇄ default。
  **入力途中の構文エラー時は最後に成功した SVG を表示し続け**、小さなエラーノートを添える
  （図がチカチカ消えない）。`pre:has(.mermaid-block)` で pre の背景を無効化。
- **画像（DriveImage）**: 相対パス（スキーム無し・`/` 始まりでない src）のみ独自解決。
  `images/<name>` → 親フォルダの `images` フォルダを検索 → 名前でファイル検索 →
  `alt=media` を blob 取得 → `URL.createObjectURL`。セッション内キャッシュ。
  解決不能時はチップ「🖼 name（このアプリでは表示できません）」。
  外部 URL / data: はそのまま `<img>`。**画像サイズ指定は意図的に非対応**
  （CommonMark に記法が無く、raw HTML は XSS 面から既定無効のまま）。

### スクロール同期（split モード時のみ有効）

`useScrollSync(editorView, previewPane, enabled)`:
- **発信源の決定**: pointerenter / wheel / touchstart を最後に受けたペインだけが同期を駆動
  （プログラムスクロールの逆流＝フィードバックループを構造的に防止）。
- エディタ→プレビュー: `lineBlockAtHeight(scrollTop)` で先頭可視行を小数精度
  （行内オフセット比）で取得 → プレビュー内 `[data-line]` 要素を行番号順に収集し、
  対象行を挟む 2 アンカー間で線形補間して scrollTop を設定。
- プレビュー→エディタ: 逆演算（scrollTop を挟むアンカーから行番号を補間 →
  `lineBlockAt` の座標へ）。
- rAF スロットリング。アンカー収集は都度 `querySelectorAll`（数百ブロック規模で十分軽い）。

### インライン編集（プレビューモードの目玉機能）

- プレビュー単独モードで、トップレベルブロック（`.markdown-body > [data-line]`）に
  ホバーすると点線アウトライン（accent 色・offset 4px）で編集可能を示唆。
- **ダブルクリック**で発火（シングルクリックはテキスト選択・リンクを妨げない）。
  `<a>` 内クリックは無視。
- 範囲決定: クリックブロックの `data-line` を開始行、**次のトップレベルブロックの
  開始行 − 1** を終了行とし、末尾空行をトリム。＝ホバーで囲まれる単位と編集単位が一致。
- ポップオーバー（幅 min(780px, vw−32)、ブロック直下にアンカー、画面内へクランプ）:
  - ヘッダ「ソース編集（n〜m行）」
  - **書式ツールバー**（formatDoc のみ除外）
  - **本物の CodeMirror**（`MarkdownEditor` の再利用）→ ハイライト・テーマ・
    **全ショートカットが編集モードと同一挙動**
  - フッタ: ヒント「Ctrl+Enter / Ctrl+S 適用・Esc 閉じる」+ キャンセル / 適用ボタン
- 適用は**非表示でマウント中のメインエディタへの dispatch** として実行
  → undo 履歴・dirty・保存が完全に一貫。draft を直接書き換えてはならない。
- Esc / 外側クリックで閉じる。モードを離れたら自動クローズ。

## 8. 画像貼り付け（`useDriveImages`）

1. `.md` の `parents[0]` を親フォルダとする（メタ取得時に parents を含める）。
2. `images` フォルダを名前検索（`q: '<parent>' in parents and name='images' and
   mimeType=folder and trashed=false`）。無ければ作成。フォルダ ID はセッションキャッシュ。
3. ファイル名 `img-{YYYYMMDD-HHMMSS}-{連番}.{ext}`（ext は MIME から、jpeg→jpg）。
4. multipart/related アップロード（境界文字列 + metadata JSON + バイナリ）。
5. Markdown には **相対パス** `![](images/<name>)` を挿入 — ローカル同期後に
   Obsidian / GitHub でそのまま表示されることが狙い。

## 9. Lint / Formatter

- **Lint**: `markdownlint/promise` の `lint({ strings, config })` を 600ms デバウンスで実行。
  config = `{ default: true, MD013: false }`（行長ルールは日本語文章でノイズのため無効）。
  ライブラリは初回 lint 時に動的 import。失敗してもアプリを壊さない（握りつぶして空配列）。
- **表示 UX（重要な設計思想）**: エディタ内に波線などは**出さない**。
  ステータスバーに「✓ Lint: 問題なし / ⚠ Lint: N 件」のみ。クリックで下部パネル
  （max-height 30vh）が開き、`{n行} {ルール名} {説明 — 詳細}` のリスト。
  項目クリックで該当行へジャンプ（プレビューモード時は split へ自動切替 + フォーカス）。
- **Formatter**: ツールバー 🪄 ボタン。`prettier/standalone` + markdown プラグインを
  初回クリック時に動的 import し、全文を 1 トランザクションで置換（undo 可能）。
  カーソルは整形後長にクランプ。

## 10. テーマシステム

```
src/themes/
  index.ts        … ThemeTokens 型（21 トークン）/ AppTheme / THEMES 配列 /
                    applyTheme(themeId, mode) — CSS 変数を <html> style に setProperty
  blueTopaz.ts    … デフォルト。Obsidian テーマ Blue-Topaz_Obsidian-css
                    (MIT, (c) 2020 whyt-byte) の .theme-light/.theme-dark から抽出
  defaultTheme.ts … GitHub 風の従来ルック（登録のみ、UI 切替は現在非公開）
```

- **Obsidian テーマ CSS をそのまま読み込まない**（Obsidian の DOM 前提・1MB 超で破綻する）。
  デザイントークン抽出方式により、他テーマ追加は「1 ファイル書いて登録」で済む。
- トークン: bg / bgSecondary / fg / muted / border / accent / accentFg / error{Bg,Border,Fg} /
  h1..h6 / codeBg / codeFg / inlineCodeFg / blockquoteBg / selection。
- **Blue Topaz 主要値**:
  - accent（両モード共通）: `hsl(209, 95%, 62%)`
  - light: bg #ffffff, fg #0e0e0e, muted #7f7f7f, border #dddddd,
    h1 `hsl(216,88%,26%)` → h6 `hsl(209,65%,72%)`（青の濃→淡）,
    codeBg #e6e6e671, inlineCodeFg #e95d00, blockquoteBg #d5d5d52c, selection #a9d1c859
  - dark: bg #202020, bgSecondary #151515, fg #c6c6c6, muted #8a8a8a, border #343434,
    h1 `hsl(78,62%,47%)` h2 `hsl(118,42%,49%)` h3 `hsl(180,53%,48%)` h4 `hsl(216,69%,68%)`
    h5 `hsl(258,79%,77%)` h6 `hsl(290,85%,81%)`（レインボー）,
    codeBg #1111118c, inlineCodeFg #d58000, blockquoteBg #9191911c, selection #3b767160
- ライト/ダークは手動トグル（🌙/☀️）+ OS 設定を初期値に。`<html data-theme>` +
  localStorage `theme` / `app-theme`。CSS 側は `[data-theme="dark"]` と
  `@media (prefers-color-scheme: dark)`（pre-hydration フォールバック）の両方を定義。
- 見出し色・引用（accent 左バー 3px + 淡背景 + 右角丸）・コード配色はトークン参照。
- CodeMirror のダークは one-dark 固定（Compartment 切替）。ライトは CM 既定。

## 11. ヘルプモーダル

- ヘッダ「?」アイコンで開く。幅 min(1000px, vw−3rem)、**2 カラム**
  （左: 使い方ガイド / 右: ショートカット表。760px 以下で縦積み）。
- **ふわっと表示**: オーバーレイはフェード + `backdrop-filter: blur(3px)`、
  本体は `translateY(18px) scale(0.96)` から 0.32s `cubic-bezier(0.16,1,0.3,1)` で浮上
  （編集とは別モードであることを直感させる意図）。
- ショートカット表は **Config から動的生成**（将来のカスタマイズが自動反映される）。
- Esc / 外側クリックで閉じる。
- 使い方ガイドの必須項目: モード切替 / 保存とリビジョン / 画像貼り付けの仕組み /
  テーブル挿入 / Mermaid / **インライン編集はダブルクリック**（発見性が低いため明記）/
  Lint パネル / 整形。

## 12. エラーハンドリング一覧

| 状況 | 挙動 |
|---|---|
| state パラメータ無し | 案内 + ログイン（インストール）導線。ログイン済みなら「✅ 登録済み、Drive から開いて」 |
| CLIENT_ID 未設定 | 設定エラー画面 |
| 未認証 | ログイン画面 |
| 読込 401/403/404/network | ErrorFallback（再試行 / 再ログイン。403 は drive.file の仕様説明） |
| 保存失敗 | ヘッダに「保存に失敗しました（HTTP nnn）」+ 401 なら再ログインリンク |
| 画像アップ失敗 | プレースホルダ除去 + alert |
| mermaid 構文エラー | 直前の成功図を維持 + エラーノート |
| lint 実行失敗 | 無視（空配列） |

## 13. パフォーマンス設計

- 遅延ロード（動的 import・独立チャンク）: markdownlint / prettier / mermaid /
  コードブロック言語（language-data 経由）。メインバンドルには含めない。
- プレビュー更新は useDeferredValue。lint は 600ms デバウンス。
- スクロール同期は rAF。画像 blob・フォルダ ID はセッションキャッシュ。

## 14. ディレクトリ構成

```
src/
  main.tsx              # QueryClientProvider ルート
  App.tsx               # 状態遷移・モード・保存・Lint パネル・インライン編集の配線
  App.css / index.css   # トークン駆動スタイル（§10）
  lib/
    driveState.ts       # ?state= パース
    driveApi.ts         # Drive REST ラッパ（meta/content/PATCH/検索/フォルダ作成/
                        #   multipart アップロード/blob 取得、DriveApiError）
    editorCommands.ts   # コマンドレジストリ（§6）
    shortcutConfig.ts   # ショートカット Config（§6）
    markdownCommands.ts # 編集コマンド実装（§6）
    formatDocument.ts   # Prettier 整形
    rehypeSourceLine.ts # data-line 付与
  hooks/
    useGoogleAuth.ts    # GIS トークンクライアント
    useDriveFile.ts     # useQuery 取得
    useSaveDriveFile.ts # useMutation 保存 + キャッシュ同期
    useDriveImages.ts   # 画像アップロード/解決
    useScrollSync.ts    # 双方向同期
    useMarkdownLint.ts  # デバウンス lint
    useTheme.ts         # モード + テーマ適用
  components/
    MarkdownEditor.tsx  # CM6 ラッパ（mount-once）
    MarkdownPreview.tsx # react-markdown + DriveImage + CodeOrMermaid
    MermaidBlock.tsx
    FormatToolbar.tsx   # レイアウト定義 + TablePicker
    InlineEditPopover.tsx
    HelpModal.tsx
    ErrorFallback.tsx
    LoginButton.tsx
    icons.tsx           # インライン SVG アイコン集
  themes/               # §10
```

## 15. ライセンス方針

全依存は MIT / BSD-3-Clause（許諾型のみ）。Blue Topaz からの色移植は MIT 帰属を
`themes/blueTopaz.ts` ヘッダと README に明記。コピーレフト系依存は追加しないこと。

## 16. ログ設計（要件・未実装分を含む）

### 方針
- **通常ログは Console のみ**（`console.debug/info/warn/error`）。ユーザーの作業を妨げない。
- **致命的エラーはユーザーにも必ず通知**する。Console を開かないユーザーが
  「何かが失敗した」ことに気づけない状態を作らない。

### 分類

| レベル | 対象例 | Console | ユーザー通知 |
|---|---|---|---|
| debug/info | 認証成功、ファイル読込完了、保存成功、遅延モジュールのロード | ✓ | 不要（保存は既存のステータス表示で十分） |
| warn | lint 実行失敗、mermaid 構文エラー、画像解決不能（drive.file 不可視） | ✓ | 既存のインライン表示（エラーノート/チップ）で十分 |
| **fatal** | ファイル読込失敗（401/403/404/network）、**保存失敗**、画像アップロード失敗、未捕捉例外・unhandledrejection | ✓ `console.error` | **必須**。画面内の通知（バナー/トースト）で明示 |

### 実装ガイドライン（再作成時）
- `lib/logger.ts` のような薄いラッパを設け、`logger.error(scope, err)` が
  console 出力と通知系（トースト等）の両方に配線されるようにする。散在する
  `console.error` / `window.alert` 直呼びは避ける（現実装の alert は暫定）。
- トークン・ファイル内容・個人情報は**ログに出さない**（エラーの status / メッセージのみ）。
- `window.onerror` / `unhandledrejection` を捕捉し、想定外の例外も
  「予期しないエラーが発生しました」として fatal 通知に流す。

## 17. 環境情報の取り扱い（再作成時）

以下の値は**本設計書・リポジトリに記載しない**（機密または環境固有のため）。
再作成セッションの開始時に、コンソール/プロンプトで開発担当（LLM）へ直接提示すること。

- 本番 URL / Pages プロジェクト名 / Cloudflare アカウント ID
- Cloudflare 認証（wrangler のログイン済みトークンを使う旨の指示で足りる。値は不要）
- GCP プロジェクト ID / OAuth クライアント ID（`VITE_GOOGLE_CLIENT_ID`）
- OAuth テストユーザーのメールアドレス
- GitHub リポジトリ URL

注意: Drive API の **Drive UI Integration は GCP プロジェクトにつき 1 設定**。
別名アプリ（例: `Markdown for Drive`）を「アプリで開く」に並べたい場合は、
新規 GCP プロジェクト一式（Drive API 有効化 → OAuth クライアント → Drive UI
Integration → テストユーザー登録）を用意すること。

## 18. 既知の制約・将来課題

- drive.file による不可視問題（§3）。フルスコープ化が escape hatch。
- 画像サイズ指定（rehype-raw + sanitize で `<img width>` 対応する余地）。
- ショートカットのカスタマイズ UI（Config 基盤は実装済み）。
- テーマ切替 UI（レジストリは実装済み・意図的に非公開）。
- rclone 側 client_id の 2026 年廃止問題はアプリ本体とは独立。
