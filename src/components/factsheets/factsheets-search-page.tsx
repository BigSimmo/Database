"use client";

import Link from "next/link";
import { ChevronRight, Info, LayoutGrid, List, SearchX } from "lucide-react";
import { useState } from "react";

import {
  categoryTheme,
  factsheetCategories,
  type Factsheet,
  type FactsheetCategory,
} from "@/components/factsheets/factsheets-data";
import { factsheetGlyph } from "@/components/factsheets/factsheets-icons";
import { cn } from "@/components/ui-primitives";

type ViewMode = "list" | "cards";

function searchHref(query: string, category?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  const suffix = params.toString();
  return suffix ? `/factsheets/search?${suffix}` : "/factsheets/search";
}

const filterChips: Array<{ key?: FactsheetCategory; label: string }> = [
  { key: undefined, label: "All" },
  ...factsheetCategories.map((category) => ({ key: category, label: category })),
];

export function FactsheetsSearchPage({
  query,
  category,
  results,
}: {
  query: string;
  category?: string;
  results: Factsheet[];
}) {
  const [view, setView] = useState<ViewMode>("list");
  const activeCategory = factsheetCategories.find((entry) => entry === category);

  const resultLine = query
    ? `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”${
        activeCategory ? ` in ${activeCategory}` : ""
      }`
    : `${results.length} factsheet${results.length === 1 ? "" : "s"}${activeCategory ? ` in ${activeCategory}` : ""}`;

  return (
    <div
      data-testid="factsheets-search-page"
      className="mx-auto w-full max-w-[64rem] px-4 py-6 pb-4 sm:px-6 sm:py-8 lg:px-8"
    >
      <p className="text-2xs font-bold uppercase tracking-[0.06em] text-[color:var(--clinical-accent)]">Find a sheet</p>
      <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">
        Search patient information
      </h1>

      <section aria-label="Filter by category" className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold text-[color:var(--text-soft)]">Filter:</span>
        {filterChips.map((chip) => {
          const isActive = chip.key ? activeCategory === chip.key : !activeCategory;
          return (
            <Link
              key={chip.label}
              href={searchHref(query, chip.key)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "inline-flex min-h-tap items-center rounded-lg border px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                isActive
                  ? "border-transparent bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
              )}
            >
              {chip.label}
            </Link>
          );
        })}
      </section>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm-minus font-medium text-[color:var(--text-muted)]">{resultLine}</p>
        <div
          role="group"
          aria-label="Result view"
          className="inline-flex gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-1"
        >
          {(["list", "cards"] as const).map((mode) => {
            const isActive = view === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                  isActive
                    ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-tight)]"
                    : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                )}
              >
                {mode === "list" ? (
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      {results.length === 0 ? (
        <section className="mt-4 grid justify-items-center gap-3 rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-inset)] px-4 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-soft)]">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-bold text-[color:var(--text-heading)]">No factsheets found</p>
            <p className="mt-1 text-sm-minus font-medium text-[color:var(--text-muted)]">
              Try a broader topic, or browse the full library.
            </p>
          </div>
          <Link
            href="/factsheets/search"
            className="inline-flex min-h-tap items-center rounded-lg bg-[color:var(--command)] px-4 text-sm font-bold text-[color:var(--command-contrast)] shadow-[var(--shadow-tight)] transition hover:bg-[color:var(--command-hover)]"
          >
            Browse sheets
          </Link>
        </section>
      ) : view === "list" ? (
        <section
          aria-label="Factsheet results"
          className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          {results.map((sheet) => {
            const theme = categoryTheme(sheet.category);
            return (
              <Link
                key={sheet.slug}
                href={`/factsheets/${sheet.slug}`}
                data-testid="factsheets-result"
                className="group flex items-start gap-3.5 border-b border-[color:var(--border)] px-4 py-4 transition last:border-b-0 hover:bg-[color:var(--surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]"
              >
                <span
                  className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: theme.soft, color: theme.accent }}
                >
                  {factsheetGlyph(sheet.icon, "h-5 w-5")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base-minus font-bold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                      {sheet.title}
                      {sheet.brand ? (
                        <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span>
                      ) : null}
                    </span>
                    <span
                      className="rounded-md px-2 py-0.5 text-2xs font-bold"
                      style={{ backgroundColor: theme.soft, color: theme.accent }}
                    >
                      {sheet.category}
                    </span>
                  </span>
                  <span className="mt-1 block max-w-2xl text-pretty text-sm-minus leading-5 text-[color:var(--text-muted)]">
                    {sheet.summary}
                  </span>
                  <span className="mt-2 block text-xs font-bold text-[color:var(--text-soft)]">
                    {sheet.audience} · {sheet.readTime}
                  </span>
                </span>
                <ChevronRight
                  className="h-5 w-5 shrink-0 self-center text-[color:var(--text-soft)] transition group-hover:text-[color:var(--clinical-accent)]"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </section>
      ) : (
        <section aria-label="Factsheet results" className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {results.map((sheet) => {
            const theme = categoryTheme(sheet.category);
            return (
              <Link
                key={sheet.slug}
                href={`/factsheets/${sheet.slug}`}
                data-testid="factsheets-result"
                className="group flex flex-col rounded-xl border border-[color:var(--border)] border-t-[3px] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
                style={{ borderTopColor: theme.accent }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl"
                    style={{ backgroundColor: theme.soft, color: theme.accent }}
                  >
                    {factsheetGlyph(sheet.icon, "h-5 w-5")}
                  </span>
                  <span
                    className="rounded-md px-2 py-1 text-2xs font-bold"
                    style={{ backgroundColor: theme.soft, color: theme.accent }}
                  >
                    {sheet.category}
                  </span>
                </div>
                <h3 className="mt-3.5 text-base-minus font-bold text-[color:var(--text-heading)] group-hover:text-[color:var(--clinical-accent)]">
                  {sheet.title}
                  {sheet.brand ? (
                    <span className="font-medium text-[color:var(--text-muted)]"> {sheet.brand}</span>
                  ) : null}
                </h3>
                <p className="mt-2 flex-1 text-pretty text-sm-minus leading-5 text-[color:var(--text-muted)]">
                  {sheet.summary}
                </p>
                <p className="mt-3.5 text-xs font-bold text-[color:var(--text-soft)]">
                  {sheet.audience} · {sheet.readTime}
                </p>
              </Link>
            );
          })}
        </section>
      )}

      <aside className="mt-5 flex gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" aria-hidden="true" />
        <p className="text-sm-minus leading-5 text-[color:var(--text-muted)]">
          <strong className="font-bold text-[color:var(--text-heading)]">Content status:</strong> These sheets are dated
          demonstration content with public source links. Connect only governance-approved patient information before
          publication.
        </p>
      </aside>
    </div>
  );
}
