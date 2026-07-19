import { useMemo } from "react";
import { LoginButton } from "./components/LoginButton";
import { ErrorFallback } from "./components/ErrorFallback";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { useGoogleAuth } from "./hooks/useGoogleAuth";
import { useDriveFile } from "./hooks/useDriveFile";
import { extractOpenFileId } from "./lib/driveState";
import "./App.css";

export default function App() {
  // The launch file id is fixed for this page load; derive it once.
  const fileId = useMemo(() => extractOpenFileId(window.location.search), []);

  const auth = useGoogleAuth();
  const file = useDriveFile(fileId, auth.accessToken);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Drive Markdown Editor</h1>
        <span className="phase-badge">Phase 1 · 閲覧のみ</span>
        {file.data && <span className="file-name">{file.data.meta.name}</span>}
      </header>

      <main className="app-main">{renderBody()}</main>
    </div>
  );

  function renderBody() {
    // 1. No file id in the URL — app was not launched from Drive's "Open with".
    if (!fileId) {
      return (
        <div className="notice">
          <h2>ファイルが指定されていません</h2>
          <p>
            このアプリは Google Drive の「アプリで開く」から <code>.md</code> ファイルを開くと起動します。
            URL に有効な <code>state</code> パラメータ（<code>action: "open"</code>）が必要です。
          </p>
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
    if (file.isPending || file.isFetching) {
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

    // 6. Success — render preview.
    if (file.data) {
      return <MarkdownPreview content={file.data.content} />;
    }

    return null;
  }
}
