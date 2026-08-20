"use client";

import { useState } from "react";
import { Check, ChevronDown, ListFilter, Menu, MessageSquarePlus, Plus, Search, SendHorizontal } from "lucide-react";

import { focusRing, letters, ResultRow, sampleEntries } from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → the phone control row, condensed (2026-08-21)
 *
 * Everything else on this page is kept exactly as it is today: the
 * kicker, the title, the summary line, desktop sort / view / Filter,
 * the letter rail, the result rows, and the site-wide composer at the
 * bottom — which, with Search and Browse merged, is the only search
 * surface the mode has.
 *
 * The one thing under review is the phone control row: today a pair of
 * dotted pills for Terms / Abbrev plus an A–Z dropdown, sitting on a
 * second line below the summary. It is the widest, tallest and least
 * dense part of the header.
 *
 * Three things make it expensive, and each version below attacks a
 * different one:
 *
 *   01  The second line itself. Fold both controls up into the summary
 *       line and the row disappears.
 *   02  The segmented control. It must always draw the option you did
 *       not pick; a dropdown draws only the one you did.
 *   03  Having two controls at all. Scope and letters are one question
 *       — what am I looking at — so one control can answer it.
 *
 * All three drop the leading dots. They carry no information the label
 * and count do not already carry, and they cost width on the one
 * surface that has none to spare.
 * ------------------------------------------------------------------ */

type Version = "fused" | "dropdowns" | "single";

const TERM_COUNT = 96;
const ABBR_COUNT = 11;

const versions: ReadonlyArray<{
  id: Version;
  number: string;
  name: string;
  attacks: string;
  summary: string;
  strengths: readonly string[];
  cost: string;
  saving: string;
  recommended?: boolean;
}> = [
  {
    id: "fused",
    number: "01",
    name: "Fold it into the line above",
    attacks: "The second line",
    summary:
      "The summary line already says what the list is — 11 abbreviations, all letters — and it sits on a line that is two thirds empty. So the controls move up into it and the second row goes away entirely. Terms / Abbrev becomes one joined toggle with no gap and no dots, A–Z becomes a small chip, and Filter loses its label to become an icon, which is what it already is on every other mode's phone view.",
    strengths: ["Both scopes stay one tap away", "Removes a whole row", "Nothing is hidden behind a menu"],
    cost: "The tightest of the three. Four things share one line, so the toggle segments are small targets and a longer scope label would not fit.",
    saving: "2 rows → 1",
    recommended: true,
  },
  {
    id: "dropdowns",
    number: "02",
    name: "Drop the segmented control",
    attacks: "The unselected option",
    summary:
      "A segmented control has to draw the choice you did not make, so Terms keeps its 96 on screen while you are reading abbreviations. A dropdown draws only the live value. Both decisions become matched dropdowns of the same weight, side by side, each showing its own count — and because neither reserves space for its alternative, the pair fits comfortably where the old toggle alone did not.",
    strengths: ["Widest labels of the three", "Scales if a third scope is added", "Two evenly weighted targets"],
    cost: "Switching scope costs a tap to open and a tap to choose, and you cannot see the other option's count without opening it.",
    saving: "2 rows → 1",
  },
  {
    id: "single",
    number: "03",
    name: "One control, one sheet",
    attacks: "Having two controls",
    summary:
      "Scope and letter are the same question asked twice: what am I looking at. One wide button answers it as a sentence — Abbreviations · All letters — with the count as a trailing pill and Filter beside it. Tapping it opens one sheet with both sections. It is the largest tap target of the three by a wide margin, and the only one that reads as a statement rather than a set of switches.",
    strengths: ["Largest tap target", "Reads as a sentence", "One sheet holds both decisions"],
    cost: "Everything is two taps, and a reader has to open the sheet to discover that abbreviations exist at all.",
    saving: "2 rows → 1, 3 controls → 2",
  },
];

/* --------------------------------- state --------------------------------- */

function useRowState() {
  const [scope, setScope] = useState<"terms" | "abbr">("abbr");
  const [letter, setLetter] = useState("All");
  const [sheet, setSheet] = useState<"none" | "scope" | "letter" | "both" | "filter">("none");
  const count = scope === "abbr" ? ABBR_COUNT : TERM_COUNT;
  const noun = scope === "abbr" ? "abbreviations" : "terms";
  const scopeLabel = scope === "abbr" ? "Abbreviations" : "Definitions";
  const letterLabel = letter === "All" ? "All letters" : `Letter ${letter}`;
  return { scope, setScope, letter, setLetter, sheet, setSheet, count, noun, scopeLabel, letterLabel };
}

type RowState = ReturnType<typeof useRowState>;

/* Letters the sample data can fill, so the disabled ones read as real. */
const emptyLetters = new Set(["J", "K", "Q", "U", "V", "W", "X", "Y", "Z"]);

/* ------------------------------ shared pieces ----------------------------- */

function SummaryLine({ state, children }: { state: RowState; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <p className="shrink-0 text-sm text-[color:var(--text-muted)]">
        <span className="nums font-extrabold text-[color:var(--text-heading)]">{state.count}</span>{" "}
        <span className="font-medium">{state.noun}</span>
      </p>
      <p className="hidden shrink-0 text-sm font-medium text-[color:var(--text-muted)] sm:block">{state.letterLabel}</p>
      {children}
    </div>
  );
}

function FilterControl({ state, labelled }: { state: RowState; labelled: boolean }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheet("filter")}
      aria-label={labelled ? undefined : "Filter"}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
        labelled ? "px-3.5" : "w-11",
      )}
    >
      <ListFilter className="h-4 w-4" aria-hidden="true" />
      {labelled ? "Filter" : null}
    </button>
  );
}

/* Desktop sort, unchanged — shown only so the versions are judged in the real
   surrounding, never as part of the proposal. */
function SortSegment() {
  return (
    <div
      role="group"
      aria-label="Sort"
      className="inline-flex h-11 shrink-0 overflow-hidden rounded-lg border border-[color:var(--border)]"
    >
      {[
        { label: "Relevance", active: true },
        { label: "A–Z", active: false },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={option.active}
          className={cn(
            "px-3.5 text-sm font-bold",
            focusRing,
            option.active
              ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
              : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* Desktop scope switch, unchanged: dots and full labels are affordable at
   1440 px. The phone versions below are what this study is about. */
function ScopeSegmentDesktop({ state }: { state: RowState }) {
  const options = [
    { value: "terms" as const, label: "Definitions", count: TERM_COUNT },
    { value: "abbr" as const, label: "Abbreviations", count: ABBR_COUNT },
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
              "inline-flex items-center gap-2 px-3.5 text-sm font-bold",
              focusRing,
              active
                ? "bg-[color:var(--tone-purple)] text-[color:var(--surface)]"
                : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active ? "bg-[color:var(--surface)]" : "bg-[color:var(--clinical-accent)]",
              )}
            />
            {option.label}
            <span className="nums text-2xs font-extrabold opacity-80">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function LetterRailDesktop({ state }: { state: RowState }) {
  return (
    <nav aria-label="Browse by letter" className="flex flex-wrap gap-1">
      {["All", ...letters].map((value) => {
        const empty = value !== "All" && emptyLetters.has(value);
        const active = state.letter === value;
        return (
          <button
            key={value}
            type="button"
            aria-current={active ? "page" : undefined}
            disabled={empty}
            onClick={() => state.setLetter(value)}
            className={cn(
              "grid h-10 min-w-10 place-items-center rounded-lg border px-2 text-xs font-extrabold",
              focusRing,
              active
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

/* ------------------------ the row, version by version ---------------------- */

/* Today. Two dotted pills and a dropdown on a line of their own, below a
   summary line that is mostly empty. This is the thing being replaced. */
function TodayRow({ state }: { state: RowState }) {
  const options = [
    { value: "terms" as const, label: "Terms", count: TERM_COUNT },
    { value: "abbr" as const, label: "Abbrev", count: ABBR_COUNT },
  ];
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div
        role="group"
        aria-label="Show"
        className="inline-flex h-11 min-w-0 flex-1 overflow-hidden rounded-lg border border-[color:var(--border)]"
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
                "inline-flex flex-1 items-center justify-center gap-1.5 px-2 text-sm font-bold",
                focusRing,
                active
                  ? "bg-[color:var(--tone-purple)] text-[color:var(--surface)]"
                  : "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  active ? "bg-[color:var(--surface)]" : "bg-[color:var(--clinical-accent)]",
                )}
              />
              {option.label}
              <span className="nums text-2xs font-extrabold opacity-80">{option.count}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => state.setSheet("letter")}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-bold text-[color:var(--text)]",
          focusRing,
        )}
      >
        A–Z {state.letter === "All" ? "All" : state.letter}
        <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
      </button>
    </div>
  );
}

/* 01 — the joined toggle. No gap between segments, no dots, sized to its own
   labels, sharing the summary line with the letter chip and Filter. */
function FusedRow({ state }: { state: RowState }) {
  const options = [
    { value: "terms" as const, label: "Terms", count: TERM_COUNT },
    { value: "abbr" as const, label: "Abbrev", count: ABBR_COUNT },
  ];
  return (
    <div className="flex items-center gap-2 px-3 py-2">
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
              <span className="nums text-2xs opacity-80">{option.count}</span>
            </button>
          );
        })}
      </div>
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
      <span className="ml-auto">
        <FilterControl state={state} labelled={false} />
      </span>
    </div>
  );
}

/* 02 — matched dropdowns. Neither reserves width for the option it is not
   showing, which is the whole saving. */
function DropdownsRow({ state }: { state: RowState }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        onClick={() => state.setSheet("scope")}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs",
          focusRing,
        )}
      >
        <span className="truncate font-extrabold text-[color:var(--tone-purple)]">{state.scopeLabel}</span>
        <span className="nums shrink-0 text-2xs font-extrabold text-[color:var(--text-muted)]">{state.count}</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => state.setSheet("letter")}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs",
          focusRing,
        )}
      >
        <span className="truncate font-extrabold text-[color:var(--clinical-accent)]">{state.letterLabel}</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
      </button>
      <FilterControl state={state} labelled={false} />
    </div>
  );
}

/* 03 — one button for both decisions, and one sheet behind it. */
function SingleRow({ state }: { state: RowState }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        onClick={() => state.setSheet("both")}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm",
          focusRing,
        )}
      >
        <span className="truncate font-extrabold text-[color:var(--tone-purple)]">{state.scopeLabel}</span>
        <span aria-hidden="true" className="shrink-0 font-bold text-[color:var(--text-soft)]">
          ·
        </span>
        <span className="shrink-0 font-extrabold text-[color:var(--clinical-accent)]">
          {state.letter === "All" ? "A–Z" : state.letter}
        </span>
        <span className="nums ml-auto shrink-0 rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-2xs font-extrabold text-[color:var(--text-muted)]">
          {state.count}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
      </button>
      <FilterControl state={state} labelled={false} />
    </div>
  );
}

function VersionRow({ version, state }: { version: Version | "today"; state: RowState }) {
  if (version === "today") return <TodayRow state={state} />;
  if (version === "fused") return <FusedRow state={state} />;
  if (version === "dropdowns") return <DropdownsRow state={state} />;
  return <SingleRow state={state} />;
}

/* --------------------------------- sheets --------------------------------- */

function SheetShell({ title, state, children }: { title: string; state: RowState; children: React.ReactNode }) {
  const close = () => state.setSheet("none");
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={close}
        className="absolute inset-0 bg-[color:var(--overlay-backdrop)]"
      />
      <div className="relative max-h-[20rem] overflow-y-auto rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e3)]">
        <p className="pb-2 text-sm font-extrabold text-[color:var(--text-heading)]">{title}</p>
        {children}
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

function ScopeOptionList({ state }: { state: RowState }) {
  const options = [
    { value: "terms" as const, label: "Definitions", count: TERM_COUNT },
    { value: "abbr" as const, label: "Abbreviations", count: ABBR_COUNT },
  ];
  return (
    <div className="grid gap-1.5">
      {options.map((option) => {
        const active = state.scope === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => state.setScope(option.value)}
            className={cn(
              "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-sm font-bold",
              focusRing,
              active
                ? "border-[color:var(--tone-purple-border)] bg-[color:var(--tone-purple-soft)] text-[color:var(--tone-purple)]"
                : "border-[color:var(--border)] text-[color:var(--text)]",
            )}
          >
            <span className="flex-1 text-left">{option.label}</span>
            <span className="nums text-2xs font-extrabold text-[color:var(--text-muted)]">{option.count}</span>
            {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* `gridTemplateColumns` is pinned inline: the mockup stylesheet only emits
   Tailwind classes some source already uses, and no production file uses a bare
   `grid-cols-6`, so the class would silently collapse this to one column. */
function LetterOptionGrid({ state }: { state: RowState }) {
  return (
    <>
      <button
        type="button"
        onClick={() => state.setLetter("All")}
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
          const empty = emptyLetters.has(option);
          return (
            <button
              key={option}
              type="button"
              disabled={empty}
              onClick={() => state.setLetter(option)}
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
  );
}

function SheetLayer({ state }: { state: RowState }) {
  if (state.sheet === "scope") {
    return (
      <SheetShell title="Show" state={state}>
        <ScopeOptionList state={state} />
      </SheetShell>
    );
  }
  if (state.sheet === "letter") {
    return (
      <SheetShell title="Jump to letter" state={state}>
        <LetterOptionGrid state={state} />
      </SheetShell>
    );
  }
  if (state.sheet === "both") {
    return (
      <SheetShell title="What you are looking at" state={state}>
        <div className="grid gap-3">
          <section aria-label="Show">
            <p className="px-1 pb-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
              Show
            </p>
            <ScopeOptionList state={state} />
          </section>
          <section aria-label="Jump to letter">
            <p className="px-1 pb-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
              Jump to letter
            </p>
            <LetterOptionGrid state={state} />
          </section>
        </div>
      </SheetShell>
    );
  }
  if (state.sheet === "filter") {
    return (
      <SheetShell title="Filter" state={state}>
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
      </SheetShell>
    );
  }
  return null;
}

/* ------------------------------ device frames ------------------------------ */

/* The site-wide composer, unchanged. With Search and Browse merged this is the
   mode's only search surface: empty means the whole catalogue, typing narrows
   it, clearing it brings the catalogue back. */
function SiteComposer() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5">
        <Plus className="h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
        <span className="flex-1 text-xs font-medium text-[color:var(--text-soft)]">Search a term or abbreviation…</span>
        <SendHorizontal className="h-4 w-4 shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
      </div>
    </div>
  );
}

function PhoneTabs() {
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
      {/* Search and Browse have merged, so what was Search · Browse · More is
          now Terms · Topics · More. */}
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

/* The phone page exactly as it is today, apart from the one row. `stacked`
   keeps today's second line; the three versions fold it away. */
function PhonePage({ version, state }: { version: Version | "today"; state: RowState }) {
  const stacked = version === "today";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
      <PhoneTabs />
      <div className="relative h-[24rem] overflow-y-auto pb-16">
        <div className="px-4 pb-3 pt-4">
          <h3 className="text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Browse terms</h3>
        </div>
        <div className="mx-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
          {stacked ? (
            <>
              <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2.5">
                <SummaryLine state={state}>
                  <p className="shrink-0 text-sm font-medium text-[color:var(--text-muted)] sm:hidden">
                    {state.letterLabel}
                  </p>
                </SummaryLine>
                <span className="ml-auto">
                  <FilterControl state={state} labelled />
                </span>
              </div>
              <VersionRow version={version} state={state} />
            </>
          ) : (
            <VersionRow version={version} state={state} />
          )}
        </div>
        <div className="mt-3">
          {sampleEntries.slice(0, 2).map((entry) => (
            <ResultRow key={entry.term} entry={entry} />
          ))}
        </div>
      </div>
      <SiteComposer />
      <SheetLayer state={state} />
    </div>
  );
}

function DesktopPage({ state }: { state: RowState }) {
  return (
    <div className="bg-[color:var(--surface-inset)] p-4">
      <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
          Complete catalogue
        </p>
        <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Browse terms</h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
            <SummaryLine state={state} />
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <SortSegment />
              <ScopeSegmentDesktop state={state} />
              <FilterControl state={state} labelled />
            </span>
          </div>
          <div className="px-4 py-3">
            <LetterRailDesktop state={state} />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border)]">
          {sampleEntries.slice(0, 2).map((entry) => (
            <ResultRow key={entry.term} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* The row on its own at true phone width, which is how it was looked at when
   the complaint was raised. */
function RowCloseUp({ version, label }: { version: Version | "today"; label: string }) {
  const state = useRowState();
  return (
    <div>
      <p className="mb-2 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</p>
      <div className="w-[24.375rem] max-w-full overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
        <VersionRow version={version} state={state} />
      </div>
    </div>
  );
}

function PhoneColumn({ version, label }: { version: Version | "today"; label: string }) {
  const state = useRowState();
  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">390 px</span>
      </div>
      <PhonePage version={version} state={state} />
    </div>
  );
}

function DesktopColumn({ label }: { label: string }) {
  const state = useRowState();
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">1440 px</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)]">
        <div className="min-w-[46rem]">
          <DesktopPage state={state} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function DictionaryControlRowMockupsPage() {
  const [showToday, setShowToday] = useState(true);

  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · phone control row
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Three ways to condense the Terms / Abbrev row
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Everything else is left exactly as it is: the kicker, the title, the summary line, desktop sort and view,
            the letter rail, the result rows, and the site-wide composer at the bottom — which, with Search and Browse
            merged, is the mode&rsquo;s only search surface. The one thing being replaced is the phone row holding the
            two dotted pills and the A–Z dropdown.
          </p>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Each version is shown twice: the row on its own at true phone width, and the row in place on the page. All
            three drop the leading dots and fold the row up into the summary line, so the control block goes from two
            rows to one.
          </p>
          <button
            type="button"
            onClick={() => setShowToday((value) => !value)}
            aria-expanded={showToday}
            className={cn(
              "mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text)]",
              focusRing,
            )}
          >
            <ListFilter className="h-4 w-4" aria-hidden="true" />
            {showToday ? "Hide the row as it is today" : "Show the row as it is today"}
          </button>
        </div>
      </header>

      {showToday ? (
        <section aria-labelledby="today-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--surface)]">
            <div className="border-b border-[color:var(--border)] bg-[color:var(--warning-soft)] px-4 py-3 sm:px-5">
              <h2 id="today-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
                Today — the row being replaced
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                Two pills sized to the viewport rather than to their labels, each carrying a decorative dot, on a second
                line below a summary that is already two thirds empty. Desktop is fine at 1440 px and is not part of
                this study.
              </p>
            </div>
            <div className="grid gap-6 p-4 sm:p-5">
              <RowCloseUp version="today" label="The row today · 390 px" />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <DesktopColumn label="Desktop — unchanged in all three" />
                <PhoneColumn version="today" label="Phone — today" />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {versions.map((version) => (
          <section
            key={version.id}
            aria-labelledby={`${version.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
                <span className="pt-0.5 text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                  {version.number}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`${version.id}-title`} className="text-lg font-extrabold text-[color:var(--text-heading)]">
                      {version.name}
                    </h2>
                    {version.recommended ? (
                      <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
                        Recommended
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
                      {version.saving}
                    </span>
                  </div>
                  <p className="mt-1 text-2xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
                    Attacks · {version.attacks}
                  </p>
                  <p className="mt-1.5 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                    {version.summary}
                  </p>
                  <p className="mt-1.5 max-w-3xl text-xs font-semibold text-[color:var(--text-soft)]">
                    Trade-off · {version.cost}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {version.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 p-4 sm:p-5">
              <RowCloseUp version={version.id} label={`The row · ${version.number} · 390 px`} />
              <PhoneColumn version={version.id} label={`Phone — ${version.name.toLowerCase()}`} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
