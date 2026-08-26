// src/components/caring-contacts/workspace/plan-wizard/overlay-guards.ts
//
// Whether one of the wizard's decision overlays may carry out its decision, asked at the moment the
// decision is CONFIRMED rather than at the moment the surface was opened.
//
// WHY THIS IS A MODULE AND NOT A CONDITION WRITTEN AT EACH TRIGGER
// ---------------------------------------------------------------
// `docs/caring-contacts/interaction-matrix.md`: "Mutation-bearing actions recheck connectivity,
// permission, authentication and version state at commit time." The failure that clause is about is
// specific and invisible: a coordinator opens a confirmation, is interrupted, and presses it twenty
// minutes later. `openWorkspaceOverlayWithCommit` stages the commit at the moment the TRIGGER is
// activated, so a commit closure that captured the draft it saw then would write that draft back
// over whatever the tab holds now -- including recreating a draft another part of the tab had
// deliberately removed, with a patient's name and mobile number in it.
//
// So the predicate is pure and lives here, and the wizard calls it TWICE with values read at two
// different moments:
//
//   * at RENDER, to decide whether the trigger's commit is `{ kind: "unavailable", reason }`. That
//     is the matrix's own guard-rejection shape and the host implements it exactly -- the decision
//     control is kept focusable, carries `aria-disabled`, and points at the named reason;
//   * inside the commit, from values read AT THAT MOMENT, so a state that changed while the overlay
//     sat open refuses there instead. A refusal at this point mutates nothing.
//
// WHAT IS DELIBERATELY NOT CHECKED HERE, AND WHY EACH ABSENCE IS A FINDING RATHER THAN AN OVERSIGHT
// ------------------------------------------------------------------------------------------------
// The matrix names four things to recheck. Two of them have no honest application to these rows,
// and inventing a check that cannot fail would be worse than not having one -- a green assertion
// about a condition nothing can change proves only that the assertion was written.
//
//   * CONNECTIVITY. Every decision in this module is a write to this tab's own storage or a
//     navigation within this application. None of them touches the network, so refusing one for
//     want of a connection would be a false statement to a clinician. The one wizard decision that
//     IS network-bound is `final-activation`, which is Task 9's: `post()` in `plan-wizard.tsx`
//     already turns a failed `fetch` into `TRANSPORT_REFUSALS.didNotReach` and keeps the draft.
//   * AUTHENTICATION. `requiresFreshAuthentication` is `true` on exactly two rows of the frozen
//     table, `withdrawal` and `reassignment`, and neither is wired here. Where it IS true,
//     `OverlayHost` owns the checkpoint and commits only on the second activation; nothing a screen
//     writes could add to that.
//
// PERMISSION is a third absence and the argument is different. `src/app/caring-contacts/plans/new/page.tsx`
// asks `canPerformCaringContactAction(actor, "claimPlan", …)` BEFORE it renders the wizard at all
// and returns `PlanStartStateNotice` instead when the answer is no. So inside this component the
// answer is a constant, and a permission recheck here would be a check that cannot fail. It is
// reported rather than written.
//
// No React, no `"use client"`, no storage and no `window`: this module is pure so the rule can be
// proved directly rather than inferred from a rendered control, and so the wizard cannot end up
// holding a second copy of it.

/**
 * A condition one of the wizard's decisions depends on.
 *
 * A closed union rather than a free string, so a row cannot declare a need nothing evaluates. Both
 * members are things that genuinely change while an overlay is open, which is the bar: a condition
 * that cannot change between opening and confirming would make its own assertion unfalsifiable.
 */
export type WizardDecisionCondition =
  /**
   * A draft for THIS referral is still held in this tab.
   *
   * It can stop being true while an overlay is open: `clearPlanDraft()` runs from the discard
   * decision, from a successful activation, and from `readPlanDraft` when the stored draft turns
   * out to belong to a different referral. A decision that records something onto the draft must
   * not recreate one that has gone.
   */
  | "a-draft-exists"
  /**
   * The browser is actually writing the draft down, rather than holding it for the life of this
   * page only.
   *
   * `plan-draft.ts` falls back to an in-memory draft when `sessionStorage` refuses a write -- which
   * is what Safari private browsing does -- and that fallback lasts as long as the page, not as
   * long as the tab. Only a decision that promises the draft will still be there AFTER leaving this
   * screen depends on it.
   */
  | "draft-survives-leaving-this-screen";

/**
 * What is true right now, read at the moment the question is asked.
 *
 * Deliberately plain booleans rather than the draft itself: the caller reads the live store and
 * answers these, so this module cannot be handed a stale object and quietly agree with it.
 */
export type WizardDecisionState = {
  /** A draft for the referral this wizard is for is in this tab now. */
  readonly draftExists: boolean;
  /** `planDraftIsHeld()` -- the draft is in the tab's storage rather than only in this page's memory. */
  readonly draftIsWrittenDown: boolean;
};

/**
 * The plain words each refusal is shown in.
 *
 * Written by hand, per condition, and rendered verbatim -- Ruling 61's rule applied one layer up.
 * There is no default branch and nothing is derived from the identifier, so a condition added to
 * the union without wording fails to compile rather than printing a plausible sentence nobody wrote.
 *
 * Each says the same three things the workspace's `StatedReason` shape says everywhere else: what
 * is true, and what would change it. Each also states that nothing was changed, because a refusal
 * arriving after a decision was confirmed is exactly the moment a clinician would assume it was.
 */
export const WIZARD_DECISION_REFUSALS: Readonly<Record<WizardDecisionCondition, string>> = Object.freeze({
  "a-draft-exists":
    "This sign-up is no longer on this computer, so there is nothing to record this against. Nothing was changed. Start the sign-up again from this team's plans.",
  "draft-survives-leaving-this-screen":
    "This browser stopped keeping the sign-up, so leaving this screen would lose what you have entered rather than keep it. Nothing was changed and nothing has been lost yet. Finish the sign-up in this tab instead.",
});

/**
 * The first condition this decision depends on that is not met, in plain words -- or null.
 *
 * TOTAL over the union, and ordered, so the sentence a clinician reads is the earliest true
 * obstacle rather than whichever check happened to be written first.
 */
export function wizardDecisionRefusal(
  needs: readonly WizardDecisionCondition[],
  state: WizardDecisionState,
): string | null {
  for (const need of needs) {
    // `Object.hasOwn`, not `WIZARD_DECISION_REFUSALS[need] === undefined`. The map is an object
    // literal, so it inherits from `Object.prototype` and `"toString"` would resolve to a FUNCTION
    // that React renders as nothing -- a control refused with an empty reason beside it. The key is
    // a closed union today, so this is belt-and-braces; `overlay-host.tsx` records why a per-lookup
    // fix does not travel between lookups, and this is the lookup at this end of it.
    if (!Object.hasOwn(WIZARD_DECISION_REFUSALS, need)) {
      throw new Error(
        `No plain-words refusal for the wizard decision condition "${need}". Add an entry to ` +
          `WIZARD_DECISION_REFUSALS deliberately; do not derive one from the identifier.`,
      );
    }
    if (!conditionIsMet(need, state)) return WIZARD_DECISION_REFUSALS[need];
  }
  return null;
}

function conditionIsMet(condition: WizardDecisionCondition, state: WizardDecisionState): boolean {
  switch (condition) {
    case "a-draft-exists":
      return state.draftExists;
    case "draft-survives-leaving-this-screen":
      return state.draftIsWrittenDown;
    default: {
      // A member added to the union and left out of this switch does not compile, which is the
      // point of the `never`: the map above would still have wording for it and the check would
      // silently pass.
      const unhandled: never = condition;
      return unhandled;
    }
  }
}

/**
 * What each of the wizard's mutating overlay rows depends on.
 *
 * Keyed by the frozen table's own overlay id, so a row wired here and a row in the matrix cannot
 * come apart silently. `change-patient` declares NOTHING, and that is a statement rather than a gap:
 * it clears the draft and leaves, and neither of those can be refused by a state this screen can
 * observe -- clearing a draft that has already gone is not a failure, and the destination is a page
 * in this application. Writing a condition for it purely so the row had one would be a check that
 * cannot fail.
 */
export const WIZARD_DECISION_CONDITIONS: Readonly<Record<string, readonly WizardDecisionCondition[]>> = Object.freeze({
  "verify-identity": Object.freeze(["a-draft-exists"] as const),
  "change-patient": Object.freeze([] as const),
  "pathway-preview": Object.freeze(["a-draft-exists"] as const),
  "communication-preference": Object.freeze(["a-draft-exists"] as const),
  "save-draft": Object.freeze(["a-draft-exists", "draft-survives-leaving-this-screen"] as const),
  "discard-changes": Object.freeze(["a-draft-exists"] as const),
});

/**
 * The conditions the named row declares.
 *
 * Throws for a row this module says nothing about, rather than returning an empty list. An empty
 * list is `change-patient`'s deliberate answer, so it cannot also be the way a typo is reported --
 * a mistyped id would otherwise wire a mutating decision with no guard at all and look identical to
 * the one row that legitimately has none.
 */
export function wizardDecisionConditions(overlayId: string): readonly WizardDecisionCondition[] {
  if (!Object.hasOwn(WIZARD_DECISION_CONDITIONS, overlayId)) {
    throw new Error(
      `The wizard declares no decision conditions for the overlay "${overlayId}". Add an entry to ` +
        `WIZARD_DECISION_CONDITIONS deliberately -- an empty list is change-patient's stated answer, ` +
        `not a default.`,
    );
  }
  return WIZARD_DECISION_CONDITIONS[overlayId];
}
