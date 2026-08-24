import { FolderOpen, SearchX } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One shared way of saying "this list has nothing in it", for the four Phase 2B
 * list screens (patients, schedule, templates, team) that would otherwise each
 * invent their own.
 *
 * There are exactly two reasons a list can be empty, and they read as opposite
 * facts to a clinician, so the component refuses to blur them into one shape:
 *
 *  - `"no-data"` — nothing exists yet. The list is genuinely empty.
 *  - `"filtered"` — records exist, but the current filter or search is hiding
 *    all of them. A `"filtered"` empty list that only says "Nothing to show" is
 *    indistinguishable from `"no-data"` and invites a clinician to conclude a
 *    caseload is empty when it is not — which is the defect this component
 *    exists to prevent. So the `"filtered"` branch cannot be built without
 *    stating a `because` and a `changedBy`; there is no shared optional field
 *    that a caller could simply leave out.
 *
 * The `"filtered"` branch reuses `AutomatedState`'s "Why: … / What changes it:
 * …" wording shape, so a clinician learns one pattern across the workspace —
 * but this is its own component. Ruling 81: `EmptyState` does not render
 * `AutomatedState` internally. The two have different triggers (the system
 * acting on its own, versus a user's own filter or simply nothing existing
 * yet) and `AutomatedState`'s `CircleAlert` icon and state-name `aria-label`
 * are both wrong for "no patients yet", so this component carries its own
 * icon pair and never labels itself as a named state.
 *
 * A Server Component with no hooks, deliberately (Ruling 13): every one of the
 * four list screens renders this on first paint, so a hook here would put a
 * client boundary under all four instead of none. The optional `action` is
 * therefore never built from raw `onClick`/`href` props — it is a fully-formed
 * node the caller already built (a `<Link>`, a form-submit button, or an
 * `UnavailableDestination`), the same way `ServiceStateBanner` — also a Server
 * Component — hosts `UnavailableDestination` as a child without becoming a
 * Client Component itself. If a caller wants an action that is not yet
 * available, `UnavailableDestination` is still the tool for that; this
 * component does not build a second disabled-control pattern to compete with
 * it.
 */
export type EmptyStateAction = ReactNode;

export type EmptyStateNoDataProps = {
  kind: "no-data";
  /** Sentence-case heading naming what is empty, e.g. "No patients yet". */
  heading: string;
  /** Plain-words statement that the list is genuinely empty, and how a first record arrives. */
  explanation: string;
  /** At most one already-built control — a `<Link>`, a form-submit button, or an `UnavailableDestination`. */
  action?: EmptyStateAction;
};

export type EmptyStateFilteredProps = {
  kind: "filtered";
  /** Sentence-case heading naming what the filter hid, e.g. "No patients match". */
  heading: string;
  /** Plain-words reason the current filter or search is hiding every record. */
  because: string;
  /** Plain-words statement of what would change it — clear the filter, widen the search. */
  changedBy: string;
  /** At most one already-built control — a `<Link>`, a form-submit button, or an `UnavailableDestination`. */
  action?: EmptyStateAction;
};

export type EmptyStateProps = EmptyStateNoDataProps | EmptyStateFilteredProps;

export function EmptyState(props: EmptyStateProps) {
  // Two different icons, not one reused across both kinds: the icon is part of
  // what states the difference wordlessly, matching the "words and an icon,
  // never colour alone" rule this file inherits from `automated-state.tsx`.
  const Icon = props.kind === "no-data" ? FolderOpen : SearchX;

  return (
    <div className="flex min-w-0 flex-col items-start gap-2 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-4 py-6 forced-colors:border-[CanvasText]">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text-heading)]">
        <Icon aria-hidden="true" className="size-icon-md shrink-0" />
        <span className="min-w-0">{props.heading}</span>
      </p>
      {props.kind === "no-data" ? (
        <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">{props.explanation}</p>
      ) : (
        <>
          <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">Why: </span>
            {props.because}
          </p>
          <p className="max-w-[var(--measure)] text-sm leading-6 text-[color:var(--text-muted)]">
            <span className="font-medium text-[color:var(--text)]">What changes it: </span>
            {props.changedBy}
          </p>
        </>
      )}
      {props.action ? <div className="mt-1">{props.action}</div> : null}
    </div>
  );
}
