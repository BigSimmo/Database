"use client";

import styles from "./ward-controls.module.css";

export type WardFilterOption = { id: string; label: string; count: number };

/**
 * ⚠️ **THE COUNT IS NOT DECORATION.** A filter pill without one hides how much of the list it
 * removes, which on these screens is the difference between "nobody is waiting on transport today"
 * and "you filtered them out". It is required by the type, and it is announced as part of the
 * button's accessible name rather than sitting beside it unread.
 *
 * ⚠️ **AN `activeId` MATCHING NO OPTION IS THE FAILURE THAT LOOKS FINE:** every pill renders
 * unpressed, so the bar reads as "no filter applied" while a filter IS applied and the list below
 * is short for a reason nobody can see. Both controls here refuse it rather than drawing it.
 */
export function WardFilters({
  legend,
  options,
  activeId,
  onChange,
}: {
  legend: string;
  options: WardFilterOption[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  if (!options.some((option) => option.id === activeId)) {
    throw new Error(
      `WardFilters "${legend}": activeId "${activeId}" matches no option, so every pill would render unpressed while a filter is applied.`,
    );
  }
  return (
    <div className={styles.filters} role="group" aria-label={legend} data-ward-primitive="filters">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.pill}
          aria-pressed={option.id === activeId}
          onClick={() => onChange(option.id)}
        >
          {option.label} <span className={styles.pillCount}>{option.count}</span>
        </button>
      ))}
    </div>
  );
}

export type WardSegmentedOption = { id: string; label: string };

/**
 * Two or three mutually exclusive views of the same list — "Now" against "This morning", "List"
 * against "Board". It carries no count, because a segmented control changes what a number MEANS
 * rather than how much of a list is shown.
 */
export function WardSegmented({
  legend,
  options,
  activeId,
  onChange,
}: {
  legend: string;
  options: WardSegmentedOption[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  if (!options.some((option) => option.id === activeId)) {
    throw new Error(
      `WardSegmented "${legend}": activeId "${activeId}" matches no option, so every segment would render unpressed while one view is in fact showing.`,
    );
  }
  return (
    <div className={styles.segmented} role="group" aria-label={legend} data-ward-primitive="segmented">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.segment}
          aria-pressed={option.id === activeId}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
