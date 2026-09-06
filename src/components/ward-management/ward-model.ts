import type { Instant } from "@/components/ward-management/ward-clock";
// A TYPE-ONLY import, and it introduces no cycle: `ward-patients.ts` imports nothing at all.
import type { PatientId } from "@/components/ward-management/ward-patients";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  LegalStatusChangeReason,
  UrgencyChangeReason,
  OverrideReason,
  WithdrawalReason,
} from "@/components/ward-management/ward-change-reasons";

/**
 * The health services, as a runtime array with the type derived from it — the same shape as
 * `COHORTS`, `SEXES`, `SEX_DESIGNATIONS`, `MOVEMENT_STAGES`, `DECLINE_REASONS`,
 * `BED_RELEASE_STATES` and `BED_RELEASE_WAITING_ON` below.
 *
 * WHY THIS CHANGED, 2026-08-29. It was a bare type union — the only multi-value union in this file
 * without a companion array — and that made a real hole rather than an inconsistency. The five
 * services were re-typed by hand in two more places (`wardServiceOrder` in `ward-derivations.ts`,
 * `columnServices` in `ward-management-network.tsx`), nothing checked those copies for
 * completeness, and `ward-management-network.tsx` tests membership through a `readonly string[]`
 * cast, so the compiler could not catch it either.
 *
 * The consequence, in the owner's own terms: he intends to replace this invented network with real
 * WA figures and to "build another hospital" later. A hospital in a SIXTH service would compile
 * clean and then be absent from the network map and the ED screen's unit table — no error, no
 * failing test, the service simply not there. This file's own `COHORTS` comment records the same
 * defect having happened once already with `Cohort`.
 *
 * A runtime array does not by itself close that. It makes the completeness of the other two lists
 * CHECKABLE, which `tests/ward-flow-service-coverage.test.ts` then checks.
 */
export const HEALTH_SERVICES = ["North Metro", "South Metro", "East Metro", "WACHS", "Private"] as const;
export type HealthService = (typeof HEALTH_SERVICES)[number];
/**
 * Widened for Phase 7 (spec "The front door"): a referral can arrive for a young person, and
 * without a `"Youth"` cohort every youth referral would fail the cohort gate in
 * `ward-eligibility.ts` against every unit in the network for a structural reason, not an
 * operational one. `ward-sites.ts` seeds exactly one Youth unit — see its own comment for why
 * that unit is a real, product-owner-supplied fact and not an invention.
 *
 * Fix round B (review finding I3): given a runtime members array, `COHORTS`, matching every
 * other 3+-value union in this file (`SEX_DESIGNATIONS`, `REFERRAL_SOURCES`, `REFERRAL_STATES`,
 * `REFERRAL_DECLINE_REASONS`, `MOVEMENT_STAGES`, `DECLINE_REASONS`, `BED_RELEASE_STATES`).
 * `Cohort` was the one union in this file with no such array, and a hand-maintained
 * `COHORT_OPTIONS: Cohort[]` picker in `ed-screen.tsx` silently omitted `"Youth"` as a result —
 * typed as `Cohort[]` rather than derived from this list, so widening the union could never make
 * the picker fail to compile. Named `COHORTS` (the type-derived plural, matching
 * `SexDesignation` → `SEX_DESIGNATIONS`) rather than `AGE_BANDS`, even though the `Referral`
 * field carrying it is `ageBand` — the array names the TYPE, like every neighbour above, not the
 * field. `ed-screen.tsx` now derives `COHORT_OPTIONS` from this array directly.
 */
export const COHORTS = ["Adult", "Older adult", "Youth"] as const;
export type Cohort = (typeof COHORTS)[number];
export type Security = "Open" | "Secure";

/**
 * Fix round C (Phase 7 Task 5, review finding I3 all over again): `Sex` and urgency were the
 * two remaining 2/3-value unions in this file with no runtime array of their own — see
 * `COHORTS`'s own doc comment above for the defect class this closes, and for why every other
 * 3+-value union here (`SEX_DESIGNATIONS`, `REFERRAL_SOURCES`, `REFERRAL_STATES`,
 * `REFERRAL_DECLINE_REASONS`, `MOVEMENT_STAGES`, `DECLINE_REASONS`, `BED_RELEASE_STATES`) already
 * carries one. `SEXES` and `URGENCY_LEVELS` below are what every Sex/urgency `<select>` in this
 * codebase (`referral-intake.tsx`, `ed-screen.tsx`, `shortlist-panel.tsx`) must now derive its
 * option list from, never a hand-written array — and so must any picker added later. (M11:
 * `referral-match.tsx` was listed here too and has no Sex or urgency picker at all; its only
 * `<select>` is the decline reason, correctly derived from `REFERRAL_DECLINE_REASONS`.) This is
 * the same fix Task 4 already applied to `COHORT_OPTIONS` in `ed-screen.tsx`, generalised to the
 * two unions it left behind.
 */
/**
 * THE CLOSED SET OF `Movement.blocker` VALUES THAT MEAN NOTHING IS HOLDING THE MOVEMENT UP.
 *
 * ⚠️ `Movement.blocker` — the free-prose one. NOT `BedRelease.blocker`, the `BedReleaseBlocker`
 * enum that shares the name. Nothing here applies to that field.
 *
 * **Why a closed set rather than a pattern, and this is a repair of a defect this file shipped
 * on 2026-09-01.** `hasActiveBlocker` (ward-priority.ts) used to recognise "nothing is blocking"
 * by matching the literal `"No blocker"` and a regex for `"None"` followed by a dash or colon —
 * both CASE-SENSITIVE. That was safe while the only writers were the fixture and the reducer,
 * because both wrote from a fixed vocabulary. `RECORD_MOVEMENT_BLOCKER` then let a person type
 * ANY non-blank prose, and the two halves stopped matching: a nurse clearing a blocker with
 * `"none — resolved"`, `"no blocker"`, `"Nothing outstanding"`, `"N/A"` or `"Cleared"` left the
 * movement scoring ten points as actively obstructed in `operationalScore`, and so sitting higher
 * in the queue than it should — silently, with nothing red anywhere.
 *
 * ⚠️ **THE COMPUTED KIND OF WRONG, NOT THE DISPLAYED KIND.** A wrong sentence is read by a person
 * who can disbelieve it; a wrong score is acted on by a system that cannot.
 *
 * **The remedy is not a wider pattern.** Chasing phrasings is unbounded and the next one is missed
 * too, and a case-insensitive `/^none/i` would swallow `"None of the secure units can take him"` —
 * a REAL blocker, pinned by `tests/ward-priority.test.ts` for exactly this reason. So clearing gets
 * its own representation instead (`CLEAR_MOVEMENT_BLOCKER`), and this list stays a closed set that
 * cannot grow by invention: the reducer's own sentinels, plus the two legacy values the
 * hand-authored fixture already carries.
 *
 * ⚠️ **A CONSEQUENCE, STATED RATHER THAN HIDDEN: TYPED PROSE IS ALWAYS AN OBSTRUCTION.** Somebody
 * who types `"Nothing outstanding"` into the blocker box still scores as blocked, because this set
 * does not interpret English and must not start. Two things make that acceptable rather than a
 * relocation of the same defect — the Clear control exists so nobody has to guess magic words, and
 * `RECORD_MOVEMENT_BLOCKER` refuses a value that differs from a member of this list ONLY by case,
 * naming the control instead. That refusal is exact-equality-ignoring-case against this closed set,
 * never a pattern, so it cannot reach `"None of the secure units can take him"`.
 */
export const BLOCKERS_MEANING_NOTHING_IS_BLOCKING = [
  /** Legacy, hand-authored: the generated fixture movements' own "nothing here" value. */
  "No blocker",
  /** Legacy, hand-authored AND written by the reducer at `PATIENT_COLLECTED`. */
  "None — in transit",
  /** Legacy, hand-authored AND written by the reducer at `PATIENT_ARRIVED`. */
  "None — handover complete",
  /** Written by the reducer at the two closures that are not an arrival. */
  "None — the movement did not proceed",
  /** Written by `CLEAR_MOVEMENT_BLOCKER` — a person saying the obstruction is gone. Distinct from
   *  "No blocker", which means nobody ever recorded one: an absence with its reason, the same
   *  distinction the two "None — …" values above exist to preserve. */
  "None — cleared",
] as const;

export type BlockerMeaningNothingIsBlocking = (typeof BLOCKERS_MEANING_NOTHING_IS_BLOCKING)[number];

export const SEXES = ["Female", "Male"] as const;
export type Sex = (typeof SEXES)[number];

/** See `SEXES`'s own doc comment immediately above — the same fix, for urgency. */
export const URGENCY_LEVELS = [1, 2, 3] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

/**
 * Phase 7 (spec "The front door"): the bed-facing counterpart of `Sex`, and a CONSTRAINT on who
 * may occupy a bed, never a value to compare a referral's `sex` against for equality.
 * `"Undesignated"` is the default and — by construction of the seed fixture in `ward-sites.ts` —
 * the clear majority: an undesignated bed accepts a referral of either sex. `"Female only"` and
 * `"Male only"` each narrow that acceptance to one sex. A matching rule of the shape
 * `bed.sexDesignation === referral.sex` is wrong for the same reason `unit.security === "Secure"`
 * would be wrong for `unit.authorised` — it reads as a plausible equality check while actually
 * excluding every undesignated bed, which is most of the network. The seed fixture deliberately
 * keeps most units undesignated (never all of them, and never uniform) so that exact mistake
 * cannot pass every test.
 */
export const SEX_DESIGNATIONS = ["Undesignated", "Female only", "Male only"] as const;
export type SexDesignation = (typeof SEX_DESIGNATIONS)[number];

export const MOVEMENT_STAGES = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
  "pulled",
  "handover_ready",
  "moving",
  "arrived",
] as const;
export type MovementStage = (typeof MOVEMENT_STAGES)[number];

export const DECLINE_REASONS = [
  "no_bed",
  "sex_mix",
  "specialling_unavailable",
  "acuity_mix",
  "capability_mismatch",
  "bed_pulled_for_earlier_referral",
  "out_of_catchment",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/**
 * `STEP_BACK_STAGE` and `WITHDRAW_ACCEPTANCE` (Task 5, ward-flow movement step-track plan,
 * 2026-09-04). Chosen, never typed — the same discipline `DECLINE_REASONS` above already has, and
 * placed alongside it in this file rather than in `ward-change-reasons.ts` (where every other
 * fixed reason list lives) because this build's assigned scope is a fixed, narrow set of files
 * that does not include `ward-change-reasons.ts`. `DECLINE_REASONS` is the existing precedent for
 * a reason list living in this file instead — chosen and content-free either way.
 *
 * ⚠️ **`WITHDRAW_ACCEPTANCE` reuses this list rather than a second one of its own** — owner ruling
 * 1 of 2026-09-04's five rulings, accepted as proposed: a second vocabulary for one concept is
 * exactly the "two places for one fact" this project's standing rule forbids, and all four reasons
 * read naturally for a withdrawal too.
 *
 * ⚠️ **THE WARD READS THESE; THE STEP-BACK READER DOES NOT** (same ruling, recorded rather than
 * acted on). `STEP_BACK_STAGE` is a coordinator's own record correction, seen only on the
 * coordinator's screen. `WITHDRAW_ACCEPTANCE` tells a ward its earlier "yes" no longer holds, and
 * if a ward-facing rendering of these reasons is ever built, the wording is revisited then — do
 * not pre-empt it now by writing ward-facing prose into a coordinator-facing label.
 *
 * ⚠️ **NO LABEL MAP ENTRY EXISTS FOR THESE FOUR YET.** `changeReasonLabels` (`ward-change-reasons.ts`)
 * is a UI-facing lookup outside this build's scope, deferred alongside the reason picker control
 * and the DOM test that would exercise it — see the handover note for this task. Add the four
 * labels there, keeping the `the_patient_situation_changed` → `"The situation changed"` label
 * (never the value) free of the token "patient", before wiring any picker to this list.
 */
export const STEP_BACK_REASONS = [
  "recorded_in_error",
  "the_decision_changed",
  "the_patient_situation_changed",
  "the_bed_was_lost",
] as const;
export type StepBackReason = (typeof STEP_BACK_REASONS)[number];

/** Referring to more than three units at once spams wards and erodes trust between services. */
export const PARALLEL_REFERRAL_CAP = 3;

export type LegalStatus =
  "Voluntary" | "Referred for psychiatric examination" | "Detained awaiting examination" | "Involuntary inpatient";

/**
 * The legal clock and the ED clock are different clocks (spec "Model changes this phase
 * requires", `Movement.formedAt`). `dueAt`, when present, is the legal clock — a statutory
 * deadline a specific form carries. Task 6A first established that a Form 3B ("inpatient
 * treatment order") has no such deadline: put to the clinician directly, his answer was that
 * the post-examination clock "is just counting how long they have been in ED determining
 * priority. So counting up," i.e. not a legal countdown at all. This model briefly gave a Form
 * 1A ("referral for examination") an authored `dueAt` on the strength of an unverified figure
 * an earlier agent wrote into this file from its own recollection, not from the clinician.
 * Asked directly on 2026-08-23, the product owner's instruction was narrower than a corrected
 * figure — "please can you leave the legal part and just start a clock once the patient arrives
 * to ED. Keep it simple for now" — so as of that date **neither a Form 1A nor a Form 3B carries
 * a `dueAt` in this model.** (The transport/transfer forms — 4A, "Transport order"; 4C,
 * "Transfer between authorised hospitals" — are a different question, out of scope for this
 * correction, and still carry real `dueAt` figures unrelated to the examination timeline this
 * comment is about.) The field stays optional (never required) precisely so a form can honestly
 * carry none, the same shape Task 6A gave a 3B and this now gives a 1A too. Never substitute a
 * fallback number for an absent `dueAt`, never let an absent `dueAt` read as "clear" or "not yet
 * due" — render its absence explicitly — and never reintroduce a `dueAt` on a 1A or 3B without a
 * figure that traces back to the clinician or product owner by name and date, not to an
 * assistant's recollection of the Mental Health Act.
 */
export type LegalForm = {
  code: string;
  /**
   * **There is deliberately no `label` field.** Ward Flow does not hold form titles; the Chief
   * Psychiatrist's register does, and `legalFormName` in `ward-legal-forms.ts` resolves one from
   * `code` at render time. Removed on 2026-08-24, when the product owner approved adopting the
   * official titles — a stored label is how this model came to render "Inpatient treatment
   * order" (the title of a Form **6A**) on every Form 3B. A code the register does not list has
   * no title and is rendered as the bare code. Do not reintroduce this field.
   *
   * What kind of instrument the form is. Optional: this model holds no classification for a
   * Form 3D, and guessing one would be a claim about the Mental Health Act this prototype is
   * not entitled to make. No ward surface reads this field — it is carried, not displayed, and
   * it is deliberately NOT taken from the register's `category`, which the product owner did
   * not approve adopting.
   */
  kind?: "examination" | "detention" | "transport" | "transfer";
  dueAt?: Instant;
};

/**
 * The emergency department's access target, in minutes. This is a real, named figure from spec
 * §7 — but it is a **departmental performance measure**, counted UP from `Movement.openedAt`
 * (how long the patient has been in the department), because that is the number a department is
 * judged on and mental health patients are its largest breachers. It is **not** a Mental Health
 * Act deadline: it must never be attached to a `LegalForm`, never gain a `dueAt`, and never feed
 * a legal-breach count or an eligibility gate. Task 6A only introduces and pins this constant
 * (see `tests/ward-model.test.ts`); Task 11's emergency department screen is what actually
 * renders it against `openedAt`.
 *
 * The spec originally named this figure four hours (240 minutes). The product owner — the
 * spec's own author — superseded that figure for this prototype on 2026-08-22, in response to a
 * direct clinical question, and set it to 24 hours (1440 minutes) instead. Nothing about *how*
 * this figure is counted, rendered or safeguarded changed: it is still counted up from
 * `openedAt`, never a deadline, and still barred from every `LegalForm`/`dueAt`/breach/
 * eligibility surface listed above.
 */
export const ED_ACCESS_TARGET_MINUTES = 1440;

/**
 * A capacity number is meaningless without where it came from and when.
 * `feed` knows which beds are physically empty; `ward` knows which are actually allocatable
 * once staffing, sex mix, acuity mix, single rooms and holds are accounted for.
 */
export type CapacitySource = "feed" | "ward";

export type CapacityFigure = {
  value: number;
  source: CapacitySource;
  confirmedAt: Instant;
  staleAfterMinutes: number;
};

export type EmergencyDepartment = {
  id: string;
  siteCode: string;
  name: string;
};

export type Unit = {
  id: string;
  siteCode: string;
  name: string;
  cohort: Cohort;
  /**
   * Authorised under the Mental Health Act 2014 to receive involuntary admissions. This IS the
   * bed's legal-status dimension — an authorised bed accepts BOTH voluntary and involuntary
   * admissions (it is a capability, not a value to equality-match), a non-authorised bed accepts
   * voluntary only. There is deliberately no separate `legalStatus` field on `Unit` for this same
   * fact: two fields for one fact is how a screen ends up giving two answers.
   */
  authorised: boolean;
  /**
   * HOW MANY OF THIS WARD'S BEDS ARE DESIGNATED LOCKED. Replaced `security: Security` on
   * 2026-09-04 by owner ruling: "Ward 7 in Bentley is a locked/Open ward so some wards are a
   * combination with a number of designated locked beds and open beds." `(OWNER, 2026-09-04)`
   *
   * ⚠️ A whole-ward flag could not express that, and the failure was not cosmetic: the old
   * eligibility gate read `movement.security === "Open" || unit.security === "Secure"`, so a
   * mixed ward recorded as `Open` hid every one of its locked beds from every patient who
   * needed one.
   *
   * ⚠️ **OPEN BEDS ARE DERIVED, NEVER STORED** — `openBeds(unit)` in `ward-bed-designation.ts`
   * returns `beds - lockedBeds`. Storing both is two sources for one fact, which the owner
   * ruled against by name in the same decision. A wholly-open ward carries `0` here.
   *
   * ⚠️ **THIS IS A PROPERTY OF THE WARD, NOT OF A PATIENT.** An involuntary patient is a
   * property of the person (`LegalStatus`); a voluntary patient may be nursed on a locked
   * ward. Never rename this to anything containing "involuntary".
   */
  lockedBeds: number;
  beds: number;
  /** Physically empty beds, per the feed. */
  empty: CapacityFigure;
  /** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */
  allocatable: CapacityFigure;
  /**
   * HOW MANY OF THE `allocatable` BEDS ARE LOCKED ONES. The open half is derived
   * (`openBedsFree` in `ward-bed-designation.ts`), for the same one-source reason as
   * `lockedBeds` above.
   *
   * ⚠️ Splits the ALLOCATABLE figure, not the `empty` one. `allocatable` is what the ward says
   * it can actually fill; `empty` is what the feed believes is physically vacant. Every
   * eligibility gate has always asked about allocatable beds, so the split belongs there.
   * (Plan author's reasoning, 2026-09-04 — not an owner ruling.)
   */
  allocatableLocked: number;
  /**
   * ⚠️ **AUTHORED AND READ BY NOTHING.** Every "Held" figure any screen shows is DERIVED —
   * `unitCapacity` computes it as `empty.value - min(allocatable.value, empty.value)` and never
   * consults this field. Measured across src, tests and scripts: zero reads.
   *
   * **Which means typing a real held-bed count here changes no number anywhere**, and there is no
   * symptom to notice — not a wrong figure, no figure. See the warning at the top of
   * `ward-sites.ts`, which is where somebody replacing invented values actually is when it matters.
   */
  held: number;
  blocked: number;
  /** Current occupants by sex, which is what constrains who the next admission can be. */
  sexMix: Record<Sex, number>;
  /** How many 1:1 observation patients this unit can staff beyond its current load. */
  speciallingCapacity: number;
  /** Who this bed may hold, as a CONSTRAINT — see `SexDesignation`'s own doc comment. Never
   *  compared to a referral's `sex` by equality; `"Undesignated"` accepts either sex. */
  sexDesignation: SexDesignation;
  /** A forensic bed, independent of `security` — see the note on `security` above. */
  forensic: boolean;
};

export type Site = {
  code: string;
  name: string;
  service: HealthService;
  emergencyDepartment?: EmergencyDepartment;
  units: Unit[];
};

/**
 * A unit's refusal of a movement: which unit, when, and a reason from `DECLINE_REASONS`.
 *
 * **THERE IS NO `note` FIELD, and its absence is the point** (owner ruling PD-6, 2026-08-30). It
 * held free text written about a named individual, sitting immediately beside a controlled
 * vocabulary — and a controlled vocabulary with an escape hatch next to it is not a controlled
 * vocabulary. Every reason a decline can give is now a value from a list somebody chose
 * deliberately, which is what makes `DECLINE_REASONS`' own privacy discipline real rather than a
 * naming convention.
 *
 * If a reason cannot be expressed, the answer is a new member of `DECLINE_REASONS`, decided and
 * recorded — never a text field restored here. `tests/ward-model.test.ts` pins this structurally,
 * against the real seeded declines, so it cannot return quietly.
 */
export type Decline = {
  unitId: string;
  at: Instant;
  reason: DeclineReason;
};

/**
 * A COORDINATOR OVERRIDE, kept rather than shown and discarded.
 *
 * Owner decision OD-3: the reason was collected in a `<textarea>`, held in the shortlist panel's
 * own `useState`, and thrown away the moment another patient was selected — while the governance
 * page stated that override reasons are recorded. **A page making a false claim about what it
 * keeps.** Replacing the box with a fixed list alone would not have fixed that: it would have
 * swapped free text that goes nowhere for five reasons that go nowhere, and the row would read as
 * done.
 *
 * ⚠️ **THIS RECORD IS AN ACCOUNTABILITY RECORD, NOT AN AUDIT TRAIL, AND THE TWO STORE IDENTICAL
 * DATA.** The owner's requirement is that it is **visible to the party overridden** — the unit
 * referred to despite its own gate failing. That difference is a READ PERMISSION, not a field, so
 * a reviewer reading this type sees nothing missing either way. `overridesAgainstUnit`
 * (`ward-derivations.ts`) is the ward-facing read, and `tests/ward-override-register.test.ts`
 * is the boundary that goes red — because an override log only its author can see is a trail, and
 * the whole point of the decision was that it is not one.
 */
export type Override = {
  /** When the override was made. */
  at: Instant;
  /** A ROLE, never a person — the same discipline as `decidedBy` and `StatusChange.by`. */
  by: string;
  /** From `OVERRIDE_REASONS`, never free text, and never an "other, please specify" (WB-DB-16). */
  reason: OverrideReason;
  /**
   * The units referred to despite a failing gate — THE PARTIES OVERRIDDEN. This is the field the
   * ward-facing read is keyed on, which is why it is a list of ids and not a count: a number could
   * not answer "was I one of them".
   */
  unitIds: string[];
};

export type StatusChange = {
  at: Instant;
  from: LegalStatus;
  to: LegalStatus;
  by: string;
  reason: LegalStatusChangeReason;
};

/** The urgency-tier counterpart of `StatusChange` — same shape, same discipline: who made the
 *  change, when, and a reason chosen from a fixed list rather than typed (see
 *  `ward-change-reasons.ts`'s own doc comment for why). */
export type UrgencyChange = {
  at: Instant;
  from: 1 | 2 | 3;
  to: 1 | 2 | 3;
  by: string;
  reason: UrgencyChangeReason;
};

/**
 * WHO COLLECTS THE PATIENT — obviously generic placeholders, and the owner's to replace.
 *
 * `TR-D2`. Until 2026-08-30 this field was a bare string with two values and no vocabulary: the
 * reducer hardcoded "State patient transport service" onto every job it created, and the seed used
 * **"St John WA"** — a REAL organisation, named inside a synthetic prototype, rendering straight to
 * screen as "St John WA accepted, awaiting departure".
 *
 * Two faults in one field. The screen stated who was collecting a patient and **nobody chose it**;
 * and a demonstration asserted an operational fact about a real body that has agreed to nothing.
 *
 * These three are PLACEHOLDERS in the `CM-8` sense — findable in one place, never presented as the
 * real set, and replaced wholesale on the day somebody supplies the actual providers. They are the
 * three the transport design names and no more: "and so on" in a spec is an invitation to invent,
 * and inventing a fourth provider is the same act as writing a real one in.
 */
export const TRANSPORT_PROVIDERS = ["Ambulance service", "Patient transport service", "Ward escort"] as const;
export type TransportProvider = (typeof TRANSPORT_PROVIDERS)[number];

export type TransportJob = {
  id: string;
  /** From `TRANSPORT_PROVIDERS`. Never free text — see that list's own doc comment. */
  provider: TransportProvider;
  escortRequired: boolean;
  /**
   * The form this transfer requires. **STILL A BARE STRING, and that is a known gap rather than an
   * oversight** — `TR-D2` asks for it to draw from `SELECTABLE_LEGAL_FORMS`, and it should.
   *
   * Not done here because the change is not local. `SELECTABLE_LEGAL_FORMS` is typed
   * `readonly LegalForm[]` with `code: string`, so deriving a union from it needs `as const` on
   * that array — and `ward-legal-forms.ts` is pinned in roughly fifteen places by
   * `tests/ward-legal-figure-guard.test.ts`, the Mental Health Act figure guard the owner has said
   * must never be disturbed. Widening a type there is a deliberate change with that guard in front
   * of it, not a side effect of removing two organisation names from a different field.
   *
   * Nothing writes a bad code today: the only populated `formRequired` comes from the seed.
   */
  formRequired?: string;
  acceptedAt?: Instant;
  enRouteAt?: Instant;
  /**
   * ⚠️ `arrivedAt` AND `cancelledAt` READ AS INDEPENDENT AND ARE NOT — `closure` on `Movement`
   * (below) is the invariant that keeps them apart, and it is NOT stated anywhere in this type.
   *
   * Nothing here stops a hand-built `TransportJob` from carrying both `arrivedAt` and
   * `cancelledAt`, but the reducer can never produce one. In `ward-flow-reducer.ts`,
   * `PATIENT_ARRIVED` sets `arrivedAt` and the movement's own `closure` in the same update, and
   * refuses to run at all once `movement.closure` is already set. `RECORD_EXAMINATION`'s
   * `community_order`/`revoked` branch — the one that closes a movement without an admission —
   * sets `cancelledAt` the same way, guarded by the identical `movement.closure` check.
   * Whichever of the two runs first sets `closure`, and that is what makes the second one
   * impossible; nothing on `TransportJob` itself does the excluding.
   *
   * A fourth terminal transition that sets one of these fields (or a new one) MUST do both halves
   * of that: reject when `movement.closure` is already set, and set `closure` itself in the same
   * update. Do either alone and this type stops matching what the reducer can actually produce.
   *
   * (`collectedAt` is not part of this exclusion — it is an intermediate step either terminal path
   * can follow, not a terminal state of its own. And `CANCEL_TRANSPORT`, despite the name
   * similarity, never sets `cancelledAt` at all: it replaces the whole job with a fresh one for
   * rebooking and records the old one in `movement.unwinds` instead — see `UnwindRecord` below.)
   */
  collectedAt?: Instant;
  arrivedAt?: Instant;
  cancelledAt?: Instant;
};

export type MovementClosure = {
  at: Instant;
  outcome: "arrived" | "did_not_proceed";
  reason: string;
};

/**
 * WHETHER THIS PATIENT NEEDS TRANSPORT AT ALL — the third state, owner ruling R-2026-09-04-C.
 *
 * ⚠️ **THREE STATES, NOT TWO, AND THE ABSENT ONE IS THE DEFAULT.** `Movement.transport` answers
 * "is there a job?", and until this field existed that was the only thing the model held: a
 * movement with no `TransportJob` could mean **no transport is needed** (the ward is across the
 * corridor, the patient is walking) or **no transport has been booked yet**, and a screen could
 * honestly say no more than "no transport recorded". Those are opposite operational situations —
 * one is finished and one is outstanding — and they rendered identically.
 *
 * Deliberately the same shape as `Referral.medicalClearance`, which already models exactly this
 * uncertainty: a stated answer plus the time it was stated, and ABSENCE meaning **nobody has said**
 * rather than "no". Read it through `transportNeedState` (`ward-derivations.ts`), which names all
 * three so a caller cannot accidentally collapse two of them with `?? false`.
 *
 * ⚠️ **DO NOT DEFAULT IT AND DO NOT BACKFILL IT.** The ruling's own words: a migration that guessed
 * one of the other two for legacy movements would manufacture the very certainty this field exists
 * to provide honestly. Every hand-authored movement in `ward-movements.ts` and every generated one
 * therefore carries nothing here, and reads as "not recorded".
 *
 * ⚠️ **IT SAYS NOTHING ABOUT `TransportJob.formRequired`, WHICH IS STILL AN UNVALIDATED BARE
 * STRING** (see that field's own comment). A screen showing `needed` beside a form code must not
 * let the recorded need imply the form was checked; nothing checks it.
 */
export type MovementTransportNeed = {
  /** The answer somebody gave. `false` is a real answer — "this patient needs no transport". */
  needed: boolean;
  at: Instant;
};

/**
 * WHY A MOVEMENT CARRIES NO `referralId`, when somebody has actually said why.
 *
 * Owner ruling R-2026-09-04-D, second half. `Movement.referralId` being absent had three different
 * causes that rendered identically, and **only the first is clinical**:
 *
 *   - `none_raised` — nobody raised a front-door referral for this person. A recorded answer.
 *   - `not_asked` — the journey was raised at runtime and whoever raised it was never asked which
 *     referral it came from. Record-keeping, written by `RAISE_REFERRAL` itself.
 *   - *the field absent entirely* — the movement predates the link (`ward-movements.ts`'s
 *     hand-authored fixture) or nothing has ever recorded anything. Record-keeping, and the
 *     DEFAULT, in the same discipline as `MovementTransportNeed` above.
 *
 * ⚠️ **`none_raised` IS THE ONLY ONE A SCREEN MAY TREAT AS A CLINICAL FACT.** The ruling exists
 * because an earlier one asked for an absent referral to be rendered as the loudest thing on the
 * page; against the data of the day that would have reported that nobody was looking for anybody,
 * anywhere, with every gate green.
 *
 * ⚠️ **AND `none_raised` DOES NOT MEAN "NOBODY IS LOOKING FOR A BED".** It means no FRONT-DOOR
 * referral brought this person in. The bed search is `referredUnitIds`/`declines`, a different
 * absence with its own unresolved version of this problem — see `ed-home-derivations.ts`'s own
 * doc block, which refuses to count it for exactly this reason.
 */
export const MOVEMENT_REFERRAL_ABSENCE_REASONS = ["none_raised", "not_asked"] as const;
export type MovementReferralAbsenceReason = (typeof MOVEMENT_REFERRAL_ABSENCE_REASONS)[number];

export type MovementReferralAbsence = {
  reason: MovementReferralAbsenceReason;
  at: Instant;
};

/**
 * The undo the prototype has never had (Task 3, spec item 10). Before this, the only path that
 * released a pulled bed or cancelled a transport job was closing the movement outright — recording
 * an examination with outcome `community_order` or `revoked` — so a coordinator who pulled the
 * wrong bed had to declare the patient does not need admission in order to correct it.
 * `RELEASE_PULL` and `CANCEL_TRANSPORT` unwind exactly one earlier reservation each, WITHOUT
 * closing the movement, clearing `legalForm`, or touching `referredUnitIds` — the movement
 * survives and keeps its acceptance. Every unwind is recorded here so the fact that a pull or a
 * transport job was undone is never silently lost, the same discipline `StatusChange` and
 * `UrgencyChange` already hold to for their own reversible facts.
 */
export type UnwindRecord = {
  at: Instant;
  /**
   * The third and fourth kind, added for the coordinator step-back / withdraw-acceptance pair
   * (Task 5, ward-flow movement step-track plan, 2026-09-04, owner rulings E and F). Appended to
   * this ONE existing audit trail rather than a second store — ruling 3 of that plan is explicit
   * that inventing a second place to record an unwind is the defect, not a variant to avoid.
   *
   * `"stage_corrected"`: `STEP_BACK_STAGE` — a coordinator record correction, moving `stage`
   * strictly backwards with no other side effect.
   * `"acceptance_withdrawn"`: `WITHDRAW_ACCEPTANCE` — the coordinator undoes a WARD's earlier
   * "yes" (distinct from `WITHDRAW_REFERRAL`, which is the REFERRER taking its own referral back).
   */
  kind: "pull_released" | "transport_cancelled" | "stage_corrected" | "acceptance_withdrawn";
  by: string;
  reason: string;
  /** The cancelled job retained in the audit trail when a replacement becomes active. */
  transportId?: string;
  /**
   * Which ward's acceptance was withdrawn — populated only for `"acceptance_withdrawn"`, parallel
   * to `transportId` above. `WITHDRAW_ACCEPTANCE` clears `Movement.acceptedUnitId` in the same
   * update, so nothing else on the record would say who it used to be without this field.
   */
  unitId?: string;
};

/**
 * ONE STAGE TRANSITION — the single record of how a patient moved, replacing a reconstruction of
 * the journey from scattered timestamps (Task 4, ward-flow movement step-track plan, 2026-09-04).
 *
 * ⚠️ **APPEND-ONLY, ALWAYS.** Nothing ever rewrites or removes an entry, including a later
 * coordinator step-back — that appends its OWN backwards entry rather than editing the one it is
 * correcting. The array is the movement's history, not its current state; `movement.stage` alone
 * still answers "where is this patient now".
 *
 * `from` IS OPTIONAL AND ABSENT EXACTLY ONCE — on creation (`RAISE_REFERRAL`), where there is no
 * previous stage to name. An entry is still written there, so step 1 of the track lives inside
 * this array rather than being reachable only through `Movement.openedAt`.
 *
 * `by` IS A ROLE, NEVER A PERSON — the same discipline as `StatusChange.by`, `UrgencyChange.by`
 * and `Override.by`. Every reducer case that writes an entry takes it from the triggering event's
 * own `role`, never from a name a caller could supply.
 *
 * ⚠️ **THIS DOES NOT REPLACE `openedAt`, `referredAt`, `acceptedAt`, `transport.collectedAt` OR
 * `closure.at`.** Each of those has other consumers that read it directly (the ED referral board,
 * `daysInBed`, the outbox), and removing any of them to avoid "two places recording the same
 * fact" would break those callers for no gain. Two sources that AGREE, with something that
 * actually checks they agree, is the honest design; two sources with nobody checking is how this
 * project got a live-drift incident. `tests/ward-movement-stage-changes.test.ts` is that check.
 *
 * ⚠️ **AN EMPTY ARRAY HAS TWO DIFFERENT CAUSES, DECIDABLE FROM `movement.stage` ALONE.** A
 * movement still at `placement_requested` with no entries has made no transitions yet — the
 * ordinary case for a freshly raised movement. A movement at any LATER stage with no entries
 * PREDATES this field — every hand-authored and generated movement in `ward-movements.ts` is in
 * this second class, because none of them was reached by dispatching an event. A renderer must
 * say which; treating both as one "no record" absence is the exact defect this plan exists to
 * close on the fields that came before it.
 *
 * Never backfilled: existing hand-authored and generated movements keep `stageChanges: []`
 * exactly as authored. "No record of how this movement moved" is the honest answer for them, not
 * a gap to be invented shut.
 */
export type StageChange = {
  at: Instant;
  from?: MovementStage;
  to: MovementStage;
  by: string;
  reason?: string;
};

/**
 * A MOVEMENT's id — one person's journey through the system, never the person.
 *
 * ⚠️ **A TEMPLATE LITERAL TYPE RATHER THAN `string`, AND IT IS A DEFECT FIX RATHER THAN
 * TIDINESS.** The route was `/patients/[patientId]` (now
 * `/mockups/ward-flow/movements/[movementId]`) and rendered a MOVEMENT workspace: its parameter
 * was called `patientId` (now `movementId`), its component prop was called `patientId` (now
 * `movementId`), and inside it a variable named `patient` is still typed `Movement`. Every
 * identifier involved was a bare `string`, so nothing stopped a real patient id being passed to it
 * — and the names openly invited exactly that. It worked only because every existing call site
 * happened to pass a movement.
 *
 * With `MovementId` and `PatientId` as distinct types the mistake the name invites now fails to
 * COMPILE instead of rendering a dead-end "no movement matches" page. Every movement id in the
 * fixture is already `WF-###`, so no literal needed changing.
 */
export type MovementId = `WF-${string}`;

export type Movement = {
  id: MovementId;
  /** Where the patient physically is. Detention here is lawful even when unauthorised. */
  originEdId: string;
  openedAt: Instant;
  /**
   * THE FRONT-DOOR REFERRAL THIS JOURNEY WAS RAISED FROM — the link that did not exist.
   *
   * Owner ruling 8, 2026-09-01: **a journey never STARTS at a community team.** Every journey
   * begins at an emergency department, so `originEdId` requiring a real ED is the rule rather than
   * a gap — and a community team's referral to an ED and the journey that ED subsequently raises
   * are TWO LINKED RECORDS rather than one. This is that link, and it is the whole of it. Nothing
   * about the journey is derived from the referral: `RAISE_REFERRAL` already carries every fact a
   * movement needs, so this field adds an id and changes nothing else.
   *
   * ⚠️ **OPTIONAL, AND ABSENCE IS THE ORDINARY CASE.** Most movements have no referral — a person
   * who walked into an emergency department was referred by nobody — so an absent value is a real
   * answer rather than a missing one.
   *
   * ⚠️ **TWO OF THE TWENTY HAND-AUTHORED MOVEMENTS NOW CARRY ONE (owner ruling R-2026-09-04-D,
   * first half), AND THE OTHER EIGHTEEN STILL DO NOT.** This comment previously said the fixture
   * would never be given a value here because doing so would invent the fact the field records.
   * The ruling's answer is that a fixture in which the link resolves for NOBODY hides the link's
   * whole general problem behind a uniform absence, so `ward-movements.ts` now authors two
   * referral-and-journey PAIRS — a referral raised before the journey and addressed to the very
   * department that raised it, the same two conditions `RAISE_REFERRAL` enforces at runtime. The
   * remaining eighteen carry nothing, because nothing in their authored story says anybody
   * referred them, and guessing would be the invention this paragraph used to forbid outright.
   *
   * ⚠️ **AN ABSENT VALUE HERE IS NOT SELF-EXPLAINING — READ `referralAbsence` BESIDE IT.**
   *
   * ⚠️ **`Admission.referralId` IS THE COUNTER-EXAMPLE, NOT THE PRECEDENT.** That field is
   * documented as *"the join back to the front door"* and joins to nothing: its seeded values are
   * manufactured from the admission's own id by string substitution (`RF-${suffix}` and
   * `id.replace(/^AD-/, "RF-")` in `ward-admissions-seed.ts`), which overlaps the real
   * `RF-001`…`RF-009` in **zero** places, and its one runtime writer honestly writes `null`. It
   * compiles, renders, and means nothing — see
   * `docs/ward-flow/fields-with-no-producer-2026-09-01.md`, where it is finding zero and the reason
   * all 65 community team pages are empty.
   *
   * **The difference here is enforced, not intended.** `RAISE_REFERRAL` — the only writer — REFUSES
   * an id that does not resolve to a referral already in state, and refuses one whose referral was
   * not addressed to the department doing the raising. A manufactured string cannot reach this
   * field; the only way to obtain a value is to name a referral that exists.
   *
   * Read through `referralForMovement` (`ward-derivations.ts`), which returns `undefined` for a
   * movement that has no referral rather than throwing or guessing at one.
   */
  referralId?: string;
  /**
   * WHY THERE IS NO `referralId`, when somebody has said why — see `MovementReferralAbsence`.
   *
   * ⚠️ **MEANINGLESS BESIDE A SET `referralId`, AND THE TYPE CANNOT STOP THAT.** The two fields
   * answer the same question and only one of them may be answered: `RAISE_REFERRAL` writes exactly
   * one, `RECORD_NO_REFERRAL` refuses a movement that already names a referral, and
   * `movementReferralLink` (`ward-derivations.ts`) resolves the contradiction in favour of the
   * referral that actually exists rather than reporting an absence beside a real join.
   */
  referralAbsence?: MovementReferralAbsence;
  /**
   * WHETHER THIS PATIENT NEEDS TRANSPORT — three states, absent meaning nobody has said. See
   * `MovementTransportNeed`, and read it through `transportNeedState` (`ward-derivations.ts`).
   */
  transportNeed?: MovementTransportNeed;
  /**
   * THE URGENT FLAG — the one thing that outranks a wait and a tier (owner, 2026-08-30).
   *
   * His words: "A long wait always is prioritised… however… in certain cases patients can be
   * marked as urgent for many reasons which outranks everything." Asked how far to take it, he
   * scoped it deliberately small: **"For now just have a feature that flags the patient. I will
   * build on it later."**
   *
   * So this is ADDITIVE AND REVERSIBLE. It sits above `urgency` in `queueOrder` and changes
   * nothing beneath it — the three tiers, `operationalScore` and its ten-hour wait ceiling are all
   * exactly as they were.
   *
   * ⚠️ **THAT LEAVES THREE RANKINGS STACKED — a flag, above three tiers, above a composite score —
   * AND THAT IS A STAGE, NOT A DESIGN.** A reader meeting it should not take it as settled. The
   * deferred decision, in his own words "I will build on it later", is what becomes of the tiers
   * and of `operationalScore` once the flag is the ordering. `tests/ward-priority.test.ts` names
   * that open question so it cannot quietly become the shape by default.
   *
   * Carries no reason. He said "for many reasons" — plural and unenumerated — and inventing a
   * vocabulary for them would be putting words in his mouth on the one surface where a wrong
   * answer reaches a person. A reason field is part of "later", not part of this.
   */
  flaggedUrgent: boolean;
  urgency: UrgencyLevel;
  cohort: Cohort;
  security: Security;
  sex: Sex;
  specialling: boolean;
  legalStatus: LegalStatus;
  legalForm?: LegalForm;
  statusChanges: StatusChange[];
  /** Urgency-tier changes, in the order they were made. Empty for a movement whose urgency has
   *  never changed since it was raised. */
  urgencyChanges: UrgencyChange[];
  /** Every coordinator override on this movement, oldest first. Empty for a movement nobody has
   *  overridden a gate for — which is most of them. See `Override`. */
  overrides: Override[];
  stage: MovementStage;
  owner: string;
  /** Units currently holding a live referral. Never longer than PARALLEL_REFERRAL_CAP. */
  referredUnitIds: string[];
  acceptedUnitId?: string;
  /** When `ACCEPT_IN_PRINCIPLE` (ward-flow-reducer.ts) set `acceptedUnitId`. Absent for every
   *  movement in the seed fixture (`ward-movements.ts`), which is hand-authored with
   *  `acceptedUnitId` already set rather than reached by dispatching that event — this field is
   *  deliberately never backfilled onto that fixture, so its absence there is real, not a bug.
   *  `effectivenessNumbers` (ward-derivations.ts) prefers this over the `withdrawnReferrals`
   *  archaeology it used before this field existed, and reports honestly when neither is present. */
  /**
   * When this movement was referred to units — written by `REFER_TO_UNITS` beside
   * `referredUnitIds`, which is the one place a movement becomes referred.
   *
   * ⚠️ **OPTIONAL, AND ABSENT ON EVERY SEEDED MOVEMENT ON PURPOSE.** Same discipline as
   * `acceptedAt` below: a hand-authored fixture carries no referral time, so a row that has none
   * says so rather than falling back to `openedAt`. Substituting arrival time under a "referred"
   * label answers a different question while reading as plausible — the ED outbox's own comment
   * already forbids exactly that swap for `acceptedAt`.
   *
   * Added 2026-09-02 on the owner's instruction, after the ED referral board could not honestly
   * answer "how long since we referred them": the model held `openedAt`, `acceptedAt`, `formedAt`
   * and `pullExpiresAt` and nothing for this.
   */
  referredAt?: Instant;

  acceptedAt?: Instant;
  declines: Decline[];
  transport?: TransportJob;
  /**
   * WHAT IS HOLDING THIS MOVEMENT UP, IN SOMEBODY'S OWN WORDS.
   *
   * ⚠️ **NOT `BedRelease.blocker`, WHICH IS A DIFFERENT FIELD WITH THE SAME NAME.** That one is a
   * `BedReleaseBlocker | null` — a typed enum chosen from `BED_RELEASE_BLOCKERS`, carrying a
   * `blockedBy` role, about a BED being freed. This one is free prose about a MOVEMENT. They are
   * not two spellings of one idea and neither list applies to the other; the reducer cases that
   * write them (`BLOCK_BED_RELEASE`/`CLEAR_BED_RELEASE_BLOCK` for the enum,
   * `RECORD_MOVEMENT_BLOCKER` and the stage transitions for this one) are unrelated.
   *
   * ⚠️ **FREE PROSE, AND THAT IS LOAD-BEARING RATHER THAN AN OVERSIGHT.** Owner ruling,
   * 2026-09-01, after this field was audited as a candidate for derivation: do not derive it.
   * A constrained vocabulary would lose the same thing a derivation would. Two properties of the
   * twenty-one hand-authored values prove it:
   *
   *   1. Three of them record the ABSENCE of a blocker TOGETHER WITH THE REASON for the absence —
   *      `"None — in transit"` (twice) and `"None — handover complete"`. A derived field yields
   *      ONE value when nothing is blocking. These are two different situations that both have no
   *      blocker, and the field is what distinguishes them.
   *   2. Others name activity by parties this model has no field for at all — a family, a
   *      specialling roster, an escort provider organising a vehicle. There is nothing in state to
   *      compute them from, and there was never going to be.
   *
   * `tests/ward-movement-blocker.test.ts` asserts five of those values are still expressible, so a
   * later narrowing of this type fails a test rather than silently deleting a category.
   *
   * ⚠️ **IT WENT STALE FOR THE WHOLE LIFE OF THE FIELD, WHICH IS THE OTHER HALF.** Until
   * 2026-09-01 the only runtime writer was `RAISE_REFERRAL`, which stamped the literal
   * `"Awaiting coordinator referral"` at creation, and NO stage transition ever touched it again.
   * A patient with transport already en route still read "Awaiting coordinator referral" on the
   * console's **Response** and **Current blocker** lines, so a coordinator chased the wrong
   * patient. Two things fixed that, and both were needed:
   *
   *   - `RECORD_MOVEMENT_BLOCKER`, so a human can say what is actually happening, in their words.
   *   - `STAGE_TRANSITION_BLOCKERS` (ward-flow-reducer.ts), restated by the reducer at every
   *     transition that CONTRADICTS the standing sentence. A blocker the record beside it
   *     disproves is wrong by construction, not merely out of date. ⚠️ The property is not "never
   *     older than the stage": `PULL_PATIENT` and `HANDOVER_READY` both advance the stage and
   *     deliberately leave the sentence alone, because neither is told anything that falsifies it.
   *     See that constant's own comment for why the stronger-sounding claim is the false one.
   *
   * A human's prose overwrites the machine's and stands until the situation next changes — the
   * same way a handover note does. Never `null` and never empty: `RECORD_MOVEMENT_BLOCKER` refuses
   * a blank rather than storing one, because a blank would be indistinguishable from a field
   * nobody had reached yet, which is the exact ambiguity this field spent its life in.
   *
   * ⚠️ Read by `operationalScore` (ward-priority.ts), which awards ten points for an ACTIVE
   * blocker and recognises the `"None — …"` and `"No blocker"` shapes as inactive. A new inactive
   * phrasing must be taught to `hasActiveBlocker` there, or it scores as a live obstruction.
   */
  blocker: string;
  closure?: MovementClosure;
  /** When the referral for examination was made. May precede `openedAt` for a community-formed
   *  patient — the legal clock and the department clock are different clocks. */
  formedAt?: Instant;
  /** How the patient reached the department. Police attendance is a real and invisible pressure. */
  arrivalMode?: "self" | "ambulance" | "police";
  /** When a pulled bed lapses. A pull cannot expire without a time to expire at. */
  pullExpiresAt?: Instant;
  /**
   * The `Admission` this movement's PULL created, while that pull stands.
   *
   * ⚠️ **IT EXISTS SO A RELEASED PULL CAN UNDO ITSELF, AND THAT IS THE WHOLE OF IT.** `PULL_PATIENT`
   * creates a person in a bed; `RELEASE_PULL` must remove exactly the one it created, and
   * `PATIENT_ARRIVED` must mark exactly the one that arrived. Without an id, both events would have
   * to GUESS — "the pulled admission at this unit" is ambiguous the moment two people are pulled to
   * the same ward, which is an ordinary Tuesday rather than an edge case.
   *
   * Carries no fact about a person: it is an internal join between two records this reducer wrote
   * itself, in the same shape as `pullExpiresAt` beside it. Set by `PULL_PATIENT`, cleared by
   * `RELEASE_PULL` (which deletes what it points at), and left in place through arrival so the
   * closed movement still names the person it produced. `undefined` on every movement that has
   * never been pulled — including every movement in the hand-authored seed, whose `pulled` and
   * later stages were authored rather than reached by dispatching the event.
   */
  admissionId?: string;
  /** The psychiatric examination a Form 1A refers the person for. Until it happens you often do
   *  not know whether an authorised bed is needed at all. */
  examination?: { at: Instant; outcome: "inpatient_order" | "community_order" | "revoked" };
  /** Referrals ended because another unit accepted. A shrinking `referredUnitIds` tells nobody. */
  /** ⚠️ `reason` is a CODE from `WITHDRAWAL_REASONS`, never free text, and it may never name a
   *  place — `FD-23`. A losing ward reads this field, and it used to carry the accepting
   *  ward's name. See that list's own doc comment for why a type rather than a better
   *  sentence. Render `withdrawalReasonLabels[reason]`, never the code. */
  withdrawnReferrals: { unitId: string; at: Instant; reason: WithdrawalReason }[];
  /** Recorded when the network is exhausted. */
  escalation?: { at: Instant; triedUnitIds: string[]; contact: string };
  /** Every pull released and transport job cancelled against this movement, oldest first. Empty
   *  for a movement nothing has ever been unwound on. See `UnwindRecord`'s own doc comment. */
  unwinds: UnwindRecord[];
  /** Every stage transition this movement has made, oldest first, written by the reducer. Empty
   *  either because the movement has made none yet or because it predates this field — the two
   *  are decidable from `stage` alone. See `StageChange`'s own doc comment. */
  stageChanges: StageChange[];
};

/** A transition the reducer refused, surfaced on the coordinator screen rather than swallowed. */
export type Rejection = {
  id: string;
  at: Instant;
  movementId: string;
  attempted: string;
  reason: string;
};

/**
 * A bed release's lifecycle, in the order a bed moves through it. Hand-listed (never derived) for
 * the same reason `DECLINE_REASONS` is: a UI picker needs a runtime list, not just a type.
 *
 * **Three stages since 2026-08-28**, down from four — the product owner's decision, recorded in
 * `docs/ward-flow-phase-6-7-decisions.md` ("The bed model becomes three stages plus a flag").
 * Each stage says how CERTAIN the discharge is, and nothing else. `"blocked"` was removed as a
 * stage and became a flag (`BedRelease.blocker`/`blockedBy`) that sits ON a expected or
 * confirmed release, because being stuck is not a degree of certainty.
 *
 * The defect that forced it, verified in the code before it was raised: `capacityBreakdown`
 * (`ward-bed-availability.ts`) sorted today's releases into `confirmedToday` or `expectedToday`
 * by state, so a release in state `"blocked"` matched NEITHER branch and was counted nowhere.
 * Marking a confirmed discharge blocked silently dropped the ward's confirmed count — the figures
 * improved at the exact moment the ward got stuck. A blocked-but-confirmed bed now keeps counting
 * as confirmed, and `CapacityBreakdown.blockedToday` states how many are stuck beside it.
 *
 * Transitions go BOTH ways: `confirmed` may return to `expected` when a decision is reversed
 * (`REVERT_BED_RELEASE`). The old one-way model did not stop reversals happening — it made wards
 * record them dishonestly.
 */
export const BED_RELEASE_STATES = ["expected", "confirmed", "discharged"] as const;
export type BedReleaseState = (typeof BED_RELEASE_STATES)[number];

/**
 * **The Q1 axis change, landed 2026-08-28** ("The three lists", List 2). This replaces
 * `BED_RELEASE_CONFIDENCE_LEVELS` — the `likely` / `possible` pair Phase 5 shipped — outright.
 *
 * A expected discharge no longer carries HOW CONFIDENT the ward is; it carries WHAT IT IS
 * WAITING ON. The owner's reasoning: confidence asks a ward to estimate a probability, people are
 * poor at that, and worse, two wards' "likely" do not mean the same thing — so a coordinator can
 * neither compare them nor add them up. What a discharge is waiting on is a **fact, not a
 * judgement**: comparable across wards, and actionable. A bed waiting on a ward round is a
 * different prospect from one waiting on a family meeting.
 *
 * **`"Nothing outstanding"` carries more weight than it looks.** It is a expected discharge with
 * no obstacle at all — the closest thing to the old "likely", and the one a coordinator can most
 * safely plan against. Without it the list would force a ward to name an obstacle that does not
 * exist, which is how a fixed list starts producing false records.
 *
 * Provenance, stated because it matters: these words were proposed by an agent session and
 * APPROVED by the product owner. No charge nurse has seen them, and this is the list of the three
 * most in need of a clinician's own words — the owner is not the one held up waiting on a ward
 * round. They ship verbatim; a clinician's wording replaces them verbatim in turn.
 */
export const BED_RELEASE_WAITING_ON = [
  "Awaiting ward round",
  "Awaiting family or carer agreement",
  "Awaiting accommodation",
  "Awaiting community team acceptance",
  "Nothing outstanding",
] as const;
export type BedReleaseWaitingOn = (typeof BED_RELEASE_WAITING_ON)[number];

/**
 * A bed release carries **nothing whatsoever about the departing patient** — no identifier, no
 * timing that could identify them, no reason relating to them, and (spec D11) not even sex, the
 * one otherwise-permitted patient attribute. Every field below is about the BED or the confirming
 * WARD. `tests/ward-flow-reducer.test.ts` and `tests/ward-bed-availability-model.test.ts` both
 * assert this structurally against the type's own field set, not against fixture content.
 */
export type BedRelease = {
  id: string;
  unitId: string;
  state: BedReleaseState;
  expectedAt: Instant;
  /**
   * What this discharge is still waiting on, chosen from `BED_RELEASE_WAITING_ON`. Non-null only
   * while `state` is `"expected"` — a confirmed discharge is a decision, not something still
   * being waited on, and a released one has already happened.
   *
   * Renamed from `confidence` by the Q1 axis change of 2026-08-28. Keeping the old name over the
   * new values would have put "Awaiting ward round" in a field called `confidence` on a screen a
   * coordinator reads as fact, which is the kind of quiet mismatch this project treats as a
   * defect rather than a cosmetic point.
   *
   * `"Nothing outstanding"` is a legitimate value, not an absence: it means a expected discharge
   * with no obstacle. `null` means the release is not expected at all. The two are different and
   * must not be collapsed.
   */
  waitingOn: BedReleaseWaitingOn | null;
  /**
   * **The blocked FLAG's reason** (bed-model rework, 2026-08-28). Non-null means this discharge
   * is decided-or-expected AND currently stuck; it may sit on a `"expected"` release or on a
   * `"confirmed"` one, and a blocked-but-confirmed release still counts as confirmed. Always
   * `null` on a `"discharged"` release — once the bed is free there is nothing left being held up.
   *
   * Before this rework `blocked` was a fourth STATE and this field was legal only in it, which
   * is what made a stuck confirmed discharge fall out of the ward's confirmed count entirely.
   * Always a `BedReleaseBlocker` — enforced by the type here, and by a membership check against
   * `BED_RELEASE_BLOCKERS` in the reducer.
   */
  blocker: BedReleaseBlocker | null;
  /**
   * The role that recorded the block, non-null exactly when `blocker` is. A role — a unit or
   * service label — never a personal name, the same discipline `confirmedBy` holds to. Kept
   * separate from `confirmedBy` because the two answer different questions once a block can
   * outlive a state change: `confirmedBy` is who last reported this release's stage, this is who
   * said it was stuck (Q3: provenance stays a role and a timestamp, never a person).
   */
  blockedBy: string | null;
  /**
   * Q4 of the 2026-08-28 decisions: this bed is being MADE READY (cleaning and the like).
   * **Informational only — it must NEVER gate allocation.** A bed being prepared is still
   * offered, still counts in `availableNow`, and still appears in every figure, because the pull
   * of the next patient takes hours anyway. See `BED_PREPARATION_NOTES` for the full reasoning.
   */
  preparing: boolean;
  /**
   * What the bed is waiting on to be ready, chosen from `BED_PREPARATION_NOTES` — the owner
   * supplied that list on 2026-08-28, so the field is now expressible where it could previously
   * only be `null`. `null` alongside `preparing: true` remains legal and means "being made ready,
   * reason not stated"; `preparing: false` forces it null, because "not being made ready, waiting
   * on a clean" is a contradiction.
   *
   * **A note here still gates NOTHING.** See `preparing` above and `BED_PREPARATION_NOTES`.
   */
  preparationNote: BedPreparationNote | null;
  confirmedAt: Instant;
  /** A role — a unit or service label. Never a personal name. */
  confirmedBy: string;
};

/**
 * A bed occupied by someone on approved leave. It may or may not be fillable while they are away,
 * and a coordinator needs to see which — so it is its own count and is **never** merged into
 * `available` (spec D4). Carries nothing about the person on leave: no identifier, no reason, no
 * destination.
 */
export type LeaveBed = {
  id: string;
  unitId: string;
  /** The ward's statement that this bed can be filled while its occupant is away. */
  usable: boolean;
  expectedReturn: Instant;
  confirmedAt: Instant;
  /** A role. Never a personal name. */
  confirmedBy: string;
};

/**
 * Phase 7 (spec "The front door"): where a referral entered the network. A referral itself
 * carries no patient location — only where the request came FROM, and only as one of a fixed,
 * synthetic set of channels, never a service name that could identify a specific team.
 */
export const REFERRAL_SOURCES = ["community", "crisis_service", "police", "ambulance", "inter_hospital"] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

/** A referral's own lifecycle — deliberately separate from `MovementStage`, which belongs to a
 *  movement already inside the department. A referral is a request for a bed, not yet a person
 *  in a department bed. */
export const REFERRAL_STATES = ["queued", "accepted", "declined"] as const;
export type ReferralState = (typeof REFERRAL_STATES)[number];

/**
 * Task 1's privacy discipline, carried into decline reasons the same way `BED_RELEASE_BLOCKERS`
 * (`ward-change-reasons.ts`) carries it for a bed release: every entry describes the SERVICE's
 * answer or the NETWORK's state, never the person referred. `"no_suitable_bed"` and
 * `"secure_bed_unavailable"` are the network having nothing that fits; `"age_band_not_provided_here"`
 * and `"sex_designation_unavailable"` are the network's own capability gaps (this site does not run
 * that cohort, or has no bed of a workable designation left), not a judgement on the referral;
 * `"belongs_to_another_service"` and `"referred_elsewhere"` are administrative facts about where
 * the request belongs — and `"belongs_to_another_service"` is deliberately NOT spelled
 * `"out_of_catchment"`, which it was until Phase 8 Task 6: "out of catchment" names a boundary
 * this system does not hold for anybody, so the label asserted a check nothing performs. The
 * renamed reason states only what a coordinator can actually know and say, and it stays distinct
 * from `"referred_elsewhere"` (this request is another service's to answer, versus this request
 * has already been sent on somewhere else). None of these is a figure, timeframe or threshold
 * from the Mental Health Act, and none reads as being about the person's presentation or
 * behaviour — the same bar that kept "Pending case review outcome" out of
 * `BED_RELEASE_BLOCKERS` ("case review" reads as about the patient's own case, not the
 * bed/service).
 *
 * ⚠️ THE CATCH-ALL, AND IT EXISTS BECAUSE THE ALTERNATIVE WAS A DEAD END.
 *
 * Owner decision, 2026-09-02: a ward must state why it is refusing a patient, which closed a
 * defect where a ward that pressed Decline without touching the control was recorded as saying
 * "no suitable bed". ⚠️ THAT FIX CREATED A NEW PROBLEM: a ward whose real reason is not one of
 * the other six could then not decline AT ALL. Asked to choose between a chosen catch-all, free
 * text, and leaving the ward stuck, he chose the catch-all.
 *
 * ⚠️ NEVER FREE TEXT, and that is the same rule `homeRegion` records for itself. Free text
 * cannot be counted or compared, and it is where identifying details about a patient leak into
 * an operational field.
 *
 * ⚠️ AND IT IS A DELIBERATE CHOICE, NOT AN ABSENCE. A ward picks this on purpose, which is a
 * different thing from the unchosen state the control starts in — that one refuses to submit.
 * This one says "none of the other six, ring me", which is a real answer a coordinator can act on.
 */
export const REFERRAL_DECLINE_REASONS = [
  "no_suitable_bed",
  "age_band_not_provided_here",
  "sex_designation_unavailable",
  "secure_bed_unavailable",
  "belongs_to_another_service",
  "referred_elsewhere",
  "another_reason",
] as const;
export type ReferralDeclineReason = (typeof REFERRAL_DECLINE_REASONS)[number];

/**
 * Phase 7 fix round B (this task): "A sixth answer, given mid-build" in
 * `docs/ward-flow-phase-6-7-decisions.md`. A referral records the broad area a person is from —
 * a REGION, chosen from this fixed list, never an address, never a postcode, never free text.
 * Real Western Australian regions, permitted by roadmap decision 12 ("real WA place names for
 * geography and distance only") — a region name is public geography, not a fact the prototype
 * invented about anyone's home. `RECEIVE_REFERRAL` (`ward-flow-reducer.ts`) membership-checks
 * every referral's `homeRegion` against this array, the same discipline `REFERRAL_SOURCES` and
 * `REFERRAL_DECLINE_REASONS` already hold to, so an address can never be entered where a region
 * belongs.
 *
 * This field exists so a later phase can ask "how far from home was this person placed", never
 * to compute a distance or a travel-time band itself — that calculation is Phase 8's, deliberately
 * not built here. See the decisions doc for why the field is needed now: the out-of-area equity
 * measure the roadmap names "the one with teeth" would otherwise measure distance from the
 * referring hospital, not from home, because that is the only geography the system holds today.
 */
export const HOME_REGIONS = [
  "Perth Metropolitan",
  "Peel",
  "South West",
  "Great Southern",
  "Wheatbelt",
  "Goldfields-Esperance",
  "Mid West",
  "Gascoyne",
  "Pilbara",
  "Kimberley",
] as const;
export type HomeRegion = (typeof HOME_REGIONS)[number];

/**
 * Where a referral is ADDRESSED, and the criteria that destination can answer.
 *
 * Owner ruling, 2026-08-30: every referral is a request that can be accepted or declined. There is
 * no notification-only kind — a ward asking an ED to see someone, and a ward asking a community
 * team to follow someone up, are both requests, and both can be declined even though they rarely
 * are. So ONE verb and ONE lifecycle serve all four destinations, and **what varies between them is
 * the criteria, nothing else.**
 *
 * That is the whole reason this is a union rather than a `kind` string beside a flat field list.
 * A destination that carried only an address would let one screen ask a community team about bed
 * security. Here it cannot: **the community arm has no such field, so the question cannot be
 * spelled**, and `referralEligibility` (`ward-eligibility.ts`) cannot be called with anything but a
 * ward referral because the criteria it reads exist on no other arm. That is a compiler guarantee,
 * not a screen remembering.
 *
 * **What each arm carries, and why the other two carry nothing.** Capacity, sex mix, security and
 * authorisation are all properties of a BED. An ED is being asked a medical question and a
 * community team is answered by a team rather than a bed, so none of the four applies to them —
 * not "does not apply yet", but has no meaning there at all.
 *
 * **THERE IS NO `medical_ward` ARM, AND ITS ABSENCE IS A DECISION, NOT AN OVERSIGHT.** Owner,
 * 2026-08-30: "just route to ED which also includes medical ward" — a psychiatric ward sending
 * someone for a medical problem addresses the ED, and the ED is where a medical ward is reached
 * from. An arm for it was built and taken out again on that ruling. Recorded here so the next
 * reader who notices a psych ward can refer to a medical ward in real life does not add the arm
 * believing it was forgotten: it was considered, and deferred, with a reason.
 *
 * **NO ARM CARRIES AN ADDRESS OR A STATE.** An arm says what a destination IS and what it can be
 * asked; `ReferralAddressing` below says where a particular referral was sent and what came back.
 * Keeping the two apart is what stops a lifecycle field being read as a criterion — the union is
 * matched against beds, and a `state` inside it would sooner or later be matched against one too.
 *
 * (This comment previously recorded multi-destination as an OPEN QUESTION. Owner ruling FD-21,
 * 2026-08-30, settled it: one referral, several destinations, chosen in one act.)
 */
export const REFERRAL_DESTINATION_KINDS = ["psychiatric_ward", "emergency_department", "community_team"] as const;
export type ReferralDestinationKind = (typeof REFERRAL_DESTINATION_KINDS)[number];

export type ReferralDestination =
  | {
      kind: "psychiatric_ward";
      /**
       * Compared to a unit's `sexMix` and `sexDesignation` by equality. A fact about the person,
       * and the ONLY one that sits on an arm rather than on the referral itself — it is here
       * because it is read solely to match a bed's designation, and no other destination has one.
       */
      sex: Sex;
      /** Whether THIS REQUEST needs a secure bed. Never a fact stored about the person. */
      secureBedNeeded: boolean;
      /**
       * Whether THIS REQUEST needs a bed that can hold someone involuntarily — never a fact stored
       * about the person, and never a legal determination. Same convention as `secureBedNeeded` and
       * roadmap decision 5's cohort framing: the request needs an adolescent bed, a secure bed, or
       * here, a bed that can hold someone involuntarily — the word never attaches to the patient.
       * Introduces no figure, timeframe or threshold from the Mental Health Act; a plain
       * Voluntary/Involuntary bed label was already permitted, and this is the same category.
       */
      involuntaryBedNeeded: boolean;
    }
  | {
      kind: "emergency_department";
      /**
       * WHICH department. Required on every ED destination, whoever sent it and whyever.
       *
       * ⚠️ **THE ARM IS CALLED `emergency_department` AND THE REFERRAL DOES NOT GO TO ONE.** It
       * goes to the PSYCHIATRY SERVICE AT one — including the ward→ED medical notification, which
       * exists so that psychiatry know. ED medical staff are not users of this system at all:
       * `FD-16` records that their request arrives verbally, by phone or conversation, and
       * psychiatry then raise a referral addressed to themselves. That verbal step is the owner's
       * described workflow, not a gap somebody forgot to close.
       *
       * The name was kept rather than changed to `ed_psychiatry`, deliberately: renaming churns
       * every exhaustive switch over `REFERRAL_DESTINATION_KINDS` for a naming nuance a comment
       * carries just as well. **This comment IS the carrier — losing the fact is the cost that
       * matters, not the name.**
       */
      edId: string;
      /** WHY. See `REFERRAL_PURPOSES` — a separate axis from `kind`, on purpose. */
      purpose: ReferralPurpose;
    }
  | {
      kind: "community_team";
      /**
       * WHICH TEAM. Required on every community destination, and the whole point of this arm.
       *
       * ⚠️ **THIS FIELD EXISTS BECAUSE THE OWNER REVERSED THE RULE THAT USED TO STAND IN FOR IT.**
       * The community hub WIP (`2e9499fb`) decided whether a patient belonged to a team by comparing
       * the patient's `homeRegion` with the team's region. The owner ruled, 2026-08-31, that
       * association comes from a team NAMED ON THE REFERRAL and that home region is only a
       * geographic guess. Until this field existed the correct rule could not be spelled at all, so
       * the WIP was not merely wrong — it was the only thing the model could express.
       *
       * ⚠️ **SEEDED FROM THE CATCHMENT TABLE, DECIDED BY THE REFERRER, AND THEN FIXED.** The suburb
       * lookup in `ward-catchment.ts` proposes a clinic; it does not settle one. That table answers
       * `contested`, `unreviewed` and "not in the table" as often as it answers cleanly, and
       * `referral-destination-options.ts` deliberately refuses to collapse a contested reading to a
       * winner. So the value stored here is the team a person CHOSE for this referral, not a lookup
       * replayed later — which is what makes it stable when the table is edited, and what makes a
       * referral to a team outside the table representable at all.
       *
       * ⚠️ **AND IT IS A NAME, NOT AN ID INTO A REGISTRY, ON PURPOSE.** The catchment source names
       * clinics as strings and this system holds no authoritative registry of WA community teams;
       * minting ids for them would assert a roster nobody has ruled on. `COMMUNITY_TEAMS` in
       * `ward-teams.ts` is NOT that registry — it is ten placeholder names keyed by `HomeRegion`,
       * built for the board's "going back to" line, and keying association off it would re-introduce
       * region-derived membership through the back door. Never read it here.
       */
      teamName: string;
    };

/**
 * WHY A REFERRAL WAS ADDRESSED TO AN EMERGENCY DEPARTMENT — a separate axis from WHERE.
 *
 * `FD-15`/`FD-11`. Three flows address a department and none of them means the same thing: a
 * community service asking for a **bed**, ED psychiatry addressing **themselves** for a review
 * (`FD-16`'s self-addressed inbox, which is the whole mechanism), and a ward telling ED about a
 * **medical** problem.
 *
 * ⚠️ **IT IS A FIELD, NOT A KIND, AND THAT IS THE DECISION RATHER THAN A DETAIL.** A fourth
 * destination kind encoding "psychiatric review at an ED" would put the WHY inside the WHERE, and a
 * bed request would then be answered by the same affordance as a review request — which is how one
 * silently becomes the other.
 *
 * ⚠️ **AND IT EXISTS TO KILL A SPECIFIC WORKAROUND THAT WAS FOUND AND REFUSED RATHER THAN
 * SHIPPED:** inferring "addressed to itself" from `originSiteCode === department.siteCode`. That
 * compiles, reads correctly, and drops the ward→ED MEDICAL notification straight into the
 * psychiatry inbox — because a psychiatric ward at the same hospital shares that site code. It is
 * wrong on exactly the case the spec names, which is the case nobody re-reads after implementing
 * from it. `FD-18` is the general form; `tests/ward-referral-ed-destination.test.ts` is the guard.
 *
 * Only the ED arm carries it. A psychiatric-ward destination is asking for a bed and a community
 * team is not, so giving them a purpose would mean inventing values nobody has ruled on — and a
 * fixed list in this project is the owner's to write.
 */
export const REFERRAL_PURPOSES = ["bed", "psychiatric_review", "medical_assessment"] as const;
export type ReferralPurpose = (typeof REFERRAL_PURPOSES)[number];

/**
 * ONE DESTINATION THIS REFERRAL WAS SENT TO, AND WHAT THAT DESTINATION ANSWERED.
 *
 * Owner ruling FD-21, 2026-08-30: a referrer chooses several destinations in ONE act — not repeat
 * referrals — up to `PARALLEL_REFERRAL_CAP`. So a referral holds a list of these, and each one is
 * answered independently.
 *
 * **WHY THE STATE IS HERE AND NOT ON THE REFERRAL**, which is the whole reason this type exists.
 * A referral used to carry one `state`, one `decidedAt`, one `decidedBy`, one `declineReason` and
 * one `acceptedUnitId`, because there was one thing to decide. Two rulings make that impossible:
 *
 *   FD-24 — a decline locks nobody out, so one destination may decline while the others stay live.
 *           A referral whose ward said no is NOT a declined referral.
 *   FD-22 — the first acceptance cancels the rest. "Cancelled" is a state only a destination can
 *           be in; a referral is never cancelled, it is accepted.
 *
 * A plural list with the state left on the referral would have compiled and passed everything and
 * been unable to express either ruling.
 *
 * **And `cancelled` is why no separate withdrawal record exists here.** `Movement.withdrawnReferrals`
 * holds the same meaning for its own subject — a person already inside a department — and keeps it.
 * One meaning on two subjects is not a duplicated concept; two different NAMES for one meaning would
 * be. Kept deliberately distinct from FD-5, a referrer withdrawing, which is an act by a person
 * rather than a consequence of somebody else's acceptance, and which has no event yet.
 */
export const REFERRAL_ADDRESSING_STATES = ["queued", "accepted", "declined", "cancelled"] as const;
export type ReferralAddressingState = (typeof REFERRAL_ADDRESSING_STATES)[number];

export type ReferralAddressing = {
  destination: ReferralDestination;
  state: ReferralAddressingState;
  /** When this destination answered, or when acceptance elsewhere cancelled it. */
  decidedAt?: Instant;
  /** A ROLE, never a person — see `WARD_FLOW_ROLE_LABELS`. Absent on a `cancelled` addressing,
   *  because nobody decided it: it is a consequence of an acceptance, not an act. */
  decidedBy?: string;
  /** Only on a `declined` addressing, and only from `REFERRAL_DECLINE_REASONS`. */
  declineReason?: ReferralDeclineReason;
  /**
   * Only on an `accepted` addressing, and only from `OVERRIDE_REASONS` — the SAME vocabulary the
   * three placement events use, deliberately not a second one. Set when the ward accepted a
   * referral that failed a judgement gate (age, legal status, sex designation, forensic, security,
   * sex mix), which is permitted with a reason recorded and refused without one.
   *
   * ⚠️ Its ABSENCE on an accepted addressing means the referral passed every gate — not that
   * nobody bothered to type a reason. The reducer refuses the acceptance outright in that case, so
   * an accepted-and-unreasoned addressing is only ever a clean one.
   */
  acceptOverrideReason?: OverrideReason;
  /** The unit that accepted. Only ever set on a `psychiatric_ward` addressing — the other three
   *  are answered by a person or a team, and have no unit to name. */
  acceptedUnitId?: string;
};

/** The ward arm, named so signatures can require it. */
export type WardReferralDestination = Extract<ReferralDestination, { kind: "psychiatric_ward" }>;

/**
 * One addressing whose destination is a psychiatric ward — the only kind with bed criteria, and so
 * the only thing `referralEligibility` can be asked about.
 *
 * This replaced a `WardReferral = Referral & { destination: WardReferralDestination }` intersection
 * when a referral gained several destinations. The intersection said "a referral that is a ward
 * referral", which stopped being a meaningful claim: a referral can be addressed to a ward AND an
 * ED at once, so the ward-ness belongs to the addressing, not to the referral.
 */
export type WardAddressing = ReferralAddressing & { destination: WardReferralDestination };

/**
 * The front door: a referral arriving from anywhere in the network, before it is ever a
 * `Movement` inside a department. Carries a deliberately tiny, governed set of facts about the
 * person referred and nothing else: no name, date of birth, record number, address, diagnosis, or
 * narrative history or treatment. No free-text field of any kind, unlike `Decline` (which has an
 * optional `note`) — a referral has no field a person's own words, or an author's summary of them,
 * could ever land in. `tests/ward-referral-model.test.ts` asserts this structurally, against this
 * type's own field set, so a future field named `patientId`, `notes`, `diagnosis` or `dob` is
 * caught rather than merely discouraged by convention.
 *
 * **THE FACTS ABOUT A PERSON ARE `ageBand`, `homeRegion`, AND — on a ward referral only — `sex`.**
 * This comment said "EXACTLY five facts" until the destination union landed, listing
 * `secureBedNeeded` and `involuntaryBedNeeded` among them. That was never right, and the type's own
 * field comments said so in the same breath: both are described there as facts about the REQUEST,
 * never about the person. Splitting the arms made the contradiction impossible to keep. Corrected
 * rather than deleted, because the count is a governance record and the reason it changed is the
 * part worth keeping.
 *
 * The set moved from three to four mid-build (Task 2, "A fifth answer, given mid-build" in
 * `docs/ward-flow-phase-6-7-decisions.md`, spec D5), from four to five in Phase 7 fix round B
 * ("A sixth answer, given mid-build" in the same doc), which added `homeRegion`, and was restated
 * — not widened — when the destination union landed on 2026-08-30. Each widening is deliberate and
 * rare on purpose: widening this set is a governance decision, not an implementation one, and the
 * structural test is what makes that true rather than aspirational.
 *
 * **`ageBand` and `homeRegion` stayed common to every destination, and that was a judgement.**
 * Every destination kind has age bands — a paediatric ED, a youth community team, an adolescent
 * ward — and every one of them cares where a person is from. Neither is a bed property, so neither
 * belongs on the ward arm. Recorded here as a decision rather than left as an accident of where the
 * fields already sat; if the owner rules otherwise, this is the line to change.
 *
 * **What `homeRegion` did and did not do** (corrected, review finding I5). It is the first fact
 * this system holds about where a person is from. It does NOT give any bed a catchment: neither
 * `Site` nor `Unit` carries a region, nothing associates a bed, unit, site or service with one,
 * and nothing checks a `DECLINE_REFERRAL`'s administrative decline reason against anything at all
 * — that reason is still the coordinator's own assertion, checked against nothing. Phase 8 Task 6
 * closed the honesty half of that gap by renaming `"out_of_catchment"` to
 * `"belongs_to_another_service"`, so the reason no longer implies a catchment check; the reason is
 * still unchecked, and `homeRegion` cannot check it — a catchment is a service's boundary and a
 * home region is where a person lives, and the two vocabularies do not align (ten WA regions
 * against five health services), so mapping one onto the other would invent an administrative
 * fact. This comment previously claimed the gap was closed; it was not,
 * and `HOME_REGIONS`' own comment 25 lines above already said the honest version. A comment
 * asserting an unchecked real-world fact is exactly how the deleted Form 1A figure entered this
 * codebase — an agent read it, believed it, and wrote it into the model.
 */
/**
 * Why a suburb is not a `string` — and it was one, for about an hour.
 *
 * 🔴 **A PATIENT OF NO FIXED ABODE COULD NOT BE REFERRED AT ALL.** The field landed as
 * `suburb: string`, resolved against the catchment table, empty refused. There was therefore no
 * representable answer for *"not known"* — and in psychiatry that is not an edge case. Homelessness
 * is common among people needing acute admission, and a person brought in by police at 3am
 * frequently has no recorded address. ⚠️ **The front door refused precisely the cohort most likely
 * to need a bed.** Found by Ward Referrals reading the committed code rather than the description
 * of it.
 *
 * ⚠️ **AND OPTIONAL WOULD HAVE BEEN WORSE.** An unanswered suburb passing the form and failing at
 * the reducer is a control that appears to accept and does not. The type has to carry the answer,
 * not omit it.
 *
 * ⚠️ **THE FAILURE MODE THIS PREVENTS IS A CLINICIAN TYPING SOMETHING UNTRUE.** Faced with a
 * required picker and no honest option, the way past the form is to choose a plausible nearby
 * suburb — which puts an invented administrative fact into the record through the one field that
 * had resolution built into it specifically to keep invented places out. A type that cannot say
 * "we do not know" does not prevent unknowns; it launders them.
 *
 * ⚠️ **WHETHER "NOT KNOWN" AND "NO FIXED ABODE" ARE ONE ANSWER OR TWO IS THE OWNER'S, AND IT IS ON
 * HIS QUEUE.** They mean different things to a community team deciding who follows a patient up,
 * which is this field's whole purpose. `SUBURB_UNKNOWN_REASONS` is provisional and has one member;
 * a second is an ADDED MEMBER, not a rebuild, which is why this is a union rather than
 * `string | null` — `R41`: a wrong value is an edit, a wrong shape is a rebuild.
 */
export const SUBURB_UNKNOWN_REASONS = ["not_known"] as const;
export type SuburbUnknownReason = (typeof SUBURB_UNKNOWN_REASONS)[number];

/** What a screen says. One home for the wording, so no surface invents its own phrase for absence. */
export const suburbUnknownLabels: Record<SuburbUnknownReason, string> = {
  not_known: "Suburb not known",
};

export type ReferralSuburb = { kind: "named"; name: string } | { kind: "unknown"; reason: SuburbUnknownReason };

/**
 * How long each written-history field may be.
 *
 * ⚠️ **PLACEHOLDERS. NOBODY HAS MEASURED A REAL REFERRAL AGAINST THEM.** Chosen to be generous
 * enough that no ordinary referral meets one, and small enough that the field is BOUNDED — a
 * bounded free-text field is a different privacy proposition from an endless one. The owner has
 * been told they are unmeasured and it is his number to set.
 *
 * ⚠️ **A LIMIT IS ENFORCED BY REFUSING, NEVER BY CUTTING.** The reducer rejects an over-length
 * value and the front door shows a counted, blocking state. Nothing truncates: silently dropping
 * the tail of a risk note is the worst thing this form could do, and it would look like success.
 *
 * ⚠️ **2000, AND IT IS NOT A NEW NUMBER.** The three-box form used 1500 / 2000 / 1000; the owner's
 * 2026-09-05 ruling collapsed it to one box and this takes the LARGEST of the three rather than
 * authoring a fresh figure or summing them. Total capacity therefore falls from 4500 to 2000, and
 * that is a real reduction — but an over-long story BLOCKS the Send with a counted, visible
 * message, so a referrer who needs more is told, not truncated.
 *
 * The keys are exactly the history fields on `Referral`, so a second field cannot be added without
 * either appearing here or failing `historyFieldsAreLimited` in the model tests.
 */
export const REFERRAL_HISTORY_LIMITS = {
  history: 2000,
} as const;

export type ReferralHistoryField = keyof typeof REFERRAL_HISTORY_LIMITS;

/* `REQUIRED_HISTORY_FIELD` was declared here until the owner's ruling of 2026-09-05: ONE story
 * box, OPTIONAL. There is no required history field any more, so the constant is gone rather than
 * left pointing at a rule nobody enforces. The reducer's blank-refusal went with it. */

export type Referral = {
  id: string;
  /**
   * Everywhere this referral was sent, and what each of them answered. One to
   * `PARALLEL_REFERRAL_CAP` entries, chosen by the referrer in ONE act (FD-21) — never repeat
   * referrals, which would be several referrals for one person and a different thing entirely.
   *
   * Each entry carries its own state, so one destination declining leaves the others live (FD-24)
   * and the first acceptance cancels the rest (FD-22). See `ReferralAddressing`.
   *
   * The referral's own state is DERIVED from these by `referralState` (`ward-referrals.ts`) rather
   * than stored beside them — two homes for one fact is how a referral comes to say "queued" while
   * a destination it holds says "accepted".
   */
  destinations: ReferralAddressing[];
  /**
   * ⚠️ WHICH PERSON THIS REFERRAL IS ABOUT — A POINTER, NEVER A COPY.
   *
   * Owner ruling, 2026-09-02, confirmed to Ward Builder Two directly: *"Yes to the referral
   * remembering its patient."* Until then a `Referral` deliberately carried NO link to anybody, and
   * `ALLOWED_REFERRAL_FIELDS` (`tests/ward-referral-model.test.ts`) named `patientId` as a field
   * its guard existed to catch. **This is that guard being widened by a decision, not defeated.**
   *
   * ⚠️ AN ID AND NOTHING ELSE. No name, no date of birth, no record number, no address, no
   * diagnosis — those remain forbidden and the structural test still fails on every one of them.
   * A `patientName` stored "for convenience" beside this would satisfy the letter of that guard and
   * destroy the point of it: the referral is supposed to hold a POINTER, so that what a person's
   * identity says lives in exactly one place and cannot drift into an operational record.
   *
   * ⚠️ OPTIONAL ON PURPOSE. A referral raised outside the patient flow legitimately has no person
   * on file yet, and a required field would force something to be invented — which is how a
   * fabricated identity enters a clinical record.
   *
   * ⚠️ AND NOTHING READS IT YET. Whether a ward may see where else a person has been referred is
   * `FD-23`, and the mechanism for that does not exist. Writing the pointer and displaying a
   * person's referral history are two different decisions and only the first has been made.
   */
  patientId?: PatientId;
  // Facts about a person, common to every destination. Nothing else may ever be added here.
  ageBand: Cohort;
  /**
   * The broad area this person is from — see `HOME_REGIONS`'s own doc comment. A region, never
   * an address; membership-checked, never free text. Carries no distance, travel-time band or
   * ordering by proximity — that is Phase 8's work, deliberately not built here.
   */
  homeRegion: HomeRegion;
  /**
   * The suburb this person is from — **`CM-4`: the suburb is the RECORDED fact.** It is the coarsest
   * fact the owner's catchment documents are keyed on and the finest one that is stable, so it
   * survives whichever way the five deferred catchment questions are answered.
   *
   * ⚠️ **A SUBURB IS NOT AN ADDRESS (`PD-3`), and that is the entire reason this field is allowed
   * to exist.** It identifies a service area, not a dwelling. `PD-1`'s permission to hold facts
   * about a person reaches it for exactly that reason, while `address` remains UNRULED and the
   * guard stays closed on it. A ruling permitting a suburb must never be read as permitting the
   * category.
   *
   * ⚠️ **Resolved against the catchment table, never checked for non-emptiness** —
   * `referralSuburbIsKnown` (`ward-referrals.ts`), enforced by `RECEIVE_REFERRAL`. A street address
   * is a non-empty string and would pass a length check, which would put the very thing this field
   * is coarser than into the field itself.
   *
   * ⚠️ **`homeRegion` IS NOT DERIVED FROM THIS, AND THE DUPLICATION IS AN ACCEPTED COST WITH A
   * REASON.** `CM-4` says region should be derived from suburb, and it cannot be today: the
   * catchment source keys suburbs to follow-up CLINICS, not to the ten WA regions `HOME_REGIONS`
   * holds. Mapping one onto the other would invent an administrative fact — the same invention
   * `homeRegion`'s own comment refuses, and the reason `"out_of_catchment"` was renamed. So both
   * are stored, they CAN contradict one another, and nothing can catch it. Recorded rather than
   * quietly lived with; `tests/ward-referral-suburb.test.ts` is where the fix starts on the day a
   * suburb-to-region source exists.
   *
   * ⚠️ **PROVENANCE: relayed by Ward Referrals, not heard first-hand by this session** (`R55`). The
   * design basis, `CM-4` and `PD-3`, is first-hand in the register and is what this is built on.
   */
  suburb: ReferralSuburb;
  // Facts about the referral itself.
  source: ReferralSource;
  raisedAt: Instant;
  urgency: UrgencyLevel;
  /** A synthetic site code (see `wardSites`), never an address. */
  originSiteCode: string;
  transportNeeded: boolean;
  /**
   * ⚠️ THE WRITTEN HISTORY — THE ONLY FREE TEXT ON A REFERRAL, AND THE ONLY FIELD HERE THAT
   * NOTHING CAN CHECK.
   *
   * Owner instruction, 2026-09-05: a referrer must be able to write the patient's story. Until
   * that date this type held no free text of any kind, and the front door had NO free-text control
   * — no `<textarea>`, no `[contenteditable]` — which made "this form cannot record a name, an
   * address or a clinical note" true BY CONSTRUCTION rather than by anyone's care. Three screens
   * said so to clinicians and were right.
   *
   * ⚠️ **THAT GUARANTEE IS GONE, AND THIS IS WHERE IT WENT.** It is now a policy people keep, not
   * a property the software holds. Every sentence that promised otherwise was rewritten in the
   * same change that added this field, and `mockup-referral-intake-v6.html` carries the wording.
   * If you are reading this because you are about to write a governance sentence: say which half
   * is enforced. The STRUCTURED fields still cannot hold a name. This one plainly can.
   *
   * ⚠️ **NOTHING MAY EVER BE DERIVED FROM IT.** Not an urgency, not a risk level, not a
   * destination, not a ranking, not a summary. `urgency` is recorded from the referrer and
   * `UrgencyLevel` is a closed union for exactly this reason; a screen that read a risk out of
   * this prose would be inferring a clinical judgement from it, which is the line this prototype
   * does not cross. No parser, no keyword scan, no length heuristic. **A referral whose story is
   * blank is not a referral about a safe person** — the field being optional makes that clearer,
   * not less true.
   *
   * ⚠️ **STORED BYTE FOR BYTE.** No trim, no normalisation, no truncation. A form that quietly
   * drops the last paragraph of a story is worse than one that refuses to send, so the length
   * limit is enforced at the front door as a BLOCKING, VISIBLE state and never by silently
   * cutting. `REFERRAL_HISTORY_LIMITS` holds it, and the reducer refuses an over-length value
   * rather than shortening it.
   *
   * ⚠️ **EMPTY IS A REAL ANSWER, WHICH IS WHY THIS IS `string` AND NOT OPTIONAL.** `""` means
   * the referrer left it blank; there is no third state where the field did not exist. Screens
   * render the blank as words — "Not written yet" — never as an empty box, because a blank reads
   * as a value.
   *
   * ⚠️ **AND NOTHING REQUIRES IT TO BE NON-EMPTY. Owner ruling, 2026-09-05: one story box,
   * OPTIONAL.** It was three boxes with the first required until that ruling; `FD-13` had said one
   * optional field from 2026-08-30 and the built form had diverged from it. A referrer with
   * nothing written down should not be made to invent something to get a referral out of the
   * door, and a blocked Send at 3am is answered by typing a character, not by writing a history.
   *
   * ⚠️ **ONE FLAT `string`, NEVER AN OBJECT.** The three-box version was three flat keys for a
   * reason that survives the collapse to one: a `history: {...}` object would be ONE permitted key
   * in `ALLOWED_REFERRAL_FIELDS` with an unchecked shape behind it — precisely the hole that opened
   * when the decision fields moved inside `destinations` and needed two more allowlists to close.
   * If a second box is ever wanted, it is a second flat key, not a nested one.
   */
  history: string;
  // `state`, `acceptedUnitId`, `declineReason`, `decidedAt` and `decidedBy` were here until
  // 2026-08-30. All five moved onto `ReferralAddressing`, because with several destinations there
  // is no longer one thing to decide — see that type's own doc comment. `referralState` derives the
  // referral's overall state from its destinations.
  /**
   * Phase 8 (spec D8-6): that somebody looked for a bed closer to home before this referral was
   * placed, and when. Optional because nobody knows whether country services do this today — the
   * step exists as something a coordinator MAY record if it happened, and is never a stage the
   * pathway requires, never a gate on acceptance, and never something whose absence is counted
   * against anyone.
   *
   * `by` is a ROLE (`WardFlowRole`), never a person, exactly as `decidedBy` above is. There is
   * deliberately no note, reason or outcome field: a free-text field here would be the one place
   * a person's own words could land on a referral, which `Referral`'s own doc comment forbids
   * outright, and an outcome enum would be inventing a vocabulary nobody has been asked for.
   */
  localBedSought?: { at: Instant; by: string };
  /**
   * When this person was triaged into the department the referral concerns — the start of the
   * SECOND clock, and the field `P9-D7` was recorded against before anything could read it.
   *
   * `P9-D2` (OWNER, 2026-08-30): every wait carries two clocks, both visible — time in department
   * **from triage**, and time since the referral to mental health. **The gap between them is the
   * signal**: it says whether the delay sits upstream of mental health or with them. His words are
   * the reason this is triage rather than anything else — he rejected a *medically-ready* start
   * because it *"needs a state somebody must actively set, so the number silently depends on
   * remembering to tick something."*
   *
   * ⚠️ **ABSENT IS A REAL STATE AND IT IS NOT ZERO.** A community expect sits on the to-see board
   * before arriving (`P9-D5`), so for them the department clock does not exist yet. `P9-D7`
   * requires it to render as genuinely absent — never `0m`, never an em dash styled like a
   * duration, never a zero sorting alongside real waits, because *"a not-yet-arrived expect showing
   * '0m in department' reads as 'just arrived', which is the opposite of the truth."* Read it
   * through `referralClocks` (`ward-referrals.ts`), which returns `undefined` rather than a number
   * no screen should print.
   *
   * ⚠️ **THIS IS NOT THE `arrivedAt` PHASE 8 TASK 2R DELETED, and the distinction is the whole
   * reason for the name.** That field meant arriving **at a bed**, and it was removed because
   * `Admission` (`ward-admissions.ts`) is the single record of a person occupying one — a
   * tightening, not an oversight. This is arriving **in the department**: a different event, at a
   * different place, starting a different clock, for a person who may never get a bed at all.
   * Calling it `arrivedAt` again would have read as reversing that deletion rather than
   * complementing it, and the guard comment in `tests/ward-referral-model.test.ts` says both.
   *
   * ⚠️ **TRIAGE IS NOT ARRIVAL, AND NO SCREEN MAY WORD IT AS ONE.** A patient arrives, waits, and
   * is triaged some time later — on a busy night that gap is not small. This field is therefore a
   * PROXY for arrival and the closest thing the system actually records. The arithmetic does not
   * care; the wording does. *"Arrived 14:20"* asserts a fact this model does not hold, so every row
   * says triage. Raised by Ward Referrals, whose ED hub is the first screen to render it, against a
   * comment of mine that said "arrival" three times beside a field that says triage — **the name was
   * honest and the comment was not, which is the half a reader copies.**
   *
   * The ruling it implements is worded as arrival (`P9-D7`: the referral clock runs only until the
   * patient arrives). Triage is what stands in for it. Whether that gap matters clinically is the
   * owner's question, not ours, and it is a proxy the prototype can live with **while it is labelled
   * as one.**
   *
   * ⚠️ **PROVENANCE: owner ruling, RELAYED through the orchestrator (`P9-F3`, 2026-08-30).** No
   * session heard it first-hand, which `R55` requires to be recorded rather than smoothed into
   * "(OWNER)". It is a time, never a person fact: it says where a body is, not who they are.
   */
  triagedAt?: Instant;

  /**
   * Whether this patient's medical workup is done, as recorded by the emergency department holding
   * them. Written only by `RECORD_MEDICAL_CLEARANCE`.
   *
   * ⚠️ **THREE STATES, NOT TWO, AND THAT IS THE WHOLE POINT.** Absent means **NOBODY HAS
   * ASSESSED IT** — it does not mean "not cleared". A boolean cannot hold that difference, and on
   * the day this field was added the owner had just ordered the identical defect fixed on the ED
   * referral form's `specialling`, where an unticked checkbox meant both "not required" and "not
   * answered" and the reducer read the ambiguity as a decision. **Do not collapse this to a
   * boolean, and do not default it.**
   *
   * On the `Referral` rather than the `Movement` because the psychiatry inbox — the surface the
   * owner asked for it on — renders referrals, and **nothing joins a `Movement` to a `Referral`.**
   */
  medicalClearance?: {
    cleared: boolean;
    at: Instant;
  };
};
