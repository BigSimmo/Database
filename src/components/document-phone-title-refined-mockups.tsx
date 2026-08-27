"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  FileImage,
  FileSearch,
  FileText,
  ListTree,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";

import { cn } from "@/components/ui-primitives";

type VariantId = "refined" | "stepper" | "collapse";
type FrameState = "rest" | "open" | "compact";

const documentTitle = "Clinical practice guideline for schizophrenia";

/**
 * `collapsible` marks the sections that render as `<details name="document-viewer-section">`
 * in the real viewer. That accordion is exclusive, so a jump has to open the target
 * details before scrolling — the pane shows that state instead of hiding it.
 */
const sections: Array<{
  label: string;
  short: string;
  detail: string;
  icon: LucideIcon;
  collapsible: boolean;
}> = [
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

const variants: Array<{
  id: VariantId;
  title: string;
  verdict: string;
  description: string;
  changes: string[];
  states: FrameState[];
}> = [
  {
    id: "refined",
    title: "Fused row, corrected",
    verdict: "Straight fix",
    description:
      "Approach 01 with every issue from the review closed: the position becomes a discrete pill, document actions stay reachable, the pane is height-capped so the canvas never fully disappears, and collapsible sections are labelled as such.",
    changes: [
      "Position moved off the title line entirely — line one is the document, line two is section plus a `4/7` pill.",
      "Document actions (+) kept in the row, so the existing actions sheet is not lost to the pane.",
      "Pane capped at 60% of the viewport with internal scroll; a sliver of document stays visible.",
      "Accordion sections carry a chevron marker — a jump opens that `<details>` before scrolling.",
    ],
    states: ["rest", "open"],
  },
  {
    id: "stepper",
    title: "Fused row with section stepper",
    verdict: "Fewest taps",
    description:
      "Same corrected row, plus previous and next section controls. Sequential reading — the common case — costs one tap and never opens the pane at all; the pane becomes the jump-anywhere escape hatch.",
    changes: [
      "Previous / next section steppers at 44 px each; disabled at the ends rather than wrapping.",
      "Pane keeps the Read / Evidence / Provenance grouping as inline dividers, not extra header rows.",
      "Pane trigger uses a list glyph, not a chevron — three chevrons in one row read as a single control.",
      "Stepper and pane share one active-section state, so the row and list can never disagree.",
    ],
    states: ["rest", "open"],
  },
  {
    id: "collapse",
    title: "Progressive collapse",
    verdict: "Most reading area",
    description:
      "The row is two lines at the top of the document and collapses to a single 40 px line once you scroll, keeping identity on screen while giving the document back its height. Header and row hide and reveal from the same scroll signal.",
    changes: [
      "Rest: 56 px two-line row. Scrolled: 40 px single line, section reduced to its pill.",
      "Header and row share one scroll signal — never one hidden while the other floats.",
      "Hidden means zero reserve; no phantom padding is left behind the collapsed row.",
      "Section anchors need their scroll offset tied to the live row height, not a fixed value.",
    ],
    states: ["rest", "compact", "open"],
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function UniversalHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        compact ? "h-10" : "h-12",
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 font-semibold text-[color:var(--text)]",
          compact ? "h-8 text-2xs" : "h-9 text-xs",
        )}
      >
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

function BackButton() {
  return (
    <span className="grid h-11 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
      <ArrowLeft aria-hidden="true" className="h-5 w-5" />
    </span>
  );
}

function PositionPill({ tone = "quiet" }: { tone?: "quiet" | "accent" }) {
  return (
    <span
      className={cn(
        "nums shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-black",
        tone === "accent"
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "bg-[color:var(--surface-subtle)] text-[color:var(--text-muted)]",
      )}
    >
      {activeIndex + 1}/{sections.length}
    </span>
  );
}

function ActionsButton() {
  return (
    <button
      type="button"
      onClick={() => undefined}
      aria-label="Open document actions"
      className={cn(
        "grid h-11 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]",
        focusRing,
      )}
    >
      <Plus aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

function PaneList({ grouped = false }: { grouped?: boolean }) {
  return (
    <ul className="space-y-0.5">
      {sections.map((section, index) => {
        const selected = index === activeIndex;
        const Icon = section.icon;
        const groupBreak = grouped && (index === 3 || index === 6);

        return (
          <li key={section.label} className={cn(groupBreak && "mt-2 border-t border-[color:var(--border)] pt-2")}>
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
              {section.collapsible ? (
                <ChevronDown
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]"
                  // Marks a section that is a collapsed <details>: selecting it opens the
                  // accordion first, then scrolls.
                />
              ) : (
                <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Pane({ id, grouped = false }: { id: string; grouped?: boolean }) {
  return (
    <div
      id={id}
      className="max-h-[60%] shrink-0 overflow-y-auto border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] shadow-[var(--e1)]"
    >
      <div className="sticky top-0 flex items-center justify-between bg-[color:var(--surface-lux)] px-3 pb-1 pt-2">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Jump to</p>
        <p className="text-3xs font-semibold text-[color:var(--text-soft)]">
          <ChevronDown aria-hidden="true" className="mr-1 inline h-3 w-3" />
          opens the section
        </p>
      </div>
      <div className="px-2 pb-2">
        <PaneList grouped={grouped} />
      </div>
    </div>
  );
}

function Canvas({ scrolled = false }: { scrolled?: boolean }) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-[color:var(--background)] p-3">
      {scrolled ? (
        <div className="mb-3 space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/35" />
          <div className="h-1 w-9/12 rounded-full bg-[color:var(--border-strong)]/30" />
        </div>
      ) : null}
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
        {[0, 1].map((block) => (
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

/* ---------------- Variant A — corrected fused row ---------------- */

function RefinedVariant({ state }: { state: FrameState }) {
  const paneId = useId();
  const open = state === "open";

  return (
    <>
      <UniversalHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-14 shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-1.5">
          <BackButton />
          <button
            type="button"
            onClick={() => undefined}
            aria-expanded={open}
            aria-controls={paneId}
            className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left", focusRing)}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm-minus font-semibold leading-tight text-[color:var(--text-heading)]">
                {documentTitle}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                <activeSection.icon aria-hidden="true" className="h-3 w-3 text-[color:var(--clinical-accent)]" />
                <span className="min-w-0 truncate text-3xs font-bold text-[color:var(--clinical-accent)]">
                  {activeSection.label}
                </span>
                <PositionPill />
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)]", open && "rotate-180")}
            />
          </button>
          <ActionsButton />
        </div>
        {open ? <Pane id={paneId} /> : null}
        <Canvas />
      </div>
    </>
  );
}

/* ---------------- Variant B — fused row with stepper ---------------- */

function StepperVariant({ state }: { state: FrameState }) {
  const paneId = useId();
  const open = state === "open";

  return (
    <>
      <UniversalHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-14 shrink-0 items-center gap-0.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-1.5">
          <BackButton />
          <button
            type="button"
            onClick={() => undefined}
            aria-expanded={open}
            aria-controls={paneId}
            className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left", focusRing)}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm-minus font-semibold leading-tight text-[color:var(--text-heading)]">
                {documentTitle}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
                <activeSection.icon aria-hidden="true" className="h-3 w-3" />
                <span className="min-w-0 truncate">{activeSection.label}</span>
                <PositionPill />
              </span>
            </span>
            {/* A list glyph, not a chevron: the steppers next to it already own the
                chevron shape, and three chevrons in one row read as one control. */}
            <ListTree
              aria-hidden="true"
              className={cn(
                "h-4 w-4 shrink-0",
                open ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-muted)]",
              )}
            />
          </button>
          <span className="mx-0.5 h-7 w-px shrink-0 bg-[color:var(--border)]" aria-hidden="true" />
          <button
            type="button"
            onClick={() => undefined}
            aria-label="Previous section"
            className={cn(
              "grid h-11 w-9 shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)]",
              focusRing,
            )}
          >
            <ChevronUp aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => undefined}
            aria-label="Next section"
            className={cn(
              "grid h-11 w-9 shrink-0 place-items-center rounded-lg text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        {open ? <Pane id={paneId} grouped /> : null}
        <Canvas />
      </div>
    </>
  );
}

/* ---------------- Variant C — progressive collapse ---------------- */

function CollapseVariant({ state }: { state: FrameState }) {
  const paneId = useId();
  const open = state === "open";
  const compact = state === "compact";

  return (
    <>
      <UniversalHeader compact={compact} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-1.5",
            compact ? "min-h-10" : "min-h-14",
          )}
        >
          <BackButton />
          <button
            type="button"
            onClick={() => undefined}
            aria-expanded={open}
            aria-controls={paneId}
            className={cn("flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left", focusRing)}
          >
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate font-semibold leading-tight text-[color:var(--text-heading)]",
                  compact ? "text-xs" : "text-sm-minus",
                )}
              >
                {documentTitle}
              </span>
              {compact ? null : (
                <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
                  <activeSection.icon aria-hidden="true" className="h-3 w-3" />
                  <span className="min-w-0 truncate">{activeSection.label}</span>
                  <PositionPill />
                </span>
              )}
            </span>
            {compact ? <PositionPill tone="accent" /> : null}
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)]", open && "rotate-180")}
            />
          </button>
          {compact ? null : <ActionsButton />}
        </div>
        {open ? <Pane id={paneId} /> : null}
        <Canvas scrolled={compact} />
      </div>
    </>
  );
}

const stateCopy: Record<FrameState, string> = {
  rest: "At rest",
  open: "Pane open",
  compact: "Scrolled",
};

function PhoneFrame({ variant, state }: { variant: VariantId; state: FrameState }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        {stateCopy[state]}
      </p>
      <div
        data-variant={variant}
        data-state={state}
        className="relative flex h-[30rem] w-[340px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        {variant === "refined" ? <RefinedVariant state={state} /> : null}
        {variant === "stepper" ? <StepperVariant state={state} /> : null}
        {variant === "collapse" ? <CollapseVariant state={state} /> : null}
      </div>
    </div>
  );
}

function VariantShowcase({ variant, number }: { variant: (typeof variants)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${variant.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Variant {String(number).padStart(2, "0")} · {variant.verdict}
          </p>
          <h2
            id={`${variant.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {variant.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {variant.description}
        </p>
      </div>

      <ul className="mb-5 grid gap-2 sm:grid-cols-2">
        {variant.changes.map((change) => (
          <li
            key={change}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]"
          >
            {change}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-start gap-4">
        {variant.states.map((state) => (
          <PhoneFrame key={state} variant={variant.id} state={state} />
        ))}
      </div>
    </section>
  );
}

export function DocumentPhoneTitleRefinedMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Phone title, refined
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            The fused title row, corrected three ways
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Every variant below fixes the same four defects in the original fused row: position competing with a long
            title, document actions displaced by the pane, the canvas disappearing when the pane opens, and section
            jumps landing on a collapsed accordion. They differ only in what they add on top.
          </p>
          <dl className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ["Shared by all three", "44 px targets, `aria-expanded` on the trigger, single active-section source"],
              ["Scroll contract", "Header and row hide and reveal together; hidden leaves zero reserve"],
              ["Motion", "Pane height and row collapse animate; both drop to instant under reduced motion"],
            ].map(([term, detail]) => (
              <div
                key={term}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
              >
                <dt className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  {term}
                </dt>
                <dd className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{detail}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="mt-8 space-y-12">
          {variants.map((variant, index) => (
            <VariantShowcase key={variant.id} variant={variant} number={index + 1} />
          ))}
        </div>
      </div>
    </main>
  );
}
