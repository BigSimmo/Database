import { createHash, randomBytes } from "node:crypto";

/**
 * Private calendar subscription links.
 *
 * A link carries a 256-bit random token. Only its SHA-256 is stored
 * (`calendar_feed_tokens.token_hash`), so the link itself exists only in the
 * owner's calendar app and cannot be rebuilt from the database. The token is
 * base64url, so it sits in a URL path without escaping.
 */

const TOKEN_BYTES = 32;
/** 32 bytes of base64url, unpadded. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateCalendarFeedToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashCalendarFeedToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * The token from a feed path segment, or null when it cannot be one. Calendar
 * apps are happier with a URL that ends in `.ics`, so that suffix is allowed.
 */
export function parseCalendarFeedToken(segment: string): string | null {
  const token = segment.endsWith(".ics") ? segment.slice(0, -4) : segment;
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function calendarFeedPath(token: string): string {
  return `/api/calendar/feed/${token}.ics`;
}
