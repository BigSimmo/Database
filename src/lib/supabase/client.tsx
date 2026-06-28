"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { checkSupabaseProjectConfig, formatSupabaseProjectCheck } from "@/lib/supabase/project";

type AuthStatus = "unconfigured" | "loading" | "signed_out" | "authenticated" | "expired" | "error";

type AuthContextValue = {
  client: SupabaseClient | null;
  session: Session | null;
  status: AuthStatus;
  error: string | null;
  isConfigured: boolean;
  authorizationHeader: Record<string, string>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  markSessionExpired: () => void;
};

export const AUTH_EMAIL_STORAGE_KEY = "clinical.dashboard.lastAuthEmail";

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
  browserSupabaseClient = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserSupabaseClient;
}

export function authorizationHeadersForAccessToken(accessToken: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

function clearLocationHash() {
  if (typeof window === "undefined") return;
  if (!window.location.hash) return;
  window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
}

function isExpiredOtpError(errorCode: string | null, message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    errorCode === "otp_expired" ||
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("invalid or has expired")
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(client ? "loading" : "unconfigured");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return () => undefined;

    let active = true;

    const initializeSession = async () => {
      if (typeof window !== "undefined") {
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
        const callbackParams = new URLSearchParams(hash);
        const hasCallbackParams =
          callbackParams.size > 0 &&
          (callbackParams.has("access_token") ||
            callbackParams.has("refresh_token") ||
            callbackParams.has("type") ||
            callbackParams.has("error") ||
            callbackParams.has("error_code") ||
            callbackParams.has("code"));

        if (hasCallbackParams) {
          const hasCallbackError = callbackParams.has("error") || callbackParams.has("error_code");
          if (hasCallbackError) {
            const errorCode = callbackParams.get("error_code");
            const rawDescription = callbackParams.get("error_description");
            const message = rawDescription
              ? decodeURIComponent(rawDescription.replace(/\+/g, " "))
              : "Sign-in verification failed.";
            const expired = isExpiredOtpError(errorCode, message);
            setSession(null);
            setStatus(expired ? "expired" : "error");
            setError(expired ? "This sign-in link is invalid or has expired. Send a new one." : message);
            clearLocationHash();
            return;
          }

          type AuthCallbackResult = {
            data?: {
              session?: Session | null;
            };
            error?: { message?: string } | null;
          };

          const getSessionFromUrl = (
            client.auth as {
              getSessionFromUrl?: () => Promise<AuthCallbackResult>;
            }
          ).getSessionFromUrl;
          const callbackResult = getSessionFromUrl
            ? await getSessionFromUrl()
            : await client.auth.setSession({
                access_token: decodeURIComponent(callbackParams.get("access_token") ?? ""),
                refresh_token: decodeURIComponent(callbackParams.get("refresh_token") ?? ""),
              });
          if (!active) return;
          clearLocationHash();

          if (!callbackResult || callbackResult.error) {
            const message = callbackResult?.error?.message ?? "Sign-in verification failed.";
            const expired = isExpiredOtpError(callbackParams.get("error_code"), message);
            setSession(null);
            setStatus(expired ? "expired" : "error");
            setError(expired ? "This sign-in link is invalid or has expired. Send a new one." : message);
            return;
          }

          const callbackSession = callbackResult?.data?.session;
          if (callbackSession) {
            setSession(callbackSession);
            setStatus("authenticated");
            setError(null);
            return;
          }

          setSession(null);
          setStatus("signed_out");
          setError("Sign-in verification did not return a session.");
          return;
        }
      }

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
        setError(null);
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
      setError(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!client) {
        setStatus("unconfigured");
        setError("Supabase browser authentication is not configured.");
        return;
      }

      try {
        window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, email);
      } catch {
        // localStorage may be unavailable in restrictive browser modes.
      }

      setStatus("loading");
      setError(null);
      const { error: signInError } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
        },
      });

      if (signInError) {
        setStatus("error");
        setError("Sign-in email could not be sent.");
        return;
      }

      setStatus("signed_out");
      setError("Check your email for the sign-in link.");
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
    setSession(null);
    setStatus("signed_out");
    setError(null);
  }, [client]);

  const markSessionExpired = useCallback(() => {
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
