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
 * `security`, `sex_mix`, `specialling`, `capacity_freshness` and `allocatable_bed` reuse
 * `eligibility()`'s logic unchanged, mapped onto the referral fields that carry the same fact
 * (`referral.sex` for `sex_mix`, `referral.secureBedNeeded` for `security`). `capacity_freshness`
 * and `allocatable_bed` read only `unit.allocatable` — the ward's own confirmed figure — and nothing
 * in this function ever reads a `BedRelease`, a release state, a band or a confidence level; that
 * is what keeps referral matching independent of the four-stage bed-release model, which no ward
 * clinician has yet validated (spec D15).
 */
export function referralEligibility(referral: Referral, unit: Unit, now: Instant): EligibilityVerdict {
  const fresh = capacityIsFresh(unit, now);
  const sameSexOccupants = unit.sexMix[referral.sex] ?? 0;
  const designationAccepts = sexDesignationAccepts(unit.sexDesignation, referral.sex);
  const securityMet = !referral.secureBedNeeded || unit.security === "Secure";
  // See the `legal_status` gate's own comment below for why this is a fixed fact about every
  // Phase 7 referral rather than a read of a field `Referral` does not have.
  const referralNeedsAuthorisedDestination = false;
  const legalStatusMet = !referralNeedsAuthorisedDestination || unit.authorised;

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
      // A referral (Task 1's `Referral`) carries no legal-status fact — the front door precedes
      // any legal determination (spec D14), so a referral never yet needs an authorised
      // destination. This is a fixed fact about a REFERRAL, never a read of a field that does
      // not exist. Requiring `unit.authorised` unconditionally here would be the same shape of
      // mistake as `bed.sexDesignation === referral.sex`: a plausible-looking "legal status must
      // match" rule that actually narrows which beds a referral may reach for a reason that has
      // nothing to do with the referral itself. An authorised unit is still, correctly,
      // involuntary-capable and accepts this referral too (D3 rule 2) — it is a capability, not
      // a value to equality-match.
      gate: "legal_status",
      pass: legalStatusMet,
      detail: unit.authorised
        ? `${unit.name} is authorised under the Mental Health Act`
        : `${unit.name} is not authorised under the Mental Health Act; no authorised destination is required yet`,
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
      gate: "forensic",
      pass: !unit.forensic,
      detail: unit.forensic
        ? `${unit.name} is a forensic bed and is never offered to a Phase 7 referral`
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
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || unit.allocatable.value > 1,
      detail:
        sameSexOccupants > 0
          ? `${sameSexOccupants} ${referral.sex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed",
    },
    {
      // A referral carries no specialling-need fact — unlike `Movement.specialling`, Task 1
      // fixed the referral's permitted-field list at three facts about the person and none of
      // them expresses this. The honest reading of "no fact means no requirement" is the same
      // one `legal_status` above uses: this gate always takes the "no specialling required"
      // branch for a referral. If a future referral field ever carries this need, only this
      // gate changes.
      gate: "specialling",
      pass: true,
      detail: "No specialling required",
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
