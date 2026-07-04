"use client";

import { createBrowserClient } from "@supabase/ssr";
import { type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearPersistedAnswerThread } from "@/lib/answer-thread-storage";
import { checkSupabaseProjectConfig, formatSupabaseProjectCheck } from "@/lib/supabase/project";

type AuthStatus = "unconfigured" | "loading" | "signed_out" | "authenticated" | "expired" | "error";
export type OAuthProvider = "google" | "azure";

type AuthContextValue = {
  client: SupabaseClient | null;
  session: Session | null;
  status: AuthStatus;
  error: string | null;
  isConfigured: boolean;
  authorizationHeader: Record<string, string>;
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

  useEffect(() => {
    if (!client) return () => undefined;
    let active = true;

    // Clear the URL param synchronously (no React state here — that would trip
    // react-hooks/set-state-in-effect); surface it after the async load below.
    const callbackError = consumeAuthErrorParam();

    const initializeSession = async () => {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (!active) return;
        if (sessionError) {
          setStatus("error");
          setError("Session could not be loaded.");
          return;
        }
        setSession(data.session);
        setStatus(data.session ? "authenticated" : "signed_out");
        if (data.session) {
          setError(null);
        } else if (callbackError) {
          setError(decodeURIComponent(callbackError));
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
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "signed_out");
      if (nextSession) setError(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const requireClient = useCallback(() => {
    if (client) return client;
    setStatus("unconfigured");
    setError("Supabase browser authentication is not configured.");
    return null;
  }, [client]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      const active = requireClient();
      if (!active) return;
      setStatus("loading");
      setError(null);
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
      setError("Check your email for the sign-in link.");
    },
    [requireClient],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const active = requireClient();
      if (!active) return;
      setStatus("loading");
      setError(null);
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
        setError("Check your email to confirm your account, then sign in.");
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
    await client.auth.signOut();
    clearPersistedAnswerThread();
    setSession(null);
    setStatus("signed_out");
    setError(null);
  }, [client]);

  const markSessionExpired = useCallback(() => {
    clearPersistedAnswerThread();
    setSession(null);
    setStatus("expired");
    setError("Your session expired. Sign in again to use private documents.");
  }, []);

  const accessToken = session?.access_token ?? null;
  const authorizationHeader = useMemo(() => authorizationHeadersForAccessToken(accessToken), [accessToken]);

  const value: AuthContextValue = {
    client,
    session,
    status,
    error,
    isConfigured: Boolean(client),
    authorizationHeader,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    signInWithOAuth,
    signOut,
    markSessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthSession must be used within AuthProvider.");
  }
  return context;
}
