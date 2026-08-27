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
type VersionId = "persistent" | "single";
type PhoneState = "rest" | "pane" | "scrolled";

const documentTitle = "Clinical practice guideline for schizophrenia";

const sections: Array<{ label: string; detail: string; icon: LucideIcon; collapsible: boolean }> = [
  { label: "Overview", detail: "84 pages", icon: Compass, collapsible: false },
  { label: "High-yield summary", detail: "8 points", icon: Sparkles, collapsible: true },
  { label: "PDF preview", detail: "p. 12 / 84", icon: FileText, collapsible: false },
  { label: "Pinned evidence", detail: "27 passages", icon: Quote, collapsible: false },
  { label: "Indexed source text", detail: "312 chunks", icon: FileSearch, collapsible: true },
  { label: "Tables and diagrams", detail: "6 visuals", icon: FileImage, collapsible: true },
  { label: "Indexing details", detail: "v3 · OCR", icon: ShieldCheck, collapsible: true },
];

const activeIndex = 3;
const activeSection = sections[activeIndex];

/** Every issue raised across the study and where it is answered in this build. */
const ledger: Array<{ issue: string; resolution: string; source: string }> = [
  {
    issue: "A second phone header row is not allowed",
    resolution:
      "Nothing new is sticky. The two-line row is the document header that already portals into the universal collapse row.",
    source: "PhoneHeaderCollapsePortal · one collapse owner",
  },
  {
    issue: "Extra header height starves the hide budget",
    resolution:
      "Only the `· 4 of 7` numerals were added and then removed again; the row lands at 56 px, and the 2 px track is the sole addition.",
    source: "readChromeCollapseMetrics",
  },
  {
    issue: "The phone bottom edge is already owned",
    resolution: "The composer pill keeps the footer. Navigation never claims a persistent bottom bar.",
    source: "PhoneFooterLayerPortal · 9rem visible / 0rem hidden",
  },
  {
    issue: "A dropdown hung from a row that scroll-hides",
    resolution:
      "The phone pane is a sheet, anchored to the viewport. Scrolling under it is not a question that arises.",
    source: "Sheets are not viewport chrome",
  },
  {
    issue: "Grid labels truncated three of seven sections",
    resolution: "The pane is a single-column list at every breakpoint. Every label renders in full.",
    source: "Observed in the two-column study",
  },
  {
    issue: "Position competed with the title for width",
    resolution: "Numerals became a seven-segment hairline on the row's bottom edge; the title keeps the full line.",
    source: "Direction 02",
  },
  {
    issue: "A hairline cannot name the section",
    resolution: "Line two keeps the section label in accent with its icon. The track places, the label names.",
    source: "Your call, and the right one",
  },
  {
    issue: "Jumps landed on a collapsed accordion",
    resolution: "The handler opens the target `<details>`, waits a frame, then scrolls.",
    source: "document-viewer-section is exclusive",
  },
  {
    issue: "`scroll-mt-24` assumes a constant header",
    resolution: "Anchor offsets read the live collapse-row height, so a hidden header does not strand headings.",
    source: "Variable chrome height",
  },
  {
    issue: "A sticky pane leaves a dead band when the top bar hides",
    resolution: "Sticky offsets switch from `header + safe-area` to `0` with the top-bar hide state.",
    source: "Collapse-everywhere hosts rule",
  },
  {
    issue: "A live control could sit under an open pane",
    resolution: "Opening the pane blurs the document composer and the scrim covers the `z-40` pill.",
    source: "Blur the focused composer",
  },
  {
    issue: "Colour alone marked the active track segment",
    resolution: "The active segment is 3 px against the others' 2 px, so forced-colors keeps it legible.",
    source: "Forced-colors",
  },
];

const versions: Array<{
  id: VersionId;
  title: string;
  verdict: string;
  summary: string;
  perDevice: Record<Device, string>;
  costs: string[];
}> = [
  {
    id: "persistent",
    title: "Version 1 — Persistent index on wide screens",
    verdict: "Fewest interactions",
    summary:
      "Desktop and tablet show the section list permanently, as the first card in the column the viewer already renders. Phone opens the identical list as a sheet, because it has no column to spare.",
    perDevice: {
      desktop: "Index card always visible, sticky, offset bound to the top-bar hide state.",
      tablet:
        "Same card in page flow above the document, so it scrolls away rather than becoming a third sticky layer.",
      phone: "Row chevron opens the list as a bottom sheet.",
    },
    costs: [
      "Zero clicks to see the whole structure on desktop and tablet.",
      "Two interaction models: always-there on wide screens, on-demand on phone.",
      "Consumes about 310 px of the shared column before the evidence panel starts.",
    ],
  },
  {
    id: "single",
    title: "Version 2 — One interaction model everywhere",
    verdict: "Most document width",
    summary:
      "The row's chevron is the only way into the section list at every breakpoint. Desktop and tablet open a popover anchored under the row; phone opens the same list as a sheet. One mental model, one component, three placements.",
    perDevice: {
      desktop: "Popover anchored under the row, dismissed by outside click or Escape, focus returns to the row.",
      tablet: "The same popover, width-capped so it never crosses the pinned search stack.",
      phone: "The same list as a bottom sheet.",
    },
    costs: [
      "One consistent gesture: the row is always the way in.",
      "The document keeps the full column — the evidence panel starts at the top.",
      "Costs one click on desktop where a permanent index would have been free.",
    ],
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
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

/** Active segment is taller as well as tinted, so forced-colors keeps it readable. */
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

/* ------------------------------------------------------------------ */
/* The one pane shape: a single-column list                            */
/* ------------------------------------------------------------------ */

function SectionList() {
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

function PaneHeading({ caption }: { caption: string }) {
  return (
    <div className="px-0.5 pb-2">
      <div className="flex items-baseline justify-between">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
          In this document
        </p>
        <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
          {activeIndex + 1}/{sections.length}
        </p>
      </div>
      <p className="mt-1 text-3xs leading-4 text-[color:var(--text-soft)]">{caption}</p>
    </div>
  );
}

function IndexCard({ sticky = false, caption }: { sticky?: boolean; caption: string }) {
  return (
    <nav
      aria-label="Document sections"
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5",
        sticky && "sticky top-0",
      )}
    >
      <PaneHeading caption={caption} />
      <SectionList />
    </nav>
  );
}

function Popover({ id }: { id: string }) {
  return (
    <div
      id={id}
      role="dialog"
      aria-label="Jump to section"
      className="absolute left-2 top-[calc(100%+0.25rem)] z-40 w-[21rem] rounded-xl border border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-2.5 shadow-[var(--shadow-lux)] sm:left-3"
    >
      <PaneHeading caption="Escape or an outside click closes; focus returns to the row." />
      <SectionList />
    </div>
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
        className="absolute inset-x-0 bottom-0 z-50 max-h-[72%] overflow-y-auto rounded-t-[1rem] border-t border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] px-3 pb-3 pt-2 shadow-[var(--shadow-lux)]"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-1 w-9 rounded-full bg-[color:var(--border-strong)]/60"
        />
        <p className="truncate text-sm font-semibold text-[color:var(--text-heading)]">{documentTitle}</p>
        <p className="mb-2 mt-0.5 text-3xs font-semibold text-[color:var(--text-soft)]">
          {activeSection.label} · {activeIndex + 1} of {sections.length} — a chevron marks a section that opens first
        </p>
        <SectionList />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

function ActiveSectionCard() {
  return (
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
      <ActiveSectionCard />
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

function DesktopFrame({ version }: { version: VersionId }) {
  const paneId = useId();
  const single = version === "single";

  return (
    <div className="flex h-[27rem] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="desktop" />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative">
          <DocumentHeaderRow device="desktop" paneId={paneId} expanded={single} />
          {single ? <Popover id={paneId} /> : null}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_21rem] items-start">
          <DocumentBody />
          <div className="space-y-3 p-4 pl-0">
            {single ? null : (
              <IndexCard
                sticky
                caption="First card in the column the viewer already renders; sticky offset follows the top bar."
              />
            )}
            <EvidencePanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabletFrame({ version }: { version: VersionId }) {
  const paneId = useId();
  const single = version === "single";

  return (
    <div className="mx-auto flex h-[27rem] w-full max-w-[768px] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="tablet" />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative">
          <DocumentHeaderRow device="tablet" paneId={paneId} expanded={single} />
          {single ? <Popover id={paneId} /> : null}
        </div>
        <div className="space-y-3 p-3">
          {single ? null : (
            <IndexCard caption="In page flow — scrolls away with the document, so no third sticky layer is created." />
          )}
          <ActiveSectionCard />
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ state }: { state: PhoneState }) {
  const paneId = useId();
  const pane = state === "pane";
  const scrolled = state === "scrolled";

  return (
    // 330 x 592 keeps the frame close to a 390 x 844 phone's aspect, so the
    // sheet reads at the height it would actually occupy.
    <div className="relative flex h-[37rem] w-[330px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      {scrolled ? null : (
        <>
          <UniversalTopBar device="phone" />
          <DocumentHeaderRow device="phone" paneId={paneId} expanded={pane} />
        </>
      )}
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)]">
        <DocumentBody compact offset={scrolled} />
      </div>
      {scrolled ? null : <PhoneComposerPill dimmed={pane} />}
      {pane ? <SectionsSheet id={paneId} /> : null}
    </div>
  );
}

const phoneCopy: Record<PhoneState, string> = {
  rest: "Title, section label, track. The composer pill keeps the footer exactly as it does today.",
  pane: "Sheet: composer blurred, scrim over the pill, every label in full, no internal scroll.",
  scrolled: "Header and track leave together on the scroll signal and release the reserve to zero.",
};

function VersionShowcase({ version }: { version: (typeof versions)[number] }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${version.id}-title`}>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            {version.verdict}
          </p>
          <h2
            id={`${version.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {version.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {version.summary}
        </p>
      </div>

      <div className="mb-5 grid gap-2 lg:grid-cols-2">
        <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {(["desktop", "tablet", "phone"] as Device[]).map((device) => (
            <div
              key={device}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
            >
              <dt className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                {device}
              </dt>
              <dd className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{version.perDevice[device]}</dd>
            </div>
          ))}
        </dl>
        <ul className="space-y-2">
          {version.costs.map((cost) => (
            <li
              key={cost}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs leading-5 text-[color:var(--text-muted)]"
            >
              {cost}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            Desktop · 1440 px
          </p>
          <DesktopFrame version={version.id} />
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Tablet · 768 px
            </p>
            <TabletFrame version={version.id} />
          </div>
          <div className="flex flex-wrap gap-4">
            {(["rest", "pane", "scrolled"] as PhoneState[]).map((state) => (
              <figure key={state} className="m-0 w-[330px] max-w-full">
                <figcaption className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                  Phone · {state === "rest" ? "at rest" : state === "pane" ? "sheet open" : "scrolled"}
                </figcaption>
                <PhoneFrame state={state} />
                <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{phoneCopy[state]}</p>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DocumentNavigationFinalReviewMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Final review
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Two final versions, every issue closed
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Both versions share the same row and the same pane: a two-line header with the section label and a
            seven-segment track, and a single-column list where every label renders in full. They differ on one question
            only — whether wide screens show that list permanently, or open it the same way the phone does.
          </p>
        </header>

        <section aria-labelledby="ledger-title" className="mt-8">
          <h2 id="ledger-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            Every issue raised, and where it is answered
          </h2>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {ledger.map((entry) => (
              <div
                key={entry.issue}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <p className="text-xs font-bold text-[color:var(--text-heading)]">{entry.issue}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{entry.resolution}</p>
                <p className="mt-2 border-t border-[color:var(--border)] pt-2 text-3xs font-bold uppercase tracking-[0.1em] text-[color:var(--text-soft)]">
                  {entry.source}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 space-y-12">
          {versions.map((version) => (
            <VersionShowcase key={version.id} version={version} />
          ))}
        </div>
      </div>
    </main>
  );
}
