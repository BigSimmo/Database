import { fetchRosterRead } from "@/components/roster/use-roster-team";
import { addDaysToDate, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { isoWeekday } from "@/lib/roster/team/cover";
import type { RosterAssignment, RosterOverview } from "@/lib/roster/team/model";

/**
 * The fresh read behind the swap flow's "who" step and "Who can cover?": the
 * team's shifts in the weeks around one shift, plus the overview that carries
 * my grade and the team's settings. Advice is worked out from it on the
 * phone; the server rechecks everything when a request is sent.
 */

export type SwapOptionsRead = { assignments: RosterAssignment[]; overview: RosterOverview; readAt: Date };

export type SwapOptionsLoad = { ok: true; fresh: SwapOptionsRead } | { ok: false; code: string; message: string };

/** The Monday-to-Sunday weeks around a shift, about eight of them, inside the server's read limit. */
export function swapReadWindow(shiftStart: string | Date, now: Date): { from: string; to: string } {
  const today = perthDateOf(now);
  const shiftDate = perthDateOf(shiftStart);
  let anchor = shiftDate < today ? shiftDate : today;
  if (shiftDate > addDaysToDate(today, 48)) anchor = addDaysToDate(shiftDate, -7);
  const from = addDaysToDate(anchor, 1 - isoWeekday(anchor));
  return { from, to: addDaysToDate(from, 55) };
}

/** Both reads at once; the first one that fails is the one reported. */
export async function loadSwapOptionsRead(
  serviceId: string,
  shiftStart: string | Date,
  now: Date = new Date(),
): Promise<SwapOptionsLoad> {
  const [assignments, overview] = await Promise.all([
    fetchRosterRead(serviceId, "assignments", swapReadWindow(shiftStart, now)),
    fetchRosterRead(serviceId, "overview"),
  ]);
  if (!assignments.ok) return { ok: false, code: assignments.code, message: assignments.message };
  if (!overview.ok) return { ok: false, code: overview.code, message: overview.message };
  return {
    ok: true,
    fresh: { assignments: assignments.data.assignments, overview: overview.data, readAt: assignments.readAt },
  };
}
