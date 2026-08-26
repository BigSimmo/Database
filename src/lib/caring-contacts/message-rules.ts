// PROVISIONAL — NOT CLINICALLY APPROVED.
// Seeded 2026-08-19 from the decision lock's prohibited concepts, the existing prototype message
// constants, and the two-segment GSM-7 limit. Replace this file wholesale when the clinical programme
// lead and lived-experience representative approve the real content style guide. Do not edit
// message-policy.ts to accommodate a rule change — the mechanism is stable, the rules are data.
import { DESIGNATED_FICTIONAL_MOBILE_NUMBERS } from "./synthetic-contacts";

/** Escapes `value` for literal use inside a `RegExp` source string. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
   * Identifies a reserved fictional contact detail inside a message. NOT in `prohibitedTerms` --
   * Ruling 79 (item A1, 2026-08-24): both approved patient-visible messages contain
   * `crisisSupportContact` today, so a bare prohibition on this text would make every existing
   * message invalid. message-policy.ts instead reports `fictional-contact-detail-present`
   * whenever a message matches this pattern, unless the caller explicitly acknowledges the
   * number is synthetic. See task-c-brief.md, "A1".
   *
   * Fix round 1 (promoted finding, 2026-08-24): the first version was `crisisSupportContact.
   * split(":")[0]` -- the LABEL "Fictional Support Line" only. A message carrying the reserved
   * NUMBER with no label raised nothing, which is precisely the shape that would reach a real
   * sender: the number is the dangerous artefact, not the label. This is now a pattern matching
   * "Fictional" (any case) OR any one of `synthetic-contacts.ts`'s reserved fictional numbers, so
   * relabelling ("Fictional Support Line (24h): …"), reordering ("… (Fictional Support Line)"),
   * or dropping the label entirely (just the bare number) are all still caught -- either half of
   * the pair alone is sufficient.
   */
  fictionalContactMarkerPattern: RegExp;
  /**
   * Per-term overrides for how a `prohibitedTerms` entry is matched, keyed by the exact term
   * string. A term with no entry here keeps the default plain-substring match. B2 (2026-08-24):
   * "lead" is the only entry -- `lowerText.includes("lead")` also matched the ordinary English
   * "the incident lead" / "the clinical programme lead" (job titles in the service-stop wording).
   * This is deliberately NOT extended to the rest of the list: several other terms are multi-word
   * phrases whose substring behaviour is intentional.
   *
   * Fix round 1: the first version of this override ALLOWLISTED nine commercial
   * modifiers/companions ("sales lead", "lead generation", ...). Commercial vocabulary for "lead"
   * is open-ended, so that allowlist was itself a defect -- "lead nurturing", "lead magnet",
   * "qualify this lead" and similar phrasing all passed silently. The current version inverts
   * this: it refuses "lead"/"leads" as a whole word BY DEFAULT, and exempts only the closed,
   * small set of job titles this domain's own wording ever uses. See task-c-brief.md, "B2", and
   * task-c-report.md's "fix round 1" section.
   */
  prohibitedTermPatternOverrides: Readonly<Partial<Record<string, RegExp>>>;
  /** States that the message is the last one the recipient will receive. */
  closingStatement: string;
};

const CRISIS_SUPPORT_CONTACT = "Fictional Support Line: +61 491 570 158";

// A1, fix round 1: "Fictional" (label, any case) OR any reserved fictional number from
// synthetic-contacts.ts. Either half alone is sufficient, so relabelling the crisis contact,
// reordering it, or dropping the label and keeping only the bare number are all still caught.
const FICTIONAL_CONTACT_MARKER_PATTERN = new RegExp(
  ["Fictional", ...DESIGNATED_FICTIONAL_MOBILE_NUMBERS.map(escapeRegExp)].join("|"),
  "i",
);

// B2, fix round 1: refuses "lead"/"leads" as a whole word BY DEFAULT (a negative lookbehind, not
// an allowlist of commercial phrasing), exempting only this domain's closed set of job titles --
// "incident lead", "programme lead", "clinical lead", "team lead", "service lead". A job title is
// exempted only when the qualifying word sits IMMEDIATELY before "lead"/"leads" (so "clinical
// programme lead" is still exempt: "programme lead" is the qualifying pair actually adjacent to
// the word), never merely because one of those words appears anywhere earlier in the message.
const COMMERCIAL_LEAD_PATTERN = /(?<!\b(?:incident|programme|clinical|team|service)\s)\bleads?\b/i;

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
  fictionalContactMarkerPattern: FICTIONAL_CONTACT_MARKER_PATTERN,
  prohibitedTermPatternOverrides: Object.freeze({
    lead: COMMERCIAL_LEAD_PATTERN,
  }),
  closingStatement: "This is the final message in this programme",
});
