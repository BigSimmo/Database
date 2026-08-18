import type { Instant } from "@/components/ward-management/ward-clock";
import type { LegalStatus, Movement, Unit } from "@/components/ward-management/ward-model";

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
      detail: `${unit.cohort} unit for a ${movement.cohort.toLowerCase()} movement`,
    },
    {
      gate: "security",
      pass: movement.security === "Open" || unit.security === "Secure",
      detail: `${unit.security} ward for a ${movement.security.toLowerCase()} requirement`,
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
      detail: movement.specialling ? `${unit.speciallingCapacity} specialling slots available` : "No specialling required",
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
