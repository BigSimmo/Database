import { focusRing } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";

/**
 * Therapy control recipes — token-backed Tailwind only (Clinical White / Sky Graphite).
 *
 * The three button recipes that used to live here (`commandControl`, `outlineControl`,
 * `iconControl`) are gone: every action they dressed is now the shared `Button` from
 * `@/components/ui/button`, per COMPONENTS.md section 9.1. What remains is the affordance
 * layer for the controls that are *not* buttons in the design-system sense — list rows,
 * disclosure headers and chips that need therapy's focus/hover behaviour without claiming
 * a Button variant.
 *
 * Hover states use `hover:not-aria-disabled:enabled:` so unavailable controls stay quiet
 * under BOTH disabled encodings. `:enabled` alone was enough while every unavailable
 * control carried the native attribute; a control that is unavailable for a stated reason
 * now carries `aria-disabled="true"` instead (it must keep its tab stop, or the reason in
 * its `title` is unreachable — see `ignoreUnavailableActivation` in ui-primitives), and
 * such a button *is* `:enabled`, so it would otherwise light up on hover.
 *
 * Focus affordance comes from the shared `focusRing` in `card-recipes.ts`. It used to be
 * redeclared here, justified by the shared export having been "renamed away from `focusRing`
 * on main" — that was already untrue: `card-recipes.ts` exports it, and the local copy meant a
 * change to the focus contract had to find this file too.
 */
export const therapyBtn = cn(
  "cursor-pointer font-[inherit] transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-quick)]",
  "hover:not-aria-disabled:enabled:-translate-y-px active:not-aria-disabled:enabled:translate-y-px",
  "disabled:cursor-not-allowed disabled:opacity-55",
  "aria-disabled:cursor-not-allowed aria-disabled:opacity-55",
  focusRing,
);

/**
 * Selected encoding for genuine `aria-pressed` toggles — the compare toggle, the favourite
 * and the recommend constraint pills. The shared `secondary` Button variant deliberately
 * carries no pressed state (most Buttons are not toggles), so a therapy toggle adds this
 * through `className`. It was previously `cardActionPressed`, private to `therapy-card.tsx`;
 * four surfaces need it, so it lives with the other therapy control recipes.
 *
 * Border AND text both move, and every call site also changes its label ("Compare" →
 * "In compare"), so the pressed state is never carried by colour alone.
 */
export const controlPressed =
  "aria-pressed:border-[color:var(--clinical-accent)] aria-pressed:text-[color:var(--clinical-accent-hover)]";

/**
 * Favourite toggles add a filled glyph on top of `controlPressed`. The fill is a shape
 * channel, so a saved favourite reads as saved without relying on the accent hue — which
 * matters most for the icon-only favourite on the result card, where there is no label to
 * change.
 */
export const favouritePressed = cn(controlPressed, "aria-pressed:[&_svg]:fill-current");

export const card =
  "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[var(--shadow-soft)]";

export const heroCard = cn(card, "border-l-[3px] border-l-[color:var(--clinical-accent)]");
