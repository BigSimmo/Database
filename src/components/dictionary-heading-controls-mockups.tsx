"use client";

import { useState } from "react";
import { ChevronDown, Funnel, Menu, MessageSquarePlus, Plus, Search, SendHorizontal, X } from "lucide-react";

import { focusRing, letters, ResultRow, type SampleEntry } from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → heading companions (2026-08-23)
 *
 * Question: can Filter live in the results bar, while Terms / Abbreviations
 * and A–Z sit next to the page title?
 *
 * Yes. The query ribbon already has a utilities slot; the heading can take
 * trailing controls the same way a document-viewer title does. The open
 * product question is where Filter lives when there is no query — today the
 * ribbon is absent while browsing.
 *
 *   Now            Title alone; toggle, A–Z and Filter share a control row.
 *   01 Persistent  Title carries toggle + A–Z. Filter always has a home in a
 *                  slim results bar. A search fills that same bar with the
 *                  match count, the query, and clear.
 *   02 Ribbon only Title carries toggle + A–Z. Filter appears only once a
 *                  query runs. You cannot facet the idle catalogue.
 *
 * Tap the composer in any frame to run “mental state examination” and clear
 * it again. A–Z stands down during a search: the alphabet is meaningless
 * against a ranked result set.
 * ------------------------------------------------------------------ */

const TERM_COUNT = 96;
const ABBR_COUNT = 11;
const QUERY = "mental state examination";
const QUERY_TERMS = 2;
const QUERY_ABBRS = 2;

type Layout = "now" | "persistent" | "ribbon";

function usePageState() {
  const [scope, setScope] = useState<"terms" | "abbr">("terms");
  const [letter, setLetter] = useState("All");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<"none" | "letter" | "filter">("none");
  const searching = query.length > 0;
  const termCount = searching ? QUERY_TERMS : TERM_COUNT;
  const abbrCount = searching ? QUERY_ABBRS : ABBR_COUNT;
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
    termCount,
    abbrCount,
    count,
    noun,
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

function HeadingCompanions({ state }: { state: PageState }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <ScopeToggle state={state} />
      {state.searching ? null : <LetterChip state={state} />}
    </div>
  );
}

function FilterControl({ state }: { state: PageState }) {
  return (
    <button
      type="button"
      onClick={() => state.setSheet("filter")}
      className={cn(
        "inline-flex min-h-tap shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-sm font-bold text-[color:var(--text-muted)]",
        focusRing,
      )}
    >
      <Funnel className="size-icon-md shrink-0" aria-hidden="true" />
      Filter
    </button>
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
      {state.searching ? (
        <button
          type="button"
          onClick={() => state.setQuery("")}
          aria-label={`Clear the search for ${state.query}`}
          className={cn(
            "grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]",
            focusRing,
          )}
        >
          <X className="size-icon-md" aria-hidden="true" />
        </button>
      ) : null}
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

function PageHeading({ state, companions }: { state: PageState; companions: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-2 pt-4">
      <h3 className="min-w-0 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">
        Clinical terms
      </h3>
      {companions ? <HeadingCompanions state={state} /> : null}
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
          <p className="text-sm font-medium text-[color:var(--text-muted)]">
            Topics, kinds and sources stay in this sheet. Scope and letter stay on the heading so the sheet does not
            hide the view you are already in.
          </p>
        )}
      </div>
    </div>
  );
}

function PhoneFrame({
  layout,
  label,
  note,
  width = 390,
}: {
  layout: Layout;
  label: string;
  note: string;
  width?: number;
}) {
  const state = usePageState();
  const companions = layout !== "now";
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
        <div className="relative h-[26rem] overflow-y-auto pb-16">
          <PageHeading state={state} companions={companions} />
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
                  <button
                    type="button"
                    onClick={() => state.setQuery("")}
                    aria-label={`Clear the search for ${state.query}`}
                    className={cn(
                      "grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]",
                      focusRing,
                    )}
                  >
                    <X className="size-icon-md" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
              <NowControlRow state={state} />
            </>
          ) : (
            <ResultsBar state={state} always={layout === "persistent"} />
          )}
          <div className="mt-1">
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

export function DictionaryHeadingControlsMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · heading companions
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Filter in the bar, Terms and A–Z beside the title
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Possible: Filter already has a slot on the query ribbon, and the heading can take trailing controls. The
            compact joined toggle is short enough to sit next to{" "}
            <span className="font-semibold text-[color:var(--text)]">Clinical terms</span> without becoming a second
            header. Tap the search bar in any frame to run a query and clear it again.
          </p>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            At 390 px the full word “Abbreviations” plus A–Z will usually wrap under the title. That wrap is the thing
            to judge: the title still owns those controls, and Filter is no longer competing for that line.
          </p>
        </div>
      </header>

      <section aria-labelledby="browse-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
        <h2 id="browse-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Browse, then search
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Three layouts at the repo phone baseline. The composer in each frame toggles the same two-word query.
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
          320 px · the wrap
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Direction 01 at the stress width. The heading companions wrap onto a second line; Filter stays in the bar
          rather than squeezing a count.
        </p>
        <div className="mt-5">
          <PhoneFrame
            layout="persistent"
            label="01 Persistent bar"
            note="Wrap is expected. Filter is not on this line."
            width={320}
          />
        </div>
      </section>
    </main>
  );
}
