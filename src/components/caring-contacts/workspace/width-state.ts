/**
 * The frozen four-state width mapping from the coordination design spec §7.
 *
 * This is the single source: no component may re-derive a breakpoint. The shell
 * expresses the states in Tailwind media classes (`md:` / `lg:` / `xl:`) so the
 * layout itself needs no JavaScript; this module exists for the overlay
 * modality decision (a sheet on a compact screen is a dialog on a wide one) and
 * for tests.
 *
 * These numbers are deliberately NOT a named `--breakpoint-*` design token —
 * design-system GATES §3b prohibits adding one.
 */

export type WorkspaceWidthState = "compact" | "rail" | "split" | "wide";

export const WORKSPACE_WIDTH_BREAKPOINTS = Object.freeze({ rail: 768, split: 1024, wide: 1440 } as const);

/**
 * `compact` below 768, `rail` from 768 to 1023, `split` from 1024 to 1439, and
 * `wide` at 1440 and above. 320, 390 and 430 are the three review widths that
 * all sample the one `compact` state rather than adding states of their own.
 */
export function widthStateFor(viewportWidth: number): WorkspaceWidthState {
  if (viewportWidth >= WORKSPACE_WIDTH_BREAKPOINTS.wide) return "wide";
  if (viewportWidth >= WORKSPACE_WIDTH_BREAKPOINTS.split) return "split";
  if (viewportWidth >= WORKSPACE_WIDTH_BREAKPOINTS.rail) return "rail";
  return "compact";
}
