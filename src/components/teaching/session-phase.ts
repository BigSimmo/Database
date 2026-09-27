import type { SessionSummary } from "@/lib/teaching/model";

/**
 * Which action a session offers now. The windows are the server's: check-in
 * from 15 minutes before the start to 15 minutes after the end, and "Check in
 * without code" from the start to 7 days after the end. The server decides;
 * a wrong phone clock costs a refused tap, never a wrong record.
 */
export type SessionPhase = "cancelled" | "upcoming" | "checkin" | "self" | "closed";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function sessionPhase(session: Pick<SessionSummary, "status" | "startsAt" | "endsAt">, now: Date): SessionPhase {
  if (session.status === "cancelled") return "cancelled";
  const start = Date.parse(session.startsAt);
  const end = Date.parse(session.endsAt);
  const time = now.getTime();
  if (time < start - 15 * MINUTE) return "upcoming";
  if (time <= end + 15 * MINUTE) return "checkin";
  if (time <= end + 7 * DAY) return "self";
  return "closed";
}
