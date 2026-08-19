"use client";

import { useState } from "react";
import { ArrowUpDown, Check, ChevronDown, CircleAlert, Funnel, Layers3, Search, X } from "lucide-react";

import {
  DesktopFrame,
  PhoneComposer,
  ResultRow,
  focusRing,
  letters,
  sampleEntries,
} from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary header system (2026-08-19)
 *
 * Supersedes the two Browse-only rounds at /mockups/dictionary-browse-header
 * and /mockups/dictionary-browse-header-compact. Those studied one tab; the
 * review that prompted this one is about the Search header, the fact that its
 * scope chips sit outside every container the other modes use, and the two
 * questions that follow — where Abbreviations belongs, and where the alphabet
 * belongs. Neither can be answered on one tab alone, so every direction here
 * is drawn on both.
 *
 * On fidelity: the frames redraw `SearchResultsHeaderBand`, `SegmentedControl`
 * and `ResultFilterTrigger` rather than importing them. That is forced, not
 * preferred — those components branch on VIEWPORT breakpoints (`sm:`, `lg:`),
 * so a 390px-wide frame on a 1440px screen renders their desktop layout and a
 * phone study drawn that way would be a lie. Each redraw takes an explicit
 * `compact` prop where production reads a breakpoint, and is otherwise class-
 * for-class. Every direction also prints the literal props it would hand the
 * real band, which is where buildability is actually checkable.
 * ------------------------------------------------------------------ */

/* --------------------------------- data -------------------------------- */

const TOTAL = 119;
const DEFINITIONS = 96;
const ABBREVIATIONS = 11;
const TOPICS = 12;
/** Definitions + topics: what "All" reports once abbreviations are excluded. */
const WITHOUT_ABBREVIATIONS = TOTAL - ABBREVIATIONS;

type Tab = "search" | "browse";
type DirectionId = "banded" | "sheeted" | "toolbar";
type SearchScope = "all" | "definitions" | "abbreviations" | "topics";
type BrowseScope = "definitions" | "abbreviations";
/** Direction B's demoted abbreviation control, as a sheet scope. */
type AbbrScope = "include" | "only" | "exclude";

const abbrScopeLabel: Record<AbbrScope, string> = {
  include: "Terms and abbreviations",
  only: "Abbreviations only",
  exclude: "Terms only",
};

const abbrScopeCount: Record<AbbrScope, number> = {
  include: TOTAL,
  only: ABBREVIATIONS,
  exclude: WITHOUT_ABBREVIATIONS,
};

/* ------------------------------- findings ------------------------------ */

const findings: ReadonlyArray<{ id: string; title: string; body: string; where: string }> = [
  {
    id: "f1",
    title: "The scope chips are not a design-system control",
    body: "Every other mode with a scope lens renders a SegmentedControl inside the band card's filterControls slot — a contained strip on --surface-subtle. Dictionary's four lenses are a hand-rolled flex-wrap chip row on the bare page background, above the band. Nothing contains them, which is exactly why they read edge to edge.",
    where: "dictionary-catalogue-pages.tsx:177 · vs factsheets-search-page.tsx:128, tools-search-results-page.tsx:384",
  },
  {
    id: "f2",
    title: "They broke out of the card for a real reason",
    body: "The band renders filterControls as hidden sm:block whenever a mobile control is supplied, so putting the lenses inside made all four unreachable on a phone. The page was the escape hatch, and the code says so in a comment. Every direction here resolves it the same way: pass the Filter trigger as utilityControls instead of mobileControls. hasPhoneUtilities counts utilityControls, so the trigger still renders on a phone — and with no mobileControls the hide rule never fires.",
    where: "search-results-header-band.tsx:588 and :266 · dictionary-catalogue-pages.tsx:174",
  },
  {
    id: "f3",
    title: "Four variable-width chips cannot hold one line at 390px",
    body: 'flex-wrap does what it says: Topics 12 drops onto a second row on its own. SegmentedControl layout="equal" already ships the compression ladder this needs — text-3xs below 360px, min-[360px]:text-xs, sm:px-3 — so equal segments shrink instead of wrapping.',
    where: "segmented-control.tsx:140",
  },
  {
    id: "f4",
    title: "The two tabs disagree about what a scope control is",
    body: "Search uses hand-rolled chips; Browse uses a real SegmentedControl. Search is contained at max-w-[76rem]; Browse wraps its toolbar in a border-y band that spans the whole viewport, which no other mode does. Same mode, two grammars.",
    where: "dictionary-catalogue-pages.tsx:177 vs :393",
  },
  {
    id: "f5",
    title: "One flat row mixes three classes of object",
    body: "Definitions (96) and abbreviations (11) are terms. Topics (12) are governed collections with their own route and their own page. Ranking them as four peer lenses is what makes the row both too long and conceptually uneven — and it is the lever every direction below pulls on.",
    where: "dictionary-data.ts · /dictionary/topics",
  },
];

/* ------------------------------ directions ----------------------------- */

const directions: ReadonlyArray<{
  id: DirectionId;
  number: string;
  name: string;
  thesis: string;
  summary: string;
  searchScopes: string;
  abbreviations: string;
  alphabet: string;
  strengths: readonly string[];
  cost: string;
  recommended?: boolean;
}> = [
  {
    id: "banded",
    number: "01",
    name: "Band-native, all four scopes",
    thesis: "Change the container, not the content.",
    summary:
      "The smallest move that answers the review. The four lenses stay exactly as they are, but move inside the band card as an equal-layout segmented control, so they compress instead of wrapping and sit in the same strip factsheets and tools use. Browse gets the same card, ending its full-bleed band, with the alphabet on a second strip row.",
    searchScopes: "All 119 · Definitions 96 · Abbreviations 11 · Topics 12",
    abbreviations: "Stays a header scope",
    alphabet: "Second filterControls row in the band",
    strengths: ["Nothing is hidden behind a tap", "Smallest behavioural change", "Both tabs, one grammar"],
    cost: "Four equal segments at 320px are genuinely tight — Abbreviations truncates to a stem, and the counts drop to text-3xs. It fixes the wrap without fixing finding 5: the row still ranks a collection beside two kinds of term.",
  },
  {
    id: "sheeted",
    number: "02",
    name: "Three scopes, Abbreviations in the sheet",
    thesis: "The header says what kind of thing. The sheet says how the list is narrowed.",
    summary:
      "Abbreviations stops being a peer of Definitions and becomes what it behaves like — a narrowing of the term list — rendered in the open filter sheet by ResultFilterSheet's existing scope prop, the same one specifiers and services already pass. The header drops to three comfortable segments on Search and to the alphabet alone on Browse.",
    searchScopes: "All 119 · Definitions 96 · Topics 12",
    abbreviations: "ResultFilterScopeSelector inside the open sheet",
    alphabet: "Owns the whole filterControls row on Browse",
    strengths: ["Comfortable at 320px", "Uses a shipped prop, no new component", "Header stops mixing object classes"],
    cost: "A view switch demoted into a sheet is invisible until you open it. The applied-filter chip on the band's shelf is therefore load-bearing, not decoration — without it the header claims 119 results while listing 11. This is the same conclusion the round-two Browse study reached independently.",
    recommended: true,
  },
  {
    id: "toolbar",
    number: "03",
    name: "One toolbar, title retired on phone",
    thesis: "The mode nav already says Search. Stop saying it twice.",
    summary:
      "The most aggressive reduction. On a phone the visible page title goes (kept for screen readers) because the tab rail directly above it already reads Search or Browse, leaving the band as the only chrome before a result. Topics leaves the header instead of Abbreviations — it has its own route, so the header keeps the two things that are actually terms. Desktop keeps its title; it has no tab bar to inherit one from.",
    searchScopes: "All 119 · Definitions 96 · Abbreviations 11",
    abbreviations: "Stays a header scope",
    alphabet: "Compact A–Z trigger on the count line",
    strengths: ["Results start highest up the page", "Three roomy segments", "Nothing about terms is hidden"],
    cost: "Phone loses its visual page title and depends entirely on the mode nav above staying put — if that ever scroll-hides, the page has no name. Topics becomes a sheet facet plus a link, which is a demotion for a surface that has twelve populated collections.",
  },
];

/* --------------------------- band redraw parts -------------------------- */

/**
 * `SegmentedControl`, with the viewport breakpoint replaced by `compact`.
 * Class-for-class with segmented-control.tsx:104-150, including the equal-layout
 * compression ladder that is the whole answer to the wrapping chip row.
 */
function StudySegmented<T extends string>({
  label,
  value,
  onChange,
  options,
  compact,
  layout = "equal",
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  compact: boolean;
  layout?: "equal" | "fit";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex w-full min-w-0 gap-1 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-1 shadow-[var(--shadow-inset)]",
        layout === "equal" ? "flex-nowrap" : "flex-wrap",
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.hint ? `${option.label} (${option.hint})` : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-tap min-w-0 items-center justify-center whitespace-nowrap rounded-full font-semibold leading-none transition motion-reduce:transition-none",
              focusRing,
              layout === "equal"
                ? compact
                  ? "flex-1 gap-1 px-1 text-3xs tracking-tight"
                  : "flex-1 gap-1.5 px-3"
                : "flex-none gap-1.5 px-3 text-xs",
              !compact && layout === "equal" && "text-xs",
              checked
                ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)] shadow-[var(--e1)]"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
            )}
          >
            <span className="min-w-0 truncate">{option.label}</span>
            {option.hint ? (
              <span className={cn("nums shrink-0", checked ? "opacity-80" : "text-[color:var(--text-muted)]")}>
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** `ResultFilterTrigger`, redrawn. result-filter-control.tsx:194. */
function StudyFilterTrigger({
  activeCount,
  onToggle,
  open,
  compact,
}: {
  activeCount: number;
  onToggle: () => void;
  open: boolean;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-haspopup="dialog"
      className={cn(
        "inline-flex min-h-tap min-w-tap shrink-0 items-center justify-center gap-1.5 rounded-lg border pl-2.5 pr-[0.6875rem] text-xs font-bold transition-colors motion-reduce:transition-none",
        focusRing,
        activeCount > 0
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
      )}
    >
      <Funnel aria-hidden="true" className="h-4 w-4 shrink-0" />
      {compact && activeCount > 0 ? null : "Filter"}
      {activeCount > 0 ? (
        <span className="nums grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent-soft)] px-1 text-2xs font-bold text-[color:var(--clinical-accent)]">
          {activeCount}
        </span>
      ) : null}
    </button>
  );
}

/** The band's `sm:`-and-up sort group. search-results-header-band.tsx:743. */
function StudySort({
  value,
  onChange,
}: {
  value: "relevance" | "alpha";
  onChange: (next: "relevance" | "alpha") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Sort results"
      className="inline-flex min-h-10 shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      {(["relevance", "alpha"] as const).map((option, index) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "min-h-10 whitespace-nowrap px-3 text-xs font-bold",
            focusRing,
            index > 0 && "border-l border-[color:var(--border)]",
            value === option
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
          )}
        >
          {option === "relevance" ? "Relevance" : "A–Z"}
        </button>
      ))}
    </div>
  );
}

export type ShelfChip = { id: string; groupLabel?: string; valueLabel: string; onRemove: () => void };

/**
 * `SearchResultsHeaderBand`, redrawn: the lead rule, the count-first spine, the
 * hairline, the truncating query, the utility rail, the `filterControls` strip
 * and the applied-filter shelf. search-results-header-band.tsx:284-685.
 */
function StudyBand({
  compact,
  count,
  noun,
  query,
  onSort,
  sort,
  trigger,
  strip,
  shelf = [],
  onClearShelf,
}: {
  compact: boolean;
  count: number;
  noun: string;
  query: string;
  sort: "relevance" | "alpha";
  onSort: (next: "relevance" | "alpha") => void;
  trigger: React.ReactNode;
  strip?: React.ReactNode;
  shelf?: readonly ShelfChip[];
  onClearShelf?: () => void;
}) {
  return (
    <section
      aria-label={`Search results for ${query}`}
      className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      <div
        className={cn(
          "flex min-w-0 flex-nowrap items-center gap-x-2 px-3",
          compact ? "min-h-[3.625rem]" : "min-h-[3.75rem] gap-x-2.5 px-4",
        )}
      >
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <span aria-hidden className="h-5 w-[0.1875rem] shrink-0 rounded-full bg-[color:var(--clinical-accent)]" />
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[color:var(--text-muted)]">
            <span className="nums text-sm font-extrabold text-[color:var(--text-heading)]">{count}</span> {noun}
          </span>
          <span aria-hidden className="mx-0.5 h-[1.125rem] w-px shrink-0 bg-[color:var(--border)]" />
          <span className="min-w-[2rem] truncate text-xs font-semibold text-[color:var(--text-muted)]" title={query}>
            {query}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {compact ? null : <StudySort value={sort} onChange={onSort} />}
          {trigger}
        </div>
      </div>
      {strip ? (
        <div
          role="group"
          aria-label="Filter dictionary results"
          className={cn(
            "min-w-0 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] py-2",
            compact ? "px-2.5" : "px-3",
          )}
        >
          {strip}
        </div>
      ) : null}
      {shelf.length ? (
        <div
          role="group"
          aria-label="Applied filters"
          className={cn(
            "flex min-w-0 items-center gap-1.5 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] py-2",
            compact ? "px-2.5" : "px-3",
          )}
        >
          <Funnel aria-hidden className="h-4 w-4 shrink-0 text-[color:var(--decoration-soft)]" />
          {compact ? null : (
            <span className="shrink-0 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
              Filtered by
            </span>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shelf.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove ${chip.groupLabel ? `${chip.groupLabel}: ` : ""}${chip.valueLabel} filter`}
                className={cn(
                  "inline-flex min-h-tap shrink-0 max-w-[12rem] items-center gap-1 rounded-[7px] border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-2xs font-bold text-[color:var(--clinical-accent)]",
                  focusRing,
                )}
              >
                {chip.groupLabel && !compact ? (
                  <span className="truncate">
                    <span className="text-[color:var(--text-muted)]">{chip.groupLabel}: </span>
                    {chip.valueLabel}
                  </span>
                ) : (
                  <span className="truncate">{chip.valueLabel}</span>
                )}
                <X aria-hidden className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
          {onClearShelf && shelf.length > 1 ? (
            <button
              type="button"
              onClick={onClearShelf}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center rounded-md px-2 text-2xs font-bold text-[color:var(--text-muted)] underline decoration-[color:var(--border-strong)] underline-offset-2",
                focusRing,
              )}
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* --------------------------- alphabet controls -------------------------- */

/** The phone alphabet trigger. Full-width in 01/02, a compact chip in 03. */
function LetterTrigger({
  value,
  onOpen,
  size = "regular",
}: {
  value: string;
  onOpen: () => void;
  size?: "regular" | "chip";
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Alphabetical index — ${value === "all" ? "all letters" : value}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] font-bold text-[color:var(--text)] shadow-[var(--shadow-inset)] hover:border-[color:var(--border-strong)]",
        focusRing,
        size === "chip" ? "min-h-tap shrink-0 px-2.5 text-xs" : "min-h-tap w-full px-3 text-sm",
      )}
    >
      <span className="shrink-0 text-[color:var(--text-muted)]">{size === "chip" ? "A–Z" : "Alphabetical"}</span>
      <span className="truncate font-extrabold text-[color:var(--clinical-accent)]">
        {value === "all" ? "All" : value}
      </span>
      <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
    </button>
  );
}

/** The desktop letter rail: wraps rather than scrolls, as production does. */
function LetterRail({ value, onSelect }: { value: string; onSelect: (next: string) => void }) {
  return (
    <nav aria-label="Browse by letter" className="flex flex-wrap gap-1">
      {["all", ...letters].map((option) => (
        <button
          key={option}
          type="button"
          aria-current={value === option ? "page" : undefined}
          onClick={() => onSelect(option)}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-md border text-xs font-extrabold",
            focusRing,
            value === option
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "border-[color:var(--border)] text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)]",
          )}
        >
          {option === "all" ? "All" : option}
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------ in-frame sheet -------------------------- */

function SheetShell({
  title,
  onClose,
  children,
  anchored,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  anchored?: boolean;
}) {
  const heading = (
    <div className="flex items-center gap-2 pb-2">
      <p className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={cn("ml-auto grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)]", focusRing)}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );

  if (anchored) {
    return (
      <div className="absolute inset-0 z-40">
        <button type="button" aria-label={`Close ${title}`} onClick={onClose} className="absolute inset-0" />
        <div className="absolute right-6 top-16 max-h-[85%] w-[24rem] overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e3)]">
          {heading}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--overlay-backdrop)]"
      />
      <div className="relative max-h-[88%] overflow-y-auto rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e3)]">
        {heading}
        {children}
      </div>
    </div>
  );
}

/**
 * `ResultFilterScopeSelector`, redrawn — the control direction 02 hands to
 * `ResultFilterSheet`'s existing `scope` prop. result-filter-control.tsx:653,
 * already passed by specifiers-home-page.tsx:410 and services-navigator-page.tsx:940.
 */
function ScopeSelector({
  value,
  onChange,
  highlight,
}: {
  value: AbbrScope;
  onChange: (next: AbbrScope) => void;
  highlight?: boolean;
}) {
  return (
    <fieldset
      className={cn(
        "min-w-0 rounded-xl border p-2.5",
        highlight
          ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--surface-subtle)]",
      )}
    >
      <legend className="px-1 text-2xs font-bold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
        Show{highlight ? " · moved here from the header" : ""}
      </legend>
      <div className="grid gap-2">
        {(["include", "exclude", "only"] as const).map((option) => (
          <label key={option} className="relative min-w-0 cursor-pointer">
            <input
              type="radio"
              name="abbr-scope"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              aria-label={`${abbrScopeLabel[option]}, ${abbrScopeCount[option]} matches`}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex min-h-tap min-w-0 items-center gap-2 rounded-lg border bg-[color:var(--surface-raised)] px-3 py-2 shadow-[var(--shadow-inset)]",
                "border-[color:var(--border-lux)] text-[color:var(--text-muted)]",
                "peer-checked:border-[color:var(--clinical-accent-border)] peer-checked:bg-[color:var(--clinical-accent-soft)] peer-checked:text-[color:var(--clinical-accent)]",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)]",
                  value === option && "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)]",
                )}
              >
                {value === option ? (
                  <Check aria-hidden="true" className="h-2.5 w-2.5 text-[color:var(--surface)]" strokeWidth={3.5} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--text-heading)]">
                {abbrScopeLabel[option]}
              </span>
              <span className="nums shrink-0 text-xs font-bold">{abbrScopeCount[option]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SheetGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
      {children}
    </p>
  );
}

function SortPair({ value, onChange }: { value: "az" | "za"; onChange: (next: "az" | "za") => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {(["az", "za"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "inline-flex min-h-tap items-center justify-center gap-1.5 rounded-lg border text-sm font-extrabold",
            focusRing,
            value === option
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "border-[color:var(--border)] text-[color:var(--text)]",
          )}
        >
          <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5" />
          {option === "az" ? "A–Z" : "Z–A"}
        </button>
      ))}
    </div>
  );
}

function LetterGrid({ value, onSelect }: { value: string; onSelect: (next: string) => void }) {
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={cn(
          "mb-1.5 min-h-tap w-full rounded-lg border text-sm font-extrabold",
          focusRing,
          value === "all"
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
            : "border-[color:var(--border)] text-[color:var(--text)]",
        )}
      >
        All letters
      </button>
      {/* Inline gridTemplateColumns, not `grid-cols-6`: the mockup stylesheet
          only emits classes some source already uses, and no production file
          uses a bare `grid-cols-6` — a class here silently collapses to one
          column. Recorded in mockups/README.md by the round-two study. */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        {letters.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              "grid min-h-tap place-items-center rounded-lg border text-sm font-extrabold",
              focusRing,
              value === option
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                : "border-[color:var(--border)] text-[color:var(--clinical-accent)]",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </>
  );
}

/* --------------------------------- state -------------------------------- */

function useHeaderState() {
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [browseScope, setBrowseScope] = useState<BrowseScope>("definitions");
  const [letter, setLetter] = useState("all");
  const [abbrScope, setAbbrScope] = useState<AbbrScope>("include");
  const [sort, setSort] = useState<"relevance" | "alpha">("relevance");
  const [browseSort, setBrowseSort] = useState<"az" | "za">("az");
  const [topicFacets, setTopicFacets] = useState<readonly string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  return {
    searchScope,
    setSearchScope,
    browseScope,
    setBrowseScope,
    letter,
    setLetter,
    abbrScope,
    setAbbrScope,
    sort,
    setSort,
    browseSort,
    setBrowseSort,
    topicFacets,
    setTopicFacets,
    sheetOpen,
    setSheetOpen,
    letterOpen,
    setLetterOpen,
  };
}

type HeaderState = ReturnType<typeof useHeaderState>;

/** Per-letter counts are synthetic; every catalogue total is the real one. */
function letterShare(base: number, letter: string) {
  if (letter === "all") return base;
  const index = letters.indexOf(letter);
  return Math.max(1, Math.round((base * (((index * 7) % 9) + 2)) / 120));
}

function searchCount(direction: DirectionId, state: HeaderState) {
  if (state.searchScope === "definitions") return DEFINITIONS;
  if (state.searchScope === "abbreviations") return ABBREVIATIONS;
  if (state.searchScope === "topics") return TOPICS;
  return direction === "sheeted" ? abbrScopeCount[state.abbrScope] : TOTAL;
}

function browseCount(direction: DirectionId, state: HeaderState) {
  const base =
    direction === "sheeted"
      ? state.abbrScope === "only"
        ? ABBREVIATIONS
        : state.abbrScope === "exclude"
          ? DEFINITIONS
          : DEFINITIONS + ABBREVIATIONS
      : state.browseScope === "abbreviations"
        ? ABBREVIATIONS
        : DEFINITIONS;
  return letterShare(base, state.letter);
}

function activeFilterCount(direction: DirectionId, state: HeaderState) {
  let total = state.topicFacets.length;
  if (direction === "sheeted" && state.abbrScope !== "include") total += 1;
  return total;
}

function shelfChips(direction: DirectionId, state: HeaderState): ShelfChip[] {
  const chips: ShelfChip[] = [];
  if (direction === "sheeted" && state.abbrScope !== "include") {
    chips.push({
      id: "abbr",
      groupLabel: "Show",
      valueLabel: abbrScopeLabel[state.abbrScope],
      onRemove: () => state.setAbbrScope("include"),
    });
  }
  for (const topic of state.topicFacets) {
    chips.push({
      id: `topic-${topic}`,
      groupLabel: "Topic",
      valueLabel: topic,
      onRemove: () => state.setTopicFacets((current) => current.filter((value) => value !== topic)),
    });
  }
  return chips;
}

/* ------------------------------- the headers ---------------------------- */

function PageTitle({ tab, compact, retire }: { tab: Tab; compact: boolean; retire?: boolean }) {
  const kicker = tab === "search" ? "Clinical dictionary" : "Complete catalogue";
  const title = tab === "search" ? "Search terms" : "Browse terms";
  if (retire && compact) return <h1 className="sr-only">{title}</h1>;
  return (
    <header className={cn("px-4", compact ? "pb-3 pt-4" : "px-6 pb-4 pt-6")}>
      {compact && tab === "browse" ? null : (
        <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">{kicker}</p>
      )}
      <h1
        className={cn(
          "font-extrabold tracking-tight text-[color:var(--text-heading)]",
          compact ? "mt-1 text-2xl" : "mt-1 text-4xl",
        )}
      >
        {title}
      </h1>
    </header>
  );
}

function DirectionHeader({
  direction,
  tab,
  compact,
  state,
}: {
  direction: DirectionId;
  tab: Tab;
  compact: boolean;
  state: HeaderState;
}) {
  const count = tab === "search" ? searchCount(direction, state) : browseCount(direction, state);
  const noun =
    tab === "search"
      ? state.searchScope === "topics"
        ? "topic collections"
        : "dictionary results"
      : direction !== "sheeted" && state.browseScope === "abbreviations"
        ? "abbreviations"
        : "terms";
  const query =
    tab === "search"
      ? state.searchScope === "all"
        ? "All"
        : state.searchScope.charAt(0).toUpperCase() + state.searchScope.slice(1)
      : state.letter === "all"
        ? "All letters"
        : state.letter;

  const trigger = (
    <StudyFilterTrigger
      compact={compact}
      open={state.sheetOpen}
      activeCount={activeFilterCount(direction, state)}
      onToggle={() => state.setSheetOpen(!state.sheetOpen)}
    />
  );

  /* ---- direction 01: everything stays, the container changes ---- */
  if (direction === "banded") {
    const strip =
      tab === "search" ? (
        <StudySegmented
          label="Result type"
          compact={compact}
          value={state.searchScope}
          onChange={state.setSearchScope}
          options={[
            { value: "all", label: "All", hint: String(TOTAL) },
            { value: "definitions", label: "Definitions", hint: String(DEFINITIONS) },
            { value: "abbreviations", label: "Abbreviations", hint: String(ABBREVIATIONS) },
            { value: "topics", label: "Topics", hint: String(TOPICS) },
          ]}
        />
      ) : (
        <div className="grid min-w-0 gap-2">
          <StudySegmented
            label="Browse view"
            compact={compact}
            value={state.browseScope}
            onChange={state.setBrowseScope}
            options={[
              { value: "definitions", label: "Definitions", hint: String(DEFINITIONS) },
              { value: "abbreviations", label: "Abbreviations", hint: String(ABBREVIATIONS) },
            ]}
          />
          {compact ? (
            <LetterTrigger value={state.letter} onOpen={() => state.setLetterOpen(true)} />
          ) : (
            <LetterRail value={state.letter} onSelect={state.setLetter} />
          )}
        </div>
      );
    return (
      <>
        <PageTitle tab={tab} compact={compact} />
        <div className={cn(compact ? "px-4" : "px-6")}>
          <StudyBand
            compact={compact}
            count={count}
            noun={noun}
            query={query}
            sort={state.sort}
            onSort={state.setSort}
            trigger={trigger}
            strip={strip}
            shelf={shelfChips(direction, state)}
            onClearShelf={() => state.setTopicFacets([])}
          />
        </div>
      </>
    );
  }

  /* ---- direction 02: the header names the thing, the sheet narrows it ---- */
  if (direction === "sheeted") {
    const strip =
      tab === "search" ? (
        <StudySegmented
          label="Result type"
          compact={compact}
          value={state.searchScope === "abbreviations" ? "all" : state.searchScope}
          onChange={state.setSearchScope}
          options={[
            { value: "all", label: "All", hint: String(abbrScopeCount[state.abbrScope]) },
            { value: "definitions", label: "Definitions", hint: String(DEFINITIONS) },
            { value: "topics", label: "Topics", hint: String(TOPICS) },
          ]}
        />
      ) : compact ? (
        <LetterTrigger value={state.letter} onOpen={() => state.setLetterOpen(true)} />
      ) : (
        <LetterRail value={state.letter} onSelect={state.setLetter} />
      );
    return (
      <>
        <PageTitle tab={tab} compact={compact} />
        <div className={cn(compact ? "px-4" : "px-6")}>
          <StudyBand
            compact={compact}
            count={count}
            noun={noun}
            query={query}
            sort={state.sort}
            onSort={state.setSort}
            trigger={trigger}
            strip={strip}
            shelf={shelfChips(direction, state)}
            onClearShelf={() => {
              state.setAbbrScope("include");
              state.setTopicFacets([]);
            }}
          />
        </div>
      </>
    );
  }

  /* ---- direction 03: one toolbar, no phone title ---- */
  const strip =
    tab === "search" ? (
      <StudySegmented
        label="Result type"
        compact={compact}
        value={state.searchScope === "topics" ? "all" : state.searchScope}
        onChange={state.setSearchScope}
        options={[
          { value: "all", label: "All", hint: String(TOTAL) },
          { value: "definitions", label: "Definitions", hint: String(DEFINITIONS) },
          { value: "abbreviations", label: "Abbreviations", hint: String(ABBREVIATIONS) },
        ]}
      />
    ) : (
      <StudySegmented
        label="Browse view"
        compact={compact}
        value={state.browseScope}
        onChange={state.setBrowseScope}
        options={[
          { value: "definitions", label: "Definitions", hint: String(DEFINITIONS) },
          { value: "abbreviations", label: "Abbreviations", hint: String(ABBREVIATIONS) },
        ]}
      />
    );
  return (
    <>
      <PageTitle tab={tab} compact={compact} retire />
      <div className={cn(compact ? "px-4 pt-3" : "px-6")}>
        <StudyBand
          compact={compact}
          count={count}
          noun={noun}
          query={query}
          sort={state.sort}
          onSort={state.setSort}
          trigger={
            <>
              {tab === "browse" ? (
                <LetterTrigger value={state.letter} onOpen={() => state.setLetterOpen(true)} size="chip" />
              ) : null}
              {trigger}
            </>
          }
          strip={strip}
          shelf={shelfChips(direction, state)}
          onClearShelf={() => state.setTopicFacets([])}
        />
      </div>
    </>
  );
}

/* ------------------------------ the sheets ------------------------------ */

const topicFacetOptions = ["Mood", "Psychosis", "Legal / ethical", "Therapies"] as const;

function DirectionSheet({
  direction,
  tab,
  state,
  anchored,
}: {
  direction: DirectionId;
  tab: Tab;
  state: HeaderState;
  anchored: boolean;
}) {
  const close = () => state.setSheetOpen(false);
  const total = tab === "search" ? searchCount(direction, state) : browseCount(direction, state);
  return (
    <SheetShell title="Filter and sort" onClose={close} anchored={anchored}>
      <div className="grid gap-3">
        {direction === "sheeted" ? (
          <ScopeSelector highlight value={state.abbrScope} onChange={state.setAbbrScope} />
        ) : null}
        {direction === "sheeted" && tab === "browse" ? (
          <section aria-label="Letter">
            <SheetGroupLabel>Letter · the same index as the band control</SheetGroupLabel>
            <LetterGrid value={state.letter} onSelect={state.setLetter} />
          </section>
        ) : null}
        <section aria-label="Sort">
          <SheetGroupLabel>Sort</SheetGroupLabel>
          <SortPair value={state.browseSort} onChange={state.setBrowseSort} />
        </section>
        <section aria-label="Topics">
          <SheetGroupLabel>
            {direction === "toolbar" ? "Topics · moved here from the header" : "Topics"}
          </SheetGroupLabel>
          <div className="flex flex-wrap gap-1.5">
            {topicFacetOptions.map((topic) => {
              const selected = state.topicFacets.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    state.setTopicFacets((current) =>
                      current.includes(topic) ? current.filter((value) => value !== topic) : [...current, topic],
                    )
                  }
                  className={cn(
                    "inline-flex min-h-tap items-center gap-1.5 rounded-full border px-3 text-2xs font-bold",
                    focusRing,
                    selected
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] text-[color:var(--text-muted)]",
                  )}
                >
                  {topic}
                  {selected ? <Check aria-hidden="true" className="h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>
          {direction === "toolbar" ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-2xs font-bold text-[color:var(--clinical-accent)]">
              <Layers3 aria-hidden="true" className="h-3.5 w-3.5" />
              All {TOPICS} collections
            </p>
          ) : null}
        </section>
        <button
          type="button"
          onClick={close}
          className={cn(
            "min-h-tap w-full rounded-lg bg-[color:var(--clinical-accent)] text-sm font-extrabold text-[color:var(--clinical-accent-contrast)]",
            focusRing,
          )}
        >
          Show {total} {total === 1 ? "result" : "results"}
        </button>
      </div>
    </SheetShell>
  );
}

/* ------------------------------- the frames ----------------------------- */

/**
 * `PhoneFrame` from the round-one study, with a `tab` prop: that frame pins the
 * mode nav to Browse, and half of every direction here is the Search tab.
 */
function StudyPhoneFrame({
  tab,
  label,
  children,
  overlay,
}: {
  tab: Tab;
  label: string;
  children: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">390 px · scrollable</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
        <div className="flex gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
          {(["search", "browse", "more"] as const).map((option) => (
            <span
              key={option}
              className={cn(
                "border-b-2 py-2 text-xs font-bold capitalize",
                option === tab
                  ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                  : "border-transparent text-[color:var(--text-muted)]",
              )}
            >
              {option}
            </span>
          ))}
        </div>
        <div className="relative h-[26rem] overflow-y-auto pb-14">{children}</div>
        <PhoneComposer />
        {overlay}
      </div>
    </div>
  );
}

function Results({ direction, tab, state }: { direction: DirectionId; tab: Tab; state: HeaderState }) {
  const scope = tab === "search" ? state.searchScope : state.browseScope;
  const rows =
    scope === "abbreviations" || (direction === "sheeted" && state.abbrScope === "only")
      ? sampleEntries.slice(0, 1)
      : sampleEntries;
  return (
    <div className="mt-3 border-y border-[color:var(--border)]">
      {[...rows, ...rows].map((entry, index) => (
        <ResultRow key={`${entry.term}-${index}`} entry={entry} />
      ))}
    </div>
  );
}

function DirectionFrames({ direction, tab }: { direction: DirectionId; tab: Tab }) {
  const desktop = useHeaderState();
  const phone = useHeaderState();

  const overlayFor = (state: HeaderState, anchored: boolean) => {
    if (state.letterOpen) {
      return (
        <SheetShell title="Alphabetical index" onClose={() => state.setLetterOpen(false)} anchored={anchored}>
          <LetterGrid
            value={state.letter}
            onSelect={(next) => {
              state.setLetter(next);
              state.setLetterOpen(false);
            }}
          />
        </SheetShell>
      );
    }
    if (state.sheetOpen) return <DirectionSheet direction={direction} tab={tab} state={state} anchored={anchored} />;
    return null;
  };

  return (
    <>
      <div className="min-w-0 lg:col-span-2">
        <DesktopFrame label={`${tab === "search" ? "Search" : "Browse"} · desktop`} overlay={overlayFor(desktop, true)}>
          <DirectionHeader direction={direction} tab={tab} compact={false} state={desktop} />
          <div className="px-6 pb-6">
            <Results direction={direction} tab={tab} state={desktop} />
          </div>
        </DesktopFrame>
      </div>
      <StudyPhoneFrame
        tab={tab}
        label={`${tab === "search" ? "Search" : "Browse"} · phone`}
        overlay={overlayFor(phone, false)}
      >
        <DirectionHeader direction={direction} tab={tab} compact state={phone} />
        <Results direction={direction} tab={tab} state={phone} />
      </StudyPhoneFrame>
    </>
  );
}

/* ---------------------------- what ships today --------------------------- */

function DefectMarker({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-2xs font-bold text-[color:var(--warning)]">
      <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] text-3xs">
        {id}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function TodaySearchPhone() {
  const [scope, setScope] = useState<SearchScope>("all");
  return (
    <StudyPhoneFrame tab="search" label="Search · phone · ships today">
      <header className="px-4 pb-4 pt-5">
        <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
          Clinical dictionary
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Search terms</h1>
        {/* The defect, reproduced exactly: a bare flex-wrap chip row on the page
            background, above the band, with nothing containing it. */}
        <div role="group" aria-label="Result type" className="mt-4 flex min-w-0 flex-wrap items-center gap-1.5">
          {(
            [
              { value: "all", label: "All", count: TOTAL },
              { value: "definitions", label: "Definitions", count: DEFINITIONS },
              { value: "abbreviations", label: "Abbreviations", count: ABBREVIATIONS },
              { value: "topics", label: "Topics", count: TOPICS },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={scope === option.value}
              onClick={() => setScope(option.value)}
              className={cn(
                "inline-flex min-h-tap shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold",
                focusRing,
                scope === option.value
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-muted)]",
              )}
            >
              {option.label}
              <span
                className={cn(
                  "nums text-2xs",
                  scope === option.value ? "opacity-80" : "text-[color:var(--text-muted)]",
                )}
              >
                {option.count}
              </span>
            </button>
          ))}
        </div>
      </header>
      <div className="px-4">
        <StudyBand
          compact
          count={TOTAL}
          noun="dictionary results"
          query="All"
          sort="relevance"
          onSort={() => undefined}
          trigger={<StudyFilterTrigger compact open={false} activeCount={0} onToggle={() => undefined} />}
        />
      </div>
      <div className="mt-3 border-y border-[color:var(--border)]">
        {sampleEntries.map((entry) => (
          <ResultRow key={entry.term} entry={entry} />
        ))}
      </div>
    </StudyPhoneFrame>
  );
}

function TodayBrowsePhone() {
  const [view, setView] = useState<BrowseScope>("definitions");
  const [letter, setLetter] = useState("all");
  return (
    <StudyPhoneFrame tab="browse" label="Browse · phone · ships today">
      <header className="px-4 pb-3 pt-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Browse terms</h1>
      </header>
      {/* The mirror defect: a border-y band that spans the whole viewport,
          which no other mode does — the toolbar inside it is contained. */}
      <div className="border-y border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="grid w-full gap-2 px-4 py-2.5">
          <StudySegmented
            label="Browse view"
            compact
            value={view}
            onChange={setView}
            options={[
              { value: "definitions", label: "Definitions", hint: String(DEFINITIONS) },
              { value: "abbreviations", label: "Abbreviations", hint: String(ABBREVIATIONS) },
            ]}
          />
          <div className="flex min-w-0 items-center gap-2">
            <label className="flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-3 pr-2 text-sm shadow-[var(--shadow-inset)]">
              <span className="shrink-0 font-bold text-[color:var(--text-muted)]">Alphabetical</span>
              <select
                value={letter}
                onChange={(event) => setLetter(event.target.value)}
                aria-label="Alphabetical index"
                className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent font-extrabold text-[color:var(--clinical-accent)] outline-none"
              >
                <option value="all">All letters</option>
                {letters.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" />
            </label>
            <StudyFilterTrigger compact open={false} activeCount={0} onToggle={() => undefined} />
          </div>
        </div>
      </div>
      <div className="border-b border-[color:var(--border)]">
        {sampleEntries.map((entry) => (
          <ResultRow key={entry.term} entry={entry} />
        ))}
      </div>
    </StudyPhoneFrame>
  );
}

/* ------------------------------- props proof ---------------------------- */

const propsProof: Record<DirectionId, readonly string[]> = {
  banded: [
    "<SearchResultsHeaderBand",
    '  modeId="dictionary"',
    "  matchCount={hits.length}",
    "  // No mobileControls: that prop is what makes filterControls",
    "  // hidden sm:block, and it is why the lenses left the card.",
    "  utilityControls={<ResultFilterTrigger … />}",
    "  filterControls={",
    '    <SegmentedControl label="Result type" layout="equal"',
    "      options={[all, definitions, abbreviations, topics]} />",
    "  }",
    "/>",
  ],
  sheeted: [
    "<SearchResultsHeaderBand",
    '  modeId="dictionary"',
    "  utilityControls={<ResultFilterTrigger … />}",
    '  filterControls={<SegmentedControl layout="equal"',
    "    options={[all, definitions, topics]} />}",
    "  appliedFilters={abbrScope === 'include' ? [] : [abbrChip]}",
    "/>",
    "<ResultFilterSheet",
    "  // Already shipped. specifiers-home-page.tsx:410 and",
    "  // services-navigator-page.tsx:940 pass this same prop.",
    "  scope={{",
    '    label: "Show",',
    "    value: abbrScope,",
    "    options: [include, exclude, only],   // each carries a count",
    "    onChange: setAbbrScope,",
    "  }}",
    "  groups={[sortGroup, letterGroup, topicFacets]}",
    "/>",
  ],
  toolbar: [
    "// Phone: the mode nav above already reads Search / Browse.",
    '<h1 className="sr-only sm:not-sr-only …">Search terms</h1>',
    "<SearchResultsHeaderBand",
    '  modeId="dictionary"',
    "  utilityControls={<><LetterTrigger … /><ResultFilterTrigger … /></>}",
    '  filterControls={<SegmentedControl layout="equal"',
    "    options={[all, definitions, abbreviations]} />}",
    "/>",
  ],
};

function PropsProof({ direction }: { direction: DirectionId }) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3">
      <p className="pb-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
        What this hands the shared components
      </p>
      <pre className="min-w-0 overflow-x-auto text-3xs font-semibold leading-5 text-[color:var(--text)]">
        {propsProof[direction].join("\n")}
      </pre>
    </div>
  );
}

/* --------------------------------- the page ------------------------------ */

export function DictionaryHeaderSystemMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · Search + Browse · header system
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Put the scope control back inside the card
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Three directions for one header system, each drawn on <strong className="font-extrabold">both</strong>{" "}
            Dictionary tabs. They share one move — the scope control returns to the band card, where every other browse
            mode keeps it — and differ on the two open questions: whether{" "}
            <strong className="font-extrabold text-[color:var(--text)]">Abbreviations</strong> is a scope or a filter,
            and where the <strong className="font-extrabold text-[color:var(--text)]">alphabet</strong> lives.
          </p>
          <p className="mt-3 max-w-3xl rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2.5 text-sm font-medium text-[color:var(--text)]">
            Every frame is live and independent — the phone and desktop frames of one direction hold separate state, so
            you can leave one filtered and compare. Switch scopes, open Filter, open the alphabet control. In{" "}
            <strong className="font-extrabold">direction 02</strong>, change{" "}
            <strong className="font-extrabold">Show</strong> inside the sheet and watch the chip appear on the band’s
            shelf: that chip is the direction’s load-bearing part, not decoration.
          </p>
          <p className="mt-3 max-w-3xl text-xs font-semibold leading-5 text-[color:var(--text-soft)]">
            Fidelity note · the frames redraw <span className="font-extrabold">SearchResultsHeaderBand</span>,{" "}
            <span className="font-extrabold">SegmentedControl</span> and{" "}
            <span className="font-extrabold">ResultFilterTrigger</span> with an explicit <code>compact</code> prop where
            production reads a <code>sm:</code> breakpoint. That is forced: those components branch on the viewport, so
            a 390 px frame on a 1440 px screen would render their desktop layout and the phone column would be a lie.
            Each direction prints the literal props it would hand the real components instead. Catalogue totals are
            real; per-letter counts are synthetic.
          </p>
        </div>
      </header>

      {/* ------------------------------ today ------------------------------ */}
      <section aria-labelledby="today-title" className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--warning-soft)] px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2">
              <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--warning)]" />
              <h2 id="today-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
                What ships today, and the five findings
              </h2>
            </div>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              Both tabs reproduced at 390 px. Neither is a strawman — these are the current class names.
            </p>
          </div>
          <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-3 lg:items-start">
            <TodaySearchPhone />
            <TodayBrowsePhone />
            <div className="grid min-w-0 gap-3">
              {findings.map((finding, index) => (
                <div key={finding.id} className="min-w-0 rounded-xl border border-[color:var(--border)] p-3">
                  <DefectMarker id={String(index + 1)}>{finding.title}</DefectMarker>
                  <p className="mt-1.5 text-xs font-medium leading-5 text-[color:var(--text-muted)]">{finding.body}</p>
                  <p className="mt-1.5 truncate text-3xs font-bold text-[color:var(--text-soft)]" title={finding.where}>
                    {finding.where}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------- directions ---------------------------- */}
      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 pb-10 sm:px-6 lg:px-8">
        {directions.map((direction) => (
          <section
            key={direction.id}
            aria-labelledby={`${direction.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-3 lg:items-start">
              <div className="flex min-w-0 gap-3 lg:col-span-2">
                <span className="pt-0.5 text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                  {direction.number}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id={`${direction.id}-title`}
                      className="text-lg font-extrabold text-[color:var(--text-heading)]"
                    >
                      {direction.name}
                    </h2>
                    {direction.recommended ? (
                      <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-extrabold italic text-[color:var(--clinical-accent)]">
                    {direction.thesis}
                  </p>
                  <p className="mt-1.5 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)]">
                    {direction.summary}
                  </p>
                  <dl className="mt-3 grid gap-1.5 text-xs sm:grid-cols-3">
                    {(
                      [
                        ["Header scopes", direction.searchScopes],
                        ["Abbreviations", direction.abbreviations],
                        ["Alphabet", direction.alphabet],
                      ] as const
                    ).map(([term, detail]) => (
                      <div key={term} className="min-w-0 rounded-lg border border-[color:var(--border)] px-2.5 py-2">
                        <dt className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
                          {term}
                        </dt>
                        <dd className="mt-0.5 font-bold text-[color:var(--text)]">{detail}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2.5 max-w-3xl text-xs font-semibold leading-5 text-[color:var(--text-soft)]">
                    Trade-off · {direction.cost}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap content-start gap-1.5">
                {direction.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-3">
              <DirectionFrames direction={direction.id} tab="search" />
            </div>
            <div className="grid gap-6 border-t border-[color:var(--border)] p-4 sm:p-5 lg:grid-cols-3">
              <DirectionFrames direction={direction.id} tab="browse" />
            </div>
            <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 sm:p-5">
              <PropsProof direction={direction.id} />
            </div>
          </section>
        ))}
      </div>

      <footer className="border-t border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8">
          <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
            <Search aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--decoration-soft)]" />
            <span className="max-w-3xl">
              Supersedes the two Browse-only rounds at <code>/mockups/dictionary-browse-header</code> and{" "}
              <code>/mockups/dictionary-browse-header-compact</code>. Their conclusions — letters as a dropdown on
              phones, Abbreviations demoted to the sheet with a load-bearing state chip — are carried into direction 02
              here and tested against the Search tab they never saw. Design scratch: this route 404s in production.
            </span>
          </p>
        </div>
      </footer>
    </main>
  );
}
