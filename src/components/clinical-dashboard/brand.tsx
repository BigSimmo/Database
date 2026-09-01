import { cn } from "@/components/ui-primitives";
import { BRAND_COUNTER_TRANSFORM, BRAND_VIEWBOX, brandMarkOptics } from "@/lib/brand-mark";

/**
 * Site brand mark: the PsychSift S — two counter-turning strokes divided by one
 * straight cut, with a settled point.
 *
 * In the app the symbol is drawn on its own, with no tile behind it, so it sits
 * directly on the page ground and reads as a mark rather than as an app-store
 * tile pasted into the chrome. The tiled form still exists, but only where a
 * ground has to be painted because the format has no transparency to fall back
 * on: the .ico, the Apple touch icon and the PWA raster icons.
 *
 * The colour comes from the `--brand-mark*` role tokens, which alias the accent
 * ramp, so the mark follows light, dark and forced-colors without a second
 * definition. Geometry is the single source in `@/lib/brand-mark` (shared with
 * app/icon.svg and the app-icon image routes).
 * Size it via className (h-10 w-10 expanded sidebar, h-7 w-7 collapsed rail).
 */

/**
 * Which ink the mark uses. A logo has one resting lockup colour and defined
 * alternates for grounds the resting colour cannot hold — this is that set,
 * named so a surface states its choice instead of hand-picking a hex or reaching
 * for a UI-state token.
 *
 * - `resting` — the default lockup. Correct wherever the mark is shown at
 *   display size, or on a ground with enough tint of its own to frame it.
 * - `emphasis` — one full ramp step deeper in light, one step brighter in dark.
 *   For the mark at chrome size (28-40px) on a near-white or glass band, where
 *   the resting accent lets the thinner lower stroke wash out and the mark reads
 *   top-heavy. Same geometry, more ink.
 * - `contrast` — for a filled accent or command ground, where the mark must
 *   reverse out rather than sit on the colour.
 */
export type BrandMarkTone = "resting" | "emphasis" | "contrast";

const BRAND_MARK_INK: Record<BrandMarkTone, string> = {
  resting: "var(--brand-mark)",
  emphasis: "var(--brand-mark-emphasis)",
  contrast: "var(--brand-mark-contrast)",
};

/**
 * Which optical cut of the glyph to draw. The mark is a construction, not a
 * bitmap, so it does not simply get smaller — two pieces of its negative space
 * close up before anything else does.
 *
 * - `display` — the primary construction. Correct above 32px.
 * - `chrome` — the small-size cut, for 32px and below: a wider gap between the
 *   strokes and the point slid out of its cradle. Both are the brand's own
 *   committed geometry, not a redraw.
 *
 * Sized by className, so the component cannot measure itself and this cannot be
 * inferred. State it at the call site, matched to the height you are setting.
 */
export type BrandMarkOptical = "display" | "chrome";

export function BrandMark({
  className,
  tone = "resting",
  optical = "display",
}: {
  className?: string;
  tone?: BrandMarkTone;
  optical?: BrandMarkOptical;
}) {
  // One call, so the stroke, the point and the centring transform can only be
  // taken as a set — the brand doc is explicit that mixing one variant's point
  // with the other's placement puts the glyph off-centre in its box.
  const { transform, stroke, point } = brandMarkOptics(optical);
  return (
    <svg
      viewBox={BRAND_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <g transform={transform} fill={BRAND_MARK_INK[tone]}>
        <path d={stroke} />
        <path d={stroke} transform={BRAND_COUNTER_TRANSFORM} />
        <circle cx={point.cx} cy={point.cy} r={point.r} />
      </g>
    </svg>
  );
}
