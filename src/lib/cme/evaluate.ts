import {
  cmeCategoryLabels,
  type CmeCategory,
  type CmeEntry,
  type CmeRequirement,
  type CmeRequirementSet,
  type CmeRequirementStatus,
} from "@/lib/cme/types";

export type CmeYearStatus = {
  readonly totalHours: number;
  readonly statuses: readonly CmeRequirementStatus[];
  readonly unmet: readonly CmeRequirementStatus[];
};

function hoursIn(entries: readonly CmeEntry[], category: CmeCategory): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.archivedAt) continue;
    for (const allocation of entry.allocations) {
      if (allocation.category === category) total += allocation.hours;
    }
  }
  return round2(total);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function hoursWord(hours: number): string {
  return `${round2(hours)} hour${round2(hours) === 1 ? "" : "s"} short`;
}

export function totalAllocatedHours(entries: readonly CmeEntry[]): number {
  return round2(
    entries
      .filter((entry) => !entry.archivedAt)
      .reduce((sum, entry) => sum + entry.allocations.reduce((inner, a) => inner + a.hours, 0), 0),
  );
}

/**
 * Two arguments, deliberately and permanently. There is no third parameter for
 * a fraction, a full-time equivalent or a working pattern, because no such
 * input may ever reduce a target: part-time work does not lower the
 * requirement, and a tracker that quietly lowered it would be the most
 * dangerous thing in this design. A legitimate status-transition adjustment is
 * a different target on a different year, entered by the owner, never computed
 * here.
 */
export function evaluateRequirement(requirement: CmeRequirement, entries: readonly CmeEntry[]): CmeRequirementStatus {
  entries = entries.filter((entry) => !entry.archivedAt);
  const spec = requirement.spec;
  switch (spec.shape) {
    case "credited-hours": {
      const value = round2(
        entries.reduce(
          (sum, entry) => sum + Math.min(entry.formalPeerReviewHours ?? 0, hoursIn([entry], "reviewing")),
          0,
        ),
      );
      const met = value >= spec.minimumHours;
      return {
        requirementId: requirement.id,
        met,
        progress: { value, target: spec.minimumHours },
        summary: met ? "Met" : hoursWord(spec.minimumHours - value),
      };
    }
    case "hours-in-category": {
      const value = hoursIn(entries, spec.category);
      const met = value >= spec.minimumHours;
      return {
        requirementId: requirement.id,
        met,
        progress: { value, target: spec.minimumHours },
        summary: met ? "Met" : hoursWord(spec.minimumHours - value),
      };
    }
    case "hours-across-categories": {
      const perCategory = spec.categories.map((category) => ({ category, value: hoursIn(entries, category) }));
      const value = round2(perCategory.reduce((sum, item) => sum + item.value, 0));
      const combinedShort = Math.max(0, spec.minimumHours - value);
      const floorShort = perCategory
        .map((item) => ({ ...item, short: Math.max(0, spec.minimumEachHours - item.value) }))
        .filter((item) => item.short > 0)
        .sort((a, b) => b.short - a.short);
      const met = combinedShort === 0 && floorShort.length === 0;
      // Report the bigger gap, because that is the one that decides what to do next.
      const summary = met
        ? "Met"
        : combinedShort >= (floorShort[0]?.short ?? 0)
          ? hoursWord(combinedShort)
          : `${hoursWord(floorShort[0]!.short).replace(" short", "")} short in ${cmeCategoryLabels[floorShort[0]!.category].toLowerCase()}`;
      return { requirementId: requirement.id, met, progress: { value, target: spec.minimumHours }, summary };
    }
    case "activity-count": {
      const filled = spec.buckets.filter(
        (bucket) => entries.filter((entry) => entry.buckets.includes(bucket)).length >= spec.minimumPerBucket,
      );
      const empty = spec.buckets.filter((bucket) => !filled.includes(bucket));
      const met = empty.length === 0;
      return {
        requirementId: requirement.id,
        met,
        progress: { value: filled.length, target: spec.buckets.length },
        summary: met
          ? "Met"
          : empty.length === 1
            ? `${empty[0]} has nothing against it yet`
            : `${empty.length} of ${spec.buckets.length} have nothing against them yet`,
      };
    }
    case "task": {
      const met = requirement.completedOn !== null;
      return {
        requirementId: requirement.id,
        met,
        progress: null,
        summary: met ? `Done ${requirement.completedOn}` : "Not started",
      };
    }
  }
}

export function evaluateYear(args: { set: CmeRequirementSet; entries: readonly CmeEntry[] }): CmeYearStatus {
  const statuses = args.set.requirements.map((requirement) => evaluateRequirement(requirement, args.entries));
  return {
    totalHours: totalAllocatedHours(args.entries),
    statuses,
    unmet: statuses.filter((status) => !status.met),
  };
}
