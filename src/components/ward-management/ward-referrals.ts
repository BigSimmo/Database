import { formatElapsed, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import {
  candidateReason,
  referralEligibility,
  type EligibilityVerdict,
} from "@/components/ward-management/ward-eligibility";
import type { Referral, ReferralDeclineReason, Unit } from "@/components/ward-management/ward-model";

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
    .filter((referral) => referral.state === "queued")
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
    .filter((referral) => referral.state !== "queued")
    .sort((a, b) => (b.decidedAt ?? -Infinity) - (a.decidedAt ?? -Infinity));
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
