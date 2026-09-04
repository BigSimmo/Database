import { ModeHomeRouteLoading } from "@/components/mode-home-page-skeleton";

/**
 * The search application's catch-all streaming fallback. It lives inside the
 * `(search-app)` group, NOT at `src/app/`, and the placement is load-bearing in two
 * separate ways.
 *
 * ⚠️ **A `loading.tsx` is a Suspense boundary, and a Suspense boundary is a second copy of
 * the page in the DOM.** Next 16 turns this file into `<Suspense fallback={<Loading/>}>`
 * around every segment below it. When the wrapped tree suspends — which every dynamic
 * route here does, because the layouts above it await `headers()` / `cookies()` — React
 * flushes the fallback first and streams the real content into a `<div hidden id="S:n">`
 * parked at the end of `<body>`. An inline `$RC(...)` script then hands that pair to
 * `$RV`, which removes the hidden div and splices its children into the boundary.
 *
 * `$RV` is scheduled through `requestAnimationFrame`, so **until the browser paints a
 * frame, both copies are in the document at once** and every `data-testid` inside the
 * boundary resolves to two elements: a live one and a 0×0 orphan inside the hidden div.
 * In a tab that never paints — backgrounded, occluded, or headless without a compositor —
 * `requestAnimationFrame` never fires, the reveal never runs, and the duplicate is
 * permanent rather than transient.
 *
 * That is why this file must not sit at `src/app/`. From there it wrapped **every** route
 * in the application, including `/mockups/**`, and Ward Flow's browser suite could not
 * address a single element: 55 of the 57 test identifiers on the referral board and 65 of
 * 67 on the emergency-department board resolved to two nodes each. Scoped to this group,
 * the routes outside it render in one piece with no hidden container and nothing to
 * reveal.
 *
 * ⚠️ **The second reason is that the fallback is not generic.** `ModeHomeRouteLoading`
 * draws the search shell's mode-home hero — a medallion, a title, a search pill. Shown
 * above a ward board, a consent screen or a safety plan it is not a neutral skeleton, it
 * is the wrong application's furniture. Routes outside this group that want a fallback
 * declare their own, and several already do.
 */
export default function Loading() {
  return <ModeHomeRouteLoading />;
}
