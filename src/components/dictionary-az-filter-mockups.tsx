"use client";

import { useId, useState } from "react";
import { ChevronDown, Menu, MessageSquarePlus, Plus, Search, SendHorizontal, X } from "lucide-react";

import { ResultFilterTrigger } from "@/components/clinical-dashboard/result-filter-control";
import { focusRing, letters, ResultRow, type SampleEntry } from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → original Filter at the top, A–Z homes (2026-08-24)
 *
 * Three frames only. Shared decisions:
 *   - The Filter control is the real ResultFilterTrigger used on every
 *     search page, sitting in the results band at the top (under the title).
 *   - Abbreviations leave the page. They are a Show lens inside Filter,
 *     because Terms / Abbreviations partition the list (one is active).
 *   - A–Z is the open question. Each frame tries one home.
 *
 *   01 Title     A–Z sits next to Clinical terms.
 *   02 Band      A–Z sits beside Filter in the original results band.
 *   03 Filter    A–Z joins Abbreviations inside the Filter sheet.
 * ------------------------------------------------------------------ */

const QUERY = "mental state examination";
const TERM_COUNT = 2;
const ABBR_COUNT = 2;
const emptyLetters = new Set(["J", "K", "Q", "U", "V", "W", "X", "Y", "Z"]);

type AzHome = "title" | "band" | "sheet";
type Scope = "terms" | "abbreviations";

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

function PhoneFrame({
  azHome,
  label,
  note,
  startSheetOpen = false,
}: {
  azHome: AzHome;
  label: string;
  note: string;
  startSheetOpen?: boolean;
}) {
  const panelId = useId();
  const [scope, setScope] = useState<Scope>("terms");
  const [letter, setLetter] = useState("All");
  const [query, setQuery] = useState(QUERY);
  const [sheet, setSheet] = useState<"none" | "filter" | "letter">(startSheetOpen ? "filter" : "none");
  const searching = query.length > 0;
  const count = scope === "abbreviations" ? ABBR_COUNT : TERM_COUNT;
  const noun = scope === "abbreviations" ? "abbreviations" : "terms";
  const activeCount = (scope === "abbreviations" ? 1 : 0) + (letter === "All" ? 0 : 1);
  const filterOpen = sheet === "filter";
  const letterOpen = sheet === "letter";

  const letterChip = (
    <button
      type="button"
      onClick={() => setSheet("letter")}
      aria-haspopup="dialog"
      aria-label={`Letters — ${letter === "All" ? "all letters" : `letter ${letter}`}`}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-0.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 text-xs font-extrabold text-[color:var(--clinical-accent)]",
        focusRing,
      )}
    >
      {letter === "All" ? "A–Z" : letter}
      <ChevronDown className="size-icon-xs shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
    </button>
  );

  return (
    <div className="max-w-full shrink-0" style={{ width: "390px" }}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</p>
          <p className="mt-0.5 text-3xs font-medium text-[color:var(--text-muted)]">{note}</p>
        </div>
        <span className="shrink-0 text-3xs font-bold text-[color:var(--text-soft)]">390 px</span>
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

        <div className="relative h-[30rem] overflow-y-auto pb-16">
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-4">
            <h3 className="min-w-0 text-2xl font-extrabold tracking-tight text-[color:var(--text-heading)]">
              Clinical terms
            </h3>
            {azHome === "title" ? letterChip : null}
          </div>

          <div className="px-3 pb-2">
            <section
              aria-label={`Search results for ${query}`}
              data-testid={`search-query-ribbon-${azHome}`}
              className="search-band relative flex min-h-tap items-center gap-2 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 shadow-[var(--shadow-inset)]"
            >
              <span className="search-band-lead shrink-0" data-tone="accent" aria-hidden="true" />
              <span className="search-band-count-word shrink-0 whitespace-nowrap text-sm text-[color:var(--text-muted)]">
                <span className="search-band-count nums font-extrabold text-[color:var(--text-heading)]">{count}</span>{" "}
                {noun}
              </span>
              {searching ? (
                <>
                  <span className="search-band-rule mx-0.5 h-[1.125rem] w-px shrink-0" aria-hidden="true" />
                  <h4
                    className="search-band-subject min-w-[2rem] flex-1 truncate text-sm font-medium text-[color:var(--text-muted)]"
                    title={query}
                  >
                    {query}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label={`Clear the search for ${query}`}
                    className={cn(
                      "search-band-ghost grid min-h-tap min-w-tap shrink-0 place-items-center rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]",
                      focusRing,
                    )}
                  >
                    <X className="size-icon-md" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              {azHome === "band" ? letterChip : null}
              <ResultFilterTrigger
                panelId={panelId}
                testId={`dictionary-az-filter-trigger-${azHome}`}
                open={filterOpen}
                activeCount={activeCount}
                onToggle={() => setSheet((current) => (current === "filter" ? "none" : "filter"))}
                title="Filter the dictionary catalogue"
                labelVisibility="always"
              />
            </section>
          </div>

          <div className="mt-1">
            {queryEntries.map((entry) => (
              <ResultRow key={entry.term} entry={entry} />
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
          <button
            type="button"
            onClick={() => setQuery(query === "" ? QUERY : "")}
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
                {letterOpen ? "Jump to letter" : "Filter and sort"}
              </p>
              {letterOpen ? (
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
              ) : (
                <>
                  <p className="mt-0.5 text-xs font-medium text-[color:var(--text-muted)]">
                    Show partitions the list. A–Z
                    {azHome === "sheet" ? " lives here too." : " stays on the page."}
                  </p>

                  <p className="mt-3 text-xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
                    Show
                  </p>
                  <div role="radiogroup" aria-label="Show" className="mt-1.5 flex flex-wrap gap-1.5">
                    {(
                      [
                        { value: "terms" as const, label: "Terms", hint: String(TERM_COUNT) },
                        {
                          value: "abbreviations" as const,
                          label: "Abbreviations",
                          hint: String(ABBR_COUNT),
                        },
                      ] as const
                    ).map((option) => {
                      const checked = scope === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => setScope(option.value)}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-bold",
                            focusRing,
                            checked
                              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                              : "border-[color:var(--border)] text-[color:var(--text)]",
                          )}
                        >
                          {option.label}
                          <span className="nums text-xs font-semibold text-[color:var(--text-muted)]">
                            {option.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {azHome === "sheet" ? (
                    <>
                      <p className="mt-3 text-xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">
                        Jump to letter
                      </p>
                      <button
                        type="button"
                        onClick={() => setLetter("All")}
                        className={cn(
                          "mt-1.5 h-11 w-full rounded-lg border text-sm font-extrabold",
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
                              onClick={() => setLetter(option)}
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
                  ) : null}

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

export function DictionaryAzFilterMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · original Filter
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Filter at the top. Abbreviations in the sheet. Three homes for A–Z.
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            The Filter button is the same control every search page uses, in the results band under the title. There is
            no Terms / Abbreviations toggle on the page — that choice is a Show lens inside Filter. Tap Filter on 01 or
            02 to see it. Frame 03 starts with the sheet open so A–Z in Filter is visible.
          </p>
        </div>
      </header>

      <section aria-labelledby="three-title" className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
        <h2 id="three-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
          Three directions
        </h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
          Same band, same Filter, same query. Only A–Z moves.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <PhoneFrame
            azHome="title"
            label="01 A–Z by the title"
            note="Letter jump stays in browse muscle memory. Filter is only Filter."
          />
          <PhoneFrame
            azHome="band"
            label="02 A–Z beside Filter"
            note="Both narrowing controls share the original results band."
          />
          <PhoneFrame
            azHome="sheet"
            startSheetOpen
            label="03 A–Z inside Filter"
            note="The band stays count, query, Filter. Show and letters share the sheet."
          />
        </div>
      </section>
    </main>
  );
}
