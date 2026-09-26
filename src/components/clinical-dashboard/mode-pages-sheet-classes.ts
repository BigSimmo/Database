import { cn, eyebrowText } from "@/components/ui-primitives";

/**
 * The "<Mode> pages" level of the mode pill's sheet, on the 48/52 rule
 * (standard §5, kit 1.7): 52px rows with hairlines inset to the text, a 32px
 * tile at the 10px control radius with a hairline and a 16px glyph at 1.5
 * stroke, the label at 15/500, a 20px product-blue check on the current page,
 * and the sheet title at 17/600.
 *
 * Only the pages level. The "Choose mode" level keeps its own 40px tiles,
 * which `tests/ui-smoke.spec.ts` pins in a browser. Kept here, apart from the
 * header, so a later visual pass changes one file.
 */

export function modePagesRowClass(active: boolean): string {
  return cn(
    "relative flex min-h-13 w-full min-w-0 items-center gap-3 rounded-md px-2 text-left no-underline",
    // The hairline starts at the label (8px padding + 32px tile + 12px gap).
    "before:pointer-events-none before:absolute before:left-13 before:right-2 before:top-0 before:h-px before:bg-[color:var(--border)] before:content-[''] first:before:hidden",
    "transition-colors duration-[var(--duration-instant)] motion-reduce:transition-none",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]",
    active ? "text-[color:var(--text-heading)]" : "text-[color:var(--text)] hover:bg-[color:var(--surface-subtle)]",
  );
}

export function modePagesTileClass(active: boolean): string {
  return cn(
    "grid size-8 shrink-0 place-items-center rounded-md border bg-[color:var(--surface-raised)]",
    active
      ? "border-[color:var(--clinical-accent-border)] text-[color:var(--clinical-accent)]"
      : "border-[color:var(--border)] text-[color:var(--text-muted)]",
  );
}

export const modePagesIconClass = "size-icon-md";
export const modePagesIconStroke = 1.5;
export const modePagesLabelClass =
  "min-w-0 flex-1 break-words text-base-minus font-medium leading-5 text-[color:var(--text-heading)]";
export const modePagesCheckClass = "size-icon-lg shrink-0 text-[color:var(--clinical-accent)]";
export const modePagesSheetTitleClass = "text-lg-minus font-semibold tracking-[var(--tracking-display)]";
/** The group eyebrow reuses the live `eyebrowText` recipe unchanged (standard §1). */
export const modePagesGroupHeadingClass = cn("px-2", eyebrowText);
export const modePagesGroupHintClass = "px-2 text-xs text-[color:var(--text-muted)]";
