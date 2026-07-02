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
}: {
  icon: ReactNode;
  title: string;
  body: string;
  kind: RegistryRecordKind;
}) {
  const copy = kindCopy[kind];
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <div className="w-full max-w-md rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-center shadow-[var(--shadow-soft)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]">
          {icon}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[color:var(--text-heading)]">{title}</h1>
        <p className={cn("mt-2 text-sm leading-6", textMuted)}>{body}</p>
        <Link
          href={copy.homeHref}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-[color:var(--command)] px-4 text-sm font-semibold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] hover:bg-[color:var(--command-hover)]"
        >
          {copy.homeLabel}
        </Link>
      </div>
    </main>
  );
}

export function RegistryRecordLoader({
  kind,
  slug,
  children,
}: {
  kind: RegistryRecordKind;
  slug: string;
  children: (record: ServiceRecord) => ReactNode;
}) {
  const { status, record } = useRegistryRecord(kind, slug);
  const copy = kindCopy[kind];

  if (status === "loading") {
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
        title="Sign in required"
        body={`Sign in to view this ${copy.noun}. Registry records are private to your workspace.`}
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

  if (status === "error") {
    return (
      <StatePanel
        kind={kind}
        icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        title="Could not load the record"
        body="Something went wrong fetching this registry record. Try again shortly."
      />
    );
  }

  return <>{children(record)}</>;
}
