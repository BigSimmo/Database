/**
 * Shared building blocks for every developer-hub panel page: a labelled count
 * tile, and the two class strings ("section heading", "meta caption") every
 * panel section is built from. Extracted after `ledger/page.tsx` (Task 8) and
 * `routes/page.tsx` (Task 9) copied this shape verbatim; three more pages
 * were about to copy it again.
 *
 * No `"use client"`, and nothing imported here carries one either: every
 * consumer of this module is a Server Component, and a client boundary here
 * would pull all of them into the client bundle with no gate before
 * `npm run build` able to see the mistake.
 */
export const SECTION_HEADING_CLASS = "text-lg font-extrabold text-[color:var(--text-heading)]";
export const META_CLASS = "text-xs text-[color:var(--text-muted)]";

/**
 * `MONO_CLASS` and `ROW_CLASS` were byte-identical copies in `routes/page.tsx`
 * and `documentation/page.tsx` before extraction (Task 11); a third and fourth
 * copy were about to land in `test-health/page.tsx` and the ledger page Task 12
 * adds. Moved here rather than left local, following the same reasoning that
 * already pulled `CountTile`/`SECTION_HEADING_CLASS`/`META_CLASS` out — this
 * module already exceeds "tile-only" scope, so extending it beats standing up
 * a second shared module.
 */
export const MONO_CLASS = "font-mono text-xs text-[color:var(--text-heading)]";
export const ROW_CLASS = "flex flex-wrap items-baseline gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2";

const TILE_CLASS = "grid gap-1 rounded-xl border border-[color:var(--border)] p-4";
const TILE_NUMBER_CLASS = "text-2xl font-extrabold text-[color:var(--text-heading)]";
const TILE_LABEL_CLASS = "text-xs text-[color:var(--text-muted)]";

/**
 * The number carries its own `${testId}-value` test id, distinct from the
 * tile's own `testId`, so an assertion can read the number apart from the
 * label's prose — which can contain digits of its own ("blocking, priority
 * P1" carries a `1`) and would otherwise make a `toHaveTextContent` check on
 * the whole tile pass against any value the day the real count happened to
 * match one of those digits.
 *
 * `testId` is the caller's full, pre-composed id (e.g.
 * `developer-ledger-count-open`), not a bare suffix this component would
 * prefix itself — every existing call site keeps the exact id its tests
 * already assert against.
 */
export function CountTile({ testId, value, label }: { testId: string; value: number; label: string }) {
  return (
    <div data-testid={testId} className={TILE_CLASS}>
      <span data-testid={`${testId}-value`} className={TILE_NUMBER_CLASS}>
        {value}
      </span>
      <span className={TILE_LABEL_CLASS}>{label}</span>
    </div>
  );
}
