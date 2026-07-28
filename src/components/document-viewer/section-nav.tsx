"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import type { RefObject } from "react";

import { cn } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import type { DocumentSection } from "@/components/document-viewer/section-index";
import { resolveScrollBehavior } from "@/lib/scroll-behavior";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]";

/**
 * Moves the reader to a section.
 *
 * The collapsible sections are an exclusive accordion, so a jump has to open the
 * target before scrolling — otherwise it lands on a closed summary bar and looks
 * like nothing happened. Opening changes layout, so the scroll waits a frame.
 * Vertical offset comes from `--document-anchor-offset`, published from the live
 * collapse-row height, rather than a fixed `scroll-mt`.
 */
export function jumpToDocumentSection(id: string) {
  if (typeof window === "undefined") return;
  const target = window.document.getElementById(id);

  window.document
    .querySelectorAll<HTMLDetailsElement>('details[name="document-viewer-section"]')
    .forEach((disclosure) => {
      if (disclosure !== target) disclosure.open = false;
    });
  if (target instanceof HTMLDetailsElement) target.open = true;
  if (!target) return;

  window.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: resolveScrollBehavior(), block: "start" });
  });
}

/**
 * Position as two pixels of height. Segments are weighted by each section's share
 * of the document, so this reads as "how far through", not "which of seven".
 * The active segment is taller as well as tinted so forced-colors keeps it legible.
 */
export function DocumentSectionTrack({
  sections,
  activeId,
  className,
}: {
  sections: DocumentSection[];
  activeId: string | null;
  className?: string;
}) {
  if (sections.length === 0) return null;
  const activeIndex = sections.findIndex((section) => section.id === activeId);

  return (
    <span aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 flex items-end gap-px px-1.5", className)}>
      {sections.map((section, index) => (
        <span
          key={section.id}
          style={{ flexGrow: section.weight }}
          className={cn(
            "min-w-[6px] shrink rounded-full transition-[height,background-color] motion-reduce:transition-none",
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

export function DocumentSectionList({
  sections,
  activeId,
  onSelect,
}: {
  sections: DocumentSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {sections.map((section) => {
        const selected = section.id === activeId;
        const Icon = section.icon;

        return (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "relative flex min-h-tap w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition",
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

function SectionListHeading({ sections, activeId }: { sections: DocumentSection[]; activeId: string | null }) {
  const position = sections.findIndex((section) => section.id === activeId) + 1;

  return (
    <div className="flex items-baseline justify-between px-0.5 pb-2">
      <p className="text-3xs font-black uppercase tracking-[0.12em] text-[color:var(--clinical-accent)]">
        In this document
      </p>
      <p className="nums text-3xs font-bold text-[color:var(--text-soft)]">
        {Math.max(position, 1)}/{sections.length}
      </p>
    </div>
  );
}

/** Desktop and tablet placement: a card in the column the viewer already renders. */
export function DocumentSectionIndexCard({
  sections,
  activeId,
  onSelect,
  className,
}: {
  sections: DocumentSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Document sections"
      data-testid="document-section-index"
      className={cn(
        "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 shadow-[var(--shadow-tight)]",
        className,
      )}
    >
      <SectionListHeading sections={sections} activeId={activeId} />
      <DocumentSectionList sections={sections} activeId={activeId} onSelect={onSelect} />
    </nav>
  );
}

/**
 * Phone placement. A sheet is not viewport chrome, so it adds no reserve and no
 * second scroll owner — the reason navigation lives here rather than in a pane
 * hanging off a header row that scroll-hides.
 */
export function DocumentSectionSheet({
  open,
  onClose,
  sections,
  activeId,
  onSelect,
  documentTitle,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  sections: DocumentSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  documentTitle: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  const position = sections.findIndex((section) => section.id === activeId) + 1;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={documentTitle}
      description={
        active
          ? `${active.label} · ${Math.max(position, 1)} of ${sections.length} — a chevron marks a section that opens first`
          : undefined
      }
      closeLabel="Close section list"
      returnFocusRef={returnFocusRef}
      testId="document-section-sheet"
    >
      <DocumentSectionList
        sections={sections}
        activeId={activeId}
        onSelect={(id) => {
          onSelect(id);
          onClose();
        }}
      />
    </Sheet>
  );
}
