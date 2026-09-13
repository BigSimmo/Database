"use client";

import { WardFlowErrorPanel } from "./ward-flow-error-panel";

/**
 * THE WARD FLOW BOUNDARY. Before this file existed there was none anywhere under
 * `mockups/ward-flow/`, so every throw below fell through to `src/app/error.tsx` — the application
 * shell's boundary, which replaces the whole document with the host app's generic panel. One wrong
 * record took the ward away and said nothing about which record it was.
 *
 * ⚠️ **EXACTLY WHAT THIS COVERS — read from the route tree, not assumed.** An `error.tsx` wraps its
 * own segment's `page`, its nested layouts, and every segment below it that has no nearer boundary
 * (Next 16 `file-conventions/error.md`). There is one nearer boundary, `statistics/error.tsx`, so
 * this file catches render throws on: the ward-flow home page, `board/[unitId]`, `capacity`,
 * `community/[teamId]`, `constellation`, `discharges`, `ed/[edId]`, `escalation`, `exceptions`,
 * `governance`, `handover`, `morning`, `movements`, `movements/[movementId]`, `network`,
 * `out-of-area`, `people/[patientId]`, `queue`, `referrals`, `referrals/new`, `search`,
 * `transport`, `transport/officer`, `ward/[unitId]` and `wards`. Twenty-five routes; the five
 * `statistics/**` routes belong to the nearer boundary.
 *
 * ⚠️ **WHAT IT CANNOT COVER, AND NO BOUNDARY PLACED UNDER THIS FOLDER COULD.** `error.tsx` does not
 * wrap the `layout.tsx` sitting beside it in the same segment. `ward-flow/layout.tsx` renders
 * `DeveloperAreaGate` and `WardFlowProvider`, and the provider seeds the whole world in its
 * `useReducer` initialiser — so a throw out of `seedWardFlowStateAt` escapes this boundary and
 * lands on `src/app/error.tsx`, exactly as before. Worse, `ward-movements.ts` builds its seeded
 * movements at MODULE scope (`export const wardMovements = [...]`), which routes the "unhandled
 * movement stage" guard through module evaluation rather than through any render: no React error
 * boundary can catch that at all. Closing those two gaps needs a boundary at
 * `src/app/mockups/error.tsx`, which is outside this task's remit and is recorded rather than
 * quietly attempted.
 *
 * ⚠️ **THE ON-SCREEN RESULT IS THE WHOLE PAGE, INCLUDING THE NAVIGATION RAIL — and that is not a
 * placement mistake.** `ClinicalRail` is rendered by each screen's own component tree
 * (`ward-management-console.tsx`, `statistics-section-frame.tsx`), not by the ward-flow layout, so
 * it sits BELOW every boundary that can exist here. No `error.tsx` placement anywhere under this
 * folder can keep the rail on screen while a page fails; that would take moving the rail into the
 * layout, which is a change to the screens and not this task's to make.
 */
export default function WardFlowErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <WardFlowErrorPanel
      error={error}
      retry={retry}
      title="This ward screen could not be shown"
      description="Nothing was changed and no record was lost. Trying again re-renders this screen against the same prototype state, so a screen failing on a specific record will fail again — reloading re-seeds the prototype from scratch."
      logLabel="Unhandled runtime error captured by the Ward Flow boundary:"
      testId="ward-flow-error-boundary"
    />
  );
}
