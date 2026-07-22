"use client";

import { type FormEvent, useRef, useState } from "react";
import { Clock3, Heart, LockKeyhole, Mail, ShieldCheck, SlidersHorizontal, X } from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";
import { ProviderBrandIcon, type SsoProvider } from "@/components/clinical-dashboard/provider-brand-icons";
import { Sheet } from "@/components/ui/sheet";
import {
  AsyncButton,
  cn,
  fieldControlWithIcon,
  fieldIcon,
  fieldLabel,
  textMuted,
  toolbarButton,
} from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";

const accountBenefits = [
  {
    label: "Local recents",
    detail: "Recent questions stay in this browser session.",
    icon: Clock3,
  },
  {
    label: "Clinical defaults",
    detail: "Jurisdiction and answer style, remembered.",
    icon: SlidersHorizontal,
  },
  {
    label: "Saved favourites",
    detail: "Reopen favourite clinical tools across signed-in devices.",
    icon: Heart,
  },
] as const;

const favouritesAccountBenefits = [
  {
    label: "Saved favourites",
    detail: "Sign up to save favourites and reopen them on any device.",
    icon: Heart,
  },
  {
    label: "Local recents",
    detail: "Recent questions stay in this browser session.",
    icon: Clock3,
  },
  {
    label: "Clinical defaults",
    detail: "Jurisdiction and answer style, remembered.",
    icon: SlidersHorizontal,
  },
] as const;

const securitySummary = [
  {
    label: "Account-scoped saves",
    detail: "Favourites and preferences are stored with your account.",
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

export function AccountSetupDialog({
  open,
  onClose,
  intent = "default",
}: {
  open: boolean;
  onClose: () => void;
  /** When opened from Favourites, lead with save-favourites messaging. */
  intent?: "default" | "favourites";
}) {
  const auth = useAuthSession();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [emailAttempted, setEmailAttempted] = useState(false);
  const busy = auth.status === "loading";
  const statusMessage = emailAttempted ? auth.error : null;
  const emailHasError = Boolean(statusMessage);
  const isFavouritesIntent = intent === "favourites";
  const benefits = isFavouritesIntent ? favouritesAccountBenefits : accountBenefits;
  const title = isFavouritesIntent ? "Sign up to save favourites" : "Set up your workspace";
  const subtitle = isFavouritesIntent
    ? "Create an account to save clinical favourites and access them across devices."
    : "Sync favourites and clinical defaults across signed-in devices. Recent searches stay in this browser session.";
  const benefitsHeading = isFavouritesIntent ? "Favourites stay with your account" : "What your account saves";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setEmailAttempted(true);
    await auth.signInWithEmail(trimmedEmail);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy="account-setup-title"
      closeLabel="Close account setup"
      initialFocusRef={emailInputRef}
      bodyClassName="p-0 sm:p-0"
      contentClassName="account-setup-dialog max-h-[calc(100dvh-0.75rem)] rounded-t-[1.35rem] border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-elevated)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[32rem] sm:rounded-xl"
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
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <div className="px-4 pb-4 pt-5 sm:px-7 sm:pb-6 sm:pt-8">
          <div className="mx-auto grid w-full max-w-[26.5rem] gap-3.5 sm:gap-4">
            <header className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft),var(--shadow-inset)]">
                <BrandMark className="h-8 w-8" />
              </span>
              <h2
                id="account-setup-title"
                className="mt-3.5 text-2xl-minus font-semibold leading-7 text-[color:var(--text-heading)] sm:mt-4 sm:text-2xl sm:leading-8"
              >
                {title}
              </h2>
              <p className={cn("mx-auto mt-2 max-w-[22rem] text-sm font-medium leading-6", textMuted)}>{subtitle}</p>
            </header>

            <label className="block">
              <span className={fieldLabel}>Email address</span>
              <div className="relative">
                <Mail aria-hidden="true" className={fieldIcon} />
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@clinic.example"
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="go"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  aria-invalid={emailHasError || undefined}
                  aria-describedby={emailHasError ? "account-setup-status" : undefined}
                  className={cn(
                    fieldControlWithIcon,
                    "h-10.5 focus:ring-2 focus:ring-[color:var(--focus)]/20 sm:h-tap",
                  )}
                />
              </div>
            </label>

            <AsyncButton
              type="submit"
              busy={busy}
              busyLabel="Sending link…"
              className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--clinical-accent)] px-5 text-sm font-semibold text-[color:var(--clinical-accent-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--clinical-accent-hover)] hover:shadow-[var(--shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:shadow-none"
            >
              Continue
            </AsyncButton>

            <div className="grid gap-3">
              <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-soft)]">
                <span className="h-px flex-1 bg-[color:var(--border)]" />
                <span>Social sign-in unavailable</span>
                <span className="h-px flex-1 bg-[color:var(--border)]" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["Apple", "Google", "Microsoft"] as const).map((provider) => (
                  <ProviderButton key={provider} provider={provider} />
                ))}
              </div>
              <p className={cn("text-center text-xs leading-5", textMuted)}>
                Continue with email. Social sign-in is not available in this setup.
              </p>
            </div>

            <section
              aria-labelledby="account-benefits-title"
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--shadow-inset)]"
            >
              <h3
                id="account-benefits-title"
                className="mb-2.5 px-0.5 text-xs font-semibold uppercase leading-4 tracking-[0.06em] text-[color:var(--text-soft)]"
              >
                {benefitsHeading}
              </h3>
              <ul className="grid gap-1.5 sm:grid-cols-3 sm:gap-2">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <li
                      key={benefit.label}
                      className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-2.5 py-2 shadow-[var(--shadow-inset)] sm:flex-col sm:items-start sm:gap-1.5 sm:px-3 sm:py-2.5"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                          {benefit.label}
                        </span>
                        <span className={cn("block text-xs font-medium leading-4", textMuted)}>{benefit.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              aria-labelledby="security-summary-title"
              className="rounded-lg border border-[color:var(--success-border)]/45 bg-[color:var(--success-soft)]/35 p-3 shadow-[var(--shadow-inset)]"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" aria-hidden />
                <h3 id="security-summary-title" className="text-sm font-semibold text-[color:var(--text-heading)]">
                  Security summary
                </h3>
              </div>

              <div className="divide-y divide-[color:var(--border)]/70">
                {securitySummary.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 py-2 first:pt-1 last:pb-1"
                    >
                      <Icon className="mt-0.5 h-4 w-4 text-[color:var(--text-muted)]" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                          {item.label}
                        </span>
                        <span className={cn("block text-xs font-medium leading-5", textMuted)}>{item.detail}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {statusMessage ? (
              <p
                id="account-setup-status"
                role="alert"
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

function ProviderButton({ provider }: { provider: SsoProvider }) {
  const descriptionId = `account-${provider.toLowerCase()}-sign-in-unavailable`;

  return (
    <button
      type="button"
      disabled
      title={`${provider} sign-in is unavailable — coming soon`}
      aria-label={`${provider} sign-in unavailable`}
      aria-describedby={descriptionId}
      className="flex min-h-tap min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-1.5 text-xs font-semibold text-[color:var(--text-heading)] shadow-[var(--shadow-inset)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:bg-[color:var(--surface-inset)] disabled:text-[color:var(--disabled)] disabled:opacity-75 disabled:shadow-none min-[375px]:gap-2 min-[375px]:px-2 sm:text-sm"
    >
      <ProviderBrandIcon provider={provider} className="h-5 w-5" />
      <span className="min-w-0 text-2xs leading-none min-[375px]:text-xs sm:text-sm">{provider}</span>
      <span id={descriptionId} className="sr-only">
        {provider} sign-in is unavailable. Continue with email.
      </span>
    </button>
  );
}
