import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  BedPreparationNote,
  BedReleaseBlocker,
  LegalStatusChangeReason,
  UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";

export type HealthService = "North Metro" | "South Metro" | "East Metro" | "WACHS" | "Private";
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
  "bed_held",
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
  "bed_held_for_earlier_referral",
  "out_of_catchment",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

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
  /** Physical/procedural security, not one of the four bed-matching dimensions below — do not
   *  fold this into `forensic`; they are independent facts (a locked ward need not be forensic,
   *  and a forensic bed is not automatically a locked ward in this model). */
  security: Security;
  /**
   * Authorised under the Mental Health Act 2014 to receive involuntary admissions. This IS the
   * bed's legal-status dimension — an authorised bed accepts BOTH voluntary and involuntary
   * admissions (it is a capability, not a value to equality-match), a non-authorised bed accepts
   * voluntary only. There is deliberately no separate `legalStatus` field on `Unit` for this same
   * fact: two fields for one fact is how a screen ends up giving two answers.
   */
  authorised: boolean;
  beds: number;
  /** Physically empty beds, per the feed. */
  empty: CapacityFigure;
  /** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */
  allocatable: CapacityFigure;
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

export type Decline = {
  unitId: string;
  at: Instant;
  reason: DeclineReason;
  note?: string;
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

export type TransportJob = {
  id: string;
  provider: string;
  escortRequired: boolean;
  formRequired?: string;
  acceptedAt?: Instant;
  enRouteAt?: Instant;
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
 * The undo the prototype has never had (Task 3, spec item 10). Before this, the only path that
 * released a held bed or cancelled a transport job was closing the movement outright — recording
 * an examination with outcome `community_order` or `revoked` — so a coordinator who held the
 * wrong bed had to declare the patient does not need admission in order to correct it.
 * `RELEASE_HOLD` and `CANCEL_TRANSPORT` unwind exactly one earlier reservation each, WITHOUT
 * closing the movement, clearing `legalForm`, or touching `referredUnitIds` — the movement
 * survives and keeps its acceptance. Every unwind is recorded here so the fact that a hold or a
 * transport job was undone is never silently lost, the same discipline `StatusChange` and
 * `UrgencyChange` already hold to for their own reversible facts.
 */
export type UnwindRecord = {
  at: Instant;
  kind: "hold_released" | "transport_cancelled";
  by: string;
  reason: string;
  /** The cancelled job retained in the audit trail when a replacement becomes active. */
  transportId?: string;
};

export type Movement = {
  id: string;
  /** Where the patient physically is. Detention here is lawful even when unauthorised. */
  originEdId: string;
  openedAt: Instant;
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
  acceptedAt?: Instant;
  declines: Decline[];
  transport?: TransportJob;
  blocker: string;
  closure?: MovementClosure;
  /** When the referral for examination was made. May precede `openedAt` for a community-formed
   *  patient — the legal clock and the department clock are different clocks. */
  formedAt?: Instant;
  /** How the patient reached the department. Police attendance is a real and invisible pressure. */
  arrivalMode?: "self" | "ambulance" | "police";
  /** When a held bed lapses. A hold cannot expire without a time to expire at. */
  bedHeldUntil?: Instant;
  /** The psychiatric examination a Form 1A refers the person for. Until it happens you often do
   *  not know whether an authorised bed is needed at all. */
  examination?: { at: Instant; outcome: "inpatient_order" | "community_order" | "revoked" };
  /** Referrals ended because another unit accepted. A shrinking `referredUnitIds` tells nobody. */
  withdrawnReferrals: { unitId: string; at: Instant; reason: string }[];
  /** Recorded when the network is exhausted. */
  escalation?: { at: Instant; triedUnitIds: string[]; contact: string };
  /** Every hold released and transport job cancelled against this movement, oldest first. Empty
   *  for a movement nothing has ever been unwound on. See `UnwindRecord`'s own doc comment. */
  unwinds: UnwindRecord[];
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
 * stage and became a flag (`BedRelease.blocker`/`blockedBy`) that sits ON a predicted or
 * confirmed release, because being stuck is not a degree of certainty.
 *
 * The defect that forced it, verified in the code before it was raised: `capacityBreakdown`
 * (`ward-bed-availability.ts`) sorted today's releases into `confirmedToday` or `predictedToday`
 * by state, so a release in state `"blocked"` matched NEITHER branch and was counted nowhere.
 * Marking a confirmed discharge blocked silently dropped the ward's confirmed count — the figures
 * improved at the exact moment the ward got stuck. A blocked-but-confirmed bed now keeps counting
 * as confirmed, and `CapacityBreakdown.blockedToday` states how many are stuck beside it.
 *
 * Transitions go BOTH ways: `confirmed` may return to `predicted` when a decision is reversed
 * (`REVERT_BED_RELEASE`). The old one-way model did not stop reversals happening — it made wards
 * record them dishonestly.
 */
export const BED_RELEASE_STATES = ["predicted", "confirmed", "released"] as const;
export type BedReleaseState = (typeof BED_RELEASE_STATES)[number];

/**
 * **The Q1 axis change, landed 2026-08-28** ("The three lists", List 2). This replaces
 * `BED_RELEASE_CONFIDENCE_LEVELS` — the `likely` / `possible` pair Phase 5 shipped — outright.
 *
 * A predicted discharge no longer carries HOW CONFIDENT the ward is; it carries WHAT IT IS
 * WAITING ON. The owner's reasoning: confidence asks a ward to estimate a probability, people are
 * poor at that, and worse, two wards' "likely" do not mean the same thing — so a coordinator can
 * neither compare them nor add them up. What a discharge is waiting on is a **fact, not a
 * judgement**: comparable across wards, and actionable. A bed waiting on a ward round is a
 * different prospect from one waiting on a family meeting.
 *
 * **`"Nothing outstanding"` carries more weight than it looks.** It is a predicted discharge with
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
   * while `state` is `"predicted"` — a confirmed discharge is a decision, not something still
   * being waited on, and a released one has already happened.
   *
   * Renamed from `confidence` by the Q1 axis change of 2026-08-28. Keeping the old name over the
   * new values would have put "Awaiting ward round" in a field called `confidence` on a screen a
   * coordinator reads as fact, which is the kind of quiet mismatch this project treats as a
   * defect rather than a cosmetic point.
   *
   * `"Nothing outstanding"` is a legitimate value, not an absence: it means a predicted discharge
   * with no obstacle. `null` means the release is not predicted at all. The two are different and
   * must not be collapsed.
   */
  waitingOn: BedReleaseWaitingOn | null;
  /**
   * **The blocked FLAG's reason** (bed-model rework, 2026-08-28). Non-null means this discharge
   * is decided-or-expected AND currently stuck; it may sit on a `"predicted"` release or on a
   * `"confirmed"` one, and a blocked-but-confirmed release still counts as confirmed. Always
   * `null` on a `"released"` release — once the bed is free there is nothing left being held up.
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
 */
export const REFERRAL_DECLINE_REASONS = [
  "no_suitable_bed",
  "age_band_not_provided_here",
  "sex_designation_unavailable",
  "secure_bed_unavailable",
  "belongs_to_another_service",
  "referred_elsewhere",
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
 * The front door: a referral arriving from anywhere in the network, before it is ever a
 * `Movement` inside a department. Carries EXACTLY five facts about the person referred —
 * `ageBand`, `sex`, `secureBedNeeded`, `involuntaryBedNeeded`, `homeRegion` — and nothing else: no
 * name, date of birth, record number, address, diagnosis, or narrative history or treatment. No
 * free-text field of any kind, unlike `Decline` (which has an optional `note`) — a referral has
 * no field a person's own words, or an author's summary of them, could ever land in.
 * `tests/ward-referral-model.test.ts` asserts this structurally, against this type's own field
 * set, so a future field named `patientId`, `notes`, `diagnosis` or `dob` is caught rather than
 * merely discouraged by convention.
 *
 * This list moved from three fields to four mid-build (Task 2, "A fifth answer, given mid-build"
 * in `docs/ward-flow-phase-6-7-decisions.md`, spec D5), and from four to five in Phase 7 fix
 * round B (this task, "A sixth answer, given mid-build" in the same doc), which added
 * `homeRegion`. Each widening is deliberate and rare on purpose — widening this list again is a
 * governance decision, not an implementation one, and this test is what makes that true rather
 * than aspirational.
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
export type Referral = {
  id: string;
  // The only five facts about a person. Nothing else may ever be added here.
  ageBand: Cohort;
  sex: Sex;
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
  /**
   * The broad area this person is from — see `HOME_REGIONS`'s own doc comment. A region, never
   * an address; membership-checked, never free text. Carries no distance, travel-time band or
   * ordering by proximity — that is Phase 8's work, deliberately not built here.
   */
  homeRegion: HomeRegion;
  // Facts about the referral itself.
  source: ReferralSource;
  raisedAt: Instant;
  urgency: UrgencyLevel;
  /** A synthetic site code (see `wardSites`), never an address. */
  originSiteCode: string;
  transportNeeded: boolean;
  state: ReferralState;
  acceptedUnitId?: string;
  declineReason?: ReferralDeclineReason;
  decidedAt?: Instant;
  /** A role, never a person. */
  decidedBy?: string;
};
