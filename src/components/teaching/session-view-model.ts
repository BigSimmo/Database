import { perthDateKey, perthTime, shortDayLabel, timeRange } from "@/components/teaching/teaching-dates";
import type { SessionDetailRead } from "@/components/teaching/teaching-reads";

/* Pure shaping for the session page and the code screens. Perth wall-clock, 24-hour. */

const OCCURRENCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MINUTE = 60_000;

const REASONS: Record<string, string> = {
  presenter_unavailable: "Presenter unavailable",
  room_change: "Room change",
  clinical_pressure: "Clinical pressure",
  public_holiday: "Public holiday",
  rescheduled: "Rescheduled",
  other: "Other",
};

export function isOccurrenceId(value: string): boolean {
  return OCCURRENCE_ID.test(value);
}

export function sessionWhen(detail: { startsAt: string; endsAt: string }): string {
  return `${shortDayLabel(perthDateKey(detail.startsAt))} · ${timeRange(detail.startsAt, detail.endsAt)}`;
}

/** "Cancelled · Room change", "Moved from 12:30 · Presenter unavailable", or null for a session that runs as planned. */
export function changeLine(detail: SessionDetailRead): string | null {
  const reason = detail.changeReason ? (REASONS[detail.changeReason] ?? null) : null;
  const head =
    detail.status === "cancelled"
      ? "Cancelled"
      : detail.status === "moved"
        ? detail.previousStartsAt
          ? `Moved from ${perthTime(detail.previousStartsAt)}`
          : "Moved"
        : null;
  return head ? [head, reason].filter(Boolean).join(" · ") : null;
}

/** Check-in opens 15 minutes before the start (the server's window). */
export function checkinOpens(detail: { startsAt: string }): string {
  return perthTime(new Date(Date.parse(detail.startsAt) - 15 * MINUTE).toISOString());
}

/** Check-in closes by itself 15 minutes after the end; there is no manual close (master plan R11). */
export function checkinCloses(detail: { endsAt: string }): string {
  return perthTime(new Date(Date.parse(detail.endsAt) + 15 * MINUTE).toISOString());
}

export function formatTypedCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

export function typedCodeDigits(raw: string): string | null {
  const digits = raw.replace(/\s/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}
