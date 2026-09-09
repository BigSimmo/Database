"use client";

import { useCallback, useState } from "react";
import { ArrowUpRight, Check, CornerDownLeft, Search, Sparkles, X } from "lucide-react";

import { AnswerSuggestionChips } from "@/components/clinical-dashboard/answer-suggestion-chips";
import { cn } from "@/components/ui-primitives";
import {
  ActiveFilterPill,
  CommitButton,
  FACET_GROUPS,
  FacetGroupsBody,
  focusRing,
  PhoneSheetShell,
  PRESETS,
  ResultsBand,
  ResultsPreview,
  SERVICE_TOTAL,
  useFacetCounts,
} from "@/components/services-filter-refined-mockups";

/**
 * Three options along the recommended path for the services filter surface.
 *
 * This is the follow-up to `/mockups/services-filter-refined`, and it is NOT a
 * re-run of directions A/B/C. Asked which of those three to build, the answer
 * was a sequence rather than a winner, plus one bolder possibility flagged as a
 * product judgement rather than a design one. These are those three threads,
 * drawn so they can be compared directly:
 *
 *   1 · Stop the bleed  — no filtering at all. The only option that could ship
 *       this week, because it needs no new state. It exists to end the silent
 *       data loss: today a preset replaces your query with no warning and no
 *       undo, and you only discover it after the results have gone.
 *   2 · The recommendation — direction A's facet structure plus direction B's
 *       persistent active-filter row. What the previous study concluded should
 *       actually be built.
 *   3 · Presets evicted — the sheet becomes purely a filter and the six presets
 *       relocate to the composer as suggested searches. Removes the two-verbs
 *       problem at the root instead of signposting it, and pays for that in
 *       discoverability.
 *
 * The facet engine, chips, band and sheet shell are imported from the first
 * study rather than copied. That is deliberate on two counts: the ~1KB bitmask
 * table would otherwise be duplicated against a finite `mockups` bundle budget,
 * and two studies quoting different numbers for the same catalogue would
 * discredit both. Mockup-to-mockup imports are permitted; only production
 * source is barred from importing `*-mockups`.
 *
 * Sizing note: these render a 390px phone frame inside a wide page, so viewport
 * `sm:` variants would resolve against the page rather than the frame. Every
 * component takes an explicit `compact` flag instead.
 */

/* ------------------------------------------------------------------------- */
/* Option 1 — Stop the bleed                                                  */
/* ------------------------------------------------------------------------- */

const CURRENT_QUERY = "lithium level timing";
const CURRENT_COUNT = 16;

/** The exact query string each preset writes, quoted from `serviceQuickFilters`. */
const PRESET_QUERIES: Record<string, string> = {
  "best-fit": "13YARN crisis Aboriginal Torres Strait Islander phone",
  crisis: "crisis",
  "culturally-safe": "Aboriginal Torres Strait Islander",
  phone: "phone referral",
  free: "free",
  wa: "WA",
};

function ShortcutRow({ preset, compact }: { preset: (typeof PRESETS)[number]; compact: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        /* Comp only — the real control navigates and replaces the query. */
      }}
      className={cn(
        "group flex w-full min-w-0 items-center gap-2.5 rounded-lg border border-transparent px-2.5 text-left transition",
        "hover:border-[color:var(--border)] hover:bg-[color:var(--surface-subtle)]",
        compact ? "min-h-tap" : "min-h-11",
        focusRing,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-2xs font-bold text-[color:var(--text)]">{preset.label}</span>
        {/* The literal query, in mono. The reader can see exactly what replaces
            what before committing — which is the whole fix in this option. */}
        <span className="block truncate font-mono text-3xs font-medium text-[color:var(--text-soft)]">
          searches “{PRESET_QUERIES[preset.id]}”
        </span>
      </span>
      <ArrowUpRight
        aria-hidden
        className="size-icon-sm shrink-0 text-[color:var(--text-soft)] group-hover:text-[color:var(--clinical-accent)]"
      />
    </button>
  );
}

/** The current search, shown as the thing you would lose. */
function CurrentSearchRow({ compact }: { compact: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-[color:var(--clinical-accent)]/35 bg-[color:var(--clinical-accent-soft)] px-2.5",
        compact ? "min-h-tap" : "min-h-11",
      )}
    >
      <Check aria-hidden className="size-icon-sm shrink-0 text-[color:var(--clinical-accent)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-2xs font-bold text-[color:var(--clinical-accent)]">
          Staying on “{CURRENT_QUERY}”
        </span>
        <span className="block truncate text-3xs font-medium text-[color:var(--clinical-accent)]/80">
          {CURRENT_COUNT} services · anything below replaces this
        </span>
      </span>
    </div>
  );
}

function OptionOne({ compact }: { compact: boolean }) {
  const shortcuts = (
    <>
      <CurrentSearchRow compact={compact} />
      <div className="mt-2 flex min-h-7 items-center gap-1.5">
        <ArrowUpRight aria-hidden className="size-icon-sm shrink-0 text-[color:var(--text-soft)]" />
        <h5 className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          Run a different search
        </h5>
      </div>
      <div className="grid">
        {PRESETS.map((preset) => (
          <ShortcutRow key={preset.id} preset={preset} compact={compact} />
        ))}
      </div>
    </>
  );

  if (compact) {
    return (
      <div className="relative h-[34rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
        <ResultsBand
          compact
          count={CURRENT_COUNT}
          query={CURRENT_QUERY}
          activeCount={0}
          onOpen={() => {}}
          variant="trigger"
        />
        <ResultsPreview compact count={CURRENT_COUNT} />
        <PhoneSheetShell
          title="Search shortcuts"
          description="Each one runs a new search and replaces what you have now."
          footer={
            <button
              type="button"
              onClick={() => {
                /* Comp only — dismisses without touching the query. */
              }}
              className={cn(
                "inline-flex min-h-tap w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--clinical-accent)] px-3 text-xs font-extrabold text-white",
                focusRing,
              )}
            >
              <CornerDownLeft aria-hidden className="size-icon-sm" />
              Keep “{CURRENT_QUERY}”
            </button>
          }
        >
          {shortcuts}
        </PhoneSheetShell>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="flex min-h-12 items-center gap-2 px-2.5">
          <span className="min-w-0 flex-1 truncate">
            <span className="nums text-sm font-extrabold tabular-nums text-[color:var(--text-heading)]">
              {CURRENT_COUNT}
            </span>{" "}
            <span className="text-xs font-bold text-[color:var(--text-muted)]">services</span>
            <span className="text-xs font-medium text-[color:var(--text-soft)]"> · {CURRENT_QUERY}</span>
          </span>
        </div>
        {/* The shipped desktop rail keeps its shape; only the labelling becomes
            honest. "Quick filters" implied these narrow the 16 above. */}
        <div className="flex items-center gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
            <ArrowUpRight aria-hidden className="size-icon-sm text-[color:var(--decoration-soft)]" />
            Runs a new search
          </span>
          <div className="polished-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={`Searches “${PRESET_QUERIES[preset.id]}” — replaces the current search`}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-bold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                  focusRing,
                )}
              >
                {preset.label}
                <ArrowUpRight aria-hidden className="size-icon-xs shrink-0 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <ResultsPreview compact={false} count={CURRENT_COUNT} />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Option 2 — The recommendation (A's facets + B's persistent pill row)       */
/* ------------------------------------------------------------------------- */

function OptionTwo({
  compact,
  selected,
  onToggle,
  onClear,
}: {
  compact: boolean;
  selected: ReadonlySet<string>;
  onToggle: (facetId: string) => void;
  onClear: () => void;
}) {
  const counts = useFacetCounts(selected);
  const ordered = FACET_GROUPS.flatMap((group) => group.facets.filter((facet) => selected.has(facet.id)));

  // Phone shows the sheet OPEN — the facets, counts and commit.
  if (compact) {
    return (
      <div className="relative h-[34rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
        <ResultsBand
          compact
          count={counts.total}
          query="all services"
          activeCount={selected.size}
          onOpen={() => {}}
          variant="trigger"
        />
        <ResultsPreview compact count={counts.total} />
        <PhoneSheetShell
          title="Refine services"
          description={`${counts.total} of ${SERVICE_TOTAL} in the catalogue`}
          onClear={selected.size > 0 ? onClear : undefined}
          footer={<CommitButton count={counts.total} compact disabled={counts.total === 0} />}
        >
          <FacetGroupsBody selected={selected} counts={counts} onToggle={onToggle} compact />
          <div className="my-2.5 border-t border-[color:var(--border)]" />
          <div className="flex min-h-7 items-center gap-1.5">
            <ArrowUpRight aria-hidden className="size-icon-sm shrink-0 text-[color:var(--text-soft)]" />
            <h5 className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
              Start a new search
            </h5>
          </div>
          <div className="grid">
            {PRESETS.slice(0, 3).map((preset) => (
              <ShortcutRow key={preset.id} preset={preset} compact />
            ))}
          </div>
        </PhoneSheetShell>
      </div>
    );
  }

  // Desktop shows the sheet CLOSED, which is the half B is arguing for: the
  // refinement stays legible with nothing open.
  return (
    <div className="grid gap-3">
      <ResultsBand
        compact={false}
        count={counts.total}
        query="all services"
        activeCount={selected.size}
        onOpen={() => {}}
        variant="rail"
      >
        {selected.size > 0 ? (
          <div className="flex items-center gap-1.5 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1.5">
            <span className="shrink-0 text-3xs font-black uppercase tracking-eyebrow text-[color:var(--text-muted)]">
              Filtered by
            </span>
            <div className="polished-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {ordered.map((facet) => (
                <ActiveFilterPill
                  key={facet.id}
                  facetId={facet.id}
                  compact={false}
                  onRemove={() => onToggle(facet.id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onClear}
              className={cn(
                "min-h-7 shrink-0 rounded-lg px-2 text-3xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                focusRing,
              )}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </ResultsBand>
      <ResultsPreview compact={false} count={counts.total} />
      <p className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] px-2.5 py-2 text-3xs font-semibold text-[color:var(--text-soft)]">
        Sheet closed. Without the pill row above, the only trace of{" "}
        <span className="font-bold text-[color:var(--text-muted)]">{selected.size || "any"}</span> active{" "}
        {selected.size === 1 ? "filter" : "filters"} would be a badge count on the trigger.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Option 3 — Presets evicted                                                 */
/* ------------------------------------------------------------------------- */

/**
 * A services composer with the six presets living beside it as suggestions.
 *
 * The chips here are deliberately `AnswerSuggestionChips` — a production
 * component (`clinical-dashboard/answer-suggestion-chips.tsx`) whose own prop
 * docs describe `labelPlacement="inline"` as being for "composer rows, empty
 * state". So this option needs no new component: the presets stop being fake
 * filters and become what they always were, suggested searches, in the surface
 * that already exists for suggested searches.
 */
function ComposerWithSuggestions({ compact }: { compact: boolean }) {
  return (
    <div className="grid gap-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] px-3 shadow-[var(--e2)]",
          compact ? "min-h-14" : "min-h-12",
        )}
      >
        <Search aria-hidden className="size-icon-md shrink-0 text-[color:var(--text-soft)]" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--text-soft)]">
          Search services…
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-lg bg-[color:var(--clinical-accent)] px-2.5 text-2xs font-extrabold text-white",
            compact ? "min-h-10" : "min-h-9",
          )}
        >
          Search
        </span>
      </div>
      <AnswerSuggestionChips
        label="Try"
        labelPlacement={compact ? "above" : "inline"}
        layout={compact ? "wrap" : "scroll"}
        icon={Sparkles}
        suggestions={PRESETS.map((preset) => preset.label)}
        onPick={() => {
          /* Comp only — the real chip writes the query into the composer. */
        }}
      />
    </div>
  );
}

function OptionThree({
  compact,
  selected,
  onToggle,
  onClear,
}: {
  compact: boolean;
  selected: ReadonlySet<string>;
  onToggle: (facetId: string) => void;
  onClear: () => void;
}) {
  const counts = useFacetCounts(selected);

  if (compact) {
    return (
      <div className="relative h-[38rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2.5">
        <ComposerWithSuggestions compact />
        <div className="mt-2">
          <ResultsBand
            compact
            count={counts.total}
            query="all services"
            activeCount={selected.size}
            onOpen={() => {}}
            variant="trigger"
          />
        </div>
        {/* The sheet with no preset block at all — visibly shorter, and every
            control in it does the same kind of thing. */}
        <PhoneSheetShell
          maxHeight="max-h-[56%]"
          title="Filter services"
          description={`${counts.total} of ${SERVICE_TOTAL} match`}
          onClear={selected.size > 0 ? onClear : undefined}
          footer={<CommitButton count={counts.total} compact disabled={counts.total === 0} />}
        >
          <FacetGroupsBody selected={selected} counts={counts} onToggle={onToggle} compact />
        </PhoneSheetShell>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <ComposerWithSuggestions compact={false} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <ResultsBand
            compact={false}
            count={counts.total}
            query="all services"
            activeCount={selected.size}
            onOpen={() => {}}
            variant="trigger"
          />
          <ResultsPreview compact={false} count={counts.total} />
        </div>
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-elevated)]">
          <div className="flex items-start gap-2 border-b border-[color:var(--border)] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <h4 className="text-2xs font-extrabold text-[color:var(--text-heading)]">Filter services</h4>
              <p className="text-3xs font-medium text-[color:var(--text-soft)]">
                {counts.total} of {SERVICE_TOTAL} match
              </p>
            </div>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className={cn(
                  "min-h-7 shrink-0 rounded-lg px-2 text-3xs font-bold text-[color:var(--clinical-accent)] hover:bg-[color:var(--clinical-accent-soft)]",
                  focusRing,
                )}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="max-h-[20rem] overflow-y-auto px-3 py-2.5">
            <FacetGroupsBody selected={selected} counts={counts} onToggle={onToggle} compact={false} />
          </div>
          <div className="border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
            <CommitButton count={counts.total} compact={false} disabled={counts.total === 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Study frame                                                                */
/* ------------------------------------------------------------------------- */

function PreviewFrame({
  label,
  phone = false,
  children,
}: {
  label: string;
  phone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[24.375rem]")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          {label}
        </span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">{phone ? "390 px" : "1440 px"}</span>
      </div>
      <div
        className={cn(
          "overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)]",
          phone ? "p-2.5" : "p-4",
        )}
      >
        <div className={cn(!phone && "min-w-[46rem]")}>{children}</div>
      </div>
    </div>
  );
}

function OptionSection({
  id,
  eyebrow,
  title,
  lede,
  verdict,
  verdictTone,
  cost,
  strengths,
  desktop,
  desktopLabel = "Desktop",
  phone,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  verdict: string;
  verdictTone: "now" | "build" | "judgement";
  cost: string;
  strengths: ReadonlyArray<string>;
  desktop: React.ReactNode;
  desktopLabel?: string;
  phone: React.ReactNode;
}) {
  const toneClass =
    verdictTone === "build"
      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
      : verdictTone === "now"
        ? "border-[color:var(--success)]/35 bg-[color:var(--success)]/10 text-[color:var(--success)]"
        : "border-[color:var(--warning)]/35 bg-[color:var(--warning)]/10 text-[color:var(--warning)]";
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
              {eyebrow}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-3xs font-black uppercase tracking-eyebrow",
                toneClass,
              )}
            >
              {verdict}
            </span>
          </div>
          <h2 id={id} className="mt-1 text-lg font-extrabold text-[color:var(--text-heading)]">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">{lede}</p>
          <p className="mt-2 max-w-3xl text-xs font-semibold text-[color:var(--text-soft)]">
            <span className="font-black uppercase tracking-eyebrow">Cost · </span>
            {cost}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          {strengths.map((strength) => (
            <span
              key={strength}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
            >
              {strength}
            </span>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(21rem,0.7fr)]">
        <PreviewFrame label={desktopLabel}>{desktop}</PreviewFrame>
        <PreviewFrame label="Phone" phone>
          {phone}
        </PreviewFrame>
      </div>
    </section>
  );
}

const anatomy: ReadonlyArray<{ term: string; detail: string }> = [
  {
    term: "The three are a sequence, not a menu",
    detail:
      "1 can ship on its own and is compatible with both others. 2 supersedes 1's sheet but keeps its honesty about presets. 3 is 2 with the presets moved out, so it is a decision to take after 2 exists, not instead of it.",
  },
  {
    term: "The expensive part is identical in 2 and 3",
    detail:
      "Services has no filter state today — the chip is the query. The facet index, selection state and URL round-tripping are the bulk of the work and are the same code either way. Only the presentation differs, so picking on build cost between 2 and 3 is a false economy.",
  },
  {
    term: "Counts and multi-select ship together",
    detail:
      "A count on a single-select radio only reports the size of the thing you are about to jump to, never what you are narrowing. Shipping counts on top of today's radiogroup would look like progress and mean nothing.",
  },
  {
    term: "Option 3 reuses a production component",
    detail:
      "The evicted presets become AnswerSuggestionChips, whose own prop documentation names composer rows and empty states as its use. So option 3 deletes sheet code rather than adding a surface — its risk is product, not engineering.",
  },
  {
    term: "Option 1 is the only one that is purely subtractive",
    detail:
      "It adds no state, no facets and no new component. It renames, reorders, and shows the query you would lose. That is why it can land while the facet work is still being scoped.",
  },
  {
    term: "Every count here is real",
    detail:
      "Imported from the first study's facet index rather than re-declared, so the two pages cannot drift to different numbers for the same 219-service catalogue.",
  },
];

export function ServicesFilterOptionsMockupsPage() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>(["acuity:crisis_high"]));

  const toggleFacet = useCallback((facetId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(facetId)) next.delete(facetId);
      else next.add(facetId);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelected(new Set<string>()), []);
  const counts = useFacetCounts(selected);

  return (
    <main className="min-h-dvh bg-[color:var(--surface-inset)] pb-16 text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto grid max-w-[92rem] gap-4 px-4 py-8 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <span className="text-3xs font-black uppercase tracking-eyebrow text-[color:var(--clinical-accent)]">
              Services · filter surface · round two
            </span>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-[color:var(--text-heading)]">
              Three options along the recommended path
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              The first study offered three <em>directions</em>. This one offers the three <em>decisions</em> that came
              out of choosing between them: the fix that can ship immediately, the one recommended for the real build,
              and the bolder move that is a product judgement rather than a design one.
            </p>
            <p className="mt-2 max-w-3xl text-xs font-semibold text-[color:var(--text-soft)]">
              Counts are live and imported from{" "}
              <code className="font-mono text-3xs">services-filter-refined-mockups</code>, so both studies quote the
              same {SERVICE_TOTAL}-service catalogue. Options 2 and 3 share selection state — a facet chosen in one
              updates the other.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
            <Sparkles aria-hidden className="size-icon-md shrink-0 text-[color:var(--clinical-accent)]" />
            <span className="min-w-0 flex-1 text-xs font-bold text-[color:var(--text)]">
              {selected.size === 0
                ? `No filters applied — all ${SERVICE_TOTAL} catalogue services.`
                : `${selected.size} ${selected.size === 1 ? "filter" : "filters"} applied — ${counts.total} of ${SERVICE_TOTAL} match.`}
            </span>
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-2xs font-bold text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                  focusRing,
                )}
              >
                <X aria-hidden className="h-3 w-3" />
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <OptionSection
          id="services-filter-option-one"
          eyebrow="Option 1"
          verdict="Ship first"
          verdictTone="now"
          title="Stop the bleed"
          lede="No filtering at all. The sheet stops claiming to filter and starts telling the truth: it is renamed to what it is, each shortcut shows the literal query it will run, and the current search sits at the top as the thing you are about to lose. Today that loss is invisible until it has already happened — there is no warning and no undo. The footer's primary action is “Keep” rather than “Done”, so dismissing is a decision rather than an accident."
          cost="No new state, no facets, no new component. Renaming, reordering and one extra row. Compatible with options 2 and 3 — nothing here has to be unpicked later."
          strengths={["Could ship this week", "Purely subtractive", "Fixes the actual harm"]}
          desktop={<OptionOne compact={false} />}
          phone={<OptionOne compact />}
        />

        <OptionSection
          id="services-filter-option-two"
          eyebrow="Option 2"
          verdict="Recommended"
          verdictTone="build"
          title="The recommendation — facets, counts, and a filter row that survives"
          lede="Direction A's multi-select facet groups with live counts and a committed “Show N services”, plus direction B's persistent active-filter pill row. The phone frame shows the sheet open; the desktop frame shows it closed, because the closed state is what the pill row exists for — without it, the only trace of an active refinement is a badge count. Presets stay, demoted to a clearly navigational block."
          cost="The real build: a services facet index, selection state and URL round-tripping. Expressible in the shared ResultFilterSheet props, so all 7 modes benefit; the pill row is a band change and wants a per-mode opt-in."
          strengths={["Fixes the root problem", "Shared across 7 modes", "Filters legible when closed"]}
          desktop={<OptionTwo compact={false} selected={selected} onToggle={toggleFacet} onClear={clearAll} />}
          desktopLabel="Desktop · sheet closed"
          phone={<OptionTwo compact selected={selected} onToggle={toggleFacet} onClear={clearAll} />}
        />

        <OptionSection
          id="services-filter-option-three"
          eyebrow="Option 3"
          verdict="Your call"
          verdictTone="judgement"
          title="Presets evicted"
          lede="The sheet becomes purely a filter — no presets, no divider, no second verb — and the six presets move to the composer as suggested searches. Both surfaces are shown together because the sheet alone would flatter the option. This removes the two-verbs problem at the root rather than signposting it, and the sheet is visibly shorter for it. What it costs is discoverability: the sheet is where people currently find these."
          cost="Less code than option 2, not more — it deletes the preset block and reuses AnswerSuggestionChips, a production component whose docs already name composer rows as a use. The risk is entirely product: whether users still find the presets."
          strengths={["One verb per surface", "Reuses a shipped component", "Shortest sheet of the three"]}
          desktop={<OptionThree compact={false} selected={selected} onToggle={toggleFacet} onClear={clearAll} />}
          desktopLabel="Desktop · composer + filter"
          phone={<OptionThree compact selected={selected} onToggle={toggleFacet} onClear={clearAll} />}
        />

        <section
          aria-labelledby="services-filter-options-anatomy"
          className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
        >
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <h2
              id="services-filter-options-anatomy"
              className="text-lg font-extrabold text-[color:var(--text-heading)]"
            >
              How they relate
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              What choosing one commits you to, and what it does not.
            </p>
          </div>
          <dl className="grid gap-0 sm:grid-cols-2">
            {anatomy.map((entry, index) => (
              <div
                key={entry.term}
                className={cn(
                  "border-[color:var(--border)] px-4 py-3.5 sm:px-5",
                  index > 0 && "border-t",
                  index % 2 === 1 && "sm:border-l",
                  index === 1 && "sm:border-t-0",
                )}
              >
                <dt className="text-sm-minus font-bold text-[color:var(--text-heading)]">{entry.term}</dt>
                <dd className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{entry.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="services-filter-options-notes"
          className="rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-4 py-4 sm:px-5"
        >
          <h2 id="services-filter-options-notes" className="text-lg font-extrabold text-[color:var(--text-heading)]">
            Before this becomes production
          </h2>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-sm font-medium text-[color:var(--text-muted)]">
            <li>
              <strong className="font-bold text-[color:var(--text)]">Option 1 has one open question.</strong> Showing
              the current query as a row implies it is selectable. Here it is a static state, not a control — if it
              becomes tappable it needs to be a real radio, which pulls back in the single-select contract options 2 and
              3 replace.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">
                Options 2 and 3 need filter state that does not exist.
              </strong>{" "}
              Services has none today — the chip <em>is</em> the query. Build the index on the model of{" "}
              <code className="font-mono text-xs">buildSmartDocumentTagFacetIndex</code> in{" "}
              <code className="font-mono text-xs">src/lib/document-tags.ts</code>.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">
                Option 3 needs a discoverability answer, not a design one.
              </strong>{" "}
              Moving presets to the composer is cheap to build and easy to revert; the question is whether anyone finds
              them there. That is worth a look at whether the presets are used at all before committing either way.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">The band changes touch phone chrome.</strong>{" "}
              Option 2&rsquo;s pill row and option 3&rsquo;s composer both add height near the reserve — read{" "}
              <code className="font-mono text-xs">docs/search-chrome-behaviour.md</code> and run{" "}
              <code className="font-mono text-xs">npm run verify:phone-chrome</code>.
            </li>
            <li>
              <strong className="font-bold text-[color:var(--text)]">Mockups skip two gates, not all of them.</strong>{" "}
              Every control here is already at <code className="font-mono text-xs">min-h-tap</code> (48px) on phone — do
              not relax that to 44px for generic a11y guidance, which reintroduces a known{" "}
              <code className="font-mono text-xs">ui-smoke</code> flake.
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
