"use client";

import { useState } from "react";
import { ChevronDown, Funnel, Menu, MessageSquarePlus, Plus, Search, SendHorizontal, X } from "lucide-react";

import { focusRing, letters, ResultRow, type SampleEntry } from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → heading companions, round 2 (2026-08-24)
 *
 * Round 1 asked whether Filter can leave the control row. Round 2 starts
 * from the live search state: the query band currently sits *above* the
 * Terms / Abbreviations toggle, so a two-word query and Filter fight for
 * one line while the buttons sit underneath looking orphaned.
 *
 * Image two (browse) already has the stack to keep:
 *   title → toggle + A–Z → results
 * These directions put the query display bar *under* those buttons when
 * text is there, and try four ways to stop the count and the typed words
 * jamming into one truncated phrase.
 *
 * Tap the composer in any frame to run “mental state examination” and
 * clear it again.
 *
 * A–Z currently stands down during a search — the live catalogue does the
 * same, because a letter jump is meaningless against a ranked result set.
 * Round 3 asks where it should live if it must stay visible once text is
 * there: beside the toggle, in the query row, next to the title, or inside
 * Filter.
 * ------------------------------------------------------------------ */

const TERM_COUNT = 96;
const ABBR_COUNT = 11;
const QUERY = "mental state examination";
const QUERY_TERMS = 2;
const QUERY_ABBRS = 2;

type BrowseLayout = "now" | "persistent" | "ribbon";
type SearchLayout = "under-band" | "under-chip" | "under-own-line" | "under-field";
type Layout = BrowseLayout | SearchLayout;
type LetterHome = "hide" | "buttons" | "bar" | "heading" | "sheet";

function usePageState({
  startSearching = false,
  empty = false,
  startSheet = "none",
  letterHome = "hide",
}: {
  startSearching?: boolean;
  empty?: boolean;
  startSheet?: "none" | "letter" | "filter";
  letterHome?: LetterHome;
} = {}) {
  const [scope, setScope] = useState<"terms" | "abbr">("terms");
  const [letter, setLetter] = useState("All");
  const [query, setQuery] = useState(startSearching || empty ? QUERY : "");
  const [sheet, setSheet] = useState<"none" | "letter" | "filter">(startSheet);
  const searching = query.length > 0;
  const termCount = searching ? (empty ? 0 : QUERY_TERMS) : TERM_COUNT;
  const abbrCount = searching ? (empty ? 0 : QUERY_ABBRS) : ABBR_COUNT;
  const count = scope === "abbr" ? abbrCount : termCount;
  const noun = scope === "abbr" ? (count === 1 ? "abbreviation" : "abbreviations") : count === 1 ? "term" : "terms";
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
    empty,
    termCount,
    abbrCount,
    count,
    noun,
    letterHome,
  };
}

type PageState = ReturnType<typeof usePageState>;

const emptyLetters = new Set(["J", "K", "Q", "U", "V", "W", "X", "Y", "Z"]);

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
    term: "Mental state examination",
    kind: "Clinical finding",
    alias: "MSE",
    definition: "A structured assessment of appearance, behaviour, speech, mood, thought, perception and cognition.",
  },
  {
    term: "Mini-Mental State Examination",
    kind: "Scale",
    alias: "MMSE",
    definition: "A brief 30-point screen of orientation, registration, attention, recall and language.",
  },
];

function ScopeToggle({ state }: { state: PageState }) {
  const options = [
    { value: "terms" as const, label: "Terms", count: state.termCount },
    { value: "abbr" as const, label: "Abbreviations", count: state.abbrCount },
  ];
  return (
    <div
      role="group"
      aria-label="Show"
      className="inline-flex h-7 shrink-0 items-stretch overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)]"
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
              "inline-flex h-full items-center gap-1 px-2 text-2xs font-semibold leading-none tracking-tight",
              focusRing,
              active
                ? "bg-[color:var(--tone-purple)] text-[color:var(--surface)]"
                : "bg-transparent text-[color:var(--clinical-accent)]",
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

function LetterChip({ state }: { state: PageState }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheet("letter")}
      aria-haspopup="dialog"
      aria-label={`Letters — ${state.letter === "All" ? "all letters" : `letter ${state.letter}`}`}
      className={cn(
        "inline-flex h-7 max-h-7 shrink-0 items-center gap-0.5 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 text-2xs font-semibold leading-none text-[color:var(--clinical-accent)]",
        focusRing,
      )}
    >
      {state.letter === "All" ? "A–Z" : state.letter}
      <ChevronDown className="size-icon-xs shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
    </button>
  );
}

function HeadingCompanions({ state, letterOnly = false }: { state: PageState; letterOnly?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {letterOnly ? null : <ScopeToggle state={state} />}
      {letterOnly || !state.searching ? <LetterChip state={state} /> : null}
    </div>
  );
}

function FilterControl({ state }: { state: PageState }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheet("filter")}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-sm font-bold text-[color:var(--text-muted)]",
        focusRing,
      )}
    >
      <Funnel className="size-icon-md shrink-0" aria-hidden="true" />
      Filter
    </button>
  );
}

function ClearQuery({ state }: { state: PageState }) {
  return (
    <button
      type="button"
      onClick={() => state.setQuery("")}
      aria-label={`Clear the search for ${state.query}`}
      className={cn(
        "grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]",
        focusRing,
      )}
    >
      <X className="size-icon-md" aria-hidden="true" />
    </button>
  );
}

function CountPhrase({ state, muted = false }: { state: PageState; muted?: boolean }) {
  return (
    <p className={cn("min-w-0 truncate text-sm", muted ? "text-[color:var(--text-muted)]" : null)}>
      <span className="nums font-extrabold text-[color:var(--text-heading)]">{state.count}</span>{" "}
      <span className="font-medium text-[color:var(--text-muted)]">{state.noun}</span>
    </p>
  );
}

function ResultsBar({ state, always }: { state: PageState; always: boolean }) {
  if (!always && !state.searching) return null;
  return (
    <div
      className="flex items-center gap-2 border-y border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5"
      data-testid="dictionary-heading-mockup-bar"
    >
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="nums font-extrabold text-[color:var(--text-heading)]">{state.count}</span>{" "}
        <span className="font-medium text-[color:var(--text-muted)]">{state.noun}</span>
        {state.searching ? (
          <>
            <span className="px-1.5 font-medium text-[color:var(--text-soft)]">·</span>
            <span className="font-extrabold text-[color:var(--text-heading)]">{state.query}</span>
          </>
        ) : null}
      </p>
      {state.searching ? <ClearQuery state={state} /> : null}
      <FilterControl state={state} />
    </div>
  );
}

function NowControlRow({ state }: { state: PageState }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-y border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <ScopeToggle state={state} />
      {state.searching ? null : <LetterChip state={state} />}
      <span className="ml-auto">
        <FilterControl state={state} />
      </span>
    </div>
  );
}

/* Image two’s button row: title stays alone, toggle + A–Z sit on the next
   line. Filter only joins this row while browsing — once there is text, it
   moves into the display bar underneath. */
function ButtonsThenBarRow({
  state,
  showFilter,
  showLetter,
}: {
  state: PageState;
  showFilter: boolean;
  showLetter: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
      <ScopeToggle state={state} />
      {showLetter ? <LetterChip state={state} /> : null}
      {showFilter ? (
        <span className="ml-auto">
          <FilterControl state={state} />
        </span>
      ) : null}
    </div>
  );
}

function QueryBandCard({ state }: { state: PageState }) {
  return (
    <div className="px-3 pb-2">
      <div
        className="search-band relative flex min-h-11 items-center gap-2 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 shadow-[var(--shadow-inset)]"
        data-testid="dictionary-heading-mockup-bar"
      >
        <span className="search-band-lead shrink-0" data-tone="accent" aria-hidden="true" />
        <CountPhrase state={state} />
        <span className="search-band-rule mx-0.5 h-[1.125rem] w-px shrink-0" aria-hidden="true" />
        <p
          className="min-w-[2rem] flex-1 truncate text-sm font-medium text-[color:var(--text-muted)]"
          title={state.query}
        >
          {state.query}
        </p>
        <ClearQuery state={state} />
        {state.letterHome === "bar" ? <LetterChip state={state} /> : null}
        <FilterControl state={state} />
      </div>
    </div>
  );
}

function QueryChipBar({ state }: { state: PageState }) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-y border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5"
      data-testid="dictionary-heading-mockup-bar"
    >
      <CountPhrase state={state} />
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] py-1 pl-2.5 pr-1">
        <span className="min-w-0 truncate text-xs font-bold text-[color:var(--clinical-accent)]">{state.query}</span>
        <button
          type="button"
          onClick={() => state.setQuery("")}
          aria-label={`Clear the search for ${state.query}`}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-[color:var(--clinical-accent)]",
            focusRing,
          )}
        >
          <X className="size-icon-xs" aria-hidden="true" />
        </button>
      </span>
      <span className="ml-auto">
        <FilterControl state={state} />
      </span>
    </div>
  );
}

function QueryOwnLineBar({ state }: { state: PageState }) {
  return (
    <div
      className="border-y border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2"
      data-testid="dictionary-heading-mockup-bar"
    >
      <p className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">{state.query}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <CountPhrase state={state} />
        <span className="ml-auto flex items-center gap-2">
          <ClearQuery state={state} />
          <FilterControl state={state} />
        </span>
      </div>
    </div>
  );
}

function QueryFieldBar({ state }: { state: PageState }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2" data-testid="dictionary-heading-mockup-bar">
      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--text-heading)]">{state.query}</p>
        <button
          type="button"
          onClick={() => state.setQuery("")}
          aria-label={`Clear the search for ${state.query}`}
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)]", focusRing)}
        >
          <X className="size-icon-sm" aria-hidden="true" />
        </button>
      </div>
      {state.letterHome === "bar" ? <LetterChip state={state} /> : null}
      <FilterControl state={state} />
    </div>
  );
}

function PageHeading({
  state,
  companions,
  letterOnly = false,
}: {
  state: PageState;
  companions: boolean;
  letterOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pt-4",
        companions || letterOnly ? "pb-2" : "pb-1",
      )}
    >
      <h3 className="min-w-0 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">
        Clinical terms
      </h3>
      {companions || letterOnly ? <HeadingCompanions state={state} letterOnly={letterOnly} /> : null}
    </div>
  );
}

function EmptyCatalogue({ state }: { state: PageState }) {
  return (
    <div className="px-4 py-10 text-center">
      <Search className="mx-auto size-icon-xl text-[color:var(--decoration-soft)]" aria-hidden="true" />
      <p className="mt-3 text-lg font-extrabold text-[color:var(--text-heading)]">No matching dictionary entries</p>
      <p className="mx-auto mt-1 max-w-xs text-sm font-medium text-[color:var(--text-muted)]">
        Try a broader term, check the spelling, or clear the search to browse the catalogue.
      </p>
      <button
        type="button"
        onClick={() => state.setQuery("")}
        className={cn("mt-4 min-h-11 rounded-lg px-4 text-sm font-bold text-[color:var(--clinical-accent)]", focusRing)}
      >
        Clear the search
      </button>
    </div>
  );
}

function SiteComposer({ state }: { state: PageState }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <button
        type="button"
        onClick={() => state.setQuery(state.query === "" ? QUERY : "")}
        className={cn(
          "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-left",
          focusRing,
        )}
      >
        <Plus className="size-icon-md shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs",
            state.searching ? "font-bold text-[color:var(--text)]" : "font-medium text-[color:var(--text-soft)]",
          )}
        >
          {state.searching ? state.query : "Search a term or abbreviation…"}
        </span>
        <SendHorizontal className="size-icon-md shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
      </button>
    </div>
  );
}

function SheetLayer({ state }: { state: PageState }) {
  const close = () => state.setSheet("none");
  if (state.sheet === "none") return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-[color:var(--overlay-backdrop)]"
      />
      <div className="relative max-h-[20rem] overflow-y-auto rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e3)]">
        <p className="pb-2 text-sm font-extrabold text-[color:var(--text-heading)]">
          {state.sheet === "letter" ? "Jump to letter" : "Filter the catalogue"}
        </p>
        {state.sheet === "letter" ? (
          <>
            <button
              type="button"
              onClick={() => {
                state.setLetter("All");
                close();
              }}
              className={cn(
                "mb-1.5 h-11 w-full rounded-lg border text-sm font-extrabold",
                focusRing,
                state.letter === "All"
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                  : "border-[color:var(--border)] text-[color:var(--text)]",
              )}
            >
              All letters
            </button>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              {letters.map((option) => {
                const vacant = emptyLetters.has(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={vacant}
                    onClick={() => {
                      state.setLetter(option);
                      close();
                    }}
                    className={cn(
                      "grid h-11 place-items-center rounded-lg border text-sm font-extrabold",
                      focusRing,
                      state.letter === option
                        ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                        : vacant
                          ? "border-[color:var(--border)] text-[color:var(--disabled)]"
                          : "border-[color:var(--border)] text-[color:var(--clinical-accent)]",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {state.letterHome === "sheet" ? (
              <div className="mb-3">
                <p className="pb-1.5 text-xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
                  Jump to letter
                </p>
                <button
                  type="button"
                  onClick={() => {
                    state.setLetter("All");
                    close();
                  }}
                  className={cn(
                    "mb-1.5 h-11 w-full rounded-lg border text-sm font-extrabold",
                    focusRing,
                    state.letter === "All"
                      ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                      : "border-[color:var(--border)] text-[color:var(--text)]",
                  )}
                >
                  All letters
                </button>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
                  {letters.map((option) => {
                    const vacant = emptyLetters.has(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={vacant}
                        onClick={() => {
                          state.setLetter(option);
                          close();
                        }}
                        className={cn(
                          "grid h-11 place-items-center rounded-lg border text-sm font-extrabold",
                          focusRing,
                          state.letter === option
                            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                            : vacant
                              ? "border-[color:var(--border)] text-[color:var(--disabled)]"
                              : "border-[color:var(--border)] text-[color:var(--clinical-accent)]",
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="text-sm font-medium text-[color:var(--text-muted)]">
              {state.letterHome === "sheet"
                ? "A–Z lives in this sheet during a search, next to topics, kinds and sources."
                : "Topics, kinds and sources stay in this sheet. Scope and letter stay on the page so the sheet does not hide the view you are already in."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function isSearchLayout(layout: Layout): layout is SearchLayout {
  return layout === "under-band" || layout === "under-chip" || layout === "under-own-line" || layout === "under-field";
}

function PhoneFrame({
  layout,
  label,
  note,
  width = 390,
  startSearching = false,
  empty = false,
  letterHome = "hide",
  startSheet = "none",
}: {
  layout: Layout;
  label: string;
  note: string;
  width?: number;
  startSearching?: boolean;
  empty?: boolean;
  letterHome?: LetterHome;
  startSheet?: "none" | "letter" | "filter";
}) {
  const state = usePageState({ startSearching, empty, letterHome, startSheet });
  const buttonsThenBar = isSearchLayout(layout);
  const companions = layout === "persistent" || layout === "ribbon";
  const showLetterOnButtons = letterHome === "buttons" || (letterHome === "hide" && !state.searching);
  return (
    <div className="max-w-full shrink-0" style={{ width: `${width}px` }}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</p>
          <p className="mt-0.5 text-3xs font-medium text-[color:var(--text-muted)]">{note}</p>
        </div>
        <span className="shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">{width} px</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
        <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)]">
            <Menu className="size-icon-md" aria-hidden="true" />
          </span>
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-extrabold text-[color:var(--text-heading)]">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]">
              <Search className="size-icon-xs" aria-hidden="true" />
            </span>
            Dictionary
            <ChevronDown className="size-icon-xs text-[color:var(--text-muted)]" aria-hidden="true" />
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]">
            <MessageSquarePlus className="size-icon-md" aria-hidden="true" />
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
        <div className="relative h-[28rem] overflow-y-auto pb-16">
          <PageHeading state={state} companions={companions} letterOnly={letterHome === "heading"} />
          {layout === "now" ? (
            <>
              {state.searching ? (
                <div className="flex items-center gap-2 border-y border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5">
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="nums font-extrabold text-[color:var(--text-heading)]">{state.count}</span>{" "}
                    <span className="font-medium text-[color:var(--text-muted)]">{state.noun}</span>
                    <span className="px-1.5 font-medium text-[color:var(--text-soft)]">·</span>
                    <span className="font-extrabold text-[color:var(--text-heading)]">{state.query}</span>
                  </p>
                  <ClearQuery state={state} />
                </div>
              ) : null}
              <NowControlRow state={state} />
            </>
          ) : null}
          {layout === "persistent" || layout === "ribbon" ? (
            <ResultsBar state={state} always={layout === "persistent"} />
          ) : null}
          {buttonsThenBar ? (
            <>
              <ButtonsThenBarRow state={state} showFilter={!state.searching} showLetter={showLetterOnButtons} />
              {state.searching ? (
                layout === "under-band" ? (
                  <QueryBandCard state={state} />
                ) : layout === "under-chip" ? (
                  <QueryChipBar state={state} />
                ) : layout === "under-own-line" ? (
                  <QueryOwnLineBar state={state} />
                ) : (
                  <QueryFieldBar state={state} />
                )
              ) : null}
            </>
          ) : null}
          {state.empty && state.searching ? (
            <EmptyCatalogue state={state} />
          ) : (
            <div className="mt-1">
              {(state.searching ? queryEntries : catalogueEntries).map((entry) => (
                <ResultRow key={entry.term} entry={entry} />
              ))}
            </div>
          )}
        </div>
        <SiteComposer state={state} />
        <SheetLayer state={state} />
      </div>
    </div>
  );
}

export function DictionaryHeadingControlsMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · heading companions
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Buttons first, query bar underneath
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Browse already works as title, then Terms / A–Z, then results. The live search state inverts that: the query
            band sits above the toggle, so “mental state examination” and Filter share one jammed line. These frames
            keep the button row where it is and put the display bar underneath once there is text. A–Z currently
            disappears during a search — the same as production. The section below tries four homes for it. Tap any
            composer to clear or restore the query.
          </p>
        </div>
      </header>

      <section aria-labelledby="search-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
        <h2 id="search-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          When text is there
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Same stack as the browse frame: title, then the joined toggle, then the query display. Four ways to stop the
          count and the typed words colliding.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <PhoneFrame
            layout="under-band"
            startSearching
            label="03 Band under buttons"
            note="Production band moved under the toggle. Query still truncates against Filter."
          />
          <PhoneFrame
            layout="under-chip"
            startSearching
            label="04 Query chip"
            note="The typed words become a dismissible chip. Count and Filter no longer share that string."
          />
          <PhoneFrame
            layout="under-own-line"
            startSearching
            label="05 Query owns a line"
            note="The two-word query wraps in full. Count, clear and Filter stay on the stable row below."
          />
          <PhoneFrame
            layout="under-field"
            startSearching
            label="06 Query field"
            note="A cleaned field shows only the query. Count lives in the toggle, Filter sits beside the field."
          />
        </div>
      </section>

      <section aria-labelledby="az-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
        <h2 id="az-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Where A–Z goes
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Today it stands down the moment a query runs, because a letter jump does not rank a result set. If it must
          stay on screen, it has to sit somewhere that does not fight the query field. All four frames use direction 06
          as the search chrome.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <PhoneFrame
            layout="under-field"
            startSearching
            letterHome="buttons"
            label="07 Beside the toggle"
            note="A–Z stays on the button row, exactly as in browse. The query field is underneath."
          />
          <PhoneFrame
            layout="under-field"
            startSearching
            letterHome="bar"
            label="08 In the query row"
            note="A–Z sits with Filter beside the field. Toggle row is only Terms / Abbreviations."
          />
          <PhoneFrame
            layout="under-field"
            startSearching
            letterHome="heading"
            label="09 Next to the title"
            note="A–Z is a heading companion. Toggle stays on its own row above the field."
          />
          <PhoneFrame
            layout="under-field"
            startSearching
            letterHome="sheet"
            startSheet="filter"
            label="10 Inside Filter"
            note="No page chip. Open Filter to jump letters. Sheet starts open so the home is visible."
          />
        </div>
      </section>

      <section aria-labelledby="zero-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
        <h2 id="zero-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Zero matches
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          The jammed live state. Count is zero, so it must not sit inside the query field. Direction 06 keeps “0” on the
          toggle and the typed words in the field.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <PhoneFrame
            layout="now"
            startSearching
            empty
            label="Now · live order"
            note="Band above the toggle. Zero count and the query share one line."
          />
          <PhoneFrame
            layout="under-field"
            startSearching
            empty
            label="06 Query field"
            note="Toggle reads Terms 0. The field only holds the query. Empty state sits below."
          />
        </div>
      </section>

      <section aria-labelledby="browse-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
        <h2 id="browse-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Browse, for comparison
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Round 1 frames. Image two is 02: title, then toggle and A–Z, no bar until a search.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <PhoneFrame layout="now" label="Now" note="Title alone. Toggle, A–Z and Filter share a control row." />
          <PhoneFrame
            layout="persistent"
            label="01 Persistent bar"
            note="Toggle + A–Z on the heading. Filter always lives in the bar."
          />
          <PhoneFrame
            layout="ribbon"
            label="02 Ribbon only"
            note="No bar while browsing. Filter appears only once a query runs."
          />
        </div>
      </section>

      <section aria-labelledby="narrow-title" className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
        <h2 id="narrow-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          320 px · query under the buttons
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Direction 05 at the stress width. The query keeps both words; Filter stays on the count row.
        </p>
        <div className="mt-5">
          <PhoneFrame
            layout="under-own-line"
            startSearching
            label="05 Query owns a line"
            note="Wrap is the query, not a fight with Filter."
            width={320}
          />
        </div>
      </section>
    </main>
  );
}
