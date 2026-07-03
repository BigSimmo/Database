"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import { KeyRound, Loader2, LogIn, LogOut, Mail, ShieldAlert } from "lucide-react";

import { AUTH_EMAIL_STORAGE_KEY, type OAuthProvider, useAuthSession } from "@/lib/supabase/client";
import {
  cn,
  fieldControlWithIcon,
  fieldIcon,
  fieldLabel,
  floatingControl,
  panelSubtle,
  primaryControl,
  textMuted,
} from "@/components/ui-primitives";

const authEmailChangeEvent = "clinical-kb-auth-email-change";

function getAuthEmailSnapshot() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(AUTH_EMAIL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerAuthEmailSnapshot() {
  return "";
}

function subscribeAuthEmail(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const notify = () => onStoreChange();

  window.addEventListener("storage", notify);
  window.addEventListener(authEmailChangeEvent, notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(authEmailChangeEvent, notify);
  };
}

type AuthMode = "signin" | "signup";
type AuthMethod = "magic" | "password";

const providerLabels: Record<OAuthProvider, string> = { google: "Google", azure: "Microsoft" };

function segmentClass(active: boolean) {
  return cn(
    "min-h-9 flex-1 rounded-md px-2.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
    active
      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)] shadow-[var(--shadow-inset)]"
      : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
  );
}

export function AuthPanel() {
  const {
    status,
    error,
    isConfigured,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    signInWithOAuth,
    signOut,
    session,
  } = useAuthSession();
  const savedEmail = useSyncExternalStore(subscribeAuthEmail, getAuthEmailSnapshot, getServerAuthEmailSnapshot);
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [method, setMethod] = useState<AuthMethod>("magic");
  const email = draftEmail ?? savedEmail;
  const busy = status === "loading";
  const isExpired = status === "expired";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    if (method === "magic") {
      await signInWithEmail(trimmed);
      return;
    }
    if (!password) return;
    if (mode === "signup") {
      await signUpWithPassword(trimmed, password);
    } else {
      await signInWithPassword(trimmed, password);
    }
  }

  if (!isConfigured) {
    return (
      <div className={cn(panelSubtle, "p-3")}>
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warning)]" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Real-data sign-in unavailable</p>
            <p className={cn("mt-1 text-[15px] leading-6", textMuted)}>
              Configure the Supabase public URL and publishable key before using private documents.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className={cn(panelSubtle, "p-3")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Signed in for private documents</p>
            <p className={cn("mt-1 text-xs leading-5", textMuted)}>{session?.user.email ?? "Authenticated session"}</p>
          </div>
          <button type="button" onClick={signOut} className={cn(floatingControl, "px-3 text-xs")}>
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const submitLabel = method === "magic" ? "Send sign-in link" : mode === "signup" ? "Create account" : "Sign in";
  const SubmitIcon = method === "magic" ? Mail : KeyRound;

  return (
    <div className={cn(panelSubtle, "space-y-3 p-3")}>
      <div className="flex items-start gap-3">
        <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--primary)]" />
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">
            {isExpired
              ? "Sign-in link expired"
              : mode === "signup"
                ? "Create your account"
                : "Sign in for private documents"}
          </p>
          <p className={cn("mt-1 text-[15px] leading-6", textMuted)}>
            {isExpired
              ? "Send a fresh link if this one failed or already timed out."
              : "Real-data search, upload, and source previews require a Supabase Auth session."}
          </p>
        </div>
      </div>

      {/* Sign in / Create account */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
        <button type="button" onClick={() => setMode("signin")} className={segmentClass(mode === "signin")}>
          Sign in
        </button>
        <button type="button" onClick={() => setMode("signup")} className={segmentClass(mode === "signup")}>
          Create account
        </button>
      </div>

      {/* Magic link / Password */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1">
        <button type="button" onClick={() => setMethod("magic")} className={segmentClass(method === "magic")}>
          Magic link
        </button>
        <button type="button" onClick={() => setMethod("password")} className={segmentClass(method === "password")}>
          Password
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className={fieldLabel}>Email address</span>
          <div className="relative">
            <Mail className={fieldIcon} />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setDraftEmail(event.target.value)}
              placeholder="you@example.com"
              className={fieldControlWithIcon}
            />
          </div>
        </label>

        {method === "password" && (
          <label className="block">
            <span className={fieldLabel}>Password</span>
            <div className="relative">
              <KeyRound className={fieldIcon} />
              <input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                className={fieldControlWithIcon}
              />
            </div>
          </label>
        )}

        <button
          type="submit"
          disabled={busy || !email.trim() || (method === "password" && !password)}
          className={cn(primaryControl, "w-full")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SubmitIcon className="h-4 w-4" />}
          {submitLabel}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[color:var(--border)]" />
        <span className={cn("text-2xs font-semibold uppercase tracking-[0.08em]", textMuted)}>or continue with</span>
        <span className="h-px flex-1 bg-[color:var(--border)]" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(providerLabels) as OAuthProvider[]).map((provider) => (
          <button
            key={provider}
            type="button"
            disabled={busy}
            onClick={() => signInWithOAuth(provider)}
            className={cn(floatingControl, "justify-center px-3 text-xs")}
          >
            {providerLabels[provider]}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className={cn(
            "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3 text-xs",
            textMuted,
          )}
        >
          {error}
        </p>
      )}
    </div>
  );
}
