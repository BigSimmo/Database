import { inferShiftKind, SHIFT_KIND_LABEL } from "@/lib/roster/shift-kind";
import { addDaysToDate, formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import type { RosterDisplayShift } from "@/lib/roster/team/team-view";

/**
 * Plain text of the doctor's own shifts for the next 7 or 14 days, to paste
 * into a message. The input is `useRosterShifts().shifts`: the reader's own
 * rows plus their own shifts on a confirmed team's roster (`mergeMyShifts`
 * keeps only rows whose `userId` is the reader), so no colleague appears.
 * Only kind, Perth times and place are shared — never titles or notes.
 */

export type ShareShift = Pick<RosterDisplayShift, "startsAt" | "endsAt" | "title" | "kind" | "location" | "workplace">;

export type ShareOptions = {
  readonly from: Date;
  readonly days: 7 | 14;
  readonly name?: string;
};

const DAY_MS = 86_400_000;

function dayGap(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** `08:00–17:00`, or `21:30–08:00 +1` for a shift that ends on a later Perth day. */
function timeRange(shift: ShareShift): string {
  const start = perthTimeOf(shift.startsAt);
  const end = perthTimeOf(shift.endsAt);
  const later = dayGap(perthDateOf(shift.startsAt), perthDateOf(shift.endsAt)) - (end === "00:00" ? 1 : 0);
  return `${start}–${end}${later > 0 ? ` +${later}` : ""}`;
}

/** `Sat 4 – Sun 5 Oct`, or `Tue 30 Sep – Wed 1 Oct` across a month. */
function offSpan(first: string, last: string): string {
  if (first === last) return formatPerthDay(first);
  const start = formatPerthDay(first);
  const end = formatPerthDay(last);
  const startParts = start.split(" ");
  return first.slice(0, 7) === last.slice(0, 7) ? `${startParts[0]} ${startParts[1]} – ${end}` : `${start} – ${end}`;
}

function shiftLine(date: string, shift: ShareShift): string {
  const kind = shift.kind ?? inferShiftKind(shift);
  const place = (shift.location ?? shift.workplace ?? "").trim();
  return [formatPerthDay(date), `${SHIFT_KIND_LABEL[kind]} ${timeRange(shift)}`, place].filter(Boolean).join(" · ");
}

export function rosterShareText(shifts: readonly ShareShift[], { from, days, name }: ShareOptions): string {
  const first = perthDateOf(from);
  const last = addDaysToDate(first, days - 1);
  const byDate = new Map<string, ShareShift[]>();
  for (const shift of shifts) {
    const date = perthDateOf(shift.startsAt);
    if (date < first || date > last) continue;
    const list = byDate.get(date);
    if (list) list.push(shift);
    else byDate.set(date, [shift]);
  }

  const owner = name?.trim() ? `Shifts for ${name.trim()}` : "My shifts";
  const lines = [`${owner}, ${formatPerthDay(first)} – ${formatPerthDay(last)}`];
  let offStart: string | null = null;
  let offEnd: string | null = null;
  const flushOff = () => {
    if (offStart && offEnd) lines.push(`${offSpan(offStart, offEnd)} · Off`);
    offStart = offEnd = null;
  };
  for (let index = 0; index < days; index += 1) {
    const date = addDaysToDate(first, index);
    const list = byDate.get(date);
    if (!list) {
      offStart ??= date;
      offEnd = date;
      continue;
    }
    flushOff();
    list
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .forEach((shift) => lines.push(shiftLine(date, shift)));
  }
  flushOff();
  return lines.join("\n");
}
