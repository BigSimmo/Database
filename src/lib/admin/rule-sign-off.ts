import { sha256Hex } from "@/lib/mha-timeline";

/**
 * The switch every Today rule engine sits behind: Mental Health Act timers, roster fatigue
 * warnings and CPD category coaching. A rule set is ON only when all of these hold:
 *
 * - `enabled` is true;
 * - it is signed by a named person (a backstop check that rejects "PsychSift", "system", common role
 *   and placeholder words and single names; it cannot prove a name is real, so the signer is still
 *   accountable for writing their own name);
 * - the sign-off carries a real UTC time;
 * - the sign-off pin still matches the rule set's content, so any edit to a number, a quote or a
 *   citation after signing turns the engine off again until it is re-signed.
 *
 * Agents ship rule sets with `enabled: false` and an empty sign-off, and never sign them. The pin
 * uses the same canonical-JSON SHA-256 as the Mental Health Act timeframe sign-off
 * (`timeframeContentSha256` in `src/lib/mha-timeline.ts`), so one person can check both the same way.
 */

export type RuleSignOff = {
  /** The owner's switch. Even a signed rule set stays off until this is true. */
  readonly enabled: boolean;
  /** The clinician who checked every figure against its source, by name. */
  readonly signedBy: string | null;
  /** UTC ISO instant, e.g. "2026-10-04T01:30:00.000Z". */
  readonly signedAt: string | null;
  /** `ruleContentSha256(content)` at the moment of signing. */
  readonly signedContentSha256: string | null;
};

export type RuleGateOffReason =
  "unsigned" | "not-a-named-person" | "bad-sign-off-time" | "content-changed-since-sign-off" | "switched-off";

export type RuleGate = { readonly on: true } | { readonly on: false; readonly reason: RuleGateOffReason };

/** Plain words for each reason, for a screen or a log. */
export const RULE_GATE_REASON_WORDS: Readonly<Record<RuleGateOffReason, string>> = {
  unsigned: "Not yet signed by a named clinician",
  "not-a-named-person": "Signed by a system or role name, not a named clinician",
  "bad-sign-off-time": "The sign-off has no valid time",
  "content-changed-since-sign-off": "The rules changed after they were signed, so they need signing again",
  "switched-off": "Signed, but switched off",
};

/** The canonical, sign-off agnostic SHAPE every pin is taken over: keys sorted at every depth. */
function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalise(record[key])]),
  );
}

/** The sign-off pin for any rule content: SHA-256 hex of its canonical JSON. */
export function ruleContentSha256(content: unknown): string {
  return sha256Hex(JSON.stringify(canonicalise(content)));
}

/**
 * Names that identify software, a team or a role rather than a person who can be asked about a
 * figure. Lower-case, compared after trimming. "PsychSift" is here because the nine Mental Health
 * Act timeframes are currently marked reviewed by it, which the Today plan says is not a sign-off.
 */
const NOT_A_PERSON = new Set([
  "psychsift",
  "system",
  "admin",
  "administrator",
  "owner",
  "the owner",
  "claude",
  "codex",
  "agent",
  "ai",
  "bot",
  "automation",
  "locally reviewed",
  "reviewed",
  "clinician",
  "psychiatrist",
  "consultant",
  "test",
  "unknown",
  "lead",
  "director",
  "registrar",
  "manager",
  "call",
  "governance",
  "committee",
  "team",
  "service",
  "department",
  "signed",
  "unsigned",
  "tbd",
  "tba",
  "pending",
  "placeholder",
  "example clinician",
]);

/**
 * A real person's name: at least two words containing letters (a given name and a family name,
 * with or without a title such as "Dr"), and not a known system or role name.
 */
export function isNamedPerson(name: string | null | undefined): boolean {
  if (typeof name !== "string") return false;
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (NOT_A_PERSON.has(trimmed.toLowerCase())) return false;
  const words = trimmed.split(" ").filter((word) => /\p{L}/u.test(word));
  const titles = new Set(["dr", "dr.", "prof", "prof.", "professor", "a/prof", "mr", "ms", "mrs", "mx"]);
  const nameWords = words.filter((word) => !titles.has(word.toLowerCase()));
  return nameWords.length >= 2 && !nameWords.some((word) => NOT_A_PERSON.has(word.toLowerCase()));
}

const UTC_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** A real UTC ISO instant, never date-only and never an offset (mirrors the timeframe sign-off). */
export function isUtcIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !UTC_ISO_TIMESTAMP.test(value)) return false;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return false;
  const normalised = value.includes(".") ? value : value.replace(/Z$/, ".000Z");
  return new Date(milliseconds).toISOString() === normalised;
}

/** Whether a rule set may run, and if not, the first reason it may not. Fails closed. */
export function ruleGate(signOff: RuleSignOff, content: unknown): RuleGate {
  if (signOff.signedBy === null || signOff.signedBy.trim() === "") return { on: false, reason: "unsigned" };
  if (!isNamedPerson(signOff.signedBy)) return { on: false, reason: "not-a-named-person" };
  if (!isUtcIsoTimestamp(signOff.signedAt)) return { on: false, reason: "bad-sign-off-time" };
  if (signOff.signedContentSha256 !== ruleContentSha256(content)) {
    return { on: false, reason: "content-changed-since-sign-off" };
  }
  if (signOff.enabled !== true) return { on: false, reason: "switched-off" };
  return { on: true };
}

/** The empty sign-off every rule set ships with. */
export const UNSIGNED: RuleSignOff = Object.freeze({
  enabled: false,
  signedBy: null,
  signedAt: null,
  signedContentSha256: null,
});
