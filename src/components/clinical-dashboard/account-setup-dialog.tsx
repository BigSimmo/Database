"use client";

import { type FormEvent, useRef, useState } from "react";
import {
  Apple,
  BookOpen,
  CircleCheck,
  Circle,
  ClipboardList,
  Clock3,
  FileText,
  Info,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";
import { Sheet } from "@/components/ui/sheet";
import { cn, fieldControlWithIcon, fieldIcon, fieldLabel, textMuted, toolbarButton } from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";

const sourcePreferences = [
  { id: "guidelines", label: "Guidelines", icon: FileText },
  { id: "drug-references", label: "Drug references", icon: Clock3 },
  { id: "review-articles", label: "Review articles", icon: BookOpen },
  { id: "local-protocols", label: "Local protocols", icon: ClipboardList },
] as const;

const securitySummary = [
  {
    label: "Private workspace",
    detail: "Your data stays private and is never shared.",
    icon: ShieldCheck,
  },
  {
    label: "No PHI required",
    detail: "Do not enter patient-identifying information.",
    icon: LockKeyhole,
  },
  {
    label: "Encrypted sign-in",
    detail: "Secure authentication and data in transit.",
    icon: LockKeyhole,
  },
] as const;

type SourcePreferenceId = (typeof sourcePreferences)[number]["id"];
type Provider = "Apple" | "Google" | "Microsoft";

export function AccountSetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const auth = useAuthSession();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<SourcePreferenceId>>(
    () => new Set(["guidelines", "review-articles"]),
  );
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [emailAttempted, setEmailAttempted] = useState(false);
  const busy = auth.status === "loading";
  const statusMessage = providerNotice ?? (emailAttempted ? auth.error : null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setProviderNotice(null);
    setEmailAttempted(true);
    await auth.signInWithEmail(trimmedEmail);
  }

  function chooseProvider(provider: Provider) {
    setProviderNotice(`${provider} sign-in is not connected yet. Continue with email to set up this workspace.`);
  }

  function toggleSource(sourceId: SourcePreferenceId) {
    setSelectedSources((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy="account-setup-title"
      closeLabel="Close account setup"
      initialFocusRef={emailInputRef}
      bodyClassName="p-0 sm:p-0"
      contentClassName="account-setup-dialog max-h-[calc(100dvh-0.75rem)] rounded-t-[1.35rem] border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[32rem] sm:rounded-xl"
      portal
    >
      <form onSubmit={submit} className="relative">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            toolbarButton,
            "absolute right-3 top-3 z-10 h-10 w-10 border-transparent bg-transparent shadow-none hover:bg-[color:var(--surface-subtle)] sm:right-4 sm:top-4",
          )}
          aria-label="Close account setup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-4 pb-4 pt-5 sm:px-7 sm:pb-6 sm:pt-8">
          <div className="mx-auto grid w-full max-w-[26.5rem] gap-3.5 sm:gap-4">
            <header className="text-center">
              <BrandMark className="mx-auto h-8 w-8" />
              <h2
                id="account-setup-title"
                className="mt-3.5 text-2xl-minus font-semibold leading-7 text-[color:var(--text-heading)] sm:mt-4 sm:text-2xl sm:leading-8"
              >
                Set up your workspace
              </h2>
              <p className={cn("mx-auto mt-2 max-w-[22rem] text-sm font-medium leading-6", textMuted)}>
                Sync source preferences, search history, and clinical defaults across devices.
              </p>
            </header>

            <label className="block">
              <span className={fieldLabel}>Email address</span>
              <div className="relative">
                <Mail className={fieldIcon} />
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@clinic.example"
                  autoComplete="email"
                  required
                  className={cn(fieldControlWithIcon, "h-10.5 focus:ring-2 focus:ring-[color:var(--focus)]/20 sm:h-11")}
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-5 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--clinical-accent-hover)] hover:shadow-[var(--shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:shadow-none"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
            </button>

            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-soft)]">
                <span className="h-px flex-1 bg-[color:var(--border)]" />
                <span>or continue with</span>
                <span className="h-px flex-1 bg-[color:var(--border)]" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["Apple", "Google", "Microsoft"] as const).map((provider) => (
                  <ProviderButton key={provider} provider={provider} onClick={() => chooseProvider(provider)} />
                ))}
              </div>
            </div>

            <section
              aria-labelledby="source-preferences-title"
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      id="source-preferences-title"
                      className="text-sm font-semibold text-[color:var(--text-heading)]"
                    >
                      Source preferences
                    </h3>
                    <Info className="h-3.5 w-3.5 text-[color:var(--text-soft)]" aria-hidden />
                  </div>
                  <p className={cn("mt-0.5 text-xs font-medium leading-5", textMuted)}>
                    Choose the sources you rely on most.
                  </p>
                </div>
                <span className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-soft)] px-2 text-2xs font-bold text-[color:var(--success)]">
                  <CircleCheck className="h-3.5 w-3.5" />
                  Saved
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sourcePreferences.map((source) => {
                  const Icon = source.icon;
                  const selected = selectedSources.has(source.id);
                  return (
                    <button
                      key={source.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSource(source.id)}
                      className={cn(
                        "relative grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-semibold leading-4 shadow-[var(--shadow-inset)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:min-h-[4.9rem] sm:grid-cols-1 sm:place-items-center sm:gap-0 sm:px-2 sm:text-center",
                        selected
                          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--text-heading)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface-lux)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                      )}
                    >
                      <Icon className="h-4 w-4 text-[color:var(--clinical-accent)] sm:mb-1 sm:h-5 sm:w-5" />
                      <span className="min-w-0 whitespace-normal break-words text-xs leading-4">{source.label}</span>
                      <span
                        className={cn(
                          "grid h-4.5 w-4.5 place-items-center rounded-full border sm:absolute sm:right-2 sm:top-2",
                          selected
                            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                            : "border-[color:var(--border-strong)] bg-[color:var(--surface)] text-transparent",
                        )}
                        aria-hidden
                      >
                        {selected ? <CircleCheck className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              aria-labelledby="security-summary-title"
              className="rounded-lg border border-[color:var(--success-border)]/40 bg-[color:var(--success-soft)]/35 p-3 shadow-[var(--shadow-inset)]"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[color:var(--text-heading)]" aria-hidden />
                  <h3 id="security-summary-title" className="text-sm font-semibold text-[color:var(--text-heading)]">
                    Security summary
                  </h3>
                </div>
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[color:var(--success-soft)] px-2 text-2xs font-bold text-[color:var(--success)]">
                  <CircleCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              </div>

              <div className="divide-y divide-[color:var(--border)]/70">
                {securitySummary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 py-2 first:pt-1 last:pb-1"
                    >
                      <Icon className="mt-0.5 h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                          {item.label}
                        </span>
                        <span className={cn("hidden text-xs font-medium leading-5 sm:block", textMuted)}>
                          {item.detail}
                        </span>
                      </span>
                      <CircleCheck className="mt-1 h-4 w-4 text-[color:var(--success)]" aria-hidden />
                    </div>
                  );
                })}
              </div>
            </section>

            {statusMessage ? (
              <p
                role={providerNotice ? "status" : "alert"}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-muted)]"
              >
                {statusMessage}
              </p>
            ) : null}

            <p className="text-center text-sm font-medium text-[color:var(--text-muted)]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => emailInputRef.current?.focus()}
                className="font-semibold text-[color:var(--clinical-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function ProviderButton({ provider, onClick }: { provider: Provider; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-1.5 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] min-[375px]:gap-2 min-[375px]:px-2 sm:text-sm"
    >
      <ProviderMark provider={provider} />
      <span className="min-w-0 text-2xs leading-none min-[375px]:text-xs sm:text-sm">{provider}</span>
    </button>
  );
}

function ProviderMark({ provider }: { provider: Provider }) {
  if (provider === "Microsoft") {
    return (
      <span className="grid h-4.5 w-4.5 shrink-0 grid-cols-2 gap-0.5" aria-hidden="true">
        <span className="bg-[#f25022]" />
        <span className="bg-[#7fba00]" />
        <span className="bg-[#00a4ef]" />
        <span className="bg-[#ffb900]" />
      </span>
    );
  }

  if (provider === "Apple") {
    return (
      <Apple className="h-4.5 w-4.5 shrink-0 text-[color:var(--text-heading)]" aria-hidden="true" strokeWidth={2.4} />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-sm font-bold leading-none text-[#4285f4]"
    >
      G
    </span>
  );
}
