/**
 * Reduced-motion-aware scroll behavior for scripted scrolls.
 *
 * `globals.css` sets `scroll-behavior: auto !important` under both
 * `prefers-reduced-motion: reduce` and the app's own `html[data-motion="reduced"]`
 * toggle, but per the CSSOM-View spec an explicit `behavior` in a
 * `ScrollToOptions`/`ScrollIntoViewOptions` object overrides that CSS property.
 * So any scripted `scrollTo`/`scrollIntoView` that hard-codes `behavior:"smooth"`
 * animates regardless of the preference. Route those through
 * {@link resolveScrollBehavior} instead so the "Reduce motion" control (and the OS
 * setting) actually suppress the animation.
 */

/**
 * True when the user has asked for reduced motion, via either the OS media query
 * or the in-app "Reduce motion" toggle (mirrored onto `<html data-motion="reduced">`
 * before first paint by `layout.tsx` and synced by `use-app-preferences.ts`).
 * Safe on the server (returns `false`).
 */
export function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement.getAttribute("data-motion") === "reduced") {
    return true;
  }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** `"auto"` when reduced motion is preferred, otherwise `"smooth"`. */
export function resolveScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/**
 * The same question, answered against the app's THREE-state Motion preference.
 *
 * {@link prefersReducedMotion} above deliberately does not honour the in-app
 * `data-motion="full"` opt-in — scroll animation is suppressed under an OS request either
 * way, and `settings-dialog.tsx` documents that divergence at its own local copy. But the
 * app's CSS animations use the three-state form (`html[data-motion="reduced"]` always
 * suppressed, `html:not([data-motion="full"])` + the media query otherwise), so anything
 * gating a JS-driven animation must resolve it the same way or it will freeze an animation
 * the surrounding interface is still running.
 *
 * Mirrors that CSS exactly: an explicit in-app choice wins in both directions, and the OS
 * request decides only when the reader has expressed none. Safe on the server (returns
 * `false`).
 */
export function motionIsSuppressed(): boolean {
  if (typeof document === "undefined") return false;
  const preference = document.documentElement.getAttribute("data-motion");
  if (preference === "reduced") return true;
  if (preference === "full") return false;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
