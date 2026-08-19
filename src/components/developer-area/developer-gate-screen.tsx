"use client";

import { type FormEvent, useState } from "react";
import { Loader2, LockKeyhole, Mail, ShieldAlert } from "lucide-react";

import { cn, floatingControl, InlineNotice, primaryControl } from "@/components/ui-primitives";
import { ProviderBrandMark, type SsoProvider } from "@/components/clinical-dashboard/provider-brand-icons";
import { TextField } from "@/components/ui/text-field";
import { type OAuthProvider, useAuthSession } from "@/lib/supabase/client";
import type { DeveloperAccessState } from "@/lib/developer-area/access";

/** Rendered by `DeveloperAreaGate` instead of the page whenever the visitor is
 *  not a signed-in administrator. `next` is the exact path they asked for
 *  (development hub or a specific Caring Contact route), so sign-in returns
 *  them to it rather than always landing on the hub root. */
export function DeveloperGateScreen({
  state,
  next,
  email,
}: {
  state: Exclude<DeveloperAccessState, "authorized">;
  next: string;
  email: string | null;
}) {
  const auth = useAuthSession();
  const [formEmail, setFormEmail] = useState("");
  const [pendingProvider, setPendingProvider] = useState<SsoProvider | null>(null);
  const busy = auth.status === "loading" || pendingProvider !== null;

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formEmail.trim() || busy) return;
    await auth.signInWithEmail(formEmail.trim(), next);
  }

  async function chooseProvider(provider: SsoProvider) {
    if (busy) return;
    setPendingProvider(provider);
    const providerId: OAuthProvider = provider === "Apple" ? "apple" : provider === "Google" ? "google" : "azure";
    try {
      await auth.signInWithOAuth(providerId, next);
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <main
      className="mx-auto grid w-full max-w-md gap-6 px-4 py-16 sm:px-6"
      data-testid="developer-gate-screen"
      data-developer-gate-state={state}
    >
      <header className="grid gap-2 text-center">
        <p className="inline-flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
          {state === "unauthorized" ? (
            <ShieldAlert aria-hidden="true" className="size-icon-sm" />
          ) : (
            <LockKeyhole aria-hidden="true" className="size-icon-sm" />
          )}
          Development
        </p>
        <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">
          {state === "unauthorized" ? "This account doesn't have developer access" : "Sign in to continue"}
        </h1>
        <p className="text-sm leading-6 text-[color:var(--text-muted)]">
          {state === "unauthorized"
            ? `Signed in as ${email ?? "this account"}. Only an authorised developer account can open this page.`
            : "This page is only reachable to a signed-in developer account."}
        </p>
      </header>

      {state === "unauthorized" ? (
        <button
          type="button"
          onClick={() => void auth.signOut()}
          data-testid="developer-gate-sign-out"
          className={cn(floatingControl, "min-h-12 w-full justify-center gap-2 text-sm")}
        >
          Sign out
        </button>
      ) : (
        <div className="grid gap-3 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]">
          <form onSubmit={submitEmail} className="grid gap-2">
            <TextField
              label="Email address"
              icon={Mail}
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="go"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={formEmail}
              onChange={(event) => setFormEmail(event.target.value)}
              placeholder="you@clinic.example"
            />
            <button
              type="submit"
              disabled={busy || !formEmail.trim() || !auth.isConfigured}
              data-testid="developer-gate-email-submit"
              className={cn(primaryControl, "w-full")}
            >
              {auth.status === "loading" ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Mail aria-hidden="true" className="h-4 w-4" />
              )}
              Continue with email
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-muted)]">
            <span className="h-px flex-1 bg-[color:var(--border)]" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-[color:var(--border)]" />
          </div>

          <div className="grid gap-2">
            {(["Apple", "Google", "Microsoft"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => void chooseProvider(provider)}
                disabled={busy}
                aria-label={`Continue with ${provider}`}
                className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-left text-sm font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-wait disabled:opacity-65"
              >
                {pendingProvider === provider ? (
                  <span className="grid h-7 w-7 shrink-0 place-items-center">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  </span>
                ) : (
                  <ProviderBrandMark provider={provider} />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {pendingProvider === provider ? "Connecting…" : `Continue with ${provider}`}
                </span>
              </button>
            ))}
          </div>

          {auth.notice ? <InlineNotice tone="success">{auth.notice}</InlineNotice> : null}
          {auth.error ? <InlineNotice tone="danger">{auth.error}</InlineNotice> : null}
          {!auth.isConfigured ? (
            <InlineNotice tone="neutral">Sign-in is not configured for this deployment.</InlineNotice>
          ) : null}
        </div>
      )}
    </main>
  );
}
