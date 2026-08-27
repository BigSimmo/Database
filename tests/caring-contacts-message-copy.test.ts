import { describe, expect, it } from "vitest";

import { calculateGsm7 } from "@/lib/caring-contacts/message-policy";
import {
  AUTOMATED_REPLY_GSM7,
  AUTOMATED_REPLY_RESPONSE,
  CLINICIAN_FACING_WORDING_APPROVAL_STATUS,
  EXACT_MESSAGE_GSM7,
  EXACT_PATIENT_VISIBLE_MESSAGE,
  PATIENT_VISIBLE_NO_REPLY_NOTICE,
} from "@/lib/caring-contacts/message-copy";
import {
  DESIGNATED_FICTIONAL_MOBILE_NUMBERS,
  FICTIONAL_CONTACTS_BY_ROLE,
} from "@/lib/caring-contacts/synthetic-contacts";

describe("caring-contacts patient-visible copy", () => {
  it("keeps the pinned GSM-7 evidence for both patient-visible strings", () => {
    expect(EXACT_MESSAGE_GSM7).toEqual({ invalidCharacters: [], segments: 2, septets: 252, valid: true });
    // 218 -> 210 septets, owner-approved 2026-08-24 (items A2 + A3): the first sentence was
    // replaced, see the "A2 + A3" describe block below for the full covering tests.
    expect(AUTOMATED_REPLY_GSM7).toEqual({ invalidCharacters: [], segments: 2, septets: 210, valid: true });
  });

  it("derives its evidence from the single domain GSM-7 calculator", () => {
    expect(EXACT_MESSAGE_GSM7).toEqual(calculateGsm7(EXACT_PATIENT_VISIBLE_MESSAGE));
    expect(AUTOMATED_REPLY_GSM7).toEqual(calculateGsm7(AUTOMATED_REPLY_RESPONSE));
  });

  it("names the staffed line and crisis support in both strings and neither patient mobile", () => {
    for (const text of [EXACT_PATIENT_VISIBLE_MESSAGE, AUTOMATED_REPLY_RESPONSE]) {
      expect(text).toContain(FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine);
      expect(text).toContain(FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact);
      expect(text).not.toContain(FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile);
      expect(text).not.toContain(FICTIONAL_CONTACTS_BY_ROLE.miraPatientMobile);
    }
  });

  it("states only that nobody reads replies, never that replies are not received", () => {
    expect(EXACT_PATIENT_VISIBLE_MESSAGE).toContain(PATIENT_VISIBLE_NO_REPLY_NOTICE);
    expect(PATIENT_VISIBLE_NO_REPLY_NOTICE).toBe("No one reads replies to this number");
    for (const text of [EXACT_PATIENT_VISIBLE_MESSAGE, AUTOMATED_REPLY_RESPONSE]) {
      expect(text).not.toMatch(/replies are not received|we monitor|monitored/i);
    }
  });

  it("includes emergency escalation and therapeutic neutrality in both patient-visible strings", () => {
    for (const text of [EXACT_PATIENT_VISIBLE_MESSAGE, AUTOMATED_REPLY_RESPONSE]) {
      expect(text).toContain("In an emergency call 000");
      expect(text).not.toContain("?");
      for (const prohibited of ["high risk", "safe", "engagement score", "campaign", "lead", "conversion", "inbox"]) {
        expect(text.toLowerCase()).not.toContain(prohibited);
      }
    }
  });

  // Ruling [131]. The module's own marker is a comment, which no screen can read and no gate can
  // check. This is the same fact as a value, so a screen states the status by reading it rather
  // than by retyping a sentence that would go on saying "provisional" after the gate had decided.
  it("states, as a value, that the patient-visible wording is not clinically approved", () => {
    expect(CLINICIAN_FACING_WORDING_APPROVAL_STATUS).toContain("has not been clinically approved");
    expect(CLINICIAN_FACING_WORDING_APPROVAL_STATUS).toContain("provisional");
    // Two approvals of a VERSION are not an approval of the words -- the distinction the sentence
    // this replaced collapsed, and the whole reason the status has to be said at all.
    expect(CLINICIAN_FACING_WORDING_APPROVAL_STATUS).toContain(
      "A pathway version's recorded approvals approve the version, not these words.",
    );
  });

  it("keeps the clinician-facing status out of both patient-visible strings", () => {
    // The positive control is the pair of assertions above: the status really is a non-empty
    // sentence, so these absences are asserted over a value that could have leaked into a message.
    expect(CLINICIAN_FACING_WORDING_APPROVAL_STATUS.length).toBeGreaterThan(0);
    for (const text of [EXACT_PATIENT_VISIBLE_MESSAGE, AUTOMATED_REPLY_RESPONSE]) {
      expect(text).not.toContain(CLINICIAN_FACING_WORDING_APPROVAL_STATUS);
      expect(text).not.toContain("not clinically approved");
    }
  });

  it("uses four distinct reserved fictional numbers", () => {
    expect(new Set(DESIGNATED_FICTIONAL_MOBILE_NUMBERS).size).toBe(4);
    expect(DESIGNATED_FICTIONAL_MOBILE_NUMBERS).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// A2 + A3 (owner-approved 2026-08-24) — the automated reply no longer makes a storage claim
// nobody can currently verify, and it now tells the recipient the reply they are reading is
// automatic, so a person who was just told "no one reads this" cannot mistake a reply for a
// human response. See docs/caring-contacts/phase-2b-sdd-archive/task-c-brief.md.
// ---------------------------------------------------------------------------
describe("caring-contacts automated reply wording (A2 + A3, 2026-08-24)", () => {
  it("matches the owner-approved text exactly", () => {
    expect(AUTOMATED_REPLY_RESPONSE).toBe(
      "No one at Example Aftercare Team reads this number, and this reply is automatic. To talk to someone, " +
        `call ${FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine}, 9 am-6 pm every day. In an emergency call 000. ` +
        `Fictional Support Line: ${FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact}.`,
    );
  });

  it("stays within the two-segment GSM-7 ceiling (measured, not assumed)", () => {
    const evidence = calculateGsm7(AUTOMATED_REPLY_RESPONSE);
    expect(evidence.segments).toBe(2);
    expect(evidence.valid).toBe(true);
    expect(evidence.septets).toBe(210);
  });

  it("A2: drops the storage claim nobody can currently verify", () => {
    expect(AUTOMATED_REPLY_RESPONSE).not.toContain("has not been kept");
    expect(AUTOMATED_REPLY_RESPONSE).not.toContain("has not been seen by anyone");
  });

  it("A3: tells the recipient this reply itself is automatic", () => {
    expect(AUTOMATED_REPLY_RESPONSE).toContain("automatic");
  });

  it("leaves EXACT_PATIENT_VISIBLE_MESSAGE untouched by the A2/A3 wording change", () => {
    // Message A is 252 septets against the 2-segment ceiling -- deliberately not touched here.
    // See message-copy.ts's own comment and task-c-brief.md, "A2 + A3", for why.
    expect(EXACT_PATIENT_VISIBLE_MESSAGE).not.toContain("this reply is automatic");
    expect(calculateGsm7(EXACT_PATIENT_VISIBLE_MESSAGE).septets).toBe(252);
  });
});
