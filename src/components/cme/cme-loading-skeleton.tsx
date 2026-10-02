import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { modeSummarySurface } from "@/components/mode-kit/recipes";
import { cn } from "@/components/ui-primitives";

/** A static outline block: no shimmer, nothing moves (standard §7). */
const BLOCK = "rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)]";

/** The same room under the last shape that the loaded page keeps for the floating "+ Log" (spec §5). */
const PAGE =
  "mx-auto flex w-full flex-col bg-[color:var(--background)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+6rem)] pt-6 sm:px-6";

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
    <div role="status" aria-label="Loading your CPD record" data-testid="cme-loading" className={cn(PAGE, "max-w-5xl")}>
      <div data-testid="cme-loading-header" aria-hidden="true" className="flex h-12 items-start justify-between gap-3">
        <span className="h-7 w-14 rounded-sm bg-[color:var(--surface-subtle)]" />
        <span className={cn(BLOCK, "h-12 w-28")} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="cme-loading-lead">
        <div data-testid="cme-loading-hero" aria-hidden="true" className={cn(modeSummarySurface, "h-37 rounded-xl")} />
        <div data-testid="cme-loading-card" aria-hidden="true" className={cn(BLOCK, "h-56")} />
      </div>
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
    <div
      role="status"
      aria-label="Loading your CPD log"
      data-testid="cme-log-loading"
      className={cn(PAGE, "max-w-3xl gap-4")}
    >
      <span aria-hidden="true" className="h-7 w-16 rounded-sm bg-[color:var(--surface-subtle)]" />
      <ModeModuleSkeleton rows={6} twoLine eyebrow testId="cme-log-loading-rows" />
    </div>
  );
}

/** Static shapes for the secondary CPD pages, in the same order as their loaded sections. */
export type CmeSecondaryLoadingPage =
  | "calendar"
  | "check"
  | "plan"
  | "training"
  | "summary"
  | "setup"
  | "programme"
  | "learning"
  | "routines"
  | "new"
  | "customise"
  | "entry";

/** Pages whose screen-reader label is not simply "Loading your CPD {page}". */
const LOADING_LABELS: Partial<Record<CmeSecondaryLoadingPage, string>> = {
  check: "Loading your CPD year check",
  new: "Loading the activity form",
  customise: "Loading your dashboard choices",
  entry: "Loading this activity",
};

export function CmeSecondaryLoadingSkeleton({ page }: { page: CmeSecondaryLoadingPage }) {
  const isCalendar = page === "calendar";
  const isTraining = page === "training";
  const isPlan = page === "plan";
  const isSummary = page === "summary";
  const isProgramme = page === "programme" || page === "setup";
  const isForm = page === "new";
  const isEntry = page === "entry";
  const isLearning = page === "learning";
  const rows = isCalendar ? 5 : isSummary ? 4 : isTraining || isLearning || isEntry || page === "routines" ? 3 : 5;

  return (
    <div
      role="status"
      aria-label={LOADING_LABELS[page] ?? `Loading your CPD ${page}`}
      data-testid={`cme-${page}-loading`}
      className={cn(PAGE, "max-w-3xl gap-4")}
    >
      <span aria-hidden="true" className="h-7 w-40 rounded-sm bg-[color:var(--surface-subtle)]" />
      <span aria-hidden="true" className="h-4 w-64 max-w-full rounded-sm bg-[color:var(--surface-subtle)]" />
      {isTraining ? (
        <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
          <div className={cn(BLOCK, "h-36")} />
          <div className={cn(BLOCK, "h-36")} />
        </div>
      ) : null}
      {isCalendar ? <div aria-hidden="true" className={cn(BLOCK, "h-80")} /> : null}
      {isPlan || isProgramme || isSummary || isEntry ? (
        <div aria-hidden="true" className={cn(BLOCK, isPlan ? "h-56" : "h-40")} />
      ) : null}
      {isLearning ? <div aria-hidden="true" className={cn(BLOCK, "h-24")} /> : null}
      {isForm ? (
        // The form's own shapes: the title field, then the date, hours and category chip rows.
        <div aria-hidden="true" data-testid="cme-new-loading-fields" className="flex flex-col gap-4">
          <div className={cn(BLOCK, "h-12")} />
          <div className={cn(BLOCK, "h-12 w-3/4")} />
          <div className={cn(BLOCK, "h-12")} />
          <div className={cn(BLOCK, "h-12 w-2/3")} />
        </div>
      ) : (
        <ModeModuleSkeleton rows={rows} twoLine eyebrow testId={`cme-${page}-loading-rows`} />
      )}
    </div>
  );
}
