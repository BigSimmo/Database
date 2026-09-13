// src/components/ward-management/statistics/statistics-primitives.tsx
//
// ⚠️ THIS FILE ORIGINALLY PORTED SIX COMPONENTS FROM THE STATISTICS PROTOTYPE. FIVE OF THEM WERE
// DELETED 2026-09-05, ON REVIEW, BECAUSE EACH ONE DUPLICATED A GENERAL-PURPOSE PRIMITIVE ALREADY
// SHIPPING IN `src/components/ward-management/`, AND THE EXISTING PRIMITIVE IS STRONGER IN EVERY
// CASE:
//
//   REMOVED (duplicate)   USE INSTEAD                                why the existing one wins
//   StatPanel             WardPanel (../ward-panel.tsx)               identical shape (title, count,
//                                                                     blurb, headingLevel, testId);
//                                                                     renders a labelled <section>
//                                                                     so getByRole("region",{name})
//                                                                     already finds it
//   KpiStrip / Kpi        WardFigureStrip / WardFigure                label, value, unit, sub,
//                         (../ward-figure.tsx)                        flagged — and the strip THROWS
//                                                                     if more than two tiles are
//                                                                     flagged, a design discipline
//                                                                     this file's own 4-tone `Kpi`
//                                                                     had no equivalent for
//   DistributionBar       WardBar (../ward-bar.tsx)                   THROWS on a band with no word
//                                                                     and on an all-zero bar, and
//                                                                     already builds the word+number
//                                                                     aria description this file's
//                                                                     own proof requirement tested
//   StatChip               WardChip / WardKindChip (../ward-chip.tsx)  fixed vocabulary (urgent,
//                                                                     routine, stalled, accepted,
//                                                                     enroute, cancelled) — a
//                                                                     constraint worth keeping, not
//                                                                     a limitation an arbitrary tone
//                                                                     set should route around
//
// Shipping a second implementation of each shape would have created a divergent design system
// inside the very task whose purpose was consistency, and none of the five had a production
// consumer at the time of removal (only this file's own now-deleted DOM test constructed them) —
// see `tests/ward-statistics-primitives.dom.test.tsx`'s companion removal, and
// `git log` on this file for the removal commit.
//
// Two real gaps were found while confirming the equivalences above, reported here for whoever next
// wants a KPI delta or a per-panel trailing footnote — NOT solved by re-adding a duplicate:
//   - `WardFigure` has no slot for a movement indicator (`Kpi`'s `delta`: a worded "up 3 on
//     yesterday" with an up/down/flat direction). Adding one belongs in `ward-figure.tsx` itself,
//     not in a second figure component here.
//   - `WardPanel` renders `children` directly with no slot AFTER them; `StatPanel`'s `foot` prop (a
//     trailing note in its own bordered-off strip) has no equivalent. A screen that needs a
//     per-panel trailing footnote today has to place it as ordinary markup after the `WardPanel`,
//     outside the panel's own border, or `ward-panel.tsx` needs a `foot` slot added centrally.
//
// What genuinely survives below is `StatFootnote`: a headed, grouped list of invented figures
// ("Invented figures" / "What this cannot yet show", each with its own bullet list). No existing
// primitive in this app renders that shape — `WardPanel`'s `blurb` is a single line ABOVE the
// content, and every other per-screen "footnote" in this codebase (e.g.
// `community-screen.tsx`'s `styles.footnote`) is a single ungrouped `<p>`, not a headed list.
import type { ReactNode } from "react";

import styles from "./statistics.module.css";

/** One headed group of footnote entries — e.g. "Invented figures" with the list of them. */
export type StatFootnoteGroup = {
  readonly heading: string;
  readonly items: readonly ReactNode[];
};

/**
 * StatFootnote — every invented figure on the page, listed. Never omitted for a screen that
 * carries even one synthetic number: the prototype's own rule, ported verbatim, is that an
 * invented figure is always named as such at the foot of the page rather than left to look real.
 */
export function StatFootnote({ groups }: { readonly groups: readonly StatFootnoteGroup[] }) {
  return (
    <section className={styles.footnote} data-ward-primitive="stat-footnote">
      {groups.map((group) => (
        <div key={group.heading}>
          <h2>{group.heading}</h2>
          <ul>
            {group.items.map((item, index) => (
              // Footnote items are static prose with no stable identity of their own, so the
              // index is the only reasonable key.
              <li key={`${group.heading}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
