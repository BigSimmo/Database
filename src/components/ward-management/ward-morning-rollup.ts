import { capacityBreakdown, type CapacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { BED_RELEASE_BLOCKED_FIGURE_LABEL, unitSiteCode } from "@/components/ward-management/ward-derivations";
import type { BedRelease, LeaveBed, Referral, Site, Unit } from "@/components/ward-management/ward-model";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";

/**
 * Phase 6: rolls Phase 5's per-unit capacity figures (`ward-bed-availability.ts`) up to hospital
 * (site) and network (service) level for the bed coordinator's morning page.
 *
 * This module computes only sums of existing `CapacityBreakdown` fields plus the freshness
 * derivation below. It re-derives no bed arithmetic of its own — the one number a coordinator
 * acts on must not drift from Phase 5's own arithmetic, so every figure here is a plain
 * `Array.reduce` over per-unit `capacityBreakdown()` output.
 */

/**
 * 08:00. A synthetic convenience for "the morning handover has happened today" — not a claim
 * about the timing of any real hospital's shift handover.
 */
export const MORNING_HANDOVER_MINUTES = 8 * 60; // 08:00

/**
 * The six figure labels, defined once (spec D3, D14). Every level renders from this.
 *
 * `blockedToday` joined them in the bed-model rework of 2026-08-28. It is a capacity figure about
 * beds, so unlike `PEOPLE_WAITING_LABEL` below it belongs here and is rendered at service,
 * hospital and ward level like the rest. It is a CROSS-CUT of `confirmedToday`/`expectedToday`,
 * never a bucket of its own — see `CapacityBreakdown.blockedToday` — so no level may add it to
 * them or subtract it from them.
 */
export const CAPACITY_FIGURE_LABELS = {
  availableNow: "Available now",
  confirmedToday: "Confirmed today",
  expectedToday: "Expected today",
  blockedToday: BED_RELEASE_BLOCKED_FIGURE_LABEL,
  held: "Held",
  leaveUsable: "Leave (usable)",
} as const;

/**
 * Task 9's one label, defined once beside the derivation for the same reason the five capacity
 * labels are (spec D14): a hardcoded copy in the page would pass every test while quietly costing
 * the cheap rename. Deliberately NOT a member of `CAPACITY_FIGURE_LABELS` — that constant is the
 * five-figure capacity vocabulary spec D3 requires to be identical at service, hospital and ward
 * level, and this is a demand figure, not a sixth capacity figure. Adding it there would put it
 * into `ALL_FIGURE_KEYS` and therefore into every `FigureList` on the page, which is exactly the
 * "one vocabulary, never combined" rule D3 exists to hold.
 */
export const PEOPLE_WAITING_LABEL = "People waiting for a bed";

/**
 * Task 9: how many people are waiting for a bed right now — the count of referrals still in state
 * `"queued"`, and nothing else. Not a forecast, not a shortfall, not a gap between demand and
 * supply.
 *
 * **Counted by `referralQueueOrder` itself (`ward-referrals.ts`), never by a second filter of our
 * own.** The referral board renders `referralQueueOrder(referrals)`; this figure is the length of
 * that same list, so the board and the morning page cannot disagree about how many people are
 * waiting. Two screens giving two answers from one state is this project's most expensive defect
 * class, and it has shipped here more than once — a duplicated `.filter(r => r.state ===
 * "queued")` here would look identical today and drift the first time the queue's own definition
 * of "waiting" changes.
 *
 * **It is not part of `CapacityRollup` and must never become one.** Spec D2's headline is the sum
 * of `availableNow` and nothing else; keeping this figure outside the `CapacityBreakdown` shape
 * means no `sumBreakdowns` reduce, no `ALL_FIGURE_KEYS` iteration and no future field-wise sum can
 * reach the headline through it. The page prints the two numbers side by side and never subtracts
 * one from the other — a subtraction performed by the page would be a claim about a shortfall, and
 * this prototype does not make one.
 */
export function peopleWaitingCount(referrals: Referral[]): number {
  return referralQueueOrder(referrals).length;
}

/**
 * How stale the figures rolled up under one heading are. `"never"` when no unit below has ever
 * confirmed its allocatable count; `"partial"` when some have and some have not; `"confirmed"`
 * when all have. `oldestConfirmedAt` is always the OLDEST contributing `confirmedAt` (spec D4) —
 * a rollup is only as fresh as its stalest input, never as fresh as its freshest.
 */
export type RollupFreshness =
  | { kind: "confirmed"; oldestConfirmedAt: Instant; unitsConfirmed: number; unitsTotal: number }
  | { kind: "partial"; oldestConfirmedAt: Instant; unitsConfirmed: number; unitsTotal: number }
  | { kind: "never" };

export type CapacityRollup = CapacityBreakdown & {
  unitsTotal: number;
  freshness: RollupFreshness;
};

export type UnitRollup = { unit: Unit; breakdown: CapacityBreakdown; freshness: RollupFreshness };
export type SiteRollup = { site: Site; rollup: CapacityRollup; units: UnitRollup[] };
export type ServiceRollup = {
  service: CapacityRollup;
  sites: SiteRollup[];
  at: Instant;
  /** Units in the `units` argument whose `unitSiteCode` matches no site in `sites`. Reported,
   *  never silently dropped from the total — see the module doc comment on `serviceRollup`. */
  unplacedUnitIds: string[];
};

/**
 * `now`'s operating day is `Math.floor(now / MINUTES_PER_DAY)` — the same expression
 * `releaseBand()` uses in `ward-bed-availability.ts`. Reused here rather than redefined so the
 * model never carries two notions of where one day ends and the next begins.
 */
function operatingDayStart(instant: Instant): Instant {
  return Math.floor(instant / MINUTES_PER_DAY) * MINUTES_PER_DAY;
}

/**
 * The 08:00 instant of `now`'s own operating day, but ONLY once that instant has actually
 * arrived. Returns `null` while `now` is still earlier in the day (spec D5) — this is a "has
 * handover happened yet" gate, not a clock-rounding helper, so it must never return a previous
 * day's 08:00 and must never fall back to `now` itself when handover has not yet happened.
 */
export function morningHandoverInstant(now: Instant): Instant | null {
  const handoverInstant = operatingDayStart(now) + MORNING_HANDOVER_MINUTES;
  return now >= handoverInstant ? handoverInstant : null;
}

/**
 * A unit counts as never-confirmed when `allocatable.confirmedAt` is absent or not a finite
 * number (rule 5) — the type says `Instant` is always present, but a defensively-authored
 * fixture or a future caller is not bound to honour that, and inventing a sentinel value (e.g.
 * treating `0` or `NaN` as a real timestamp) would silently misreport freshness.
 */
function hasConfirmedAllocatable(unit: Unit): boolean {
  const confirmedAt = unit.allocatable?.confirmedAt;
  return typeof confirmedAt === "number" && Number.isFinite(confirmedAt);
}

/**
 * Freshness for any group of units, from a single unit up to the whole service — the same rule
 * at every level (rules 2 and 3): the OLDEST contributing `confirmedAt` wins, never the newest,
 * because a rollup is only as trustworthy as its stalest input.
 */
function rollupFreshness(units: Unit[]): RollupFreshness {
  const confirmed = units.filter(hasConfirmedAllocatable);
  const unitsTotal = units.length;
  const unitsConfirmed = confirmed.length;

  if (unitsConfirmed === 0) return { kind: "never" };

  const oldestConfirmedAt = confirmed.reduce(
    (oldest, unit) => Math.min(oldest, unit.allocatable.confirmedAt),
    Infinity,
  );

  return unitsConfirmed === unitsTotal
    ? { kind: "confirmed", oldestConfirmedAt, unitsConfirmed, unitsTotal }
    : { kind: "partial", oldestConfirmedAt, unitsConfirmed, unitsTotal };
}

const EMPTY_BREAKDOWN: CapacityBreakdown = {
  availableNow: 0,
  confirmedToday: 0,
  expectedToday: 0,
  blockedToday: 0,
  held: 0,
  leaveUsable: 0,
  excludedBeyondToday: 0,
};

/**
 * Rule 1: every figure is the plain sum of the corresponding field, nothing re-derived.
 *
 * `availableNow` sums ONLY `breakdown.availableNow` — never `confirmedToday`, `expectedToday`
 * or `leaveUsable` mixed in. The single most important rule in this module is that nothing
 * expected, confirmed-but-unreleased, or on leave ever reaches this figure; a rollup that
 * added another field into `availableNow` would silently launder a softened number into the
 * one figure a coordinator is meant to treat as "fillable this minute" (see the
 * "never lets a release or a leave bed reach the headline figure" contract test below).
 */
function sumBreakdowns(breakdowns: CapacityBreakdown[]): CapacityBreakdown {
  return breakdowns.reduce(
    (sum, breakdown) => ({
      availableNow: sum.availableNow + breakdown.availableNow,
      confirmedToday: sum.confirmedToday + breakdown.confirmedToday,
      expectedToday: sum.expectedToday + breakdown.expectedToday,
      blockedToday: sum.blockedToday + breakdown.blockedToday,
      held: sum.held + breakdown.held,
      leaveUsable: sum.leaveUsable + breakdown.leaveUsable,
      excludedBeyondToday: sum.excludedBeyondToday + breakdown.excludedBeyondToday,
    }),
    EMPTY_BREAKDOWN,
  );
}

function buildUnitRollup(unit: Unit, releases: BedRelease[], leave: LeaveBed[], now: Instant): UnitRollup {
  return {
    unit,
    breakdown: capacityBreakdown(unit, releases, leave, now),
    freshness: rollupFreshness([unit]),
  };
}

function buildCapacityRollup(units: Unit[], breakdowns: CapacityBreakdown[]): CapacityRollup {
  return {
    ...sumBreakdowns(breakdowns),
    unitsTotal: units.length,
    freshness: rollupFreshness(units),
  };
}

/**
 * Rolls Phase 5's per-unit figures up to hospital (site) and service (network) level.
 *
 * **Why both `sites` and `units` (controller ruling R2).** `sites` gives grouping, display order
 * and names. The FIGURES come from `units` — passed by the caller from `WardFlowState` — never
 * from the units embedded in `wardSites`, because the provider seeds units from
 * `scenarioUnits(scenario)` and reading `wardSites`' embedded units would silently show the
 * standard-scenario numbers while a different scenario is selected. A unit is matched to its
 * site with `unitSiteCode(unit)`; a unit whose site code matches no site in `sites` is reported
 * in `unplacedUnitIds`, never dropped — and its figures still count in the service-wide total,
 * because dropping them from `service` on top of failing to place them would compound the
 * problem instead of surfacing it.
 */
export function serviceRollup(
  sites: Site[],
  units: Unit[],
  releases: BedRelease[],
  leave: LeaveBed[],
  now: Instant,
): ServiceRollup {
  // Each unit's breakdown is computed exactly once here, regardless of how many times it is
  // summed below (once into its site, once into the service total) — the service total sums
  // this same array rather than re-deriving figures from `units` a second time, so a unit
  // appearing in `units` once is counted once, and the site-level and service-level figures for
  // that unit can never drift apart from having been computed twice.
  const allUnitRollups = units.map((unit) => buildUnitRollup(unit, releases, leave, now));
  const placedUnitIds = new Set<string>();

  const siteRollups: SiteRollup[] = sites.map((site) => {
    const siteUnitRollups = allUnitRollups.filter((unitRollup) => unitSiteCode(unitRollup.unit) === site.code);
    for (const unitRollup of siteUnitRollups) placedUnitIds.add(unitRollup.unit.id);

    return {
      site,
      rollup: buildCapacityRollup(
        siteUnitRollups.map((unitRollup) => unitRollup.unit),
        siteUnitRollups.map((unitRollup) => unitRollup.breakdown),
      ),
      units: siteUnitRollups,
    };
  });

  const unplacedUnitIds = units.filter((unit) => !placedUnitIds.has(unit.id)).map((unit) => unit.id);

  const service = buildCapacityRollup(
    units,
    allUnitRollups.map((unitRollup) => unitRollup.breakdown),
  );

  return { service, sites: siteRollups, at: now, unplacedUnitIds };
}
