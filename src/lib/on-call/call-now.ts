import { onCallDetailsSchemaFor, type OnCallEntry, type OnCallStepHours } from "@/lib/on-call/entry-model";
import { isOnCallOutOfHours } from "@/lib/on-call/home-modules";
import { isWaPublicHoliday } from "@/lib/on-call/wa-public-holidays";

/**
 * "Who do I call now?" — one playbook scenario's escalation ladder, arranged for
 * this moment.
 *
 * Steps marked for the other half of the day are moved below the ones that
 * apply now, never removed: the rule for "now" is an approximation (weekday
 * hours plus WA public holidays), and a hidden step is a missed call if it is
 * wrong. Steps keep their own order within each group.
 */

export type OnCallCallNowStep = {
  readonly order: number;
  readonly whoToCall: string;
  readonly when: string;
  readonly phone: string | null;
  readonly hours: OnCallStepHours;
  /** False when the step is marked for the other half of the day. */
  readonly appliesNow: boolean;
};

export type OnCallCallNowPeriod = "in-hours" | "after-hours";

export function onCallCallNowPeriod(now: Date): OnCallCallNowPeriod {
  return isOnCallOutOfHours(now) || isWaPublicHoliday(now) ? "after-hours" : "in-hours";
}

export function onCallCallNowSteps(entry: OnCallEntry, now: Date): readonly OnCallCallNowStep[] {
  if (entry.section !== "playbook") return [];
  const parsed = onCallDetailsSchemaFor("playbook").safeParse(entry.details);
  if (!parsed.success) return [];
  const period = onCallCallNowPeriod(now);
  const steps = (
    parsed.data as {
      escalationSteps: { order: number; whoToCall: string; when: string; phone?: string; hours?: OnCallStepHours }[];
    }
  ).escalationSteps
    .map((step) => {
      const hours = step.hours ?? "any";
      return {
        order: step.order,
        whoToCall: step.whoToCall,
        when: step.when,
        phone: step.phone ?? null,
        hours,
        appliesNow: hours === "any" || hours === period,
      };
    })
    .sort((a, b) => a.order - b.order);
  return [...steps.filter((step) => step.appliesNow), ...steps.filter((step) => !step.appliesNow)];
}

/** Playbook scenarios in the owner's order, for the picker. */
export function onCallCallNowScenarios(entries: readonly OnCallEntry[]): readonly OnCallEntry[] {
  return entries
    .filter((entry) => entry.section === "playbook")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}
