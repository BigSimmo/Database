"use client";

import { type FormEvent, useState } from "react";
import { KeyRound, Loader2, LockKeyhole } from "lucide-react";

import { cn, InlineNotice, primaryControl } from "@/components/ui-primitives";
import { TextField } from "@/components/ui/text-field";
import { developerKeyUnlockUrl } from "@/lib/developer-area/link-access-shared";

/**
 * Passwordless access screen for Ward Flow.
 *
 * Deliberately separate from `DeveloperGateScreen`: that screen offers Clinical
 * KB email/SSO sign-in through `useAuthSession`. Ward Flow is an offline
 * prototype, so its locked state may exchange only the signed developer key and
 * must not mount, import, or call a database-backed account provider.
 */
export function WardFlowKeyGateScreen({
  next,
  keyEntryEnabled,
  keyRejected,
}: {
  next: string;
  keyEntryEnabled: boolean;
  keyRejected: boolean;
}) {
  const [developerKey, setDeveloperKey] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [rejectionDismissed, setRejectionDismissed] = useState(false);

  function submitDeveloperKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = developerKey.trim();
    if (!key || unlocking) return;
    setUnlocking(true);
    try {
      window.location.replace(developerKeyUnlockUrl(next, key));
    } catch {
      setUnlocking(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-md gap-6 px-4 py-16 sm:px-6" data-testid="ward-flow-key-gate">
      <header className="grid gap-2 text-center">
        <p className="inline-flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
          <LockKeyhole aria-hidden="true" className="size-icon-sm" />
          Ward Flow prototype
        </p>
        <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">Enter the developer key</h1>
        <p className="text-sm leading-6 text-[color:var(--text-muted)]">
          Ward Flow is a synthetic offline prototype. It does not use Clinical KB accounts or database access.
        </p>
      </header>

      {keyEntryEnabled ? (
        <form
          onSubmit={submitDeveloperKey}
          data-testid="ward-flow-key-form"
          className="grid gap-2 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-4 shadow-[var(--shadow-inset)]"
        >
          <TextField
            label="Developer key"
            icon={KeyRound}
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={developerKey}
            onChange={(event) => {
              setDeveloperKey(event.target.value);
              setRejectionDismissed(true);
            }}
            error={keyRejected && !rejectionDismissed ? "That key wasn't accepted. Check it and try again." : undefined}
            hint="Opens this prototype on this device and stays unlocked for a year."
            data-testid="ward-flow-key-input"
          />
          <button
            type="submit"
            disabled={unlocking || !developerKey.trim()}
            data-testid="ward-flow-key-submit"
            className={cn(primaryControl, "w-full")}
          >
            {unlocking ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <KeyRound aria-hidden="true" className="h-4 w-4" />
            )}
            Unlock
          </button>
        </form>
      ) : (
        <InlineNotice tone="neutral">Developer-key access is not configured for this deployment.</InlineNotice>
      )}
    </main>
  );
}
