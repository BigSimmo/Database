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
