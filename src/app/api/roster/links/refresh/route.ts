import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import { CalendarLinkError, fetchCalendarLink } from "@/lib/roster/calendar-link-fetch";
import {
  fetchCalendarLinkForRefresh,
  fetchCalendarLinksDueForRefresh,
  recordCalendarLinkRefresh,
  refreshRosterCalendarLinksSchema,
  toStoredLinkReason,
  type RosterCalendarLinkForRefresh,
} from "@/lib/roster/calendar-links";
import { inferShiftKind } from "@/lib/roster/shift-kind";
import { parseRosterIcs } from "@/lib/roster/shifts/parse-ics";
import { addDaysToDate, perthDateOf, perthWallToIso } from "@/lib/roster/shifts/perth-time";
import { replaceOwnerShifts } from "@/lib/roster/shifts/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * Refreshes a doctor's calendar link (or every link due one): fetches the
 * feed through the guarded fetcher, keeps only the useful date window, and
 * saves it exactly like any other import. The address itself is read only
 * here, and nothing about it — least of all its query string — is ever put
 * in the response or an error.
 */

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

/** How long a link may go unrefreshed before it is due again. */
const REFRESH_DUE_AFTER_MS = 6 * 60 * 60 * 1000;
/** How far back and forward a refresh keeps shifts for. A long-lived feed lists years of history first. */
const WINDOW_DAYS_BACK = 14;
const WINDOW_MONTHS_FORWARD = 12;

function demoRefusal() {
  return publicErrorResponse("Demo mode cannot refresh a calendar link. Sign in to add yours.", 400, {
    code: "demo_mode_unavailable",
  });
}

function addMonthsToDate(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1 + months, day)).toISOString().slice(0, 10);
}

/** Whether the parse hit the per-import shift cap: more shifts existed in the window than one import may carry. */
function hitShiftCap(notes: readonly string[]): boolean {
  return notes.some((note) => /were left out\.$/.test(note));
}

type RefreshResult = { readonly id: string; readonly ok: boolean; readonly reason?: string };

async function refreshOne(
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string,
  link: RosterCalendarLinkForRefresh,
  window: { from: string; to: string; startDate: string; endDate: string },
): Promise<RefreshResult> {
  let text: string;
  try {
    text = await fetchCalendarLink(link.url);
  } catch (error) {
    const reason = error instanceof CalendarLinkError ? error.reason : "http_error";
    const stored = toStoredLinkReason(reason);
    await recordCalendarLinkRefresh(supabase, ownerId, link.id, { ok: false, reason: stored });
    return { id: link.id, ok: false, reason: stored };
  }
  const parsed = parseRosterIcs(text, { from: window.from, to: window.to });
  if (hitShiftCap(parsed.notes)) {
    const stored = toStoredLinkReason("too_many_shifts");
    await recordCalendarLinkRefresh(supabase, ownerId, link.id, { ok: false, reason: stored });
    return { id: link.id, ok: false, reason: stored };
  }
  await replaceOwnerShifts(supabase, ownerId, {
    format: "link",
    workplace: link.workplace,
    fileName: null,
    windowStart: window.startDate,
    windowEnd: window.endDate,
    // A calendar feed carries no kind, so each shift gets one here, the same way a file import does.
    shifts: parsed.shifts.map((shift) => ({ ...shift, kind: shift.kind ?? inferShiftKind(shift) })),
  });
  await recordCalendarLinkRefresh(supabase, ownerId, link.id, { ok: true });
  return { id: link.id, ok: true };
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return demoRefusal();
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "roster",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) return rateLimitJsonResponse("Too many requests. Try again shortly.", rateLimit);

    const body = await parseJsonBody(
      request,
      refreshRosterCalendarLinksSchema,
      "That refresh request could not be read.",
    );

    const links = body.id
      ? await fetchCalendarLinkForRefresh(supabase, user.id, body.id).then((link) => (link ? [link] : []))
      : await fetchCalendarLinksDueForRefresh(supabase, user.id, REFRESH_DUE_AFTER_MS);

    if (body.id && links.length === 0) {
      return publicErrorResponse("That calendar link could not be found.", 404, { code: "not_found" });
    }

    const today = perthDateOf(new Date());
    const startDate = addDaysToDate(today, -WINDOW_DAYS_BACK);
    const endDate = addDaysToDate(addMonthsToDate(today, WINDOW_MONTHS_FORWARD), -1);
    const from = perthWallToIso(startDate, "00:00")!;
    const to = perthWallToIso(addMonthsToDate(today, WINDOW_MONTHS_FORWARD), "00:00")!;
    const window = { from, to, startDate, endDate };

    const results: RefreshResult[] = [];
    for (const link of links) results.push(await refreshOne(supabase, user.id, link, window));

    return NextResponse.json({ results }, { headers: noStore });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
