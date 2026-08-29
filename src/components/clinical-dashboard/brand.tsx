import { cn } from "@/components/ui-primitives";
import {
  BRAND_COUNTER_TRANSFORM,
  BRAND_GLYPH_TRANSFORM_BARE,
  BRAND_POINT,
  BRAND_STROKE_PATH,
  BRAND_VIEWBOX,
} from "@/lib/brand-mark";

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
 * The colour is the clinical accent token, so the mark follows light, dark and
 * forced-colors without a second definition. Geometry is the single source in
 * `@/lib/brand-mark` (shared with app/icon.svg and the app-icon image routes).
 * Size it via className (h-10 w-10 expanded sidebar, h-7 w-7 collapsed rail).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={BRAND_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <g transform={BRAND_GLYPH_TRANSFORM_BARE} fill="var(--clinical-accent)">
        <path d={BRAND_STROKE_PATH} />
        <path d={BRAND_STROKE_PATH} transform={BRAND_COUNTER_TRANSFORM} />
        <circle cx={BRAND_POINT.cx} cy={BRAND_POINT.cy} r={BRAND_POINT.r} />
      </g>
    </svg>
  );
}
