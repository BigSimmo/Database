"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Filter,
  GitCompareArrows,
  Menu,
  MessageSquarePlus,
  Plus,
  Search,
  SendHorizontal,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { cn } from "@/components/ui-primitives";

/* ------------------------------------------------------------------ *
 * Dictionary → Browse header redesign study (2026-08-18)
 *
 * Brief: drop the description line under "Browse terms", drop the
 * orphaned A–Z / Z–A sort pill that floats on its own row, and rebuild
 * the header so the phone layout reaches a result without five stacked
 * bands. Sort survives inside the Filters sheet in all three, which is
 * where the other modes already keep it.
 * ------------------------------------------------------------------ */

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

export const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Direction = "titlebar" | "rail" | "index";

export type SampleEntry = {
  term: string;
  kind: string;
  alias?: string;
  definition: string;
};

export const sampleEntries: readonly SampleEntry[] = [
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

const directions: ReadonlyArray<{
  id: Direction;
  number: string;
  name: string;
  summary: string;
  strengths: readonly string[];
  cost: string;
  bands: string;
  recommended?: boolean;
}> = [
  {
    id: "titlebar",
    number: "01",
    name: "Compact title bar",
    summary:
      "The smallest honest edit: title and count share a line, the view switch and letter rail fuse into one sticky control band, and sort moves into Filters.",
    strengths: ["Lowest migration risk", "Keeps both browse views explicit", "Rail stays pinned while scrolling"],
    cost: "Still two bands of chrome before the first result on a phone.",
    bands: "2 bands on phone",
  },
  {
    id: "rail",
    number: "02",
    name: "Fused letter rail",
    summary:
      "The A–Z / Abbreviations segment disappears. All and Abbr become pinned lead chips on the letter rail itself, so one row does both jobs.",
    strengths: ["One control row total", "Abbr stays visible, never scrolls away", "Largest vertical saving"],
    cost: "Abbreviations reads as a peer of a letter rather than a separate view.",
    bands: "2 bands on phone",
    recommended: true,
  },
  {
    id: "index",
    number: "03",
    name: "Index rail + jump sheet",
    summary:
      "No horizontal scroller at all. The title carries the active scope and opens a jump sheet — tap it in either frame below; a Contacts-style index rail rides the right edge of the list.",
    strengths: ["Results start after one band", "Scales past 96 terms", "Sticky letter headings orient the scroll"],
    cost: "The edge rail is a fine-motor target; the jump sheet is the accessible path and must stay first-class.",
    bands: "1 band on phone",
  },
];

/* ---------------------------- shared bits ---------------------------- */

export function ResultRow({ entry }: { entry: SampleEntry }) {
  return (
    <article className="grid min-w-0 grid-cols-[0.1875rem_minmax(0,1fr)] border-b border-[color:var(--border)] bg-[color:var(--surface)] last:border-b-0">
      <span className="bg-[color:var(--clinical-accent)]" aria-hidden="true" />
      <div className="min-w-0 px-3 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-extrabold leading-5 text-[color:var(--text-heading)]">{entry.term}</h3>
              <span className="rounded-md border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-1.5 py-0.5 text-3xs font-extrabold text-[color:var(--clinical-accent)]">
                {entry.kind}
              </span>
            </div>
            {entry.alias ? (
              <p className="mt-1 text-2xs font-semibold text-[color:var(--text-muted)]">Also known as {entry.alias}</p>
            ) : null}
            <p className="mt-1 text-xs leading-5 text-[color:var(--text)]">{entry.definition}</p>
          </div>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[color:var(--clinical-accent)]">
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-3xs font-semibold text-[color:var(--text-muted)]">
            <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-[color:var(--success)] text-[color:var(--success)]">
              <Check className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
            </span>
            Source linked
          </span>
          <span className="inline-flex items-center gap-1 text-3xs font-bold text-[color:var(--text-muted)]">
            <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
            Add to compare
          </span>
        </div>
      </div>
    </article>
  );
}

function LetterChip({
  value,
  active,
  onSelect,
  tone = "accent",
}: {
  value: string;
  active: boolean;
  onSelect: () => void;
  tone?: "accent" | "purple";
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
      className={cn(
        "grid h-11 min-w-11 shrink-0 place-items-center rounded-lg border px-2 text-xs font-extrabold transition-colors",
        focusRing,
        active
          ? tone === "purple"
            ? "border-[color:var(--tone-purple)] bg-[color:var(--tone-purple)] text-[color:var(--surface)]"
            : "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
          : tone === "purple"
            ? "border-[color:var(--tone-purple-border)] bg-[color:var(--tone-purple-soft)] text-[color:var(--tone-purple)]"
            : "border-[color:var(--border)] text-[color:var(--clinical-accent)] hover:bg-[color:var(--surface-subtle)]",
      )}
    >
      {value}
    </button>
  );
}

function FilterButton({ count, labelled = false, onOpen }: { count: number; labelled?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={labelled ? undefined : `Filters and sort${count ? `, ${count} active` : ""}`}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
        focusRing,
        labelled ? "px-3" : count ? "px-2.5" : "w-11",
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

export function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="nums shrink-0 rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-2xs font-extrabold text-[color:var(--text-muted)]">
      {children}
    </span>
  );
}

/* ------------------------- direction 01: title bar ------------------------- */

function TitleBarHeader({ compact }: { compact: boolean }) {
  const [view, setView] = useState<"az" | "abbr">("az");
  const [letter, setLetter] = useState("All");

  return (
    <div className="bg-[color:var(--background)]">
      <div className={cn(compact ? "px-4 pb-2 pt-3" : "px-6 pb-3 pt-5")}>
        {!compact ? (
          <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Complete catalogue
          </p>
        ) : null}
        <div className={cn("flex items-baseline gap-3", !compact && "mt-1")}>
          <h2
            className={cn(
              "font-extrabold tracking-tight text-[color:var(--text-heading)]",
              compact ? "text-2xl" : "text-3xl",
            )}
          >
            Browse terms
          </h2>
          <span className="nums ml-auto text-xs font-bold text-[color:var(--text-muted)]">96 terms</span>
        </div>
      </div>
      <div className="sticky top-0 z-10 border-y border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className={cn("flex items-center gap-2 py-2", compact ? "px-4" : "px-6")}>
          <div
            className={cn(
              "inline-flex h-11 overflow-hidden rounded-lg border border-[color:var(--border)]",
              compact && "flex-1",
            )}
            role="group"
            aria-label="Browse view"
          >
            {(["az", "abbr"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={cn(
                  "px-4 text-sm font-bold transition-colors",
                  focusRing,
                  compact && "flex-1",
                  !compact && "min-w-[7.5rem]",
                  view === option
                    ? "bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
                )}
              >
                {option === "az" ? "A–Z" : "Abbreviations"}
              </button>
            ))}
          </div>
          <FilterButton count={1} labelled={!compact} onOpen={() => undefined} />
        </div>
        <div className={cn("flex gap-1 overflow-x-auto pb-2", compact ? "px-4" : "px-6")}>
          {["All", ...letters].map((value) => (
            <LetterChip key={value} value={value} active={letter === value} onSelect={() => setLetter(value)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- direction 02: fused rail ------------------------ */

function FusedRailHeader({ compact }: { compact: boolean }) {
  const [scope, setScope] = useState("All");

  return (
    <div className="bg-[color:var(--background)]">
      <div className={cn("flex items-center gap-2", compact ? "px-4 py-2.5" : "px-6 py-4")}>
        <h2
          className={cn(
            "font-extrabold tracking-tight text-[color:var(--text-heading)]",
            compact ? "text-2xl" : "text-3xl",
          )}
        >
          Browse terms
        </h2>
        <CountPill>96</CountPill>
        <span className="ml-auto" />
        <FilterButton count={1} labelled={!compact} onOpen={() => undefined} />
      </div>
      <div className="sticky top-0 z-10 flex border-y border-[color:var(--border)] bg-[color:var(--surface)]">
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 border-r border-[color:var(--border)] py-2 pr-2",
            compact ? "pl-4" : "pl-6",
          )}
        >
          <LetterChip value="All" active={scope === "All"} onSelect={() => setScope("All")} />
          <LetterChip value="Abbr" active={scope === "Abbr"} onSelect={() => setScope("Abbr")} tone="purple" />
        </div>
        <div className="flex flex-1 gap-1 overflow-x-auto px-2 py-2">
          {letters.map((value) => (
            <LetterChip key={value} value={value} active={scope === value} onSelect={() => setScope(value)} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------- direction 03: index rail + sheet -------------------- */

function IndexHeader({ compact, scope, onOpenSheet }: { compact: boolean; scope: string; onOpenSheet: () => void }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        compact ? "px-3 py-2" : "px-6 py-3",
      )}
    >
      <button
        type="button"
        onClick={onOpenSheet}
        className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg pr-2 text-left", focusRing)}
      >
        <span
          className={cn(
            "font-extrabold tracking-tight text-[color:var(--text-heading)]",
            compact ? "text-xl" : "text-2xl",
          )}
        >
          Browse terms
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-2xs font-extrabold text-[color:var(--clinical-accent)]">
          {scope}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </span>
      </button>
      <span className="nums ml-auto text-xs font-bold text-[color:var(--text-muted)]">96</span>
      <FilterButton count={1} onOpen={() => undefined} />
    </div>
  );
}

function JumpSheet({
  scope,
  onSelect,
  onClose,
}: {
  scope: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close jump to letter"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--overlay-backdrop)]"
      />
      <div className="relative rounded-t-2xl border-t border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[var(--e2)]">
        <div className="flex items-center gap-2 pb-2">
          <p className="text-sm font-extrabold text-[color:var(--text-heading)]">Jump to</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cn(
              "ml-auto grid h-9 w-9 place-items-center rounded-lg text-[color:var(--text-muted)]",
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex gap-2 pb-2">
          <button
            type="button"
            onClick={() => onSelect("All")}
            className={cn(
              "h-11 flex-1 rounded-lg border text-sm font-extrabold",
              focusRing,
              scope === "All"
                ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                : "border-[color:var(--border)] text-[color:var(--text)]",
            )}
          >
            All terms
          </button>
          <button
            type="button"
            onClick={() => onSelect("Abbr")}
            className={cn(
              "h-11 flex-1 rounded-lg border text-sm font-extrabold",
              focusRing,
              scope === "Abbr"
                ? "border-[color:var(--tone-purple)] bg-[color:var(--tone-purple)] text-[color:var(--surface)]"
                : "border-[color:var(--tone-purple-border)] bg-[color:var(--tone-purple-soft)] text-[color:var(--tone-purple)]",
            )}
          >
            Abbreviations
          </button>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
          {letters.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={cn(
                "grid h-11 place-items-center rounded-lg border text-sm font-extrabold",
                focusRing,
                scope === value
                  ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                  : "border-[color:var(--border)] text-[color:var(--clinical-accent)]",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IndexRail({
  scope,
  onSelect,
  compact,
}: {
  scope: string;
  onSelect: (value: string) => void;
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-y-0 right-0 z-10 flex flex-col items-center justify-center border-l py-2",
        compact
          ? "w-6 gap-px border-transparent"
          : "w-8 gap-0.5 border-[color:var(--border)] bg-[color:var(--surface-subtle)]",
      )}
      role="group"
      aria-label="Jump to letter"
    >
      {letters.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          aria-label={`Jump to ${value}`}
          className={cn(
            "font-extrabold leading-none",
            compact ? "text-3xs" : "grid h-4 w-5 place-items-center rounded text-2xs hover:bg-[color:var(--surface)]",
            scope === value ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ device frames ------------------------------ */

export function PhoneChrome() {
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
      <div className="flex gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3">
        {[
          { label: "Search", active: false },
          { label: "Browse", active: true },
          { label: "More", active: false },
        ].map((tab) => (
          <span
            key={tab.label}
            className={cn(
              "border-b-2 py-2 text-xs font-bold",
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

export function PhoneComposer() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
      <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
        <Plus className="h-4 w-4 text-[color:var(--text-muted)]" aria-hidden="true" />
        <span className="flex-1 text-xs font-medium text-[color:var(--text-soft)]">Search a term or abbreviation…</span>
        <SendHorizontal className="h-4 w-4 text-[color:var(--text-soft)]" aria-hidden="true" />
      </div>
    </div>
  );
}

export function PhoneFrame({
  children,
  label,
  overlay,
}: {
  children: React.ReactNode;
  label: string;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">390 px · scrollable</span>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
        <PhoneChrome />
        <div className="relative h-[26rem] overflow-y-auto pb-14">{children}</div>
        <PhoneComposer />
        {overlay}
      </div>
    </div>
  );
}

export function DesktopFrame({
  children,
  label,
  overlay,
}: {
  children: React.ReactNode;
  label: string;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--text-soft)]">{label}</span>
        <span className="text-3xs font-bold text-[color:var(--text-soft)]">1440 px</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-3">
        <div className="relative min-w-[42rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]">
          {children}
          {overlay}
        </div>
      </div>
    </div>
  );
}

function ResultList({
  withIndexRail,
  scope,
  onSelect,
  compact = false,
}: {
  withIndexRail?: boolean;
  scope?: string;
  onSelect?: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="relative">
      {withIndexRail ? (
        <div className="sticky top-[3.25rem] z-[5] border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-1 text-2xs font-extrabold text-[color:var(--text-muted)]">
          A
        </div>
      ) : (
        <p className="px-4 py-2 text-2xs font-semibold text-[color:var(--text-muted)]">96 showing</p>
      )}
      <div className={cn(withIndexRail && (compact ? "pr-6" : "pr-8"))}>
        {[...sampleEntries, ...sampleEntries].map((entry, index) => (
          <ResultRow key={`${entry.term}-${index}`} entry={entry} />
        ))}
      </div>
      {withIndexRail && scope && onSelect ? <IndexRail scope={scope} onSelect={onSelect} compact={compact} /> : null}
    </div>
  );
}

function SimpleDirectionFrames({ direction }: { direction: Exclude<Direction, "index"> }) {
  const Header = direction === "titlebar" ? TitleBarHeader : FusedRailHeader;
  return (
    <>
      <DesktopFrame label="Desktop">
        <Header compact={false} />
        <ResultList />
      </DesktopFrame>
      <PhoneFrame label="Phone">
        <Header compact />
        <ResultList />
      </PhoneFrame>
    </>
  );
}

function IndexDirectionFrames() {
  const [desktopScope, setDesktopScope] = useState("All");
  const [desktopSheet, setDesktopSheet] = useState(false);
  const [phoneScope, setPhoneScope] = useState("All");
  const [phoneSheet, setPhoneSheet] = useState(false);

  return (
    <>
      <DesktopFrame
        label="Desktop"
        overlay={
          desktopSheet ? (
            <JumpSheet
              scope={desktopScope}
              onSelect={(value) => {
                setDesktopScope(value);
                setDesktopSheet(false);
              }}
              onClose={() => setDesktopSheet(false)}
            />
          ) : null
        }
      >
        <IndexHeader compact={false} scope={desktopScope} onOpenSheet={() => setDesktopSheet(true)} />
        <ResultList withIndexRail scope={desktopScope} onSelect={setDesktopScope} />
      </DesktopFrame>
      <PhoneFrame
        label="Phone"
        overlay={
          phoneSheet ? (
            <JumpSheet
              scope={phoneScope}
              onSelect={(value) => {
                setPhoneScope(value);
                setPhoneSheet(false);
              }}
              onClose={() => setPhoneSheet(false)}
            />
          ) : null
        }
      >
        <IndexHeader compact scope={phoneScope} onOpenSheet={() => setPhoneSheet(true)} />
        <ResultList withIndexRail scope={phoneScope} onSelect={setPhoneScope} compact />
      </PhoneFrame>
    </>
  );
}

/* --------------------------------- page ---------------------------------- */

export function DictionaryBrowseHeaderMockupsPage() {
  const [showBefore, setShowBefore] = useState(true);

  return (
    <main className="min-h-full bg-[color:var(--background)] text-[color:var(--text)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
            Dictionary · Browse
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-extrabold tracking-tight text-[color:var(--text-heading)] sm:text-4xl">
            Three headers for Browse terms, rebuilt for the phone
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[color:var(--text-muted)] sm:text-base">
            All three drop the description line and the orphaned A–Z / Z–A sort pill. Sort moves into the Filters sheet,
            which is where every other mode already keeps it. What differs is how much of the letter navigation stays on
            screen.
          </p>
          <button
            type="button"
            onClick={() => setShowBefore((value) => !value)}
            className={cn(
              "mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text)]",
              focusRing,
            )}
            aria-expanded={showBefore}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            {showBefore ? "Hide the current header" : "Show the current header"}
          </button>
        </div>
      </header>

      {showBefore ? (
        <section aria-labelledby="before-title" className="mx-auto max-w-[92rem] px-4 pt-8 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--surface)]">
            <div className="border-b border-[color:var(--border)] bg-[color:var(--warning-soft)] px-4 py-3 sm:px-5">
              <h2 id="before-title" className="text-lg font-extrabold text-[color:var(--text-heading)]">
                Today — five stacked bands
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                Kicker, title, description, view switch, a sort pill alone on its own row, then the letter rail. On a
                390 px phone the first result lands below the fold.
              </p>
            </div>
            <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)]">
              <DesktopFrame label="Desktop — current">
                <CurrentHeader compact={false} />
                <ResultList />
              </DesktopFrame>
              <PhoneFrame label="Phone — current">
                <CurrentHeader compact />
                <ResultList />
              </PhoneFrame>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mx-auto grid max-w-[92rem] gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {directions.map((direction) => (
          <section
            key={direction.id}
            aria-labelledby={`${direction.id}-title`}
            className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-inset)]"
          >
            <div className="grid gap-4 border-b border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 gap-3">
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
                    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-3xs font-bold text-[color:var(--text-muted)]">
                      {direction.bands}
                    </span>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm font-medium text-[color:var(--text-muted)]">
                    {direction.summary}
                  </p>
                  <p className="mt-1.5 max-w-3xl text-xs font-semibold text-[color:var(--text-soft)]">
                    Trade-off · {direction.cost}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
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

            <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)]">
              {direction.id === "index" ? <IndexDirectionFrames /> : <SimpleDirectionFrames direction={direction.id} />}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

/* The header exactly as it ships today, for side-by-side judgement. */
function CurrentHeader({ compact }: { compact: boolean }) {
  return (
    <div className="bg-[color:var(--background)]">
      <div className={cn(compact ? "px-4 pb-3 pt-4" : "px-6 pb-4 pt-5")}>
        <p className="text-3xs font-extrabold uppercase tracking-kicker text-[color:var(--clinical-accent)]">
          Complete catalogue
        </p>
        <h2
          className={cn(
            "mt-1 font-extrabold tracking-tight text-[color:var(--text-heading)]",
            compact ? "text-2xl" : "text-3xl",
          )}
        >
          Browse terms
        </h2>
        <p className="mt-2 text-xs text-[color:var(--text-muted)]">
          Scan the same source-linked result system by letter or abbreviation.
        </p>
      </div>
      <div className="border-y border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className={cn("grid gap-3 py-3", compact ? "px-4" : "px-6")}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-11 overflow-hidden rounded-lg border border-[color:var(--border)]">
              <span className="grid min-w-[7rem] place-items-center bg-[color:var(--clinical-accent)] px-3 text-sm font-bold text-[color:var(--clinical-accent-contrast)]">
                A–Z
              </span>
              <span className="grid min-w-[7rem] place-items-center px-3 text-sm font-bold text-[color:var(--text-muted)]">
                Abbreviations
              </span>
            </div>
            <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text)]">
              <Filter className="h-4 w-4" aria-hidden="true" /> Filters
            </span>
            <span className="ml-auto inline-flex h-11 items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-sm font-bold text-[color:var(--text-muted)]">
              A–Z
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {["All", ...letters].map((value) => (
              <span
                key={value}
                className={cn(
                  "grid h-11 min-w-11 shrink-0 place-items-center rounded-md border px-2 text-xs font-extrabold",
                  value === "All"
                    ? "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent)] text-[color:var(--clinical-accent-contrast)]"
                    : "border-[color:var(--border)] text-[color:var(--clinical-accent)]",
                )}
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
