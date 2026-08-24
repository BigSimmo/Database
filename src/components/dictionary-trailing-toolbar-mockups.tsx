"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Menu, MessageSquarePlus, Plus, Search, SendHorizontal, X } from "lucide-react";

import { ResultFilterTrigger } from "@/components/clinical-dashboard/result-filter-control";
import {
  focusRing,
  letters,
  ResultRow,
  sampleEntries,
  type SampleEntry,
} from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → compact trailing toolbar (2026-08-24)
 *
 * Title stays a title. The compact Terms / Abbreviations toggle, Topics,
 * and A–Z sit together in the trailing corner. A–Z stands down during
 * search; the original Filter then occupies the results band.
 * ------------------------------------------------------------------ */

const QUERY = "mental state examination";
const TERM_COUNT_BROWSE = sampleEntries.length;
const TERM_COUNT_SEARCH = 2;
const ABBR_COUNT = 2;
const emptyLetters = new Set(["J", "K", "Q", "U", "V", "W", "X", "Y", "Z"]);

const topicOptions = [
  { id: "all", label: "All topics" },
  { id: "assessment", label: "Assessment" },
  { id: "therapies", label: "Therapies" },
  { id: "findings", label: "Clinical findings" },
] as const;

type Scope = "terms" | "abbreviations";
type Sheet = "none" | "topics" | "letter" | "filter";

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

const chip =
  "inline-flex h-7 max-h-7 shrink-0 items-center gap-0.5 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 text-2xs font-semibold leading-none text-[color:var(--clinical-accent)]";

function PhoneChrome({ children }: { children: ReactNode }) {
  return (
    <>
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
        {["Terms", "Topics", "More"].map((tab, index) => (
          <span
            key={tab}
            className={cn(
              "border-b-2 py-2.5 text-sm font-bold",
              index === 0
                ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                : "border-transparent text-[color:var(--text-muted)]",
            )}
          >
            {tab}
          </span>
        ))}
      </div>
      {children}
    </>
  );
}

function ScopeToggle({
  scope,
  termCount,
  onChange,
}: {
  scope: Scope;
  termCount: number;
  onChange: (value: Scope) => void;
}) {
  const options = [
    { value: "terms" as const, label: "Terms", count: termCount },
    { value: "abbreviations" as const, label: "Abbreviations", count: ABBR_COUNT },
  ];
  return (
    <div
      role="group"
      aria-label="Show"
      className="inline-flex h-7 shrink-0 items-stretch overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--clinical-accent-soft)]"
    >
      {options.map((option) => {
        const active = scope === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={`${option.label} (${option.count})`}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-full items-center gap-0.5 px-1.5 text-2xs font-semibold leading-none tracking-tight",
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

function PhoneFrame({ startSearching }: { startSearching: boolean }) {
  const panelId = useId();
  const [scope, setScope] = useState<Scope>("terms");
  const [letter, setLetter] = useState("All");
  const [topic, setTopic] = useState<(typeof topicOptions)[number]["id"]>("all");
  const [query, setQuery] = useState(startSearching ? QUERY : "");
  const [sheet, setSheet] = useState<Sheet>("none");
  const searching = query.length > 0;
  const termCount = searching ? TERM_COUNT_SEARCH : TERM_COUNT_BROWSE;
  const noun = scope === "abbreviations" ? "abbreviations" : "terms";
  const count = scope === "abbreviations" ? ABBR_COUNT : termCount;
  const topicLabel = topicOptions.find((option) => option.id === topic)?.label ?? "Topics";
  const rows = searching ? queryEntries : letter === "M" ? queryEntries : sampleEntries;
  const filterOpen = sheet === "filter";
  const topicActive = topic !== "all";

  const goSearch = () => {
    setQuery(QUERY);
    setLetter("All");
    setSheet("none");
  };
  const goBrowse = () => {
    setQuery("");
    setSheet("none");
  };

  return (
    <div className="max-w-full shrink-0" style={{ width: "390px" }}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
            {searching ? "Search" : "Browse"}
          </p>
          <p className="mt-0.5 text-3xs font-medium text-[color:var(--text-muted)]">
            {searching
              ? "Topics stays on the title. Compact toggle stays underneath. A–Z stands down. Filter joins the band."
              : "Topics sits with the title. Compact Terms / Abbr. and A–Z sit underneath on the right."}
          </p>
        </div>
        <span className="shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">390 px</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
        <PhoneChrome>
          <div className="relative h-[30rem] overflow-y-auto pb-16">
            <div className="px-3 pb-2 pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">
                  Clinical terms
                </h3>
                <button
                  type="button"
                  onClick={() => setSheet("topics")}
                  aria-haspopup="dialog"
                  aria-label={`Topics — ${topicLabel}`}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]",
                    focusRing,
                    topicActive && "border-[color:var(--clinical-accent)]",
                  )}
                >
                  {topic === "all" ? "Topics" : topicLabel}
                  <ChevronDown className="size-icon-xs shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-end gap-1">
                <ScopeToggle scope={scope} termCount={termCount} onChange={setScope} />
                {searching ? null : (
                  <button
                    type="button"
                    onClick={() => setSheet("letter")}
                    aria-haspopup="dialog"
                    aria-label={`Letters — ${letter === "All" ? "all letters" : `letter ${letter}`}`}
                    className={cn(chip, focusRing)}
                  >
                    {letter === "All" ? "A–Z" : letter}
                    <ChevronDown className="size-icon-xs shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {searching ? (
              <div className="px-3 pb-2">
                <section
                  aria-label={`Search results for ${query}`}
                  className="search-band relative flex min-h-tap items-center gap-2 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 shadow-[var(--shadow-inset)]"
                >
                  <span className="search-band-lead shrink-0" data-tone="accent" aria-hidden="true" />
                  <span className="search-band-count-word shrink-0 whitespace-nowrap text-sm text-[color:var(--text-muted)]">
                    <span className="search-band-count nums font-extrabold text-[color:var(--text-heading)]">
                      {count}
                    </span>{" "}
                    {noun}
                  </span>
                  <span className="search-band-rule mx-0.5 h-[1.125rem] w-px shrink-0" aria-hidden="true" />
                  <h4
                    className="search-band-subject min-w-[2rem] flex-1 truncate text-sm font-medium text-[color:var(--text-muted)]"
                    title={query}
                  >
                    {query}
                  </h4>
                  <button
                    type="button"
                    onClick={goBrowse}
                    aria-label={`Clear the search for ${query}`}
                    className={cn(
                      "search-band-ghost grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]",
                      focusRing,
                    )}
                  >
                    <X className="size-icon-md" aria-hidden="true" />
                  </button>
                  <ResultFilterTrigger
                    panelId={panelId}
                    testId={`dictionary-trailing-filter-${startSearching ? "search" : "browse"}`}
                    open={filterOpen}
                    activeCount={topicActive ? 1 : 0}
                    onToggle={() => setSheet((current) => (current === "filter" ? "none" : "filter"))}
                    title="Filter the dictionary catalogue"
                    labelVisibility="always"
                  />
                </section>
              </div>
            ) : null}

            <div className="mt-1">
              {rows.map((entry) => (
                <ResultRow key={entry.term} entry={entry} />
              ))}
            </div>
          </div>
        </PhoneChrome>

        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
          <button
            type="button"
            onClick={() => (searching ? goBrowse() : goSearch())}
            className={cn(
              "flex w-full items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2.5 text-left",
              focusRing,
            )}
          >
            <Plus className="size-icon-md shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs",
                searching ? "font-bold text-[color:var(--text)]" : "font-medium text-[color:var(--text-soft)]",
              )}
            >
              {searching ? query : "Search a term or abbreviation…"}
            </span>
            <SendHorizontal className="size-icon-md shrink-0 text-[color:var(--text-soft)]" aria-hidden="true" />
          </button>
        </div>

        {sheet !== "none" ? (
          <div className="absolute inset-0 z-40 flex flex-col justify-end">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSheet("none")}
              className="absolute inset-0 bg-[color:var(--overlay-backdrop)]"
            />
            <div
              id={filterOpen ? panelId : undefined}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${panelId}-title`}
              className="relative max-h-[24rem] overflow-y-auto rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e3)]"
            >
              <p id={`${panelId}-title`} className="text-sm font-extrabold text-[color:var(--text-heading)]">
                {sheet === "letter" ? "Jump to letter" : sheet === "topics" ? "Topics" : "Filter and sort"}
              </p>
              {sheet === "letter" ? (
                <>
                  <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">
                    Letters with no entry stay visible but are not selectable.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLetter("All");
                      setSheet("none");
                    }}
                    className={cn(
                      "mt-3 h-11 w-full rounded-lg border text-sm font-extrabold",
                      focusRing,
                      letter === "All"
                        ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                        : "border-[color:var(--border)] text-[color:var(--text)]",
                    )}
                  >
                    All letters
                  </button>
                  <div className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
                    {letters.map((option) => {
                      const vacant = emptyLetters.has(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          disabled={vacant}
                          onClick={() => {
                            setLetter(option);
                            setSheet("none");
                          }}
                          className={cn(
                            "grid h-11 place-items-center rounded-lg border text-sm font-extrabold",
                            focusRing,
                            letter === option
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
              ) : sheet === "topics" ? (
                <>
                  <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">
                    One collection at a time. Kind and source stay in Filter.
                  </p>
                  <div role="radiogroup" aria-label="Topics" className="mt-3 grid gap-1.5">
                    {topicOptions.map((option) => {
                      const checked = topic === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => {
                            setTopic(option.id);
                            setSheet("none");
                          }}
                          className={cn(
                            "flex min-h-11 items-center rounded-lg border px-3 text-left text-sm font-bold",
                            focusRing,
                            checked
                              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                              : "border-[color:var(--border)] text-[color:var(--text)]",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">
                    Terms / Abbreviations and Topics stay on the page. This sheet is sort, kind, and source.
                  </p>
                  <p className="mt-3 text-xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
                    Sort
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(searching ? ["Best match", "A–Z", "Z–A"] : ["A–Z", "Z–A"]).map((option, index) => (
                      <span
                        key={option}
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-bold",
                          index === 0
                            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                            : "border-[color:var(--border)] text-[color:var(--text)]",
                        )}
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheet("none")}
                    className={cn(
                      "mt-3 h-12 w-full rounded-lg bg-[color:var(--clinical-accent)] text-sm font-extrabold text-[color:var(--clinical-accent-contrast)]",
                      focusRing,
                    )}
                  >
                    Show {count} {noun}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DictionaryTrailingToolbarMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · trailing toolbar
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Compact Abbreviations and A–Z underneath on the right.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Topics sits on the title row, same trailing-corner pattern as Filter in the earlier study. The compact Terms
            / Abbreviations toggle and A–Z sit underneath on the right — not on the title. A–Z is browse-only. Filter
            stays the original control and only appears in the results band once a query runs. Tap the composer to feel
            the handoff.
          </p>
        </div>
      </header>

      <section aria-labelledby="two-title" className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
        <h2 id="two-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Two states
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Left starts as browse. Right starts as search. Kind and source remain inside Filter.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <PhoneFrame startSearching={false} />
          <PhoneFrame startSearching />
        </div>
      </section>
    </main>
  );
}
