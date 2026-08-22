"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  cn,
  controlBase,
  floatingControl,
  ignoreUnavailableActivation,
  primaryControl,
} from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";

import { widthStateFor } from "../width-state";
import {
  overlayDefinition,
  type OverlayDesktopModality,
  type OverlayDismissal,
  type OverlayPhoneModality,
  type WorkspaceOverlayDefinition,
} from "./definitions";

/**
 * ONE renderer for all twenty-four workspace overlays.
 *
 * Rule 1 of the Task 18 contract: modality comes from the frozen table in
 * `./definitions.ts`, never from a per-overlay component. There is no switch on
 * an overlay id anywhere in this file — every branch below is a branch on a
 * MODALITY, of which there are four, and the branch a given overlay takes is
 * read off the table at render time. That is what makes the twenty-four rows
 * data rather than code, and it is what lets Task 19 prove all of them in a
 * browser against the same table this file reads.
 *
 * This is a Client Component, and deliberately the smallest one that can be. The
 * shell's service-wide safety-stop record must never reach here: its incident
 * note is free text a responder typed mid-incident, and a client boundary
 * serialises its props into the payload the browser can read. `blockReason` is a
 * NAMED refusal string, not that record and not any part of it, precisely so this
 * boundary can exist at all. The allowlist and its three conditions are in
 * `tests/caring-contacts-explained-automation.dom.test.tsx` (Ruling 59), and that
 * guard reads this file's source text — which is why the record's own module and
 * type names are described here rather than written.
 */

export type OverlayHostProps = {
  openOverlayId: string | null;
  onClose: () => void;
  onCommit: (definition: WorkspaceOverlayDefinition) => void;
  /** A named permission/connectivity refusal, or null. Never the safety-stop record, or any part of it. */
  blockReason: string | null;
};

type OverlayModality = OverlayPhoneModality | OverlayDesktopModality;
type SheetModality = Exclude<OverlayModality, "status-banner">;

/**
 * How each Sheet-borne modality is expressed through the shared `Sheet`, in one
 * table rather than scattered through the render.
 *
 * `full-screen-stage` and `session-gate` both take `fullscreen`: on a phone the
 * gate must own the whole screen, and `fullscreen` also suppresses the Sheet's
 * drag grip, which would otherwise advertise a swipe-to-dismiss the gate does
 * not honour. `inspection-drawer` takes right-edge geometry; it occurs only as a
 * desktop modality (its phone counterpart in the table is `full-screen-stage`),
 * so that fixed right placement is never asked to behave like a phone sheet.
 */
const SHEET_GEOMETRY: Record<
  SheetModality,
  { placement: "default" | "right"; mobilePlacement: "bottom" | "fullscreen" }
> = {
  "bottom-sheet": { placement: "default", mobilePlacement: "bottom" },
  dialog: { placement: "default", mobilePlacement: "bottom" },
  "full-screen-stage": { placement: "default", mobilePlacement: "fullscreen" },
  "inspection-drawer": { placement: "right", mobilePlacement: "bottom" },
  "session-gate": { placement: "default", mobilePlacement: "fullscreen" },
};

function subscribeToViewportWidth(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange);
  return () => window.removeEventListener("resize", onStoreChange);
}

function readViewportWidth() {
  return window.innerWidth;
}

/** No width is knowable on the server, so no modality is either — render nothing. */
function noViewportWidth() {
  return null;
}

function useViewportWidth(): number | null {
  return useSyncExternalStore(subscribeToViewportWidth, readViewportWidth, noViewportWidth);
}

/**
 * Rule 2: the shared four-state mapping decides, and nothing here re-derives a
 * breakpoint. A second `matchMedia` copy of 768 is exactly how the layout and
 * the overlays would drift apart without anybody noticing.
 */
function modalityFor(definition: WorkspaceOverlayDefinition, viewportWidth: number): OverlayModality {
  return widthStateFor(viewportWidth) === "compact" ? definition.phoneModality : definition.desktopModality;
}

/**
 * Whether Escape and a backdrop click dismiss this overlay.
 *
 * The frozen matrix produces exactly two dismissal values (Ruling 58). The third
 * union member, `action-only`, is reserved and unreachable, and an unrecognised
 * value must NOT fall through to the permissive branch: silently treating an
 * unknown dismissal as escape-closable would let a future row that means "the
 * user must not be able to walk away from this" behave as though they could. So
 * it throws where a developer will see it, and degrades to the conservative
 * (non-dismissible) answer in production, where the recovery action is still on
 * screen.
 */
function dismissesOnEscapeOrBackdrop(dismissal: OverlayDismissal): boolean {
  if (dismissal === "escape-backdrop-close") return true;
  if (dismissal === "recovery-only") return false;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      `Unrecognised overlay dismissal "${dismissal}". The frozen matrix expresses only ` +
        `"escape-backdrop-close" and "recovery-only"; "action-only" is reserved and unreachable ` +
        `(Ruling 58). Decide the behaviour against docs/caring-contacts/interaction-matrix.md ` +
        `rather than defaulting it here.`,
    );
  }
  return false;
}

function actionClassFor(tone: WorkspaceOverlayDefinition["tone"]) {
  if (tone === "danger") {
    return cn(
      controlBase,
      "border border-[color:var(--danger-border)] bg-[color:var(--danger-soft)] px-5 text-[color:var(--danger)]",
    );
  }
  return tone === "primary" ? primaryControl : floatingControl;
}

function noop() {}

type OverlayBodyProps = {
  definition: WorkspaceOverlayDefinition;
  modality: OverlayModality;
  /** Rendered as the overlay's own heading when the surface carries no Sheet header. */
  headingId: string | null;
  blockReason: string | null;
  checkpointOpen: boolean;
  onActivate: () => void;
};

/**
 * The one body every overlay renders, whatever surface carries it.
 *
 * The three data attributes are the contract Task 19 asserts against in a real
 * browser, which is why they are stamped from the definition rather than from
 * anything this component decided for itself.
 */
function OverlayBody({ definition, modality, headingId, blockReason, checkpointOpen, onActivate }: OverlayBodyProps) {
  // Rule 9, and both halves of it: a mutating overlay's action is refused with
  // the named reason visible, and a read-only overlay stays fully usable —
  // blocking a preview nobody can change would be the same defect pointing the
  // other way. `mutatesState` is read from the table, never re-decided here.
  const blocked = blockReason !== null && definition.mutatesState;
  const reasonId = `caring-contacts-overlay-${definition.id}-reason`;
  return (
    <div
      data-testid="workspace-overlay-content"
      data-overlay-id={definition.id}
      data-overlay-modality={modality}
      data-overlay-dismissal={definition.dismissal}
      className="flex min-w-0 flex-col gap-4"
    >
      {headingId ? (
        <h2 id={headingId} className="text-base font-semibold text-[color:var(--text-heading)]">
          {definition.title}
        </h2>
      ) : null}
      <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">{definition.summary}</p>

      {checkpointOpen ? (
        <p className="max-w-[var(--measure)] rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-3 text-sm leading-6 text-[color:var(--text)]">
          Fresh authentication checkpoint. Confirm who you are before this is recorded. Nothing has changed yet.
        </p>
      ) : null}

      {blocked ? (
        <p id={reasonId} className="max-w-[var(--measure)] text-sm font-medium leading-6 text-[color:var(--danger)]">
          This action is unavailable. The reason given is {blockReason}.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-disabled={blocked ? "true" : undefined}
          aria-describedby={blocked ? reasonId : undefined}
          onClick={blocked ? ignoreUnavailableActivation : onActivate}
          className={actionClassFor(definition.tone)}
        >
          {checkpointOpen ? "Confirm and continue" : definition.decision}
          {/*
            The decision text alone is ambiguous out of context — "Continue and
            confirm who you are" reads identically on withdrawal and on
            reassignment. Naming the overlay keeps the control's purpose
            available from its accessible name (WCAG 2.4.6) without repeating the
            heading on screen.
          */}
          <span className="sr-only"> ({definition.label})</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Rule 4: `status-banner` is NOT a dialog. It portals to the document body as a
 * live region, takes no focus, traps none, and offers its recovery action in
 * place. Anything that made it modal would let a connectivity notice block the
 * screen it is only reporting on.
 */
function StatusBannerSurface({ children }: { children: ReactNode }) {
  return createPortal(
    <div
      role="status"
      data-testid="workspace-overlay-status-banner"
      className="fixed inset-x-0 bottom-0 z-[var(--z-toast)] border-t border-[color:var(--border)] bg-[color:var(--surface-chrome)] px-4 pb-[var(--safe-area-bottom)] pt-4 shadow-[var(--shadow-elevated)] sm:px-6 forced-colors:bg-[Canvas]"
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </div>,
    document.body,
  );
}

export function OverlayHost({ openOverlayId, onClose, onCommit, blockReason }: OverlayHostProps) {
  const viewportWidth = useViewportWidth();
  const [checkpoint, setCheckpoint] = useState<{ id: string } | null>(null);
  /**
   * The control the overlay was opened from, handed to the Sheet as
   * `returnFocusRef` (rule 6).
   *
   * The timing is the whole trick, and it survives on a detail of the shared
   * Sheet rather than on luck: the Sheet's open-focus controller moves focus
   * inside a `requestAnimationFrame`, and this effect runs on commit — before
   * that frame — so `document.activeElement` is still the opener when it is
   * read. Capturing during render would be earlier still, but reading or writing
   * a ref there is what `react-hooks/refs` forbids, and it is right to: it is
   * invisible to the compiler's reasoning about what a render depends on.
   */
  const openedFromRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (openOverlayId === null) return;
    openedFromRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [openOverlayId]);

  // Adjusting state while a prop changes, the documented React way: a checkpoint
  // raised for one overlay must never be inherited by the next one opened.
  if (checkpoint !== null && checkpoint.id !== openOverlayId) setCheckpoint(null);

  const definition = openOverlayId === null ? null : overlayDefinition(openOverlayId);
  const checkpointOpen =
    definition !== null && definition.requiresFreshAuthentication && checkpoint?.id === definition.id;

  /**
   * Rule 8: an overlay the table marks `requiresFreshAuthentication` commits
   * only on the SECOND activation. The first raises a visible checkpoint and
   * commits nothing — which is the whole point, so it is an early return rather
   * than a flag threaded through a commit path.
   */
  const activate = useCallback(() => {
    if (definition === null) return;
    if (definition.requiresFreshAuthentication && checkpoint?.id !== definition.id) {
      setCheckpoint({ id: definition.id });
      return;
    }
    onCommit(definition);
  }, [checkpoint, definition, onCommit]);

  /**
   * Nothing is knowable about the modality without a width, and a width is a
   * browser fact — so the server renders nothing and the first client render
   * agrees with it. An unknown `?overlay=` value lands here too: a bad URL, not
   * a defect.
   *
   * The closed Sheet stays MOUNTED rather than being replaced by `null`. It
   * renders no DOM while closed, but the shared Sheet restores focus from its
   * open-effect cleanup and skips that work when it is unmounting — so a host
   * that vanished the instant the overlay closed would drop focus on the floor
   * instead of returning it to the control that opened it.
   */
  if (viewportWidth === null || definition === null) {
    return (
      <Sheet open={false} title="" onClose={onClose}>
        {null}
      </Sheet>
    );
  }

  const modality = modalityFor(definition, viewportWidth);
  const dismissible = dismissesOnEscapeOrBackdrop(definition.dismissal);
  const headingId = `caring-contacts-overlay-${definition.id}-title`;

  const body = (
    <OverlayBody
      definition={definition}
      modality={modality}
      // A Sheet header already renders the title; the surfaces without one carry
      // their heading in the body and name the dialog through it.
      headingId={modality === "status-banner" || !dismissible ? headingId : null}
      blockReason={blockReason}
      checkpointOpen={checkpointOpen}
      onActivate={activate}
    />
  );

  if (modality === "status-banner") {
    return <StatusBannerSurface>{body}</StatusBannerSurface>;
  }

  const geometry = SHEET_GEOMETRY[modality];
  return (
    <Sheet
      open
      // Rule 5: a `recovery-only` overlay ignores Escape and the backdrop. The
      // shared Sheet routes both through `onClose`, so withholding the handler
      // is the whole of it — and with no `title` the Sheet renders no header, so
      // no close control contradicts "recovery action only" either.
      onClose={dismissible ? onClose : noop}
      title={dismissible ? definition.title : ""}
      labelledBy={dismissible ? undefined : headingId}
      returnFocusRef={openedFromRef}
      placement={geometry.placement}
      mobilePlacement={geometry.mobilePlacement}
      testId="workspace-overlay-sheet"
      id={`caring-contacts-overlay-${definition.id}`}
    >
      {body}
    </Sheet>
  );
}
