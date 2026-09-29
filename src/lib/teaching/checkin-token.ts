import { CHECKIN_TOKEN_PATTERN, TEACHING_SECRET_PATTERN, type CheckinStream } from "@/lib/teaching/model";

/**
 * Check-in tokens and secrets as the browser sees them. Pure: nothing here checks a
 * MAC, because only the database holds the occurrence secret. Parsing first lets a
 * route refuse a malformed scan without touching the database or the rate limiter.
 */

export type ParsedCheckinToken = { occurrenceId: string; stream: CheckinStream; window: number };

/** 32 + 1 + 12 + 32. */
const MAX_TOKEN_LENGTH = 77;

export function parseCheckinToken(token: unknown): ParsedCheckinToken | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  const match = CHECKIN_TOKEN_PATTERN.exec(token);
  if (!match) return null;
  const [, hex, streamLetter, windowDigits] = match;
  const window = Number(windowDigits);
  if (!Number.isSafeInteger(window)) return null;
  return {
    occurrenceId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    stream: streamLetter === "r" ? "room" : "teams",
    window,
  };
}

/** Where a QR code points. */
export function checkinScanPath(token: string): string {
  return `/teaching/c/${token}`;
}

/** The display-only code screen for a presenter's or organiser's display link. */
export function teachingDisplayPath(secret: string): string {
  return `/teaching/display/${secret}`;
}

export function isTeachingSecret(value: unknown): value is string {
  return typeof value === "string" && TEACHING_SECRET_PATTERN.test(value);
}
