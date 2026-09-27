import type { HandbookItem } from "@/lib/on-call/handbook-items";
import { serviceCoverSchema, serviceStepSchema } from "@/lib/on-call/service-model";
import { onCallHospitalPeriod, type OnCallHospitalHours, type OnCallLadder } from "@/lib/on-call/now-rows";
import { perthTimeOf } from "@/lib/roster/shifts/perth-time";

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const distance = (a: number, b: number) => Math.min((a - b + 1440) % 1440, (b - a + 1440) % 1440);
/** Both roles remain visible for 15 minutes either side of a recorded changeover. */
export function nearHospitalChangeover(hours: OnCallHospitalHours | null, now: Date): boolean {
  if (!hours || onCallHospitalPeriod(hours, now) === null) return false;
  const at = minutes(perthTimeOf(now));
  return [hours.afterHoursFrom, hours.afterHoursUntil].some((time) => distance(at, minutes(time)) <= 15);
}

export function handbookLadders(
  items: readonly HandbookItem[],
  hours: OnCallHospitalHours | null,
  now: Date,
): OnCallLadder[] {
  const period = onCallHospitalPeriod(hours, now);
  return items
    .filter((item) => item.section === "playbook" && item.kind !== "operational" && item.sources.length > 0)
    .flatMap((item) => {
      const steps = item.steps?.map((step) => serviceStepSchema.safeParse(step));
      if (!steps?.length || steps.some((step) => !step.success)) return [];
      const ordered = steps.flatMap((step) => (step.success ? [step.data] : [])).sort((a, b) => a.order - b.order);
      // Keep the hospital's order. Unknown times and changeover show both sets explicitly.
      const visible =
        !period || nearHospitalChangeover(hours, now)
          ? ordered
          : ordered.filter((step) => !step.hours || step.hours === "any" || step.hours === period);
      return [
        {
          id: item.id,
          title: item.title,
          steps: visible.map((step) => ({
            ...step,
            phone: step.phone ?? null,
            hours: step.hours ?? "any",
            appliesNow: !period || !step.hours || step.hours === "any" || step.hours === period,
          })),
        },
      ];
    });
}

export function currentCover(items: readonly HandbookItem[], now: Date): HandbookItem[] {
  const at = minutes(perthTimeOf(now));
  return items.flatMap((item) => {
    if (item.section !== "cover" || item.kind === "operational" || item.sources.length === 0) return [];
    const result = serviceCoverSchema.safeParse(item.cover);
    if (!result.success) return [];
    const cover = result.data;
    const start = minutes(cover.window.start),
      end = minutes(cover.window.end);
    const active = start < end ? at >= start && at < end : at >= start || at < end;
    if (!active && distance(at, start) > 15 && distance(at, end) > 15) return [];
    // A title or free text may contain a name. The cover reader uses only the constrained grade.
    const label = cover.grade[0].toUpperCase() + cover.grade.slice(1);
    return [
      { ...item, title: label, parsed: { ...item.parsed, prefix: null, label, team: cover.team ?? null }, cover },
    ];
  });
}
