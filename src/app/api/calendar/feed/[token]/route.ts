import { allowRateLimitInMemoryFallbackOnUnavailable, consumeSubjectApiRateLimit } from "@/lib/api-rate-limit";
import { calendarFeedEvents, calendarFeedOwner } from "@/lib/calendar/feed-repository";
import { parseCalendarFeedToken } from "@/lib/calendar/feed-token";
import { toIcs } from "@/lib/calendar/ics";
import { isDemoMode } from "@/lib/env";
import { logger } from "@/lib/logger";
import { anonymousApiSubjectKey } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * A private calendar subscription, read by Google, Outlook or Apple Calendar
 * with no session. The link is the credential. Every failure — malformed,
 * unknown or turned-off link — is the same plain 404, so the response never
 * tells a guesser anything. See `@/lib/calendar/feed-repository` for what a
 * feed carries.
 */

const FEED_HEADERS = {
  "Cache-Control": "private, max-age=900",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { ...FEED_HEADERS, "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  if (isDemoMode()) return notFound();
  const { token: segment } = await context.params;
  const token = parseCalendarFeedToken(segment);
  if (!token) return notFound();
  try {
    const supabase = createAdminClient();
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "anonymous", subjectKey: anonymousApiSubjectKey(request) },
      bucket: "cme",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return new Response("Too many requests", {
        status: 429,
        headers: { ...FEED_HEADERS, "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" },
      });
    }
    const ownerId = await calendarFeedOwner(supabase, token);
    if (!ownerId) return notFound();
    const now = new Date();
    const events = await calendarFeedEvents(supabase, ownerId, now);
    return new Response(toIcs(events, { name: "PsychSift", now, refreshHours: 4 }), {
      status: 200,
      headers: {
        ...FEED_HEADERS,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="psychsift.ics"',
      },
    });
  } catch (error) {
    logger.error("calendar feed failed", { error: error instanceof Error ? error.message : String(error) });
    return new Response("Calendar unavailable", {
      status: 503,
      headers: { ...FEED_HEADERS, "Cache-Control": "no-store" },
    });
  }
}
