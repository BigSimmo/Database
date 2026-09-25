"use client";

import { Check, ChevronRight, Paperclip, Plus, Repeat } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { cardInteractive, focusRing, stretchedRowLinkClass } from "@/components/card-recipes";
import { CmeQuickLog } from "@/components/cme/cme-quick-log";
import { buttonFaceClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import { SearchField } from "@/components/ui/text-field";
import { cn, EmptyState, eyebrowText, textMuted } from "@/components/ui-primitives";
import { formatCalendarDateShort, formatCalendarMonthLabel } from "@/lib/cme/cpd-year";
import { totalAllocatedHours } from "@/lib/cme/evaluate";
import {
  cmeCategories,
  cmeCategoryLabels,
  type CmeCategory,
  type CmeEntry,
  type CmeRequirementSet,
} from "@/lib/cme/types";

export type CmeLogPageProps = {
  /** Every entry the owner has recorded, any year — loaded from the owner-scoped API / repository. */
  readonly entries: readonly CmeEntry[];
  /** The confirmed programme — only its `year` is required for the year tabs. */
  readonly set: CmeRequirementSet;
  /** Server-backed year destinations. Omit in isolated component tests with a multi-year entry fixture. */
  readonly navigationYears?: readonly number[];
  /** Set by the new-entry page after a save, so the owner sees it landed. */
  readonly justSaved?: boolean;
  readonly demoMode?: boolean;
};

type CategoryFilter = "all" | CmeCategory;

type MonthGroup = {
  readonly key: string;
  readonly label: string;
  readonly hours: number;
  readonly entries: readonly CmeEntry[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The distinct category labels an entry's allocations touch, in canonical order. */
function categoryNames(entry: CmeEntry): string {
  const present = new Set(entry.allocations.map((allocation) => allocation.category));
  return cmeCategories
    .filter((category) => present.has(category))
    .map((category) => cmeCategoryLabels[category])
    .join(" + ");
}

/**
 * Most-recent-month-first groups over an already-filtered, already-sorted
 * list. Grouping — never a chip that hides the other months — is the same
 * choice `onCallEntryGroups` documents for On Call: a reader wants to GET to
 * August, not have July and September removed from the screen while they
 * look at it. The category chip row above filters across these groups
 * instead of duplicating them, which is why the two coexist here without the
 * problem that got the On Call chip row removed.
 */
function groupByMonth(entries: readonly CmeEntry[]): MonthGroup[] {
  const byMonth = new Map<string, CmeEntry[]>();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const existing = byMonth.get(key);
    if (existing) existing.push(entry);
    else byMonth.set(key, [entry]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, monthEntries]) => ({
      key,
      label: formatCalendarMonthLabel(key),
      hours: round2(totalAllocatedHours(monthEntries)),
      entries: monthEntries,
    }));
}

function EntryRow({ entry }: { entry: CmeEntry }) {
  return (
    <li className="relative">
      <div className={cn(cardInteractive, "flex items-center gap-3 p-3")}>
        <Link
          href={`/cme/log/${entry.id}`}
          data-testid={`cme-log-row-${entry.id}`}
          className={cn(
            "flex min-h-tap min-w-0 flex-1 flex-col justify-center",
            stretchedRowLinkClass,
            focusRing,
            "rounded-md",
          )}
        >
          <span className="line-clamp-2 text-sm font-semibold text-[color:var(--text)]">{entry.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[color:var(--text-muted)]">
            <span>{formatCalendarDateShort(entry.date)}</span>
            <span aria-hidden="true">·</span>
            <span>{categoryNames(entry)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {entry.evidenceCount ?? 0} evidence file{entry.evidenceCount === 1 ? "" : "s"}
            </span>
            {entry.documentId ? (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip aria-hidden="true" className="size-icon-xs" />
                Source link
              </span>
            ) : null}
            {entry.transcribed ? (
              <span className="inline-flex items-center gap-0.5">
                <Check aria-hidden="true" className="size-icon-xs" />
                Copied
              </span>
            ) : null}
          </span>
          {entry.routineId ? (
            <span className="mt-1.5 inline-flex">
              <Chip size="compact" icon={Repeat} appearance={{ kind: "information", tone: "accent" }}>
                Routine
              </Chip>
            </span>
          ) : null}
        </Link>
        {/* Decoration beside the anchor above, not inside it, and deliberately
            NOT given `relative z-10`: card-recipes.ts reserves that lift for a
            row's OTHER controls, and these two are plain display, not a
            second target. Left as ordinary static content, they paint under
            the anchor's stretched `::after` layer, so a tap here still
            activates the same one link the title does — the whole card is
            one tap target, not a title-shaped tap target beside a dead strip. */}
        <span className="shrink-0 text-right text-sm font-bold tabular-nums text-[color:var(--text-heading)]">
          {entry.archivedAt ? "Archived" : `${totalAllocatedHours([entry])} h`}
        </span>
        <ChevronRight aria-hidden="true" className={cn("size-icon-sm shrink-0", textMuted)} />
      </div>
    </li>
  );
}

/**
 * LOG — every activity the owner has recorded, by year.
 *
 * Year tabs (`Tabs`, real view-switching semantics — a different year is a
 * different panel of data, not a sort order) sit above a search field over
 * titles and reflections and a category filter row (`SegmentedControl`,
 * per COMPONENTS.md §9.18 — a filter over an already-visible list is a
 * one-of-many choice, never `Tabs`). Entries below are grouped by month,
 * most recent first; each row is a single link to its own entry screen
 * (`/cme/log/[id]`), because that screen carries the control this mode's
 * owner presses most.
 *
 * **No colour carries status here.** Design decision §12 bans red, amber and
 * green from this mode outright — including for "not transcribed yet" — so
 * the evidence and portal ticks are plain neutral text-plus-icon, shown only
 * when true, exactly like `docs/cme/design/prototypes/cme-screens.html`'s
 * "two small ticks per row" and never recoloured for their absent state.
 *
 * The closing "New entry" action is the same call to action every board in
 * the design study carries as its primary control — kept here as the
 * standing way to add to the log, not only something reached from the
 * dashboard.
 */
export function CmeLogPage({ entries, set, navigationYears, justSaved = false, demoMode = false }: CmeLogPageProps) {
  const availableYears = useMemo(() => {
    const years = new Set<number>(entries.map((entry) => Number(entry.date.slice(0, 4))));
    years.add(set.year);
    return [...years].sort((a, b) => b - a);
  }, [entries, set.year]);

  const [selectedYear, setSelectedYear] = useState<number>(() =>
    availableYears.includes(set.year) ? set.year : (availableYears[0] ?? set.year),
  );
  const effectiveYear = navigationYears ? set.year : selectedYear;
  const [missingEvidence, setMissingEvidence] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const yearEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.date.startsWith(`${effectiveYear}-`) && Boolean(entry.archivedAt) === showArchived,
      ),
    [entries, effectiveYear, showArchived],
  );

  const trimmedQuery = query.trim().toLowerCase();
  const searched = useMemo(() => {
    if (trimmedQuery.length === 0) return yearEntries;
    return yearEntries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(trimmedQuery) || entry.reflection.toLowerCase().includes(trimmedQuery),
    );
  }, [yearEntries, trimmedQuery]);

  const filtered = useMemo(() => {
    return searched.filter(
      (entry) =>
        (!missingEvidence || (entry.evidenceCount ?? 0) === 0) &&
        (categoryFilter === "all" || entry.allocations.some((allocation) => allocation.category === categoryFilter)),
    );
  }, [searched, categoryFilter, missingEvidence]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.date.localeCompare(a.date)), [filtered]);
  const groups = useMemo(() => groupByMonth(sorted), [sorted]);

  const categoryOptions: SegmentedControlOption<CategoryFilter>[] = [
    { value: "all", label: "All" },
    ...cmeCategories.map((category) => ({ value: category, label: cmeCategoryLabels[category] })),
  ];

  return (
    <main data-testid="cme-log-page" className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Log</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>Every activity you have recorded, by year.</p>
      <div role="status" data-testid="cme-log-saved">
        {justSaved ? (
          <p className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-semibold text-[color:var(--clinical-accent)]">
            <Check aria-hidden="true" className="size-icon-sm" />
            Saved to your log.
          </p>
        ) : null}
      </div>

      {navigationYears && navigationYears.length > 1 ? (
        <nav aria-label="Select year" data-testid="cme-log-year-tabs" className="mt-4 flex flex-wrap gap-2">
          {[...new Set(navigationYears)]
            .sort((a, b) => b - a)
            .map((year) => (
              <Link
                key={year}
                href={`/cme/log?year=${year}`}
                aria-current={year === set.year ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-tap items-center rounded-lg border px-4 text-sm font-semibold",
                  year === set.year
                    ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                    : "border-[color:var(--border)] text-[color:var(--text)]",
                )}
              >
                {year}
              </Link>
            ))}
        </nav>
      ) : availableYears.length > 1 ? (
        <div data-testid="cme-log-year-tabs" className="mt-4">
          <Tabs
            label="Select year"
            items={availableYears.map((year) => ({ id: String(year), label: String(year) }))}
            value={String(selectedYear)}
            onChange={(id) => setSelectedYear(Number(id))}
          />
        </div>
      ) : null}

      {navigationYears ? (
        <form
          action="/cme/log"
          method="get"
          className="mt-3 flex flex-wrap items-end gap-2"
          data-testid="cme-log-year-jump"
        >
          <label className="text-sm font-medium text-[color:var(--text)]" htmlFor="cme-log-year-input">
            Open another year
            <input
              key={set.year}
              id="cme-log-year-input"
              name="year"
              type="number"
              min="2000"
              max="2100"
              defaultValue={set.year}
              className="mt-1 block min-h-tap w-32 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-tap items-center rounded-lg border border-[color:var(--border)] px-4 text-sm font-semibold text-[color:var(--text)]"
          >
            Open year
          </button>
        </form>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className="min-h-tap rounded-lg border border-[color:var(--border)] px-3"
          aria-pressed={showArchived}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Show active entries" : "Show archived entries"}
        </button>
        <button
          type="button"
          className="min-h-tap rounded-lg border border-[color:var(--border)] px-3"
          aria-pressed={missingEvidence}
          onClick={() => setMissingEvidence(!missingEvidence)}
        >
          Missing evidence
        </button>
        <a
          href={`/api/cme/export?year=${effectiveYear}`}
          download
          className="min-h-tap inline-flex items-center font-semibold text-[color:var(--clinical-accent)]"
        >
          Download CSV
        </a>
        <Link
          href={`/cme/summary?year=${effectiveYear}`}
          className="min-h-tap inline-flex items-center font-semibold text-[color:var(--clinical-accent)]"
        >
          Annual summary
        </Link>
      </div>
      {showArchived ? (
        <p className={cn(textMuted, "mt-2 text-sm")}>
          Archived entries retain their records and evidence. They contribute zero to totals, downloads and annual
          summaries. Open an entry to restore it.
        </p>
      ) : null}
      <div data-testid="cme-log-search" className="mt-4">
        <SearchField
          label="Search your log"
          placeholder="Search titles and reflections"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          clearLabel="Clear the log search"
        />
      </div>

      {yearEntries.length > 0 ? (
        <div data-testid="cme-log-filter" className="mt-3">
          <SegmentedControl
            label="Filter by category"
            options={categoryOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-5">
        {groups.length === 0 ? (
          <EmptyState
            testId="cme-log-empty"
            title={
              yearEntries.length === 0
                ? `Nothing logged for ${effectiveYear} yet.`
                : "Nothing matched your search and filter."
            }
            body={
              yearEntries.length === 0
                ? "Log your first activity for this year to see it here."
                : "Try a shorter word, or clear the category filter."
            }
          />
        ) : (
          groups.map((group) => (
            <section
              key={group.key}
              data-testid={`cme-log-month-${group.key}`}
              aria-labelledby={`${group.key}-heading`}
            >
              <h2 id={`${group.key}-heading`} className={cn(eyebrowText, "mb-2 flex items-baseline justify-between")}>
                <span>{group.label}</span>
                <span className="tabular-nums">{group.hours} h</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {group.entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <Link
          href={`/cme/new?year=${set.year}`}
          data-testid="cme-log-new-entry"
          className={cn(buttonFaceClass({ variant: "primary" }))}
        >
          <Plus aria-hidden="true" className="size-icon-md shrink-0" />
          <span>New entry</span>
        </Link>
      </div>
      {set.totalHours > 0 ? <CmeQuickLog set={set} demoMode={demoMode} /> : null}
    </main>
  );
}
