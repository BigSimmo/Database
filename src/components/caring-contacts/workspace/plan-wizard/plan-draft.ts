// src/components/caring-contacts/workspace/plan-wizard/plan-draft.ts
//
// The half-finished sign-up, held in the browser so that a page refresh does not lose it.
//
// THE OWNER DECIDED THIS ON 2026-08-25, KNOWING THE COST (Ruling [110]). A coordinator part-way
// through signing a patient up must not lose what they typed to a refresh, and what they typed
// includes — at stage 3, which Task 8 builds against this module — the patient's name and mobile
// number. Keeping that across a refresh means writing it to storage on the clinician's machine,
// which in practice is a shared ward computer. The owner was asked twice, the second time with
// that exposure named in those words, and chose it. This module implements it; it does not
// re-open it.
//
// WHY `sessionStorage` AND NOTHING ELSE. `localStorage` outlives the tab, so a draft written there
// would leave a patient's details on a ward machine indefinitely, for whoever sits down next. The
// owner chose tab lifetime. The distinction is enforced HERE, by this module being the only place
// in the wizard that touches a storage API at all and by naming exactly one of them — a comment
// promising tab lifetime is not an enforcement, and `tests/caring-contacts-plan-draft.dom.test.tsx`
// scans this whole directory for the other name so that a later edit cannot quietly widen it.
//
// THREE WAYS THE DRAFT GOES AWAY, and the tab closing is only one of them:
//
//   1. the tab closes — `sessionStorage`'s own lifetime, which is why it was chosen;
//   2. `clearPlanDraft()` on successful activation — Task 9 calls this the moment the plan is
//      created, and it is the one seam this module leaves that task;
//   3. `clearPlanDraft()` on abandoning the flow — the wizard's own discard control. Relying on
//      the tab closing alone means a clinician who finishes and walks away leaves the previous
//      patient's details for the next person at that machine, which is the failure the whole
//      ruling exists to prevent.
//
// A fourth is a consequence rather than a rule: reading a draft that belongs to a DIFFERENT
// referral removes it. One key holds one draft, so starting a second sign-up cannot leave the
// first one's answers sitting in storage unreferenced.
//
// EVERY FAILURE IS SILENT AND EMPTY-HANDED. A browser that refuses storage (private modes, a
// disabled-storage policy, a full quota) must not break a clinical screen, so every entry point
// here degrades to "there is no draft" rather than throwing. The wizard asks
// `planDraftStorageAvailable()` and tells the clinician which of the two is true, because a notice
// promising the page will remember is false when the browser refused.
import { isPlanWizardStage, type PlanWizardStage } from "./stages";

/**
 * The one key. Deliberately ONE, rather than one per referral:
 *
 *   * a single key is a single thing to clear, so "cleared on abandoning" is provable rather than
 *     a sweep over keys that a later stage could add to and forget;
 *   * a per-referral key would put a referral id in a storage key. A referral id in a URL is
 *     acceptable (Ruling [111]) and this would probably be too, but the draft it keys holds the
 *     patient's name and mobile number from stage 3 onward, and a key is the part of storage that
 *     is enumerable without reading the value.
 *
 * The referral the draft belongs to travels INSIDE the value instead, where `readPlanDraft` checks
 * it.
 */
export const PLAN_DRAFT_STORAGE_KEY = "caring-contacts:plan-draft";

/**
 * The coordinator's own confirmations at stage 1.
 *
 * Ruling [112]: these are NOT imported facts. A `Referral` is five fields and carries neither a
 * patient's name nor a mobile number, so nothing about the patient's agreement or their phone can
 * be read from one. They are what the coordinator says, in this session, and the screen says so.
 *
 * They are also NOT RECORDED ANYWHERE. `createPlanSchema` has no field for either, so a draft is
 * the only place they exist and a draft is not durable — see the report for Task 7, which raises
 * this rather than inventing a storage location for it.
 */
export type PlanDraftAssurances = {
  /** The patient agreed to receive caring contacts. Not consent to treatment, and not legal consent. */
  patientAgreed: boolean;
  /** The mobile number this plan will use is the patient's own, and they are content to receive text on it. */
  mobileIsPatientControlled: boolean;
};

/**
 * What the wizard holds between stages.
 *
 * Stages 3 and 4 add their own fields here — the patient's detail, the discharge instant, the
 * sending preference, the first-contact date and its reason. Adding them is additive: `parseDraft`
 * below validates field by field and treats anything it does not recognise as an unusable draft,
 * so an older stored draft is discarded rather than half-read.
 */
export type PlanDraft = {
  /** Which accepted referral this sign-up is for. Checked on read; never a patient identifier. */
  referralId: string;
  stage: PlanWizardStage;
  assurances: PlanDraftAssurances;
  /** The pathway version this plan will run, or null while nothing has been chosen. */
  pathwayVersionId: string | null;
};

/**
 * A fresh draft for one referral.
 *
 * `pathwayVersionId` starts at whatever the referral already names (Ruling [113]) rather than at
 * null: an accepted referral can carry a pathway chosen by whoever accepted it, and starting from
 * an empty choice would present that decision as though it had never been made.
 */
export function emptyPlanDraft(referralId: string, pathwayVersionId: string | null): PlanDraft {
  return {
    referralId,
    stage: "agreement",
    assurances: { patientAgreed: false, mobileIsPatientControlled: false },
    pathwayVersionId,
  };
}

/**
 * The tab-scoped store, or null when this browser will not give one.
 *
 * `window.sessionStorage` is the ONLY storage API named in this module, and the only one this
 * directory may name at all. Accessing it throws outright in some privacy configurations, so even
 * the access is guarded.
 */
function tabScopedStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Whether a draft can be kept at all. The wizard states which answer it got, in place. */
export function planDraftStorageAvailable(): boolean {
  return tabScopedStorage() !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A stored value turned back into a draft, or null.
 *
 * Every field is checked. A draft that fails any check is not repaired and not partly used: half a
 * clinician's answers, with the other half silently defaulted, is worse than asking them again.
 */
function parseDraft(raw: string): PlanDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const { referralId, stage, assurances, pathwayVersionId } = parsed;
  if (typeof referralId !== "string" || referralId === "") return null;
  if (!isPlanWizardStage(stage)) return null;
  if (!isRecord(assurances)) return null;
  if (typeof assurances.patientAgreed !== "boolean") return null;
  if (typeof assurances.mobileIsPatientControlled !== "boolean") return null;
  if (pathwayVersionId !== null && typeof pathwayVersionId !== "string") return null;

  return {
    referralId,
    stage,
    assurances: {
      patientAgreed: assurances.patientAgreed,
      mobileIsPatientControlled: assurances.mobileIsPatientControlled,
    },
    pathwayVersionId,
  };
}

/**
 * The draft held for `referralId`, or null.
 *
 * A stored draft belonging to a different referral is REMOVED rather than ignored. Ignoring it
 * would leave one coordinator's answers — and, from stage 3, one patient's name and number — in
 * storage for the rest of the tab's life, referenced by nothing.
 */
export function readPlanDraft(referralId: string): PlanDraft | null {
  const storage = tabScopedStorage();
  if (storage === null) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(PLAN_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const draft = parseDraft(raw);
  if (draft === null || draft.referralId !== referralId) {
    clearPlanDraft();
    return null;
  }
  return draft;
}

/** Whether the draft was actually written down. The wizard's notice states which answer it got. */
export function writePlanDraft(draft: PlanDraft): boolean {
  const storage = tabScopedStorage();
  if (storage === null) return false;
  try {
    storage.setItem(PLAN_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes the draft.
 *
 * THE SEAM TASK 9 MUST CALL. A plan that has just been activated has taken everything the draft
 * held; leaving it behind means the next person at that machine, in that tab, finds the previous
 * patient's details. Call this the moment `createPlan` returns success, before anything navigates.
 *
 * Also what the wizard's discard control calls, and what `readPlanDraft` calls when the stored
 * draft belongs to another referral.
 */
export function clearPlanDraft(): void {
  const storage = tabScopedStorage();
  if (storage === null) return;
  try {
    storage.removeItem(PLAN_DRAFT_STORAGE_KEY);
  } catch {
    // Nothing to recover and nothing to tell the clinician that the notice does not already say.
  }
}
