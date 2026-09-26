import "server-only";

import { calendarFeedPath, generateCalendarFeedToken, hashCalendarFeedToken } from "@/lib/calendar/feed-token";
import { cmeDeadlineEvents, cmeRoutineEvents } from "@/lib/cme/calendar-events";
import { cpdYearOf, perthCalendarDate } from "@/lib/cme/cpd-year";
import { fetchOwnerCmeRoutines, fetchOwnerCmeYear } from "@/lib/cme/repository";
import type { CalendarEvent } from "@/lib/calendar/calendar-event";
import { onCallTeachingEvents } from "@/lib/on-call/calendar-events";
import { fetchVisibleOnCallEntries } from "@/lib/on-call/repository";
import { logger } from "@/lib/logger";
import {
  applyReminderAlarms,
  DEFAULT_REMINDER_SETTINGS,
  normalizeReminderSettings,
  type ReminderSettings,
} from "@/lib/reminders/settings";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/**
 * The private calendar subscription behind `/api/calendar/feed/<token>.ics`.
 *
 * What a feed carries is deliberately narrow, because anyone holding the link
 * can read it: CME year deadlines and routines coming due, and On Call teaching
 * sessions the owner can see. Never logged CME activities (the owner's own
 * learning, and already in the past), never personal On Call entries, never
 * compliance expiry dates (not stored centrally), never anything about patients.
 *
 * Events carry a calendar alarm only when the owner turned one on in Settings,
 * Notifications, Reminders. Their settings are read from their own preferences
 * row; if that read fails the feed is still served, just without alarms.
 */

/**
 * The feed owner's reminder settings, from their own preferences row only.
 * A failed read returns the defaults (no alarms) rather than failing the feed:
 * a missing alarm is the conservative way for this to go wrong.
 */
export async function fetchOwnerReminderSettings(supabase: AdminClient, ownerId: string): Promise<ReminderSettings> {
  if (!ownerId) throw new Error("Missing calendar feed owner.");
  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const preferences = data?.preferences as { reminders?: unknown } | null | undefined;
    return normalizeReminderSettings(preferences?.reminders);
  } catch (error) {
    logger.warn("calendar feed reminder settings unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function ownerHasCalendarFeed(supabase: AdminClient, ownerId: string): Promise<boolean> {
  if (!ownerId) throw new Error("Missing calendar feed owner.");
  const { data, error } = await supabase
    .from("calendar_feed_tokens")
    .select("owner_id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Make a new link, replacing any old one. Returns the path; the token is never stored. */
export async function rotateOwnerCalendarFeed(supabase: AdminClient, ownerId: string): Promise<string> {
  if (!ownerId) throw new Error("Missing calendar feed owner.");
  const token = generateCalendarFeedToken();
  const { error } = await supabase.rpc("calendar_feed_rotate", {
    p_owner_id: ownerId,
    p_token_hash: hashCalendarFeedToken(token),
  });
  if (error) throw error;
  return calendarFeedPath(token);
}

export async function revokeOwnerCalendarFeed(supabase: AdminClient, ownerId: string): Promise<void> {
  if (!ownerId) throw new Error("Missing calendar feed owner.");
  const { error } = await supabase.rpc("calendar_feed_revoke", { p_owner_id: ownerId });
  if (error) throw error;
}

/** The owner a presented token belongs to, or null (unknown and turned-off look the same). */
export async function calendarFeedOwner(supabase: AdminClient, token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("calendar_feed_owner", {
    p_token_hash: hashCalendarFeedToken(token),
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

export async function calendarFeedEvents(supabase: AdminClient, ownerId: string, now: Date): Promise<CalendarEvent[]> {
  const year = cpdYearOf(now);
  const [thisYear, nextYear, routines, teaching, reminders] = await Promise.all([
    fetchOwnerCmeYear(supabase, ownerId, year),
    fetchOwnerCmeYear(supabase, ownerId, year + 1),
    fetchOwnerCmeRoutines(supabase, ownerId),
    fetchVisibleOnCallEntries(supabase, ownerId, { section: "education" }),
    fetchOwnerReminderSettings(supabase, ownerId),
  ]);
  const events = [
    ...(thisYear ? cmeDeadlineEvents(thisYear) : []),
    ...(nextYear ? cmeDeadlineEvents(nextYear) : []),
    ...cmeRoutineEvents(routines),
    ...onCallTeachingEvents(
      teaching.filter((entry) => !entry.isPersonal),
      perthCalendarDate(now),
    ),
  ];
  return applyReminderAlarms(events, reminders, now);
}
