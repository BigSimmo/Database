// src/lib/caring-contacts/message-policy.ts
//
// Mechanism only. The content this module checks against — prohibited terms, the required
// programme/hours/emergency/crisis-support fragments, the closing statement, and the maximum
// segment count — all live in message-rules.ts and change there, wholesale, without editing
// this file. See message-rules.ts for why.
import type { MessageType } from "./model";
import { PROVISIONAL_MESSAGE_RULES } from "./message-rules";

// The GSM-7 default alphabet (basic set) and its extension table, per the SMS standard. These
// character sets and the 160/153 septet thresholds are a fixed telecom specification, not
// provisional clinical content, so they live here rather than in message-rules.ts.
const GSM_7_BASIC_CHARACTERS = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_7_EXTENSION_CHARACTERS = new Set("\f^{}\\[~]|€");
const GSM_7_SINGLE_SEGMENT_LIMIT = 160;
const GSM_7_MULTI_SEGMENT_UNIT = 153;

export type Gsm7Evidence = {
  valid: boolean;
  segments: number;
  septets: number;
  invalidCharacters: string[];
};

/**
 * Counts GSM-7 septets for `text` and derives the SMS segment count. Basic-set characters cost
 * 1 septet, extension-set characters cost 2, and anything else makes the message invalid (the
 * device would substitute or drop it) — reported with `valid: false` and `segments: 0`.
 */
export function calculateGsm7(text: string): Gsm7Evidence {
  let septets = 0;
  const invalidCharacters: string[] = [];

  for (const character of text) {
    if (GSM_7_BASIC_CHARACTERS.has(character)) septets += 1;
    else if (GSM_7_EXTENSION_CHARACTERS.has(character)) septets += 2;
    else if (!invalidCharacters.includes(character)) invalidCharacters.push(character);
  }

  if (invalidCharacters.length > 0) {
    return { valid: false, septets, segments: 0, invalidCharacters };
  }
  const segments =
    septets === 0 ? 0 : septets <= GSM_7_SINGLE_SEGMENT_LIMIT ? 1 : Math.ceil(septets / GSM_7_MULTI_SEGMENT_UNIT);
  return { valid: true, septets, segments, invalidCharacters };
}

export type GovernedMessageInput = {
  text: string;
  messageType: MessageType;
  /** The recipient's own mobile number, if known, so it can be checked for leakage into the text. */
  patientMobileNumber?: string;
  /**
   * Explicit, greppable acknowledgement that a reserved fictional contact detail (see
   * message-rules.ts's `fictionalContactMarker`) in `text` is known to be synthetic. Ruling 79
   * (item A1, 2026-08-24): defaults to false/absent, which means the message is REFUSED whenever
   * it contains that marker. There is deliberately no way to silence the check other than passing
   * this flag at the call site.
   */
  syntheticFictionalContactsAcknowledged?: boolean;
};

export type MessageValidationIssue =
  | { code: "exceeds-two-segments"; septets: number; segments: number }
  | { code: "prohibited-term"; term: string }
  | { code: "fictional-contact-detail-present" }
  | { code: "first-message-missing-support-information" }
  | { code: "closing-message-missing-ending-statement" }
  | { code: "closing-message-missing-support-information" }
  | { code: "contains-patient-mobile" }
  | { code: "solicits-reply" };

export type ValidationResult = { valid: true } | { valid: false; issues: MessageValidationIssue[] };

/**
 * Checks a fully substituted outgoing message against the current PROVISIONAL_MESSAGE_RULES.
 * Pure and synchronous: no network, model, or provider call, and no mutation of `input`.
 */
export function validateGovernedMessage(input: GovernedMessageInput): ValidationResult {
  const rules = PROVISIONAL_MESSAGE_RULES;
  const issues: MessageValidationIssue[] = [];
  const text = input.text;

  const gsm7 = calculateGsm7(text);
  if (gsm7.valid && gsm7.segments > rules.maxSegments) {
    issues.push({ code: "exceeds-two-segments", septets: gsm7.septets, segments: gsm7.segments });
  }

  const lowerText = text.toLowerCase();
  for (const term of rules.prohibitedTerms) {
    // B2: a term with a pattern override (today, only "lead") is matched by that pattern instead
    // of plain substring inclusion. Every other term's behaviour is unchanged.
    const override = rules.prohibitedTermPatternOverrides[term];
    const matched = override ? override.test(text) : lowerText.includes(term.toLowerCase());
    if (matched) {
      issues.push({ code: "prohibited-term", term });
    }
  }

  // Ruling 79 (item A1): always reported when the marker is present, unless explicitly
  // acknowledged at the call site. See message-rules.ts's `fictionalContactMarker` doc comment.
  if (!input.syntheticFictionalContactsAcknowledged && text.includes(rules.fictionalContactMarker)) {
    issues.push({ code: "fictional-contact-detail-present" });
  }

  if (input.messageType === "first") {
    const hasFullSupportInformation =
      text.includes(rules.programmeLine) &&
      text.includes(rules.operatingHours) &&
      text.includes(rules.emergencyDirection) &&
      text.includes(rules.crisisSupportContact);
    if (!hasFullSupportInformation) {
      issues.push({ code: "first-message-missing-support-information" });
    }
  }

  if (input.messageType === "closing") {
    if (!text.includes(rules.closingStatement)) {
      issues.push({ code: "closing-message-missing-ending-statement" });
    }
    const hasSupportInformation = text.includes(rules.programmeLine) && text.includes(rules.crisisSupportContact);
    if (!hasSupportInformation) {
      issues.push({ code: "closing-message-missing-support-information" });
    }
  }

  if (input.patientMobileNumber && text.includes(input.patientMobileNumber)) {
    issues.push({ code: "contains-patient-mobile" });
  }

  if (text.includes("?")) {
    issues.push({ code: "solicits-reply" });
  }

  return issues.length === 0 ? { valid: true } : { valid: false, issues };
}

export type ClosingMessageBodyIssue = { code: "closing-message-body-not-authored" };

export type ClosingMessageBodyResolution = { ok: true; body: string } | { ok: false; issue: ClosingMessageBodyIssue };

/**
 * Resolves the outgoing text for a `closing` contact (item A4, 2026-08-24).
 *
 * No closing message has ever been written -- final wording is a clinical decision the owner has
 * deferred to a lived-experience representative, not an implementation gap. A plan reaching its
 * end today has nothing to send, and the only acceptable response to that is a loud, identifiable
 * refusal: never an empty string, never a silent fall-back to some other message's text, and never
 * a silently skipped contact. This is the refusal only -- it drafts no closing-message wording of
 * its own, deliberately, because an implementer doing so would be the exact failure this exists to
 * prevent. This is distinct from `closing-message-missing-ending-statement`: that code means a body
 * exists but is wrong; this one means no body exists to check at all.
 *
 * No existing seam resolves a contact's message body anywhere in this domain today (checked
 * schedule.ts, simulation.ts, repository.ts, model.ts) -- `PlannedContact` carries a `messageType`
 * but no body content, and nothing yet supplies one. This function is the mechanism a future
 * sender must call once that seam is built; it is not itself wired into the schedule or the
 * simulation driver, because doing so would require inventing where an authored closing body comes
 * from, which is exactly the decision this task defers.
 */
export function resolveClosingContactMessageBody(authoredClosingBody: string | undefined): ClosingMessageBodyResolution {
  if (!authoredClosingBody || authoredClosingBody.trim().length === 0) {
    return { ok: false, issue: { code: "closing-message-body-not-authored" } };
  }
  return { ok: true, body: authoredClosingBody };
}
