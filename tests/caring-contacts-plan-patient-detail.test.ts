// tests/caring-contacts-plan-patient-detail.test.ts
//
// Stage 3's rules, tested where they live: `plan-wizard/patient-detail.ts` (Phase 2B Task 8).
//
// WHY THIS IS A SEPARATE MODULE FROM THE SCREEN, AND WHY IT IS TESTED SEPARATELY. Ruling [115]
// requires the mobile number to be validated before the wizard advances, and Ruling [116] requires
// cultural identity to be genuinely optional and to reach a plan as `null` rather than `""`. Those
// are decisions about a value, not about a rendering, and Task 9 needs exactly the same decisions
// when it builds the create call. A rule that exists only inside a JSX branch is a rule Task 9 has
// to re-derive, and re-deriving is how two copies come to disagree.
//
// WHAT THIS FILE DELIBERATELY DOES NOT CLAIM. There is NO mobile-number format validator anywhere
// in this domain — `patientMobileNumber` is `z.string().min(1)` in `createPlanSchema` and
// `message-policy.ts` treats the number as an opaque string it checks for leakage into message
// text. So nothing here asserts a shape for a phone number, because inventing one would be
// inventing the authority Ruling [115] told the implementer to look for and report the absence of.
// What IS asserted is the rule the domain does hold (a number must be present) and the one
// existing authority about numbers that can never connect (`synthetic-contacts.ts`'s reserved
// fictional set), used to STATE something rather than to refuse anything.
import { describe, expect, it } from "vitest";

import {
  EMPTY_PLAN_PATIENT_DETAIL,
  createPlanPatientDetail,
  mobileIsDesignatedFictional,
  parsePatientIdentifiers,
  personalisationIssues,
} from "@/components/caring-contacts/workspace/plan-wizard/patient-detail";
import {
  DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS,
  FICTIONAL_CONTACTS_BY_ROLE,
} from "@/lib/caring-contacts/synthetic-contacts";

const COMPLETE = {
  patientName: "Rowan Example",
  patientMobileNumber: DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS[1],
  patientIdentifiers: "",
  culturalIdentity: "",
};

describe("stage 3's required values (Rulings [114] and [115])", () => {
  it("refuses a plan with no patient name and no mobile number, naming each in words", () => {
    const issues = personalisationIssues({
      detail: EMPTY_PLAN_PATIENT_DETAIL,
      sendingPreference: null,
    });

    expect(issues.map((issue) => issue.field)).toEqual(["patientName", "patientMobileNumber", "sendingPreference"]);
    for (const issue of issues) {
      // Plain words, in place. A code is for the screen to key on; the message is what a clinician
      // reads, so an empty or code-shaped message would be a defect the field list cannot catch.
      expect(issue.message.length, `${issue.field} has no plain-words message`).toBeGreaterThan(20);
      expect(issue.message).not.toContain(issue.code);
    }
  });

  it("treats whitespace as absent, which the schema alone would not", () => {
    // `z.string().min(1)` accepts " ". The screen trimming is therefore STRICTER than the API, and
    // deliberately so: a plan whose patient name is a space is a plan nobody can identify.
    const issues = personalisationIssues({
      detail: { ...COMPLETE, patientName: "   ", patientMobileNumber: "\t\n " },
      sendingPreference: "morning",
    });
    expect(issues.map((issue) => issue.field)).toEqual(["patientName", "patientMobileNumber"]);
  });

  it("is satisfied by a name, a number and a sending preference, and asks for nothing else", () => {
    expect(personalisationIssues({ detail: COMPLETE, sendingPreference: "earlyEvening" })).toEqual([]);
  });
});

describe("cultural identity is not collected, and null is a property of code (N-1)", () => {
  it("raises no issue when it is absent, because it is never asked for", () => {
    const issues = personalisationIssues({
      detail: { ...COMPLETE, culturalIdentity: "" },
      sendingPreference: "morning",
    });
    expect(issues).toEqual([]);
  });

  it("sends null even when handed a value, so the screen's claim cannot be falsified by state", () => {
    // ROUND 2, N-1. This used to pass a non-empty value straight through, which meant `null` reached
    // the schema only because the UI could no longer write one — a property of STATE, not of code.
    // A `sessionStorage` draft written before the field was removed, or any caller that builds a
    // detail object by hand, could still have carried a value into `cultural_identity_reports`
    // while the screen said "the plan records nothing here".
    //
    // `""` still maps to null too: `z.string().min(1).nullable()` REFUSES the empty string, so a
    // plan carrying one could not be created at all.
    expect(createPlanPatientDetail({ ...COMPLETE, culturalIdentity: "   " })?.culturalIdentity).toBeNull();
    expect(
      createPlanPatientDetail({ ...COMPLETE, culturalIdentity: "Noongar" })?.culturalIdentity,
      "a supplied cultural identity was passed through to the plan",
    ).toBeNull();
  });
});

describe("the shape `createPlanSchema.patientDetail` requires", () => {
  it("answers null while anything required is missing, so a caller cannot post half a patient", () => {
    expect(createPlanPatientDetail({ ...COMPLETE, patientMobileNumber: " " })).toBeNull();
    expect(createPlanPatientDetail({ ...COMPLETE, patientName: "" })).toBeNull();
  });

  it("trims the two required fields and carries exactly the four keys the schema names", () => {
    const detail = createPlanPatientDetail({
      patientName: "  Rowan Example  ",
      patientMobileNumber: `  ${DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS[0]}  `,
      patientIdentifiers: "SYN-MRN-4471",
      culturalIdentity: "",
    });

    // `createPlanSchema.patientDetail` is `.strict()` with exactly these four keys, so a fifth one
    // added here would be refused by the API rather than ignored.
    expect(Object.keys(detail ?? {}).sort()).toEqual([
      "culturalIdentity",
      "patientIdentifiers",
      "patientMobileNumber",
      "patientName",
    ]);
    expect(detail?.patientName).toBe("Rowan Example");
    expect(detail?.patientMobileNumber).toBe(DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS[0]);
    expect(detail?.patientIdentifiers).toEqual(["SYN-MRN-4471"]);
  });
});

describe("identifiers, one per line", () => {
  it('drops blank lines and trims each, so an empty box is an empty array rather than [""]', () => {
    // `patientIdentifiers` is `z.array(z.string().min(1))`, so a single empty string would be
    // REFUSED by the API — an empty box has to produce an empty array, not one blank entry.
    expect(parsePatientIdentifiers("")).toEqual([]);
    expect(parsePatientIdentifiers("\n  \n\t\n")).toEqual([]);
    expect(parsePatientIdentifiers("  SYN-MRN-4471  \n\nSYN-URN-90210\n")).toEqual(["SYN-MRN-4471", "SYN-URN-90210"]);
  });
});

describe("the one authority this domain holds about numbers that cannot connect", () => {
  it("recognises a reserved fictional patient mobile, however it is spaced", () => {
    // Ignoring spacing is a comparison convenience, not a format rule: it decides what the screen
    // SAYS about a number, never whether the number is accepted.
    for (const reserved of DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS) {
      expect(mobileIsDesignatedFictional(reserved, DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS)).toBe(true);
      expect(
        mobileIsDesignatedFictional(reserved.replace(/\s+/g, ""), DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS),
        "the same reserved number written without spaces was not recognised",
      ).toBe(true);
    }
  });

  it("does not recognise anything else, including a near miss", () => {
    const [first] = DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS;
    expect(mobileIsDesignatedFictional(`${first}1`, DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS)).toBe(false);
    expect(mobileIsDesignatedFictional("+61 400 000 000", DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS)).toBe(false);
    expect(mobileIsDesignatedFictional("", DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS)).toBe(false);
  });

  it("names only the two reserved PATIENT mobiles, not the staffed line or the crisis contact", () => {
    // Offering the crisis-support number as a patient's own mobile would put a support line into a
    // recipient field, which is the one confusion this list must not create.
    //
    // ROUND 1, M-2. The first version asserted `toHaveLength(2)` under this exact name, so swapping
    // the crisis-support number in for a patient mobile passed it -- the assertion counted the list
    // rather than checking what is in it, which is the tautology this task's own finding 3
    // documented and then reproduced. Both halves are now named against the frozen record.
    expect([...DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS]).toEqual([
      FICTIONAL_CONTACTS_BY_ROLE.miraPatientMobile,
      FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile,
    ]);
    for (const serviceLine of [
      FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine,
      FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact,
    ]) {
      expect(
        [...DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS],
        "a number a patient CALLS is offered as a number a patient receives on",
      ).not.toContain(serviceLine);
    }
  });
});
