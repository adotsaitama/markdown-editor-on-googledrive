import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { LoginButton } from "./components/LoginButton";
import { ErrorFallback } from "./components/ErrorFallback";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { FormatToolbar } from "./components/FormatToolbar";
import { IconEye, IconMoon, IconPencil, IconSplit, IconSun } from "./components/icons";
import { useGoogleAuth } from "./hooks/useGoogleAuth";
import { useDriveFile } from "./hooks/useDriveFile";
import { useSaveDriveFile } from "./hooks/useSaveDriveFile";
import { useScrollSync } from "./hooks/useScrollSync";
import { useTheme } from "./hooks/useTheme";
import { useDriveImages } from "./hooks/useDriveImages";
import { useMarkdownLint } from "./hooks/useMarkdownLint";
import { DriveApiError } from "./lib/driveApi";
import { extractOpenFileId } from "./lib/driveState";
import "./App.css";

type ViewMode = "edit" | "split" | "preview";

const MODES: Array<[ViewMode, string, () => JSX.Element]> = [
  ["edit", "編集", IconPencil],
  ["split", "分割", IconSplit],
  ["preview", "表示", IconEye],
];

export default function App() {
  // The launch file id is fixed for this page load; derive it once.
  const fileId = useMemo(() => extractOpenFileId(window.location.search), []);

  const auth = useGoogleAuth();
  const file = useDriveFile(fileId, auth.accessToken);
  const save = useSaveDriveFile(fileId, auth.accessToken);
  const { theme, toggle: toggleTheme } = useTheme();

  // Default to split view on screens wide enough to fit both panes.
  const [mode, setMode] = useState<ViewMode>(() =>
    window.innerWidth >= 960 ? "split" : "edit",
  );
  // Local edits; null until the user types. Saved content is the baseline.
  const [draft, setDraft] = useState<string | null>(null);

  // Scroll-sync endpoints (state, not refs, so the hook re-runs when they mount).
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [previewPane, setPreviewPane] = useState<HTMLDivElement | null>(null);
  useScrollSync(editorView, previewPane, mode === "split");

  const savedContent = file.data?.content ?? null;
  const currentContent = draft ?? savedContent;
  // Low-priority preview updates keep typing responsive on large documents.
  const deferredContent = useDeferredValue(currentContent);
  const isDirty = draft !== null && savedContent !== null && draft !== savedContent;

  // Pasted-image upload + relative `images/...` resolution for the preview.
  const { uploadImage, resolveImage } = useDriveImages(file.data?.meta, auth.accessToken);

  // Background lint (debounced, lazy-loaded); details live in the bottom panel.
  const lintIssues = useMarkdownLint(currentContent);
  const [lintOpen, setLintOpen] = useState(false);

  const jumpToLine = useCallback(
    (line: number) => {
      if (!editorView) return;
      setMode((m) => (m === "preview" ? "split" : m));
      const doc = editorView.state.doc;
      const l = doc.line(Math.min(Math.max(1, line), doc.lines));
      editorView.dispatch({ selection: { anchor: l.from }, scrollIntoView: true });
      editorView.focus();
    },
    [editorView],
  );

  const handleSave = useCallback(() => {
    if (draft === null || draft === savedContent || save.isPending) return;
    save.mutate(draft);
  }, [draft, savedContent, save]);

  // Ctrl/Cmd+S anywhere on the page (the editor also binds Mod-s itself).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Mirror the document name into the browser tab.
  const docName = file.data?.meta.name;
  useEffect(() => {
    document.title = docName ? `${docName} - Drive Markdown Editor` : "Drive Markdown Editor";
  }, [docName]);

  const hasFile = Boolean(file.data && currentContent !== null);

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1 className="doc-title">
            {docName ?? "Drive Markdown Editor"}
            {isDirty && <span className="dirty-dot" title="未保存の変更があります" />}
          </h1>
          {file.data?.meta.modifiedTime && (
            <span className="doc-meta">
              最終保存{" "}
              {new Date(file.data.meta.modifiedTime).toLocaleString("ja-JP", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>

        <div className="header-actions">
          {hasFile && (
            <>
              {renderSaveStatus()}
              <button
                className="save-button"
                onClick={handleSave}
                disabled={!isDirty || save.isPending}
                title="Ctrl+S / ⌘S"
              >
                {save.isPending ? "保存中…" : "保存"}
              </button>
              <div className="mode-tabs" role="tablist" aria-label="表示モード">
                {MODES.map(([value, label, Icon]) => (
                  <button
                    key={value}
                    role="tab"
                    aria-selected={mode === value}
                    className={mode === value ? "tab active" : "tab"}
                    title={label}
                    aria-label={label}
                    onClick={() => setMode(value)}
                  >
                    <Icon />
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            className="icon-button theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
            aria-label="テーマ切り替え"
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>

      <main className="app-main">{renderBody()}</main>
    </div>
  );

  function renderBody() {
    // 1. No file id in the URL — app was not launched from Drive's "Open with".
    //    Still offer sign-in here: consenting to drive.install is what registers
    //    the app in Drive's "Open with" menu in the first place.
    if (!fileId) {
      return (
        <div className="notice">
          <h2>ファイルが指定されていません</h2>
          <p>
            このアプリは Google Drive の「アプリで開く」から <code>.md</code> ファイルを開くと起動します。
          </p>
          {auth.isConfigured && !auth.accessToken && (
            <>
              <p>
                初めて使う場合は、まずここでログインして Google Drive にアプリを登録してください
                （「アプリで開く」メニューに表示されるようになります）。
              </p>
              <LoginButton
                onClick={auth.signIn}
                disabled={!auth.isReady}
                isAuthenticating={auth.isAuthenticating}
              />
              {auth.error && <p className="inline-error">{auth.error}</p>}
            </>
          )}
          {auth.accessToken && (
            <p>
              ✅ ログインしました。アプリが Google Drive に登録されました。
              Drive で <code>.md</code> ファイルを右クリック →「アプリで開く」から起動してください。
            </p>
          )}
        </div>
      );
    }

    // 2. Missing OAuth configuration.
    if (!auth.isConfigured) {
      return (
        <div className="notice notice-error">
          <h2>設定が必要です</h2>
          <p>{auth.error}</p>
        </div>
      );
    }

    // 3. Not authenticated yet — prompt sign-in.
    if (!auth.accessToken) {
      return (
        <div className="notice">
          <h2>Google Drive へのアクセスを許可してください</h2>
          <p>ファイルを読み込むには、Google アカウントでのログインが必要です。</p>
          <LoginButton
            onClick={auth.signIn}
            disabled={!auth.isReady}
            isAuthenticating={auth.isAuthenticating}
          />
          {auth.error && <p className="inline-error">{auth.error}</p>}
        </div>
      );
    }

    // 4. Loading file.
    if (file.isPending) {
      return (
        <div className="notice">
          <p className="loading">読み込み中…</p>
        </div>
      );
    }

    // 5. Error while fetching.
    if (file.isError) {
      return (
        <ErrorFallback
          error={file.error}
          onRetry={() => file.refetch()}
          onReauth={auth.signIn}
        />
      );
    }

    // 6. Success — toolbar + always-mounted editor/preview panes.
    //    Both panes stay in the DOM; mode switches animate the grid columns,
    //    which also preserves editor state (cursor, undo history) across modes.
    if (file.data && currentContent !== null) {
      return (
        <>
          <div className="toolbar">
            <FormatToolbar view={editorView} disabled={mode === "preview"} />
          </div>

          <div className={`workspace mode-${mode}`}>
            <div className="pane pane-editor" aria-hidden={mode === "preview"}>
              <MarkdownEditor
                // Remount only if the file identity changes (not on each keystroke).
                key={file.data.meta.id}
                initialDoc={currentContent}
                dark={theme === "dark"}
                onChange={setDraft}
                onSave={handleSave}
                onViewReady={setEditorView}
                onPasteImage={uploadImage}
              />
            </div>
            <div
              className="pane pane-preview"
              ref={setPreviewPane}
              aria-hidden={mode === "edit"}
            >
              <MarkdownPreview content={deferredContent ?? ""} resolveImage={resolveImage} />
            </div>
          </div>

          {lintOpen && (
            <div className="lint-panel">
              <div className="lint-panel-header">
                <span>Lint 結果（markdownlint）</span>
                <button
                  className="icon-button"
                  aria-label="閉じる"
                  onClick={() => setLintOpen(false)}
                >
                  ×
                </button>
              </div>
              {lintIssues.length === 0 ? (
                <p className="lint-empty">問題は見つかりませんでした 🎉</p>
              ) : (
                <ul className="lint-list">
                  {lintIssues.map((issue, i) => (
                    <li key={i}>
                      <button className="lint-item" onClick={() => jumpToLine(issue.line)}>
                        <span className="lint-line">{issue.line}行</span>
                        <span className="lint-rule">{issue.rule}</span>
                        <span>
                          {issue.description}
                          {issue.detail ? ` — ${issue.detail}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <footer className="status-bar">
            <button
              className={lintIssues.length > 0 ? "lint-summary warn" : "lint-summary"}
              onClick={() => setLintOpen((o) => !o)}
              aria-expanded={lintOpen}
              title="クリックで詳細パネルを開閉"
            >
              {lintIssues.length > 0 ? `⚠ Lint: ${lintIssues.length} 件` : "✓ Lint: 問題なし"}
            </button>
            <span className="char-count">{currentContent.length.toLocaleString()} 文字</span>
          </footer>
        </>
      );
    }

    return null;
  }

  function renderSaveStatus() {
    if (save.isError) {
      const err = save.error;
      const needsReauth = err instanceof DriveApiError && err.status === 401;
      return (
        <span className="save-status save-status-error">
          保存に失敗しました（{err instanceof DriveApiError ? `HTTP ${err.status}` : err.message}）
          {needsReauth && (
            <button className="link-button" onClick={auth.signIn}>
              再ログイン
            </button>
          )}
        </span>
      );
    }
    if (save.isPending) return null; // the button already says 保存中…
    if (save.isSuccess && !isDirty) {
      return <span className="save-status">✓ 保存しました</span>;
    }
    if (isDirty) {
      return <span className="save-status save-status-dirty">未保存の変更</span>;
    }
    return null;
  }
}
