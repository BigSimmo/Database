import type { Instant } from "@/components/ward-management/ward-clock";
import { referralEligibility, type EligibilityVerdict } from "@/components/ward-management/ward-eligibility";
import type { Referral, Unit } from "@/components/ward-management/ward-model";

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
export function referralCandidates(
  referral: Referral,
  units: Unit[],
  now: Instant,
): { unit: Unit; verdict: EligibilityVerdict }[] {
  return units.map((unit) => ({ unit, verdict: referralEligibility(referral, unit, now) }));
}
