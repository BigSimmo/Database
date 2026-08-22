"use client";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";

export type UnavailableDestinationProps = {
  /** Stable id fragment; also names the screen-reader note this control points at. */
  id: string;
  /** Sentence-case destination name, exactly as it will read once built. */
  label: string;
  /** Plain-words statement of what the destination will hold once it is built. */
  reason: string;
};

/**
 * A workspace destination that is declared but not built yet.
 *
 * `docs/wiring-conventions.md`: a control unavailable for a *stated reason*
 * carries `aria-disabled="true"` plus an inert handler, never the native
 * `disabled` attribute — native `disabled` removes the tab stop, so the stated
 * reason could never be reached by keyboard. The two attributes are never used
 * together; `eslint-rules/require-button-wiring.mjs` fails on the pair.
 *
 * This is the only client component the production workspace ships, which is
 * what keeps the route's client payload to a rounding error (Ruling 13).
 */
export function UnavailableDestination({ id, label, reason }: UnavailableDestinationProps) {
  const noteId = `caring-contacts-unavailable-${id}`;
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={noteId}
        title={`${label} — coming soon`}
        onClick={ignoreUnavailableActivation}
        className="flex min-h-tap w-full min-w-0 items-center rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 text-left text-sm font-medium text-[color:var(--text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] forced-colors:border"
      >
        <span className="truncate">{label}</span>
      </button>
      <span id={noteId} className="sr-only">
        {reason} This screen is not built yet.
      </span>
    </li>
  );
}
