"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import { Loader2, LogIn, LogOut, Mail, ShieldAlert } from "lucide-react";

import { AUTH_EMAIL_STORAGE_KEY, useAuthSession } from "@/lib/supabase/client";
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

export function AuthPanel() {
  const { status, error, isConfigured, signInWithEmail, signOut, session } = useAuthSession();
  const savedEmail = useSyncExternalStore(subscribeAuthEmail, getAuthEmailSnapshot, getServerAuthEmailSnapshot);
  const [draftEmail, setDraftEmail] = useState<string | null>(null);
  const email = draftEmail ?? savedEmail;
  const busy = status === "loading";
  const isExpired = status === "expired";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    await signInWithEmail(email.trim());
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

  return (
    <form onSubmit={submit} className={cn(panelSubtle, "space-y-3 p-3")}>
      <div className="flex items-start gap-3">
        <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--primary)]" />
        <div>
          <p className="text-sm font-semibold text-[color:var(--text)]">
            {isExpired ? "Sign-in link expired" : "Sign in for private documents"}
          </p>
          <p className={cn("mt-1 text-[15px] leading-6", textMuted)}>
            {isExpired
              ? "Send a fresh link if this one failed or already timed out."
              : "Real-data search, upload, and source previews require a Supabase Auth session."}
          </p>
        </div>
      </div>
      <label className="block">
        <span className={fieldLabel}>Email address</span>
        <div className="relative">
          <Mail className={fieldIcon} />
          <input
            type="email"
            value={email}
            onChange={(event) => setDraftEmail(event.target.value)}
            placeholder="you@example.com"
            className={fieldControlWithIcon}
          />
        </div>
      </label>
      <button type="submit" disabled={busy || !email.trim()} className={cn(primaryControl, "w-full")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Send sign-in link
      </button>
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
    </form>
  );
}
