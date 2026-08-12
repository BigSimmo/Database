"use client";

import Link from "next/link";
import { FileQuestion, Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn, textMuted } from "@/components/ui-primitives";
import type { RegistryRecordKind } from "@/lib/registry-records";
import type { ServiceRecord } from "@/lib/services";
import { useRegistryRecord } from "@/lib/use-registry-records";

const kindCopy: Record<RegistryRecordKind, { noun: string; homeHref: string; homeLabel: string }> = {
  service: { noun: "service record", homeHref: "/services", homeLabel: "Back to services" },
  form: { noun: "form record", homeHref: "/forms", homeLabel: "Back to forms" },
};

function StatePanel({
  icon,
  title,
  body,
  kind,
  action,
  onRetry,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  kind: RegistryRecordKind;
  action?: { href: string; label: string };
  /** When set, the panel leads with a Retry button and keeps the link as a secondary escape. */
  onRetry?: () => void;
}) {
  const copy = kindCopy[kind];
  const primary = action ?? { href: copy.homeHref, label: copy.homeLabel };
  const commandButton =
    "inline-flex min-h-10 items-center justify-center rounded-lg bg-[color:var(--command)] px-4 text-sm font-semibold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-center shadow-[var(--shadow-soft)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
          {icon}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[color:var(--text-heading)]">{title}</h1>
        <p className={cn("mt-2 text-sm leading-6", textMuted)}>{body}</p>
        {onRetry ? (
          <div className="mt-5 flex flex-col items-center gap-2">
            <button type="button" onClick={onRetry} className={commandButton}>
              Try again
            </button>
            <Link
              href={primary.href}
              className="text-sm font-semibold text-[color:var(--text-muted)] underline-offset-4 hover:underline"
            >
              {primary.label}
            </Link>
          </div>
        ) : (
          <Link href={primary.href} className={cn("mt-5", commandButton)}>
            {primary.label}
          </Link>
        )}
      </div>
    </main>
  );
}

export function RegistryRecordLoader({
  kind,
  slug,
  fallbackRecord,
  children,
}: {
  kind: RegistryRecordKind;
  slug: string;
  fallbackRecord?: ServiceRecord | null;
  children: (record: ServiceRecord) => ReactNode;
}) {
  const { status, record, governance, refetch } = useRegistryRecord(kind, slug);
  const copy = kindCopy[kind];

  if (status === "loading") {
    // Content-first: when the server supplied the public fixture record, paint
    // it immediately instead of a centered spinner; the owner-aware live record
    // swaps in when the fetch resolves. Owner-only slugs (no fixture) still show
    // the spinner. The fallback is public content, so showing it before an
    // eventual unauthorized/not-found state leaks nothing owner-scoped.
    if (fallbackRecord) {
      // Do not assert an authoritative "locally verified" badge before the
      // `ready` branch reconciles it against live governance — neutralize the
      // fixture's verified flag for this provisional paint so a stale verified
      // badge cannot flash in (mirrors the governance reconciliation below).
      const provisional =
        fallbackRecord.verification?.locallyVerified === true
          ? { ...fallbackRecord, verification: { ...fallbackRecord.verification, locallyVerified: false } }
          : fallbackRecord;
      return <>{children(provisional)}</>;
    }
    return (
      <main className="grid min-h-[60dvh] place-items-center" aria-busy="true">
        <div className={cn("inline-flex items-center gap-2 text-sm font-semibold", textMuted)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading {copy.noun}...
        </div>
      </main>
    );
  }

  if (status === "unauthorized") {
    return (
      <StatePanel
        kind={kind}
        icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        title="Session expired"
        body={`Your session expired. Sign in again to view your private ${copy.noun}. Public ${copy.noun} records remain available from search.`}
        action={{ href: "/", label: "Open account setup" }}
      />
    );
  }

  // Error before not-found: a failed request (registry not migrated yet,
  // Supabase down, network error) leaves record null, and must surface as a
  // retryable load error rather than the misleading "not seeded" copy.
  if (status === "error") {
    return (
      <StatePanel
        kind={kind}
        icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        title="Could not load the record"
        body="Something went wrong fetching this registry record."
        onRetry={refetch}
      />
    );
  }

  if (status === "not_found" || !record) {
    return (
      <StatePanel
        kind={kind}
        icon={<FileQuestion className="h-5 w-5" aria-hidden />}
        title={`No ${copy.noun} found`}
        body={`"${slug}" is not in your registry. It may not be seeded yet, or the link may be out of date.`}
      />
    );
  }

  // Reconcile the verified badge with the authoritative governance column so a
  // record reviewed/downgraded after seeding does not keep showing the stale
  // fixture verification state.
  const rendered = governance
    ? {
        ...record,
        verification: {
          ...record.verification,
          locallyVerified:
            governance.validationStatus === "locally_reviewed" || governance.validationStatus === "approved",
        },
      }
    : record;

  return <>{children(rendered)}</>;
}
