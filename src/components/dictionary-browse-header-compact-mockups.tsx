"use client";

import { useState } from "react";
import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import {
  CountPill,
  DesktopFrame,
  PhoneFrame,
  ResultRow,
  focusRing,
  letters,
  sampleEntries,
} from "@/components/dictionary-browse-header-mockups";
import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → Browse header, round two (2026-08-18)
 *
 * Follow-up to /mockups/dictionary-browse-header. Same two removals as
 * before (description line, orphaned A–Z / Z–A sort pill), plus two new
 * moves the whole round shares:
 *
 *   1. The 27-chip horizontal letter rail becomes a dropdown on phones.
 *   2. Abbreviations stops being a header segment and becomes a Show
 *      option inside the Filters sheet, next to sort.
 *
 * Demoting a view switch into a sheet hides state, so every version
 * surfaces an active "Abbreviations" chip beside the letter trigger
 * when that option is on. Without it the header lies about what the
 * list contains.
 * ------------------------------------------------------------------ */

type Version = "titlebar" | "single" | "toolbar";

const versions: ReadonlyArray<{
  id: Version;
  number: string;
  name: string;
  summary: string;
  strengths: readonly string[];
  cost: string;
  chrome: string;
  recommended?: boolean;
}> = [
  {
    id: "titlebar",
    number: "01",
    name: "Title bar + letter dropdown",
    summary:
      "Keeps a full-size page title, then one sticky toolbar: the alphabetical dropdown takes the width and Filters & sort keeps its full label beside it. Desktop keeps the chip rail, which still fits there.",
    strengths: ["Strongest page identity", "Full-width dropdown target", "Desktop keeps one-tap letters"],
    cost: "Two bands on phone — the title still costs a row that the mode nav already implies, and an active filter chip adds a third.",
    chrome: "2 rows on phone",
    recommended: true,
  },
  {
    id: "single",
    number: "02",
    name: "Single fused row",
    summary:
      "Title, letter dropdown, count and Filters share one sticky line. The dropdown shrinks to a chip beside the title, and the same row serves desktop.",
    strengths: ["One row, both breakpoints", "Adapts rather than overflows", "Nothing scrolls horizontally"],
    cost: "The letter chip is a smaller target than a full-width control, and at 390 px an active filter chip costs the row its title and count — both stand down to the mode nav until the filter clears.",
    chrome: "1 row on phone",
  },
  {
    id: "toolbar",
    number: "03",
    name: "Slim toolbar, title retired",
    summary:
      "The phone mode nav already reads Browse, so the visible heading goes (kept for screen readers) and only a slim toolbar remains: letters, count, Filters. Desktop keeps its title, having no tab bar to inherit it from.",
    strengths: ["Smallest possible chrome", "Results start immediately", "Toolbar reads as controls, not decoration"],
    cost: "Phone loses its visual page title; it only works while the mode nav above it stays.",
    chrome: "1 slim bar on phone",
  },
];

/* ------------------------------- state ------------------------------- */

function useBrowseState() {
  const [letter, setLetter] = useState("All");
  const [abbrOnly, setAbbrOnly] = useState(false);
  const [sort, setSort] = useState<"az" | "za">("az");
  const [letterOpen, setLetterOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = (abbrOnly ? 1 : 0) + (sort === "za" ? 1 : 0);
  return {
    letter,
    setLetter,
    abbrOnly,
    setAbbrOnly,
    sort,
    setSort,
    letterOpen,
    setLetterOpen,
    filtersOpen,
    setFiltersOpen,
    activeFilters,
  };
}

type BrowseState = ReturnType<typeof useBrowseState>;

/* ------------------------------ controls ----------------------------- */

function LetterTrigger({
  value,
  onOpen,
  grow = false,
  size = "regular",
}: {
  value: string;
  onOpen: () => void;
  grow?: boolean;
  size?: "regular" | "chip";
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Alphabetical index — ${value === "All" ? "all letters" : value}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
        grow && "flex-1",
        size === "chip" ? "h-9 px-2.5 text-xs" : "h-11 px-3 text-sm",
      )}
    >
      {size === "chip" ? null : <span className="shrink-0 font-bold text-[color:var(--text-muted)]">Alphabetical</span>}
      <span className="truncate font-extrabold text-[color:var(--clinical-accent)]">
        {value === "All" ? "All" : value}
      </span>
      <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
    </button>
  );
}

function AbbrChip({ onClear, size = "regular" }: { onClear: () => void; size?: "regular" | "chip" }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label="Showing abbreviations only — clear this filter"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--tone-purple-border)] bg-[color:var(--tone-purple-soft)] font-extrabold text-[color:var(--tone-purple)]",
        focusRing,
        size === "chip" ? "h-7 px-2 text-3xs" : "h-9 px-2.5 text-2xs",
      )}
    >
      Abbreviations
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

function FiltersControl({
  count,
  labelled = false,
  onOpen,
  size = "regular",
}: {
  count: number;
  labelled?: boolean;
  onOpen: () => void;
  size?: "regular" | "chip";
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={labelled ? undefined : `Filters and sort${count ? `, ${count} active` : ""}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
        size === "chip" ? "h-9 text-xs" : "h-11 text-sm",
        labelled ? "px-3" : count ? "px-2" : size === "chip" ? "w-9" : "w-11",
      )}
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
      {labelled ? "Filters & sort" : null}
      {count ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--clinical-accent)] px-1 text-3xs font-extrabold text-[color:var(--clinical-accent-contrast)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------ overlays ----------------------------- */

function SheetShell({
  title,
  onClose,
  children,
  anchored = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  anchored?: boolean;
}) {
  if (anchored) {
    return (
      <div className="absolute inset-0 z-40">
        <button type="button" aria-label={`Close ${title}`} onClick={onClose} className="absolute inset-0" />
        <div className="absolute left-6 top-[4.5rem] w-[22rem] rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e3)]">
          <SheetHeading title={title} onClose={onClose} />
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
      <div className="relative rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e3)]">
        <SheetHeading title={title} onClose={onClose} />
        {children}
      </div>
    </div>
  );
}

function SheetHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 pb-2">
      <p className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className={cn("ml-auto grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)]", focusRing)}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function LetterPicker({
  value,
  onSelect,
  onClose,
  anchored,
}: {
  value: string;
  onSelect: (next: string) => void;
  onClose: () => void;
  anchored?: boolean;
}) {
  return (
    <SheetShell title="Alphabetical index" onClose={onClose} anchored={anchored}>
      <button
        type="button"
        onClick={() => onSelect("All")}
        className={cn(
          "mb-2 h-11 w-full rounded-lg border text-sm font-extrabold",
          focusRing,
          value === "All"
            ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
            : "border-[color:var(--border)] text-[color:var(--text)]",
        )}
      >
        All letters
      </button>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        {letters.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              "grid h-11 place-items-center rounded-lg border text-sm font-extrabold",
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
    </SheetShell>
  );
}

function OptionRow({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm font-bold",
        focusRing,
        selected
          ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "border-[color:var(--border)] text-[color:var(--text)]",
      )}
    >
      <span className="min-w-0 flex-1">
        {label}
        {hint ? <span className="mt-0.5 block text-2xs font-medium text-[color:var(--text-muted)]">{hint}</span> : null}
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </button>
  );
}

function BrowseFilterSheet({ state, anchored }: { state: BrowseState; anchored?: boolean }) {
  const close = () => state.setFiltersOpen(false);
  return (
    <SheetShell title="Filter & sort" onClose={close} anchored={anchored}>
      <div className="grid gap-3">
        <section aria-label="Show" className="rounded-xl border border-[color:var(--clinical-accent-border)] p-2">
          <p className="px-1 pb-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Show · moved here from the header
          </p>
          <div className="grid gap-1.5">
            <OptionRow
              label="All terms"
              hint="Definitions, clinical findings, legal and ethical entries"
              selected={!state.abbrOnly}
              onSelect={() => state.setAbbrOnly(false)}
            />
            <OptionRow
              label="Abbreviations only"
              hint="Short forms and every meaning each one carries"
              selected={state.abbrOnly}
              onSelect={() => state.setAbbrOnly(true)}
            />
          </div>
        </section>
        <section aria-label="Sort">
          <p className="px-1 pb-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
            Sort
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {(["az", "za"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={state.sort === option}
                onClick={() => state.setSort(option)}
                className={cn(
                  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-extrabold",
                  focusRing,
                  state.sort === option
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "border-[color:var(--border)] text-[color:var(--text)]",
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                {option === "az" ? "A–Z" : "Z–A"}
              </button>
            ))}
          </div>
        </section>
        <section aria-label="Topics">
          <p className="px-1 pb-1.5 text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-muted)]">
            Topics
          </p>
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
        </section>
        <button
          type="button"
          onClick={close}
          className={cn(
            "h-11 w-full rounded-lg bg-[color:var(--clinical-accent)] text-sm font-extrabold text-[color:var(--clinical-accent-contrast)]",
            focusRing,
          )}
        >
          Show {state.abbrOnly ? 24 : 96} {state.abbrOnly ? "abbreviations" : "terms"}
        </button>
      </div>
    </SheetShell>
  );
}

/* ------------------------------- headers ----------------------------- */

function LetterRailDesktop({ value, onSelect }: { value: string; onSelect: (next: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto px-6 pb-2">
      {["All", ...letters].map((option) => (
        <button
          key={option}
          type="button"
          aria-current={value === option ? "page" : undefined}
          onClick={() => onSelect(option)}
          className={cn(
            "grid h-11 min-w-11 shrink-0 place-items-center rounded-lg border px-2 text-xs font-extrabold",
            focusRing,
            value === option
              ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
              : "border-[color:var(--border)] text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function VersionHeader({ version, compact, state }: { version: Version; compact: boolean; state: BrowseState }) {
  const count = state.abbrOnly ? "24 abbreviations" : "96 terms";

  if (version === "titlebar") {
    return (
      <div className="bg-[color:var(--background)]">
        <div className={cn("flex items-center gap-3", compact ? "px-4 pb-2 pt-3" : "px-6 pb-3 pt-5")}>
          <h2
            className={cn(
              "font-extrabold tracking-tight text-[color:var(--text-heading)]",
              compact ? "text-2xl" : "text-3xl",
            )}
          >
            Browse terms
          </h2>
          <span className="nums ml-auto text-xs font-bold text-[color:var(--text-muted)]">{count}</span>
          {compact ? null : (
            <>
              {state.abbrOnly ? <AbbrChip onClear={() => state.setAbbrOnly(false)} /> : null}
              <FiltersControl count={state.activeFilters} labelled onOpen={() => state.setFiltersOpen(true)} />
            </>
          )}
        </div>
        <div className="sticky top-0 z-10 border-y border-[color:var(--border)] bg-[color:var(--surface)]">
          {compact ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2">
                <LetterTrigger value={state.letter} onOpen={() => state.setLetterOpen(true)} grow />
                <FiltersControl count={state.activeFilters} labelled onOpen={() => state.setFiltersOpen(true)} />
              </div>
              {state.abbrOnly ? (
                <div className="flex items-center gap-2 px-4 pb-2">
                  <AbbrChip onClear={() => state.setAbbrOnly(false)} />
                </div>
              ) : null}
            </>
          ) : (
            <div className="py-2">
              <LetterRailDesktop value={state.letter} onSelect={state.setLetter} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (version === "single") {
    return (
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
          compact ? "px-3 py-2" : "px-6 py-3",
        )}
      >
        <h2
          className={cn(
            "min-w-0 truncate font-extrabold tracking-tight text-[color:var(--text-heading)]",
            compact ? "text-xl" : "shrink-0 text-2xl",
            compact && state.abbrOnly && "sr-only",
          )}
        >
          Browse terms
        </h2>
        <LetterTrigger
          value={state.letter}
          onOpen={() => state.setLetterOpen(true)}
          size={compact ? "chip" : "regular"}
        />
        {state.abbrOnly ? (
          <AbbrChip onClear={() => state.setAbbrOnly(false)} size={compact ? "chip" : "regular"} />
        ) : null}
        <span className={cn("ml-auto shrink-0", compact && state.abbrOnly && "sr-only")}>
          <CountPill>{state.abbrOnly ? 24 : 96}</CountPill>
        </span>
        <FiltersControl
          count={state.activeFilters}
          labelled={!compact}
          onOpen={() => state.setFiltersOpen(true)}
          size={compact ? "chip" : "regular"}
        />
      </div>
    );
  }

  return (
    <>
      {compact ? (
        <h2 className="sr-only">Browse terms</h2>
      ) : (
        <div className="px-6 pb-3 pt-5">
          <h2 className="text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)]">Browse terms</h2>
        </div>
      )}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 border-y border-[color:var(--border)] bg-[color:var(--surface-subtle)]",
          compact ? "px-3 py-1.5" : "px-6 py-2",
        )}
      >
        <LetterTrigger value={state.letter} onOpen={() => state.setLetterOpen(true)} size="chip" />
        {state.abbrOnly ? <AbbrChip onClear={() => state.setAbbrOnly(false)} size="chip" /> : null}
        <span className="nums ml-auto text-2xs font-bold text-[color:var(--text-muted)]">{count}</span>
        <FiltersControl count={state.activeFilters} onOpen={() => state.setFiltersOpen(true)} size="chip" />
      </div>
    </>
  );
}

/* -------------------------------- frames ------------------------------ */

function VersionResults({ state }: { state: BrowseState }) {
  const rows = state.abbrOnly ? sampleEntries.slice(0, 2) : sampleEntries;
  return (
    <div>
      {[...rows, ...rows].map((entry, index) => (
        <ResultRow key={`${entry.term}-${index}`} entry={entry} />
      ))}
    </div>
  );
}

function VersionFrames({ version }: { version: Version }) {
  const desktop = useBrowseState();
  const phone = useBrowseState();

  const overlayFor = (state: BrowseState, anchored: boolean) => {
    if (state.letterOpen) {
      return (
        <LetterPicker
          value={state.letter}
          anchored={anchored}
          onSelect={(next) => {
            state.setLetter(next);
            state.setLetterOpen(false);
          }}
          onClose={() => state.setLetterOpen(false)}
        />
      );
    }
    if (state.filtersOpen) return <BrowseFilterSheet state={state} anchored={anchored} />;
    return null;
  };

  return (
    <>
      <DesktopFrame label="Desktop" overlay={overlayFor(desktop, true)}>
        <VersionHeader version={version} compact={false} state={desktop} />
        <VersionResults state={desktop} />
      </DesktopFrame>
      <PhoneFrame label="Phone" overlay={overlayFor(phone, false)}>
        <VersionHeader version={version} compact state={phone} />
        <VersionResults state={phone} />
      </PhoneFrame>
    </>
  );
}

/* --------------------------------- page -------------------------------- */

export function DictionaryBrowseHeaderCompactMockupsPage() {
  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · Browse · round two
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Letters in a dropdown, Abbreviations in Filters
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            Three compact takes on the title-bar direction. All three replace the 27-chip horizontal rail with an
            alphabetical dropdown on phones and move Abbreviations out of the header into the Filters sheet beside sort.
            They differ only in how much header survives around those two controls.{" "}
            <strong
              className="font-extrabold
            text-[color:var(--text)]"
            >
              01 is the selected direction
            </strong>
            ; 02 and 03 stay here as the compact alternatives it was chosen over.
          </p>
          <p className="mt-3 max-w-3xl rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 py-2.5 text-sm font-medium text-[color:var(--text)]">
            Every frame is live. Open the letter dropdown, then open Filters and switch to{" "}
            <strong className="font-extrabold">Abbreviations only</strong> — a purple chip appears beside the letter
            control. That chip is load-bearing: a view switch demoted into a sheet is otherwise invisible, and the
            header would claim to list all 96 terms while showing 24 abbreviations.
          </p>
        </div>
      </header>

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
                        Selected direction
                      </span>
                    ) : null}
                    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
                      {version.chrome}
                    </span>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">{version.summary}</p>
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

            <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)]">
              <VersionFrames version={version.id} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
