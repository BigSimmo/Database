"use client";

import { ChevronDown } from "lucide-react";

import { cn, proseMeasure, searchFocusRing } from "@/components/ui-primitives";
import { PRIVACY_SECTIONS, type PrivacySectionId } from "@/lib/privacy-page-content";

/**
 * The governance accordion.
 *
 * Two contracts from the design system's `Disclosure`
 * (`src/components/ui/disclosure.tsx`) are followed exactly, because both were
 * broken here before:
 *
 * 1. A collapsed panel uses the author-level `hidden` *utility*, never the HTML
 *    `hidden` attribute. The attribute wins over `print:block`, so every
 *    collapsed section printed as though the page never mentioned it — silently,
 *    on paper, where the reader has no way to tell something was omitted. That
 *    is the exact failure this page exists to avoid.
 * 2. The trigger carries both `aria-expanded` and `aria-controls`.
 *
 * The gist stays rendered whether or not the section is open, and is exposed as
 * the trigger's description rather than hidden from assistive tech. It used to
 * be `aria-hidden` and to be swapped for the word "OPEN" on expand, which cost
 * screen-reader users the summary and cost everyone a layout shift per toggle.
 *
 * `Disclosure` itself is not reused: this accordion needs a numbered rail, a
 * persistent gist, index synchronisation and multi-open state that its API does
 * not carry.
 */
export function PrivacySectionAccordion({
  openIds,
  onToggle,
  sectionRefs,
  idPrefix,
  stickyOffsetPx,
}: {
  openIds: ReadonlySet<PrivacySectionId>;
  onToggle: (id: PrivacySectionId) => void;
  sectionRefs: React.RefObject<Partial<Record<PrivacySectionId, HTMLElement | null>>>;
  idPrefix: string;
  stickyOffsetPx: number;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]",
        "print:overflow-visible",
      )}
    >
      {PRIVACY_SECTIONS.map((section, index) => {
        const expanded = openIds.has(section.id);
        const panelId = `${idPrefix}-panel-${section.id}`;
        const triggerId = `${idPrefix}-trigger-${section.id}`;
        const gistId = `${idPrefix}-gist-${section.id}`;
        return (
          <section
            key={section.id}
            id={section.id}
            ref={(node) => {
              sectionRefs.current[section.id] = node;
            }}
            style={{ scrollMarginTop: stickyOffsetPx + 12 }}
            className={cn(index > 0 && "border-t border-[color:var(--border)]", "print:break-inside-avoid")}
          >
            <h3 className="m-0">
              <button
                type="button"
                id={triggerId}
                onClick={() => onToggle(section.id)}
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-describedby={gistId}
                data-print-keep
                className={cn(
                  "group relative flex w-full items-start gap-2.5 px-3 py-3 text-left transition duration-[var(--duration-fast)] hover:bg-[color:var(--surface-subtle)] sm:gap-3 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4",
                  searchFocusRing,
                  "focus-ring-contained min-h-tap",
                  expanded && "bg-[color:var(--clinical-accent-soft)]/32",
                )}
              >
                {expanded ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[color:var(--clinical-accent)] print:hidden"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "nums mt-0.5 grid h-7 w-8 shrink-0 place-items-center rounded-md text-2xs font-extrabold",
                    expanded
                      ? "bg-[color:var(--clinical-accent)] text-[color:var(--surface)]"
                      : "text-[color:var(--clinical-accent)]",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold tracking-display text-[color:var(--text-heading)] lg:text-base-minus">
                    {section.heading}
                  </span>
                  <span
                    id={gistId}
                    className="mt-0.5 block text-2xs leading-4 text-[color:var(--text-muted)] sm:mt-1 lg:text-xs lg:leading-5"
                  >
                    {section.gist}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-icon-sm shrink-0 text-[color:var(--text-muted)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none print:hidden",
                    expanded && "rotate-180 text-[color:var(--clinical-accent)]",
                  )}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              data-open={expanded ? "true" : "false"}
              className={cn(
                "border-t border-[color:var(--border)] bg-[color:var(--surface-wash)] px-3 py-3.5 sm:px-4 sm:py-4 lg:px-5 lg:py-5 lg:pl-[calc(var(--spacing-tap)+0.75rem)]",
                !expanded && "hidden",
                "print:block",
              )}
            >
              <div className={cn(proseMeasure, "space-y-3")}>
                {section.body.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className="text-sm leading-6 text-[color:var(--text)]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
