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
}) {
  const hasSidebar = Boolean(sidebar);

  return (
    <main
      data-testid={testId}
      className={cn(searchPageShell, canvasClassName ?? searchPageCanvas, className)}
    >
      <div className={cn(searchPageContainer, "grid gap-4")}>
        {header}
        {summary}
        <div className={cn(searchResultsBodyGrid, !hasSidebar && "xl:grid-cols-1")}>
          <section
            className={cn(searchResultsMainColumn, "space-y-4", mainClassName)}
            aria-label={resultsLabel}
          >
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
