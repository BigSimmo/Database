import "server-only";

import { z } from "zod";

import { addDays } from "@/lib/calendar/calendar-event";
import { logger } from "@/lib/logger";
import { sessionSummarySchema, type SessionSummary } from "@/lib/teaching/model";
import { isTeachingSetupPending } from "@/lib/teaching/repository";
import { perthToday } from "@/lib/teaching/time";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/** Recent sessions stay for a week, so a late cancellation still reaches calendars. */
export const TEACHING_FEED_DAYS_BEHIND = 7;
export const TEACHING_FEED_DAYS_AHEAD = 90;

const feedSchema = z.object({ sessions: z.array(sessionSummarySchema).max(2000) });

/**
 * The feed owner's Teaching sessions, from the teams where they turned on "Add to my calendar"
 * (`calendar.set`). The feed runs with no session, so this reads through `teaching_feed_events`
 * rather than `teaching_command`. Unknown keys are dropped by the schema, so a join link or a
 * presenter name can never reach the file.
 *
 * Before Teaching's database change is live there is nothing to show, so the feed carries on
 * without it. Any other failure throws, and the feed answers 503: calendar apps then keep their
 * last copy instead of deleting every Teaching session.
 */
export async function fetchTeachingFeedSessions(
  client: AdminClient,
  ownerId: string,
  now: Date,
): Promise<SessionSummary[]> {
  if (!ownerId) throw new Error("Missing calendar feed owner.");
  const today = perthToday(now);
  const { data, error } = await client.rpc("teaching_feed_events", {
    p_owner_id: ownerId,
    p_from: addDays(today, -TEACHING_FEED_DAYS_BEHIND),
    p_to: addDays(today, TEACHING_FEED_DAYS_AHEAD),
  });
  if (error) {
    if (isTeachingSetupPending(error)) {
      logger.warn("calendar feed: Teaching is not set up yet, so no Teaching sessions are included");
      return [];
    }
    throw new Error(`Teaching feed read failed: ${error.message}`);
  }
  const parsed = feedSchema.safeParse(data);
  if (!parsed.success) throw new Error("Teaching feed read returned an unexpected shape.");
  return parsed.data.sessions;
}
