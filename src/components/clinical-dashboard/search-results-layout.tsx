"use client";

import type { ReactNode } from "react";

import {
  cn,
  searchPageCanvas,
  searchPageContainer,
  searchPageShell,
  searchResultsBodyGrid,
  searchResultsMainColumn,
  searchResultsSidebar,
} from "@/components/ui-primitives";

export function SearchResultsLayout({
  testId,
  header,
  summary,
  resultsLabel,
  children,
  footer,
  sidebar,
  sidebarMobile,
  mainClassName,
  className,
  canvasClassName,
  reserveOwner,
  reserveHiddenPad,
  reserveTransitioning,
}: {
  testId?: string;
  header?: ReactNode;
  summary?: ReactNode;
  resultsLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  sidebar?: ReactNode;
  sidebarMobile?: ReactNode;
  mainClassName?: string;
  className?: string;
  /** Override page canvas colours — e.g. Services keeps its legacy teal/slate shell. */
  canvasClassName?: string;
  /** Named page-owned phone reserve for shared collapse metrics and transitions. */
  reserveOwner?: string;
  /** Reserve remaining after phone chrome hides (for example `0rem`). */
  reserveHiddenPad?: string;
  reserveTransitioning?: boolean;
}) {
  const hasSidebar = Boolean(sidebar);

  return (
    <main
      data-testid={testId}
      data-reserve-owner={reserveOwner}
      data-reserve-hidden-pad={reserveHiddenPad}
      data-reserve-transitioning={reserveTransitioning ? "true" : undefined}
      className={cn(searchPageShell, canvasClassName ?? searchPageCanvas, className)}
    >
      <div className={cn(searchPageContainer, "grid gap-4")}>
        {header}
        {summary}
        <div className={cn(searchResultsBodyGrid, !hasSidebar && "xl:grid-cols-1")}>
          <section className={cn(searchResultsMainColumn, "space-y-4", mainClassName)} aria-label={resultsLabel}>
            {children}
            {footer}
          </section>
          {sidebar ? <aside className={searchResultsSidebar}>{sidebar}</aside> : null}
        </div>
        {sidebarMobile}
      </div>
    </main>
  );
}
