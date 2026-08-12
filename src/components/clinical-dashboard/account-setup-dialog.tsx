"use client";

import { type FormEvent, useState } from "react";
import { Clock3, Heart, Loader2, Mail, ShieldCheck, SlidersHorizontal, type LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/clinical-dashboard/brand";
import { ProviderBrandIcon, type SsoProvider } from "@/components/clinical-dashboard/provider-brand-icons";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { AsyncButton, cn, floatingControl, InlineNotice, primaryControl } from "@/components/ui-primitives";
import { useAuthSession, type OAuthProvider } from "@/lib/supabase/client";

const storageBenefits = [
  {
    label: "Saved favourites",
    detail: "Available whenever you sign in on another device.",
    scope: "Account",
    icon: Heart,
  },
  {
    label: "Clinical defaults",
    detail: "Your jurisdiction and answer style follow your account.",
    scope: "Account",
    icon: SlidersHorizontal,
  },
  {
    label: "Recent searches",
    detail: "Stay in this browser session and do not sync.",
    scope: "This device",
    icon: Clock3,
  },
] as const;

type StorageBenefit = {
  label: string;
  detail: string;
  scope: "Account" | "This device";
  icon: LucideIcon;
};

function providerId(provider: SsoProvider): OAuthProvider {
  if (provider === "Apple") return "apple";
  return provider === "Google" ? "google" : "azure";
}

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
  const [pendingProvider, setPendingProvider] = useState<SsoProvider | null>(null);
  const busy = auth.status === "loading";
  const actionBusy = busy || pendingProvider !== null;
  const isFavouritesIntent = intent === "favourites";
  const title = isFavouritesIntent ? "Sign up to save favourites" : "Set up your workspace";
  const description = isFavouritesIntent
    ? "Sign in or create an account to save favourites and reopen them on any device."
    : "Sign in or create an account to keep favourites and clinical defaults with you.";
  const error = actionAttempted ? auth.error : null;
  const notice = actionAttempted ? auth.notice : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || actionBusy) return;
    setPendingProvider(null);
    setActionAttempted(true);
    await auth.signInWithEmail(trimmedEmail);
  }

  async function chooseProvider(provider: SsoProvider) {
    if (actionBusy) return;
    setActionAttempted(true);
    setPendingProvider(provider);
    try {
      await auth.signInWithOAuth(providerId(provider));
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      closeLabel="Close account setup"
      headerLeading={
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--shadow-soft),var(--shadow-inset)] max-[359px]:hidden">
          <BrandMark className="h-7 w-7" />
        </span>
      }
      headerClassName="bg-[color:var(--surface-lux)]"
      titleClassName="text-base sm:text-lg"
      bodyClassName="bg-[color:var(--surface)] p-4 sm:p-6"
      contentClassName="account-setup-dialog max-h-[calc(100dvh-0.5rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[44rem]"
      portal
    >
      <form onSubmit={submit} className="mx-auto grid w-full max-w-[38rem] gap-5">
        <section aria-labelledby="account-provider-title" className="grid gap-3">
          <div>
            <h3 id="account-provider-title" className="text-sm font-semibold text-[color:var(--text-heading)]">
              Choose how to continue
            </h3>
            <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              Use an existing account for the quickest setup.
            </p>
          </div>

          <div data-testid="account-provider-grid" className="grid gap-2.5 sm:grid-cols-3">
            {(["Apple", "Google", "Microsoft"] as const).map((provider) => (
              <ProviderButton
                key={provider}
                provider={provider}
                busy={actionBusy}
                pending={pendingProvider === provider}
                onClick={() => void chooseProvider(provider)}
              />
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3 text-xs font-medium text-[color:var(--text-muted)]">
          <span className="h-px flex-1 bg-[color:var(--border)]" />
          <span>or continue with email</span>
          <span className="h-px flex-1 bg-[color:var(--border)]" />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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
            busy={busy && pendingProvider === null}
            busyLabel="Sending link…"
            disabled={actionBusy || !email.trim()}
            idleIcon={<Mail aria-hidden="true" className="h-4 w-4" />}
            className={cn(primaryControl, "w-full sm:min-w-48")}
          >
            Continue with email
          </AsyncButton>
        </div>

        {notice ? <InlineNotice tone="success">{notice}</InlineNotice> : null}
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

        <section
          aria-labelledby="account-storage-title"
          data-testid="account-storage-summary"
          className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] shadow-[var(--shadow-inset)] forced-colors:border"
        >
          <div className="border-b border-[color:var(--border)] px-3.5 py-3 sm:px-4">
            <h3 id="account-storage-title" className="text-sm font-semibold text-[color:var(--text-heading)]">
              What’s saved where
            </h3>
            <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              Account data follows you; recent activity stays private to this browser.
            </p>
          </div>

          <ul className="divide-y divide-[color:var(--border)]/80">
            {storageBenefits.map((benefit) => (
              <StorageBenefitRow key={benefit.label} benefit={benefit} />
            ))}
          </ul>

          <div className="flex items-start gap-2.5 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3.5 py-3 sm:px-4">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
            <p className="text-xs font-medium leading-5 text-[color:var(--text-muted)]">
              <strong className="font-semibold text-[color:var(--text-heading)]">No PHI required.</strong> Do not enter
              patient-identifying information during sign-in.
            </p>
          </div>
        </section>
      </form>
    </Sheet>
  );
}

function StorageBenefitRow({ benefit }: { benefit: StorageBenefit }) {
  const Icon = benefit.icon;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 px-3.5 py-3 sm:items-center sm:px-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5 text-[color:var(--text-heading)]">{benefit.label}</span>
        <span className="block text-xs font-medium leading-5 text-[color:var(--text-muted)]">{benefit.detail}</span>
      </span>
      <span className="mt-0.5 inline-flex min-h-6 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-2xs font-semibold leading-none text-[color:var(--text-muted)] sm:mt-0">
        {benefit.scope}
      </span>
    </li>
  );
}

function ProviderButton({
  provider,
  busy,
  pending,
  onClick,
}: {
  provider: SsoProvider;
  busy: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={`Continue with ${provider}`}
      data-provider={provider.toLowerCase()}
      className={cn(
        floatingControl,
        "w-full min-w-0 justify-center gap-2.5 bg-[color:var(--surface-lux)] px-3 shadow-[var(--shadow-inset)]",
      )}
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
      ) : (
        <ProviderBrandIcon provider={provider} className="h-5 w-5" />
      )}
      <span className="min-w-0 truncate">
        {pending ? (
          "Connecting…"
        ) : (
          <>
            <span className="sm:hidden">Continue with </span>
            {provider}
          </>
        )}
      </span>
    </button>
  );
}
