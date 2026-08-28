import type { Instant } from "@/components/ward-management/ward-clock";
import type {
  LegalStatus,
  Movement,
  Referral,
  Sex,
  SexDesignation,
  Unit,
} from "@/components/ward-management/ward-model";

export type GateResult = { gate: string; pass: boolean; detail: string };
export type EligibilityVerdict = { eligible: boolean; gates: GateResult[] };

/**
 * Every status other than Voluntary carries a detention authority, so the receiving unit must
 * be authorised. This governs the DESTINATION only — detaining a referred patient in an
 * unauthorised emergency department is lawful and is the normal state while they wait.
 */
export function requiresAuthorisedDestination(status: LegalStatus | undefined) {
  return status !== "Voluntary";
}

function capacityIsFresh(unit: Unit, now: Instant) {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

/** "a unit" vs "an older adult unit" — the only two cohort/security values start with a
 * vowel or a consonant, so this is a plain vowel check rather than a lookup table. */
function article(word: string) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

export function eligibility(movement: Movement, unit: Unit, now: Instant): EligibilityVerdict {
  const authorisationNeeded = requiresAuthorisedDestination(movement.legalStatus);
  const declined = movement.declines.some((decline) => decline.unitId === unit.id);
  const fresh = capacityIsFresh(unit, now);
  const sameSexOccupants = unit.sexMix[movement.sex] ?? 0;

  const gates: GateResult[] = [
    {
      gate: "authorisation",
      pass: !authorisationNeeded || unit.authorised,
      detail: authorisationNeeded
        ? unit.authorised
          ? "Authorised to receive an involuntary admission"
          : `${unit.name} is not authorised under the Mental Health Act`
        : "Voluntary admission needs no authorisation",
    },
    {
      gate: "cohort",
      pass: unit.cohort === movement.cohort,
      detail:
        unit.cohort === movement.cohort
          ? `${unit.cohort} unit matches ${article(movement.cohort)} ${movement.cohort.toLowerCase()} movement`
          : `${unit.cohort} unit does not match ${article(movement.cohort)} ${movement.cohort.toLowerCase()} movement`,
    },
    {
      gate: "security",
      pass: movement.security === "Open" || unit.security === "Secure",
      detail:
        movement.security === "Open" || unit.security === "Secure"
          ? `${unit.security} ward meets ${article(movement.security)} ${movement.security.toLowerCase()} requirement`
          : `${unit.security} ward does not meet ${article(movement.security)} ${movement.security.toLowerCase()} requirement`,
    },
    {
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || unit.allocatable.value > 1,
      detail:
        sameSexOccupants > 0
          ? `${sameSexOccupants} ${movement.sex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed",
    },
    {
      gate: "specialling",
      pass: !movement.specialling || unit.speciallingCapacity > 0,
      detail: movement.specialling
        ? `${unit.speciallingCapacity} specialling slots available`
        : "No specialling required",
    },
    {
      gate: "prior_decline",
      pass: !declined,
      detail: declined ? "Already declined this movement" : "No prior decline",
    },
    {
      gate: "capacity_freshness",
      pass: fresh,
      detail: fresh
        ? `Confirmed ${now - unit.allocatable.confirmedAt} min ago`
        : `Last confirmed ${now - unit.allocatable.confirmedAt} min ago — stale`,
    },
    {
      gate: "allocatable_bed",
      pass: unit.allocatable.value > 0,
      detail: `${unit.allocatable.value} allocatable`,
    },
  ];

  return { eligible: gates.every((gate) => gate.pass), gates };
}

/**
 * Whether `designation` may hold a person of `sex` — a CONSTRAINT on the bed, never an equality
 * check against the referral's sex (see `SexDesignation`'s own doc comment on `ward-model.ts`).
 * `"Undesignated"` — the seeded majority — accepts either sex; `"Female only"`/`"Male only"`
 * narrow acceptance to the one sex they name. Isolated as its own function (rather than inlined
 * into the gate below) so the accepts-shape is visible on its own, independent of the gate's
 * pass/detail plumbing.
 */
function sexDesignationAccepts(designation: SexDesignation, sex: Sex): boolean {
  if (designation === "Undesignated") return true;
  return designation === "Female only" ? sex === "Female" : sex === "Male";
}

/**
 * Phase 7 (spec "The front door", D9): the referral-side counterpart of `eligibility()`, for a
 * `Referral` (Task 1, `ward-model.ts`) rather than a `Movement`. Returns the exact same
 * `EligibilityVerdict`/`GateResult[]` shape, so the "why not here?" artefact — every unit, and
 * for each gate a human-readable reason — comes out for free rather than being built twice.
 *
 * Every gate below is an ACCEPTS-rule — "does this bed accept this referral" — never "does this
 * bed's value equal the referral's". `age` happens to be a plain equality and is still written
 * in the same accepts-shape as the other three, so a future change (an adult unit that will also
 * take a 17-year-old) lands in one place rather than needing a special case.
 *
 * `security`, `sex_mix` and `specialling` reuse `eligibility()`'s logic unchanged, mapped onto the
 * referral fields that carry the same fact (`referral.sex` for `sex_mix`, `referral.secureBedNeeded`
 * for `security`). `capacity_freshness` also reuses `eligibility()`'s logic unchanged. `allocatable_bed`
 * DIFFERS from `eligibility()`'s gate of the same name: it gates on `availableNow` —
 * `Math.min(unit.allocatable.value, unit.empty.value)` — never `unit.allocatable.value` alone,
 * because the two are only documented to agree "in practice" and are not enforced to (see
 * `availableNow`'s own comment below). `capacity_freshness` and `allocatable_bed` still read only
 * `unit.allocatable` and `unit.empty` — the ward's own confirmed figures — and nothing in this
 * function ever reads a `BedRelease`, a release state, a band or a confidence level; that is what
 * keeps referral matching independent of the bed-release model, which no ward clinician
 * has yet validated (spec D15).
 */
export function referralEligibility(referral: Referral, unit: Unit, now: Instant): EligibilityVerdict {
  const fresh = capacityIsFresh(unit, now);
  const sameSexOccupants = unit.sexMix[referral.sex] ?? 0;
  const designationAccepts = sexDesignationAccepts(unit.sexDesignation, referral.sex);
  const securityMet = !referral.secureBedNeeded || unit.security === "Secure";
  // See the `legal_status` gate's own comment below for why this is an accepts-rule, never an
  // equality: a referral that does not need an involuntary bed is accepted by ANY bed, including
  // an authorised one — `unit.authorised` is a capability a bed has, not a value to match against.
  const legalStatusMet = !referral.involuntaryBedNeeded || unit.authorised;
  // Spec D15 / plan Global Constraints: the bed the coordinator can actually place someone in
  // right now is `availableNow`, never `unit.allocatable.value` alone. The two are documented to
  // agree "in practice" on `Unit.allocatable`, but that is not enforced — `CONFIRM_CAPACITY` can
  // raise `allocatable.value` back above `empty.value` after arrivals have already consumed the
  // physically empty beds, and `PATIENT_ARRIVED` decrements `empty.value` while leaving
  // `allocatable.value` untouched. Computed inline from the unit's own two figures — never via
  // `capacityBreakdown` (`ward-bed-availability.ts`), which takes `BedRelease[]` and would couple
  // referral matching to the bed-release model no ward clinician has validated (see
  // this function's own doc comment above and the D15 contract test in
  // `ward-referral-matching.test.ts`).
  const availableNow = Math.min(unit.allocatable.value, unit.empty.value);

  const gates: GateResult[] = [
    {
      gate: "age",
      pass: unit.cohort === referral.ageBand,
      detail:
        unit.cohort === referral.ageBand
          ? `${unit.cohort} unit matches ${article(referral.ageBand)} ${referral.ageBand.toLowerCase()} referral`
          : `${unit.cohort} unit does not match ${article(referral.ageBand)} ${referral.ageBand.toLowerCase()} referral`,
    },
    {
      // D3 rule 2 / D5's fourth field: a referral that does NOT need an involuntary bed is
      // accepted by ANY bed; a referral that DOES need one is accepted only by a bed that can
      // hold someone involuntarily (`unit.authorised`). Written as an accepts-rule, never an
      // equality, for the same reason as `sex_designation` below — `unit.authorised ===
      // referral.involuntaryBedNeeded` would refuse an involuntary-bed referral from an
      // authorised unit whenever the referral itself happened not to need one, which is backwards:
      // an authorised unit's extra capability never disqualifies it. The detail describes the bed
      // or the requirement, never the person: it is not a legal determination about who was
      // referred, only whether this bed can hold someone involuntarily if the request calls for it.
      gate: "legal_status",
      pass: legalStatusMet,
      detail: referral.involuntaryBedNeeded
        ? legalStatusMet
          ? `${unit.name} is authorised under the Mental Health Act`
          : `${unit.name} is not authorised under the Mental Health Act`
        : "No authorised destination required",
    },
    {
      gate: "sex_designation",
      pass: designationAccepts,
      detail: designationAccepts
        ? unit.sexDesignation === "Undesignated"
          ? `${unit.name} is undesignated and accepts either sex`
          : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and accepts this referral's sex`
        : `${unit.name} is ${unit.sexDesignation.toLowerCase()} and does not accept this referral's sex`,
    },
    {
      // D7: a forensic bed is described so the board can be honest about the network, and is
      // never offered — the gate fails for every referral, unconditionally, with a detail that
      // says so plainly rather than implying the person was assessed and found unsuitable.
      //
      // Task 8 finding C: this detail used to end "…is never offered through Phase 7 front-door
      // matching". "Phase 7" and "front-door matching" are this project's own build vocabulary
      // and mean nothing to a ward coordinator, who is the one reading it. A gate detail may say
      // only what is true of the BED, in words the reader already has.
      //
      // "as a destination", not "for a referral": this file's own `legal_status` gate already
      // uses "destination" for a bed being placed into, and the word "referral" here would put
      // the sentence's object back on the request — which the guard in
      // `tests/ward-referral-matching.test.ts` ("the forensic gate's detail names the bed and
      // never judges the person") refuses, correctly. That guard was left exactly as it was.
      gate: "forensic",
      pass: !unit.forensic,
      detail: unit.forensic
        ? `${unit.name} is a forensic bed and is never offered as a destination`
        : `${unit.name} is not a forensic bed`,
    },
    {
      gate: "security",
      pass: securityMet,
      detail: referral.secureBedNeeded
        ? securityMet
          ? `${unit.name} is a secure ward`
          : `${unit.name} is not a secure ward`
        : "No secure ward required",
    },
    {
      // `availableNow`, not `unit.allocatable.value` alone — the same C2 correction fix round B
      // made to `allocatable_bed`, applied here where it was left behind (fix round C, F3 /
      // review finding I4). This gate's own detail already SAYS "needs more than one free bed",
      // and a free bed is `availableNow`: a ward that confirmed 3 allocatable beds and then took
      // two arrivals has `allocatable: 3, empty: 1`, so reading `allocatable` alone passed this
      // gate on a ward with exactly one free bed — placing a lone woman on a ward with no other
      // free bed, the precise outcome this gate exists to prevent, while the capacity board read
      // `availableNow` and correctly said 1. No new rule: this makes the code do what its own
      // user-visible sentence already promised.
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || availableNow > 1,
      detail:
        sameSexOccupants > 0
          ? `${sameSexOccupants} ${referral.sex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed",
    },
    {
      // A referral carries no specialling-need fact — unlike `Movement.specialling`, Task 1
      // fixed the referral's permitted-field list at three facts about the person and none of
      // them expresses this. Kept as its own gate (rather than dropped) so a coordinator reading
      // every gate on the referral's match view learns what the system does and does not know
      // about a referral, the same reason every gate is listed rather than only the failing ones.
      // The detail must describe the RECORD, never assert a fact about the person: "No
      // specialling required" would tell a coordinator something was checked and found absent,
      // when nothing was checked — nobody entered this fact and the record does not hold it. If a
      // future referral field ever carries this need, only this gate changes.
      gate: "specialling",
      pass: true,
      detail: "Specialling need is not recorded on a referral",
    },
    {
      gate: "capacity_freshness",
      pass: fresh,
      detail: fresh
        ? `Confirmed ${now - unit.allocatable.confirmedAt} min ago`
        : `Last confirmed ${now - unit.allocatable.confirmedAt} min ago — stale`,
    },
    {
      // `availableNow`, not `unit.allocatable.value` alone — see the comment on `availableNow`'s
      // declaration above. The detail names both source figures so a coordinator (or a future
      // reader of this code) can see why they can diverge, without reading anything but the
      // unit's own two confirmed numbers.
      gate: "allocatable_bed",
      pass: availableNow > 0,
      detail: `${availableNow} available now (${unit.allocatable.value} allocatable, ${unit.empty.value} empty)`,
    },
  ];

  return { eligible: gates.every((gate) => gate.pass), gates };
}

/**
 * A binary, non-ordinal description of a verdict: eligible, or the specific gate that failed.
 * Eligibility gates are not commensurable (failing `authorisation` is a legal hard stop;
 * failing `capacity_freshness` is a staleness warning), so this deliberately never collapses
 * them into a "N of M passed" fraction — that shape reads as a score, and higher/lower
 * comparisons across two verdicts are not meaningful.
 *
 * Fix round C (F1, review finding C1): this lives HERE rather than in `ward-derivations.ts`,
 * where it was originally written, and `ward-derivations.ts` re-exports it so its six existing
 * call sites are untouched. It depends on nothing but `EligibilityVerdict`, which is declared in
 * this file. `ward-referrals.ts` reads it from here, and that is the whole point: taking it from
 * `ward-derivations.ts` instead pulled `ward-flow-reducer.ts`, `ward-flow-events.ts` and
 * `ward-movements.ts` into referral matching's transitive module graph, and all three name the
 * bed-release model at the top of the file — which turned the D15 contract test in
 * `tests/ward-referral-matching.test.ts` red (5 files and 0 offenders became 17 files and 4).
 * D15 is deliberately structural: no code path reachable from matching may read that model AT
 * ALL, not even one that happens to agree with `unit.allocatable` today.
 *
 * The prose above deliberately does not spell the release model's type name, and deliberately
 * does not put the word "import" beside it. That contract test splits a file on a crude
 * `/import\s+[\s\S]*?;/` before checking, so an explanatory comment CAN produce a false
 * positive — this one did, on its first draft. The guard is not the thing to relax.
 */
export function candidateReason(verdict: EligibilityVerdict) {
  if (verdict.eligible) return "Eligible now";
  const failed = verdict.gates.find((gate) => !gate.pass);
  return failed ? failed.detail : "Not eligible";
}
