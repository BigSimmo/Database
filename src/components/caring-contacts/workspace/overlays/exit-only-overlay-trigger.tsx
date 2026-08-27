"use client";

import type { ReactNode } from "react";

import { overlayDefinition, type NonMutatingOverlayId } from "./definitions";
import { WorkspaceOverlayTrigger } from "./overlay-trigger";

/**
 * The trigger for an overlay whose decision control is an EXIT rather than a confirmation -- the
 * rows the frozen table marks `mutatesState: false`.
 *
 * ## The tension this module exists to resolve, stated rather than papered over
 *
 * Ruling 87 makes {@link WorkspaceOverlayTrigger}'s `commit` required AT THE TYPE LEVEL so a screen
 * cannot open a decision surface it has not wired, and `overlay-commits.ts` deliberately offers no
 * no-op member of `WorkspaceOverlayCommit`. That requirement is right, and it was derived from the
 * rows that record something.
 *
 * It meets a row it was not derived from here. `delivery-detail` is `mutatesState: false` and its
 * decision is "Close this detail" — Ruling 90 already established, for `commitRefusalFor`'s scope,
 * that those eight controls "are not confirmations — they are EXITS", and that refusing one renders
 * a sentence that is FALSE about a control whose whole action is to leave. So:
 *
 *  - `{ kind: "unavailable", reason }` is the wrong answer. Its scope is `every-row`, so the host
 *    would `aria-disabled` the exit and print a refusal beside it — the exact defect Ruling 90 fixed,
 *    reintroduced from the caller's side instead of the host's.
 *  - `{ kind: "record", record: () => {} }` written inline at a call site is the silent no-op Ruling
 *    87 exists to prevent. Nothing at that call site distinguishes "this row records nothing" from
 *    "somebody satisfied the compiler".
 *
 * So the answer is neither: **for an exit row, the host's own close IS the whole action.**
 * `WorkspaceOverlays.recordDecision` calls the commit and then calls `closeWorkspaceOverlay()`
 * unconditionally, so "Close this detail" is performed in full — there is simply nothing left for
 * the commit to do. That is a property of the ROW, so it is asserted against the row rather than
 * asserted by a comment: {@link exitOnlyOverlayCommit} throws for any row the frozen table marks
 * `mutatesState: true`, which is what stops this component becoming the workspace's universal
 * escape hatch from Ruling 87.
 *
 * ## Why it is a component and not an exported commit value
 *
 * A Server Component cannot pass a function across the client boundary at all (Next 16, "Server and
 * Client Components": props passed to Client Components must be serializable), and every screen in
 * this workspace is a Server Component. `WorkspaceOverlayCommit`'s `record` member is a function
 * position, satisfiable from a server file only by a Server Action — and writing a Server Action
 * that performs no write, purely to open a read-only drawer, would be a worse lie than the no-op it
 * replaced. Constructing the commit INSIDE this client boundary is what removes the function from
 * the props a screen passes: a screen passes an overlay id and a label, both plain data.
 *
 * ## The finding this leaves open, which is the owner's to take
 *
 * `WorkspaceOverlayCommit` has no member meaning "this row's decision is an exit, and the host's own
 * close is the action". Every screen wiring a non-mutating row must therefore reach
 * for a construct like this one or write a bare no-op. That is reported rather than fixed here,
 * because adding a member is a change to Task 3's pinned contract and to the totality of
 * `commitRefusalFor` — not a change a screen may make to compile.
 *
 * ## Ruling [130] — this throw stands in for a type, and should not have to
 *
 * The refusal in {@link exitOnlyOverlayCommit} is a RUNTIME check for something the type system
 * could make impossible, and that is worth naming rather than quietly accepting.
 * `WORKSPACE_OVERLAY_DEFINITIONS` is annotated `readonly WorkspaceOverlayDefinition[]` with
 * `id: string`, which ERASES the id literals its `satisfies` clause would otherwise have preserved.
 * Narrow `id` to a literal union there and `ExitOnlyOverlayTriggerProps.overlayId` can become a
 * derived `NonMutatingOverlayId` — at which point wiring a recording row to this component stops
 * COMPILING, which is the standard Ruling [87] set and strictly better than finding out at render.
 *
 * That narrowing belongs in `definitions.ts`, which is shared with live branches, so it is the
 * coordinator's to land rather than this task's. The throw stays either way: belt-and-braces once
 * the type exists, and it follows `WorkspaceOverlayTrigger`'s own render-time throw for an unknown
 * id rather than inventing a second policy.
 */
export type ExitOnlyOverlayTriggerProps = {
  /**
   * An id from the frozen 24-row table whose row carries `mutatesState: false`.
   *
   * NARROWED AT THE MERGE, and this realises Ruling [130] rather than working around a merge error.
   * It was `string` while `WorkspaceOverlayTrigger`'s own prop was `string`; Task 14 narrowed that
   * one to `WorkspaceOverlayId`, so a `string` no longer assigns to it. Taking the non-mutating
   * subset rather than the whole union is the stronger of the two available repairs: wiring a
   * mutating row to an exit-only trigger is now a COMPILE error at the call site instead of a
   * throw at render. `exitOnlyOverlayCommit`'s runtime throw stays anyway -- it guards the
   * untyped path and it is the only thing that catches a row whose `mutatesState` changes.
   */
  overlayId: NonMutatingOverlayId;
  /** The control's visible label, and therefore its accessible name. */
  children: ReactNode;
  className?: string;
};

/**
 * Called by the host immediately before it closes the overlay, and named so that it can never be
 * read as an oversight.
 *
 * There is nothing to record: the row records nothing, and the close the caller is asking for is
 * performed by `WorkspaceOverlays.recordDecision` on the line after this returns. A body here would
 * be a second thing happening on an exit nobody asked for.
 */
function closingIsTheWholeAction() {}

/**
 * The commit for an exit row, refused for any row that records something.
 *
 * Exported so a test can hold the guard directly rather than only through a rendered screen. The
 * throw is at construction — before anything is rendered — so a row wired to the wrong kind of
 * overlay fails where a developer sees it, on the same principle as `WorkspaceOverlayTrigger`'s own
 * unknown-id throw.
 */
export function exitOnlyOverlayCommit(overlayId: string) {
  const definition = overlayDefinition(overlayId);
  if (definition === null) {
    throw new Error(
      `No overlay is defined for the id "${overlayId}". The 24 rows are frozen in ` +
        `overlays/definitions.ts, transcribed from docs/caring-contacts/interaction-matrix.md.`,
    );
  }
  if (definition.mutatesState) {
    throw new Error(
      `The overlay "${overlayId}" records a decision (mutatesState: true), so its confirm control is ` +
        `not an exit and this commit would be the silent no-op Ruling 87 forbids. Wire it with a ` +
        `{ kind: "record" } commit that performs the write, or with { kind: "unavailable", reason } ` +
        `saying in plain words what is not built yet.`,
    );
  }
  return { kind: "record", record: closingIsTheWholeAction } as const;
}

export function ExitOnlyOverlayTrigger({ overlayId, children, className }: ExitOnlyOverlayTriggerProps) {
  return (
    <WorkspaceOverlayTrigger overlayId={overlayId} commit={exitOnlyOverlayCommit(overlayId)} className={className}>
      {children}
    </WorkspaceOverlayTrigger>
  );
}
