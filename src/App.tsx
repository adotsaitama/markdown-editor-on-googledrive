import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { LoginButton } from "./components/LoginButton";
import { ErrorFallback } from "./components/ErrorFallback";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { useGoogleAuth } from "./hooks/useGoogleAuth";
import { useDriveFile } from "./hooks/useDriveFile";
import { useSaveDriveFile } from "./hooks/useSaveDriveFile";
import { useScrollSync } from "./hooks/useScrollSync";
import { DriveApiError } from "./lib/driveApi";
import { extractOpenFileId } from "./lib/driveState";
import "./App.css";

type ViewMode = "edit" | "split" | "preview";

export default function App() {
  // The launch file id is fixed for this page load; derive it once.
  const fileId = useMemo(() => extractOpenFileId(window.location.search), []);

  const auth = useGoogleAuth();
  const file = useDriveFile(fileId, auth.accessToken);
  const save = useSaveDriveFile(fileId, auth.accessToken);

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

  return (
    <div className={mode === "split" ? "app app-split" : "app"}>
      <header className="app-header">
        <h1>Drive Markdown Editor</h1>
        <span className="phase-badge">Phase 2 · 編集</span>
        {file.data && (
          <span className="file-name">
            {file.data.meta.name}
            {isDirty && <span className="dirty-dot" title="未保存の変更があります" />}
          </span>
        )}
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

    // 6. Success — editor / preview with save toolbar.
    if (file.data && currentContent !== null) {
      return (
        <>
          <div className="toolbar">
            <div className="mode-tabs" role="tablist">
              {(
                [
                  ["edit", "編集"],
                  ["split", "分割"],
                  ["preview", "プレビュー"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={mode === value}
                  className={mode === value ? "tab active" : "tab"}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="save-area">
              {renderSaveStatus()}
              <button
                className="save-button"
                onClick={handleSave}
                disabled={!isDirty || save.isPending}
                title="Ctrl+S / ⌘S"
              >
                {save.isPending ? "保存中…" : "保存"}
              </button>
            </div>
          </div>

          {mode === "edit" && (
            <MarkdownEditor
              // Remount if the saved file identity changes (not on each keystroke).
              key={file.data.meta.id}
              initialDoc={currentContent}
              onChange={setDraft}
              onSave={handleSave}
            />
          )}
          {mode === "split" && (
            <div className="split-view">
              <div className="pane pane-editor">
                <MarkdownEditor
                  key={file.data.meta.id}
                  initialDoc={currentContent}
                  onChange={setDraft}
                  onSave={handleSave}
                  onViewReady={setEditorView}
                />
              </div>
              <div className="pane pane-preview" ref={setPreviewPane}>
                <MarkdownPreview content={deferredContent ?? ""} />
              </div>
            </div>
          )}
          {mode === "preview" && <MarkdownPreview content={currentContent} />}
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
