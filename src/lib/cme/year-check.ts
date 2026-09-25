import { evaluateRequirement, totalAllocatedHours } from "@/lib/cme/evaluate";
import type { CmeEntry, CmeRequirement, CmeRequirementSet } from "@/lib/cme/types";

/**
 * The year read the way an audit reads it: every confirmed target, and then
 * the three things an auditor asks for that no target measures — evidence for
 * each activity, a reflection on it, and whether it has reached the CPD home.
 *
 * Every row carries the activities that prove it and one action that closes
 * the gap, so the page answers "what do I show?" and "what do I do next?" in
 * the same place. Targets come only from the owner's confirmed set; nothing
 * here invents a requirement.
 */

export type CmeYearCheckGroup = "targets" | "records";

export type CmeYearCheckRow = {
  readonly id: string;
  readonly group: CmeYearCheckGroup;
  readonly label: string;
  readonly ready: boolean;
  /** One plain sentence: what is met, or exactly what is missing. */
  readonly summary: string;
  /** Activities that count toward this row (targets) or still need attention (records). */
  readonly entryIds: readonly string[];
  readonly action: { readonly label: string; readonly href: string } | null;
};

export type CmeYearCheck = {
  readonly rows: readonly CmeYearCheckRow[];
  readonly readyCount: number;
};

function active(entries: readonly CmeEntry[]): readonly CmeEntry[] {
  return entries.filter((entry) => !entry.archivedAt);
}

function contributingEntries(requirement: CmeRequirement, entries: readonly CmeEntry[]): readonly CmeEntry[] {
  const spec = requirement.spec;
  switch (spec.shape) {
    case "hours-in-category":
      return entries.filter((entry) => entry.allocations.some((a) => a.category === spec.category && a.hours > 0));
    case "hours-across-categories":
      return entries.filter((entry) =>
        entry.allocations.some((a) => spec.categories.includes(a.category) && a.hours > 0),
      );
    case "credited-hours":
      return entries.filter((entry) => (entry.formalPeerReviewHours ?? 0) > 0);
    case "activity-count":
      return entries.filter((entry) => entry.buckets.some((bucket) => spec.buckets.includes(bucket)));
    case "task":
      return [];
  }
}

function requirementAction(requirement: CmeRequirement, year: number): CmeYearCheckRow["action"] {
  switch (requirement.spec.shape) {
    case "task":
      return requirement.id === "plan"
        ? { label: "Open your plan", href: "/cme/plan" }
        : { label: "Mark it done in set up", href: "/cme/setup" };
    case "activity-count":
      return { label: "Tag an activity in your log", href: `/cme/log?year=${year}` };
    default:
      return { label: "Log an activity", href: `/cme/new?year=${year}` };
  }
}

function activities(count: number): string {
  return `${count} ${count === 1 ? "activity" : "activities"}`;
}

export function buildCmeYearCheck(set: CmeRequirementSet, allEntries: readonly CmeEntry[]): CmeYearCheck {
  const entries = active(allEntries);
  const total = totalAllocatedHours(entries);
  const rows: CmeYearCheckRow[] = [];

  if (set.totalHours > 0) {
    const shortBy = Math.round((set.totalHours - total) * 100) / 100;
    rows.push({
      id: "total",
      group: "targets",
      label: `${set.totalHours} hours in total`,
      ready: shortBy <= 0,
      summary: shortBy <= 0 ? `Met: ${total} hours logged` : `${total} hours logged, ${shortBy} short`,
      entryIds: entries.map((entry) => entry.id),
      action: shortBy <= 0 ? null : { label: "Log an activity", href: `/cme/new?year=${set.year}` },
    });
  }

  for (const requirement of set.requirements) {
    const status = evaluateRequirement(requirement, entries);
    rows.push({
      id: `requirement-${requirement.id}`,
      group: "targets",
      label: requirement.label,
      ready: status.met,
      summary: status.summary,
      entryIds: contributingEntries(requirement, entries).map((entry) => entry.id),
      action: status.met ? null : requirementAction(requirement, set.year),
    });
  }

  // Evidence counts are only known when the loader supplied them; an entry with
  // no count was never measured, so it is not reported as missing evidence.
  const noEvidence = entries.filter((entry) => entry.evidenceCount === 0);
  rows.push({
    id: "evidence",
    group: "records",
    label: "Evidence kept for each activity",
    ready: noEvidence.length === 0,
    summary:
      noEvidence.length === 0
        ? "Every activity has a certificate or other evidence attached"
        : `${activities(noEvidence.length)} with no evidence attached`,
    entryIds: noEvidence.map((entry) => entry.id),
    action: noEvidence.length === 0 ? null : { label: "Show them", href: `/cme/log?year=${set.year}&fix=evidence` },
  });

  const noReflection = entries.filter((entry) => entry.reflection.trim() === "");
  rows.push({
    id: "reflection",
    group: "records",
    label: "A reflection on each activity",
    ready: noReflection.length === 0,
    summary:
      noReflection.length === 0
        ? "Every activity has a reflection"
        : `${activities(noReflection.length)} with no reflection yet`,
    entryIds: noReflection.map((entry) => entry.id),
    action: noReflection.length === 0 ? null : { label: "Show them", href: `/cme/log?year=${set.year}&fix=reflection` },
  });

  const notCopied = entries.filter((entry) => !entry.transcribed);
  rows.push({
    id: "copied",
    group: "records",
    label: "Copied to your CPD home",
    ready: notCopied.length === 0,
    summary:
      notCopied.length === 0 ? "Every activity is marked as copied" : `${activities(notCopied.length)} not yet copied`,
    entryIds: notCopied.map((entry) => entry.id),
    action: notCopied.length === 0 ? null : { label: "Copy them now", href: `/cme/log?year=${set.year}&copy=todo` },
  });

  return { rows, readyCount: rows.filter((row) => row.ready).length };
}
