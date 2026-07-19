// Minimal type declarations for the Google Identity Services (GIS) OAuth 2.0
// token model. Loaded at runtime from https://accounts.google.com/gsi/client.
// Reference: https://developers.google.com/identity/oauth2/web/reference/js-reference

export {};

declare global {
  namespace google.accounts.oauth2 {
    interface TokenResponse {
      access_token: string;
      expires_in: number;
      scope: string;
      token_type: string;
      /** Present when the request fails or is dismissed. */
      error?: string;
      error_description?: string;
    }

    interface TokenClientConfig {
      client_id: string;
      scope: string;
      callback: (response: TokenResponse) => void;
      error_callback?: (error: { type: string; message?: string }) => void;
      prompt?: "" | "none" | "consent" | "select_account";
    }

    interface OverridableTokenClientConfig {
      prompt?: "" | "none" | "consent" | "select_account";
    }

    interface TokenClient {
      requestAccessToken: (overrideConfig?: OverridableTokenClientConfig) => void;
    }

    function initTokenClient(config: TokenClientConfig): TokenClient;
    function revoke(accessToken: string, done?: () => void): void;
  }

  interface Window {
    google?: typeof google;
  }
}
