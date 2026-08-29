import { cn } from "@/components/ui-primitives";
import {
  BRAND_COUNTER_TRANSFORM,
  BRAND_GLYPH_TRANSFORM,
  BRAND_POINT,
  BRAND_STROKE_PATH,
  BRAND_TILE,
  BRAND_VIEWBOX,
} from "@/lib/brand-mark";

/**
 * Site brand mark: the PsychSift S — two counter-turning strokes divided by one
 * straight cut, with a settled point — on a rounded tile. Colours come from the
 * clinical accent tokens so the mark adapts to light/dark/forced colors.
 * Geometry is the single source in `@/lib/brand-mark` (shared with app/icon.svg
 * and the app-icon image routes). Size it via className (h-10 w-10 expanded
 * sidebar, h-7 w-7 collapsed rail).
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
      <rect
        x={BRAND_TILE.x}
        y={BRAND_TILE.y}
        width={BRAND_TILE.size}
        height={BRAND_TILE.size}
        rx={BRAND_TILE.rx}
        fill="var(--clinical-accent)"
      />
      <g transform={BRAND_GLYPH_TRANSFORM} fill="var(--clinical-accent-contrast)">
        <path d={BRAND_STROKE_PATH} />
        <path d={BRAND_STROKE_PATH} transform={BRAND_COUNTER_TRANSFORM} />
        <circle cx={BRAND_POINT.cx} cy={BRAND_POINT.cy} r={BRAND_POINT.r} />
      </g>
    </svg>
  );
}
