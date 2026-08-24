import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { FreshnessStamp } from "@/components/developer-area/hub/freshness-stamp";
import type { Freshness } from "@/lib/developer-area/freshness";

/**
 * No `"use client"`: this renders a `<Link>` and static markup, no handlers. A
 * needless client boundary here would pull every child into the client bundle.
 */
export function PanelPageShell({
  testId,
  title,
  freshness,
  freshnessLabel,
  children,
}: {
  testId: string;
  title: string;
  freshness: Freshness;
  /**
   * Required, not defaulted. `FreshnessStamp` still defaults its own `label` to
   * "Ledger" for its direct callers, but that default is exactly the trap this
   * shell must not forward: a page that forgot to pass its own label would
   * silently render "Ledger content as of …" over data that is not the ledger.
   * Every current call site already has an unambiguous label to state.
   */
  freshnessLabel: string;
  children: ReactNode;
}) {
  return (
    <main data-testid={testId} className="mx-auto grid w-full max-w-[64rem] gap-6 px-4 py-8 sm:px-6">
      <Link
        data-testid={`${testId}-back`}
        href="/mockups/development"
        className="inline-flex min-h-12 w-fit items-center gap-2 text-sm font-bold text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <ArrowLeft aria-hidden="true" className="size-icon-sm" />
        Developer hub
      </Link>

      <h1 className="text-2xl font-extrabold text-[color:var(--text-heading)]">{title}</h1>

      {/*
       * Unconditional, and directly under the title. Every number below is read
       * from a snapshot committed at build time, so the one thing a reader must
       * never have to guess is how old it is.
       */}
      <FreshnessStamp freshness={freshness} label={freshnessLabel} />

      {children}
    </main>
  );
}
