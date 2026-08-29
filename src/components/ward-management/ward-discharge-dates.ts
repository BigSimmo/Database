import {
  LEAVING_DESTINATIONS,
  bedIsOccupied,
  type Admission,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";

/**
 * Task 4 (Ward Board plan): the ward sets ONE expected discharge date per occupancy
 * (`Admission.expectedDischargeAt`), and this module is where everything forward-looking gets
 * derived from it. Pure functions only — no React, no state, no I/O — and no bed arithmetic of
 * its own: `derivedBedReleases` produces the `BedRelease[]` view that `capacityBreakdown`
 * (`ward-bed-availability.ts`) already knows how to bucket into today/beyond-today and
 * predicted/confirmed/blocked. Re-deriving any of THAT here would be exactly the drift this
 * module exists to prevent — if a count needs computing, `capacityBreakdown` is where it belongs.
 *
 * **A `"confirmed"` release comes from `Admission.dischargeConfirmedAt` and from NOTHING ELSE
 * (owner ruling, 2026-08-29).** A discharge date is a PLAN; confirming it is a DECISION. The first
 * implementation of this module could reach only `"predicted"`, because `Admission` recorded no
 * decision at all, and it declined to invent a proxy for one — "the date has arrived", "the date
 * has been set a while", "the date has never moved". That refusal was right: each of those renders
 * a ward decision that nobody made, on a screen a coordinator reads as fact, which is the same
 * class of fabricated claim as an invented statutory figure. `dischargeConfirmedAt` is the fix, and
 * it is the ONLY route to `"confirmed"` here. A date window or a move count must never become one
 * again, however reasonable it looks in review.
 *
 * A confirmed release still needs a real `expectedAt`, so an admission confirmed with no
 * `expectedDischargeAt` yields NO release rather than a release at a fabricated instant — rule 3
 * below applies to a decided discharge exactly as it applies to a planned one.
 *
 * **`waitingOn` is BLANK on every derived release (owner ruling, 2026-08-29), and blank is a
 * different fact from `"Nothing outstanding"`.** Silence means NOBODY HAS LOOKED at what is
 * holding this discharge up. `"Nothing outstanding"` means a ward looked and found nothing in the
 * way. `Admission` has no field naming an obstacle and no field recording that anybody examined
 * one, so silence is the only fact this module has — and it must say so by leaving `waitingOn`
 * null. The previous implementation defaulted every derived prediction to `"Nothing outstanding"`,
 * which collapsed those two facts into the optimistic one and put it on the board for every
 * discharge nobody had examined.
 *
 * That was a defect in the DEFAULT, never in the value. `"Nothing outstanding"` stays in
 * `BED_RELEASE_WAITING_ON` verbatim: a ward that has actually checked still needs to be able to
 * say so, and `tests/ward-discharge-dates.test.ts` pins its membership so a tidy-up cannot remove
 * it on the grounds that nothing sets it any more.
 */

/** A role is required wherever `BedRelease` requires one (`confirmedBy`, `blockedBy`) but the
 *  `Admission` records none — never a personal name, and never a guess at which real role acted.
 *  A STATED absence, which is the right shape here precisely because the field cannot be left
 *  blank: where a field CAN be blank, blank is the honest answer (see `waitingOn` above). */
const ROLE_NOT_RECORDED = "Not recorded";

const STATEWIDE_RELEASE_BY_DESTINATION: ReadonlyMap<LeavingDestination, boolean> = new Map(
  LEAVING_DESTINATIONS.map((destination) => [destination.id, destination.countsAsStatewideRelease]),
);

/**
 * One admission's forward-looking release — `"confirmed"` when the ward has decided it is
 * happening, `"predicted"` when it has only planned a date — or `null` when there is nothing to
 * derive.
 *
 * **Rule 3 lives here, and it is absolute: no `expectedDischargeAt` (or a non-finite one) means NO
 * release, never a release at `now` and never a release at a fallback instant.** An absent date
 * must never read as "not yet due" — the same discipline `isPastExpectedDischarge` holds a few
 * files away. A plausible-looking mistake this guards against: defaulting the missing date to
 * `now` "so the board has something to show" would make every undated admission look like it is
 * discharging THIS INSTANT, which is the opposite of what an absent plan means.
 *
 * Only a bed genuinely occupied (`bedIsOccupied`) can have a future release derived — a
 * waitlisted admission holds no bed yet, so a date recorded on one (incoherent input) still
 * yields no release rather than claiming a bed release nobody can point to.
 *
 * **The stage is read from `dischargeConfirmedAt` alone.** Set means the ward decided;
 * unset means it only planned. Nothing else on the record — not how close the date is, not how
 * many times it moved, not how long ago it was set — may ever be consulted to promote a release
 * to `"confirmed"`; see the module doc comment for why each of those looks reasonable and is a
 * fabricated decision. A blocker does NOT change the stage either: a blocked confirmed discharge
 * is still confirmed, and blocked is counted alongside it as a cross-cut (`blockedReleaseCount`).
 */
function deriveForwardRelease(admission: Admission): BedRelease | null {
  if (!bedIsOccupied(admission)) return null;
  const expectedAt = admission.expectedDischargeAt;
  if (expectedAt === null || !Number.isFinite(expectedAt)) return null;

  const blocker = admission.blockReason;
  // A non-finite confirmation instant is exactly as absent as a null one: broken data is never a
  // decision, so it degrades to `"predicted"` rather than claiming a confirmation at `NaN`.
  const decidedAt =
    admission.dischargeConfirmedAt !== null && Number.isFinite(admission.dischargeConfirmedAt)
      ? admission.dischargeConfirmedAt
      : null;
  return {
    id: `derived-${decidedAt !== null ? "confirmed" : "predicted"}-${admission.id}`,
    unitId: admission.unitId,
    state: decidedAt !== null ? "confirmed" : "predicted",
    expectedAt,
    // BLANK, never `"Nothing outstanding"` — nobody has looked, and saying nothing is outstanding
    // would be a ward's finding rather than this module's silence. See the module doc comment.
    waitingOn: null,
    blocker,
    // Moves WITH the blocker in both directions — see `ward-bed-availability-model.test.ts`'s
    // own invariant for `blockedBy`/`blocker`: never one without the other.
    blockedBy: blocker === null ? null : (admission.dischargeDateSetBy ?? ROLE_NOT_RECORDED),
    // Neither fact exists on `Admission`; never invented (see `BED_PREPARATION_NOTES`'s own rule
    // that a preparation note is never guessed).
    preparing: false,
    preparationNote: null,
    // The decision's own provenance where there was a decision, the date-setting's otherwise:
    // `BedRelease.confirmedAt`/`confirmedBy` record who last reported this release's stage, and
    // for a confirmed release that is the ward that confirmed it, not the one that set the date.
    confirmedAt: decidedAt !== null ? decidedAt : (admission.dischargeDateSetAt ?? expectedAt),
    confirmedBy:
      decidedAt !== null
        ? (admission.dischargeConfirmedBy ?? ROLE_NOT_RECORDED)
        : (admission.dischargeDateSetBy ?? ROLE_NOT_RECORDED),
  };
}

/**
 * One admission's actual departure, restated as a `"released"` `BedRelease`, or `null` when
 * there is nothing to restate.
 *
 * Requires BOTH `leftAt` and `leavingDestination` — an admission whose `state` is `"left"` but is
 * missing either is incoherent data, and the conservative answer is silence, never a guessed
 * destination or a guessed instant.
 *
 * **Gated on `leftAt <= now`, never on a bare `state === "left"` check.** `now` is supplied by the
 * caller precisely so a screenshot or a test stays deterministic (`ward-clock.ts`'s own rule); a
 * departure timestamped after the caller's `now` is a future fact this module must not claim
 * early, mirroring `isPastExpectedDischarge`'s refusal to call an absent or malformed instant
 * "due". A non-finite `now` degrades the same way: no claim, rather than a bare `NaN > x`
 * comparison silently evaluating to `false` and letting every departure through unchecked.
 */
function deriveReleasedRelease(admission: Admission, now: Instant): BedRelease | null {
  const { leftAt, leavingDestination } = admission;
  if (leftAt === null || leavingDestination === null) return null;
  if (!Number.isFinite(leftAt) || !Number.isFinite(now) || leftAt > now) return null;

  return {
    id: `derived-released-${admission.id}`,
    unitId: admission.unitId,
    state: "released",
    // The original plan when there was one, otherwise the departure instant itself — an
    // unplanned departure (e.g. "left against advice") still needs a real, non-fabricated instant
    // here, and the moment it actually happened is the only one on record.
    expectedAt: admission.expectedDischargeAt ?? leftAt,
    // Always null on a released release — see `BedRelease.waitingOn`'s own doc comment: nothing
    // is being waited on once the bed is already free.
    waitingOn: null,
    // Always null on a released release — see `BedRelease.blocker`'s own doc comment: nothing is
    // still holding up a bed that is already free, whatever `admission.blockReason` last said.
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: leftAt,
    confirmedBy: admission.dischargeDateSetBy ?? ROLE_NOT_RECORDED,
  };
}

/**
 * Every `BedRelease` this module can honestly derive from a list of admissions: one forward entry
 * per occupied bed carrying a real expected discharge date — `"confirmed"` when the ward has
 * confirmed the discharge (`Admission.dischargeConfirmedAt`) and `"predicted"` when it has not —
 * and one `"released"` entry per admission that has actually left as of `now`.
 *
 * This is the whole surface other code should read for a derived view. `capacityBreakdown`
 * (`ward-bed-availability.ts`) is the existing consumer that turns this list into today/
 * beyond-today and predicted/confirmed/blocked counts; nothing here repeats that arithmetic.
 */
export function derivedBedReleases(admissions: Admission[], now: Instant): BedRelease[] {
  const releases: BedRelease[] = [];
  for (const admission of admissions) {
    const forward = deriveForwardRelease(admission);
    if (forward !== null) {
      releases.push(forward);
      continue;
    }
    const released = deriveReleasedRelease(admission, now);
    if (released !== null) releases.push(released);
  }
  return releases;
}

/**
 * How many admissions have actually left, as of `now`, by a destination that gives the STATE a
 * bed back (`LEAVING_DESTINATIONS`'s own `countsAsStatewideRelease`).
 *
 * **The one `false` destination — `"transferred-to-another-psychiatric-ward"` — is excluded here
 * on purpose, and only here.** It still produces a `"released"` `BedRelease` from
 * `derivedBedReleases` (the SENDING unit's own bed genuinely comes free, and that release must
 * still show up on that unit's board), but it must never inflate the network-wide total: the
 * person still occupies a psychiatric bed, the state gained nothing. Counting it here would let
 * the board report beds coming free that were never free to the network, compounding on every
 * inter-ward transfer.
 *
 * Computed directly from `admissions`, not by inspecting `derivedBedReleases`'s output — a
 * `BedRelease` deliberately carries nothing about where a departing patient went
 * (`BedRelease`'s own field-set doc comment), so the statewide/local distinction can only be
 * read off the `Admission` that produced it.
 */
export function statewideReleaseCount(admissions: Admission[], now: Instant): number {
  let count = 0;
  for (const admission of admissions) {
    if (admission.state !== "left") continue;
    const { leftAt, leavingDestination } = admission;
    if (leftAt === null || leavingDestination === null) continue;
    if (!Number.isFinite(leftAt) || !Number.isFinite(now) || leftAt > now) continue;
    if (STATEWIDE_RELEASE_BY_DESTINATION.get(leavingDestination) === true) count += 1;
  }
  return count;
}

/**
 * How many of the derived releases carry the blocked flag — a CROSS-CUT over
 * `derivedBedReleases`'s output, never a bucket subtracted from a state count. See
 * `CapacityBreakdown.blockedToday`'s own doc comment for the defect this mirrors: sorting
 * releases into buckets BY the presence of a blocker (rather than counting the blocker
 * alongside whichever bucket the release's `state` already puts it in) is how a stuck confirmed
 * discharge fell out of a ward's confirmed count entirely, at the exact moment the ward most
 * needed to see it. This function only ever counts; it never removes a release from
 * `derivedBedReleases`'s own state partition, and callers must not either.
 */
export function blockedReleaseCount(admissions: Admission[], now: Instant): number {
  return derivedBedReleases(admissions, now).filter((release) => release.blocker !== null).length;
}

/**
 * How often a ward's expected discharge date was met (never revised) versus moved (revised at
 * least once), counted over admissions that have actually left and had a date recorded on them
 * at some point.
 *
 * **Returns `null`, never `{ met: 0, moved: 0, total: 0 }`, when nobody qualifies.** Zero and "no
 * data" are different claims: zero would read as "this ward has a perfect record", when the truth
 * is nobody has left yet, or nobody who left ever had a date set to keep or move. Rendering a
 * fabricated 0% (or 100%) accuracy figure from an empty sample is exactly the kind of invented
 * fact this codebase treats as a defect.
 *
 * Gated on `dischargeDateSetAt !== null` rather than on `dischargeDateMoves > 0`, because
 * `dischargeDateMoves` defaults to `0` for an admission that never had a date at all — reading a
 * bare `0` as "met" would silently count every undated departure as a successful prediction.
 */
export function dischargeDateAccuracy(admissions: Admission[]): { met: number; moved: number; total: number } | null {
  let met = 0;
  let moved = 0;
  for (const admission of admissions) {
    if (admission.state !== "left") continue;
    if (admission.dischargeDateSetAt === null) continue;
    if (admission.dischargeDateMoves > 0) moved += 1;
    else met += 1;
  }
  const total = met + moved;
  return total === 0 ? null : { met, moved, total };
}
