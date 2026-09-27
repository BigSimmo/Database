import { perthCalendarDate } from "@/lib/cme/cpd-year";
import { routinesDueOn, type CmeRoutine } from "@/lib/cme/routines";
import type { CmeEntry, CmeRequirementSet, CmeRequirementStatus } from "@/lib/cme/types";

export type CmeTodoRow = {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
  readonly href: string;
  readonly count?: number;
};

/** One ordered view of work already implied by the doctor's own saved records. */
export function buildCmeTodo(args: {
  set: CmeRequirementSet;
  entries: readonly CmeEntry[];
  routines: readonly CmeRoutine[];
  statuses: readonly CmeRequirementStatus[];
  now: Date;
  draftsToFinish: number;
  nextStep: CmeTodoRow;
  nextRequirementId?: string;
}): { nextToLog: CmeTodoRow[]; toFinish: CmeTodoRow[] } {
  const { set, entries, routines, statuses, now, draftsToFinish, nextStep, nextRequirementId } = args;
  const yearEntries = entries.filter((entry) => !entry.archivedAt && entry.date.startsWith(`${set.year}-`));
  const nextToLog: CmeTodoRow[] = [nextStep];
  const categoryGap = set.closedAt
    ? undefined
    : statuses.find((status) => {
        if (status.met || status.requirementId === nextRequirementId) return false;
        const shape = set.requirements.find((requirement) => requirement.id === status.requirementId)?.spec.shape;
        return shape === "hours-in-category" || shape === "hours-across-categories";
      });
  if (categoryGap) {
    const label = set.requirements.find((requirement) => requirement.id === categoryGap.requirementId)?.label;
    nextToLog.push({
      id: `gap-${categoryGap.requirementId}`,
      label: label ?? "Category gap",
      detail: categoryGap.summary,
      href: `/cme/check?year=${set.year}#cme-requirement-${encodeURIComponent(categoryGap.requirementId)}`,
    });
  }
  for (const routine of !set.closedAt && perthCalendarDate(now).startsWith(`${set.year}-`)
    ? routinesDueOn(routines, now)
    : []) {
    nextToLog.push({
      id: `routine-${routine.id}`,
      label: routine.title,
      detail: "Routine due · check the time you actually spent",
      href: `/cme/new?year=${set.year}&routine=${encodeURIComponent(routine.id)}`,
    });
  }

  const toFinish: CmeTodoRow[] = [];
  const notCopied = yearEntries.filter((entry) => !entry.transcribed).length;
  if (notCopied)
    toFinish.push({
      id: "copy",
      label: "Not copied to your CPD home",
      count: notCopied,
      href: `/cme/log?year=${set.year}&copy=todo`,
    });
  if (draftsToFinish)
    toFinish.push({
      id: "drafts",
      label: "Drafts to finish",
      count: draftsToFinish,
      href: `/cme/log?year=${set.year}&tab=finish#cme-drafts`,
    });
  const noReflection = yearEntries.filter((entry) => !entry.reflection.trim()).length;
  if (noReflection)
    toFinish.push({
      id: "reflection",
      label: "Reflections to add",
      count: noReflection,
      href: `/cme/log?year=${set.year}&fix=reflection`,
    });
  // Unknown evidence counts have never been checked. Do not imply a missing certificate.
  const noEvidence = yearEntries.filter((entry) => entry.evidenceCount === 0).length;
  if (noEvidence)
    toFinish.push({
      id: "evidence",
      label: "Certificates to add",
      count: noEvidence,
      href: `/cme/log?year=${set.year}&fix=evidence`,
    });
  return { nextToLog, toFinish };
}
