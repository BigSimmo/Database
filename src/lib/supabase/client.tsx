"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isAuthRetryableFetchError, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearPersistedAnswerThread } from "@/lib/answer-thread-storage";
import { clearRecentQueries } from "@/components/clinical-dashboard/recent-query-storage";
import { authSessionFingerprint, createAuthRequestLifecycle } from "@/lib/auth-request-lifecycle";
import { checkSupabaseProjectConfig, formatSupabaseProjectCheck } from "@/lib/supabase/project";

type AuthStatus = "unconfigured" | "loading" | "signed_out" | "authenticated" | "expired" | "error";
export type OAuthProvider = "google" | "azure";

type AuthContextValue = {
  client: SupabaseClient | null;
  session: Session | null;
  status: AuthStatus;
  error: string | null;
  /** Non-error confirmation (e.g. "check your email"); rendered as a success status, not an alert. */
  notice: string | null;
  isConfigured: boolean;
  authorizationHeader: Record<string, string>;
  authEpoch: number;
  registerAuthRequest: (controller: AbortController) => { epoch: number; release: () => void };
  isAuthEpochCurrent: (epoch: number) => boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  markSessionExpired: () => void;
};

export const AUTH_EMAIL_STORAGE_KEY = "clinical.dashboard.lastAuthEmail";
const AUTH_CALLBACK_PATH = "/auth/callback";

const AuthContext = createContext<AuthContextValue | null>(null);
let browserSupabaseClient: SupabaseClient | null | undefined;
let browserSupabaseClientConfig: string | null = null;

export function isUsableBrowserSupabaseKey(key: string | null | undefined): key is string {
  const value = key?.trim();
  if (!value) return false;
  return !/<[^>]+>|^your-|replace-with|placeholder/i.test(value);
}

function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !isUsableBrowserSupabaseKey(key)) {
    browserSupabaseClient = null;
    browserSupabaseClientConfig = null;
    return null;
  }

  const projectCheck = checkSupabaseProjectConfig({ NEXT_PUBLIC_SUPABASE_URL: url });
  if (projectCheck.status === "mismatch") {
    console.error(formatSupabaseProjectCheck(projectCheck));
    browserSupabaseClient = null;
    browserSupabaseClientConfig = null;
    return null;
  }

  const publishableKey: string = key;
  const configKey = `${url}:${publishableKey}`;
  if (browserSupabaseClientConfig === configKey) {
    return browserSupabaseClient ?? null;
  }

  browserSupabaseClientConfig = configKey;
  // @supabase/ssr browser client persists the session in cookies shared with the
  // server (proxy + route handlers), so logins survive refreshes and the API can
  // read the session. PKCE code flow returns via /auth/callback.
  browserSupabaseClient = createBrowserClient(url, publishableKey);
  return browserSupabaseClient;
}

export function authorizationHeadersForAccessToken(accessToken: string | null | undefined): Record<string, string> {
  if (!accessToken) return {};
  return { authorization: `Bearer ${accessToken}` };
}

/**
 * Decide the trusted initial auth state from a server-verifying `getUser()` and a
 * storage-only `getSession()`. `getSession()` reads the token from local storage
 * WITHOUT validating it; `getUser()` re-validates it against the Supabase auth server.
 * The stored session (and its access token) is trusted only when the auth server
 * confirmed a user whose id matches that session, so a stale, tampered, or expired
 * local token resolves to signed-out instead of presenting as authenticated. Data
 * access is already safe — every API route re-validates the bearer token server-side
 * ([auth.ts](src/lib/supabase/auth.ts)) — so this is defense-in-depth for the client UI.
 *
 * `verificationUnavailable` covers the case where `getUser()` could not reach the
 * auth server at all (offline load, flaky network). That is not evidence the token
 * is bad, so the stored session keeps the signed-in UI instead of silently
 * presenting as signed out; the server still rejects the token on every data call
 * if it truly is invalid.
 */
export type InitialAuthResolution =
  { status: "authenticated"; session: Session } | { status: "signed_out"; session: null };

export function resolveInitialAuthState(args: {
  verifiedUserId: string | null;
  session: Session | null;
  verificationUnavailable?: boolean;
}): InitialAuthResolution {
  const { verifiedUserId, session, verificationUnavailable } = args;
  if (verifiedUserId && session && session.user.id === verifiedUserId) {
    return { status: "authenticated", session };
  }
  if (verificationUnavailable && session) {
    return { status: "authenticated", session };
  }
  return { status: "signed_out", session: null };
}

/** Only explicit token/session rejection is evidence that local user data should be cleared. */
export function isDefinitiveAuthValidationError(error: unknown) {
  const candidate = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  const status = typeof candidate?.status === "number" ? candidate.status : null;
  if (status === 400 || status === 401 || status === 403) return true;
  const code = typeof candidate?.code === "string" ? candidate.code.toLowerCase() : "";
  if (/^(?:bad_jwt|session_not_found|refresh_token_not_found|refresh_token_already_used)$/.test(code)) return true;
  const message = typeof candidate?.message === "string" ? candidate.message.toLowerCase() : "";
  return /(?:invalid|expired|missing) (?:jwt|token)|session (?:not found|expired)|refresh token (?:not found|invalid)/.test(
    message,
  );
}

function authCallbackRedirect() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
}

/** Read and clear a `?auth_error=` param left by the /auth/callback route. */
function consumeAuthErrorParam(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");
  if (!authError) return null;
  params.delete("auth_error");
  const query = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  return authError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(client ? "loading" : "unconfigured");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const authRequestsRef = useRef(createAuthRequestLifecycle());
  const authFingerprintRef = useRef<string | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);

  const invalidateAuthRequests = useCallback(() => {
    setAuthEpoch(authRequestsRef.current.invalidate());
  }, []);
  const registerAuthRequest = useCallback((controller: AbortController) => {
    return authRequestsRef.current.register(controller);
  }, []);
  const isAuthEpochCurrent = useCallback((epoch: number) => authRequestsRef.current.isCurrent(epoch), []);

  useEffect(() => {
    if (!client) return () => undefined;
    let active = true;

    // Clear the URL param synchronously (no React state here — that would trip
    // react-hooks/set-state-in-effect); surface it after the async load below.
    const callbackError = consumeAuthErrorParam();

    const initializeSession = async () => {
      try {
        // Validate the stored token against the auth server before trusting it.
        // getSession() only reads the token from storage; getUser() re-validates it
        // with Supabase auth, so a stale/tampered/expired local session cannot present
        // as authenticated (or send a bad bearer token) on load.
        const [userResult, sessionResult] = await Promise.all([client.auth.getUser(), client.auth.getSession()]);
        if (!active) return;
        if (userResult.error && !isDefinitiveAuthValidationError(userResult.error)) {
          setSession(null);
          setStatus("error");
          setNotice(null);
          setError("Session could not be verified. Check your connection and retry.");
          return;
        }
        const verifiedUserId = userResult.error ? null : (userResult.data.user?.id ?? null);
        // A retryable fetch error means the auth server was unreachable, not that
        // the token was rejected — don't drop a valid stored session for that.
        const verificationUnavailable = isAuthRetryableFetchError(userResult.error);
        const resolved = resolveInitialAuthState({
          verifiedUserId,
          session: sessionResult.data.session,
          verificationUnavailable,
        });
        setSession(resolved.session);
        setStatus(resolved.status);
        if (resolved.status === "authenticated") {
          setError(null);
          setNotice(null);
        } else {
          clearPersistedAnswerThread();
          clearRecentQueries();
          if (callbackError) {
            setError(decodeURIComponent(callbackError));
            setNotice(null);
          }
        }
      } catch {
        if (!active) return;
        setStatus("error");
        setError("Session could not be loaded.");
      }
    };

    void initializeSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      // initializeSession() owns the initial state and validates it via getUser();
      // the INITIAL_SESSION replay re-reads the *unverified* stored session, so skip it
      // here to avoid a stale token presenting as authenticated after validation.
      // Later events (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, …) come from real auth
      // transitions and are trusted. Supabase warns against awaiting other auth calls
      // inside this callback, so validation stays in initializeSession, not here.
      if (event === "INITIAL_SESSION") return;
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "signed_out");
      if (nextSession) {
        setError(null);
        setNotice(null);
      } else {
        clearPersistedAnswerThread();
        clearRecentQueries();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const requireClient = useCallback(() => {
    if (client) return client;
    setStatus("unconfigured");
    setNotice(null);
    setError("Supabase browser authentication is not configured.");
    return null;
  }, [client]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      const active = requireClient();
      if (!active) return;
      setStatus("loading");
      setError(null);
      setNotice(null);
      const { error: signInError } = await active.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authCallbackRedirect() },
      });
      if (signInError) {
        setStatus("error");
        setError("Sign-in email could not be sent.");
        return;
      }
      setStatus("signed_out");
      setNotice("Check your email for the sign-in link.");
    },
    [requireClient],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const active = requireClient();
      if (!active) return;
      setStatus("loading");
      setError(null);
      setNotice(null);
      const { error: signInError } = await active.auth.signInWithPassword({ email, password });
      if (signInError) {
        setStatus("error");
        setError(signInError.message);
      }
      // onAuthStateChange flips status to "authenticated" on success.
    },
    [requireClient],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const active = requireClient();
      if (!active) return;
      setStatus("loading");
      setError(null);
      setNotice(null);
      const { data, error: signUpError } = await active.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: authCallbackRedirect() },
      });
      if (signUpError) {
        setStatus("error");
        setError(signUpError.message);
        return;
      }
      // With "Confirm email" ON, no session is returned until confirmation.
      if (!data.session) {
        setStatus("signed_out");
        setNotice("Check your email to confirm your account, then sign in.");
      }
    },
    [requireClient],
  );

  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider) => {
      const active = requireClient();
      if (!active) return;
      setStatus("loading");
      setError(null);
      setNotice(null);
      const { error: oauthError } = await active.auth.signInWithOAuth({
        provider,
        options: { redirectTo: authCallbackRedirect() },
      });
      if (oauthError) {
        setStatus("error");
        setError(oauthError.message);
      }
      // On success the browser is redirected to the provider.
    },
    [requireClient],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    invalidateAuthRequests();
    await client.auth.signOut();
    clearPersistedAnswerThread();
    clearRecentQueries();
    setSession(null);
    setStatus("signed_out");
    setError(null);
    setNotice(null);
  }, [client, invalidateAuthRequests]);

  const markSessionExpired = useCallback(() => {
    invalidateAuthRequests();
    clearPersistedAnswerThread();
    clearRecentQueries();
    setSession(null);
    setStatus("expired");
    setNotice(null);
    setError("Your session expired. Sign in again to use private documents.");
  }, [invalidateAuthRequests]);

  const accessToken = session?.access_token ?? null;
  const authorizationHeader = useMemo(() => authorizationHeadersForAccessToken(accessToken), [accessToken]);

  useEffect(() => {
    // Same-user access-token rotation is not an auth-owner change. Aborting
    // uploads or answer streams during routine refresh leaves valid work stale.
    const fingerprint = authSessionFingerprint(status, session?.user.id);
    if (authFingerprintRef.current === null) {
      authFingerprintRef.current = fingerprint;
      return;
    }
    if (authFingerprintRef.current === fingerprint) return;
    authFingerprintRef.current = fingerprint;
    invalidateAuthRequests();
  }, [invalidateAuthRequests, session?.user.id, status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      client,
      session,
      status,
      error,
      notice,
      isConfigured: Boolean(client),
      authorizationHeader,
      authEpoch,
      registerAuthRequest,
      isAuthEpochCurrent,
      signInWithEmail,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signOut,
      markSessionExpired,
    }),
    [
      client,
      session,
      status,
      error,
      notice,
      authorizationHeader,
      authEpoch,
      registerAuthRequest,
      isAuthEpochCurrent,
      signInWithEmail,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signOut,
      markSessionExpired,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthProvider.");
  }
  return context;
}
