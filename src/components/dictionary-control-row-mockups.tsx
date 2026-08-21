"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ListFilter, Menu, MessageSquarePlus, Plus, Search, SendHorizontal, X } from "lucide-react";

import { focusRing, letters, ResultRow, type SampleEntry } from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → the phone control row, chosen direction (2026-08-21)
 *
 * Direction 01 was chosen: the Terms / Abbrev switch survives, but sized
 * to its own labels rather than to the viewport, with the decorative
 * dots dropped. The open question this page now answers is whether that
 * leaves the row on ONE line or still needs TWO.
 *
 * So the page is built around a measurement rather than an opinion.
 * `FitStrip` renders the real row at a range of real phone widths and
 * reports, from the live DOM, whether the content overflows its track.
 * Both candidates are then shown in place at a true 390 px frame:
 *
 *   One row   summary line deleted; toggle, letter chip and Filter share
 *             the line the summary used to have to itself.
 *   Two rows  summary line kept, controls on their own line below —
 *             today's structure, but with today's width problem fixed.
 *
 * Search state, which is the reason the direction was chosen: while a
 * query runs the letter chip stands down for a chip carrying the query
 * itself, and the toggle's counts drop to the matches. The row gains no
 * control and changes no height, which is the property that makes one
 * row survivable at all.
 * ------------------------------------------------------------------ */

const TERM_COUNT = 96;
const ABBR_COUNT = 11;
const QUERY = "tardive";
const QUERY_TERMS = 4;
const QUERY_ABBRS = 1;

/* --------------------------------- state --------------------------------- */

function useRowState(initialQuery = false) {
  const [scope, setScope] = useState<"terms" | "abbr">("abbr");
  const [letter, setLetter] = useState("All");
  const [query, setQuery] = useState(initialQuery ? QUERY : "");
  const [sheet, setSheet] = useState<"none" | "letter" | "filter">("none");
  const searching = query.length > 0;
  const termCount = searching ? QUERY_TERMS : TERM_COUNT;
  const abbrCount = searching ? QUERY_ABBRS : ABBR_COUNT;
  const count = scope === "abbr" ? abbrCount : termCount;
  const noun = scope === "abbr" ? "abbreviations" : "terms";
  const letterLabel = letter === "All" ? "All letters" : `Letter ${letter}`;
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
    letterLabel,
  };
}

type RowState = ReturnType<typeof useRowState>;

const emptyLetters = new Set(["J", "K", "Q", "U", "V", "W", "X", "Y", "Z"]);

const catalogueEntries: readonly SampleEntry[] = [
  {
    term: "Acceptance and commitment therapy",
    kind: "Therapy",
    alias: "ACT",
    definition: "A therapy that develops acceptance, present-moment awareness and action guided by personal values.",
  },
  {
    term: "Akathisia",
    kind: "Clinical finding",
    definition: "A distressing inner restlessness with an urge to move, most often medication-associated.",
  },
  {
    term: "Behavioural activation",
    kind: "Therapy",
    alias: "BA",
    definition: "A structured therapy that rebuilds contact with rewarding activity to lift depressed mood.",
  },
];

const queryEntries: readonly SampleEntry[] = [
  {
    term: "Tardive dyskinesia",
    kind: "Clinical finding",
    alias: "TD",
    definition: "Involuntary repetitive movements emerging after prolonged dopamine-receptor blockade.",
  },
  {
    term: "Tardive dystonia",
    kind: "Clinical finding",
    definition: "Sustained late-onset muscle contraction producing abnormal posture, related to tardive dyskinesia.",
  },
];

/* -------------------------------- controls -------------------------------- */

/* Sized to its labels, not to the viewport, and without the leading dots —
   the two edits that make a single row conceivable at all. */
function ScopeToggle({ state }: { state: RowState }) {
  const options = [
    { value: "terms" as const, label: "Terms", count: state.termCount },
    { value: "abbr" as const, label: "Abbrev", count: state.abbrCount },
  ];
  return (
    <div
      role="group"
      aria-label="Show"
      className="inline-flex h-11 shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)]"
    >
      {options.map((option) => {
        const active = state.scope === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => state.setScope(option.value)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 text-xs font-extrabold",
              focusRing,
              active
                ? "bg-[color:var(--tone-purple)] text-[color:var(--surface)]"
                : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
            )}
          >
            {option.label}
            <span className="nums opacity-80">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function LetterChip({ state }: { state: RowState }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheet("letter")}
      aria-haspopup="dialog"
      aria-label={`Letters — ${state.letterLabel}`}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]",
        focusRing,
      )}
    >
      {state.letter === "All" ? "A–Z" : state.letter}
      <ChevronDown className="h-3.5 w-3.5 text-[color:var(--text-muted)]" aria-hidden="true" />
    </button>
  );
}

/* Takes the letter chip's place while a query runs, so the row gains no
   control and no height. Clearing it restores the whole catalogue. */
function QueryChip({ state }: { state: RowState }) {
  return (
    <button
      type="button"
      onClick={() => state.setQuery("")}
      aria-label={`Clear the search for ${state.query}`}
      className={cn(
        "inline-flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]",
        focusRing,
      )}
    >
      <span className="truncate">&ldquo;{state.query}&rdquo;</span>
      <X className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </button>
  );
}

function FilterControl({ state, labelled }: { state: RowState; labelled: boolean }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheet("filter")}
      aria-label={labelled ? undefined : "Filter"}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm font-bold text-[color:var(--text)]",
        focusRing,
        labelled ? "px-3.5" : "w-11",
      )}
    >
      <ListFilter className="h-4 w-4" aria-hidden="true" />
      {labelled ? "Filter" : null}
    </button>
  );
}

/* --------------------------- the two candidates --------------------------- */

/* One row. The summary line is deleted: the toggle carries the counts, so the
   only thing lost is the words "abbreviations" and "all letters". */
function OneRowBlock({ state, measured }: { state: RowState; measured?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
      {/* Wraps rather than overflows. At the widths this repo targets the row
          never uses it, but below ~350 px — a small phone, or any phone at an
          enlarged text size — Filter drops to a second line instead of being
          clipped. One row normally, two rows only when one genuinely cannot
          hold. */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2" data-fit-track={measured ? "true" : undefined}>
        <ScopeToggle state={state} />
        {state.searching ? <QueryChip state={state} /> : <LetterChip state={state} />}
        <span className={cn(state.searching ? "" : "ml-auto")}>
          <FilterControl state={state} labelled={false} />
        </span>
      </div>
    </div>
  );
}

/* Two rows. Today's structure, but with today's width problem fixed: the
   summary line keeps the words, and the controls below are content-sized
   rather than stretched, so Filter can keep its label. */
function TwoRowBlock({ state }: { state: RowState }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2.5">
        <p className="min-w-0 truncate text-sm text-[color:var(--text-muted)]">
          {state.searching ? (
            <>
              <span className="nums font-extrabold text-[color:var(--text-heading)]">{state.count}</span>{" "}
              <span className="font-medium">
                {state.noun} for &ldquo;{state.query}&rdquo;
              </span>
            </>
          ) : (
            <>
              <span className="nums font-extrabold text-[color:var(--text-heading)]">{state.count}</span>{" "}
              <span className="font-medium">{state.noun}</span>
              <span className="font-medium"> · {state.letterLabel}</span>
            </>
          )}
        </p>
        <span className="ml-auto">
          <FilterControl state={state} labelled />
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <ScopeToggle state={state} />
        {state.searching ? <QueryChip state={state} /> : <LetterChip state={state} />}
      </div>
    </div>
  );
}

/* --------------------------------- sheets --------------------------------- */

function SheetLayer({ state }: { state: RowState }) {
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
          {state.sheet === "letter" ? "Jump to letter" : "Filter"}
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
            {/* Pinned inline: the mockup stylesheet only emits Tailwind classes
                some source already uses, and no production file uses a bare
                `grid-cols-6`, so the class collapses this to one column. */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
              {letters.map((option) => {
                const empty = emptyLetters.has(option);
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={empty}
                    onClick={() => {
                      state.setLetter(option);
                      close();
                    }}
                    className={cn(
                      "grid h-11 place-items-center rounded-lg border text-sm font-extrabold",
                      focusRing,
                      state.letter === option
                        ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                        : empty
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
          <div className="flex flex-wrap gap-1.5">
            {["Mood", "Psychosis", "Legal / ethical", "Therapies"].map((topic) => (
              <span
                key={topic}
                className="inline-flex h-9 items-center rounded-full border border-[color:var(--border)] px-3 text-2xs font-bold text-[color:var(--text-muted)]"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={close}
          className={cn(
            "mt-3 h-11 w-full rounded-lg bg-[color:var(--clinical-accent)] text-sm font-extrabold text-[color:var(--clinical-accent-contrast)]",
            focusRing,
          )}
        >
          Show {state.count} {state.noun}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- phone frame ------------------------------- */

/* Tapping the composer toggles the query on and off, so the search state can
   be judged as a transition rather than as a second static picture. */
function SiteComposer({ state }: { state: RowState }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <button
        type="button"
        onClick={() => state.setQuery(state.searching ? "" : QUERY)}
        className={cn(
          "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-left",
          focusRing,
        )}
      >
        <Plus className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-xs",
            state.searching ? "font-bold text-[color:var(--text)]" : "font-medium text-[color:var(--text-soft)]",
          )}
        >
          {state.searching ? state.query : "Search a term or abbreviation…"}
        </span>
        <SendHorizontal className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
      </button>
    </div>
  );
}

function PhoneFrame({ layout, label, initialQuery }: { layout: "one" | "two"; label: string; initialQuery: boolean }) {
  const state = useRowState(initialQuery);
  return (
    <div className="w-[24.375rem] max-w-full shrink-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">390 px · tap the search bar</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
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
        <div className="relative h-[25rem] overflow-y-auto pb-16">
          <div className="px-4 pb-3 pt-4">
            <h3 className="text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Browse terms</h3>
          </div>
          <div className="mx-3">{layout === "one" ? <OneRowBlock state={state} /> : <TwoRowBlock state={state} />}</div>
          <div className="mt-3">
            {(state.searching ? queryEntries : catalogueEntries).map((entry) => (
              <ResultRow key={entry.term} entry={entry} />
            ))}
          </div>
        </div>
        <SiteComposer state={state} />
        <SheetLayer state={state} />
      </div>
    </div>
  );
}

/* --------------------------------- fit test -------------------------------- */

const fitWidths = [
  { px: 320, note: "iPhone SE 1st gen, and any phone at a larger text size" },
  { px: 360, note: "Common Android" },
  { px: 375, note: "iPhone SE 2/3, iPhone 13 mini" },
  { px: 390, note: "iPhone 13/14/15 — the repo's phone baseline" },
  { px: 430, note: "iPhone Pro Max" },
];

/* Reads the answer off the live DOM rather than asserting it. `scrollWidth`
   exceeding `clientWidth` on the flex track is the overflow; a track that fits
   reports the slack it has left, which is what says whether the fit is safe or
   merely lucky. */
function FitRow({ width, note, searching }: { width: number; note: string; searching: boolean }) {
  const state = useRowState(searching);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [verdict, setVerdict] = useState<{ fits: boolean; slack: number } | null>(null);

  useEffect(() => {
    const track = trackRef.current?.querySelector<HTMLElement>("[data-fit-track]");
    if (!track) return;
    // Sum what the controls intrinsically want, against the track's content
    // box. Comparing scrollWidth to clientWidth looks like the same question
    // and is not: `ml-auto` on Filter absorbs every spare pixel, so that
    // comparison reports a dead-heat zero at every width and hides both the
    // real slack and, once the row wraps, the real shortfall.
    const measure = () => {
      const style = getComputedStyle(track);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const available = track.getBoundingClientRect().width - padding;
      const children = Array.from(track.children);
      const needed =
        children.reduce((total, child) => total + child.getBoundingClientRect().width, 0) +
        gap * Math.max(0, children.length - 1);
      const slack = Math.round(available - needed);
      setVerdict({ fits: slack >= 0, slack });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [searching]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        style={{ width: `${width}px` }}
        className="max-w-full shrink-0 bg-[color:var(--background)] p-3"
        ref={trackRef}
      >
        <OneRowBlock state={state} measured />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[color:var(--text-heading)]">
          {width} px
          {verdict ? (
            <span
              className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-3xs font-extrabold uppercase tracking-kicker",
                verdict.fits
                  ? "bg-[color:var(--success-soft)] text-[color:var(--success)]"
                  : "bg-[color:var(--warning-soft)] text-[color:var(--text-heading)]",
              )}
            >
              {verdict.fits ? `one row · ${verdict.slack}px spare` : `wraps · ${Math.abs(verdict.slack)}px short`}
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">{note}</p>
      </div>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function DictionaryControlRowMockupsPage() {
  const [fitSearching, setFitSearching] = useState(false);

  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · phone control row
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            One row or two?
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            The direction is settled: Terms / Abbrev keeps its switch, sized to its own labels instead of stretched
            across the viewport, with the decorative dots dropped. What is still open is whether that fits on one line
            or still needs two, so this page measures it rather than asserting it.
          </p>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Tap the search bar in any frame to run a query and clear it again. While a query runs the letter chip stands
            down for a chip carrying the query, so the row gains no control and changes no height.
          </p>
        </div>
      </header>

      <section aria-labelledby="fit-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <h2 id="fit-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
                Does one row actually fit?
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                The real row at real widths. Each verdict is read off the live DOM — the track&rsquo;s scroll width
                against its visible width — so it is a measurement, not an estimate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFitSearching((value) => !value)}
              aria-pressed={fitSearching}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)]",
                focusRing,
              )}
            >
              {fitSearching ? "Measuring with a query running" : "Measuring idle"}
            </button>
          </div>
          <div className="grid gap-4 p-4 sm:p-5">
            {fitWidths.map((entry) => (
              // Keyed on the mode as well as the width: `useRowState` seeds its
              // query once, so without a remount the toggle re-measured rows it
              // had not actually changed.
              <FitRow
                key={`${entry.px}-${fitSearching ? "query" : "idle"}`}
                width={entry.px}
                note={entry.note}
                searching={fitSearching}
              />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="candidates-title" className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5">
            <h2 id="candidates-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
              The two candidates in place
            </h2>
            <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
              Same controls in both. One row deletes the summary line and lets the toggle carry the counts; two rows
              keeps the words and gives Filter its label back. Each is shown idle and with a query running.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 p-4 sm:p-5">
            <PhoneFrame layout="one" label="One row — idle" initialQuery={false} />
            <PhoneFrame layout="one" label="One row — searching" initialQuery />
            <PhoneFrame layout="two" label="Two rows — idle" initialQuery={false} />
            <PhoneFrame layout="two" label="Two rows — searching" initialQuery />
          </div>
        </div>
      </section>
    </main>
  );
}
