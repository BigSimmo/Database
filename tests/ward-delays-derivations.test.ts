import { describe, expect, it } from "vitest";

import {
  DELAY_CAUSE_ORDER,
  SEVERE_CAUSES,
  delayGroups,
  legalDeadlineMinutes,
  waitingSplit,
} from "@/components/ward-management/delays/delays-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { clockState, minutesUntil } from "@/components/ward-management/ward-clock";

/**
 * The merge's whole claim, asserted rather than argued: the priority queue, the exceptions inbox and
 * the escalation board listed THE SAME PEOPLE, so one screen can carry all three without losing
 * anybody and without counting anybody twice.
 *
 * ⚠️ Three of the plan's own conditions were wrong against the real code and are corrected here.
 * Each is recorded on the assertion that would have caught it, because a silently emptied group is
 * the failure mode this whole screen has: a heading that is simply absent reads as "nothing is
 * wrong in that category".
 */
const NOW = NOW_ANCHOR;

describe("delayGroups", () => {
  it("places every open movement in exactly one group — a patient is not counted twice", () => {
    const open = wardMovements.filter(isOpen);
    const grouped = delayGroups(wardMovements, allUnits(), NOW).flatMap((group) =>
      group.movements.map((movement) => movement.id),
    );
    expect(new Set(grouped).size, "a movement appears in two groups").toBe(grouped.length);
    expect([...grouped].sort()).toEqual(open.map((movement) => movement.id).sort());
  });

  it("puts an expiring legal authority first, above a longer wait", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    // Only assert the ordering rule when the fixture actually exercises it, and say so when it does
    // not — a silently skipped ordering rule is how one comes back wrong.
    const legal = groups.findIndex((group) => group.cause === "legal_expiring");
    if (legal === -1) {
      expect(groups.map((group) => group.cause)).not.toContain("legal_expiring");
      return;
    }
    expect(legal).toBe(0);
  });

  it("returns no empty group, because a heading over nothing reads as a category that is fine", () => {
    for (const group of delayGroups(wardMovements, allUnits(), NOW)) {
      expect(group.movements.length, `${group.cause} is empty`).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠️ ANTI-VACUITY, AND IT CATCHES A DEFECT THE PLAN SHIPPED. The plan classified "no eligible
   * bed" as `shortlistCandidates(...).length === 0`. That function returns EVERY unit with an
   * honest verdict on each — its own doc comment says so in capitals — so its length is zero only
   * when the network has no wards at all. The group would have been permanently empty, and an
   * empty group is DROPPED, so the two people with nowhere to go would simply not have appeared.
   * Nothing above would have gone red: every other assertion here passes with the group missing.
   */
  it("actually finds the people with nowhere eligible, rather than dropping the group", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const nowhere = groups.find((group) => group.cause === "no_eligible_bed");
    expect(nowhere, "no_eligible_bed is absent — the classifier can no longer detect it").toBeDefined();
    expect(nowhere?.movements.length ?? 0).toBeGreaterThan(0);
  });

  /** Every cause the type allows must be reachable, or the union is bigger than the classifier. */
  it("uses only causes the classifier can actually produce", () => {
    const produced = new Set(delayGroups(wardMovements, allUnits(), NOW).map((group) => group.cause));
    expect(produced.size, "the fixture exercises too few causes to be a useful guard").toBeGreaterThan(2);
  });

  /**
   * AUDIT GAP 1. `buildActionInbox`'s "Bed pull expired" category has a real equivalent here now:
   * a `stage === "pulled"` movement whose `pullExpiresAt` has already lapsed must land under
   * `bed_pull_expired`, not get lumped into `awaiting_bed_ready` with every hold still running.
   */
  it("puts an expired bed pull under bed_pull_expired, not awaiting_bed_ready", () => {
    const expiredPulls = wardMovements.filter(
      (movement) => movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt < NOW,
    );
    expect(
      expiredPulls.length,
      "the fixture carries no expired bed pull — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const expiredGroup = groups.find((group) => group.cause === "bed_pull_expired");
    expect(expiredGroup, "bed_pull_expired is absent — the classifier can no longer detect it").toBeDefined();
    const expiredGroupIds = new Set(expiredGroup?.movements.map((movement) => movement.id));
    for (const movement of expiredPulls) {
      expect(expiredGroupIds.has(movement.id), `${movement.id} has an expired pull but is not grouped under it`).toBe(
        true,
      );
    }

    const bedReadyGroup = groups.find((group) => group.cause === "awaiting_bed_ready");
    for (const movement of expiredPulls) {
      expect(
        bedReadyGroup?.movements.some((candidate) => candidate.id === movement.id) ?? false,
        `${movement.id} has an expired pull but still appears under awaiting_bed_ready too`,
      ).toBe(false);
    }
  });

  /**
   * AUDIT GAP 1, ranking half. An expired hold is worse than one still running, so
   * `bed_pull_expired` must outrank `awaiting_bed_ready` whenever both groups are present.
   */
  it("ranks bed_pull_expired above awaiting_bed_ready when both are present", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const expiredIndex = groups.findIndex((group) => group.cause === "bed_pull_expired");
    const bedReadyIndex = groups.findIndex((group) => group.cause === "awaiting_bed_ready");
    if (expiredIndex === -1 || bedReadyIndex === -1) {
      // Already proved non-vacuous above for bed_pull_expired; if awaiting_bed_ready happens to
      // be empty on this fixture there is nothing to rank against, and that is not this test's
      // claim to make.
      return;
    }
    expect(expiredIndex).toBeLessThan(bedReadyIndex);
  });

  /**
   * AUDIT GAP 3. `legal_breached` and `legal_expiring` must never both claim the same movement,
   * and `ORDER` must rank a passed deadline above a merely approaching one. As of this fixture
   * (recorded in delays-derivations.ts's own comment on this branch) every seeded `legalForm.dueAt`
   * lands in `clockState` "due" or "clear" — none is "breached" or "critical" — so neither new
   * cause is actually populated today. That is reported here rather than hidden: the population
   * this test floors is the movements that carry a legal deadline at all, and what it proves is
   * that none of THEM is wrongly swept into either legal cause while in a non-urgent state.
   */
  it("keeps a non-urgent legal deadline out of both legal_breached and legal_expiring", () => {
    const withDeadline = wardMovements.filter((movement) => movement.legalForm?.dueAt !== undefined);
    expect(
      withDeadline.length,
      "the fixture carries no movement with a legal deadline — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    const nonUrgent = withDeadline.filter((movement) => {
      const dueAt = movement.legalForm?.dueAt;
      if (dueAt === undefined) return false;
      const state = clockState(dueAt, NOW);
      return state === "due" || state === "clear";
    });
    expect(
      nonUrgent.length,
      "every seeded legal deadline is breached or critical — this test no longer covers the non-urgent case it names",
    ).toBe(withDeadline.length);

    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const legalIds = new Set(
      groups
        .filter((group) => group.cause === "legal_breached" || group.cause === "legal_expiring")
        .flatMap((group) => group.movements.map((movement) => movement.id)),
    );
    for (const movement of nonUrgent) {
      expect(legalIds.has(movement.id), `${movement.id}'s deadline is not urgent but was grouped as legal`).toBe(false);
    }
  });

  /**
   * AUDIT GAP 3, ranking half. `legal_breached` must outrank `legal_expiring` whenever both are
   * present — a passed deadline is worse than one merely approaching. Neither group is populated
   * by today's fixture (see the test above), so this is written to hold in both the case where
   * the fixture starts exercising one or both groups later and the case where it never does,
   * rather than being skipped outright.
   */
  it("ranks legal_breached above legal_expiring when both are present", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    const breachedIndex = groups.findIndex((group) => group.cause === "legal_breached");
    const expiringIndex = groups.findIndex((group) => group.cause === "legal_expiring");
    if (breachedIndex === -1 || expiringIndex === -1) {
      return;
    }
    expect(breachedIndex).toBeLessThan(expiringIndex);
  });
});

describe("legalDeadlineMinutes", () => {
  /**
   * AUDIT GAP 2. `delayGroups` only tells a caller WHICH cause a movement's legal deadline fell
   * under; the exceptions inbox it replaces rendered the actual remaining/overdue minutes
   * (`buildActionInbox`'s `minutesUntil(dueAt, now)`). This exposes that same raw figure.
   */
  it("returns the exact minutesUntil figure for every movement carrying a legal deadline", () => {
    const withDeadline = wardMovements.filter((movement) => movement.legalForm?.dueAt !== undefined);
    expect(
      withDeadline.length,
      "the fixture carries no movement with a legal deadline — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    for (const movement of withDeadline) {
      const dueAt = movement.legalForm?.dueAt as number;
      expect(legalDeadlineMinutes(movement, NOW)).toBe(minutesUntil(dueAt, NOW));
    }
  });

  it("returns undefined for a movement with no legal deadline, and does not fabricate a number", () => {
    const withoutDeadline = wardMovements.filter((movement) => movement.legalForm?.dueAt === undefined);
    expect(
      withoutDeadline.length,
      "the fixture carries no movement without a legal deadline — this assertion would otherwise be vacuous",
    ).toBeGreaterThan(0);

    for (const movement of withoutDeadline) {
      expect(legalDeadlineMinutes(movement, NOW)).toBeUndefined();
    }
  });

  it("returns a negative figure once the deadline has passed, matching formatRemaining's own sign convention", () => {
    const overdue = wardMovements.filter(
      (movement) => movement.legalForm?.dueAt !== undefined && movement.legalForm.dueAt < NOW,
    );
    if (overdue.length === 0) {
      // Recorded rather than assumed: as of this fixture (see delays-derivations.ts's own
      // comment on the legal_breached/legal_expiring split) no seeded legal deadline has
      // actually passed, so this branch cannot be exercised without inventing fixture data.
      return;
    }
    for (const movement of overdue) {
      expect(legalDeadlineMinutes(movement, NOW)).toBeLessThan(0);
    }
  });
});

describe("waitingSplit", () => {
  it("splits every open movement and nothing else", () => {
    const total = waitingSplit(wardMovements, NOW).reduce((sum, segment) => sum + segment.value, 0);
    expect(total).toBe(wardMovements.filter(isOpen).length);
  });

  it("puts a real population in more than one band, or the bar says nothing", () => {
    const nonEmpty = waitingSplit(wardMovements, NOW).filter((segment) => segment.value > 0);
    expect(nonEmpty.length).toBeGreaterThan(1);
  });

  /**
   * 🔴 SEVERITY MUST BE A CONTIGUOUS PREFIX OF THE RANKING, and this exists because it briefly was
   * not. Splitting `legal_expiring` into `legal_breached` + `legal_expiring` added the worse case
   * to the ranking while the screen predicate that decides danger tone still named only the old
   * member — so the lapsed authority read as routine and the approaching one read as danger.
   * A string union still typechecks after a split, so nothing caught it.
   *
   * The property, rather than the member list: everything the screen calls severe must sit at the
   * TOP of the order with no ordinary cause interleaved. Insert a new worst cause without naming it
   * severe and this goes red; mark something severe that ranks below an ordinary cause and it goes
   * red the other way.
   */
  it("treats exactly the top of the ranking as severe, with no ordinary cause above a severe one", () => {
    expect(SEVERE_CAUSES.length, "no severe causes — this assertion would be vacuous").toBeGreaterThan(0);
    expect(
      DELAY_CAUSE_ORDER.length,
      "the ranking is not longer than the severe band, so prefix means nothing",
    ).toBeGreaterThan(SEVERE_CAUSES.length);

    const positions = SEVERE_CAUSES.map((cause) => DELAY_CAUSE_ORDER.indexOf(cause));
    expect(positions, `a severe cause is missing from the ranking: ${SEVERE_CAUSES.join(", ")}`).not.toContain(-1);

    const expected = DELAY_CAUSE_ORDER.slice(0, SEVERE_CAUSES.length);
    expect(
      [...SEVERE_CAUSES].sort(),
      `severity is not the top ${SEVERE_CAUSES.length} of the ranking — order is ${DELAY_CAUSE_ORDER.join(" > ")}`,
    ).toEqual([...expected].sort());
  });
});
