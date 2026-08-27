"use client";

import {
  ArrowLeft,
  ChevronDown,
  Compass,
  FileImage,
  FileSearch,
  FileText,
  ListTree,
  Loader2,
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
type PhoneState = "rest" | "hidden" | "revealed" | "sheet" | "sparse";

const documentTitle = "Clinical practice guideline for schizophrenia";

type Section = {
  id: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  /** Renders as `<details name="document-viewer-section">` — an exclusive accordion. */
  collapsible: boolean;
  /** Share of the document, used to weight the track. Sequence is not progress. */
  weight: number;
  pending?: boolean;
};

const fullSections: Section[] = [
  { id: "overview", label: "Overview", detail: "84 pages", icon: Compass, collapsible: false, weight: 1 },
  { id: "summary", label: "High-yield summary", detail: "8 points", icon: Sparkles, collapsible: true, weight: 1.5 },
  { id: "pdf", label: "PDF preview", detail: "p. 12 / 84", icon: FileText, collapsible: false, weight: 4 },
  { id: "evidence", label: "Pinned evidence", detail: "27 passages", icon: Quote, collapsible: false, weight: 2 },
  { id: "text", label: "Indexed source text", detail: "312 chunks", icon: FileSearch, collapsible: true, weight: 3 },
  { id: "images", label: "Tables and diagrams", detail: "6 visuals", icon: FileImage, collapsible: true, weight: 1.5 },
  { id: "indexing", label: "Indexing details", detail: "v3 · OCR", icon: ShieldCheck, collapsible: true, weight: 0.5 },
];

/** A real document that has no summary and no extracted visuals, still indexing its text. */
const sparseSections: Section[] = [
  { id: "overview", label: "Overview", detail: "12 pages", icon: Compass, collapsible: false, weight: 1 },
  { id: "pdf", label: "PDF preview", detail: "p. 3 / 12", icon: FileText, collapsible: false, weight: 4 },
  { id: "evidence", label: "Pinned evidence", detail: "4 passages", icon: Quote, collapsible: false, weight: 2 },
  {
    id: "text",
    label: "Indexed source text",
    detail: "Indexing",
    icon: FileSearch,
    collapsible: true,
    weight: 3,
    pending: true,
  },
  { id: "indexing", label: "Indexing details", detail: "v3 · OCR", icon: ShieldCheck, collapsible: true, weight: 0.5 },
];

const behaviour: Array<{ title: string; body: string }> = [
  {
    title: "The row leaves with the header",
    body: "It is the document header inside the universal collapse row, so it hides on a deliberate descent and returns on deliberate upward intent — 240 ms out, 200 ms back — and takes the track with it.",
  },
  {
    title: "Hidden means zero reserve",
    body: "No phantom padding is left where the row was. The document paints to the physical edge, and the composer pill releases its own reserve to `0rem` at the same time.",
  },
  {
    title: "Position survives the hide",
    body: "While chrome is away, the section heading in the content is what names your place. The row updates behind the scenes and is already correct when it returns.",
  },
  {
    title: "The sheet is unaffected",
    body: "It is anchored to the viewport, not to the row, so it neither hides nor scrolls. Opening it blurs the composer so hide-on-scroll can still reclaim both edges afterwards.",
  },
  {
    title: "Reduced motion snaps",
    body: "The hide, the reveal, and the sheet all lose their animation, but the full edge release still happens.",
  },
  {
    title: "Anchors measure the live row",
    body: "Jump offsets read the current collapse-row height rather than a fixed `scroll-mt`, so a jump taken while chrome is hidden still lands with the heading at the top.",
  },
];

const openQuestions: Array<{ title: string; body: string }> = [
  {
    title: "The track shows share, not progress",
    body: "Segments are weighted by how much document each section holds — PDF preview is wide, Indexing details is a sliver. Equal segments would have implied seven equal parts.",
  },
  {
    title: "Collapsed sections cannot be 'here'",
    body: "The accordion is exclusive, so only the expanded section has a real position. Scroll-spy resolves to the nearest expanded section and never marks a collapsed one active.",
  },
  {
    title: "Absent sections are omitted, not disabled",
    body: "A document with no summary and no visuals shows five rows, and the track re-weights to match. A greyed row would advertise something the document does not have.",
  },
  {
    title: "Pending data gets a state, not a zero",
    body: "A section still indexing shows a spinner and the word Indexing rather than a count of 0, which would read as empty.",
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

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

/** Weighted segments: width is the section's share of the document, not 1/n. */
function SegmentTrack({ list, activeId }: { list: Section[]; activeId: string }) {
  const activeIndex = list.findIndex((section) => section.id === activeId);

  return (
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-end gap-px px-1.5">
      {list.map((section, index) => (
        <span
          key={section.id}
          style={{ flexGrow: section.weight }}
          className={cn(
            "min-w-[6px] flex-shrink rounded-full",
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
  list,
  activeId,
  paneId,
  expanded = false,
}: {
  device: Device;
  list: Section[];
  activeId: string;
  paneId?: string;
  expanded?: boolean;
}) {
  const phone = device === "phone";
  const active = list.find((section) => section.id === activeId) ?? list[0];
  const ActiveIcon = active.icon;

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
          <span className="mt-0.5 flex items-center gap-1.5 text-3xs font-bold text-[color:var(--clinical-accent)]">
            <ActiveIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">{active.label}</span>
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
      <SegmentTrack list={list} activeId={activeId} />
    </div>
  );
}

function SectionList({ list, activeId }: { list: Section[]; activeId: string }) {
  return (
    <ul className="space-y-0.5">
      {list.map((section) => {
        const selected = section.id === activeId;
        const Icon = section.icon;

        return (
          <li key={section.id}>
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
              <span
                className={cn(
                  "nums flex shrink-0 items-center gap-1 text-3xs font-semibold",
                  section.pending ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--text-soft)]",
                )}
              >
                {section.pending ? <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" /> : null}
                {section.detail}
              </span>
              {section.collapsible ? (
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[color:var(--text-soft)]" />
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

function PaneHeading({ list, activeId, caption }: { list: Section[]; activeId: string; caption: string }) {
  const position = list.findIndex((section) => section.id === activeId) + 1;

  return (
    <div className="px-0.5 pb-2">
      <div className="flex items-baseline justify-between">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
          In this document
        </p>
        <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
          {position}/{list.length}
        </p>
      </div>
      <p className="mt-1 text-3xs leading-4 text-[color:var(--text-soft)]">{caption}</p>
    </div>
  );
}

function IndexCard({
  list,
  activeId,
  sticky = false,
  caption,
}: {
  list: Section[];
  activeId: string;
  sticky?: boolean;
  caption: string;
}) {
  return (
    <nav
      aria-label="Document sections"
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5",
        sticky && "sticky top-0",
      )}
    >
      <PaneHeading list={list} activeId={activeId} caption={caption} />
      <SectionList list={list} activeId={activeId} />
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

function SectionsSheet({ id, list, activeId }: { id: string; list: Section[]; activeId: string }) {
  const active = list.find((section) => section.id === activeId) ?? list[0];
  const position = list.findIndex((section) => section.id === activeId) + 1;

  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 z-40 bg-[color:var(--text-heading)]/40" />
      <div
        id={id}
        role="dialog"
        aria-label="Jump to section"
        className="absolute inset-x-0 bottom-0 z-50 max-h-[72%] overflow-y-auto rounded-t-[1rem] border-t border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 pb-3 pt-2 shadow-[var(--shadow-lux)]"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/60"
        />
        <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{documentTitle}</p>
        <p className="mb-2 mt-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">
          {active.label} · {position} of {list.length} — a chevron marks a section that opens first
        </p>
        <SectionList list={list} activeId={activeId} />
      </div>
    </>
  );
}

function SectionCard({ section }: { section: Section }) {
  const Icon = section.icon;

  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
            Section heading
          </p>
          {/* This heading is what names your place while the chrome is hidden. */}
          <h4 className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">{section.label}</h4>
        </div>
      </div>
      <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3">
        <div className="h-1 rounded-full bg-[color:var(--border-strong)]/55" />
        <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/45" />
        <div className="h-1 w-11/12 rounded-full bg-[color:var(--border-strong)]/40" />
      </div>
    </section>
  );
}

function DocumentBody({
  section,
  compact = false,
  offset = false,
}: {
  section: Section;
  compact?: boolean;
  offset?: boolean;
}) {
  return (
    <div className={cn("min-w-0 space-y-3", compact ? "p-3" : "p-4")}>
      {offset ? (
        <div className="space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/35" />
        </div>
      ) : null}
      <SectionCard section={section} />
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

function DesktopFrame() {
  return (
    <div className="flex h-[27rem] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="desktop" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DocumentHeaderRow device="desktop" list={fullSections} activeId="evidence" />
        <div className="grid grid-cols-[minmax(0,1fr)_21rem] items-start">
          <DocumentBody section={fullSections[3]} />
          <div className="space-y-3 p-4 pl-0">
            <IndexCard
              list={fullSections}
              activeId="evidence"
              sticky
              caption="Sticky offset switches to 0 while the top bar is hidden, so no dead band is left behind."
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
    <div className="mx-auto flex h-[27rem] w-full max-w-[768px] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="tablet" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DocumentHeaderRow device="tablet" list={fullSections} activeId="evidence" />
        <div className="space-y-3 p-3">
          <IndexCard
            list={fullSections}
            activeId="evidence"
            caption="In page flow — scrolls away with the document rather than becoming a third sticky layer."
          />
          <SectionCard section={fullSections[3]} />
        </div>
      </div>
    </div>
  );
}

const phoneStates: Array<{ state: PhoneState; label: string; note: string }> = [
  {
    state: "rest",
    label: "At rest",
    note: "Title, section label, weighted track. The composer pill keeps the footer.",
  },
  {
    state: "hidden",
    label: "Scrolled — chrome gone",
    note: "Row, track and pill leave together and release every reserve to zero. The section heading in the content is what names your place.",
  },
  {
    state: "revealed",
    label: "Scrolled back up",
    note: "The row returns already correct: the label and the track moved to Indexed source text while they were away.",
  },
  {
    state: "sheet",
    label: "Sheet open",
    note: "Viewport-anchored, so the scroll signal never touches it. Composer blurred, scrim over the pill.",
  },
  {
    state: "sparse",
    label: "Document with less in it",
    note: "No summary, no visuals, text still indexing: five rows, a spinner instead of a count, and the track re-weighted.",
  },
];

function PhoneFrame({ state }: { state: PhoneState }) {
  const paneId = useId();
  const sparse = state === "sparse";
  const list = sparse ? sparseSections : fullSections;
  const activeId = state === "revealed" ? "text" : sparse ? "pdf" : "evidence";
  const active = list.find((section) => section.id === activeId) ?? list[0];
  const hidden = state === "hidden";
  const sheet = state === "sheet";

  return (
    <div className="relative flex h-[37rem] w-[330px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      {hidden ? null : (
        <>
          <UniversalTopBar device="phone" />
          <DocumentHeaderRow device="phone" list={list} activeId={activeId} paneId={paneId} expanded={sheet} />
        </>
      )}
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)]">
        <DocumentBody section={active} compact offset={hidden || state === "revealed"} />
      </div>
      {hidden ? null : <PhoneComposerPill dimmed={sheet} />}
      {sheet ? <SectionsSheet id={paneId} list={list} activeId={activeId} /> : null}
    </div>
  );
}

export function DocumentNavigationPerfectedMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Perfected navigation
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            The build, including what happens when the chrome disappears
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            A persistent index where there is room, the same list as a sheet where there is not, and a two-line row
            whose track is weighted by how much document each section actually holds. The phone states below cover the
            whole hide and reveal cycle, plus a document that has less in it than the happy path.
          </p>
        </header>

        <section aria-labelledby="behaviour-title" className="mt-8">
          <h2 id="behaviour-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            Phone chrome behaviour this design commits to
          </h2>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {behaviour.map((item) => (
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

        <section aria-labelledby="questions-title" className="mt-6">
          <h2 id="questions-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            The four open questions, answered
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {openQuestions.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/30 p-3"
              >
                <p className="text-xs font-bold text-[color:var(--text-heading)]">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="wide-title" className="mt-10 border-t border-[color:var(--border)] pt-8">
          <h2 id="wide-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            Desktop and tablet
          </h2>
          <div className="mt-4 space-y-5">
            <div>
              <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Desktop · 1440 px
              </p>
              <DesktopFrame />
            </div>
            <div>
              <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Tablet · 768 px
              </p>
              <TabletFrame />
            </div>
          </div>
        </section>

        <section aria-labelledby="phone-title" className="mt-10 border-t border-[color:var(--border)] pt-8">
          <h2 id="phone-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            Phone · the whole cycle
          </h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {phoneStates.map((item) => (
              <figure key={item.state} className="m-0 w-[330px] max-w-full">
                <figcaption className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  {item.label}
                </figcaption>
                <PhoneFrame state={item.state} />
                <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{item.note}</p>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
