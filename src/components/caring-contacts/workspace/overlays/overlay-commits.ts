/**
 * What confirming an overlay's decision does, and how it reaches the one host.
 *
 * ## The problem this module exists to solve
 *
 * `WorkspaceOverlays` is mounted ONCE, by the shell, as a sibling of the screen's
 * own content — not per screen. So a screen's confirm behaviour has no parent it
 * shares with the host and no prop path to it. Everything below is the record of
 * how that gap is bridged, and of the three alternatives that were rejected.
 *
 * A second constraint narrows it further, and it is easy to miss: the screens are
 * SERVER Components. A Server Component cannot pass a closure across the boundary
 * at all (Next 16, "Server and Client Components": props passed to Client
 * Components must be serializable). So "the screen's handler" can only ever be a
 * serialisable value — which is why {@link WorkspaceOverlayCommit} is a
 * discriminated union of intents rather than a bare function type. Its `record`
 * member is a function POSITION, satisfied from a Server Component by a Server
 * Action and from a Client Component by an ordinary function; its `unavailable`
 * member is plain data.
 *
 * ## The choice: a single-slot handoff, written at the moment of opening
 *
 * An overlay opening CARRIES ITS COMMIT WITH IT. The trigger stages the commit it
 * was given, then pushes `?overlay=<id>`; the host reads the staged commit and
 * uses it only while the staged id and the URL's id are the same overlay. One
 * slot, one open/close cycle, and an identity check that cannot be satisfied by
 * accident.
 *
 * Why a handoff rather than a registry keyed by trigger: a list screen may render
 * ten `Pause` triggers, one per row. A registry keyed by overlay id would have all
 * ten claim the same key, and every way of resolving that is worse than not
 * having the problem — throw on the second registration and a legitimate screen
 * cannot be built; last-write-wins and the "a second registration silently
 * overwrites the first" failure is back; compare handlers by identity and an
 * inline arrow re-registers on every render. Staging at the moment of activation
 * has no conflict to resolve, because exactly one control was activated.
 *
 * ## What was rejected, and why
 *
 * - **A React context provider.** Structurally impossible from a screen, not
 *   merely costly. The screen is a Server Component, so it cannot render a
 *   provider or hold context state; and `WorkspaceOverlays` is a SIBLING of
 *   `children` in the shell, so a provider rendered inside the screen would not
 *   contain the host even if the screen could render one. Making it work would
 *   mean a new client boundary wrapping the whole workspace — against Ruling 13,
 *   which holds this route's client payload to a rounding error — and the trigger
 *   would still have to write the commit into it on activation. That is this
 *   module's job, with more payload.
 *
 * - **A per-screen host.** Duplicates the renderer the shell mounts once. The
 *   shell's own comment says why it is mounted there: the interaction matrix is a
 *   workspace-wide contract, and a screen that forgot to mount the host would lose
 *   the session gate and the offline notice with it. Two hosts would also mean two
 *   subscribers to one `?overlay=` parameter, both rendering the same overlay, and
 *   `tests/ui-caring-contacts-workspace.spec.ts` asserts single occupancy of the
 *   overlay content node throughout.
 *
 * - **A registry written on mount.** Covered above; the ten-rows case kills it.
 *
 * ## The cost this design carries, stated rather than hidden
 *
 * Module-scoped mutable state is invisible coupling: nothing in a screen's source
 * shows that activating a trigger writes here. Two things pay that back, and both
 * are load-bearing rather than decorative:
 *
 *  1. The identity check. A commit staged for one overlay is never offered to a
 *     different one, so a stale slot cannot be mistaken for a wired control.
 *  2. {@link commitUnavailableReasonFor} is TOTAL. Every state of the slot maps to
 *     an answer, and two of the three answers are a refusal in plain words. An
 *     overlay reached with nothing staged — someone typed `?overlay=<id>`, or
 *     traversed forward into a spent one — refuses its own action with a stated
 *     reason instead of offering a confirm control that would record nothing.
 *     That last case is the whole point of Ruling 87: a confirm button which does
 *     nothing is the defect, and it does not stop being one because the overlay
 *     was reached by URL rather than by a control.
 */

/**
 * What a screen says confirming this overlay's decision means.
 *
 * REQUIRED wherever it appears, and required at the type level rather than by
 * review (Ruling 87). There is no default and no no-op member: a screen that
 * opens an overlay it has not wired does not compile.
 */
export type WorkspaceOverlayCommit =
  | {
      readonly kind: "record";
      /**
       * Invoked once, with the overlay's id, when the decision is confirmed —
       * after the fresh-authentication checkpoint where the frozen table asks for
       * one, because the host runs that before it calls its commit at all.
       *
       * Typed as returning `void` so a Server Action, which returns a promise, is
       * assignable (TypeScript treats a `void` return position as "any return
       * value, ignored"). The host deliberately does not await it: what a FAILED
       * recording should do to the interface — leave the overlay open, say what
       * was not written, offer a retry — is a decision that needs a real store and
       * a real screen to answer, and neither exists yet. Inventing that policy
       * here would be wording and behaviour nobody reviewed against a live
       * surface. The task that introduces the first store owns it.
       */
      readonly record: (overlayId: string) => void;
    }
  | {
      readonly kind: "unavailable";
      /**
       * Plain words a clinician reads: what this decision cannot do yet, and why.
       * Sentence case, ending in a full stop. Not an identifier and not a key —
       * this is rendered verbatim, so it is written where it is passed.
       */
      readonly reason: string;
    };

/** The commit staged by the control that opened an overlay, and which overlay it belongs to. */
export type StagedWorkspaceOverlayCommit = {
  readonly overlayId: string;
  readonly commit: WorkspaceOverlayCommit;
};

/**
 * The refusal shown when an overlay is open with nothing staged for it.
 *
 * True in every case that reaches it: a typed or pasted `?overlay=<id>`, a forward
 * traversal into an overlay whose staged commit was spent, or a slot holding a
 * different overlay's commit. It says what to do instead rather than only what is
 * wrong.
 */
export const NO_STAGED_COMMIT_REASON =
  "This was opened by address rather than from a control, so there is nothing here to carry out. Open it from the screen it belongs to.";

let staged: StagedWorkspaceOverlayCommit | null = null;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/**
 * Hands the commit to the host, for the overlay about to be opened.
 *
 * Call this BEFORE pushing `?overlay=<id>`: both writes are synchronous and React
 * batches the two store notifications into one render, so the host's first render
 * carrying the new id already carries its commit. Staging afterwards would render
 * once with the overlay open and nothing staged — which the refusal below would
 * correctly, and wrongly, describe.
 */
export function stageWorkspaceOverlayCommit(overlayId: string, commit: WorkspaceOverlayCommit) {
  staged = { overlayId, commit };
  announce();
}

/**
 * Empties the slot. Called when an overlay closes and when its decision has been
 * recorded, so a staged commit belongs to exactly one open/close cycle and cannot
 * be re-entered by a forward traversal after it was spent.
 */
export function clearStagedWorkspaceOverlayCommit() {
  if (staged === null) return;
  staged = null;
  announce();
}

export function subscribeToStagedWorkspaceOverlayCommit(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * The slot's current contents.
 *
 * Returns the stored object itself rather than a fresh one, because
 * `useSyncExternalStore` re-renders on every snapshot whose identity changed and a
 * new object per read would never stop.
 */
export function readStagedWorkspaceOverlayCommit(): StagedWorkspaceOverlayCommit | null {
  return staged;
}

/** The server never activated a control, so nothing is ever staged there. */
export function noStagedWorkspaceOverlayCommit(): StagedWorkspaceOverlayCommit | null {
  return null;
}

/**
 * The commit that belongs to the open overlay, or `null` when the slot holds
 * nothing for it.
 *
 * The identity check is the safeguard, not a formality: a slot left over from a
 * different overlay must not be offered to this one.
 */
export function commitForOpenOverlay(
  slot: StagedWorkspaceOverlayCommit | null,
  openOverlayId: string | null,
): WorkspaceOverlayCommit | null {
  if (slot === null || openOverlayId === null) return null;
  return slot.overlayId === openOverlayId ? slot.commit : null;
}

/**
 * The plain-words reason the open overlay's decision cannot be carried out, or
 * `null` when it can.
 *
 * TOTAL over the three states the slot can be in, and pure, so the rule can be
 * proved directly rather than inferred from a rendered button. Both non-null
 * answers refuse; only a staged `record` commit returns `null`.
 */
export function commitUnavailableReasonFor(commit: WorkspaceOverlayCommit | null): string | null {
  if (commit === null) return NO_STAGED_COMMIT_REASON;
  if (commit.kind === "unavailable") return commit.reason;
  return null;
}
