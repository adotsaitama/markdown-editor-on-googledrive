interface LoginButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isAuthenticating?: boolean;
}

/** Prompts the user to grant Drive access via Google OAuth. */
export function LoginButton({ onClick, disabled, isAuthenticating }: LoginButtonProps) {
  return (
    <button
      type="button"
      className="login-button"
      onClick={onClick}
      disabled={disabled || isAuthenticating}
    >
      {isAuthenticating ? "認証中…" : "Google でログイン"}
    </button>
  );
}
