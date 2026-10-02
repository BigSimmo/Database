import type { CmeRequirementSet, CmeRequirementSpec, CmeRequirementStatus } from "@/lib/cme/types";

/**
 * How far short of met one unmet requirement is, on a scale that can be
 * compared ONLY against other requirements in the same tier.
 *
 * The four requirement shapes are not on one comparable scale — "3 hours
 * short" and "2 activities still have nothing against them" are different
 * units, and a `task` has no magnitude at all, only done-or-not — so ranking
 * orders by tier first, then by size of gap within a tier:
 *
 *   0. Hours requirements (`hours-in-category`, `hours-across-categories`,
 *      `credited-hours`), by hours remaining (`progress.target -
 *      progress.value`), largest first. Hours accrue gradually across the
 *      whole year, so a large hours gap needs the most lead time to close and
 *      is the most consequential thing to surface.
 *   1. `activity-count` requirements, by buckets still empty, most empty
 *      first. These are usually closable in a single sitting once the owner
 *      notices them.
 *   2. Not-started `task` requirements last — `progress` is null, so there is
 *      no gap to compare; ties within this tier keep list order.
 */
type ShortfallTier = 0 | 1 | 2;

function shortfallTier(shape: CmeRequirementSpec["shape"] | undefined): ShortfallTier {
  if (shape === "hours-in-category" || shape === "hours-across-categories" || shape === "credited-hours") return 0;
  if (shape === "activity-count") return 1;
  return 2; // "task", or a requirement id the set no longer names
}

/** True for the three shapes whose progress is counted in hours. */
export function isHoursRequirementShape(shape: CmeRequirementSpec["shape"] | undefined): boolean {
  return shortfallTier(shape) === 0;
}

/** `progress.target - progress.value`, never below zero; zero for a requirement with no progress (a task). */
export function requirementGap(status: CmeRequirementStatus): number {
  if (!status.progress) return 0;
  return Math.max(0, Math.round((status.progress.target - status.progress.value) * 100) / 100);
}

/**
 * Every status, unmet first, each unmet one ranked by how far it is from met
 * (tier, then gap, largest first), then the met ones in `set.requirements`
 * order. This is the order Today's "What's left" list reads in, and its first
 * unmet row is the same requirement `furthestFromMet` names.
 *
 * Never simply list order: that is an authoring order, not a distance-from-met
 * order, and can put the requirement that is barely short ahead of one still
 * almost untouched. The sort is stable, so two requirements tied on tier and
 * gap keep their `set.requirements` order.
 */
export function rankRequirementsByGap(
  set: CmeRequirementSet,
  statuses: readonly CmeRequirementStatus[],
): CmeRequirementStatus[] {
  const ranked = statuses.map((status, index) => {
    const shape = set.requirements.find((requirement) => requirement.id === status.requirementId)?.spec.shape;
    return { status, index, tier: shortfallTier(shape), gap: requirementGap(status) };
  });
  ranked.sort(
    (a, b) =>
      Number(a.status.met) - Number(b.status.met) ||
      (a.status.met ? 0 : a.tier - b.tier || b.gap - a.gap) ||
      a.index - b.index,
  );
  return ranked.map(({ status }) => status);
}

/** Whichever unmet requirement is furthest from being met, by the ranking above. */
export function furthestFromMet(
  set: CmeRequirementSet,
  unmet: readonly CmeRequirementStatus[],
): CmeRequirementStatus | undefined {
  return rankRequirementsByGap(
    set,
    unmet.filter((status) => !status.met),
  )[0];
}
