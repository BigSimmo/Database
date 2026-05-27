"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

const AuthContext = createContext<AuthContextValue | null>(null);
let browserSupabaseClient: SupabaseClient | null | undefined;
let browserSupabaseClientConfig: string | null = null;

function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    browserSupabaseClient = null;
    browserSupabaseClientConfig = null;
    return null;
  }

  const configKey = `${url}:${key}`;
  if (browserSupabaseClientConfig === configKey) {
    return browserSupabaseClient ?? null;
  }

  browserSupabaseClientConfig = configKey;
  browserSupabaseClient = createClient(url, key, {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(client ? "loading" : "unconfigured");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return () => undefined;

    let active = true;
    client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setStatus("error");
          setError("Session could not be loaded.");
          return;
        }
        setSession(data.session);
        setStatus(data.session ? "authenticated" : "signed_out");
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setError("Session could not be loaded.");
      });

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
