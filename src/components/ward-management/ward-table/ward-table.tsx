// src/components/ward-management/ward-table/ward-table.tsx
import type { ReactNode } from "react";

import styles from "./ward-table.module.css";

/**
 * The shared Ward Flow table primitive: a horizontal-scroll wrapper plus a `<table>`, carrying
 * the one CSS rule set eleven `.table`-named sites across five files (`discharges`, `escalation`,
 * `handover`, `out-of-area`, `search`) used to declare independently. See
 * `ward-table.module.css` for the canonical block and `tests/ward-table-single-source.test.ts`
 * for the guard that holds it to one file.
 *
 * Deliberately minimal, per the task brief: callers keep writing their own `<thead>`/`<tbody>`.
 * Column semantics across the sixteen ward tables have not been surveyed, so a generalised
 * column-config API here would be built on a guess, which is worse than no API.
 *
 * `className` exists only so a caller's own `.table` class can
 * `composes: table from "../ward-table/ward-table.module.css"` and add the one legitimate
 * per-screen variable, `--ward-table-min-width` — never a length prop, which would just move the
 * raw-length-in-TSX problem the design-token rule exists to prevent into a different type.
 *
 * `wrapperClassName` is the same mechanism for the outer scroll wrapper. It exists because
 * `search.module.css` has a `@media print { .tableScroll { overflow: visible !important; } }`
 * override for a previously-fixed print defect (a table clipped at its scroll boundary on paper);
 * without a way to attach a local class to the wrapper, migrating that file to this primitive
 * would silently drop the override and reintroduce the defect it fixed.
 *
 * `testId` preserves a `data-testid` contract several existing table sites are asserted by in DOM
 * and Playwright tests (e.g. `ward-discharge-table-${groupKey}`, `ward-out-of-area-table`). It
 * goes on the scroll wrapper, matching where every one of those tests already looks for it.
 *
 * `hasScrollThreshold` is the affordance for the defect this primitive shipped with: a table wider
 * than its scroller was reachable only by dragging sideways, with nothing on screen suggesting more
 * content existed. This component is a Server Component with no access to a runtime `scrollWidth`
 * measurement (and must not become one — see the CSS file's own comment on why), so it cannot tell
 * FOR ITSELF whether a given table currently overflows at the viewport it is being read at. What it
 * CAN know is whether the caller declared a scroll threshold at all — the same `--ward-table-min-
 * width` fact `tests/ward-table-min-width.test.ts` already pins per module. A caller that sets that
 * variable on its own `.table` class (composing this one) is asserting "this table has a width some
 * viewport will not fit"; `hasScrollThreshold` is that same assertion, repeated here as an explicit
 * prop because CSS in this file cannot read a custom property's value, only apply rules keyed off
 * markup. Defaults to `false` so no existing caller's rendered output changes until it opts in.
 *
 * Setting it true does two things, both scoped to the wrapper — never the cells, which
 * `tests/ward-table-single-source.test.ts` holds to one declaration:
 *   1. A plain-language sentence below the table stating that it scrolls sideways on a narrow
 *      screen. It states only what is always true of a table with a declared threshold — never a
 *      column count or an "N more columns" claim, which would be a runtime fact this component has
 *      no way to measure.
 *   2. A visible border on the scroll wrapper itself (`ward-table.module.css`), so a reader already
 *      mid-scroll has a cue where their eyes are, not just in a sentence below the fold.
 */
export function WardTable({
  className,
  wrapperClassName,
  testId,
  hasScrollThreshold = false,
  children,
}: {
  className?: string;
  wrapperClassName?: string;
  testId?: string;
  hasScrollThreshold?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div
        className={wrapperClassName ? `${styles.tableScroll} ${wrapperClassName}` : styles.tableScroll}
        data-testid={testId}
        data-ward-primitive="table"
        data-ward-scroll-hint={hasScrollThreshold ? "true" : undefined}
      >
        <table className={className ? `${styles.table} ${className}` : styles.table}>{children}</table>
      </div>
      {hasScrollThreshold ? (
        <p className={styles.scrollNotice}>This table scrolls sideways on narrow screens.</p>
      ) : null}
    </>
  );
}
