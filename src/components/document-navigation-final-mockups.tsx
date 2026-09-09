"use client";

import {
  ArrowLeft,
  ChevronDown,
  Compass,
  FileImage,
  FileSearch,
  FileText,
  ListTree,
  Menu,
  MessageSquarePlus,
  Plus,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";

import { cn } from "@/components/ui-primitives";

type Device = "desktop" | "tablet" | "phone";
type PhoneState = "rest" | "sheet" | "scrolled";

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

const lineage: Array<{ from: string; kept: string; changed: string }> = [
  {
    from: "Direction 02 — segment track",
    kept: "The seven-segment hairline on the row's bottom edge is the position indicator at every breakpoint.",
    changed:
      "It replaces the `· 4 of 7` numerals, not the section label. The row keeps both lines; only the text that squeezed the title is gone.",
  },
  {
    from: "Direction 03 — two-column pane",
    kept: "Seven compact cards in two columns, whole structure visible at once, never scrolls internally.",
    changed: "The same grid is now the shared surface: desktop index card, tablet index card, and phone sheet body.",
  },
  {
    from: "Chrome contract review",
    kept: "One collapse owner on phone, the composer keeps the footer, sheets stay outside chrome.",
    changed:
      "The phone pane drops from under the row and becomes a bottom sheet, so nothing is attached to a row that hides.",
  },
];

const spec: Array<{ title: string; body: string }> = [
  {
    title: "Two lines, and the numerals are gone",
    body: "Line one is the title at full width, line two names the section. Only `· 4 of 7` was dropped — the track already carries position, and the numerals were what squeezed the title.",
  },
  {
    title: "The track places, the label names",
    body: "A hairline can show where you are but cannot say what you are in. Keeping both means a first-time reader is never asked to decode the segments.",
  },
  {
    title: "One pane shape at every size",
    body: "The two-column grid is the index card on desktop and tablet and the sheet body on phone. One component, three placements.",
  },
  {
    title: "Phone pane is a sheet",
    body: "Anchored to the viewport, not to a row that scroll-hides. Opening it blurs the document composer and the scrim covers the pill.",
  },
  {
    title: "Sticky offset follows the top bar",
    body: "The desktop index card switches from `top: header + safe-area` to `top: 0` while the top bar is hidden, so no dead band appears.",
  },
  {
    title: "Track hides with its row",
    body: "It is part of the header, so it leaves with the header and leaves zero reserve. Position is still readable from the content itself.",
  },
  {
    title: "Jump opens the accordion first",
    body: 'Targets are `<details name="document-viewer-section">`. The handler opens the target, waits a frame, then scrolls by the measured row height.',
  },
  {
    title: "Non-colour cue for the active segment",
    body: "Under forced-colors the filled segments lose their hue, so the active one is also taller — 3 px against 2 px.",
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function UniversalTopBar({ device }: { device: Device }) {
  const phone = device === "phone";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        phone ? "h-12" : "h-14 sm:px-4",
      )}
    >
      {phone ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
          <Menu aria-hidden="true" className="h-4 w-4" />
        </span>
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
          KB
        </span>
      )}
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] font-semibold text-[color:var(--text)]",
          phone ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm",
        )}
      >
        <ListTree aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
        Documents
      </span>
      <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-2xs font-bold text-[color:var(--text-muted)] sm:inline-flex">
        <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5" />
        New chat
      </span>
      <span className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)] sm:ml-0">
        <Search aria-hidden="true" className="h-4 w-4" />
      </span>
      <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-[color:var(--clinical-accent-soft)]" />
    </div>
  );
}

/** Position as 2 px of height. The active segment is also taller for forced-colors. */
function SegmentTrack() {
  return (
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-end gap-px px-1.5">
      {sections.map((section, index) => (
        <span
          key={section.label}
          className={cn(
            "flex-1 rounded-full",
            index === activeIndex
              ? "h-[3px] bg-[color:var(--clinical-accent)]"
              : index < activeIndex
                ? "h-0.5 bg-[color:var(--clinical-accent)]/40"
                : "h-0.5 bg-[color:var(--border-strong)]/35",
          )}
        />
      ))}
    </span>
  );
}

function DocumentHeaderRow({
  device,
  paneId,
  expanded = false,
}: {
  device: Device;
  paneId?: string;
  expanded?: boolean;
}) {
  const phone = device === "phone";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        phone ? "h-14 px-1.5" : "h-[3.75rem] px-2 sm:px-3",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full text-[color:var(--text-muted)]",
          phone ? "h-11 w-10 justify-center" : "h-11 px-2 text-sm font-semibold",
        )}
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        {phone ? null : <span>Documents</span>}
      </span>
      <button
        type="button"
        onClick={() => undefined}
        aria-expanded={expanded}
        aria-controls={paneId}
        className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left", focusRing)}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-semibold leading-tight text-[color:var(--text-heading)]",
              phone ? "text-sm-minus" : "text-base-minus",
            )}
          >
            {documentTitle}
          </span>
          {/* The label the track cannot carry: it names the section, the track
              only places it. */}
          <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
            <activeSection.icon aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">{activeSection.label}</span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]", expanded && "rotate-180")}
        />
      </button>
      <span className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Plus aria-hidden="true" className="h-5 w-5" />
      </span>
      <SegmentTrack />
    </div>
  );
}

/** One pane shape: index card on desktop/tablet, sheet body on phone. */
function SectionGrid() {
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
              "relative flex min-h-11 items-center gap-2 rounded-lg border px-2 text-left transition",
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
            {section.collapsible ? (
              <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 text-[color:var(--text-soft)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function IndexCard({ sticky = false, note }: { sticky?: boolean; note: string }) {
  return (
    <nav
      aria-label="Document sections"
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5",
        sticky && "sticky top-0",
      )}
    >
      <div className="flex items-baseline justify-between px-0.5 pb-2">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
          In this document
        </p>
        <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
          {activeIndex + 1}/{sections.length}
        </p>
      </div>
      <SectionGrid />
      <p className="mt-2 border-t border-[color:var(--border)] px-0.5 pt-2 text-3xs leading-4 text-[color:var(--text-soft)]">
        {note}
      </p>
    </nav>
  );
}

function PhoneComposerPill({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <div className={cn("absolute inset-x-0 bottom-0 z-30 px-3 pb-3", dimmed && "opacity-70")}>
      <div className="flex min-h-[56px] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-lux)] px-2 shadow-[var(--shadow-lux)]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
          <Plus aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--text-soft)]">
          Search within this document...
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--clinical-accent)] text-[color:var(--surface)]">
          <Search aria-hidden="true" className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function SectionsSheet({ id }: { id: string }) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 z-40 bg-[color:var(--text-heading)]/40" />
      <div
        id={id}
        role="dialog"
        aria-label="Jump to section"
        className="absolute inset-x-0 bottom-0 z-50 rounded-t-[1rem] border-t border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 pb-3 pt-2 shadow-[var(--shadow-lux)]"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/60"
        />
        <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{documentTitle}</p>
        <p className="mb-2 mt-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">
          {activeSection.label} · {activeIndex + 1} of {sections.length}
        </p>
        <SectionGrid />
      </div>
    </>
  );
}

function DocumentBody({ compact = false, offset = false }: { compact?: boolean; offset?: boolean }) {
  return (
    <div className={cn("min-w-0 space-y-3", compact ? "p-3" : "p-4")}>
      {offset ? (
        <div className="space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/35" />
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
  );
}

function EvidencePanel() {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        Pinned source evidence
      </p>
      <div className="mt-2.5 space-y-2">
        <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
        <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/35" />
        <div className="h-1 w-11/12 rounded-full bg-[color:var(--border-strong)]/30" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

function DesktopFrame() {
  return (
    <div className="flex h-[26rem] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="desktop" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DocumentHeaderRow device="desktop" />
        <div className="grid grid-cols-[minmax(0,1fr)_21rem] items-start">
          <DocumentBody />
          <div className="space-y-3 p-4 pl-0">
            <IndexCard
              sticky
              note="First card in the column the viewer already renders. Sticky offset follows the top bar."
            />
            <EvidencePanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabletFrame() {
  return (
    <div className="mx-auto flex h-[26rem] w-full max-w-[768px] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="tablet" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DocumentHeaderRow device="tablet" />
        <div className="space-y-3 p-3">
          <IndexCard note="In page flow — scrolls away with the document, so no third sticky layer is created." />
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
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ state }: { state: PhoneState }) {
  const paneId = useId();
  const sheet = state === "sheet";
  const scrolled = state === "scrolled";

  return (
    <div className="relative flex h-[26rem] w-[330px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      {scrolled ? null : (
        <>
          <UniversalTopBar device="phone" />
          <DocumentHeaderRow device="phone" paneId={paneId} expanded={sheet} />
        </>
      )}
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)]">
        <DocumentBody compact offset={scrolled} />
      </div>
      {scrolled ? null : <PhoneComposerPill dimmed={sheet} />}
      {sheet ? <SectionsSheet id={paneId} /> : null}
    </div>
  );
}

const phoneCopy: Record<PhoneState, string> = {
  rest: "Title, section label, and the track on the bottom edge. Composer pill owns the footer, as it does today.",
  sheet: "Grid opens as a sheet: composer blurred, scrim over the pill, nothing attached to a row that hides.",
  scrolled: "Header and track leave together on the scroll signal and release the reserve to zero.",
};

export function DocumentNavigationFinalMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Final navigation design
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Segment track on the row, two-column grid for the pane
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            The two pieces that worked, composed and reconciled with the shipped chrome. The row keeps both lines —
            title, then the section it names — and the two-pixel hairline replaces the numerals rather than the label.
            The same two-column grid is the index on desktop and tablet and the sheet body on phone.
          </p>
        </header>

        <section aria-labelledby="lineage-title" className="mt-8">
          <h2 id="lineage-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            What came from where
          </h2>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {lineage.map((item) => (
              <div
                key={item.from}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
                  {item.from}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-muted)]">{item.kept}</p>
                <p className="mt-2 border-t border-[color:var(--border)] pt-2 text-xs font-semibold leading-5 text-[color:var(--text)]">
                  {item.changed}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="frames-title" className="mt-10 border-t border-[color:var(--border)] pt-8">
          <h2 id="frames-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            The design at every breakpoint
          </h2>
          <div className="mt-4 space-y-5">
            <div>
              <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Desktop · 1440 px
              </p>
              <DesktopFrame />
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  Tablet · 768 px
                </p>
                <TabletFrame />
              </div>
              <div className="flex flex-wrap gap-4">
                {(["rest", "sheet", "scrolled"] as PhoneState[]).map((state) => (
                  <figure key={state} className="m-0 w-[330px] max-w-full">
                    <figcaption className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                      Phone · {state === "rest" ? "at rest" : state === "sheet" ? "sheet open" : "scrolled"}
                    </figcaption>
                    <PhoneFrame state={state} />
                    <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{phoneCopy[state]}</p>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="spec-title"
          className="mt-12 rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/35 p-5"
        >
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Build specification
          </p>
          <h2
            id="spec-title"
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            Eight rules this design has to keep
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {spec.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <p className="text-xs font-bold text-[color:var(--text-heading)]">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
