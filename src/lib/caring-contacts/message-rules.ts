// PROVISIONAL — NOT CLINICALLY APPROVED.
// Seeded 2026-08-19 from the decision lock's prohibited concepts, the existing prototype message
// constants, and the two-segment GSM-7 limit. Replace this file wholesale when the clinical programme
// lead and lived-experience representative approve the real content style guide. Do not edit
// message-policy.ts to accommodate a rule change — the mechanism is stable, the rules are data.

export type ProvisionalMessageRules = {
  /** Above this many GSM-7 segments, a message fails exceeds-two-segments. */
  maxSegments: number;
  /** Case-insensitive terms that must never appear in an outgoing message. */
  prohibitedTerms: readonly string[];
  /** Identifies the programme; required in first and closing messages. */
  programmeLine: string;
  /** The staffed line's operating hours; required in first messages. */
  operatingHours: string;
  /** Tells the recipient what to do in an emergency; required in first messages. */
  emergencyDirection: string;
  /** The one crisis-support contact; required in first and closing messages. */
  crisisSupportContact: string;
  /**
   * Text that identifies a reserved fictional contact detail inside a message (see
   * ../synthetic-contacts.ts). NOT in `prohibitedTerms` -- Ruling 79 (item A1, 2026-08-24): both
   * approved patient-visible messages contain `crisisSupportContact` today, so a bare prohibition
   * on this text would make every existing message invalid. message-policy.ts instead reports
   * `fictional-contact-detail-present` whenever a message contains this marker, unless the caller
   * explicitly acknowledges the number is synthetic. See task-c-brief.md, "A1".
   */
  fictionalContactMarker: string;
  /** States that the message is the last one the recipient will receive. */
  closingStatement: string;
};

const CRISIS_SUPPORT_CONTACT = "Fictional Support Line: +61 491 570 158";

export const PROVISIONAL_MESSAGE_RULES: ProvisionalMessageRules = Object.freeze({
  maxSegments: 2,
  prohibitedTerms: Object.freeze([
    "high risk",
    "safe",
    "engagement score",
    "campaign",
    "lead",
    "conversion",
    "best match",
    "inbox",
    "conversation",
  ]),
  programmeLine: "Example Aftercare Team is thinking of you",
  operatingHours: "9 am-6 pm",
  emergencyDirection: "In an emergency call 000",
  crisisSupportContact: CRISIS_SUPPORT_CONTACT,
  // Derived from crisisSupportContact rather than hard-coded a second time, so the marker can
  // never say something the crisis contact itself does not.
  fictionalContactMarker: CRISIS_SUPPORT_CONTACT.split(":")[0],
  closingStatement: "This is the final message in this programme",
});
