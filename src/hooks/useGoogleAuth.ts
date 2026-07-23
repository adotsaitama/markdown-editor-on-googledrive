import { useCallback, useEffect, useRef, useState } from "react";

// Requested scopes:
// - drive.file: only files the user opens/creates with this app.
// - drive.install: lets the app appear in Drive's "Open with" menu
//   (granting it acts as the per-user install for the Drive UI integration).
// Reference: https://developers.google.com/drive/api/guides/api-specific-auth
const SCOPE =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export interface GoogleAuth {
  /** Access token for Drive API calls, or null when not yet authenticated. */
  accessToken: string | null;
  /** True once the GIS script has loaded and a token client is ready. */
  isReady: boolean;
  /** True while a token request is in flight. */
  isAuthenticating: boolean;
  /** Human-readable error (missing config, denied consent, etc.). */
  error: string | null;
  /** True when VITE_GOOGLE_CLIENT_ID is configured. */
  isConfigured: boolean;
  /** Trigger the interactive OAuth consent / token flow. */
  signIn: () => void;
}

/**
 * Wraps the Google Identity Services OAuth 2.0 token client.
 * Waits for the async-loaded GIS script, then lazily initializes a token client.
 */
export function useGoogleAuth(): GoogleAuth {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
  const isConfigured = Boolean(CLIENT_ID);

  // Poll for the async-loaded GIS script and build the token client once.
  useEffect(() => {
    if (!isConfigured) {
      setError(
        "VITE_GOOGLE_CLIENT_ID is not set. Copy .env.example to .env.local and add your OAuth client ID.",
      );
      return;
    }

    let cancelled = false;

    const init = () => {
      if (cancelled || clientRef.current) return true;
      if (!window.google?.accounts?.oauth2) return false;

      clientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID as string,
        scope: SCOPE,
        callback: (response) => {
          setIsAuthenticating(false);
          if (response.error) {
            setError(response.error_description || response.error);
            return;
          }
          setError(null);
          setAccessToken(response.access_token);
        },
        error_callback: (err) => {
          setIsAuthenticating(false);
          setError(err.message || err.type || "Authentication failed.");
        },
      });
      setIsReady(true);
      return true;
    };

    if (init()) return;

    // GIS loads via an async <script>; poll briefly until it's available.
    const timer = window.setInterval(() => {
      if (init()) window.clearInterval(timer);
    }, 100);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isConfigured]);

  const signIn = useCallback(() => {
    if (!clientRef.current) {
      setError("Google authentication is not ready yet. Please try again in a moment.");
      return;
    }
    setError(null);
    setIsAuthenticating(true);
    clientRef.current.requestAccessToken();
  }, []);

  return {
    accessToken,
    isReady,
    isAuthenticating,
    error,
    isConfigured,
    signIn,
  };
}
