"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  Compass,
  FileImage,
  FileSearch,
  FileText,
  LayoutList,
  ListTree,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/components/ui-primitives";
import { appModeHomeHref } from "@/lib/app-modes";

type SectionId = "overview" | "summary" | "pdf" | "evidence" | "text" | "images" | "provenance";
type GroupId = "read" | "evidence" | "provenance";
type ConceptId = "rail" | "drop" | "progress";
type PreviewDevice = "desktop" | "tablet" | "phone";

const documentHomeHref = appModeHomeHref("documents");
const documentTitle = "Clinical practice guideline for schizophrenia";

const groups: Array<{ id: GroupId; label: string }> = [
  { id: "read", label: "Read" },
  { id: "evidence", label: "Evidence" },
  { id: "provenance", label: "Provenance" },
];

/**
 * The seven panes below mirror the real document page components in
 * `DocumentViewer` — overview landing, high-yield summary, PDF preview, pinned
 * evidence, indexed source text, tables/diagrams, and indexing details — so the
 * navigation study is measured against the sections it would actually drive.
 */
const sections: Array<{
  id: SectionId;
  group: GroupId;
  label: string;
  short: string;
  detail: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: "overview",
    group: "read",
    label: "Overview",
    short: "Overview",
    detail: "84 pages",
    eyebrow: "Start here",
    description: "Document identity, type, page count, and the four primary actions for this source.",
    icon: Compass,
  },
  {
    id: "summary",
    group: "read",
    label: "High-yield summary",
    short: "Summary",
    detail: "8 points",
    eyebrow: "Clinical profile",
    description: "What this document covers, drawn from its indexed evidence and clinical specifics.",
    icon: Sparkles,
  },
  {
    id: "pdf",
    group: "read",
    label: "PDF preview",
    short: "PDF",
    detail: "p. 12 / 84",
    eyebrow: "Original source",
    description: "The source document with page position, zoom, and in-document search kept in view.",
    icon: FileText,
  },
  {
    id: "evidence",
    group: "evidence",
    label: "Pinned evidence",
    short: "Evidence",
    detail: "27 passages",
    eyebrow: "Source passages",
    description: "The retrieved passage in full, with a direct return path to its source page.",
    icon: Quote,
  },
  {
    id: "text",
    group: "evidence",
    label: "Indexed source text",
    short: "Text",
    detail: "312 chunks",
    eyebrow: "Extracted text",
    description: "Every indexed chunk, searchable in place, with previous and next hit navigation.",
    icon: FileSearch,
  },
  {
    id: "images",
    group: "evidence",
    label: "Tables and diagrams",
    short: "Tables",
    detail: "6 visuals",
    eyebrow: "Visual evidence",
    description: "Indexed tables, diagrams, and image captions with their page references intact.",
    icon: FileImage,
  },
  {
    id: "provenance",
    group: "provenance",
    label: "Indexing details",
    short: "Indexing",
    detail: "v3 · OCR",
    eyebrow: "Audit trail",
    description: "Extraction quality, index version, and ingestion history for this source.",
    icon: ShieldCheck,
  },
];

const concepts: Array<{
  id: ConceptId;
  title: string;
  verdict: string;
  description: string;
  behaviour: Record<PreviewDevice, string>;
}> = [
  {
    id: "rail",
    title: "Anchored contents rail",
    verdict: "Recommended",
    description:
      "A persistent pane fixed to the underside of the universal header. It never scrolls away, so the document's structure stays legible while the canvas scrolls beside it.",
    behaviour: {
      desktop: "17rem labelled rail, sticky under the header, grouped with live counts.",
      tablet: "Compact icon rail keeps the anchor without stealing reading width.",
      phone: "Header-anchored Contents button drops the same list over the canvas.",
    },
  },
  {
    id: "drop",
    title: "Header-anchored drop pane",
    verdict: "Most screen space",
    description:
      "A slim status bar welded to the header shows the active section at all times; opening it drops a grouped pane across the full width, then returns every pixel to the document.",
    behaviour: {
      desktop: "Three-column grouped pane drops beneath the header on demand.",
      tablet: "Two columns, same grouping, same anchor point.",
      phone: "Full-width stacked pane — the only pattern that leaves phone reading width untouched.",
    },
  },
  {
    id: "progress",
    title: "Docked progress pane",
    verdict: "Best orientation",
    description:
      "The pane anchors on the trailing edge and tracks reading position. Section jumps and 'how far through am I' are answered by the same control.",
    behaviour: {
      desktop: "15rem trailing pane with a progress spine and completed-section markers.",
      tablet: "Sticky segmented strip with the progress bar welded to the header edge.",
      phone: "Compact progress pill under the header expands into the full jump list.",
    },
  },
];

const deviceCopy: Record<PreviewDevice, { label: string; width: string }> = {
  desktop: { label: "Desktop · 1440 px", width: "hidden w-full lg:block" },
  tablet: { label: "Tablet · 768 px", width: "mx-auto hidden w-full max-w-[768px] sm:block" },
  phone: { label: "Phone · 390 px", width: "mx-auto w-full max-w-[390px]" },
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

function sectionIndex(id: SectionId) {
  return sections.findIndex((section) => section.id === id);
}

/** Stand-in for the universal app header the pane is anchored to. */
function UniversalHeader({ device }: { device: PreviewDevice }) {
  const phone = device === "phone";

  return (
    <div
      data-testid="mock-universal-header"
      className={cn(
        "flex shrink-0 items-center border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] px-3",
        phone ? "h-12 gap-2" : "h-14 gap-3 sm:px-4",
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[0.6rem] bg-[color:var(--text-heading)] text-3xs font-black tracking-[-0.04em] text-[color:var(--surface)]">
        KB
      </span>
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] font-semibold text-[color:var(--text)]",
          phone ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm",
        )}
      >
        <ListTree aria-hidden="true" className="h-4 w-4 text-[color:var(--clinical-accent)]" />
        Documents
      </span>
      <span className="ml-auto hidden text-xs font-semibold text-[color:var(--text-soft)] sm:block">
        Universal header
      </span>
      <span className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--text-muted)]">
        <Search aria-hidden="true" className="h-4 w-4" />
      </span>
      <span aria-hidden="true" className="h-8 w-8 rounded-full bg-[color:var(--clinical-accent-soft)]" />
    </div>
  );
}

function DocumentTitleBar({ device, compact = false }: { device: PreviewDevice; compact?: boolean }) {
  const phone = device === "phone";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-2",
        compact ? "h-12" : phone ? "h-14" : "h-[3.75rem] px-3",
      )}
    >
      <Link
        href={documentHomeHref}
        aria-label="Back to documents"
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
          focusRing,
          phone ? "w-11" : "px-3 text-sm",
        )}
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        {phone ? null : <span>Documents</span>}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-3xs font-bold uppercase tracking-[0.11em] text-[color:var(--clinical-accent)]">
          NICE · Clinical guideline
        </p>
        <h3
          title={documentTitle}
          className={cn(
            "truncate font-semibold tracking-[-0.01em] text-[color:var(--text-heading)]",
            phone ? "text-sm-minus" : "text-sm sm:text-base-minus",
          )}
        >
          {documentTitle}
        </h3>
      </div>
    </div>
  );
}

function PaneItem({
  section,
  selected,
  onSelect,
  variant,
}: {
  section: (typeof sections)[number];
  selected: boolean;
  onSelect: () => void;
  variant: "list" | "icon" | "card";
}) {
  const Icon = section.icon;

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        title={section.label}
        className={cn(
          "relative grid min-h-[3.5rem] w-full place-items-center gap-0.5 rounded-lg px-1 py-2 transition",
          focusRing,
          selected
            ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
        )}
      >
        {selected ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)]"
          />
        ) : null}
        <Icon aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
        <span className="max-w-full truncate text-3xs font-bold">{section.short}</span>
      </button>
    );
  }

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-h-12 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition",
          focusRing,
          selected
            ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
            : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text)] hover:border-[color:var(--border-strong)]",
        )}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-xs font-bold">{section.label}</span>
        <span className="nums shrink-0 text-3xs font-semibold text-[color:var(--text-soft)]">{section.detail}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
        focusRing,
        selected
          ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
          : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
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
      <span className="nums shrink-0 text-3xs font-semibold text-[color:var(--text-soft)]">{section.detail}</span>
    </button>
  );
}

function GroupedPaneList({
  active,
  onSelect,
  variant = "list",
  columns = 1,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  variant?: "list" | "card";
  columns?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-3",
        columns === 3 && "sm:grid-cols-3",
        columns === 2 && "sm:grid-cols-2",
        columns === 1 && "grid-cols-1",
      )}
    >
      {groups.map((group) => (
        <div key={group.id} className="min-w-0">
          <p className="px-2.5 pb-1.5 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
            {group.label}
          </p>
          <div className={cn("space-y-1", variant === "card" && "space-y-1.5")}>
            {sections
              .filter((section) => section.group === group.id)
              .map((section) => (
                <PaneItem
                  key={section.id}
                  section={section}
                  selected={active === section.id}
                  onSelect={() => onSelect(section.id)}
                  variant={variant}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Concept 1 — anchored contents rail                                  */
/* ------------------------------------------------------------------ */

function RailPane({
  device,
  active,
  onSelect,
}: {
  device: PreviewDevice;
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  if (device === "tablet") {
    return (
      <nav
        aria-label="Document sections"
        className="z-10 shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface)]"
      >
        <div className="sticky top-0 grid w-[4.5rem] gap-1 p-1.5">
          {sections.map((section) => (
            <PaneItem
              key={section.id}
              section={section}
              selected={active === section.id}
              onSelect={() => onSelect(section.id)}
              variant="icon"
            />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Document sections"
      className="z-10 w-[17rem] shrink-0 border-r border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="sticky top-0 p-2.5">
        <p className="px-2.5 pb-2 text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
          In this document
        </p>
        <GroupedPaneList active={active} onSelect={onSelect} />
      </div>
    </nav>
  );
}

function RailPhonePane({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  const [open, setOpen] = useState(false);
  const paneId = useId();
  const activeSection = sections[sectionIndex(active)];

  return (
    <div className="sticky top-0 z-20">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={paneId}
        className={cn(
          "flex min-h-12 w-full items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left",
          focusRing,
        )}
      >
        <LayoutList aria-hidden="true" className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" />
        <span className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Contents</span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--text-heading)]">
          {activeSection.label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          id={paneId}
          className="absolute inset-x-0 top-full max-h-[19rem] overflow-y-auto border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2.5 shadow-[var(--shadow-lux)]"
        >
          <GroupedPaneList
            active={active}
            onSelect={(id) => {
              onSelect(id);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Concept 2 — header-anchored drop pane                               */
/* ------------------------------------------------------------------ */

function DropPane({
  device,
  active,
  onSelect,
}: {
  device: PreviewDevice;
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  const [open, setOpen] = useState(device === "desktop");
  const paneId = useId();
  const index = sectionIndex(active);
  const activeSection = sections[index];
  const columns = device === "desktop" ? 3 : device === "tablet" ? 2 : 1;

  return (
    <div className="sticky top-0 z-20">
      <div className="flex min-h-12 items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-2 sm:px-3">
        <span className="nums shrink-0 rounded-full bg-[color:var(--surface-subtle)] px-2 py-0.5 text-3xs font-black text-[color:var(--text-muted)]">
          {index + 1} / {sections.length}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--text-heading)]">
          {activeSection.label}
        </span>
        <span className="nums hidden text-3xs font-semibold text-[color:var(--text-soft)] sm:block">
          {activeSection.detail}
        </span>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={paneId}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] px-3 text-2xs font-bold text-[color:var(--clinical-accent)] transition",
            focusRing,
          )}
        >
          {open ? (
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <LayoutList aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          {open ? "Close" : "All sections"}
        </button>
      </div>
      {open ? (
        <div
          id={paneId}
          className="absolute inset-x-0 top-full max-h-[21rem] overflow-y-auto border-b border-[color:var(--border-lux)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-lux)]"
        >
          <GroupedPaneList
            active={active}
            onSelect={(id) => {
              onSelect(id);
              setOpen(false);
            }}
            variant="card"
            columns={columns}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Concept 3 — docked progress pane                                    */
/* ------------------------------------------------------------------ */

function ProgressSpine({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  const index = sectionIndex(active);

  return (
    <ol className="relative space-y-0.5 pl-1">
      <span aria-hidden="true" className="absolute bottom-3 left-[0.9rem] top-3 w-px bg-[color:var(--border)]" />
      {sections.map((section, position) => {
        const selected = position === index;
        const passed = position < index;

        return (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-lg pl-1 pr-2 text-left transition",
                focusRing,
                selected
                  ? "text-[color:var(--clinical-accent)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)]",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 grid h-[1.1rem] w-[1.1rem] shrink-0 place-items-center rounded-full border-2 bg-[color:var(--surface)]",
                  selected
                    ? "border-[color:var(--clinical-accent)]"
                    : passed
                      ? "border-[color:var(--clinical-accent)]/45"
                      : "border-[color:var(--border-strong)]",
                )}
              >
                {selected || passed ? (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      selected ? "bg-[color:var(--clinical-accent)]" : "bg-[color:var(--clinical-accent)]/45",
                    )}
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{section.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ProgressPane({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  const index = sectionIndex(active);
  const percent = Math.round(((index + 1) / sections.length) * 100);

  return (
    <nav
      aria-label="Document sections"
      className="z-10 w-[15rem] shrink-0 border-l border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="sticky top-0 p-2.5">
        <div className="flex items-baseline justify-between px-1.5">
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Position
          </p>
          <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">{percent}%</p>
        </div>
        <div className="mx-1.5 mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--surface-inset)]">
          <span
            aria-hidden="true"
            style={{ width: `${percent}%` }}
            className="block h-full rounded-full bg-[color:var(--clinical-accent)] transition-[width]"
          />
        </div>
        <div className="mt-3">
          <ProgressSpine active={active} onSelect={onSelect} />
        </div>
      </div>
    </nav>
  );
}

function ProgressStrip({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  const index = sectionIndex(active);
  const percent = Math.round(((index + 1) / sections.length) * 100);

  return (
    <nav
      aria-label="Document sections"
      className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="flex gap-1 overflow-x-auto px-2 py-1.5">
        {sections.map((section) => {
          const selected = active === section.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-2xs font-bold transition",
                focusRing,
                selected
                  ? "border-[color:var(--clinical-accent-border)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                  : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              <section.icon aria-hidden="true" className="h-3.5 w-3.5" />
              {section.short}
            </button>
          );
        })}
      </div>
      <div className="h-0.5 bg-[color:var(--surface-inset)]">
        <span
          aria-hidden="true"
          style={{ width: `${percent}%` }}
          className="block h-full bg-[color:var(--clinical-accent)] transition-[width]"
        />
      </div>
    </nav>
  );
}

function ProgressPhonePane({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  const [open, setOpen] = useState(false);
  const paneId = useId();
  const index = sectionIndex(active);
  const percent = Math.round(((index + 1) / sections.length) * 100);

  return (
    <div className="sticky top-0 z-20">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={paneId}
        className={cn(
          "flex min-h-12 w-full items-center gap-2.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-left",
          focusRing,
        )}
      >
        <span
          aria-hidden="true"
          style={{
            background: `conic-gradient(var(--clinical-accent) ${percent}%, var(--surface-inset) 0)`,
          }}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--surface)] text-3xs font-black text-[color:var(--clinical-accent)]">
            {index + 1}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-[color:var(--text-heading)]">
            {sections[index].label}
          </span>
          <span className="nums block text-3xs font-semibold text-[color:var(--text-soft)]">
            Section {index + 1} of {sections.length}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-[color:var(--text-muted)] transition", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div
          id={paneId}
          className="absolute inset-x-0 top-full max-h-[19rem] overflow-y-auto border-b border-[color:var(--border)] bg-[color:var(--surface-lux)] p-2.5 shadow-[var(--shadow-lux)]"
        >
          <ProgressSpine
            active={active}
            onSelect={(id) => {
              onSelect(id);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared canvas                                                       */
/* ------------------------------------------------------------------ */

function DocumentCanvas({ sectionId, device }: { sectionId: SectionId; device: PreviewDevice }) {
  const section = sections[sectionIndex(sectionId)];
  const Icon = section.icon;
  const phone = device === "phone";

  return (
    <div className={cn("min-w-0 flex-1 bg-[color:var(--background)]", phone ? "p-3" : "p-4 sm:p-5")}>
      <section
        aria-live="polite"
        className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.65rem] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]">
            <Icon aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
              {section.eyebrow}
            </p>
            <h4 className="mt-0.5 font-semibold text-[color:var(--text-heading)]">{section.label}</h4>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{section.description}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 border-t border-[color:var(--border)] pt-3">
          <div className="h-1.5 w-2/3 rounded-full bg-[color:var(--text-heading)]/15" />
          <div className="h-1 rounded-full bg-[color:var(--border-strong)]/55" />
          <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/45" />
          <div className="h-1 w-11/12 rounded-full bg-[color:var(--border-strong)]/40" />
        </div>
      </section>

      {/* Filler blocks give the preview enough scroll length for the anchored
          pane to visibly hold its position while the canvas moves. */}
      <div className={cn("mt-3 grid gap-3", phone ? "grid-cols-1" : "sm:grid-cols-2")}>
        {[0, 1, 2, 3].map((block) => (
          <div key={block} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
            <div className="h-1.5 w-1/2 rounded-full bg-[color:var(--text-heading)]/12" />
            <div className="mt-3 space-y-2">
              <div className="h-1 rounded-full bg-[color:var(--border-strong)]/45" />
              <div className="h-1 w-9/12 rounded-full bg-[color:var(--border-strong)]/35" />
              <div className="h-1 w-10/12 rounded-full bg-[color:var(--border-strong)]/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview frames                                                      */
/* ------------------------------------------------------------------ */

function ResponsivePreview({ concept, device }: { concept: ConceptId; device: PreviewDevice }) {
  const [active, setActive] = useState<SectionId>("evidence");
  const { label, width } = deviceCopy[device];
  const phone = device === "phone";

  const railLayout = concept === "rail" && !phone;
  const progressLayout = concept === "progress" && device === "desktop";

  return (
    <div className={cn("min-w-0", width)}>
      <p className="mb-2 text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{label}</p>
      <article
        id={`${concept}-${device}-preview`}
        data-concept={concept}
        data-device={device}
        className="relative flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-[color:var(--border-lux)] bg-[color:var(--surface)] shadow-[var(--e2)]"
      >
        <UniversalHeader device={device} />

        {/* The scroll container starts immediately below the universal header,
            so anything `sticky top-0` inside it is anchored to that header. */}
        <div className="relative h-[24rem] overflow-y-auto">
          {railLayout ? (
            <div className="flex min-h-full items-stretch">
              <RailPane device={device} active={active} onSelect={setActive} />
              <div className="min-w-0 flex-1">
                <DocumentTitleBar device={device} />
                <DocumentCanvas sectionId={active} device={device} />
              </div>
            </div>
          ) : progressLayout ? (
            <div className="flex min-h-full items-stretch">
              <div className="min-w-0 flex-1">
                <DocumentTitleBar device={device} />
                <DocumentCanvas sectionId={active} device={device} />
              </div>
              <ProgressPane active={active} onSelect={setActive} />
            </div>
          ) : (
            <>
              {concept === "rail" ? <RailPhonePane active={active} onSelect={setActive} /> : null}
              {concept === "drop" ? <DropPane device={device} active={active} onSelect={setActive} /> : null}
              {concept === "progress" && device === "tablet" ? (
                <ProgressStrip active={active} onSelect={setActive} />
              ) : null}
              {concept === "progress" && phone ? <ProgressPhonePane active={active} onSelect={setActive} /> : null}
              <DocumentTitleBar device={device} compact />
              <DocumentCanvas sectionId={active} device={device} />
            </>
          )}
        </div>
      </article>
    </div>
  );
}

function ConceptShowcase({ concept, number }: { concept: (typeof concepts)[number]; number: number }) {
  return (
    <section className="border-t border-[color:var(--border)] pt-8 sm:pt-10" aria-labelledby={`${concept.id}-title`}>
      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,34rem)] lg:items-end">
        <div>
          <p className="text-3xs font-black uppercase tracking-[0.14em] text-[color:var(--clinical-accent)]">
            Option {String(number).padStart(2, "0")} · {concept.verdict}
          </p>
          <h2
            id={`${concept.id}-title`}
            className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[color:var(--text-heading)]"
          >
            {concept.title}
          </h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-muted)] lg:justify-self-end lg:text-right">
          {concept.description}
        </p>
      </div>

      <dl className="mb-6 grid gap-2 sm:grid-cols-3">
        {(Object.keys(deviceCopy) as PreviewDevice[]).map((device) => (
          <div
            key={device}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2"
          >
            <dt className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              {deviceCopy[device].label}
            </dt>
            <dd className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{concept.behaviour[device]}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-5">
        <ResponsivePreview concept={concept.id} device="desktop" />
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <ResponsivePreview concept={concept.id} device="tablet" />
          <ResponsivePreview concept={concept.id} device="phone" />
        </div>
      </div>
    </section>
  );
}

export function DocumentNavigationPaneMockups() {
  return (
    <main className="min-h-dvh bg-[color:var(--background)] px-3 pb-16 pt-7 text-[color:var(--text)] sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="max-w-4xl">
          <p className="text-3xs font-black uppercase tracking-[0.16em] text-[color:var(--clinical-accent)]">
            Documents · Navigation pane study
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[color:var(--text-heading)] sm:text-4xl">
            A navigation pane anchored to the universal header
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)] sm:text-base sm:leading-7">
            Three interactive options for moving between the document page&apos;s seven components — overview,
            high-yield summary, PDF preview, pinned evidence, indexed source text, tables and diagrams, and indexing
            details. Each option anchors to the underside of the universal header, keeps 44-pixel targets and a clear
            active state, and is shown on desktop, tablet, and phone. Scroll inside any frame to see the pane hold its
            anchor.
          </p>
        </header>

        <div className="mt-8 space-y-12 sm:mt-10 sm:space-y-16">
          {concepts.map((concept, index) => (
            <ConceptShowcase key={concept.id} concept={concept} number={index + 1} />
          ))}
        </div>
      </div>
    </main>
  );
}
