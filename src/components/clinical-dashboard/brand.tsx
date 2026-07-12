import { cn } from "@/components/ui-primitives";
import { BRAND_HIGHLIGHT_PATH, BRAND_PULSE_PATH, BRAND_PULSE_WIDTH, BRAND_TILE, BRAND_VIEWBOX } from "@/lib/brand-mark";

/**
 * Site brand mark: a refined ECG pulse on a rounded clinical-teal tile. Colours
 * come from the clinical accent tokens so the mark adapts to light/dark/forced
 * colors. Geometry is the single source in `@/lib/brand-mark` (shared with
 * app/icon.svg and the app-icon image routes). Size it via className
 * (h-10 w-10 expanded sidebar, h-7 w-7 collapsed rail).
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
      <path d={BRAND_HIGHLIGHT_PATH} fill="#fff" opacity={0.08} />
      <path
        d={BRAND_PULSE_PATH}
        fill="none"
        stroke="var(--clinical-accent-contrast)"
        strokeWidth={BRAND_PULSE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
