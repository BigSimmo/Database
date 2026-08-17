import { z } from "zod";
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

const guideTourStepIdEnum = z.enum(guideTourStepIds);

const guideProgressSchema = z.object({
  version: z.literal(1),
  completedStepIds: z.array(z.string()).transform((ids) => guideTourStepIds.filter((id) => ids.includes(id))),
  lastStepId: guideTourStepIdEnum.nullable().catch(null),
});

export function parseGuideProgress(value: string | null): GuideProgress {
  if (!value) return emptyGuideProgress;
  try {
    const raw = JSON.parse(value);
    const parsed = guideProgressSchema.safeParse(raw);
    if (!parsed.success) return emptyGuideProgress;
    return {
      version: 1,
      completedStepIds: parsed.data.completedStepIds,
      lastStepId: parsed.data.lastStepId,
    };
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
