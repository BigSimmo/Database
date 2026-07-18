"use client";

import Link from "next/link";
import { BookOpenText, Search } from "lucide-react";
import type { ReactNode } from "react";

import { cn, navPill } from "@/components/ui-primitives";

export function FactsheetShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/factsheets"
            className="inline-flex min-h-tap min-w-0 items-center gap-2 rounded-lg text-sm font-semibold text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <BookOpenText className="size-icon-md" aria-hidden="true" />
            </span>
            <span className="truncate">Patient information</span>
          </Link>
          <nav aria-label="Factsheet navigation" className="flex shrink-0 items-center gap-1.5">
            <Link href="/factsheets" className={cn(navPill, "hidden sm:inline-flex")}>
              Browse
            </Link>
            <Link href="/factsheets/search" className={navPill}>
              <Search className="size-icon-sm" aria-hidden="true" />
              Search
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}
