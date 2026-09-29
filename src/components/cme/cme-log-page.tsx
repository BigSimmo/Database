"use client";

import { Check, Copy, ListFilter, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CmeDraftsSection } from "@/components/cme/cme-drafts-section";
import { CmeMissedSessionsSection } from "@/components/cme/cme-missed-sessions-section";
import { CmeQuickLog } from "@/components/cme/cme-quick-log";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { modeNumberText } from "@/components/mode-kit/type";
import { buttonFaceClass } from "@/components/ui/button";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Tabs } from "@/components/ui/tabs";
import { SearchField } from "@/components/ui/text-field";
import { cn, EmptyState, eyebrowText, InlineNotice, textMuted } from "@/components/ui-primitives";
import { formatCalendarMonthLabel, formatCmeRowDate, perthCalendarDate } from "@/lib/cme/cpd-year";
import { formatEntryForCpdHome } from "@/lib/cme/clipboard";
import type { CmeDraft } from "@/lib/cme/drafts";
import { totalAllocatedHours } from "@/lib/cme/evaluate";
import type { CmeMissedSession } from "@/lib/cme/missed-sessions";
import type { CmeRoutine } from "@/lib/cme/routines";
import {
  cmeCategories,
  cmeCertificateMissing,
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
  /** Set when the saved activity could not be linked to the missed session it was meant to replace. */
  readonly missedLinkFailed?: boolean;
  readonly demoMode?: boolean;
  /** Opens the log already narrowed to activities needing one kind of attention (from the year check). */
  readonly initialAttention?: CmeLogAttention | null;
  readonly initialCategory?: CmeCategory | null;
  /** Owner-scoped entries across years, when the route has loaded them. */
  readonly allYearsEntries?: readonly CmeEntry[];
  readonly allYearsFailed?: boolean;
  /** Saved drafts. Listed apart from the log and never counted toward hours. */
  readonly drafts?: readonly CmeDraft[];
  /** Missed teaching and supervision. Never counted toward hours. */
  readonly missedSessions?: readonly CmeMissedSession[];
  /** Drafts or missed sessions could not be read. */
  readonly recordsFailed?: boolean;
  /** Today in Perth (`YYYY-MM-DD`), so a row adds the year only to another year's date. The route passes the loader's clock. */
  readonly today?: string;
  /** The To finish address shows unfinished records without the activity filters. */
  readonly initialTab?: "activities" | "finish";
  readonly routines?: readonly CmeRoutine[];
};

/** The three things an audit asks for per activity, as log filters. */
export type CmeLogAttention = "evidence" | "reflection" | "copy";

const ATTENTION_FILTERS: readonly { value: CmeLogAttention; label: string; matches: (entry: CmeEntry) => boolean }[] = [
  { value: "evidence", label: "Missing evidence", matches: cmeCertificateMissing },
  { value: "reflection", label: "No reflection", matches: (entry) => entry.reflection.trim() === "" },
  { value: "copy", label: "Not copied", matches: (entry) => !entry.transcribed },
];

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

/** One decimal, so the hours column lines up ("1.0", "9.5"); a finer value such as 0.25 keeps its digits rather than rounding. */
function formatLogHours(hours: number): string {
  const rounded = round2(hours);
  return Number.isInteger(rounded * 10) ? rounded.toFixed(1) : String(rounded);
}

/**
 * One activity as a 52 px row in its month's hairline list (`ModeRow`: the
 * title at 500, the second line at 13 px muted): the day and the category,
 * then "No certificate" only when something is known to be missing, and the
 * hours at 400 beside the row's link. "No certificate" shows only when the log
 * has counted active certificates and found none (`cmeCertificateMissing`); an activity
 * whose evidence was not counted says nothing rather than guessing.
 */
function EntryRow({ entry, today }: { entry: CmeEntry; today: string }) {
  return (
    <ModeRow
      href={`/cme/log/${entry.id}`}
      testId={`cme-log-row-${entry.id}`}
      title={entry.title}
      subtitle={`${formatCmeRowDate(entry.date, today)} · ${categoryNames(entry)}`}
      meta={cmeCertificateMissing(entry) ? <ModeStateLabel>No certificate</ModeStateLabel> : null}
      trailing={
        // `nums font-normal` are repeated from the recipe so Task 7's scanner, which reads literal classes, sees 400.
        <span className={cn(modeNumberText, "nums font-normal pr-2 text-base-minus text-[color:var(--text)]")}>
          {entry.archivedAt ? "Archived" : `${formatLogHours(totalAllocatedHours([entry]))} h`}
        </span>
      }
    />
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
 * green from this mode outright, so a row says what is missing in grey words
 * ("No certificate") and shows no ticks: in CPD a tick appears only where
 * tapping it toggles something (spec §5).
 *
 * The closing "New entry" link stays as the standing way to reach the full
 * form, outlined: the floating "+ Log" is this page's one dark button.
 */
export function CmeLogPage({
  entries,
  set,
  navigationYears,
  justSaved = false,
  missedLinkFailed = false,
  demoMode = false,
  initialAttention = null,
  initialCategory = null,
  allYearsEntries,
  allYearsFailed = false,
  drafts = [],
  missedSessions = [],
  recordsFailed = false,
  today = perthCalendarDate(new Date()),
  initialTab = "activities",
  routines = [],
}: CmeLogPageProps) {
  const showFinish = initialTab === "finish";
  const availableYears = useMemo(() => {
    const years = new Set<number>((allYearsEntries ?? entries).map((entry) => Number(entry.date.slice(0, 4))));
    for (const year of navigationYears ?? []) years.add(year);
    years.add(set.year);
    return [...years].sort((a, b) => b - a);
  }, [entries, allYearsEntries, navigationYears, set.year]);

  const [selectedYear, setSelectedYear] = useState<number>(() =>
    availableYears.includes(set.year) ? set.year : (availableYears[0] ?? set.year),
  );
  const effectiveYear = navigationYears ? set.year : selectedYear;
  const [allYears, setAllYears] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [attention, setAttention] = useState<CmeLogAttention | null>(initialAttention);
  const attentionFilter = ATTENTION_FILTERS.find((filter) => filter.value === attention) ?? null;
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory ?? "all");
  const [copiedOverride, setCopiedOverride] = useState<Record<string, boolean>>({});
  const [lastCopiedId, setLastCopiedId] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const visibleEntries = useMemo(
    () =>
      (allYearsEntries ?? entries).map((entry) =>
        Object.hasOwn(copiedOverride, entry.id) ? { ...entry, transcribed: copiedOverride[entry.id]! } : entry,
      ),
    [allYearsEntries, entries, copiedOverride],
  );

  useEffect(() => {
    if (!lastCopiedId) return;
    const timer = window.setTimeout(() => setLastCopiedId(null), 6000);
    return () => window.clearTimeout(timer);
  }, [lastCopiedId]);

  const yearEntries = useMemo(
    () =>
      visibleEntries.filter(
        (entry) =>
          (allYears || entry.date.startsWith(`${effectiveYear}-`)) && Boolean(entry.archivedAt) === showArchived,
      ),
    [visibleEntries, effectiveYear, allYears, showArchived],
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
        (!attentionFilter || attentionFilter.matches(entry)) &&
        (categoryFilter === "all" || entry.allocations.some((allocation) => allocation.category === categoryFilter)),
    );
  }, [searched, categoryFilter, attentionFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.date.localeCompare(a.date)), [filtered]);
  const groups = useMemo(() => groupByMonth(sorted), [sorted]);

  const categoryOptions: SegmentedControlOption<CategoryFilter>[] = [
    { value: "all", label: "All" },
    ...cmeCategories.map((category) => ({ value: category, label: cmeCategoryLabels[category] })),
  ];

  async function copyNext() {
    const next = sorted.find((entry) => !entry.transcribed && !entry.archivedAt);
    if (!next || copyBusy) return;
    if (demoMode) {
      setCopyError("Sign in to copy and track activities in your private CPD record.");
      return;
    }
    setCopyBusy(true);
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(formatEntryForCpdHome(next, { ...set, year: Number(next.date.slice(0, 4)) }));
    } catch {
      setCopyError("Could not copy. Check clipboard permission and try again.");
      setCopyBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/cme/entries/${next.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcribed: true }),
      });
      if (!response.ok) throw new Error("Could not mark this activity as copied.");
      setCopiedOverride((current) => ({ ...current, [next.id]: true }));
      setLastCopiedId(next.id);
    } catch {
      setCopyError("Copied to your clipboard, but this record could not be marked as copied. Try again.");
    } finally {
      setCopyBusy(false);
    }
  }

  async function undoCopy() {
    if (!lastCopiedId || copyBusy) return;
    const copiedId = lastCopiedId;
    setCopyBusy(true);
    setCopyError(null);
    try {
      const response = await fetch(`/api/cme/entries/${copiedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcribed: false }),
      });
      if (!response.ok) throw new Error("Could not undo the copied status.");
      setCopiedOverride((current) => ({ ...current, [copiedId]: false }));
      setLastCopiedId(null);
    } catch {
      setCopyError("Could not undo the copied status. Try again.");
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <main
      data-testid="cme-log-page"
      className="mx-auto w-full max-w-3xl px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+6rem)] pt-6 sm:px-6"
    >
      <h1 className="text-xl font-semibold text-[color:var(--text)]">Log</h1>
      <p className={cn(textMuted, "mt-1 text-sm")}>Every activity you have recorded, by year.</p>
      <div role="status" data-testid="cme-log-saved">
        {justSaved ? (
          <p className="mt-3 inline-flex min-h-tap items-center gap-2 rounded-lg bg-[color:var(--clinical-accent-soft)] px-3 text-sm font-semibold text-[color:var(--clinical-accent)]">
            <Check aria-hidden="true" className="size-icon-sm" />
            Saved to your log.
          </p>
        ) : null}
        {missedLinkFailed ? (
          <div className="mt-3" data-testid="cme-log-missed-unlinked">
            <InlineNotice tone="warning">
              The activity was saved, but it could not be linked to the missed session. Link it from Missed teaching and
              supervision below.
            </InlineNotice>
          </div>
        ) : null}
      </div>
      {allYearsFailed ? (
        <p role="status" className={cn(textMuted, "mt-2 text-sm")}>
          All years could not be loaded. This year is still available.
        </p>
      ) : null}

      {!showFinish ? (
        <Sheet
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          title="Filter your log"
          placement="responsive-right"
          mobilePlacement="bottom"
          returnFocusRef={filterButtonRef}
          testId="cme-log-filter-sheet"
          footer={
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className={cn(buttonFaceClass({ variant: "primary", block: true }))}
            >
              Show {filtered.length} {filtered.length === 1 ? "activity" : "activities"}
            </button>
          }
        >
          <div className="grid gap-5 text-sm">
            <fieldset className="grid gap-2">
              <legend className={eyebrowText}>Year</legend>
              {allYearsEntries ? (
                <button
                  type="button"
                  aria-pressed={allYears}
                  onClick={() => setAllYears(true)}
                  className="min-h-tap rounded-lg border border-[color:var(--border)] px-3 text-left"
                >
                  All years · {visibleEntries.filter((entry) => Boolean(entry.archivedAt) === showArchived).length}
                </button>
              ) : null}
              {availableYears.map((year) => {
                const count = visibleEntries.filter(
                  (entry) => entry.date.startsWith(`${year}-`) && Boolean(entry.archivedAt) === showArchived,
                ).length;
                return navigationYears && year !== effectiveYear ? (
                  <Link
                    key={year}
                    href={`/cme/log?year=${year}${categoryFilter !== "all" ? `&category=${categoryFilter}` : ""}`}
                    className="flex min-h-tap items-center justify-between rounded-lg border border-[color:var(--border)] px-3"
                  >
                    <span>{year}</span>
                    <span>{count || "Open"}</span>
                  </Link>
                ) : (
                  <button
                    key={year}
                    type="button"
                    aria-pressed={!allYears && effectiveYear === year}
                    onClick={() => {
                      setAllYears(false);
                      if (!navigationYears) setSelectedYear(year);
                    }}
                    className="flex min-h-tap items-center justify-between rounded-lg border border-[color:var(--border)] px-3"
                  >
                    <span>{year}</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className={eyebrowText}>Category</legend>
              {categoryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={categoryFilter === option.value}
                  onClick={() => setCategoryFilter(option.value)}
                  className="flex min-h-tap items-center justify-between rounded-lg border border-[color:var(--border)] px-3 text-left"
                >
                  <span>{option.label}</span>
                  <span>
                    {option.value === "all"
                      ? yearEntries.length
                      : yearEntries.filter((entry) =>
                          entry.allocations.some((allocation) => allocation.category === option.value),
                        ).length}
                  </span>
                </button>
              ))}
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className={eyebrowText}>Needs attention</legend>
              <button
                type="button"
                aria-pressed={attention === null}
                onClick={() => setAttention(null)}
                className="min-h-tap rounded-lg border border-[color:var(--border)] px-3 text-left"
              >
                All activities · {yearEntries.length}
              </button>
              {ATTENTION_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={attention === filter.value}
                  onClick={() => setAttention(filter.value)}
                  className="flex min-h-tap items-center justify-between rounded-lg border border-[color:var(--border)] px-3 text-left"
                >
                  <span>{filter.label}</span>
                  <span>{yearEntries.filter(filter.matches).length}</span>
                </button>
              ))}
            </fieldset>
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((value) => !value)}
              className="min-h-tap rounded-lg border border-[color:var(--border)] px-3 text-left"
            >
              {showArchived ? "Showing archived activities" : "Show archived activities"}
            </button>
          </div>
        </Sheet>
      ) : null}

      {showFinish ? (
        <>
          <section className="mt-5" aria-labelledby="cme-attention-heading">
            <h2 id="cme-attention-heading" className={eyebrowText}>
              Activities needing attention
            </h2>
            <ul className="mt-2 divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-4">
              {ATTENTION_FILTERS.map((filter) => {
                const count = yearEntries.filter(filter.matches).length;
                if (!count) return null;
                const href =
                  filter.value === "copy"
                    ? `/cme/log?year=${effectiveYear}&copy=todo`
                    : `/cme/log?year=${effectiveYear}&fix=${filter.value}`;
                return (
                  <li key={filter.value}>
                    <Link
                      href={href}
                      className="flex min-h-tap items-center justify-between gap-3 py-2 text-sm text-[color:var(--text)]"
                    >
                      <span>{filter.label}</span>
                      <span className={textMuted}>{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <div id="cme-drafts" className="mt-5">
            <CmeDraftsSection drafts={drafts} demoMode={demoMode} loadFailed={recordsFailed} />
          </div>
        </>
      ) : null}

      {!showFinish ? (
        <>
          {navigationYears && navigationYears.length > 1 ? (
            <nav aria-label="Select year" data-testid="cme-log-year-tabs" className="mt-4 flex flex-wrap gap-2">
              {[...new Set(navigationYears)]
                .sort((a, b) => b - a)
                .map((year) => (
                  <Link
                    key={year}
                    href={`/cme/log?year=${year}${categoryFilter !== "all" ? `&category=${categoryFilter}` : ""}`}
                    aria-current={!allYears && year === effectiveYear ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-tap items-center rounded-lg border px-4 text-sm font-semibold",
                      !allYears && year === effectiveYear
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setFilterOpen(true)}
              data-testid="cme-log-open-filters"
              className={buttonFaceClass({ variant: "secondary" })}
            >
              <ListFilter aria-hidden="true" className="size-icon-sm" />
              Filters
            </button>
            {attention === "copy" && !showArchived ? (
              <button
                type="button"
                onClick={() => void copyNext()}
                disabled={copyBusy || !sorted.some((entry) => !entry.transcribed)}
                data-testid="cme-log-copy-next"
                className={buttonFaceClass({ variant: "primary" })}
              >
                <Copy aria-hidden="true" className="size-icon-sm" />
                {copyBusy ? "Copying…" : "Copy next"}
              </button>
            ) : null}
          </div>
          {attention === "copy" && lastCopiedId ? (
            <div
              role="status"
              data-testid="cme-log-copy-done"
              className="mt-2 flex flex-wrap items-center gap-2 text-sm"
            >
              <span>Copied to your clipboard and marked copied.</span>
              <button
                type="button"
                disabled={copyBusy}
                onClick={() => void undoCopy()}
                className="min-h-tap font-semibold underline underline-offset-2"
              >
                Undo
              </button>
            </div>
          ) : null}
          {copyError ? (
            <p role="alert" className="mt-2 text-sm">
              {copyError}
            </p>
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
          {!showArchived ? (
            <div
              role="group"
              aria-label="Needs attention"
              data-testid="cme-log-attention"
              className="mt-3 flex flex-wrap gap-2"
            >
              {ATTENTION_FILTERS.map((filter) => {
                const count = yearEntries.filter(filter.matches).length;
                const pressed = attention === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={pressed}
                    data-testid={`cme-log-attention-${filter.value}`}
                    onClick={() => setAttention(pressed ? null : filter.value)}
                    className={cn(
                      "inline-flex min-h-tap items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold",
                      pressed
                        ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                        : "border-[color:var(--border)] text-[color:var(--text)]",
                    )}
                  >
                    {filter.label}
                    <span className="nums text-xs font-normal opacity-80">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {attention === "copy" ? (
            <p className={cn(textMuted, "mt-2 text-sm")} data-testid="cme-log-copy-help">
              Open each one and tap <span className="font-semibold">Copy for your CPD home</span>, then paste it into
              your CPD home&rsquo;s own record. Each is ticked off here as you copy it.
            </p>
          ) : null}
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
                  className="grid gap-2"
                >
                  <div className="flex items-baseline justify-between gap-3 px-3">
                    <h2 id={`${group.key}-heading`} className={eyebrowText}>
                      {group.label}
                    </h2>
                    <span
                      className={cn(
                        modeNumberText,
                        "nums font-normal text-2xs normal-case text-[color:var(--text-muted)]",
                      )}
                    >
                      {`${formatLogHours(group.hours)} h`}
                    </span>
                  </div>
                  <ModeGroupedList>
                    {group.entries.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} today={today} />
                    ))}
                  </ModeGroupedList>
                </section>
              ))
            )}
          </div>

          <div className="mt-6 flex justify-center">
            <Link
              href={`/cme/new?year=${set.year}`}
              data-testid="cme-log-new-entry"
              className={cn(buttonFaceClass({ variant: "secondary" }))}
            >
              <Plus aria-hidden="true" className="size-icon-md shrink-0" />
              <span>New entry</span>
            </Link>
          </div>
        </>
      ) : null}
      {showFinish ? (
        <div className="mt-8">
          <CmeMissedSessionsSection
            sessions={missedSessions}
            entries={entries
              .filter((entry) => !entry.archivedAt)
              .map((entry) => ({ id: entry.id, title: entry.title, date: entry.date }))}
            state={recordsFailed ? "load-failed" : "ready"}
            demoMode={demoMode}
          />
        </div>
      ) : null}
      {!showFinish && set.totalHours > 0 && !set.closedAt ? (
        <CmeQuickLog set={set} entries={entries} routines={routines} demoMode={demoMode} />
      ) : null}
    </main>
  );
}
