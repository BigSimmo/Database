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
import { SENDING_PREFERENCES, type SendingPreference } from "@/lib/caring-contacts/model";

import { EMPTY_PLAN_PATIENT_DETAIL, type PlanPatientDetailDraft } from "./patient-detail";
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
 * `parseDraft` below validates field by field and treats anything it does not fully recognise as
 * an unusable draft, so a draft stored by an earlier build is discarded rather than half-read.
 * A field added to this type and NOT to that parser is silently dropped on every reload.
 *
 * STAGE 3'S FIELDS ARE THE ONES THIS WHOLE MODULE'S CAUTION IS ABOUT. `patientDetail` holds a
 * patient's name and mobile number, on what in practice is a shared ward computer. Everything in
 * Ruling [110] — one key, tab lifetime, cleared on both exits, and the notice that says so in
 * plain words — exists for this field rather than for a pair of checkboxes.
 */
export type PlanDraft = {
  /** Which accepted referral this sign-up is for. Checked on read; never a patient identifier. */
  referralId: string;
  stage: PlanWizardStage;
  assurances: PlanDraftAssurances;
  /** The pathway version this plan will run, or null while nothing has been chosen. */
  pathwayVersionId: string | null;
  /** Stage 3's typed values, as typed. See `patient-detail.ts` for why they are held verbatim. */
  patientDetail: PlanPatientDetailDraft;
  /**
   * When in the day every contact in this plan goes out, or null while nothing has been chosen.
   *
   * Null rather than a default. Nothing in this domain carries a sending preference, so defaulting
   * to "morning" would decide when a discharged patient hears from the service and then present
   * that decision as the coordinator's. Stage 2's pathway starts filled only because a referral
   * genuinely does carry one (Ruling [113]).
   */
  sendingPreference: SendingPreference | null;
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
    patientDetail: { ...EMPTY_PLAN_PATIENT_DETAIL },
    sendingPreference: null,
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

/*
 * THE DRAFT IS AN EXTERNAL STORE, AND THE WIZARD SUBSCRIBES TO IT.
 *
 * The obvious shape was React state plus a `useEffect` that restored the draft after mount. It was
 * written that way first and `react-hooks/set-state-in-effect` rejected it, correctly: an effect
 * that immediately sets state causes a cascading render, and the rule's own advice is to subscribe
 * to the external system instead. The deeper reason is the one that matters here, though — a lazy
 * `useState` initialiser reading `sessionStorage` would have produced a HYDRATION MISMATCH, because
 * the server render cannot see the browser's storage and the client's first render can. On this
 * screen the mismatch would have been about a patient's details.
 *
 * `useSyncExternalStore` is built for exactly that: `planDraftServerSnapshot` answers null on the
 * server and during hydration, and the real snapshot arrives in the commit that follows. So the
 * three functions below are the store's subscribe/getSnapshot/getServerSnapshot, and the rules a
 * snapshot must obey shape them:
 *
 *   * IT MUST BE REFERENTIALLY STABLE while nothing has changed. Parsing the stored JSON on every
 *     call would return a new object each time and spin React forever, so the parse is cached
 *     against the raw string it came from.
 *   * IT MUST BE PURE. No clearing, no writing, no repair — `readPlanDraft` still does the
 *     referral-mismatch clearing, and the wizard calls that from an effect where a side effect is
 *     legitimate.
 *
 * WHEN THE BROWSER REFUSES STORAGE the draft lives in `memoryDraft` instead. Without it a clinician
 * in a private window could not tick a checkbox at all: every write would go nowhere, the snapshot
 * would stay null, and the screen would never change. It lasts as long as the page does, which is
 * strictly less exposure than `sessionStorage`, and the notice says so.
 *
 * A browser refuses in TWO shapes, and they are not equally likely. Reaching `window.sessionStorage`
 * can throw outright, which is the rare configuration; far commoner — and what Safari private
 * browsing does — is a storage object that exists and whose `setItem` throws. Both land in
 * `memoryDraft`, and `planDraftSnapshot` reads it before it reads storage so that both are actually
 * reachable. Round 1 finding I-1 was that only the first shape worked.
 */
type PlanDraftListener = () => void;

const listeners = new Set<PlanDraftListener>();

/** The draft when this browser will not keep one. Page lifetime, not tab lifetime. */
let memoryDraft: PlanDraft | null = null;

/** The last raw string read, and what it parsed to — the referential stability the snapshot needs. */
let cachedRaw: string | null = null;
let cachedDraft: PlanDraft | null = null;

function notifyPlanDraftListeners(): void {
  for (const listener of [...listeners]) listener();
}

export function subscribeToPlanDraft(listener: PlanDraftListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function rawDraft(storage: Storage): string | null {
  try {
    return storage.getItem(PLAN_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The draft as it stands, cached so repeated calls return the same object. Pure.
 *
 * `memoryDraft` IS CONSULTED FIRST, and the order is the whole point. Review round 1, finding I-1:
 * this used to reach for memory only when `tabScopedStorage()` returned null — the browser that
 * refuses even to hand over the object. But the commoner refusal, and the one Safari private
 * browsing actually performs, is a storage object that EXISTS and whose `setItem` throws. In that
 * shape the old order re-read the empty store, returned null, and the screen never changed: every
 * tick was written to memory that nothing ever read. That is the exact dead end the fallback was
 * added to prevent, so the fallback has to be reachable from the case it exists for.
 *
 * `memoryDraft` is non-null only while the last write failed to land in storage — a successful
 * write and `clearPlanDraft` both null it — so preferring it can never shadow a newer stored draft.
 */
export function planDraftSnapshot(): PlanDraft | null {
  if (memoryDraft !== null) return memoryDraft;

  const storage = tabScopedStorage();
  if (storage === null) return null;

  const raw = rawDraft(storage);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDraft = raw === null ? null : parseDraft(raw);
  }
  return cachedDraft;
}

/**
 * Whether this browser is actually keeping the draft.
 *
 * Not the same question as `planDraftStorageAvailable()`. Storage can exist and still refuse a
 * write — a full quota, a policy — in which case the draft is in memory and will not survive a
 * reload. The notice must say which of those is true, so it asks this rather than inferring it.
 */
export function planDraftIsHeld(): boolean {
  return tabScopedStorage() !== null && memoryDraft === null;
}

/** Null on the server and through hydration: the server cannot see a browser's storage. */
export function planDraftServerSnapshot(): PlanDraft | null {
  return null;
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

  const { referralId, stage, assurances, pathwayVersionId, patientDetail, sendingPreference } = parsed;
  if (typeof referralId !== "string" || referralId === "") return null;
  if (!isPlanWizardStage(stage)) return null;
  if (!isRecord(assurances)) return null;
  if (typeof assurances.patientAgreed !== "boolean") return null;
  if (typeof assurances.mobileIsPatientControlled !== "boolean") return null;
  if (pathwayVersionId !== null && typeof pathwayVersionId !== "string") return null;
  const detail = parsePatientDetail(patientDetail);
  if (detail === null) return null;
  if (sendingPreference !== null && !isSendingPreference(sendingPreference)) return null;

  return {
    referralId,
    stage,
    assurances: {
      patientAgreed: assurances.patientAgreed,
      mobileIsPatientControlled: assurances.mobileIsPatientControlled,
    },
    pathwayVersionId,
    patientDetail: detail,
    sendingPreference,
  };
}

/**
 * Stage 3's four fields, or null if any is missing or the wrong type.
 *
 * Every field is REQUIRED to be present as a string, including the two that may legitimately be
 * empty. A draft written before stage 3 existed carries none of them, and reading it as "the
 * clinician typed nothing" would be a guess about a record this module cannot see the age of. The
 * module's own rule applies: half a clinician's answers with the other half silently defaulted is
 * worse than asking again.
 */
function parsePatientDetail(value: unknown): PlanPatientDetailDraft | null {
  if (!isRecord(value)) return null;
  const { patientName, patientMobileNumber, patientIdentifiers, culturalIdentity } = value;
  if (typeof patientName !== "string") return null;
  if (typeof patientMobileNumber !== "string") return null;
  if (typeof patientIdentifiers !== "string") return null;
  if (typeof culturalIdentity !== "string") return null;
  return { patientName, patientMobileNumber, patientIdentifiers, culturalIdentity };
}

/**
 * Whether a stored value is one of the three approved sending preferences.
 *
 * Checked against the sealed domain's own `SENDING_PREFERENCES` rather than a list written out
 * here. A local list would be a second copy of the union, free to go on accepting a preference the
 * domain had dropped — and the value being checked came out of a browser's storage, so it is
 * exactly the kind of value that can be older than the code reading it.
 */
function isSendingPreference(value: unknown): value is SendingPreference {
  return (SENDING_PREFERENCES as readonly string[]).includes(value as string);
}

/**
 * The draft held for `referralId`, or null.
 *
 * A stored draft belonging to a different referral is REMOVED rather than ignored. Ignoring it
 * would leave one coordinator's answers — and, from stage 3, one patient's name and number — in
 * storage for the rest of the tab's life, referenced by nothing.
 */
export function readPlanDraft(referralId: string): PlanDraft | null {
  const draft = planDraftSnapshot();
  if (draft === null) {
    // Present but unreadable: an older shape, or something that was tampered with. Removed rather
    // than left sitting there — it is nobody's draft now, and it may still hold a patient's details.
    if (storageHoldsAValue()) clearPlanDraft();
    return null;
  }
  if (draft.referralId !== referralId) {
    clearPlanDraft();
    return null;
  }
  return draft;
}

function storageHoldsAValue(): boolean {
  const storage = tabScopedStorage();
  return storage !== null && rawDraft(storage) !== null;
}

/** Whether the draft was actually written down. The wizard's notice states which answer it got. */
export function writePlanDraft(draft: PlanDraft): boolean {
  const storage = tabScopedStorage();
  if (storage === null) {
    memoryDraft = draft;
    notifyPlanDraftListeners();
    return false;
  }
  const serialised = JSON.stringify(draft);
  try {
    storage.setItem(PLAN_DRAFT_STORAGE_KEY, serialised);
  } catch {
    // Storage exists but would not take this write (a full quota, a policy). The draft still has to
    // work for the rest of this page, and the notice still has to say it is not being kept.
    memoryDraft = draft;
    notifyPlanDraftListeners();
    return false;
  }
  // The cache is primed from what was just written rather than left to be re-read and re-parsed:
  // the snapshot must be referentially stable, and a fresh parse would hand React a new object.
  cachedRaw = serialised;
  cachedDraft = draft;
  memoryDraft = null;
  notifyPlanDraftListeners();
  return true;
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
  memoryDraft = null;
  cachedRaw = null;
  cachedDraft = null;
  const storage = tabScopedStorage();
  if (storage !== null) {
    try {
      storage.removeItem(PLAN_DRAFT_STORAGE_KEY);
    } catch {
      // Nothing to recover and nothing to tell the clinician that the notice does not already say.
    }
  }
  notifyPlanDraftListeners();
}
