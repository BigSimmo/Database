import { admissionsForUnit, stayBand, type Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * Ward-level flow statistics — six figures about the WARD or the SYSTEM, never about a person.
 *
 * Every function here is pure: it takes an `Admission[]` and a `now` and returns numbers. No
 * React, no state, no I/O, and — the discipline this whole file exists to hold — no judgement.
 * None of the six figures below is a target, a threshold, or a ranking of one ward against
 * another. A ward reads its own numbers here; nothing here says whether they are good.
 *
 * **`null` means "nothing to average", and it must never be reported as `0`.** A ward with no
 * discharges has no average length of stay — it does not have an average of zero days. The two
 * claims are different, and this module is where they have already been confused once before (see
 * this file's own tests). Every averaging figure below is `number | null` for exactly this
 * reason; the count-based figures (`readyToLeaveCannot`, `longStays`, `dischargeDateOutcomes`) are
 * genuine counts, so `0` is a true and correct answer for them when there is no data.
 */

/**
 * How often a ward's own `expectedDischargeAt` plan was actually met, once someone left.
 *
 *   - `met` / `missed` are only known for an admission that has BOTH an expected date AND has
 *     actually left (`leftAt` set) — an admission still in the bed has no outcome yet, so it
 *     contributes to neither. Counting a still-occupied admission as "met" because its date
 *     has not yet passed would be optimistic rather than true; counting it as "missed" would be
 *     equally false in the other direction. It is simply not yet decided.
 *   - `moved` is a DIFFERENT question — how many admissions have had their plan revised at all
 *     (`dischargeDateMoves > 0`) — and is independent of whether the outcome is known yet. An
 *     admission still in the bed can already have a moved date; an admission that left on its
 *     very first expected date never moved at all. `met`/`missed`/`moved` are therefore NOT a
 *     three-way partition of the same population and must never be summed to "consideredCount".
 *   - `consideredCount` is `met + missed` — the admissions this figure has actually judged, kept
 *     separate so a caller can tell "no discharge dates were met" apart from "no discharge dates
 *     have resolved yet" (both would otherwise print `met: 0`).
 */
export type DischargeDateOutcomes = {
  met: number;
  missed: number;
  moved: number;
  consideredCount: number;
};

export type WardStatistics = {
  unitId: string;
  /** `arrivedAt` -> `leftAt` (or `now`, for someone still in the bed), averaged in whole days. */
  averageLengthOfStayDays: number | null;
  /**
   * `pulledAt` -> `arrivedAt`, averaged in minutes — the transport delay, measured. A number
   * nobody currently has: the bed is already gone at the pull, so this is time nobody occupies
   * anything, spent between two clocks the admission record keeps separately on purpose.
   */
  averageEmptyBedMinutes: number | null;
  dischargeDateOutcomes: DischargeDateOutcomes;
  /**
   * ALWAYS `null`. `Admission` records `pulledAt`, `arrivedAt`, `expectedDischargeAt`,
   * `dischargeDateSetAt` and `leftAt` — no instant marks the moment an admission entered
   * `"waitlisted"`. The equivalent figure already built elsewhere in this codebase
   * (`referralWaitLabel` in `ward-referrals.ts`) is measured from `Referral.raisedAt`, a field
   * this module has no access to: `wardStatistics` takes `Admission[]` only, by design. Rather
   * than fabricate a waitlist-start instant that does not exist on the record, this figure is
   * left honestly absent. See this module's test file for the full note, and the Task 7 report
   * for the flag: closing this gap needs either a new `Admission` field or a different input to
   * this function, and either is a product decision, not an implementation one.
   */
  averageWaitlistWaitMinutes: number | null;
  /** Admissions currently on the ward (not yet left) that carry a `blockReason`. Never subtracted
   *  from any other figure — a blocked admission still counts everywhere else it belongs. */
  readyToLeaveCannot: number;
  /** Admissions currently on the ward whose `stayBand` (from `ward-admissions.ts`, never
   *  re-implemented here) is `"over-3-months"`. */
  longStays: number;
};

/** `null` when there is nothing to average — never `0`. See this module's doc comment. */
function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

/**
 * Minutes from `arrivedAt` to the end of this admission's stay — `leftAt` if they have gone,
 * `now` if they are still in the bed. `null` when there is no stay to measure (not yet arrived)
 * or the relevant instants are not finite, following the same conservative-degradation discipline
 * `daysInBed` (`ward-admissions.ts`) already holds: no answer, never a substituted fallback.
 *
 * Reading `now` for a DEPARTED admission, or `leftAt`/nothing for a CURRENT one, is the exact
 * swap this function exists to prevent — see `daysInBed`'s own doc comment for why it looks
 * entirely reasonable in review and is wrong in the same direction every time.
 */
function lengthOfStayMinutes(admission: Admission, now: Instant): number | null {
  const arrivedAt = admission.arrivedAt;
  if (arrivedAt === null || !Number.isFinite(arrivedAt) || !Number.isFinite(now)) return null;
  const leftAt = admission.leftAt;
  const endedAt = leftAt !== null && Number.isFinite(leftAt) ? leftAt : now;
  return Math.max(0, endedAt - arrivedAt);
}

/**
 * Minutes from `pulledAt` to `arrivedAt` — and ONLY those two clocks. `null` when either instant
 * is missing or non-finite: a bed that has been pulled but not yet arrived has an empty-bed time
 * that is still running, not yet a measured fact, so it contributes nothing rather than a
 * guessed number.
 *
 * **Never `pulledAt` -> `now`.** That would keep growing after the person already arrived,
 * silently overstating the ward's transport-delay figure by however long ago they got there.
 * **Never `arrivedAt` -> `leftAt`** either — that is length of stay, a different question this
 * module answers separately.
 */
function emptyBedMinutes(admission: Admission): number | null {
  const { pulledAt, arrivedAt } = admission;
  if (pulledAt === null || arrivedAt === null || !Number.isFinite(pulledAt) || !Number.isFinite(arrivedAt)) {
    return null;
  }
  return Math.max(0, arrivedAt - pulledAt);
}

/**
 * The six ward-level flow figures for one unit, derived entirely from `admissions`.
 *
 * `longStays` and `readyToLeaveCannot` are scoped to admissions still ON the ward
 * (`admissionsForUnit` — everything except `"left"`), never to the full history. Both reasons are
 * about a DEPARTED admission specifically, not a general "recent data only" preference:
 *   - `blockReason` describes what is currently holding a bed up. Someone who has already left is
 *     no longer being held from leaving, whatever the record still says.
 *   - `stayBand` (reused from `ward-admissions.ts`, never re-banded here) measures from
 *     `arrivedAt` to the `now` it is given — it has no way to know an admission has since ended,
 *     so applying it to a departed admission would keep their stay "growing" after they left.
 *
 * `averageLengthOfStayDays`, `averageEmptyBedMinutes` and `dischargeDateOutcomes` are, by
 * contrast, computed over EVERY admission for this unit including departed ones — a completed
 * stay or a completed empty-bed gap is a historical fact regardless of what state the admission
 * is in now, and excluding departed admissions from those three would silently shrink the ward's
 * own history every time somebody left.
 */
export function wardStatistics(unitId: string, admissions: Admission[], now: Instant): WardStatistics {
  const forThisUnit = admissions.filter((admission) => admission.unitId === unitId);

  const stayMinutes = forThisUnit
    .map((admission) => lengthOfStayMinutes(admission, now))
    .filter((value): value is number => value !== null);
  const averageStayMinutes = average(stayMinutes);
  const averageLengthOfStayDays = averageStayMinutes === null ? null : averageStayMinutes / MINUTES_PER_DAY;

  const emptyMinutes = forThisUnit
    .map((admission) => emptyBedMinutes(admission))
    .filter((value): value is number => value !== null);
  const averageEmptyBedMinutes = average(emptyMinutes);

  let met = 0;
  let missed = 0;
  let moved = 0;
  for (const admission of forThisUnit) {
    const expectedDischargeAt = admission.expectedDischargeAt;
    const hasExpectedDate = expectedDischargeAt !== null && Number.isFinite(expectedDischargeAt);

    if (admission.dischargeDateMoves > 0) moved += 1;

    if (!hasExpectedDate) continue;
    const leftAt = admission.leftAt;
    if (leftAt === null || !Number.isFinite(leftAt)) continue; // no outcome yet — not met, not missed

    if (leftAt <= expectedDischargeAt) met += 1;
    else missed += 1;
  }

  const liveAdmissions = admissionsForUnit(admissions, unitId);
  const readyToLeaveCannot = liveAdmissions.filter((admission) => admission.blockReason !== null).length;
  const longStays = liveAdmissions.filter((admission) => stayBand(admission, now)?.id === "over-3-months").length;

  return {
    unitId,
    averageLengthOfStayDays,
    averageEmptyBedMinutes,
    dischargeDateOutcomes: { met, missed, moved, consideredCount: met + missed },
    averageWaitlistWaitMinutes: null,
    readyToLeaveCannot,
    longStays,
  };
}

/**
 * `wardStatistics` for every unit given, paired with the unit itself, in the SAME order `units`
 * arrives in — never re-sorted or filtered. Mirrors `referralCandidates` (`ward-referrals.ts`)'s
 * own discipline on this: a caller controls unit order (typically `allUnits()` from
 * `ward-sites.ts`), and re-ordering here would read as a ranking this module explicitly refuses
 * to make.
 */
export function allWardStatistics(
  units: Unit[],
  admissions: Admission[],
  now: Instant,
): { unit: Unit; statistics: WardStatistics }[] {
  return units.map((unit) => ({ unit, statistics: wardStatistics(unit.id, admissions, now) }));
}
