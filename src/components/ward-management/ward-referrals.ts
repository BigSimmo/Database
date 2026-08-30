import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { formatElapsed, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import {
  NOT_RECORDED_LABEL,
  OUT_OF_AREA_BANDS,
  TRAVEL_BAND_LABELS,
  TRAVEL_BANDS,
  travelBand,
  unitTravelBand,
  type TravelBand,
} from "@/components/ward-management/ward-distance";
import {
  candidateReason,
  referralEligibility,
  type EligibilityVerdict,
} from "@/components/ward-management/ward-eligibility";
import type {
  Referral,
  ReferralDeclineReason,
  ReferralDestination,
  Unit,
  WardReferralDestination,
  ReferralAddressing,
  ReferralState,
} from "@/components/ward-management/ward-model";

/**
 * Phase 7 (spec "The front door", D10): every unit in `units`, each paired with its eligibility
 * verdict against `referral` — NEVER a truncated list. The match view lists the beds that accept
 * this referral, and for every bed that does not, the single reason; a coordinator needs to see
 * the whole network, not a shortlist someone else already narrowed.
 *
 * `referralCandidates` never sorts, filters or ranks — it preserves exactly the order `units`
 * arrives in. The caller supplies units in the site table's own order (`allUnits()` in
 * `ward-sites.ts`), the same fixed order the morning page uses. Sorting by suitability here would
 * read as a recommendation, and D10 is explicit that this view shows candidates and a human
 * decides — it never allocates, never ranks, never suggests which bed is best.
 */
/**
 * The referral's own state, DERIVED from its destinations rather than stored beside them.
 *
 * Two homes for one fact is how a referral comes to say "queued" while a destination it holds says
 * "accepted", and nothing notices — so there is one home, and this reads it.
 *
 *   accepted — any destination accepted. FD-22 then cancels the rest, so there is never a second.
 *   declined — EVERY destination declined. One ward saying no is not a declined referral (FD-24);
 *              that is the case this function exists to get right.
 *   queued   — anything else, including a referral with one decline and two still waiting.
 *
 * `cancelled` is deliberately not a referral state. A destination is cancelled by somebody else's
 * acceptance; the referral that happened to is accepted, which is the more useful thing to say.
 */
export function referralState(referral: Referral): ReferralState {
  if (referral.destinations.some((addressing) => addressing.state === "accepted")) return "accepted";
  if (
    referral.destinations.length > 0 &&
    referral.destinations.every((addressing) => addressing.state === "declined")
  ) {
    return "declined";
  }
  return "queued";
}

/**
 * When this referral was decided: the LATEST decision across its destinations.
 *
 * Latest rather than earliest, because the board sorts "most recently decided first" and a
 * referral is not finished with until its last destination has answered or been cancelled. A
 * referral with no decided destination has no decided time, and says so with `undefined` rather
 * than a zero that would sort as the beginning of the demo day.
 */
export function referralDecidedAt(referral: Referral): Instant | undefined {
  const times = referral.destinations
    .map((addressing) => addressing.decidedAt)
    .filter((at): at is Instant => at !== undefined);
  return times.length > 0 ? Math.max(...times) : undefined;
}

/** The destination that accepted, if one has. At most one exists: FD-22 cancels the rest at the
 *  moment of acceptance, and `ACCEPT_REFERRAL` refuses a second. */
export function acceptedAddressing(referral: Referral): ReferralAddressing | undefined {
  return referral.destinations.find((addressing) => addressing.state === "accepted");
}

/** Every destination that declined, in the order the referral holds them. Plural because FD-24
 *  lets several decline while the referral stays live, and a screen showing only the first would
 *  be hiding refusals that were actually given. */
export function declinedAddressings(referral: Referral): ReferralAddressing[] {
  return referral.destinations.filter((addressing) => addressing.state === "declined");
}

/** Every destination cancelled by somebody else accepting (FD-22). Never a decision by anyone —
 *  see `ReferralAddressing`. */
export function cancelledAddressings(referral: Referral): ReferralAddressing[] {
  return referral.destinations.filter((addressing) => addressing.state === "cancelled");
}

/** Where a referral was sent, for display. Never a decision — see `referralState` for that. */
export function referralDestinationLabels(referral: Referral): string[] {
  return referral.destinations.map((addressing) => referralDestinationLabel(addressing.destination));
}

/** Human label for where a referral is addressed. Exhaustive by `switch` on the union, so a fifth
 *  destination cannot be added without this failing to compile. */
export function referralDestinationLabel(destination: ReferralDestination): string {
  switch (destination.kind) {
    case "psychiatric_ward":
      return "Psychiatric ward";
    case "emergency_department":
      return "Emergency department";
    case "community_team":
      return "Community team";
  }
}

/**
 * The person facts a screen may show for this referral, in display order.
 *
 * `sex` appears only for a ward referral, because it is HELD only there — it sits on the ward arm
 * to be matched against a bed's designation, and a referral to an ED, a medical ward or a community
 * team never carried it. A screen showing a blank where it would have been is showing the truth.
 *
 * Exists so no screen reaches into `destination` itself. Three of them used to read `referral.sex`
 * directly; each would now need its own narrowing, and one of them forgetting is how a
 * "not held here" becomes a crash or an empty cell nobody can explain.
 */
export function referralPersonFacts(referral: Referral): string[] {
  const ward = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  return ward && ward.destination.kind === "psychiatric_ward"
    ? [referral.ageBand, ward.destination.sex, referral.homeRegion]
    : [referral.ageBand, referral.homeRegion];
}

/** The sex cell for a table with a fixed Sex column. An em dash where the fact is not held, which
 *  is a different statement from an empty cell and reads as one. */
export function referralSexCell(referral: Referral): string {
  const ward = referral.destinations.find((addressing) => addressing.destination.kind === "psychiatric_ward");
  return ward && ward.destination.kind === "psychiatric_ward" ? ward.destination.sex : "—";
}

export function referralCandidates(
  referral: Referral,
  ward: WardReferralDestination,
  units: Unit[],
  now: Instant,
): { unit: Unit; verdict: EligibilityVerdict }[] {
  return units.map((unit) => ({ unit, verdict: referralEligibility(referral, ward, unit, now) }));
}

export type ReferralCandidate = { unit: Unit; verdict: EligibilityVerdict };

/**
 * Task 5: urgency tier leads, exactly like `queueOrder` (`ward-priority.ts`) does for movements
 * — the clinician's own judgement orders the queue first. Inside a tier, the referral that has
 * waited LONGEST goes first (earliest `raisedAt`), because "length of wait carries the moral
 * weight" (this task's own brief) even though urgency is what the queue ranks by. Scoped to
 * `"queued"` only — an accepted or declined referral has already left the queue a coordinator is
 * working, the same reason `queueOrder` scopes to `isOpen` movements only.
 */
export function referralQueueOrder(referrals: Referral[]): Referral[] {
  return referrals
    .filter((referral) => referralState(referral) === "queued")
    .sort((a, b) => a.urgency - b.urgency || a.raisedAt - b.raisedAt);
}

/**
 * Task 5: every referral no longer queued (`"accepted"` or `"declined"`), most recently decided
 * first — the board's second section, so a coordinator can see what just happened without
 * hunting through the whole history. A referral somehow missing `decidedAt` (the type marks it
 * optional; `ACCEPT_REFERRAL`/`DECLINE_REFERRAL` always set it, but a defensively-authored
 * fixture is not bound to) sorts last rather than throwing or silently coming first.
 */
export function recentlyDecidedReferrals(referrals: Referral[]): Referral[] {
  return referrals
    .filter((referral) => referralState(referral) !== "queued")
    .sort((a, b) => (referralDecidedAt(b) ?? -Infinity) - (referralDecidedAt(a) ?? -Infinity));
}

/**
 * "Waiting since" — the figure this task's brief says must be prominent on the board, because
 * length of wait carries the moral weight the urgency-led ordering above does not capture on its
 * own. Mirrors `elapsedLabel` (`ward-derivations.ts`) exactly, for `Referral.raisedAt` rather
 * than `Movement.openedAt` — same `formatElapsed`/`minutesUntil` pair, so a referral's wait and a
 * movement's wait are never worded two different ways.
 */
export function referralWaitLabel(referral: Referral, now: Instant): string {
  return formatElapsed(minutesUntil(now, referral.raisedAt));
}

/**
 * Whether this unit has ever confirmed its allocatable bed count — mirrors
 * `ward-morning-rollup.ts`'s own private `hasConfirmedAllocatable` exactly (see that function's
 * doc comment for why the check is `typeof … === "number" && Number.isFinite(…)` rather than a
 * truthiness or `!== undefined` test: the type says `confirmedAt` is always an `Instant`, but a
 * defensively-authored fixture is not bound to honour that, and treating `NaN` or `0` as a real
 * timestamp would silently misreport freshness). Kept local rather than imported — front-door
 * matching must not depend on the morning-rollup feature's module for an unrelated reason to
 * change (see `referralEligibility`'s own doc comment on why matching stays independent of
 * unrelated models).
 */
export function hasConfirmedCapacity(unit: Unit): boolean {
  const confirmedAt = unit.allocatable?.confirmedAt;
  return typeof confirmedAt === "number" && Number.isFinite(confirmedAt);
}

/**
 * The single reason the match view shows for a unit that does not accept this referral —
 * `candidateReason` (`ward-eligibility.ts`), with exactly one override. That function's raw
 * `capacity_freshness` gate detail reads `Last confirmed NaN min ago — stale` for a unit that has
 * NEVER confirmed its allocatable count (see `hasConfirmedCapacity` above): `now -
 * undefined` is `NaN`, and a coordinator must never read a fabricated number where the true
 * answer is "nobody has ever confirmed this". "Never confirmed" states that fact plainly instead
 * — never "0", which would read as a real, if scarce, confirmed count.
 */
export function matchReason(candidate: ReferralCandidate): string {
  if (!candidate.verdict.eligible) {
    const failedGate = candidate.verdict.gates.find((gate) => !gate.pass);
    if (failedGate?.gate === "capacity_freshness" && !hasConfirmedCapacity(candidate.unit)) {
      return `${candidate.unit.name} has never confirmed its allocatable bed count`;
    }
  }
  return candidateReason(candidate.verdict);
}

/**
 * The structural question the match view must answer before the operational one: does ANY unit
 * ANYWHERE in the network run this referral's age band at all? `units` here is always the full
 * network (`referralCandidates` never truncates it — see that function's own doc comment), so
 * this is a real structural fact, never a fact about a shortlist. When this is `false`, "no bed
 * available" would misstate an operational shortage as the true structural gap it is — see this
 * module's own consumer (`referral-match.tsx`) for the exact wording rule.
 *
 * KNOWN LIMIT, recorded rather than fixed (fix round C, review finding M10). This counts a
 * FORENSIC unit as satisfying the age band, and D7 says a forensic bed is never offered to
 * anyone. So a cohort whose only unit were forensic would read as an operational shortage ("No
 * unit accepts this referral right now") for a bed that will never be offered at all — the
 * structural/operational confusion this function exists to prevent, in the one case it does not
 * catch. It is NOT reachable on the shipped fixture: the network's single forensic unit
 * (`brm-adult-secure`) is Adult, and the network holds many other Adult units. The fix is one
 * clause (`&& !unit.forensic`), but it changes which banner a coordinator reads on a clinical
 * surface, so it is left for the owner to authorise rather than taken here — the same rule that
 * required the `sex_mix` correction in `ward-eligibility.ts` to be flagged before it was made.
 */
export function networkHasCohort(referral: Referral, units: Unit[]): boolean {
  return units.some((unit) => unit.cohort === referral.ageBand);
}

/**
 * The one spelling of a decline reason, for every screen that offers or reports one.
 *
 * Display labels only — never a picker's own option set, which is always
 * `REFERRAL_DECLINE_REASONS` itself (same convention as `referral-intake.tsx`'s `SOURCE_LABELS`):
 * a reason missing from this map still renders, via each consumer's `??` fallback, just less
 * prettily. It lives here rather than in `referral-match.tsx` because the board now reports the
 * reason on a decided row as well (review finding I3), and two components spelling one label
 * separately is the defect class this phase has already paid for four times.
 *
 * These are CATEGORY NAMES for an administrative outcome. They carry no figure, timeframe or
 * threshold of any kind, and `tests/ward-referral-model.test.ts` sweeps the VALUES a coordinator
 * actually reads — not merely the enum keys — for a digit, and pins this map's key set to
 * `REFERRAL_DECLINE_REASONS` exactly.
 */
export const DECLINE_REASON_LABELS: Record<ReferralDeclineReason, string> = {
  no_suitable_bed: "No suitable bed",
  age_band_not_provided_here: "Age band not provided here",
  sex_designation_unavailable: "Sex designation unavailable",
  secure_bed_unavailable: "Secure bed unavailable",
  belongs_to_another_service: "Belongs to another service",
  referred_elsewhere: "Referred elsewhere",
};

/**
 * Phase 8 (spec D8, Task 3). One band group: the band, and the candidates whose unit sits in it.
 *
 * `"not_recorded"` is a GROUP KEY, never a label — the one spelling a coordinator reads is
 * `NOT_RECORDED_LABEL` (`ward-distance.ts`), like every other band label on every other screen.
 *
 * Deliberately carries no count field. The two figures each heading shows — how many units are in
 * the band, and how many of those accept this referral — are `candidates.length` and
 * `candidates.filter((candidate) => candidate.verdict.eligible).length`: arithmetic over facts
 * already in this group, derived where they are rendered rather than frozen here. Nothing is
 * hidden by that choice, and it keeps this type a pure rearrangement of the caller's list.
 */
export type TravelBandGroup = { band: TravelBand | "not_recorded"; candidates: ReferralCandidate[] };

/**
 * The group order, derived from `TRAVEL_BANDS` and never hand-written. A parallel list of band
 * names is how two screens end up disagreeing about what bands exist — the same discipline
 * `TRAVEL_BAND_LABELS` holds to.
 *
 * `"not_recorded"` sits last because a gap is not a distance and cannot be placed among them, not
 * because it is far. Nothing in this order ranks anything: `TRAVEL_BANDS`' own doc comment records
 * that `air_transport_only` sits last "for grouping order and for nothing else".
 */
const TRAVEL_BAND_GROUP_ORDER: readonly (TravelBand | "not_recorded")[] = [...TRAVEL_BANDS, "not_recorded"];

/**
 * Phase 8 (spec D8, Task 3): the candidate list rearranged by how far each bed is from where this
 * person lives. A PURE REARRANGEMENT of a list somebody else computed — it adds nothing, removes
 * nothing and decides nothing.
 *
 * Three properties, each pinned by a test in `tests/ward-travel-grouping.test.ts`, because the
 * defining hazard of this phase is grouping quietly becoming ranking and that never arrives as a
 * decision — it arrives as a small helpful sort inside a group, or a group promoted to the top
 * because it is the useful one:
 *
 *  1. **Nothing is lost.** Every candidate lands in exactly one group. The key expression below is
 *     total over `TRAVEL_BAND_GROUP_ORDER` by construction — `unitTravelBand` returns
 *     `TravelBand | undefined`, and `undefined` maps to `"not_recorded"` — so there is no branch a
 *     candidate can fall out of and no bucket to be forgotten. A bed whose band the fixture does
 *     not record is SHOWN as unrecorded, never dropped and never guessed at.
 *  2. **Nothing is reordered inside a group.** `filter` preserves the caller's order, which is the
 *     site table's own order (`allUnits()` in `ward-sites.ts`), the same fixed order the morning
 *     page and the match view already use. There is no comparator here to tune.
 *  3. **Always exactly five groups, empty ones included.** An omitted group is worse than an empty
 *     one: "there is nothing within an hour" is the answer a coordinator came for, and a group
 *     that vanishes when it is empty cannot give it.
 *
 * Distance NEVER gates. Grouping is all this does — `ward-eligibility.ts` knows nothing about a
 * band and has no `travel_time` gate, so a bed three hours away that accepts this referral still
 * says so and still carries its Accept control.
 *
 * The band is looked up per call and never stored — not here, not on a `Referral`, not in a cache.
 * A stored band would outlive the day `ward-travel-bands.ts`'s placeholder values are replaced
 * with checked ones, which is precisely what must not happen.
 *
 * KNOWN LIMIT the signature cannot enforce, recorded rather than papered over: this groups the list
 * it is GIVEN, so "nothing is lost" is a property relative to its own input and not a guarantee
 * that every unit in the network reached it. `referralCandidates` above never truncates, and
 * `tests/ward-travel-grouping.test.ts` asserts separately that the grouped total equals the full
 * unit count — that second test, not this function, is what stops a later screen quietly handing
 * it three units of many.
 */
export function groupCandidatesByTravelBand(referral: Referral, candidates: ReferralCandidate[]): TravelBandGroup[] {
  return TRAVEL_BAND_GROUP_ORDER.map((band) => ({
    band,
    candidates: candidates.filter((candidate) => (unitTravelBand(referral, candidate.unit) ?? "not_recorded") === band),
  }));
}

/**
 * The ONE spelling of "this bed accepts this referral", for every surface that shows or counts
 * one. A row's styling, a row's wording, a group heading's count and any future summary all ask
 * this, so a heading can never mean something subtly different by "accepts" than the row beneath
 * it means. Three screens once each held their own copy of a single label and two of them
 * disagreed; the fix that was learned there is one exported function, not two files agreeing.
 *
 * It reads the verdict already on the candidate and NEVER recomputes eligibility. That is the
 * whole point — see `travelBandGroupCounts` below for why recomputation is the specific way these
 * numbers come apart.
 */
export function candidateAccepts(candidate: ReferralCandidate): boolean {
  return candidate.verdict.eligible;
}

/**
 * The two figures a band group's heading carries (owner decision, 2026-08-29): how many units are
 * in this band, and how many of those accept this referral.
 *
 * **Why this is a shared function rather than arithmetic each screen does for itself.** Two
 * surfaces will show band groups — the match view, and later the network diagram — and "how many
 * of these accept this referral" is a VERDICT, not arithmetic. Two components each deciding what
 * "accepts" means is how this project ended up with three screens holding their own copy of one
 * label, two of which disagreed.
 *
 * **Why it takes the GROUP and not `(referral, units, now)`.** This is the structural guarantee,
 * not a convention: taking the group means the only thing it can count is the very
 * `ReferralCandidate` objects the rows beneath the heading render, reading the `verdict` already
 * computed for each. It is not possible to write a heading that disagrees with its own rows,
 * because there is no second verdict for it to disagree with. A signature taking `now` would
 * permit exactly that divergence — `referralEligibility`'s `capacity_freshness` gate is
 * time-dependent, so a heading recomputed even a moment after the rows could legitimately report a
 * different number for the same beds, and nothing would look wrong in either place.
 *
 * **It counts what is present, never what is missing.** Two positive facts about the beds in this
 * band. There is deliberately no completeness figure, no tally of what the fixture failed to
 * record, and nothing that reads as a shortfall — an absence is shown by the not-recorded group
 * being present and populated, never by a number here. `accepting` is a subset of `units` and is
 * the only ratio these two ever form; neither is related to `outOfAreaLedger`'s counts, which
 * share no denominator with these or with each other.
 *
 * An empty group returns zeroes, and callers still render it: "none within an hour" is the answer
 * a coordinator came for, and a heading that vanishes when its count is zero cannot give it.
 */
export type TravelBandGroupCounts = { units: number; accepting: number };

export function travelBandGroupCounts(group: TravelBandGroup): TravelBandGroupCounts {
  return { units: group.candidates.length, accepting: group.candidates.filter(candidateAccepts).length };
}

/*
 * Phase 8, Task 8. The three pieces of wording a band group's heading and empty state are made of,
 * lifted out of the match view when the network diagram became a SECOND surface that draws band
 * groups.
 *
 * They are shared functions rather than markup written once per screen for the reason this project
 * keeps paying for: three screens once each held their own copy of one label and two of them
 * disagreed. A heading spelled in two components is a heading that can drift in one of them, and a
 * coordinator comparing the diagram against the match view would have no way to tell which spelling
 * was the intended one. The band LABELS themselves still come from `ward-distance.ts` and are not
 * re-spelled here — this only fixes how a group key maps to one, and how the two counts read.
 */

/** The one spelling of a band group's heading, for a real band and for the gap alike.
 *  `NOT_RECORDED_LABEL` is what a coordinator reads; `"not_recorded"` is only ever a key. An
 *  unrecorded band NEVER renders blank — a blank cell in a distance column is read as "close". */
export function travelBandGroupLabel(band: TravelBandGroup["band"]): string {
  return band === "not_recorded" ? NOT_RECORDED_LABEL : TRAVEL_BAND_LABELS[band];
}

/**
 * The one spelling of the two figures a band group's heading carries.
 *
 * Two present facts about the beds in this band and nothing else. `accepting` is a subset of
 * `units` and is the only ratio these two ever form; neither counts what is missing, and neither
 * shares a denominator with any other figure on any screen.
 */
export function travelBandGroupCountsSentence(counts: TravelBandGroupCounts): string {
  return (
    `${counts.units} ${counts.units === 1 ? "unit" : "units"} in this band · ` +
    `${counts.accepting} ${counts.accepting === 1 ? "accepts" : "accept"} this referral`
  );
}

/** What an empty group says under its heading. An empty group is still rendered, still carries its
 *  heading and still carries both counts — "there is nothing in this band" is an answer a
 *  coordinator came for, and a group that vanishes when it is empty cannot give it. */
export const TRAVEL_BAND_GROUP_EMPTY_SENTENCE = "No unit in this band.";

/**
 * One person currently in a bed the fixture records as out of area, and how long since they got
 * there. Carries the `Admission` and the `Unit` themselves rather than copies of fields off them,
 * so nothing here becomes a second place a band or a time is spelled.
 *
 * `band` is narrowed to `TravelBand` and only ever holds a member of `OUT_OF_AREA_BANDS` — an
 * unrecorded band can never reach this type, which makes "every entry is genuinely out of area" a
 * fact about the type rather than a claim about the code.
 */
export type OutOfAreaEntry = {
  admission: Admission;
  unit: Unit;
  band: TravelBand;
  /** Minutes since the admission's `arrivedAt`, computed exactly as `referralWaitLabel` above
   *  computes a wait — never clamped here, so a fixture authored with an arrival in the future
   *  reads as the oddity it is rather than silently as zero. `formatElapsed` clamps at the point
   *  of display. */
  sinceArrival: number;
};

/**
 * Phase 8 (spec D8-3): how many people are currently in a bed a long way from where they live, and
 * how many of those beds could not be classified at all. Two counts of two different things.
 *
 * **It reads `Admission`, and that is the whole of Task 2R.** An earlier version read an
 * `arrivedAt` stamp added to `Referral`, and it had NO EXIT: a referral never stops being
 * accepted, so somebody discharged weeks ago stayed on this ledger forever with their elapsed
 * time still climbing. `Admission` (`ward-admissions.ts`) is the one record of a person occupying
 * a bed and it closes — `state: "left"` and `leftAt` — which is why the referral field and its
 * `REFERRAL_ARRIVED` event were removed rather than kept alongside. One fact, one record.
 *
 * **The two numbers do not share a denominator.** `entries.length` counts people out of area;
 * `notBanded` counts admissions the fixture records no band for. Neither is a part of the other and
 * neither is a part of any whole — this returns exactly those two keys and no total, precisely so
 * that no screen can read a proportion out of it. A ratio of the two would be a figure this phase
 * has not been asked to author and that nobody has checked.
 *
 * **`notBanded` will normally be the far larger number, and that is the honest output of this
 * rule rather than a defect.** `SYNTHETIC_TRAVEL_BANDS` records only some home regions, and only
 * some sites within those, so most beds cannot be classified at all — measured against the
 * admission seed as it stood on 2026-08-29, the unclassified count outnumbered the out-of-area
 * count by roughly twelve to one. At that ratio ANY construction implying the second number is a
 * shortfall, a remainder or an incompleteness of the first would be actively misleading, which is
 * why the guard here is structural rather than advisory: this function returns two keys, no total,
 * no percentage and no denominator, and `tests/ward-travel-grouping.test.ts` asserts that key set
 * exactly. Two facts, side by side, neither one a part of the other.
 *
 * What each case does, and why:
 *
 *  - **Not holding a bed** → in neither number, whatever their band and however long they were
 *    there. SOMEBODY WHO HAS LEFT IS NOT IN A BED FAR FROM HOME. This is the first check in the
 *    loop and it is deliberately its own condition rather than folded into the arrival test: a
 *    departed admission still carries the `arrivedAt` it arrived on, so nothing else in this
 *    function would exclude it.
 *
 *    **It is an ALLOWLIST — `bedIsOccupied`, the record's own predicate — and never a
 *    `state !== "left"` denylist.** Two reasons, and the second is the one that matters. First, a
 *    waitlisted admission carrying an arrival time is incoherent data, and a denylist counts it as
 *    somebody in a bed far from home. Second, and structurally: a fifth `AdmissionState` added
 *    later falls through a denylist as OCCUPIED BY DEFAULT. This ledger is read as fact by a
 *    coordinator, so an unrecognised state must be excluded rather than counted — the failure
 *    direction has to be conservative, and only an allowlist makes it so. Reusing the record's own
 *    predicate rather than restating the states here also means a state added to
 *    `ward-admissions.ts` is classified in ONE place. `tests/ward-travel-grouping.test.ts` pins
 *    both the departure and the waitlisted-with-an-arrival case directly.
 *  - **Arrived, still here, band is a member of `OUT_OF_AREA_BANDS`** → an entry. The clock runs
 *    from `arrivedAt`, NEVER from `pulledAt`: the bed has been gone since the pull, but this
 *    ledger measures how long somebody has been AWAY FROM HOME, which starts when they get there.
 *    Reading `pulledAt` would overstate every entry by the transport delay, in the same direction
 *    every time. The pull-to-arrival gap is a real and separate figure; nothing here surfaces it.
 *  - **Arrived, still here, band not recorded** → `notBanded`, never an entry. An unknown band must
 *    never become a figure, and a count that quietly excluded what it could not classify would be
 *    quoted as complete. The gap is reported as a gap — the same rule `travelBand` itself follows
 *    in returning `undefined` rather than falling back to a band.
 *  - **Arrived, still here, band recorded and in area** → in neither number. Present and correctly
 *    classified; there is nothing to report.
 *  - **Holding a bed but not yet arrived** → in neither number, and NOT reported as missing
 *    anything. A pulled bed is one given away to somebody still on their way, so as far as this
 *    prototype knows nobody is in it yet, and saying more would invent the arrival. A non-finite
 *    `arrivedAt` is treated the same way rather than yielding a `NaN` elapsed time. (A waitlisted
 *    admission never reaches this check — it holds no bed, so the allowlist above excludes it
 *    whether or not it carries an arrival.)
 *  - **`unitId` resolves to no unit** → skipped entirely, never banded against a guessed site. It
 *    is not counted as unbanded either: nothing was looked up, so nothing failed to be found.
 *
 * Order is the order `admissions` arrived in, and there is no comparator here at all. This is a
 * ledger of people, not a queue, and nothing about it ranks, prioritises or shortlists anyone.
 *
 * `units` is a parameter rather than a call to `allUnits()` so this derivation stays pure over its
 * inputs and testable against a fixture — the same reason `referralCandidates` above takes one.
 *
 * The band is looked up through `ward-distance.ts` from the admission's own `homeRegion` and the
 * accepting unit's site, exactly as `unitTravelBand` does it for a referral. No band is stored on
 * an `Admission`, and none is stored here.
 */
export function outOfAreaLedger(
  admissions: Admission[],
  units: Unit[],
  now: Instant,
): { entries: OutOfAreaEntry[]; notBanded: number } {
  const entries: OutOfAreaEntry[] = [];
  let notBanded = 0;

  for (const admission of admissions) {
    // The exit the referral-based version did not have, and an ALLOWLIST rather than a denylist.
    // Read this file's own comment above before moving, weakening or merging this line into the
    // arrival check below.
    if (!bedIsOccupied(admission)) continue;
    const arrivedAt = admission.arrivedAt;
    if (arrivedAt === null || !Number.isFinite(arrivedAt)) continue;

    const unit = units.find((candidate) => candidate.id === admission.unitId);
    if (!unit) continue;

    // Task 17, 2026-08-30: an arrival through the emergency-department pathway records no home
    // region yet, and a distance from an unknown home is not a distance. It counts as not banded,
    // which is the same honest bucket an unknown region has always fallen into - the figure is
    // reported rather than the person being dropped from the tally.
    if (admission.homeRegion === null) {
      notBanded += 1;
      continue;
    }

    const band = travelBand(admission.homeRegion, unit.siteCode);
    if (band === undefined) {
      notBanded += 1;
      continue;
    }
    if (!OUT_OF_AREA_BANDS.includes(band)) continue;

    entries.push({ admission, unit, band, sinceArrival: minutesUntil(now, arrivedAt) });
  }

  return { entries, notBanded };
}
