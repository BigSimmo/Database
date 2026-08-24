"use client";

import { useMemo } from "react";

import type { PageSection } from "@/components/in-page-nav/page-section-index";
import { planModeNavBands, type ModeNavDensityProfile } from "@/components/mode-nav/mode-nav-bands";
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
  density = "extended",
  countedLabels = false,
}: {
  sections: readonly PageSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpenSectionSheet: (opener: HTMLButtonElement) => void;
  sectionSheetOpen: boolean;
  /** Accessible name for the rail, e.g. "Medication sections". */
  label: string;
  testIdPrefix: string;
  /**
   * Which calibrated label family this rail's labels belong to. It only moves
   * the container width at which each band becomes active — never the order,
   * and never which item folds first.
   */
  density?: ModeNavDensityProfile;
  /**
   * `true` when every slot carries a count badge beside its label, which needs
   * roughly a third more width per slot.
   */
  countedLabels?: boolean;
}) {
  const plan = useMemo(() => {
    const sharedPlan = planModeNavBands(sections.length);
    if (sections.length !== 4 || !countedLabels) return sharedPlan;
    // Counted labels (icon + label + count badge) clip at the generic four-slot
    // band, so those rails hold two priority destinations plus More until the
    // 42rem band fits all four completely. A rail whose labels carry no badge
    // does not pay that, which is why this is opt-in rather than keyed on the
    // section count: it cost Therapy's rail two of its four destinations, both
    // of them behind More on every phone.
    return {
      firstVisibleBand: new Map([
        [0, 3],
        [1, 3],
        [2, 5],
        [3, 5],
      ] as const),
      moreUntil: 4,
    } satisfies ReturnType<typeof planModeNavBands>;
  }, [sections.length, countedLabels]);
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
      className="mt-2 border-t border-[color:var(--border)] sm:rounded-xl sm:border sm:border-[color:var(--border-lux)] sm:bg-[color:var(--surface-raised)] sm:px-1 sm:shadow-[var(--shadow-inset)]"
    >
      <div className="mode-nav" data-density-profile={density}>
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
