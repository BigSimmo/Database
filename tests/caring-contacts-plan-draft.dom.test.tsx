// tests/caring-contacts-plan-draft.dom.test.tsx
//
// The activation wizard's draft — the half-finished sign-up the owner decided on 2026-08-25 must
// survive a page refresh and disappear when the tab closes (Ruling [110]).
//
// WHAT THIS FILE IS FOR, AND WHY IT LEANS ON THE CLEARING RATHER THAN THE WRITING. From stage 3
// onward the draft holds a patient's name and mobile number, on what is in practice a shared ward
// computer. A test that asserts the draft is WRITTEN is not a test that it is REMOVED, and the
// removal is the half that matters: if the write breaks, a clinician retypes a form; if a clear
// breaks, a patient's details sit on a ward machine after the clinician has gone. So every one of
// the three clearing paths has its own case here, and each was proved by breaking it and watching
// this file go red — the mutation log is in the Task 7 report.
//
// It is a `.dom.` file because `sessionStorage` needs a browser environment, not because it renders
// anything.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stripSourceComments } from "./helpers/strip-source-comments";

import {
  PLAN_DRAFT_STORAGE_KEY,
  clearPlanDraft,
  emptyPlanDraft,
  planDraftIsHeld,
  planDraftSnapshot,
  planDraftStorageAvailable,
  readPlanDraft,
  writePlanDraft,
  type PlanDraft,
} from "@/components/caring-contacts/workspace/plan-wizard/plan-draft";
import { DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS } from "@/lib/caring-contacts/synthetic-contacts";

const REFERRAL = "SYN-REFERRAL-001";
const OTHER_REFERRAL = "SYN-REFERRAL-002";

/**
 * A reserved fictional patient mobile, read from the sealed domain (round 1, M-4).
 *
 * This suite used to write one of the reserved numbers out as a literal, three times over, which is
 * exactly the second copy the sibling wizard suite's own comment refuses: a literal goes on passing
 * after the reserved numbers change, and a test pinning a number nobody reserves any more pins
 * nothing. (The number is not repeated here either -- a copy in prose is still a copy.)
 */
const RESERVED_PATIENT_MOBILE = DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS[1];

const WIZARD_DIRECTORY = path.join(process.cwd(), "src", "components", "caring-contacts", "workspace", "plan-wizard");

function filledDraft(referralId = REFERRAL): PlanDraft {
  return {
    ...emptyPlanDraft(referralId, "SYN-PATHWAY-001"),
    stage: "pathway",
    assurances: { patientAgreed: true, mobileIsPatientControlled: true },
  };
}

function storedRaw(): string | null {
  return window.sessionStorage.getItem(PLAN_DRAFT_STORAGE_KEY);
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  // The store keeps module-level state (the in-memory fallback and the snapshot cache), and
  // clearing storage by hand does not touch it. Without this a test that leaves a draft in memory
  // hands it to the next one.
  clearPlanDraft();
});

afterEach(() => {
  vi.restoreAllMocks();
  clearPlanDraft();
});

/**
 * Makes this browser behave like Safari private browsing: storage exists, `setItem` throws.
 *
 * Spied on `Storage.prototype`, not on `window.sessionStorage`. jsdom's storage object is a Proxy
 * whose `get` trap answers from the prototype, so an own-property spy on the instance is simply not
 * consulted — the first attempt at this test passed with the mock installed and never called, which
 * is the "check that cannot fail" shape. `expect(setItem).toHaveBeenCalled()` below is what stops
 * that recurring silently.
 */
function refuseWrites() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("QuotaExceededError", "QuotaExceededError");
  });
}

describe("the caring-contacts plan draft — tab lifetime is enforced, not promised", () => {
  it("writes the draft to sessionStorage and leaves localStorage untouched", () => {
    expect(writePlanDraft(filledDraft())).toBe(true);

    expect(storedRaw(), "the draft was not written to sessionStorage").not.toBeNull();
    // `localStorage` outlives the tab, so a draft written there would leave a patient's details on
    // a shared ward computer indefinitely. Reading the whole store rather than one key: a widening
    // that used a different key would still be caught.
    expect(window.localStorage.length, "something was written to localStorage").toBe(0);
  });

  it("names no storage API but sessionStorage anywhere in the wizard", () => {
    // The enforcement Ruling [110] asks for is that the API cannot outlive the tab, not that a
    // comment says it will not. This scans the whole directory rather than the one module, because
    // a later stage could reach for `localStorage` directly from a component and never touch
    // `plan-draft.ts` at all.
    const files = readdirSync(WIZARD_DIRECTORY).flatMap((entry) => {
      const full = path.join(WIZARD_DIRECTORY, entry);
      return statSync(full).isFile() ? [full] : [];
    });
    expect(files.length, "the plan-wizard directory scanned to no files — update this test").toBeGreaterThan(0);

    // Comments are stripped first, and it is load-bearing rather than tidy: `plan-draft.ts`'s own
    // module note explains at length why `localStorage` is refused, and a scan that read prose
    // would report the explanation as the offence — then be "fixed" by deleting the explanation.
    // The same trap `tests/route-reachability.test.ts` records: documenting a rule is not breaking
    // it, and a check that cannot tell the two apart is a check that will be silenced.
    const offenders = files.filter((file) => stripSourceComments(readFileSync(file, "utf8")).includes("localStorage"));
    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });

  it("gives the draft back after a reload, which is the whole reason it is written down", () => {
    writePlanDraft(filledDraft());

    expect(readPlanDraft(REFERRAL)).toEqual(filledDraft());
  });

  it("clears on abandoning the flow, so a clinician who walks away leaves nothing behind", () => {
    writePlanDraft(filledDraft());
    expect(storedRaw()).not.toBeNull();

    clearPlanDraft();

    expect(storedRaw(), "the draft survived being discarded").toBeNull();
    expect(readPlanDraft(REFERRAL)).toBeNull();
  });

  it("offers ONE clearing seam, which is the one Task 9 must call on a successful activation", () => {
    // WHAT THIS PROVES, STATED EXACTLY — round 1, finding M-1. It proves the SEAM works: there is
    // one clearing function, so "cleared on activation" and "cleared on abandoning" cannot drift
    // apart into two implementations. It does NOT prove that Task 9 calls it, and it cannot: the
    // activation stage does not exist yet, so this case calls `clearPlanDraft()` directly and is
    // functionally the discard case under another name. The Task 7 report said it gave Task 9 "a
    // named, failing test to point at", which overstated it — a placeholder is not a guard, and the
    // claim has been corrected there rather than left standing.
    //
    // What DOES arm automatically when Task 9 builds the review stage is the case below.
    writePlanDraft(filledDraft());

    clearPlanDraft();

    expect(storedRaw(), "the one clearing seam left the draft on the machine").toBeNull();
  });

  it("removes a draft belonging to a different referral rather than merely ignoring it", () => {
    writePlanDraft(filledDraft(OTHER_REFERRAL));

    expect(readPlanDraft(REFERRAL), "another referral's draft was handed to this one").toBeNull();
    expect(storedRaw(), "another referral's draft was left in storage, referenced by nothing").toBeNull();
  });

  it("discards an unreadable draft rather than half-reading it", () => {
    window.sessionStorage.setItem(PLAN_DRAFT_STORAGE_KEY, "{ not json");
    expect(readPlanDraft(REFERRAL)).toBeNull();
    expect(storedRaw()).toBeNull();

    window.sessionStorage.setItem(
      PLAN_DRAFT_STORAGE_KEY,
      JSON.stringify({ referralId: REFERRAL, stage: "not-a-stage", assurances: {}, pathwayVersionId: null }),
    );
    expect(readPlanDraft(REFERRAL), "a draft naming no real stage was accepted").toBeNull();

    window.sessionStorage.setItem(
      PLAN_DRAFT_STORAGE_KEY,
      JSON.stringify({ referralId: REFERRAL, stage: "agreement", assurances: { patientAgreed: true } }),
    );
    expect(readPlanDraft(REFERRAL), "a draft missing half its assurances was accepted").toBeNull();
  });

  it("starts a fresh draft from the pathway the referral already names", () => {
    // Ruling [113]: an accepted referral can carry a pathway chosen by whoever accepted it, and a
    // draft that started from null would present that decision as though it had never been made.
    expect(emptyPlanDraft(REFERRAL, "SYN-PATHWAY-001").pathwayVersionId).toBe("SYN-PATHWAY-001");
    expect(emptyPlanDraft(REFERRAL, null).pathwayVersionId).toBeNull();
    expect(emptyPlanDraft(REFERRAL, null).assurances).toEqual({
      patientAgreed: false,
      mobileIsPatientControlled: false,
    });
    expect(emptyPlanDraft(REFERRAL, null).stage).toBe("agreement");
  });

  it("keeps the draft usable when the browser takes the object but refuses the write", () => {
    // Round 1, finding I-1, and the case is not exotic: Safari private browsing hands out a real
    // `sessionStorage` whose `setItem` throws. The earlier code reached for the in-memory fallback
    // only when the storage OBJECT was unavailable, so in this shape every tick was written to a
    // fallback nothing read, the snapshot stayed null, and the screen never changed — the exact
    // dead end the fallback exists to prevent.
    const setItem = refuseWrites();

    expect(writePlanDraft(filledDraft()), "a refused write reported success").toBe(false);
    expect(setItem, "the refusal was never actually exercised").toHaveBeenCalled();

    expect(planDraftSnapshot(), "the refused write is invisible to the screen").toEqual(filledDraft());
    expect(readPlanDraft(REFERRAL)).toEqual(filledDraft());
    // Nothing reached the tab-scoped store, so nothing outlives this page.
    expect(storedRaw()).toBeNull();
    // And the notice must say the draft is NOT being kept, rather than promising a memory the
    // browser refused.
    expect(planDraftIsHeld(), "the notice would have claimed the draft is kept").toBe(false);
  });

  it("goes back to keeping the draft once a write lands again", () => {
    refuseWrites();
    writePlanDraft(filledDraft());
    expect(planDraftIsHeld()).toBe(false);

    vi.restoreAllMocks();
    const later: PlanDraft = { ...filledDraft(), pathwayVersionId: "SYN-PATHWAY-002" };
    expect(writePlanDraft(later)).toBe(true);

    expect(planDraftIsHeld()).toBe(true);
    expect(planDraftSnapshot(), "the stale in-memory draft shadowed the one that was stored").toEqual(later);
    expect(storedRaw()).not.toBeNull();
  });

  it("discards an in-memory draft too, so a refused browser is not a way to keep one", () => {
    refuseWrites();
    writePlanDraft(filledDraft());
    expect(planDraftSnapshot()).not.toBeNull();

    clearPlanDraft();

    expect(planDraftSnapshot(), "the discarded draft survived in memory").toBeNull();
  });

  it("reports storage as available here, so the wizard's notice is answering a real question", () => {
    expect(planDraftStorageAvailable()).toBe(true);
  });
});

describe("what stage 3 adds to the draft (Phase 2B Task 8)", () => {
  it("starts a fresh draft with nothing typed and no sending preference chosen", () => {
    // Nothing in this domain holds a patient's name or mobile number (Ruling [112]), so there is
    // nothing to prefill from. And nothing holds a sending preference either: the draft starts at
    // null rather than defaulting to "morning", because a default would make a choice about when a
    // discharged patient hears from the service and present it as though the coordinator had made
    // it. Stage 2's pathway differs only because a referral genuinely does carry one.
    const draft = emptyPlanDraft(REFERRAL, null);
    expect(draft.patientDetail).toEqual({
      patientName: "",
      patientMobileNumber: "",
      patientIdentifiers: "",
      culturalIdentity: "",
    });
    expect(draft.sendingPreference).toBeNull();
  });

  it("keeps a patient's name, number, identifiers and cultural identity across a reload", () => {
    // The whole reason this workspace has a Client Component at all (Ruling [109]) — and the moment
    // Ruling [110]'s notice is about, because these are the values it is warning the clinician are
    // being held on this computer.
    const draft: PlanDraft = {
      ...filledDraft(),
      stage: "personalisation",
      patientDetail: {
        patientName: "Rowan Example",
        patientMobileNumber: RESERVED_PATIENT_MOBILE,
        patientIdentifiers: ["SYN-MRN-4471", "SYN-URN-90210"].join("\n"),
        culturalIdentity: "Noongar",
      },
      sendingPreference: "earlyEvening",
    };
    expect(writePlanDraft(draft)).toBe(true);

    // Read back through the module's own PARSER, exactly as a reload would. `writePlanDraft`
    // primes the snapshot cache with the object it was handed -- that is what keeps the snapshot
    // referentially stable -- so a read straight after a write never touches `parseDraft` and would
    // prove only that the object is still in memory. Clearing the cache first is what makes this
    // about what SURVIVES storage.
    const serialised = JSON.stringify(draft);
    clearPlanDraft();
    window.sessionStorage.setItem(PLAN_DRAFT_STORAGE_KEY, serialised);

    const read = readPlanDraft(REFERRAL);
    expect(read?.patientDetail).toEqual(draft.patientDetail);
    expect(read?.sendingPreference).toBe("earlyEvening");
  });

  it("discards a draft whose patient detail or sending preference is the wrong shape", () => {
    // `parseDraft` refuses anything it does not fully recognise, so a draft stored by an earlier
    // build — one with no patient detail at all — is discarded rather than half-read with the
    // clinician's typing silently defaulted away.
    const base = {
      referralId: REFERRAL,
      stage: "personalisation",
      assurances: { patientAgreed: true, mobileIsPatientControlled: true },
      pathwayVersionId: "SYN-PATHWAY-001",
    };

    window.sessionStorage.setItem(PLAN_DRAFT_STORAGE_KEY, JSON.stringify(base));
    expect(readPlanDraft(REFERRAL), "a draft from before stage 3 existed was accepted").toBeNull();

    window.sessionStorage.setItem(
      PLAN_DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...base,
        patientDetail: { patientName: "Rowan Example", patientMobileNumber: RESERVED_PATIENT_MOBILE },
        sendingPreference: null,
      }),
    );
    expect(readPlanDraft(REFERRAL), "a draft missing half its patient detail was accepted").toBeNull();

    window.sessionStorage.setItem(
      PLAN_DRAFT_STORAGE_KEY,
      JSON.stringify({
        ...base,
        patientDetail: {
          patientName: "Rowan Example",
          patientMobileNumber: RESERVED_PATIENT_MOBILE,
          patientIdentifiers: "",
          culturalIdentity: "",
        },
        sendingPreference: "whenever",
      }),
    );
    expect(readPlanDraft(REFERRAL), "a draft naming no real sending preference was accepted").toBeNull();
  });
});
