/** Browser-readable marker that a recovery (or reset-bound) PKCE exchange succeeded. */
export const PASSWORD_RECOVERY_COOKIE = "ps_password_recovery";

/** Session-scoped mark from a client-observed PASSWORD_RECOVERY auth event. */
export const PASSWORD_RECOVERY_STORAGE_KEY = "ps.passwordRecoveryAuthorized";

export function isPasswordResetPath(next: string): boolean {
  try {
    return new URL(next, "https://example.invalid").pathname === "/auth/reset-password";
  } catch {
    return false;
  }
}

export function readPasswordRecoveryAuthorized(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "1") return true;
  } catch {
    // sessionStorage can throw in privacy modes; fall through to the cookie.
  }
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${PASSWORD_RECOVERY_COOKIE}=`));
}

export function markPasswordRecoveryAuthorized(): void {
  try {
    sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "1");
  } catch {
    // Ignore: the recovery cookie from /auth/callback remains the durable gate.
  }
}

export function clearPasswordRecoveryAuthorized(): void {
  try {
    sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore storage failures while clearing.
  }
  if (typeof document === "undefined") return;
  document.cookie = `${PASSWORD_RECOVERY_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
