"use client";

import { useEffect, useRef } from "react";

import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { cn } from "@/components/ui-primitives";

/**
 * The second rail of the two-rail header: every section as a visible destination
 * rather than a list behind a chevron.
 *
 * Only for routes whose sections are **discrete panels** (medications today).
 * A scrolling route already has a scroll spy moving the active state
 * continuously, and a rail of eight anchored sections would overflow the row it
 * is meant to simplify — those keep the weighted track.
 *
 * Not a `role="tablist"`. The panel it swaps is a plain region, and the same
 * sections are reachable from the sheet on a phone, so a roving-tabindex group
 * here would put half the destinations behind arrow keys and half behind Tab.
 * A row of ordinary buttons is reachable both ways.
 */
export function InPageSectionRail({
  sections,
  activeId,
  onSelect,
  label,
  testIdPrefix,
}: {
  sections: readonly PageSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Accessible name for the rail, e.g. "Medication sections". */
  label: string;
  testIdPrefix: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Below `sm` the rail scrolls, so a section chosen from the sheet can be off
  // screen when the sheet closes. Bring it back into view — inline only, so the
  // page itself never scrolls as a side effect of the rail catching up.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const active = activeRef.current;
    if (!scroller || !active) return;
    if (scroller.scrollWidth <= scroller.clientWidth) return;
    active.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  }, [activeId]);

  if (sections.length === 0) return null;

  return (
    <div className="relative">
      <nav
        ref={scrollerRef}
        aria-label={label}
        data-testid={`${testIdPrefix}-section-rail`}
        className="flex items-stretch gap-0.5 overflow-x-auto scrollbar-none border-t border-[color:var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((section) => {
          const selected = section.id === activeId;
          const Icon = section.icon;

          return (
            <button
              key={section.id}
              ref={selected ? activeRef : undefined}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                // `min-h-12`, the production tap floor. Not `min-h-11`: the two
                // rails together are tall on a phone and 44px would buy back
                // 4px, but that is the exact substitution AGENTS.md forbids
                // because it reintroduces a known `ui-smoke` sub-pixel flake.
                //
                // `rounded-t-md` and an explicit focus outline rather than
                // `focus-ring-tab`: that utility sets `border-radius` on all four
                // corners, which rounds the 2px active underline into a detached
                // pill instead of an underline.
                "group flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--focus)]",
                selected
                  ? "border-[color:var(--clinical-accent)] text-[color:var(--clinical-accent)]"
                  : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-heading)]",
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0",
                  selected ? "text-[color:var(--clinical-accent)]" : "text-[color:var(--decoration-soft)]",
                )}
              />
              {section.label}
              {typeof section.count === "number" ? (
                <span
                  aria-hidden
                  className={cn(
                    "nums ml-0.5 grid h-[1.125rem] min-w-[1.125rem] shrink-0 place-items-center rounded-full px-1 text-3xs font-black",
                    selected
                      ? "bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]"
                      : "bg-[color:var(--surface-inset)] text-[color:var(--text-muted)]",
                  )}
                >
                  {section.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      {/* Only paints where the rail actually overflows: a fade over a rail that
          fits would read as a cut-off row that is not cut off. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-[color:var(--surface)] sm:hidden"
      />
    </div>
  );
}
