import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { modeSummarySurface } from "@/components/mode-kit/recipes";
import { cn } from "@/components/ui-primitives";

/** A static outline block: no shimmer, nothing moves (standard §7). */
const BLOCK = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]";

/** The same room under the last shape that the loaded page keeps for the floating "+ Log" (spec §5). */
const PAGE =
  "mx-auto flex w-full max-w-3xl flex-col bg-[color:var(--background)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+6rem)] pt-6 sm:px-6";

/**
 * CPD Today's loading state: its shapes in its order, so nothing jumps when it
 * arrives (spec §6.2 and §7; standard §7: static outlines, no shimmer). Heights
 * are worked out from the loaded layout at 390 px wide:
 *   - the header row, 48 px (the "CPD" heading beside the 48 px Customise button);
 *   - the hero summary (Task 12) on the same summary surface at the 16 px radius,
 *     148 px: 16 px padding, the 20 px season line, the 42 px figure line, the bar
 *     with 12 px above and below, the 20 px pace line, 16 px padding;
 *   - the card holding the pace chart and the next action, 224 px;
 *   - the two tiles (Year check, Calendar), 88 px with the Calendar tile's two-line label;
 *   - the teaching link, 48 px;
 *   - the first module: its eyebrow and three 52 px rows (the kit's skeleton).
 * Task 17's screenshots check these against the loaded page; if a shape moved,
 * change its h-* class here. It holds no data and no words except the
 * screen-reader label.
 */
export function CmeLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading your CPD record" data-testid="cme-loading" className={PAGE}>
      <div data-testid="cme-loading-header" aria-hidden="true" className="flex h-12 items-start justify-between gap-3">
        <span className="h-7 w-14 rounded-sm bg-[color:var(--surface-subtle)]" />
        <span className={cn(BLOCK, "h-12 w-28")} />
      </div>
      <div
        data-testid="cme-loading-hero"
        aria-hidden="true"
        className={cn(modeSummarySurface, "mt-4 h-37 rounded-xl")}
      />
      <div data-testid="cme-loading-card" aria-hidden="true" className={cn(BLOCK, "mt-3 h-56")} />
      <div aria-hidden="true" className="mt-3 grid grid-cols-2 gap-3">
        <div data-testid="cme-loading-tile" className={cn(BLOCK, "h-22")} />
        <div data-testid="cme-loading-tile" className={cn(BLOCK, "h-22")} />
      </div>
      <div aria-hidden="true" className={cn(BLOCK, "mt-3 h-12")} />
      <div className="mt-6">
        <ModeModuleSkeleton rows={3} twoLine eyebrow testId="cme-loading-rows" />
      </div>
    </div>
  );
}

/** The Log's loading state: its heading's line, then a month of two-line rows. Never Today's hero. */
export function CmeLogLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading your CPD log" data-testid="cme-log-loading" className={cn(PAGE, "gap-4")}>
      <span aria-hidden="true" className="h-7 w-16 rounded-sm bg-[color:var(--surface-subtle)]" />
      <ModeModuleSkeleton rows={6} twoLine eyebrow testId="cme-log-loading-rows" />
    </div>
  );
}
