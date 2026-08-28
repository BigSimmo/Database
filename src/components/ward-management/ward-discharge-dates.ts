import {
  LEAVING_DESTINATIONS,
  bedIsOccupied,
  type Admission,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { BED_RELEASE_WAITING_ON, type BedRelease } from "@/components/ward-management/ward-model";

/**
 * Task 4 (Ward Board plan): the ward sets ONE expected discharge date per occupancy
 * (`Admission.expectedDischargeAt`), and this module is where everything forward-looking gets
 * derived from it. Pure functions only — no React, no state, no I/O — and no bed arithmetic of
 * its own: `derivedBedReleases` produces the `BedRelease[]` view that `capacityBreakdown`
 * (`ward-bed-availability.ts`) already knows how to bucket into today/beyond-today and
 * predicted/confirmed/blocked. Re-deriving any of THAT here would be exactly the drift this
 * module exists to prevent — if a count needs computing, `capacityBreakdown` is where it belongs.
 *
 * **A gap in this task's own brief, found while implementing, stated here because a later reader
 * will hit it too.** The brief asks for an admission "confirmed as going" to derive a
 * `state: "confirmed"` release. `Admission` (`ward-admissions.ts`) carries no such fact — nothing
 * on it distinguishes a merely-expected departure from one the ward has actively decided on. In
 * the live ward-flow model that decision is `CONFIRM_BED_RELEASE` (`ward-flow-reducer.ts`), a
 * discrete action recorded on a *separately tracked* `BedRelease`, not a derivable property of an
 * `Admission`. Inventing a proxy (e.g. "the date has arrived" or "it's been set a while") would
 * render a ward decision that was never actually made — the exact kind of fabricated fact this
 * codebase treats as a defect, not a convenience. So `derivedBedReleases` below only ever emits
 * `"predicted"` or `"released"`, never `"confirmed"`; the type still allows `"confirmed"` because
 * it is a legitimate state for a *real* `BedRelease` elsewhere, just not one this derivation can
 * honestly produce from an `Admission` alone. See `tests/ward-discharge-dates.test.ts` for how the
 * blocked-cross-cut invariant is tested against the state this module actually reaches.
 *
 * **`waitingOn` is set to `"Nothing outstanding"` on every derived prediction, for the same
 * reason.** `Admission` has no field naming which specific obstacle (ward round, family
 * agreement, accommodation, community team) a discharge is waiting on — only that a date has been
 * set. `"Nothing outstanding"` is the one value in `BED_RELEASE_WAITING_ON` that does not assert a
 * specific obstacle nobody told us about; its own doc comment in `ward-model.ts` makes the same
 * argument for a ward that hasn't named one. Picking any other member here would invent a reason.
 */

/** The one `BED_RELEASE_WAITING_ON` member that asserts no specific obstacle — see the module
 *  doc comment above for why this is the only honest value this module can produce. */
const NO_OBSTACLE_RECORDED: (typeof BED_RELEASE_WAITING_ON)[number] = "Nothing outstanding";
const NO_OBSTACLE_INDEX = BED_RELEASE_WAITING_ON.indexOf(NO_OBSTACLE_RECORDED);
if (NO_OBSTACLE_INDEX === -1) {
  // Degrades loudly rather than silently asserting an obstacle that no longer exists in the
  // owner-approved list — see the module doc comment on why this module may never invent one.
  throw new Error('ward-discharge-dates: "Nothing outstanding" is no longer a member of BED_RELEASE_WAITING_ON');
}

/** A role is required wherever `BedRelease` requires one (`confirmedBy`, `blockedBy`) but
 *  `Admission` records none — never a personal name, and never a guess at which real role acted;
 *  a stated absence, the same discipline `"Nothing outstanding"` holds for `waitingOn`. */
const ROLE_NOT_RECORDED = "Not recorded";

const STATEWIDE_RELEASE_BY_DESTINATION: ReadonlyMap<LeavingDestination, boolean> = new Map(
  LEAVING_DESTINATIONS.map((destination) => [destination.id, destination.countsAsStatewideRelease]),
);

/**
 * One admission's forward-looking prediction, or `null` when there is nothing to predict.
 *
 * **Rule 3 lives here, and it is absolute: no `expectedDischargeAt` (or a non-finite one) means NO
 * release, never a release at `now` and never a release at a fallback instant.** An absent date
 * must never read as "not yet due" — the same discipline `isPastExpectedDischarge` holds a few
 * files away. A plausible-looking mistake this guards against: defaulting the missing date to
 * `now` "so the board has something to show" would make every undated admission look like it is
 * discharging THIS INSTANT, which is the opposite of what an absent plan means.
 *
 * Only a bed genuinely occupied (`bedIsOccupied`) can have a future release predicted — a
 * waitlisted admission holds no bed yet, so a date recorded on one (incoherent input) still
 * yields no release rather than claiming a bed release nobody can point to.
 */
function derivePredictedRelease(admission: Admission): BedRelease | null {
  if (!bedIsOccupied(admission)) return null;
  const expectedAt = admission.expectedDischargeAt;
  if (expectedAt === null || !Number.isFinite(expectedAt)) return null;

  const blocker = admission.blockReason;
  return {
    id: `derived-predicted-${admission.id}`,
    unitId: admission.unitId,
    state: "predicted",
    expectedAt,
    waitingOn: NO_OBSTACLE_RECORDED,
    blocker,
    // Moves WITH the blocker in both directions — see `ward-bed-availability-model.test.ts`'s
    // own invariant for `blockedBy`/`blocker`: never one without the other.
    blockedBy: blocker === null ? null : (admission.dischargeDateSetBy ?? ROLE_NOT_RECORDED),
    // Neither fact exists on `Admission`; never invented (see `BED_PREPARATION_NOTES`'s own rule
    // that a preparation note is never guessed).
    preparing: false,
    preparationNote: null,
    confirmedAt: admission.dischargeDateSetAt ?? expectedAt,
    confirmedBy: admission.dischargeDateSetBy ?? ROLE_NOT_RECORDED,
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
 * Every `BedRelease` this module can honestly derive from a list of admissions: one `"predicted"`
 * entry per occupied bed carrying a real expected discharge date, and one `"released"` entry per
 * admission that has actually left as of `now`. Never `"confirmed"` — see the module's own doc
 * comment for why.
 *
 * This is the whole surface other code should read for a derived view. `capacityBreakdown`
 * (`ward-bed-availability.ts`) is the existing consumer that turns this list into today/
 * beyond-today and predicted/confirmed/blocked counts; nothing here repeats that arithmetic.
 */
export function derivedBedReleases(admissions: Admission[], now: Instant): BedRelease[] {
  const releases: BedRelease[] = [];
  for (const admission of admissions) {
    const predicted = derivePredictedRelease(admission);
    if (predicted !== null) {
      releases.push(predicted);
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
export function dischargeDateAccuracy(
  admissions: Admission[],
): { met: number; moved: number; total: number } | null {
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
