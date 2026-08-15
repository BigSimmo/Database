"use client";

import { useMemo } from "react";

import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { planModeNavBands } from "@/components/mode-nav/mode-nav-bands";
import { ModeNavSlotInk, modeNavSlotBase } from "@/components/mode-nav/nav-slot-ink";
import { cn } from "@/components/ui-primitives";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--focus)]";

/**
 * Therapy-style priority navigation for discrete in-page panels.
 *
 * Medication is the sole adopter. The first two destinations stay visible at
 * the three-slot band and the tail folds into More; the complete set returns at
 * the four-slot band. Below the minimum bar width, the header's existing title
 * disclosure remains the safe non-overflow fallback.
 *
 * This is deliberately not a tablist. The panel is a plain region and all
 * sections are also reachable from the sheet, so ordinary buttons keep every
 * visible destination in the normal Tab order.
 */
export function InPageSectionRail({
  sections,
  activeId,
  onSelect,
  onOpenSectionSheet,
  sectionSheetOpen,
  label,
  testIdPrefix,
}: {
  sections: readonly PageSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpenSectionSheet: (opener: HTMLButtonElement) => void;
  sectionSheetOpen: boolean;
  /** Accessible name for the rail, e.g. "Medication sections". */
  label: string;
  testIdPrefix: string;
}) {
  const plan = useMemo(() => {
    const sharedPlan = planModeNavBands(sections.length);
    if (sections.length !== 4) return sharedPlan;
    // Medication labels carry icons and count badges, so the generic 33rem
    // four-slot band clips them. Reuse the established 42rem density band:
    // two priority destinations plus More until all four fit completely.
    return {
      firstVisibleBand: new Map([
        [0, 3],
        [1, 3],
        [2, 5],
        [3, 5],
      ] as const),
      moreUntil: 4,
    } satisfies ReturnType<typeof planModeNavBands>;
  }, [sections.length]);
  const activeIndex = sections.findIndex((section) => section.id === activeId);
  const activeBand = activeIndex >= 0 ? plan.firstVisibleBand.get(activeIndex) : undefined;
  const activeFrom = plan.moreUntil !== null && activeIndex >= 0 ? (activeBand ?? "none") : undefined;
  const activeSection = activeIndex >= 0 ? sections[activeIndex] : undefined;
  const moreAccessibleLabel =
    activeSection && activeFrom !== undefined && activeFrom !== 3
      ? `More, current section: ${activeSection.label}`
      : "More";

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label={label}
      data-testid={`${testIdPrefix}-section-rail`}
      className="border-t border-[color:var(--border)] sm:mt-2 sm:rounded-xl sm:border sm:border-[color:var(--border-lux)] sm:bg-[color:var(--surface-raised)] sm:px-1 sm:shadow-[var(--shadow-inset)]"
    >
      <div className="mode-nav" data-density-profile="extended">
        <ul className="mode-nav__bar h-12 items-stretch px-1">
          {sections.map((section, index) => {
            const band = plan.firstVisibleBand.get(index);
            const selected = section.id === activeId;

            return (
              <li
                key={section.id}
                data-band={band ?? "none"}
                className={cn(modeNavSlotBase, band ? undefined : "hidden")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(section.id)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "flex h-full w-full items-center justify-center rounded-lg transition-colors motion-reduce:transition-none sm:hover:bg-[color:var(--surface-subtle)]",
                    selected && "sm:bg-[color:var(--clinical-accent-soft)] sm:shadow-[var(--shadow-inset)]",
                    focusRing,
                  )}
                >
                  <ModeNavSlotInk
                    icon={section.icon}
                    label={section.label}
                    count={typeof section.count === "number" ? String(section.count) : undefined}
                    state={selected ? "on" : "off"}
                  />
                </button>
              </li>
            );
          })}
          {plan.moreUntil !== null ? (
            <li
              data-until={plan.moreUntil}
              data-active-from={activeFrom}
              className={cn(modeNavSlotBase, "mode-nav__more flex")}
            >
              <button
                type="button"
                onClick={(event) => onOpenSectionSheet(event.currentTarget)}
                aria-haspopup="dialog"
                aria-expanded={sectionSheetOpen}
                aria-label={moreAccessibleLabel}
                data-testid={`${testIdPrefix}-section-overflow`}
                className={cn("flex h-full w-full items-center justify-center rounded-lg", focusRing)}
              >
                <ModeNavSlotInk label="More" state="off" trailing />
              </button>
            </li>
          ) : null}
        </ul>
      </div>
    </nav>
  );
}
