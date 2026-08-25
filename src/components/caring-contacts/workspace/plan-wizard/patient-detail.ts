// src/components/caring-contacts/workspace/plan-wizard/patient-detail.ts
//
// What stage 3 collects, and whether it is enough to create a plan with.
//
// WHY THIS IS NOT INSIDE THE WIZARD'S JSX. Ruling [115] requires the mobile number to be validated
// before the wizard advances; Ruling [116] requires cultural identity to be optional and to reach a
// plan as `null` rather than `""`. Both are decisions about a VALUE, and Task 9 needs the identical
// decisions when it assembles the `createPlan` call — a rule living inside a render branch is a
// rule Task 9 has to re-derive, and re-deriving is how two copies of one rule come to disagree.
// No React, no `"use client"`, no storage: this module is pure, so it can be tested directly and
// read by whatever builds the create call.
//
// THERE IS NO MOBILE-NUMBER FORMAT VALIDATOR IN THIS DOMAIN, AND ONE IS NOT INVENTED HERE.
// Ruling [115] says to look for an existing one before writing one, and to say so if none exists.
// It does not: `createPlanSchema.patientMobileNumber` is `z.string().min(1)`; `message-policy.ts`
// takes `patientMobileNumber` only to check whether the number LEAKED into message text, treating
// it as an opaque string; `synthetic-contacts.ts` holds a closed list of reserved fictional numbers
// but says nothing about the shape of any other number. So the only refusal here is the one the
// domain actually holds — a number must be present — and the reserved list is used to STATE
// something on the screen, never to refuse a value. See the Task 8 report.
//
// TRIMMING IS STRICTER THAN THE SCHEMA, DELIBERATELY. `z.string().min(1)` accepts `" "`. A plan
// whose patient name is a single space passes the API and identifies nobody, so a blank-after-trim
// entry is treated as absent here.
import type { SendingPreference } from "@/lib/caring-contacts/model";

/**
 * Stage 3's fields as the clinician has them typed so far.
 *
 * `patientIdentifiers` is held AS TYPED — one identifier per line, the clinician's own text
 * including a half-finished line — rather than as a parsed array. The draft's job is to return the
 * screen to the state it was left in; splitting on the way into storage and re-joining on the way
 * out would quietly rewrite what was typed on every refresh. `parsePatientIdentifiers` splits it at
 * the one moment it matters, which is when a plan is created.
 *
 * `culturalIdentity` IS NO LONGER COLLECTED (owner decision, 2026-08-25) and the field is kept here
 * on purpose rather than deleted. Keeping it is what lets `parseDraft` still RECOGNISE the key in a
 * draft stored before the input was removed and blank it deliberately; delete the field and a stored
 * value is merely ignored by omission, which is a silence rather than a decision. Nothing writes it,
 * `createPlanPatientDetail` sends `null` whatever it holds, and both of those are enforced by tests
 * rather than by the absence of a form control (round 2, N-1).
 */
export type PlanPatientDetailDraft = {
  patientName: string;
  patientMobileNumber: string;
  /** As typed, one identifier per line. */
  patientIdentifiers: string;
  culturalIdentity: string;
};

export const EMPTY_PLAN_PATIENT_DETAIL: PlanPatientDetailDraft = Object.freeze({
  patientName: "",
  patientMobileNumber: "",
  patientIdentifiers: "",
  culturalIdentity: "",
});

/** The fields stage 3 can refuse to proceed without. Cultural identity is deliberately not one. */
export type PersonalisationField = "patientName" | "patientMobileNumber" | "sendingPreference";

export type PersonalisationIssue = {
  code: "patient-name-required" | "patient-mobile-required" | "sending-preference-required";
  field: PersonalisationField;
  /** Plain words a clinician reads, rendered beside the field itself. Never a code. */
  message: string;
};

/**
 * Everything still missing before this plan could be created, in the order the fields appear.
 *
 * Order matters because the screen reads this list twice — once per field, and once as a summary —
 * and a summary that lists what is missing in a different order from the form is a summary a
 * clinician has to re-read to use.
 */
export function personalisationIssues(input: {
  detail: PlanPatientDetailDraft;
  sendingPreference: SendingPreference | null;
}): PersonalisationIssue[] {
  const issues: PersonalisationIssue[] = [];

  if (input.detail.patientName.trim() === "") {
    issues.push({
      code: "patient-name-required",
      field: "patientName",
      message:
        "Enter the name this plan is for. A referral carries no name, so nothing on this screen can fill it in, and a plan cannot be created without one.",
    });
  }

  if (input.detail.patientMobileNumber.trim() === "") {
    issues.push({
      code: "patient-mobile-required",
      field: "patientMobileNumber",
      message:
        "Enter the mobile number this plan will use. A referral carries no mobile number, and a plan cannot be created without one.",
    });
  }

  if (input.sendingPreference === null) {
    issues.push({
      code: "sending-preference-required",
      field: "sendingPreference",
      message: "Choose when in the day messages go out. One choice applies to every contact in this plan.",
    });
  }

  return issues;
}

/** Every non-blank line of `text`, trimmed. An empty box is an empty list, never `[""]`. */
export function parsePatientIdentifiers(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * Exactly the object `createPlanSchema.patientDetail` accepts, or null while anything required is
 * missing.
 *
 * `patientDetail` is `.strict()` with four keys, so this returns those four and nothing else: a
 * fifth key would be refused by the API outright rather than ignored, which is the failure mode
 * that makes returning a wider object dangerous rather than merely untidy.
 *
 * CULTURAL IDENTITY IS ALWAYS `null` HERE, WHATEVER IS PASSED IN — round 2, finding N-1, and it is
 * the difference between a property of code and a property of state. The field is no longer
 * collected, so before this change `null` reached the schema only because the UI could not write a
 * value. That is not a guarantee: a `sessionStorage` draft written before the input was removed
 * survives `parseDraft` in the same tab across a redeploy, and Task 9 would have submitted it into
 * `cultural_identity_reports` — while this very screen states that the plan records nothing there.
 * An interface claim that holds only while nobody happens to have stale data is a claim, not a rule.
 *
 * Two boundaries are defended, and they are NOT two copies of one rule. `parseDraft` blanks a stored
 * value so it cannot re-enter the application at all; this returns `null` so the function Task 9
 * calls cannot emit one whatever it is handed, including a detail object built by hand that never
 * went near storage. Neither subsumes the other, and today they happen to agree.
 *
 * AND `""` WOULD NOT HAVE DONE INSTEAD OF `null` (round 1, M-3).
 * `createPlanSchema.patientDetail.culturalIdentity` is `z.string().min(1).nullable()`, so `""` is
 * not a weaker way of saying "not given" — it is **REFUSED OUTRIGHT** by the API, and a plan
 * carrying one could not be created at all.
 *
 * The first version argued that `""` and `null` would be "indistinguishable" from a cleared record.
 * That was wrong on its own terms: `CLEARED_PATIENT_DETAIL.culturalIdentity` is `null`, so the two
 * are perfectly distinguishable — merely meaningless, since nothing defines what `""` would mean.
 * The behaviour was right and the argument was not, which is worth recording rather than quietly
 * rewriting: an argument nobody can check is how a correct behaviour later gets "simplified" away.
 */
export function createPlanPatientDetail(detail: PlanPatientDetailDraft): {
  patientName: string;
  patientMobileNumber: string;
  patientIdentifiers: string[];
  culturalIdentity: string | null;
} | null {
  const patientName = detail.patientName.trim();
  const patientMobileNumber = detail.patientMobileNumber.trim();
  if (patientName === "" || patientMobileNumber === "") return null;

  return {
    patientName,
    patientMobileNumber,
    patientIdentifiers: parsePatientIdentifiers(detail.patientIdentifiers),
    // ALWAYS null, and never `detail.culturalIdentity`. See the note above: this is the submit
    // boundary's half of round 2's N-1, and it is unconditional so that no caller — a stored draft,
    // a hand-built object at Task 9, a future screen — can put a value into
    // `cultural_identity_reports` while this wizard tells a clinician the plan records nothing there.
    culturalIdentity: null,
  };
}

/**
 * Whether `value` is one of the reserved fictional patient mobiles this prototype's own material
 * uses (`synthetic-contacts.ts`).
 *
 * IT DECIDES WHAT THE SCREEN SAYS, NEVER WHETHER A VALUE IS ACCEPTED. The domain holds no format
 * rule for a mobile number, so refusing everything outside a two-item list would be a rule invented
 * on this screen and enforced nowhere else — the API would still take any non-empty string, and the
 * screen would be the only thing claiming otherwise.
 *
 * Spacing is ignored on both sides. That is a comparison convenience rather than a format rule: the
 * reserved numbers are written `+61 491 570 156` and a clinician copying one may or may not carry
 * the spaces, and answering "no" to the same number written differently would make the statement
 * beside the field wrong.
 */
export function mobileIsDesignatedFictional(value: string, reserved: readonly string[]): boolean {
  const normalised = withoutSpacing(value);
  if (normalised === "") return false;
  return reserved.some((entry) => withoutSpacing(entry) === normalised);
}

function withoutSpacing(value: string): string {
  return value.replace(/\s+/g, "");
}
