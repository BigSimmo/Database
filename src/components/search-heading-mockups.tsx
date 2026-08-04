"use client";

import { useState } from "react";
import { CheckCircle2, ChevronsUpDown, CircleDot, Funnel, LoaderCircle, Search, SlidersHorizontal } from "lucide-react";

import { cn } from "@/components/ui-primitives";

type SearchHeadingState = "searching" | "results";
type SearchHeadingConcept = "signal" | "ribbon" | "editorial";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

const concepts: Array<{
  id: SearchHeadingConcept;
  number: string;
  name: string;
  summary: string;
  strengths: string[];
  recommended?: boolean;
}> = [
  {
    id: "signal",
    number: "01",
    name: "Signal band",
    summary: "The clearest all-round hierarchy: query first, live status second, utilities kept quiet.",
    strengths: ["Fast to scan", "Strong loading state", "Adapts cleanly to phones"],
  },
  {
    id: "ribbon",
    number: "02",
    name: "Query ribbon",
    summary: "The selected direction, refined into a clear query, live status, and honest scope-and-sort toolbar.",
    strengths: ["Clear hierarchy", "State-aware", "Long-query safe"],
    recommended: true,
  },
  {
    id: "editorial",
    number: "03",
    name: "Results title",
    summary: "A more confident page heading that makes the search term the visual anchor.",
    strengths: ["Strongest page identity", "Room for future metadata", "Calm and premium"],
  },
];

function SortControl({ compact = false }: { compact?: boolean }) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 pl-3 pr-8 text-xs font-bold shadow-[var(--shadow-inset)]",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
        compact && "w-full justify-between",
      )}
    >
      <span className={cn("text-[color:var(--text-soft)]", compact && "max-[359px]:sr-only")}>Sort</span>
      <select
        defaultValue="relevance"
        aria-label="Sort results"
        className="cursor-pointer appearance-none bg-transparent font-extrabold text-[color:var(--text)] outline-none"
      >
        <option value="relevance">Relevance</option>
        <option value="alpha">A–Z</option>
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[color:var(--text-soft)]"
        aria-hidden
      />
    </label>
  );
}

function Status({
  state,
  quiet = false,
  compactAtNarrow = false,
}: {
  state: SearchHeadingState;
  quiet?: boolean;
  compactAtNarrow?: boolean;
}) {
  const searching = state === "searching";

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-extrabold",
        searching
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "bg-[color:var(--success-bg)] text-[color:var(--success-text)]",
        quiet && "bg-transparent px-0",
      )}
      role="status"
    >
      {searching ? (
        <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className={cn(compactAtNarrow && "max-[359px]:sr-only")}>{searching ? "Searching…" : "12 matches"}</span>
    </span>
  );
}

function SignalBand({ state, compact }: { state: SearchHeadingState; compact?: boolean }) {
  if (compact) {
    return (
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
        <div className="h-1 bg-[color:var(--clinical-accent)]" />
        <div className="p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Search results
              </span>
              <span className="mt-0.5 block truncate text-lg font-extrabold text-[color:var(--text-heading)]">
                chest pain
              </span>
            </span>
            <Status state={state} quiet />
          </div>
          <div className="mt-3 border-t border-[color:var(--border)] pt-3">
            <SortControl compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[4.5rem] items-center gap-3 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-[var(--shadow-inset)]">
      <span className="absolute inset-y-0 left-0 w-1 bg-[color:var(--clinical-accent)]" aria-hidden />
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
        <Search className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
          Search results
        </span>
        <span className="mt-0.5 block truncate text-lg font-extrabold text-[color:var(--text-heading)]">
          chest pain
        </span>
      </span>
      <span className="ml-2 h-7 w-px bg-[color:var(--border)]" aria-hidden />
      <Status state={state} />
      <div className="ml-auto">
        <SortControl />
      </div>
    </div>
  );
}

function QueryRibbon({ state, compact }: { state: SearchHeadingState; compact?: boolean }) {
  const searching = state === "searching";

  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-0.5 bg-[color:var(--clinical-accent)]",
            searching && "motion-safe:animate-pulse",
          )}
          aria-hidden
        />
        <div className="p-3 pt-3.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Query
              </span>
              <span
                className="mt-0.5 block truncate text-base font-extrabold text-[color:var(--text-heading)]"
                title="chest pain"
              >
                chest pain
              </span>
            </span>
            <Status state={state} quiet compactAtNarrow />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-2">
          <ScopeControl compact />
          <SortControl compact />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 bg-[color:var(--clinical-accent)]",
          searching && "motion-safe:animate-pulse",
        )}
        aria-hidden
      />
      <div className="flex min-h-[4.5rem] items-center gap-3 px-4 py-2.5 pl-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Search className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-3xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            {searching ? "Searching for" : "Results for"}
          </span>
          <span
            className="mt-0.5 block max-w-[24rem] truncate text-lg font-extrabold text-[color:var(--text-heading)]"
            title="chest pain"
          >
            chest pain
          </span>
        </span>
        <span className="mx-1 h-8 w-px bg-[color:var(--border)]" aria-hidden />
        <Status state={state} />
        <div className="ml-auto flex items-center gap-2 border-l border-[color:var(--border)] pl-3">
          <ScopeControl />
          <SortControl />
        </div>
      </div>
    </div>
  );
}

function ScopeControl({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <label
        className={cn(
          "relative inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 pl-3 pr-8 text-xs font-bold shadow-[var(--shadow-inset)]",
          "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
        )}
      >
        <span className="text-[color:var(--text-soft)] max-[359px]:sr-only">Source</span>
        <select
          defaultValue="all"
          aria-label="Filter results by source"
          className="min-w-0 cursor-pointer appearance-none bg-transparent font-extrabold text-[color:var(--text)] outline-none"
        >
          <option value="all">All</option>
          <option value="guidelines">Guides</option>
          <option value="forms">Forms</option>
        </select>
        <ChevronsUpDown
          className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[color:var(--text-soft)]"
          aria-hidden
        />
      </label>
    );
  }

  return (
    <label
      className={cn(
        "relative inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-1 pl-3 pr-8 text-xs font-bold shadow-[var(--shadow-inset)]",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--focus)]",
      )}
    >
      <Funnel className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" aria-hidden />
      <select
        defaultValue="all"
        aria-label="Filter results by source"
        className="min-w-0 cursor-pointer appearance-none truncate bg-transparent font-extrabold text-[color:var(--text)] outline-none"
      >
        <option value="all">All sources</option>
        <option value="guidelines">Guidelines</option>
        <option value="forms">Forms</option>
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[color:var(--text-soft)]"
        aria-hidden
      />
    </label>
  );
}

function EditorialTitle({ state, compact }: { state: SearchHeadingState; compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-inset)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Search results
          </span>
          <Status state={state} quiet />
        </div>
        <h3 className="mt-2 truncate text-2xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]">
          “chest pain”
        </h3>
        <div className="mt-4 flex items-center gap-2 border-t border-[color:var(--border)] pt-3">
          <span className="inline-flex min-h-10 flex-1 items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 text-xs font-bold text-[color:var(--text-muted)]">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            All sources
          </span>
          <SortControl />
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[6.25rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 shadow-[var(--shadow-inset)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-3xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Search results
          </span>
          <CircleDot className="h-3 w-3 text-[color:var(--border-strong)]" aria-hidden />
          <Status state={state} quiet />
        </div>
        <h3 className="mt-1.5 truncate text-2xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)]">
          “chest pain”
        </h3>
      </div>
      <div className="flex items-center gap-2 border-l border-[color:var(--border)] pl-5">
        <span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[color:var(--surface-subtle)] px-3 text-xs font-bold text-[color:var(--text-muted)]">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          All sources
        </span>
        <SortControl />
      </div>
    </div>
  );
}

function SearchHeading({
  concept,
  state,
  compact = false,
}: {
  concept: SearchHeadingConcept;
  state: SearchHeadingState;
  compact?: boolean;
}) {
  if (concept === "signal") return <SignalBand state={state} compact={compact} />;
  if (concept === "ribbon") return <QueryRibbon state={state} compact={compact} />;
  return <EditorialTitle state={state} compact={compact} />;
}

function PreviewFrame({
  label,
  children,
  phone = false,
}: {
  label: string;
  children: React.ReactNode;
  phone?: boolean;
}) {
  return (
    <div className={cn("min-w-0", phone && "mx-auto w-full max-w-[23.75rem]")}>
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
        <div className={cn(!phone && "min-w-[44rem]")}>
          {children}
          <div className={cn("mt-3 grid gap-2", phone ? "grid-cols-1" : "grid-cols-[1.35fr_1fr]")}>
            <span className="h-16 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/55" />
            {!phone ? (
              <span className="h-16 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--surface)]/55" />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SearchHeadingMockupsPage() {
  const [state, setState] = useState<SearchHeadingState>("searching");

  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
                Universal search heading
              </p>
              <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-[-0.03em] text-[color:var(--text-heading)] sm:text-4xl">
                Three polished directions for every search page
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
                Each concept keeps the query, live search status, and result sorting together while preserving a clear
                reading order on desktop and phone.
              </p>
            </div>
            <div
              className="inline-flex w-fit rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-1"
              role="group"
              aria-label="Preview search state"
            >
              {(["searching", "results"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={state === value}
                  onClick={() => setState(value)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold transition-colors",
                    focusRing,
                    state === value
                      ? "bg-[color:var(--surface)] text-[color:var(--text-heading)] shadow-[var(--shadow-inset)]"
                      : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                  )}
                >
                  {value === "searching" ? (
                    <LoaderCircle className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {value === "searching" ? "Searching" : "Results ready"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {concepts.map((concept) => (
          <section
            key={concept.id}
            aria-labelledby={`${concept.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
                <span className="pt-0.5 text-xs font-extrabold tabular-nums text-[color:var(--clinical-accent)]">
                  {concept.number}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`${concept.id}-title`} className="text-lg font-extrabold text-[color:var(--text-heading)]">
                      {concept.name}
                    </h2>
                    {concept.recommended ? (
                      <span className="rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-[color:var(--clinical-accent)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">{concept.summary}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {concept.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-3xs font-bold text-[color:var(--text-muted)]"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]">
              <PreviewFrame label="Desktop">
                <SearchHeading concept={concept.id} state={state} />
              </PreviewFrame>
              <PreviewFrame label="Phone" phone>
                <SearchHeading concept={concept.id} state={state} compact />
              </PreviewFrame>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
