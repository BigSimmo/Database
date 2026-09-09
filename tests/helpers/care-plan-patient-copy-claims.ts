/**
 * The phrasings a Patient Plan may never carry when the record says the person
 * took no part in writing the Management Plan Version the copy derives from.
 *
 * These lived inside `tests/care-plan-linked-routes.dom.test.tsx`, where only
 * jsdom could reach them. The Chromium journey that prints the team-written
 * sheet needs exactly the same rule, and a second hand-written list beside this
 * one is how a rule about a patient-facing claim comes apart: two lists drift,
 * and the one nobody edits is the one guarding the printed page. So the literals
 * live here and both suites import them.
 *
 * Deliberately framework-free — no `expect`, no `vitest`, no `playwright` — so
 * the same module can be imported by a Vitest DOM suite and by a Playwright spec
 * without either runner's globals leaking into the other.
 *
 * Every phrase is spelled out literally rather than derived from the constants
 * the components render from. A content check that reads its subject's own
 * source of truth passes for any wording, including a defective one; that exact
 * shape shipped here once already, in the print footer's contract test.
 */

/**
 * Every claim of joint authorship the eight headings, lead-ins and opening
 * sentence used to make. None may survive anywhere on a `declined` or
 * `patient_unavailable` copy — on the authoring form, on the reading surface, or
 * on paper.
 *
 * From the user's decision of 25 August 2026 (`D4`): _"yes please stop saying
 * that they helped write it."_
 */
export const JOINT_AUTHORSHIP_CLAIMS: readonly RegExp[] = [
  /we wrote this together/i,
  /what we agreed will happen/i,
  /what we wrote down/i,
  /you have said/i,
  /you and your team agreed/i,
];

/**
 * Non-participation is never labelled non-compliance, and the sheet a person is
 * handed is the last place it could be. These are the shapes that would turn an
 * honest sentence into a reproach, spelled out so no future rewording can
 * reintroduce one by accident.
 */
export const REPROACH_SHAPES: readonly RegExp[] = [
  /declined/i,
  /unavailable/i,
  /without (?:your|this person's) involvement/i,
  /were not (?:available|able to)/i,
  /did not (?:take part|attend|want)/i,
  /refused|non-?compliance|non-?compliant|disengaged/i,
];

/**
 * The wording that prints instead, when the record says the person took no part.
 *
 * Two headings and three lead-ins, and only those five: where the predicate says
 * the plan genuinely was co-produced, today's warm copy is untouched. A test
 * pinning the set at exactly this size is what stops a later reader "finishing"
 * it by rewording the six honest headings that never made a claim.
 */
export const TEAM_WRITTEN_HEADINGS: readonly string[] = [
  "Why this plan was written",
  "What your team has agreed will happen when you come to the emergency department",
];

export const TEAM_WRITTEN_LEAD_INS: readonly string[] = [
  "This is what your team wrote down about why this plan exists.",
  "This is your team's understanding of what matters to you.",
  "This is the approach your team has agreed for when you come in.",
];

/**
 * The opening sentence that may print only when the person took part, quoted in
 * full so a partial match cannot let half of it through.
 */
export const PAPER_INTRO_TOGETHER =
  "This is your copy of the plan you and your team wrote together. Keep it somewhere you can find it quickly, and " +
  "bring it with you if you can. If something in it stops fitting, tell someone on your team so you can write it " +
  "again together.";

/** What prints otherwise: who wrote it, that it is theirs, and nothing about an absence. */
export const PAPER_INTRO_WRITTEN_BY_THE_TEAM =
  "This is your copy of the plan your team wrote for you. It is yours, and it is not fixed: read it whenever you " +
  "like, and tell someone on your team anything you would like changed, so the next one can be written with you. " +
  "Keep it somewhere you can find it quickly, and bring it with you if you can.";
