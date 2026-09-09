"use client";

import { WardFlowErrorPanel } from "../ward-flow-error-panel";

/**
 * THE STATISTICS BOUNDARY — nearer than `ward-flow/error.tsx`, because this is where the guards are.
 *
 * ⚠️ **EXACTLY WHAT THIS COVERS — read from the route tree.** There is no `statistics/layout.tsx`,
 * so this boundary wraps the five statistics page renders and nothing else: `statistics`,
 * `statistics/compare`, `statistics/overview`, `statistics/ed/[edId]` and
 * `statistics/ward/[unitId]`. Every other ward route goes to the parent boundary one level up.
 *
 * ⚠️ **WHY IT EXISTS WHEN THE PARENT WOULD ALSO HAVE CAUGHT THESE.** Six of the prototype's render
 * guards are here — five "the section is no longer defined" checks across four screens, plus
 * `admissionStagePosition`'s `default:` arm, which is reached only from `statistics-screen.tsx`.
 * A nearer boundary buys two real things and one thing it is tempting to claim and should not be:
 *   - `retry()` re-renders only the statistics segment rather than the whole ward subtree; and
 *   - the copy can name what failed, which "something went wrong" never can.
 *   - It does NOT keep more of the screen alive than the parent would. Both boundaries render
 *     inside `ward-flow/layout.tsx`, so both preserve `WardFlowProvider` and both replace the
 *     entire page, rail included. Anyone reasoning that a nearer boundary "fails smaller" on
 *     screen is reasoning about a layout this route tree does not have.
 */
export default function WardFlowStatisticsErrorBoundary({
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
      title="This statistics screen could not be shown"
      description="No figure was estimated, substituted or rounded to get past this — the screen stopped rather than show a number it could not support. Nothing was changed. Reloading re-seeds the prototype; trying again re-renders against the same state."
      logLabel="Unhandled runtime error captured by the Ward Flow statistics boundary:"
      testId="ward-flow-statistics-error-boundary"
    />
  );
}
