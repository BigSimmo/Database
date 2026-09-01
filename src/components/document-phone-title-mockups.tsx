"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Compass,
  FileImage,
  FileSearch,
  FileText,
  ListTree,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";

import { cn } from "@/components/ui-primitives";

type ApproachId = "fused" | "breadcrumb" | "sheet";

const documentTitle = "Clinical practice guideline for schizophrenia";
const documentEyebrow = "NICE · Clinical guideline";

const sections: Array<{ label: string; short: string; detail: string; icon: LucideIcon }> = [
  { label: "Overview", short: "Overview", detail: "84 pages", icon: Compass },
  { label: "High-yield summary", short: "Summary", detail: "8 points", icon: Sparkles },
  { label: "PDF preview", short: "PDF", detail: "p. 12 / 84", icon: FileText },
  { label: "Pinned evidence", short: "Evidence", detail: "27 passages", icon: Quote },
  { label: "Indexed source text", short: "Text", detail: "312 chunks", icon: FileSearch },
  { label: "Tables and diagrams", short: "Tables", detail: "6 visuals", icon: FileImage },
  { label: "Indexing details", short: "Indexing", detail: "v3 · OCR", icon: ShieldCheck },
];

const activeIndex = 3;
const activeSection = sections[activeIndex];

const approaches: Array<{
  id: ApproachId;
  title: string;
  verdict: string;
  description: string;
  chromeHeight: string;
  tradeoff: string;
}> = [
  {
    id: "fused",
    title: "Fused title row",
    verdict: "Recommended",
    description:
      "Title and pane trigger are one control. Line one is the document, line two is the active section, and the pane drops below the row instead of over it — so the title never disappears at the moment you are orienting.",
    chromeHeight: "96 px of chrome (48 header + 48 fused row)",
    tradeoff: "Two-line row is denser to read; section name competes with a long title for the same width.",
  },
  {
    id: "breadcrumb",
    title: "Title in the universal header",
    verdict: "Cleanest reading area",
    description:
      "The document title replaces the mode chip in the universal header while you are on a document route. The row beneath carries only position and the pane trigger, so it can stay slim.",
    chromeHeight: "92 px of chrome (48 header + 44 section bar)",
    tradeoff:
      "Edits shared chrome for one route — the biggest blast radius of the three, and the title loses its back affordance.",
  },
  {
    id: "sheet",
    title: "Fixed title, pane as bottom sheet",
    verdict: "Most stable identity",
    description:
      "The title row is a single line and never moves. Section navigation is a compact pill that opens a bottom sheet, matching the phone sheet pattern already used for document actions.",
    chromeHeight: "104 px of chrome (48 header + 56 title row)",
    tradeoff:
      "The pane is furthest from the header anchor, and the sheet covers the lower half of the document while open.",
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function UniversalHeader({ title }: { title?: string }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      {title ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-bold text-[color:var(--text-soft)]">
            <ListTree aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--clinical-accent)]" />
            Docs
          </span>
          <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 text-[color:var(--text-soft)]" />
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--text-heading)]">{title}</span>
        </span>
      ) : (
        <span className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-xs font-semibold text-[color:var(--text)]">
          <ListTree aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
          Documents
        </span>
      )}
      <span className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Search aria-hidden="true" className="h-4 w-4" />
      </span>
      <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-[color:var(--clinical-accent-soft)]" />
    </div>
  );
}

function PaneList({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={cn("space-y-1", compact && "space-y-0.5")}>
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

function Canvas({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <div className={cn("min-w-0 flex-1 bg-[color:var(--background)] p-3", dimmed && "opacity-60")}>
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

/* ---------------- Approach A — fused title row ---------------- */

function FusedApproach({ open }: { open: boolean }) {
  const paneId = useId();

  return (
    <>
      <UniversalHeader />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => undefined}
          aria-expanded={open}
          aria-controls={paneId}
          className={cn(
            "flex min-h-14 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-2 text-left",
            focusRing,
          )}
        >
          <span className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm-minus font-semibold text-[color:var(--text-heading)]">
              {documentTitle}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
              <activeSection.icon aria-hidden="true" className="h-3 w-3" />
              <span className="truncate">{activeSection.label}</span>
              <span className="nums text-[color:var(--text-soft)]">
                · {activeIndex + 1} of {sections.length}
              </span>
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)]", open && "rotate-180")}
          />
        </button>
        {open ? (
          <div
            id={paneId}
            className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2 shadow-[var(--e1)]"
          >
            <PaneList compact />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Canvas />
        </div>
      </div>
    </>
  );
}

/* ---------------- Approach B — title in universal header ---------------- */

function BreadcrumbApproach({ open }: { open: boolean }) {
  const paneId = useId();

  return (
    <>
      <UniversalHeader title={documentTitle} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => undefined}
          aria-expanded={open}
          aria-controls={paneId}
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left",
            focusRing,
          )}
        >
          <span className="nums shrink-0 rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-3xs font-black text-[color:var(--text-muted)]">
            {activeIndex + 1} / {sections.length}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--text-heading)]">
            {activeSection.label}
          </span>
          <span className="shrink-0 text-3xs font-bold text-[color:var(--clinical-accent)]">Sections</span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)]", open && "rotate-180")}
          />
        </button>
        {open ? (
          <div
            id={paneId}
            className="absolute inset-x-0 top-11 z-10 max-h-[17rem] overflow-y-auto border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2 shadow-[var(--shadow-lux)]"
          >
            <PaneList compact />
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Canvas dimmed={open} />
        </div>
      </div>
    </>
  );
}

/* ---------------- Approach C — fixed title, bottom sheet ---------------- */

function SheetApproach({ open }: { open: boolean }) {
  const paneId = useId();

  return (
    <>
      <UniversalHeader />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-14 shrink-0 items-center gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-2">
          <span className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-3xs font-bold uppercase tracking-[0.1em] text-[color:var(--clinical-accent)]">
              {documentEyebrow}
            </span>
            <span className="block truncate text-sm-minus font-semibold text-[color:var(--text-heading)]">
              {documentTitle}
            </span>
          </span>
          <button
            type="button"
            onClick={() => undefined}
            aria-expanded={open}
            aria-controls={paneId}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-2.5 text-2xs font-bold text-[color:var(--clinical-accent)]",
              focusRing,
            )}
          >
            <span className="nums">
              {activeIndex + 1}/{sections.length}
            </span>
            <ChevronDown aria-hidden="true" className={cn("h-3.5 w-3.5", open && "rotate-180")} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Canvas />
        </div>
        {open ? (
          <>
            <span aria-hidden="true" className="absolute inset-0 z-10 bg-[color:var(--text-heading)]/35" />
            <div
              id={paneId}
              className="absolute inset-x-0 bottom-0 z-20 rounded-t-[1rem] border-t border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-lux)]"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  In this document
                </p>
                <span className="grid h-8 w-8 place-items-center rounded-full text-[color:var(--text-muted)]">
                  <X aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
              <PaneList compact />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

function PhoneFrame({ approach, open }: { approach: ApproachId; open: boolean }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        {open ? "Pane open" : "Pane closed"}
      </p>
      <div
        data-approach={approach}
        data-state={open ? "open" : "closed"}
        className="relative flex h-[30rem] w-[390px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        {approach === "fused" ? <FusedApproach open={open} /> : null}
        {approach === "breadcrumb" ? <BreadcrumbApproach open={open} /> : null}
        {approach === "sheet" ? <SheetApproach open={open} /> : null}
      </div>
    </div>
  );
}

function ApproachShowcase({ approach, number }: { approach: (typeof approaches)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${approach.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Approach {String(number).padStart(2, "0")} · {approach.verdict}
          </p>
          <h2
            id={`${approach.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {approach.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {approach.description}
        </p>
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
          <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Chrome cost</p>
          <p className="mt-1 text-xs font-semibold text-[color:var(--text)]">{approach.chromeHeight}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2">
          <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Trade-off</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{approach.tradeoff}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <PhoneFrame approach={approach.id} open={false} />
        <PhoneFrame approach={approach.id} open />
      </div>
    </section>
  );
}

export function DocumentPhoneTitleMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Phone title study
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Keeping the document title on the phone
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Three ways to show the document title on a 390-pixel viewport without stacking a third bar under the
            universal header. Each approach is shown with the navigation pane closed and open, because the open state is
            where the title is normally lost.
          </p>
        </header>

        <div className="mt-8 space-y-12">
          {approaches.map((approach, index) => (
            <ApproachShowcase key={approach.id} approach={approach} number={index + 1} />
          ))}
        </div>
      </div>
    </main>
  );
}
