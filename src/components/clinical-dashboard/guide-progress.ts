import { guideTourStepIds, type GuideTourStepId } from "@/components/clinical-dashboard/guide-content";

export const guideProgressStorageKey = "clinical-kb-guide-progress:v1";

export type GuideProgress = {
  version: 1;
  completedStepIds: GuideTourStepId[];
  lastStepId: GuideTourStepId | null;
};

export const emptyGuideProgress: GuideProgress = {
  version: 1,
  completedStepIds: [],
  lastStepId: null,
};

const guideTourStepIdSet = new Set<string>(guideTourStepIds);

export function parseGuideProgress(value: string | null): GuideProgress {
  if (!value) return emptyGuideProgress;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.completedStepIds) ||
      parsed.completedStepIds.some((id) => typeof id !== "string")
    ) {
      return emptyGuideProgress;
    }
    const completedStepIdsRaw = parsed.completedStepIds as unknown[];
    const completedStepIds = guideTourStepIds.filter((id) => completedStepIdsRaw.includes(id));
    const lastStepId =
      typeof parsed.lastStepId === "string" && guideTourStepIdSet.has(parsed.lastStepId)
        ? (parsed.lastStepId as GuideTourStepId)
        : null;
    return { version: 1, completedStepIds, lastStepId };
  } catch {
    return emptyGuideProgress;
  }
}

export function loadGuideProgress(): GuideProgress {
  if (typeof window === "undefined") return emptyGuideProgress;
  try {
    return parseGuideProgress(window.localStorage.getItem(guideProgressStorageKey));
  } catch {
    return emptyGuideProgress;
  }
}

export function saveGuideProgress(progress: GuideProgress) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(guideProgressStorageKey, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export function clearGuideProgress() {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(guideProgressStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function completeGuideStep(progress: GuideProgress, stepId: GuideTourStepId): GuideProgress {
  const completed = new Set(progress.completedStepIds);
  completed.add(stepId);
  return {
    version: 1,
    completedStepIds: guideTourStepIds.filter((id) => completed.has(id)),
    lastStepId: stepId,
  };
}

export function firstIncompleteGuideStep(progress: GuideProgress): GuideTourStepId {
  return guideTourStepIds.find((id) => !progress.completedStepIds.includes(id)) ?? guideTourStepIds[0];
}
