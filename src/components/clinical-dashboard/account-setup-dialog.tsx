"use client";

import { type FormEvent, useState } from "react";
import { Clock3, Heart, Mail, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";
import { ProviderBrandIcon } from "@/components/clinical-dashboard/provider-brand-icons";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { AsyncButton, cn, floatingControl, InlineNotice, primaryControl } from "@/components/ui-primitives";
import { useAuthSession } from "@/lib/supabase/client";

const accountSavedBenefits = [
  {
    label: "Saved favourites",
    detail: "Available on your signed-in devices.",
    icon: Heart,
  },
  {
    label: "Clinical defaults",
    detail: "Your jurisdiction and answer style follow your account.",
    icon: SlidersHorizontal,
  },
] as const;

const deviceOnlyBenefits = [
  {
    label: "Recent searches",
    detail: "Stay in this browser session and do not sync.",
    icon: Clock3,
  },
] as const;

type AccountBenefit = {
  label: string;
  detail: string;
  icon: LucideIcon;
};

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
  const [email, setEmail] = useState("");
  const [actionAttempted, setActionAttempted] = useState(false);
  const busy = auth.status === "loading";
  const isFavouritesIntent = intent === "favourites";
  const title = isFavouritesIntent ? "Sign up to save favourites" : "Set up your workspace";
  const description = isFavouritesIntent
    ? "Sign in or create an account to save favourites and reopen them on any device."
    : "Sign in or create an account to sync favourites and clinical defaults across your devices.";
  const error = actionAttempted ? auth.error : null;
  const notice = actionAttempted ? auth.notice : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || busy) return;
    setActionAttempted(true);
    await auth.signInWithEmail(trimmedEmail);
  }

  async function chooseProvider(provider: "Google" | "Microsoft") {
    if (busy) return;
    setActionAttempted(true);
    await auth.signInWithOAuth(provider === "Google" ? "google" : "azure");
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      closeLabel="Close account setup"
      headerLeading={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
          <BrandMark className="h-6 w-6" />
        </span>
      }
      bodyClassName="p-4 sm:p-6"
      contentClassName="account-setup-dialog max-h-[calc(100dvh-0.75rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[34rem]"
      portal
    >
      <form onSubmit={submit} className="mx-auto grid w-full max-w-[29rem] gap-4">
        <div className="grid gap-2.5">
          <TextField
            data-sheet-autofocus="true"
            label="Email address"
            icon={Mail}
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
          />

          <AsyncButton
            type="submit"
            busy={busy}
            busyLabel="Sending link…"
            disabled={!email.trim()}
            idleIcon={<Mail aria-hidden="true" className="h-4 w-4" />}
            className={cn(primaryControl, "w-full")}
          >
            Continue with email
          </AsyncButton>
        </div>

        <div className="grid gap-2.5">
          <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-muted)]">
            <span className="h-px flex-1 bg-[color:var(--border)]" />
            <span>or continue with</span>
            <span className="h-px flex-1 bg-[color:var(--border)]" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ProviderButton provider="Google" busy={busy} onClick={() => chooseProvider("Google")} />
            <ProviderButton provider="Microsoft" busy={busy} onClick={() => chooseProvider("Microsoft")} />
          </div>
          <p className="text-center text-xs font-medium leading-5 text-[color:var(--text-muted)]">
            Apple sign-in is not available yet.
          </p>
        </div>

        {notice ? <InlineNotice tone="success">{notice}</InlineNotice> : null}
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

        <section aria-labelledby="account-storage-title" className="grid gap-2.5">
          <h3 id="account-storage-title" className="text-sm font-semibold text-[color:var(--text-heading)]">
            What’s saved where
          </h3>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <AccountBenefitGroup title="Saved to your account" benefits={accountSavedBenefits} />
            <AccountBenefitGroup title="Stays on this device" benefits={deviceOnlyBenefits} />
          </div>
        </section>

        <aside className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3.5 forced-colors:border">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-[color:var(--text-heading)]">No PHI required</p>
            <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              Do not enter patient-identifying information. Secure authentication protects sign-in; data is encrypted in
              transit.
            </p>
          </div>
        </aside>
      </form>
    </Sheet>
  );
}

function AccountBenefitGroup({ title, benefits }: { title: string; benefits: readonly AccountBenefit[] }) {
  return (
    <div className="rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] p-3.5 forced-colors:border">
      <h4 className="text-xs font-semibold uppercase leading-4 tracking-label text-[color:var(--text-muted)]">
        {title}
      </h4>
      <ul className="mt-2.5 grid gap-2.5">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <li key={benefit.label} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">
                  {benefit.label}
                </span>
                <span className="block text-xs font-medium leading-5 text-[color:var(--text-muted)]">
                  {benefit.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ProviderButton({
  provider,
  busy,
  onClick,
}: {
  provider: "Google" | "Microsoft";
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={`Continue with ${provider}`}
      className={cn(floatingControl, "w-full min-w-0 px-3")}
    >
      <ProviderBrandIcon provider={provider} className="h-5 w-5" />
      <span className="min-w-0 truncate">{provider}</span>
    </button>
  );
}
