import { DriveApiError } from "../lib/driveApi";

interface ErrorFallbackProps {
  error: Error;
  onRetry?: () => void;
  onReauth?: () => void;
}

interface ErrorInfo {
  title: string;
  detail: string;
  /** Show the "re-authenticate" action (token likely expired/invalid). */
  offerReauth: boolean;
}

function describe(error: Error): ErrorInfo {
  if (error instanceof DriveApiError) {
    switch (error.status) {
      case 401:
        return {
          title: "認証の有効期限が切れました (401)",
          detail: "アクセストークンが無効または期限切れです。再度ログインしてください。",
          offerReauth: true,
        };
      case 403:
        return {
          title: "アクセス権がありません (403)",
          detail:
            "このアプリのスコープ (drive.file) では、Drive の「アプリで開く」から起動したファイルのみアクセスできます。Drive 上でこのアプリを使ってファイルを開き直してください。",
          offerReauth: false,
        };
      case 404:
        return {
          title: "ファイルが見つかりません (404)",
          detail: "指定されたファイルが存在しないか、削除された可能性があります。",
          offerReauth: false,
        };
      default:
        return {
          title: `Drive API エラー (${error.status})`,
          detail: error.message,
          offerReauth: error.status === 401,
        };
    }
  }

  return {
    title: "エラーが発生しました",
    detail: error.message || "ネットワークエラーの可能性があります。接続を確認してください。",
    offerReauth: false,
  };
}

/** Fallback UI mapping Drive/network errors to actionable messages. */
export function ErrorFallback({ error, onRetry, onReauth }: ErrorFallbackProps) {
  const info = describe(error);
  return (
    <div className="error-fallback" role="alert">
      <h2>{info.title}</h2>
      <p>{info.detail}</p>
      <div className="error-actions">
        {info.offerReauth && onReauth && (
          <button type="button" onClick={onReauth}>
            再ログイン
          </button>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry}>
            再試行
          </button>
        )}
      </div>
    </div>
  );
}
