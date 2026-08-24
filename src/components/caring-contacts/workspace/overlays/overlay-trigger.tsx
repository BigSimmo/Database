"use client";

import type { ReactNode } from "react";

import { cn } from "@/components/ui-primitives";

import { overlayDefinition } from "./definitions";
import type { WorkspaceOverlayCommit } from "./overlay-commits";
import { openWorkspaceOverlayWithCommit } from "./workspace-overlays";

/**
 * The control a screen renders to raise one of the twenty-four overlays.
 *
 * Deliberately the smallest client component that can do the job (Ruling 13): a
 * button, a class name, and one call. It owns no state, subscribes to nothing and
 * reads no browser fact — the overlay machinery it calls already owns all of that.
 *
 * ## Why `commit` is required, and cannot be defaulted
 *
 * The overlays are decision surfaces, and every one of them renders a confirm
 * control. Until this component existed, none of them was reachable from any
 * control, which is the only reason a confirm that recorded nothing was tolerable.
 * Making one reachable makes that confirm a control advertising an action the
 * system does not perform — the defect `eslint-rules/require-button-wiring.mjs`
 * exists to forbid, and the one fixed on 2026-07-21.
 *
 * So Ruling 87: the trigger and the commit contract ship together, and the
 * requirement is enforced by the COMPILER rather than by review. There is no
 * default, no optional prop and no no-op member of {@link WorkspaceOverlayCommit}
 * — a screen that opens an overlay it has not wired does not build.
 *
 * Where the decision genuinely is not built yet, the caller says so in plain words
 * with `{ kind: "unavailable", reason }`, and the overlay's own confirm control
 * takes the shape `unavailable-destination.tsx` uses: `aria-disabled="true"`, an
 * inert handler, and the reason rendered as text the control points at with
 * `aria-describedby` — never hidden in a `title`, which a keyboard user reaches
 * only by hovering and a screen reader may never announce.
 *
 * ## The trigger itself is never the unavailable one
 *
 * This control is always live, even when its commit is `unavailable`. Opening a
 * decision surface that then states plainly what cannot be recorded yet tells the
 * clinician more than a dead button on the screen behind it, and the two shapes
 * are not interchangeable: a screen with no overlay to raise at all should render
 * `UnavailableDestination`, not this.
 */
export type WorkspaceOverlayTriggerProps = {
  /** An id from the frozen 24-row table. An id that names no row throws at render. */
  overlayId: string;
  /** What confirming the overlay's decision does. REQUIRED — see above. */
  commit: WorkspaceOverlayCommit;
  /** The control's visible label, and therefore its accessible name. */
  children: ReactNode;
  className?: string;
};

export function WorkspaceOverlayTrigger({ overlayId, commit, children, className }: WorkspaceOverlayTriggerProps) {
  /**
   * An unknown id fails here, loudly, in every environment.
   *
   * The alternative is worse than an error page: `overlayDefinition` returns null
   * for an id no row carries, the host renders nothing for it, and the control
   * becomes a button that opens an empty overlay — silent, and exactly the class
   * of defect this component's own contract forbids. A render-time throw lands on
   * `src/app/caring-contacts/error.tsx`, which says plainly that nothing was sent
   * and nothing was changed; that is a true statement and the conservative
   * outcome. `blockReasonWording` in `overlay-host.tsx` throws in every
   * environment for the same reason, and this follows it rather than inventing a
   * second policy.
   *
   * At render rather than on click, so a mistyped id is a failure the screen
   * cannot ship with, not one waiting for a clinician to find.
   */
  if (overlayDefinition(overlayId) === null) {
    throw new Error(
      `No overlay is defined for the id "${overlayId}". The 24 rows are frozen in ` +
        `overlays/definitions.ts, transcribed from docs/caring-contacts/interaction-matrix.md. ` +
        `A trigger for an id no row carries would open nothing.`,
    );
  }

  return (
    <button
      type="button"
      data-testid="workspace-overlay-trigger"
      data-overlay-trigger={overlayId}
      onClick={() => openWorkspaceOverlayWithCommit(overlayId, commit)}
      className={cn(
        // `min-h-tap` is the design system's ONE tap knob (`--spacing-tap`, 3rem
        // = 48px). Never a copy of the number, and never the 44px step: production
        // tap targets are 48px here, and reducing them to satisfy generic WCAG
        // 2.5.5 guidance reintroduces a known `ui-smoke` sub-pixel flake.
        "inline-flex min-h-tap min-w-0 items-center justify-center gap-2 rounded-[var(--radius-md)] text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] motion-reduce:transition-none forced-colors:border",
        className,
      )}
    >
      {children}
    </button>
  );
}
