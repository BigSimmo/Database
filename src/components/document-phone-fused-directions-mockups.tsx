"use client";

import {
  ArrowLeft,
  ChevronDown,
  Compass,
  FileImage,
  FileSearch,
  FileText,
  ListTree,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";

import { cn } from "@/components/ui-primitives";

type DirectionId = "chips" | "track" | "grid";
type FrameState = "closed" | "open";

const documentTitle = "Clinical practice guideline for schizophrenia";

const sections: Array<{ label: string; short: string; detail: string; icon: LucideIcon; collapsible: boolean }> = [
  { label: "Overview", short: "Overview", detail: "84 pages", icon: Compass, collapsible: false },
  { label: "High-yield summary", short: "Summary", detail: "8 points", icon: Sparkles, collapsible: true },
  { label: "PDF preview", short: "PDF", detail: "p. 12 / 84", icon: FileText, collapsible: false },
  { label: "Pinned evidence", short: "Evidence", detail: "27 passages", icon: Quote, collapsible: false },
  { label: "Indexed source text", short: "Text", detail: "312 chunks", icon: FileSearch, collapsible: true },
  { label: "Tables and diagrams", short: "Tables", detail: "6 visuals", icon: FileImage, collapsible: true },
  { label: "Indexing details", short: "Indexing", detail: "v3 · OCR", icon: ShieldCheck, collapsible: true },
];

const activeIndex = 3;
const activeSection = sections[activeIndex];

const directions: Array<{
  id: DirectionId;
  title: string;
  verdict: string;
  description: string;
  notes: string[];
}> = [
  {
    id: "chips",
    title: "Section chips on line two",
    verdict: "Navigate without opening",
    description:
      "Line two stops being a label and becomes a swipeable strip of section chips. Most moves happen without the pane ever opening; the chevron is still there for a full, ordered list.",
    notes: [
      "Row height is unchanged — the chip strip occupies the line the section label used.",
      "Chips scroll horizontally, so the pane stays the only place the full order is visible.",
      "Active chip carries the accent; the strip auto-scrolls to keep it in view.",
      "Off-screen chips are the known cost — the chevron exists precisely for that.",
    ],
  },
  {
    id: "track",
    title: "Segment track",
    verdict: "Quietest",
    description:
      "Position stops being words. A seven-segment hairline sits on the bottom edge of the row, filled to the active section, so the title keeps the whole width and nothing numeric competes with it.",
    notes: [
      "The `· 4 of 7` text disappears — the track carries it in 2 px of height.",
      "Track segments are tap targets too, but the row remains the primary control.",
      "Reads as a progress hairline, so it never looks like a second toolbar.",
      "Needs a non-colour cue for the active segment under forced-colors.",
    ],
  },
  {
    id: "grid",
    title: "Two-column pane",
    verdict: "Whole list at a glance",
    description:
      "The row you liked, untouched. Only the pane changes: seven compact cards in two columns, so the entire document structure is visible at once with no internal scrolling.",
    notes: [
      "Pane is roughly half the height of the seven-row list and never scrolls.",
      "Counts stay on every card — the density comes from layout, not from dropping information.",
      "Odd count leaves one full-width card, which the current section takes.",
      "Card labels truncate at two words on the narrowest phones.",
    ],
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function UniversalHeader() {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)]">
        <ListTree aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
        Documents
      </span>
      <span className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Search aria-hidden="true" className="h-4 w-4" />
      </span>
      <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-[color:var(--clinical-accent-soft)]" />
    </div>
  );
}

function TitleLine() {
  return (
    <span className="block truncate text-sm-minus font-semibold leading-tight text-[color:var(--text-heading)]">
      {documentTitle}
    </span>
  );
}

function PaneList() {
  return (
    <ul className="space-y-0.5">
      {sections.map((section, index) => {
        const selected = index === activeIndex;
        const Icon = section.icon;

        return (
          <li key={section.label}>
            <button
              type="button"
              onClick={() => undefined}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "relative flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
                focusRing,
                selected
                  ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              {selected ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
                />
              ) : null}
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{section.label}</span>
              <span className="nums shrink-0 text-3xs font-semibold text-[color:var(--text-soft)]">
                {section.detail}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PaneGrid() {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {sections.map((section, index) => {
        const selected = index === activeIndex;
        const Icon = section.icon;
        const last = index === sections.length - 1;

        return (
          <button
            key={section.label}
            type="button"
            onClick={() => undefined}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg border px-2 text-left transition",
              focusRing,
              last && "col-span-2",
              selected
                ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)]",
            )}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-3xs font-bold leading-tight">{section.label}</span>
              <span className="nums block truncate text-3xs font-semibold text-[color:var(--text-soft)]">
                {section.detail}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Pane({ id, layout }: { id: string; layout: "list" | "grid" }) {
  return (
    <div
      id={id}
      className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-2 pb-2 pt-1.5 shadow-[var(--e1)]"
    >
      <p className="px-1 pb-1 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Jump to</p>
      {layout === "grid" ? <PaneGrid /> : <PaneList />}
    </div>
  );
}

function Canvas() {
  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-[color:var(--background)] p-3">
      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Quote aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
              Source passages
            </p>
            <h4 className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">{activeSection.label}</h4>
          </div>
        </div>
        <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3">
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/55" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-11/12 rounded-full bg-[color:var(--border-strong)]/40" />
        </div>
      </section>
      <div className="mt-3 space-y-3">
        {[0, 1, 2].map((block) => (
          <div key={block} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="h-1.5 w-1/2 rounded-full bg-[color:var(--text-heading)]/12" />
            <div className="mt-2.5 space-y-2">
              <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
              <div className="h-1 w-9/12 rounded-full bg-[color:var(--border-strong)]/35" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Direction A — chip strip ---------------- */

function ChipsDirection({ open }: { open: boolean }) {
  const paneId = useId();

  return (
    <>
      <UniversalHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-14 shrink-0 items-stretch gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] pl-1.5">
          <span className="grid w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1.5">
            <TitleLine />
            <span className="-mx-0.5 flex gap-1 overflow-x-auto pb-0.5">
              {sections.map((section, index) => (
                <button
                  key={section.label}
                  type="button"
                  onClick={() => undefined}
                  aria-current={index === activeIndex ? "true" : undefined}
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-3xs font-bold transition",
                    focusRing,
                    index === activeIndex
                      ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "border-[color:var(--border)] text-[color:var(--text-muted)]",
                  )}
                >
                  {section.short}
                </button>
              ))}
            </span>
          </span>
          <button
            type="button"
            onClick={() => undefined}
            aria-expanded={open}
            aria-controls={paneId}
            aria-label="All sections"
            className={cn("grid w-10 shrink-0 place-items-center text-[color:var(--text-muted)]", focusRing)}
          >
            <ChevronDown aria-hidden="true" className={cn("h-4 w-4", open && "rotate-180")} />
          </button>
        </div>
        {open ? <Pane id={paneId} layout="list" /> : null}
        <Canvas />
      </div>
    </>
  );
}

/* ---------------- Direction B — segment track ---------------- */

function TrackDirection({ open }: { open: boolean }) {
  const paneId = useId();

  return (
    <>
      <UniversalHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-14 shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-1.5">
          <span className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={() => undefined}
            aria-expanded={open}
            aria-controls={paneId}
            className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left", focusRing)}
          >
            <span className="min-w-0 flex-1">
              <TitleLine />
              <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
                <activeSection.icon aria-hidden="true" className="h-3 w-3" />
                <span className="truncate">{activeSection.label}</span>
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)]", open && "rotate-180")}
            />
          </button>
          {/* Position as 2 px of height instead of words. */}
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex gap-px px-1.5">
            {sections.map((section, index) => (
              <span
                key={section.label}
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  index < activeIndex
                    ? "bg-[color:var(--clinical-accent)]/40"
                    : index === activeIndex
                      ? "bg-[color:var(--clinical-accent)]"
                      : "bg-[color:var(--border-strong)]/35",
                )}
              />
            ))}
          </span>
        </div>
        {open ? <Pane id={paneId} layout="list" /> : null}
        <Canvas />
      </div>
    </>
  );
}

/* ---------------- Direction C — two-column pane ---------------- */

function GridDirection({ open }: { open: boolean }) {
  const paneId = useId();

  return (
    <>
      <UniversalHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-14 shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-1.5">
          <span className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={() => undefined}
            aria-expanded={open}
            aria-controls={paneId}
            className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left", focusRing)}
          >
            <span className="min-w-0 flex-1">
              <TitleLine />
              <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
                <activeSection.icon aria-hidden="true" className="h-3 w-3" />
                <span className="truncate">{activeSection.label}</span>
                <span className="nums font-semibold text-[color:var(--text-soft)]">
                  · {activeIndex + 1} of {sections.length}
                </span>
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)]", open && "rotate-180")}
            />
          </button>
        </div>
        {open ? <Pane id={paneId} layout="grid" /> : null}
        <Canvas />
      </div>
    </>
  );
}

function PhoneFrame({ direction, state }: { direction: DirectionId; state: FrameState }) {
  const open = state === "open";

  return (
    <div className="min-w-0">
      <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        {open ? "Pane open" : "Pane closed"}
      </p>
      <div
        data-direction={direction}
        data-state={state}
        className="relative flex h-[28rem] w-[350px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        {direction === "chips" ? <ChipsDirection open={open} /> : null}
        {direction === "track" ? <TrackDirection open={open} /> : null}
        {direction === "grid" ? <GridDirection open={open} /> : null}
      </div>
    </div>
  );
}

function DirectionShowcase({ direction, number }: { direction: (typeof directions)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${direction.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Direction {String(number).padStart(2, "0")} · {direction.verdict}
          </p>
          <h2
            id={`${direction.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {direction.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {direction.description}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-start">
        <div className="flex flex-wrap items-start gap-4">
          <PhoneFrame direction={direction.id} state="closed" />
          <PhoneFrame direction={direction.id} state="open" />
        </div>
        <ul className="space-y-2">
          {direction.notes.map((note) => (
            <li
              key={note}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]"
            >
              {note}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function DocumentPhoneFusedDirectionsMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Fused row, three directions
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Same fused row, three different bets
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            All three keep the row you preferred: full-width title on line one, section on line two, chevron on the
            right, and a pane that pushes the document down rather than covering it. They differ in what line two does
            and what the pane looks like. Chrome stays one row, so it still hides and reveals with the header rather
            than owning a second scroll behaviour.
          </p>
        </header>

        <div className="mt-8 space-y-12">
          {directions.map((direction, index) => (
            <DirectionShowcase key={direction.id} direction={direction} number={index + 1} />
          ))}
        </div>
      </div>
    </main>
  );
}
