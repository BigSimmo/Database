"use client";

import { useState } from "react";
import { ChevronDown, ListFilter, Menu, MessageSquarePlus, Plus, Search, SendHorizontal, X } from "lucide-react";

import { focusRing, letters, ResultRow, type SampleEntry } from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → title off, original search at the top (2026-08-24)
 *
 * One design, not a comparison. The live catalogue keeps a "Clinical
 * terms" heading and, on phones, docks the composer at the bottom.
 * This study removes that heading on every screen and puts the original
 * search bar back at the top — under the mode nav, above the Filter
 * band — so browse and search share one stack.
 *
 * Phone Terms / Abbreviations and A–Z step up from 28px (h-7) to 36px
 * (h-9): still a compact strip, just large enough to hit. Desktop
 * letters stay at the existing rail size.
 *
 * Shared mockup chrome is suppressed; every frame draws its own header
 * and the one composer under study.
 * ------------------------------------------------------------------ */

const TERM_COUNT = 96;
const ABBR_COUNT = 11;
const QUERY = "tardive";
const QUERY_TERMS = 1;
const QUERY_ABBRS = 0;

const catalogueEntries: readonly SampleEntry[] = [
  {
    term: "Acceptance and commitment therapy",
    kind: "Therapy",
    alias: "ACT",
    definition: "A therapy that develops acceptance, present-moment awareness and action guided by personal values.",
  },
  {
    term: "Acute dystonia",
    kind: "Clinical finding",
    definition:
      "A sudden medication-associated sustained muscle contraction that produces abnormal posture or movement.",
  },
  {
    term: "Advance statement",
    kind: "Legal / ethical",
    definition:
      "A written record of a person's treatment preferences made while they have capacity, for use in later care.",
  },
];

const queryEntries: readonly SampleEntry[] = [
  {
    term: "Tardive dyskinesia",
    kind: "Clinical finding",
    alias: "TD",
    definition:
      "A persistent drug-associated movement disorder, often involving involuntary movements of the face, mouth or limbs.",
  },
];

const emptyLetters = new Set(["J", "K", "Q", "U", "V", "W", "X", "Y", "Z"]);

type Sheet = "none" | "letter" | "filter";

function useCatalogue(initialQuery: boolean) {
  const [scope, setScope] = useState<"terms" | "abbr">("terms");
  const [letter, setLetter] = useState("All");
  const [query, setQuery] = useState(initialQuery ? QUERY : "");
  const [sheet, setSheet] = useState<Sheet>("none");
  const searching = query.length > 0;
  const termCount = searching ? QUERY_TERMS : TERM_COUNT;
  const abbrCount = searching ? QUERY_ABBRS : ABBR_COUNT;
  const count = scope === "abbr" ? abbrCount : termCount;
  const noun = scope === "abbr" ? (count === 1 ? "abbreviation" : "abbreviations") : count === 1 ? "term" : "terms";
  const entries = searching ? queryEntries : catalogueEntries;
  return {
    scope,
    setScope,
    letter,
    setLetter,
    query,
    setQuery,
    sheet,
    setSheet,
    searching,
    termCount,
    abbrCount,
    count,
    noun,
    entries,
  };
}

type CatalogueState = ReturnType<typeof useCatalogue>;

function cycleQuery(state: CatalogueState) {
  state.setQuery(state.searching ? "" : QUERY);
}

/* 36px on phone — a step up from the live 28px strip, not a second header. */
const phoneControl =
  "inline-flex h-9 max-h-9 shrink-0 items-center gap-1 overflow-hidden rounded-md border border-[color:var(--border)] px-2.5 text-xs font-semibold leading-none";

function ScopeToggle({ state, size }: { state: CatalogueState; size: "phone" | "desktop" }) {
  const options = [
    { value: "terms" as const, label: "Terms", count: state.termCount },
    { value: "abbr" as const, label: "Abbreviations", count: state.abbrCount },
  ];
  return (
    <div
      role="group"
      aria-label="Show"
      data-testid="mock-scope-toggle"
      className={cn(
        "inline-flex shrink-0 items-stretch overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)]",
        size === "phone" ? "h-9" : "h-7",
      )}
    >
      {options.map((option) => {
        const active = state.scope === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={`${option.label} (${option.count})`}
            onClick={() => state.setScope(option.value)}
            className={cn(
              "inline-flex h-full items-center gap-1 px-2.5 font-semibold leading-none tracking-tight",
              size === "phone" ? "text-xs" : "text-2xs",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--focus)]",
              active
                ? "bg-[color:var(--tone-purple)] text-[color:var(--surface)]"
                : "bg-transparent text-[color:var(--clinical-accent)] hover:bg-[color:var(--tone-purple-soft)]",
            )}
          >
            <span>{option.label}</span>
            <span className="nums font-medium tabular-nums">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function LetterChip({ state }: { state: CatalogueState }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheet(state.sheet === "letter" ? "none" : "letter")}
      aria-haspopup="dialog"
      aria-expanded={state.sheet === "letter"}
      data-testid="mock-letter-chip"
      title="Jump to a letter"
      className={cn(phoneControl, "bg-[color:var(--surface)] text-[color:var(--clinical-accent)]", focusRing)}
    >
      {state.letter === "All" ? "A–Z" : state.letter}
      <ChevronDown className="size-icon-xs shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
      <span className="sr-only">
        {state.letter === "All" ? "jump to a letter" : `jump to a letter, currently ${state.letter}`}
      </span>
    </button>
  );
}

function FilterBand({ state, slot }: { state: CatalogueState; slot: "phone" | "desktop" }) {
  return (
    <section
      aria-label={state.searching ? `Search results for ${state.query}` : "Dictionary catalogue"}
      data-testid="mock-filter-band"
      className="search-band relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
    >
      <div className="flex min-h-14 min-w-0 items-center gap-x-2 px-3">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <span className="search-band-lead shrink-0" data-tone="accent" aria-hidden="true" />
          <span className="search-band-count-word flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[color:var(--text-muted)]">
            <span className="search-band-count text-[color:var(--text-heading)]">{state.count}</span>
            <span>{state.noun}</span>
          </span>
          {state.searching ? (
            <>
              <span className="search-band-rule mx-0.5 h-[1.125rem] w-px shrink-0" aria-hidden="true" />
              <span className="search-band-subject min-w-[2rem] truncate text-[color:var(--text-muted)]">
                {state.query}
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden="true" />
          )}
        </div>
        {state.searching ? (
          <button
            type="button"
            onClick={() => state.setQuery("")}
            className={cn(
              "search-band-ghost grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]",
              focusRing,
            )}
          >
            <X className="size-icon-md" aria-hidden="true" />
            <span className="sr-only">Clear the search</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => state.setSheet(state.sheet === "filter" ? "none" : "filter")}
          data-testid={`mock-filter-${slot}`}
          className={cn(
            "inline-flex min-h-tap shrink-0 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)]",
            focusRing,
          )}
        >
          <ListFilter className="size-icon-sm" aria-hidden="true" />
          Filter
        </button>
      </div>
    </section>
  );
}

function TopComposer({ state, size }: { state: CatalogueState; size: "phone" | "desktop" }) {
  return (
    <div
      className={cn(
        "border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        size === "desktop" ? "px-6 py-4" : "px-3 py-2.5",
      )}
    >
      <button
        type="button"
        onClick={() => cycleQuery(state)}
        data-testid="mock-top-composer"
        className={cn(
          "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-left",
          size === "desktop" ? "mx-auto max-w-3xl px-4 py-3" : "px-3 py-2.5",
          focusRing,
        )}
      >
        <Plus className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            size === "desktop" ? "text-sm" : "text-xs",
            state.searching ? "font-bold text-[color:var(--text)]" : "font-medium text-[color:var(--text-soft)]",
          )}
        >
          {state.searching ? state.query : "Search a term or abbreviation…"}
        </span>
        <SendHorizontal className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
      </button>
      {size === "desktop" ? (
        <div className="mx-auto mt-3 flex max-w-3xl flex-wrap justify-center gap-2">
          {["mental state examination", "ACT", "auditory hallucination"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PhoneChrome() {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)]">
          <Menu className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-extrabold text-[color:var(--text-heading)]">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
            <Search className="h-3 w-3" aria-hidden="true" />
          </span>
          Dictionary
          <ChevronDown className="h-3 w-3 text-[color:var(--text-muted)]" aria-hidden="true" />
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="flex gap-5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
        {[
          { label: "Terms", active: true },
          { label: "Topics", active: false },
          { label: "More", active: false },
        ].map((tab) => (
          <span
            key={tab.label}
            className={cn(
              "border-b-2 py-2.5 text-sm font-bold",
              tab.active
                ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                : "border-transparent text-[color:var(--text-muted)]",
            )}
          >
            {tab.label}
          </span>
        ))}
      </div>
    </>
  );
}

function DesktopChrome() {
  return (
    <div className="flex gap-6 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-6">
      {[
        { label: "Terms", active: true },
        { label: "Topics", active: false },
        { label: "Compare", active: false },
        { label: "Sources", active: false },
      ].map((tab) => (
        <span
          key={tab.label}
          className={cn(
            "border-b-2 py-3 text-sm font-bold",
            tab.active
              ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
              : "border-transparent text-[color:var(--text-muted)]",
          )}
        >
          {tab.label}
        </span>
      ))}
    </div>
  );
}

function LetterRail({ state }: { state: CatalogueState }) {
  return (
    <nav aria-label="Browse by letter" className="mt-2 flex flex-wrap gap-1">
      {["All", ...letters].map((value) => {
        const empty = value !== "All" && emptyLetters.has(value);
        return (
          <button
            key={value}
            type="button"
            aria-current={state.letter === value ? "page" : undefined}
            disabled={empty}
            onClick={() => state.setLetter(value)}
            className={cn(
              "grid min-h-10 min-w-10 place-items-center rounded-md border text-xs font-extrabold",
              state.letter === value
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                : empty
                  ? "border-[color:var(--border)] text-[color:var(--disabled)]"
                  : "border-[color:var(--border)] text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            {value}
          </button>
        );
      })}
    </nav>
  );
}

function SheetLayer({ state }: { state: CatalogueState }) {
  if (state.sheet === "none") return null;
  const isLetter = state.sheet === "letter";
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={() => state.setSheet("none")}
        className="absolute inset-0 bg-[color:var(--overlay-backdrop)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mock-sheet-title"
        className="relative max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--e3)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 id="mock-sheet-title" className="text-base font-extrabold text-[color:var(--text-heading)]">
              {isLetter ? "Jump to letter" : "Filter and sort"}
            </h3>
            <p className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">
              {isLetter
                ? "Letters with no entry stay visible but are not selectable."
                : "Topics stay in this sheet. Terms / Abbreviations and A–Z remain on the page."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => state.setSheet("none")}
            className={cn(
              "grid min-h-tap min-w-tap place-items-center rounded-lg text-[color:var(--text-muted)]",
              focusRing,
            )}
          >
            <X className="size-icon-md" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        {isLetter ? (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
            {["All", ...letters].map((value) => {
              const empty = value !== "All" && emptyLetters.has(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={empty}
                  onClick={() => {
                    state.setLetter(value);
                    state.setSheet("none");
                  }}
                  className={cn(
                    "grid min-h-11 place-items-center rounded-md border text-xs font-extrabold",
                    state.letter === value
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                      : empty
                        ? "border-[color:var(--border)] text-[color:var(--disabled)]"
                        : "border-[color:var(--border)] text-[color:var(--clinical-accent)]",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {["Topics", "Entry kind", "Source"].map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => state.setSheet("none")}
                className={cn(
                  "flex min-h-tap w-full items-center justify-between rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text-heading)]",
                  focusRing,
                )}
              >
                {group}
                <ChevronDown className="size-icon-sm -rotate-90 text-[color:var(--text-muted)]" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneFrame({ label, initialQuery }: { label: string; initialQuery: boolean }) {
  const state = useCatalogue(initialQuery);
  return (
    <div className="max-w-full shrink-0" style={{ width: "390px" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">390 px · tap the search bar</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
        <PhoneChrome />
        <TopComposer state={state} size="phone" />
        <div className="relative h-[28rem] overflow-y-auto">
          <h2 className="sr-only">Dictionary catalogue</h2>
          <div className="px-3 pb-2 pt-3">
            <FilterBand state={state} slot="phone" />
            <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
              <ScopeToggle state={state} size="phone" />
              <LetterChip state={state} />
            </div>
          </div>
          <div className="mt-1">
            {state.entries.map((entry) => (
              <ResultRow key={entry.term} entry={entry} />
            ))}
          </div>
        </div>
        <SheetLayer state={state} />
      </div>
    </div>
  );
}

function DesktopFrame({ label, initialQuery }: { label: string; initialQuery: boolean }) {
  const state = useCatalogue(initialQuery);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">1440 px · tap the search bar</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3">
        <div className="relative min-w-[42rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]">
          <DesktopChrome />
          <TopComposer state={state} size="desktop" />
          <div className="px-6 pb-3 pt-4">
            <h2 className="sr-only">Dictionary catalogue</h2>
            <FilterBand state={state} slot="desktop" />
            <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
              <ScopeToggle state={state} size="desktop" />
            </div>
            <LetterRail state={state} />
          </div>
          <div className="mt-1">
            {state.entries.map((entry) => (
              <ResultRow key={entry.term} entry={entry} />
            ))}
          </div>
          <SheetLayer state={state} />
        </div>
      </div>
    </div>
  );
}

export function DictionaryNoTitleTopSearchMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · single design
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Title off. Search stays at the top.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            One stack on every screen: the original search bar, then the Filter band, then Terms / Abbreviations and
            A–Z. The in-page catalogue title is gone — the mode nav already names the destination. Phone Terms /
            Abbreviations and A–Z are 36px instead of 28px.
          </p>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Tap the search bar in any frame to run a query and clear it. Filter and A–Z open in-frame sheets. Topics
            stay inside Filter.
          </p>
        </div>
      </header>

      <section aria-labelledby="phone-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
        <h2 id="phone-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Phone
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Composer under the mode nav, not a bottom dock. No page title between search and the Filter band.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <PhoneFrame label="Browse" initialQuery={false} />
          <PhoneFrame label="Search" initialQuery />
        </div>
      </section>

      <section aria-labelledby="desktop-title" className="mx-auto max-w-[92rem] px-4 py-10 sm:px-6 lg:px-8">
        <h2 id="desktop-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Desktop
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Same order: search, Filter band, compact toggle, full A–Z rail. The kicker and catalogue title are omitted.
        </p>
        <div className="mt-5 space-y-6">
          <DesktopFrame label="Browse" initialQuery={false} />
          <DesktopFrame label="Search" initialQuery />
        </div>
      </section>
    </main>
  );
}
