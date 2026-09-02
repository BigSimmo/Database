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

type CandidateId = "index" | "rail";
type Device = "desktop" | "tablet" | "phone";

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

const contractFindings: Array<{ area: string; finding: string; consequence: string }> = [
  {
    area: "Phone header",
    finding:
      "The document header is not its own sticky bar. `PhoneHeaderCollapsePortal` moves it into the universal collapse row below `sm`, and the contract allows exactly one collapse owner per phone header.",
    consequence:
      "A second sticky or fixed phone header is out of bounds. Anything added lands inside the collapse row.",
  },
  {
    area: "Collapse budget",
    finding:
      "`readChromeCollapseMetrics` charges the collapse row's controls, the released top safe-area, and the dock reserve against the remaining scroll runway.",
    consequence: "Every extra row of header height makes hide-on-scroll fail to fire on short documents.",
  },
  {
    area: "Phone footer",
    finding:
      "`DocumentViewer` already owns the bottom: a 56 px floating composer pill with `+` actions, portalled through `PhoneFooterLayerPortal`, reserve `9rem + safe-area + keyboard`, and `0rem` once hidden.",
    consequence:
      "The bottom edge is taken. Navigation cannot claim a persistent bar there without a second footer owner.",
  },
  {
    area: "Sheets",
    finding:
      "The contract states plainly that modal and sheet headers are not viewport chrome and keep their own scroll context.",
    consequence: "A bottom sheet is the one overlay that adds no chrome, no reserve, and no scroll owner.",
  },
  {
    area: "Tablet",
    finding: "The top bar hides and reveals, and tablet search stays pinned beneath it as the second sticky layer.",
    consequence:
      "A sticky nav pane would be a third layer. Tablet navigation should sit in page flow or share the pinned stack.",
  },
  {
    area: "Desktop",
    finding:
      "The top bar is the only sticky desktop chrome; desktop search is page-flow. `DocumentViewer` already runs `lg:grid-cols-[minmax(0,1fr)_480px]`.",
    consequence:
      "A third column is real crowding under 1440 px, and any sticky rail must drop its offset to 0 when the top bar hides or it leaves a dead band.",
  },
];

const candidates: Array<{
  id: CandidateId;
  title: string;
  verdict: string;
  summary: string;
  perDevice: Record<Device, string>;
}> = [
  {
    id: "index",
    title: "Candidate A — Section index, no new chrome",
    verdict: "Contract-safest",
    summary:
      "Navigation borrows surfaces that already exist. Desktop puts the index at the top of the 480 px column that is already there, tablet keeps it in page flow, and phone makes the existing title a disclosure for a bottom sheet.",
    perDevice: {
      desktop: "Sticky index card at the top of the existing right column. No third column, no new grid.",
      tablet: "In-flow index card above the document. Scrolls away with content — no third sticky layer.",
      phone:
        "Existing header title becomes the disclosure; sections open in a bottom sheet. Zero added collapse height.",
    },
  },
  {
    id: "rail",
    title: "Candidate B — Anchored rail, sheet on phone",
    verdict: "Most spatial",
    summary:
      "A persistent rail gives the document a fixed sense of place on the wide breakpoints. Its sticky offset is bound to the top-bar hide state, and below `sm` it degrades to the same sheet as Candidate A because the collapse contract leaves no other option.",
    perDevice: {
      desktop: "17 rem labelled rail, sticky. Offset follows the top bar: header height when shown, 0 when hidden.",
      tablet: "Compact icon rail sharing the pinned stack rather than adding a layer beneath it.",
      phone: "Identical to Candidate A — the rail has nowhere to live inside a single collapse row.",
    },
  },
];

const perfected: Array<{ title: string; body: string }> = [
  {
    title: "Phone: title disclosure plus bottom sheet",
    body: "No added collapse height, so the hide budget is untouched. The sheet is not chrome, so it adds no reserve and no scroll owner.",
  },
  {
    title: "Sheet opens with the composer blurred",
    body: "The contract requires blurring the focused composer so hide-on-scroll can reclaim both edges. Opening the sheet blurs the document search input first.",
  },
  {
    title: "Sheet sits above the footer layer",
    body: "The composer pill is `z-40` on the phone footer layer. The sheet takes a higher layer and its scrim covers the pill, so there is never a live control under an open sheet.",
  },
  {
    title: "Desktop index rides the existing column",
    body: "No third column below 1440 px. The index is the first card in the 480 px column the viewer already renders.",
  },
  {
    title: "Sticky offset follows the top bar",
    body: "Any sticky index or rail switches from `top: header + safe-area` to `top: 0` while the top bar is hidden, so no dead band is left behind it.",
  },
  {
    title: "Jump opens the accordion first",
    body: 'Target sections are `<details name="document-viewer-section">` — exclusive. The handler opens the target, waits a frame, then scrolls.',
  },
  {
    title: "Anchor offset is measured, not fixed",
    body: "`scroll-mt-24` assumes a constant header. Offsets read the live collapse-row height so a hidden header does not leave headings floating mid-viewport.",
  },
  {
    title: "Reduced motion keeps the release",
    body: "The sheet and any collapse animate normally, and under reduced motion they snap — but the full edge release still happens, per the contract.",
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/* ------------------------------------------------------------------ */
/* Shared chrome stand-ins                                             */
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

function DocumentHeader({ device, sheetId, expanded }: { device: Device; sheetId?: string; expanded?: boolean }) {
  const phone = device === "phone";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 border-b border-[color:var(--border)] bg-[color:var(--surface)]",
        phone ? "h-12 px-1.5" : "h-[3.25rem] px-2 sm:px-3",
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
      {phone ? (
        <button
          type="button"
          onClick={() => undefined}
          aria-expanded={expanded}
          aria-controls={sheetId}
          className={cn("flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 text-left", focusRing)}
        >
          <span className="min-w-0 truncate text-sm-minus font-semibold text-[color:var(--text-heading)]">
            {documentTitle}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-3.5 w-3.5 shrink-0 text-[color:var(--text-muted)]", expanded && "rotate-180")}
          />
        </button>
      ) : (
        <h3 className="min-w-0 flex-1 truncate text-base-minus font-semibold text-[color:var(--text-heading)]">
          {documentTitle}
        </h3>
      )}
      <span className="grid h-11 w-9 shrink-0 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Plus aria-hidden="true" className="h-5 w-5" />
      </span>
    </div>
  );
}

/** The real phone footer: 56 px composer pill with the `+` actions button. */
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

/* ------------------------------------------------------------------ */
/* Navigation surfaces                                                 */
/* ------------------------------------------------------------------ */

function SectionRows({ dense = false }: { dense?: boolean }) {
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
                "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
                dense ? "min-h-10" : "min-h-11",
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

function SectionCards() {
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

function IndexCard({ note, sticky = false }: { note: string; sticky?: boolean }) {
  return (
    <nav
      aria-label="Document sections"
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5",
        sticky && "sticky top-0",
      )}
    >
      <div className="flex items-baseline justify-between px-1 pb-1.5">
        <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
          In this document
        </p>
        <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
          {activeIndex + 1}/{sections.length}
        </p>
      </div>
      <SectionRows dense />
      <p className="mt-2 border-t border-[color:var(--border)] px-1 pt-2 text-3xs leading-4 text-[color:var(--text-soft)]">
        {note}
      </p>
    </nav>
  );
}

function IconRail({ note }: { note: string }) {
  return (
    <nav
      aria-label="Document sections"
      title={note}
      className="shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="sticky top-0 grid w-[4.25rem] gap-1 p-1.5">
        {sections.map((section, index) => {
          const selected = index === activeIndex;
          const Icon = section.icon;

          return (
            <button
              key={section.label}
              type="button"
              onClick={() => undefined}
              aria-current={selected ? "true" : undefined}
              title={section.label}
              className={cn(
                "relative grid min-h-[3.25rem] place-items-center gap-0.5 rounded-lg px-1 py-1.5 transition",
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
              <Icon aria-hidden="true" className="h-[1.1rem] w-[1.1rem]" />
              <span className="max-w-full truncate text-3xs font-bold">{section.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function LabelledRail() {
  return (
    <nav
      aria-label="Document sections"
      className="w-[17rem] shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="sticky top-0 p-2.5">
        <div className="flex items-baseline justify-between px-1 pb-2">
          <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
            In this document
          </p>
          <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
            {activeIndex + 1}/{sections.length}
          </p>
        </div>
        <SectionRows />
        <p className="mt-2 border-t border-[color:var(--border)] px-1 pt-2 text-3xs leading-4 text-[color:var(--text-soft)]">
          Sticky offset follows the top bar: header height when shown, 0 when hidden.
        </p>
      </div>
    </nav>
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
          {activeSection.label} · {activeIndex + 1} of {sections.length} — composer blurred, scrim covers the pill
        </p>
        <SectionCards />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

function EvidenceColumnPanel() {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
        Pinned source evidence
      </p>
      <div className="mt-2.5 space-y-2">
        <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
        <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/35" />
        <div className="h-1 w-11/12 rounded-full bg-[color:var(--border-strong)]/30" />
        <div className="h-1 w-9/12 rounded-full bg-[color:var(--border-strong)]/25" />
      </div>
    </div>
  );
}

function DocumentBody({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("min-w-0 space-y-3", compact ? "p-3" : "p-4")}>
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

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

function DesktopFrame({ candidate }: { candidate: CandidateId }) {
  return (
    <div className="flex h-[26rem] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="desktop" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {candidate === "rail" ? (
          <div className="flex min-h-full items-stretch">
            <LabelledRail />
            <div className="min-w-0 flex-1">
              <DocumentHeader device="desktop" />
              <div className="grid grid-cols-[minmax(0,1fr)_18rem] items-start">
                <DocumentBody />
                <div className="space-y-3 p-4 pl-0">
                  <EvidenceColumnPanel />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-full">
            <DocumentHeader device="desktop" />
            <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start">
              <DocumentBody />
              <div className="space-y-3 p-4 pl-0">
                <IndexCard
                  sticky
                  note="First card in the 480 px column the viewer already renders — no third column."
                />
                <EvidenceColumnPanel />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabletFrame({ candidate }: { candidate: CandidateId }) {
  return (
    <div className="mx-auto flex h-[26rem] w-full max-w-[768px] flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      <UniversalTopBar device="tablet" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {candidate === "rail" ? (
          <div className="flex min-h-full items-stretch">
            <IconRail note="Shares the pinned stack rather than adding a layer beneath it." />
            <div className="min-w-0 flex-1">
              <DocumentHeader device="tablet" />
              <DocumentBody compact />
            </div>
          </div>
        ) : (
          <div className="min-h-full">
            <DocumentHeader device="tablet" />
            <div className="space-y-3 p-3">
              <IndexCard note="In page flow: scrolls away with the document, so no third sticky layer is created." />
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
                    <Quote aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
                      Source passages
                    </p>
                    <h4 className="mt-0.5 text-sm font-semibold text-[color:var(--text-heading)]">
                      {activeSection.label}
                    </h4>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-[color:var(--border)] pt-3">
                  <div className="h-1 rounded-full bg-[color:var(--border-strong)]/55" />
                  <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/45" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneFrame({ open }: { open: boolean }) {
  const sheetId = useId();

  return (
    <div className="relative flex h-[26rem] w-[330px] max-w-full flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]">
      {/* Both rows below sm live in the one universal collapse row. */}
      <UniversalTopBar device="phone" />
      <DocumentHeader device="phone" sheetId={sheetId} expanded={open} />
      <div className="min-h-0 flex-1 overflow-hidden bg-[color:var(--background)]">
        <DocumentBody compact />
      </div>
      <PhoneComposerPill dimmed={open} />
      {open ? <SectionsSheet id={sheetId} /> : null}
    </div>
  );
}

function CandidateShowcase({ candidate, number }: { candidate: (typeof candidates)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8" aria-labelledby={`${candidate.id}-title`}>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Candidate {String(number).padStart(2, "0")} · {candidate.verdict}
          </p>
          <h2
            id={`${candidate.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {candidate.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {candidate.summary}
        </p>
      </div>

      <dl className="mb-5 grid gap-2 sm:grid-cols-3">
        {(["desktop", "tablet", "phone"] as Device[]).map((device) => (
          <div
            key={device}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
          >
            <dt className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{device}</dt>
            <dd className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{candidate.perDevice[device]}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-5">
        <div>
          <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            Desktop · 1440 px
          </p>
          <DesktopFrame candidate={candidate.id} />
        </div>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Tablet · 768 px
            </p>
            <TabletFrame candidate={candidate.id} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Phone · closed
              </p>
              <PhoneFrame open={false} />
            </div>
            <div>
              <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
                Phone · sheet open
              </p>
              <PhoneFrame open />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DocumentNavigationContractMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-3xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Navigation against the chrome contract
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            Two complete candidates, built to the header and footer rules
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Both candidates are drawn on top of the chrome that actually ships: the universal top bar, the document
            header that portals into the phone collapse row, and the 56-pixel document composer that already owns the
            phone footer. The findings below are what the contract permits — the candidates differ only where it leaves
            a choice.
          </p>
        </header>

        <section aria-labelledby="findings-title" className="mt-8">
          <h2 id="findings-title" className="text-lg font-semibold text-[color:var(--text-heading)]">
            What the current chrome already decides
          </h2>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {contractFindings.map((finding) => (
              <div
                key={finding.area}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3"
              >
                <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
                  {finding.area}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-muted)]">{finding.finding}</p>
                <p className="mt-2 border-t border-[color:var(--border)] pt-2 text-xs font-semibold leading-5 text-[color:var(--text)]">
                  {finding.consequence}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10 space-y-12">
          {candidates.map((candidate, index) => (
            <CandidateShowcase key={candidate.id} candidate={candidate} number={index + 1} />
          ))}
        </div>

        <section
          aria-labelledby="perfected-title"
          className="mt-12 rounded-2xl border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)]/35 p-5"
        >
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Recommended build
          </p>
          <h2
            id="perfected-title"
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            Candidate A everywhere, Candidate B&apos;s rail only above 1440 px
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
            Candidate A never introduces a surface the contract has to make room for, which is why it is the default.
            The rail from Candidate B is worth having, but only where a third column genuinely fits — below that it
            takes width from the document to say what the index already says.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {perfected.map((item) => (
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
