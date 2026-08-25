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

const REFERRAL = "SYN-REFERRAL-001";
const OTHER_REFERRAL = "SYN-REFERRAL-002";

const WIZARD_DIRECTORY = path.join(process.cwd(), "src", "components", "caring-contacts", "workspace", "plan-wizard");

/**
 * `source` with its comments removed.
 *
 * Load-bearing rather than tidy: `plan-draft.ts`'s own module note explains at length why
 * `localStorage` is refused, so a scan that read prose would report the EXPLANATION as the offence
 * — and the obvious way to make it green again would be to delete the explanation. Documenting a
 * rule is not breaking it, and a check that cannot tell those apart is a check that gets silenced.
 * `tests/route-reachability.test.ts` records the same trap, found the same way.
 */
function sourceWithoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

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
    const offenders = files.filter((file) => sourceWithoutComments(readFileSync(file, "utf8")).includes("localStorage"));
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

  it("clears on successful activation — the same seam, which is what Task 9 must call", () => {
    // There is one clearing function deliberately, so "cleared on activation" and "cleared on
    // abandoning" cannot drift apart. This case exists so that Task 9 has a named, failing test to
    // point at if it ever stops calling it.
    writePlanDraft(filledDraft());

    clearPlanDraft();

    expect(storedRaw(), "an activated plan left its draft on the machine").toBeNull();
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
