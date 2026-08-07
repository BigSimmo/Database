"use client";

import Link from "next/link";

import { cn } from "@/components/ui-primitives";

import { AnswerHomePerfectedSection } from "./answer-home-perfected";
import { DocumentsFilterPerfectedSection } from "./documents-filter-perfected";
import { FavouritesPerfectedSection } from "./favourites-perfected";
import { SaveToFavouritesPerfectedSection } from "./save-to-favourites-perfected";
import { ServicesSearchPerfectedSection } from "./services-search-perfected";
import { focusRing } from "./shared";
import { ToolsSearchPerfectedSection } from "./tools-search-perfected";

const TOC = [
  { href: "#answer-home", label: "1. Answer home safety", issue: "#165 · #166" },
  { href: "#tools-search", label: "2. Tools search", issue: "#162" },
  { href: "#services-search", label: "3. Services search", issue: "#163" },
  { href: "#favourites", label: "4. Favourites", issue: "#164" },
  { href: "#documents-filter", label: "5. Documents filter", issue: "#170 · #171" },
  { href: "#save-to-favourites", label: "6. Save from answers", issue: "Evidence loop" },
] as const;

const PRIOR_COMPS = [
  {
    label: "Tools A — Compact Results",
    href: "/mockups/mode-page-redesign-2026-07/perfected-combined/tools-a-compact-results-desktop-phone.png",
  },
  {
    label: "Services B — Progressive Workflow",
    href: "/mockups/mode-page-redesign-2026-07/perfected-combined/services-b-progressive-workflow-desktop-phone.png",
  },
  {
    label: "Favourites B — Search-Led Workspace",
    href: "/mockups/mode-page-redesign-2026-07/perfected-combined/favourites-b-search-led-workspace-desktop-phone.png",
  },
  {
    label: "Answer home proposal (study)",
    href: "/mockups/answer-home-proposal",
  },
  {
    label: "Warning consolidation (study)",
    href: "/mockups/warning-consolidation",
  },
] as const;

export function ShipFirstRedesignGallery() {
  return (
    <main
      data-testid="ship-first-redesign-gallery"
      className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]"
    >
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Ship-first redesign · perfected mockups
          </p>
          <h1 className="mt-2 max-w-3xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
            Six designed surfaces, refined for implementation
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Interactive desktop + phone frames for the already-designed ship-first package. Design-scratch only —
            production routes are unchanged until each issue&apos;s implementation PR.
          </p>

          <nav aria-label="Perfected sections" className="mt-6 flex flex-wrap gap-2">
            {TOC.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-2xs font-bold text-[color:var(--text-heading)]",
                  focusRing,
                )}
              >
                {item.label}
                <span className="font-medium text-[color:var(--text-soft)]">{item.issue}</span>
              </a>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
            <p className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Prior static comps & studies
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              {PRIOR_COMPS.map((comp) => (
                <li key={comp.href}>
                  <Link
                    href={comp.href}
                    className={cn(
                      "text-2xs font-semibold text-[color:var(--clinical-accent)] underline-offset-2 hover:underline",
                      focusRing,
                    )}
                  >
                    {comp.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[88rem] gap-14 px-4 py-10 sm:px-6 lg:px-8">
        <AnswerHomePerfectedSection />
        <ToolsSearchPerfectedSection />
        <ServicesSearchPerfectedSection />
        <FavouritesPerfectedSection />
        <DocumentsFilterPerfectedSection />
        <SaveToFavouritesPerfectedSection />
      </div>
    </main>
  );
}
