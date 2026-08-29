import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { TentativeDiagnosisBlock } from "@/components/ward-management/ward-diagnosis";
import type { HomeRegion, Sex } from "@/components/ward-management/ward-model";

/**
 * The admission — a person inside a bed.
 *
 * Until this module existed the prototype knew a ward had 20 beds, 3 empty and 2 held, and
 * nothing at all about anybody occupying one. Every occupancy figure was therefore a number a
 * ward hand-maintained, and no screen could say how long a bed had been taken, when it was coming
 * free, or how far from home somebody had been placed. This record is what those two features —
 * the ward board and the out-of-area ledger — are derived FROM.
 *
 * Three standing rules govern everything below, and each has already been broken once elsewhere
 * in this prototype:
 *
 *   1. **No figure from the Mental Health Act.** Not a duration, not a timeframe, not a
 *      threshold, in code, comment, test or fixture. Three separate agents have written three
 *      different invented statutory figures into this directory and each reached the screen
 *      before it was caught (`tests/ward-legal-figure-guard.test.ts` records all three). Nothing
 *      here is a legal clock: `expectedDischargeAt` is a ward's own plan and `STAY_BANDS` is a
 *      display grouping the product owner supplied.
 *   2. **Chosen, never typed.** Every category is a fixed runtime array with a membership check.
 *      There is no `notes`, `note`, `comment` or free-text field of any kind, so the
 *      synthetic-data promise is true by construction rather than by a user reading a label and
 *      complying.
 *   3. **A TENTATIVE diagnosis, chosen from eleven broad blocks, and nothing finer.** This rule
 *      used to read "no diagnosis, and no placeholder for one". **The owner reversed that on
 *      2026-08-29**, in his words: "It can give a tentative diagnosis. This is because most
 *      referrals will require a diagnosis", and "Just create broad core categories used in
 *      Australia for mental health coding for now". `tentativeDiagnosis` below is that decision
 *      and the whole of it — a single value picked from `TENTATIVE_DIAGNOSIS_BLOCKS`, never
 *      typed, never a specific condition, never anybody's words. The record still carries no
 *      name, date of birth, record number, address or narrative history, and
 *      `tests/ward-admission-model.test.ts` asserts the field set structurally — widened in the
 *      SAME change as this field, by name, so the guard bound on it rather than being stepped
 *      around.
 *
 * Everything in this module — the type, its vocabularies and its helpers — lives in this ONE
 * file. Nothing here belongs in `ward-model.ts`.
 */

/**
 * The four states an admission passes through, in lifecycle order.
 *
 *   - `waitlisted` — accepted in principle, no bed given. Consumes nothing.
 *   - `pulled`     — the ward has GIVEN THE BED AWAY to this person. They may still be in an
 *                    emergency department waiting for transport. The bed is gone from this
 *                    moment; see `bedIsOccupied`.
 *   - `occupied`   — the person is physically in the bed.
 *   - `left`       — gone. The bed is released; see `LEAVING_DESTINATIONS` for what "discharged"
 *                    means to the state as opposed to this ward.
 *
 * A runtime array beside the union, the same treatment every other union in this feature that
 * needs a picker carries (`SEXES`, `COHORTS`, `SEX_DESIGNATIONS`, `MOVEMENT_STAGES`). A
 * hand-written `AdmissionState[]` option list in a component is how `COHORTS` came to silently
 * omit `"Youth"` from a picker — typed as the union, so widening it could never make the picker
 * fail to compile.
 */
export const ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "left"] as const;
export type AdmissionState = (typeof ADMISSION_STATES)[number];

export type StayBandId = "under-2-weeks" | "2-weeks-1-month" | "1-3-months" | "over-3-months";

export type StayBand = {
  id: StayBandId;
  label: string;
  /**
   * The exclusive ceiling in days: a stay belongs to the first band whose ceiling it is strictly
   * BELOW, so exactly 14 days has already left `under-2-weeks`. `null` marks the single open-ended
   * band, which must be last — a `null` ceiling anywhere earlier would swallow every longer stay
   * and `stayBand` would stop discriminating without a band id changing.
   */
  upToDays: number | null;
};

/**
 * How long someone has been in a bed, as a display grouping.
 *
 * **These four bands were supplied verbatim by the product owner.** They are HIS, and they are
 * the whole reason a number appears in this file at all. They are not a clinical threshold, not
 * derived from any evidence, and above all not a figure from the Mental Health Act — nothing here
 * has any legal meaning whatsoever, and a band boundary must never be read, rendered or reused as
 * though a statute set it.
 *
 * **Why these boundaries and not the previous 1 week / 4 weeks / 3 months** — the owner's own
 * reasoning, recorded because the next implementer to look at a band boundary should find the
 * argument rather than re-derive it. A shade only informs if it splits the population somewhere
 * meaningful. Acute psychiatric stays typically clear within a fortnight, so a one-week boundary
 * sat BEFORE most people had left: the palest band held nearly everyone, and a colour nearly every
 * tile carries tells a coordinator nothing. Moving the first boundary to a fortnight puts it where
 * the population actually divides, and the three bands above it describe the stays that are
 * genuinely unusual for this ward.
 *
 * **This set replaces the previous one everywhere — there is never a second set.** The tile
 * colouring and the ward statistics both read THESE bands, from here. A tile shaded by one set of
 * boundaries while a statistic counts by another is the failure this feature has refused at every
 * decision point, and it is refused by there being exactly one array.
 *
 * **There is deliberately no "target" band, and none may be added.** A band saying a stay is
 * longer than it should be would be a threshold nobody agreed to, applied to a person, on a
 * screen a ward reads every morning. Adding one is a recorded product decision from the owner by
 * name and date — never an implementer's convenience, and never an inference from the four bands
 * below. The same bar applies to changing a boundary: these values came from him and only he
 * replaces them.
 */
export const STAY_BANDS: readonly StayBand[] = [
  { id: "under-2-weeks", label: "Under 2 weeks", upToDays: 14 },
  { id: "2-weeks-1-month", label: "2 weeks – 1 month", upToDays: 30 },
  { id: "1-3-months", label: "1–3 months", upToDays: 90 },
  { id: "over-3-months", label: "Over 3 months", upToDays: null },
];

export type LeavingDestination =
  | "discharged-to-the-community"
  | "transferred-to-another-psychiatric-ward"
  | "transferred-to-a-general-hospital"
  | "moved-to-residential-care"
  | "left-against-advice";

/**
 * Where someone went, and — the part that matters — whether the STATE got a bed back.
 *
 * `countsAsStatewideRelease` is `false` for exactly one destination, and that `false` is the
 * reason this list exists as data rather than as a string. A transfer to another psychiatric ward
 * frees the SENDING ward's bed and gives the network nothing at all: the person still occupies a
 * psychiatric bed, just a different one. Counting it as a release would let the board report beds
 * coming free that were never free, and the error compounds every time a person is moved between
 * wards. Every other destination genuinely returns a bed to the state.
 *
 * The destinations are operational facts about where a bed went, never a judgement about the
 * person: "left against advice" records that the admission ended without the ward's agreement,
 * which is a fact about the departure, and nothing here describes anyone's condition or conduct
 * beyond that.
 */
export const LEAVING_DESTINATIONS: readonly {
  id: LeavingDestination;
  label: string;
  countsAsStatewideRelease: boolean;
}[] = [
  { id: "discharged-to-the-community", label: "Discharged to the community", countsAsStatewideRelease: true },
  // The one `false`. See this array's own doc comment — do not "tidy" it to true for consistency.
  {
    id: "transferred-to-another-psychiatric-ward",
    label: "Transferred to another psychiatric ward",
    countsAsStatewideRelease: false,
  },
  {
    id: "transferred-to-a-general-hospital",
    label: "Transferred to a general hospital",
    countsAsStatewideRelease: true,
  },
  { id: "moved-to-residential-care", label: "Moved to residential care", countsAsStatewideRelease: true },
  { id: "left-against-advice", label: "Left against advice", countsAsStatewideRelease: true },
];

/**
 * Why a pull was released — the bed given back before the person ever reached it.
 *
 * Chosen never typed, like every fixed list in `ward-change-reasons.ts`, and about THE NETWORK OR
 * THE JOURNEY rather than a judgement about the person: transport did not come, a bed was found
 * somewhere else, the pull was made in error. "Clinical condition changed" is the one entry that
 * touches clinical ground and it is deliberately blunt — it records that the plan stopped being
 * the right one, and says nothing about what changed, in which direction, or about anybody.
 *
 * "Admission declined" deliberately drops the person-token the brief for this task used
 * ("declined by patient"), following the same discipline `changeReasonLabels` already applies to
 * `patient_no_longer_coming` and `patient_not_ready`: the recorded fact is that the admission was
 * declined, which is complete without naming who declined it.
 *
 * Like `ESCALATION_CONTACTS` and `BED_RELEASE_BLOCKERS`, the values ARE the rendered text — there
 * is no clinical token to keep out of a label here to begin with. Nothing on `Admission` carries
 * one of these yet; the vocabulary is defined here so that the release event, when it is built,
 * has one list to draw from rather than inventing a second.
 */
export const PULL_RELEASE_REASONS = [
  "Clinical condition changed",
  "Transport unavailable",
  "Placed elsewhere",
  "Admission declined",
  "Pulled in error",
] as const;
export type PullReleaseReason = (typeof PULL_RELEASE_REASONS)[number];

/**
 * A person inside a bed — or on their way to one, or gone from one.
 *
 * The field set is EXACTLY what is below and nothing else. It is not a patient record and must
 * never grow into one: no name, date of birth, record number, address, narrative history or free
 * text, ever. `tests/ward-admission-model.test.ts` checks that structurally, both against
 * `ADMISSION_FIELDS` at runtime and against a fully-populated literal under `tsc`, so a future
 * `notes` field fails a test rather than being caught by a reviewer's memory. Widening this list
 * is a governance decision, not an implementation one — `tentativeDiagnosis` is the third time
 * that decision has been taken, and it was taken by the owner, on the record, on 2026-08-29.
 *
 * Optionality is expressed as `| null`, never as an optional `?` field: a fact nobody has
 * recorded is present-and-empty rather than absent, so a screen has to look at it and decide what
 * to render instead of silently reading `undefined` as a zero or a "no".
 */
export type Admission = {
  id: string;
  /** The bed's unit. An admission belongs to one unit at a time; a transfer ends this admission
   *  (`state: "left"`, `leavingDestination: "transferred-to-another-psychiatric-ward"`) and
   *  begins a new one, which is what keeps each ward's own occupancy honest. */
  unitId: string;
  /** The referral this admission came from — the join back to the front door, and the only place
   *  the person's referral facts live. They are not copied onto this record. */
  referralId: string;
  /**
   * A DELIBERATE, OWNER-CONFIRMED WIDENING of what this feature holds about a person, and the
   * only one this record makes.
   *
   * Its purpose is structural: a ward's male/female counts (`Unit.sexMix`) are currently
   * hand-maintained numbers that nothing derives and nothing can check. Holding `sex` on the
   * admission makes those counts DERIVED from the people actually in the beds, so a ward's mix
   * can no longer silently disagree with its own occupancy. That is the whole justification —
   * not display, not filtering, and certainly not a person-fact collected because it was
   * available. `homeRegion` beside it is the same shape for the out-of-area ledger.
   *
   * A copy, not a new fact: both are already on the `Referral` this admission came from. They are
   * carried here so occupancy figures can be computed from beds rather than from referrals.
   */
  sex: Sex;
  /** The broad area this person is from — a region, never an address; membership-checked, never
   *  free text. Carries no distance or ordering by proximity of its own: `ward-distance.ts` is
   *  the single entry point for how far a bed is from a home region, and no band is ever stored
   *  on this record. */
  homeRegion: HomeRegion;
  /**
   * THE BROAD BLOCK A REFERRAL TENTATIVELY PLACED THIS PERSON IN — and the word tentative is load
   * bearing in the field name, in the vocabulary's name, on every screen that shows it, and here.
   *
   * **A DELIBERATE, OWNER-RULED WIDENING of this record's field set (2026-08-29), the third one it
   * has taken, and the first that is a fact about the PERSON rather than about the ward's own act.**
   * It reverses rule 3 at the top of this file, which until this change said the record held no
   * diagnosis and no placeholder for one. The owner's words: "It can give a tentative diagnosis.
   * This is because most referrals will require a diagnosis." The permission is his and the reason
   * is his; nothing here is an implementer widening a record because a screen looked bare.
   *
   * **What this is NOT.** It is not a diagnosis anybody has confirmed, examined for, or agreed
   * with. It is what a referral said on the way in, at the coarsest resolution the Australian
   * coding standard defines — one of eleven blocks covering the whole of ICD-10-AM Chapter V. A
   * board that read it as settled would be reading something this record cannot say, which is why
   * every renderer of it carries the word "tentative" and why `TENTATIVE_DIAGNOSIS_BLOCKS` is
   * named for the tentativeness rather than for the classification.
   *
   * **Chosen, never typed** (rule 2, and this is the field it protects hardest). The value is one
   * of eleven fixed strings with a membership check; there is no free-text path to it and there
   * must never be one. That single rule is what keeps a patient's own words, a clinician's
   * impression, and a narrative history out of this prototype entirely — not a label asking a user
   * to be careful.
   *
   * `null` — an ordinary state, seeded deliberately — means nobody recorded one. It must never
   * read as "no mental illness", as "not yet assessed", or as a slot a ward is expected to fill
   * in: see the ward board, which says the absence in words rather than drawing an empty field.
   */
  tentativeDiagnosis: TentativeDiagnosisBlock | null;
  state: AdmissionState;
  /** When the ward gave the bed away. The bed is gone from this instant — but a stay does NOT
   *  start here; see `daysInBed`. `null` while waitlisted. */
  pulledAt: Instant | null;
  /** When the person physically arrived. The stay clock, and the ONLY clock a length of stay is
   *  ever measured from. `null` until they get here — including for a pulled bed. */
  arrivedAt: Instant | null;
  /**
   * When this person left the ward for an emergency department, or `null` while they are on it.
   *
   * **THE BED STAYS OCCUPIED AND THIS FIELD MUST NEVER CHANGE THAT.** A ward sending somebody to
   * an ED for a medical problem is usually holding the bed, because they are coming back. So this
   * is deliberately NOT an `AdmissionState`, NOT a `LeavingDestination`, and nothing in
   * `bedIsOccupied`, `capacityBreakdown` or any availability figure reads it. Every one of those
   * routes would free a bed that is not free, which is the single failure this model exists to
   * prevent — a coordinator offering a bed a ward is still keeping.
   *
   * **It is a fact about the PERSON, which is why it is a field and not a state.** `AdmissionState`
   * is `waitlisted | pulled | occupied | left` and every member is about the BED. Putting "away at
   * an ED" in there is how `"pulled"` comes to look like the nearest fit when it is the mirror
   * image — someone in an ED whose ward bed has already gone.
   *
   * **An instant rather than a boolean, following `pulledAt`.** A ward reading the board wants to
   * know how long, not merely whether: somebody six hours in an ED is a different conversation
   * from somebody thirty minutes in. One field carries both facts and cannot disagree with itself.
   *
   * Owner decision, 2026-08-30: the board marks a patient who is temporarily off the ward. Without
   * it their tile is an ordinary occupant — day count, stay band, tentative diagnosis — and a
   * charge nurse reading the grid believes they are in the bed.
   */
  awayAtEmergencyDepartmentSince: Instant | null;
  /**
   * When the ward currently expects this person to leave. A WARD'S OWN PLAN, revisable at will
   * and carrying no legal or contractual weight of any kind — never a deadline, never a target,
   * never a figure derived from any statute. `null` means nobody has set one, which is a real and
   * ordinary state: see `isPastExpectedDischarge` for why that must never read as "not yet due"
   * OR as "overdue".
   */
  expectedDischargeAt: Instant | null;
  /** How many times the expected date has been moved. A count of revisions to the WARD'S plan,
   *  never a measure of a person — it says the plan kept changing, not that anybody was slow. */
  dischargeDateMoves: number;
  /** When the current expected date was set. `null` when there is none. */
  dischargeDateSetAt: Instant | null;
  /** WHO set it, as a ROLE — "Flow coordinator", "Nurse unit manager" — and NEVER a personal
   *  name. Same discipline as `Referral.decidedBy` and `StatusChange.by`. `null` when no expected
   *  date has been set. */
  dischargeDateSetBy: string | null;
  /**
   * When the ward CONFIRMED this discharge is happening — a decision, not a plan.
   *
   * **A DELIBERATE, OWNER-RULED WIDENING of this record's field set (2026-08-29), the second one
   * it has taken.** It is here because the two facts are genuinely different and the record could
   * previously express only one of them: `expectedDischargeAt` is what the ward EXPECTS, revisable
   * at will; this is the ward saying it has DECIDED. An earlier implementer building
   * `derivedBedReleases` (`ward-discharge-dates.ts`) found the `"confirmed"` stage unreachable for
   * exactly that reason — nothing on this record distinguished a decided departure from a planned
   * one — and declined to invent a proxy for it (a date falling within some window, a revision
   * count of zero, a date set long enough ago). That refusal was correct: every one of those
   * proxies renders a ward decision that nobody made, on a screen a coordinator reads as fact.
   * These two fields are the fix, and they are the ONLY route to `"confirmed"`.
   *
   * This is not a widening of what this record holds about a PERSON. It is a fact about the ward's
   * own act, in exactly the category `dischargeDateSetAt` already occupies. That remains true of
   * these two fields; what has changed since they were written is rule 3 itself, which the owner
   * reversed on 2026-08-29 to permit `tentativeDiagnosis` and nothing else. Still no name, date of
   * birth, record number, address or free text, ever.
   *
   * `null` — the ordinary state — means nobody has confirmed anything, which must never be read as
   * a refusal or as a discharge that will not happen. It means the decision has not been taken.
   */
  dischargeConfirmedAt: Instant | null;
  /** WHO confirmed it, as a ROLE and NEVER a personal name — the same bar `dischargeDateSetBy`
   *  above holds to, and for the same reason: this record names wards and jobs, never people.
   *  Kept separate from `dischargeDateSetBy` because setting a date and deciding a discharge is
   *  happening are two different acts, and the ward that did one may not be who did the other.
   *  `null` when nothing has been confirmed. */
  dischargeConfirmedBy: string | null;
  /**
   * What is holding the bed up, drawn from `BED_RELEASE_BLOCKERS` — the owner-approved list of
   * eight, reused rather than restated. A second blocked-reason vocabulary for this one fact is
   * the defect class this repository produces most reliably: two lists for one fact is how a
   * screen ends up giving two answers, and the copy drifts the day an entry is added to one of
   * them. If a blocker is missing it is added THERE.
   */
  blockReason: BedReleaseBlocker | null;
  /** Where this person went, once they have gone. `null` until then. */
  leavingDestination: LeavingDestination | null;
  /** When they went. `null` until then. */
  leftAt: Instant | null;
};

/**
 * The permitted field set, at runtime.
 *
 * Derived from a total `Record<keyof Admission, true>`, so the compiler refuses a field added to
 * `Admission` and left out of this record — and once it is in, the structural privacy test in
 * `tests/ward-admission-model.test.ts` fails under plain `vitest run`, with no `tsc` step. That
 * combination is the point: a type-only allowlist is invisible to the focused test an implementer
 * actually runs while working, which is exactly how a field slips in unnoticed.
 */
const ADMISSION_FIELD_PRESENCE: Record<keyof Admission, true> = {
  id: true,
  unitId: true,
  referralId: true,
  sex: true,
  homeRegion: true,
  tentativeDiagnosis: true,
  state: true,
  pulledAt: true,
  arrivedAt: true,
  awayAtEmergencyDepartmentSince: true,
  expectedDischargeAt: true,
  dischargeDateMoves: true,
  dischargeDateSetAt: true,
  dischargeDateSetBy: true,
  dischargeConfirmedAt: true,
  dischargeConfirmedBy: true,
  blockReason: true,
  leavingDestination: true,
  leftAt: true,
};

export const ADMISSION_FIELDS: readonly string[] = Object.keys(ADMISSION_FIELD_PRESENCE);

/** Membership check for the blocker vocabulary — chosen, never typed. */
export function isBedReleaseBlocker(value: string): value is BedReleaseBlocker {
  return (BED_RELEASE_BLOCKERS as readonly string[]).includes(value);
}

/**
 * Whether this admission is consuming a bed right now.
 *
 * **`"pulled"` counts, and this must NEVER be "corrected" to require `arrivedAt`.** The ward gives
 * the bed away at the pull; the person may still be in an emergency department awaiting transport,
 * so `arrivedAt` is null and the bed reads as empty to anyone who checks arrival. It is not empty.
 * It is spoken for, and offering it again is a double-allocation — the ward finds out when two
 * people arrive for one bed.
 *
 * The tightening looks entirely reasonable in review ("nobody is in it yet"), which is why it is
 * pinned by a constructed test rather than left to this comment.
 */
export function bedIsOccupied(admission: Admission): boolean {
  return admission.state === "pulled" || admission.state === "occupied";
}

/**
 * Whole days this person has been in the bed, or `null` if they have not arrived.
 *
 * **Counted from `arrivedAt`, NEVER from `pulledAt`.** These are two different clocks: the bed has
 * been gone since the pull, but the person's stay runs from arrival. Reading `pulledAt` here would
 * overstate every length of stay by the transport delay — silently, in the same direction every
 * time, on every screen at once, which is precisely how such a swap survives review.
 *
 * Degrades conservatively and never throws: a missing or non-finite instant yields `null` (no
 * answer), never a substituted fallback. An arrival later than `now` is incoherent data rather
 * than a negative stay, so the result is floored at zero.
 */
export function daysInBed(admission: Admission, now: Instant): number | null {
  const arrivedAt = admission.arrivedAt;
  if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor((now - arrivedAt) / MINUTES_PER_DAY));
}

/**
 * The band this stay falls in, or `null` when there is no stay to band.
 *
 * `null` for someone who has not arrived — a pulled-but-empty bed has no stay yet, and banding it
 * as `under-2-weeks` would present a person as having just arrived somewhere they have not
 * reached. An absent stay is shown as absent, the same discipline `ward-distance.ts` holds for an
 * unrecorded travel band: a gap is a gap, never the first entry in a list.
 *
 * A stay belongs to the first band whose `upToDays` it is strictly below, so exactly 14 days has
 * already left `under-2-weeks`. The final band's `null` ceiling catches everything longer.
 */
export function stayBand(admission: Admission, now: Instant): StayBand | null {
  const days = daysInBed(admission, now);
  if (days === null) return null;
  return STAY_BANDS.find((band) => band.upToDays === null || days < band.upToDays) ?? null;
}

/**
 * Whether the ward's own expected discharge date has passed.
 *
 * **`false` when the date is null.** An absent date must never read as "past due", and equally
 * never as "not yet due" — nobody has said when this person is expected to leave, so nothing here
 * may claim either. The same discipline `LegalForm.dueAt` holds elsewhere in this model: never
 * substitute a fallback for an absent instant, and render its absence explicitly rather than
 * letting a boolean answer a question it has no basis to answer.
 *
 * Non-finite instants take the same conservative route — `false`, never a throw.
 */
export function isPastExpectedDischarge(admission: Admission, now: Instant): boolean {
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected) || !Number.isFinite(now)) return false;
  return now > expected;
}

/**
 * The LIVE admissions on a unit — everything except `"left"`.
 *
 * Waitlisted and pulled admissions are included even though only the pulled one consumes a bed
 * (`bedIsOccupied` is what decides that, and is deliberately a separate question): a ward board
 * needs to see who is coming as well as who is here. Departed admissions are excluded because a
 * ward that never drops them fills up and stays full forever.
 */
export function admissionsForUnit(admissions: readonly Admission[], unitId: string): Admission[] {
  return admissions.filter((admission) => admission.unitId === unitId && admission.state !== "left");
}
