import { addDays } from "@/lib/calendar/calendar-event";
import { PublicApiError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { fetchVisibleOnCallEntries } from "@/lib/on-call/repository";
import type { createAdminClient } from "@/lib/supabase/admin";
import { withTeachingApi } from "@/lib/teaching/api";
import { demoTeachingLogbook, demoTeachingSessionDetail, demoTeachingWeek } from "@/lib/teaching/demo-programme";
import {
  teachingOverviewQuerySchema,
  type SessionSummary,
  type TeachingOverviewQuery,
  type TeachingWeekResponse,
} from "@/lib/teaching/model";
import { relocatedOnCallSessions } from "@/lib/teaching/relocated";
import { fetchTeachingUnloggedCount, readLogbook, readSession, readWeek } from "@/lib/teaching/repository";
import { perthToday } from "@/lib/teaching/time";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

type AdminClient = ReturnType<typeof createAdminClient>;
type Range = { from: string; to: string };

function notInProgramme(): PublicApiError {
  return new PublicApiError("This session isn't available.", 404, { code: "teaching_not_found" });
}

/** No dates: the seven days from today in Perth. */
function weekRange(query: TeachingOverviewQuery): Range {
  if (query.from && query.to) return { from: query.from, to: query.to };
  const from = perthToday();
  return { from, to: addDays(from, 6) };
}

/**
 * The doctor's own On Call teaching list (spec §8 "Relocation"). A failure here never hides
 * Teaching's own week: the list is left out and the page says it could not be loaded.
 */
async function relocatedFor(
  client: AdminClient,
  ownerId: string,
  range: Range,
): Promise<{ relocated: SessionSummary[]; relocatedUnavailable: boolean }> {
  try {
    const entries = await fetchVisibleOnCallEntries(client, ownerId, { section: "education" });
    return { relocated: relocatedOnCallSessions(entries, range.from, range.to), relocatedUnavailable: false };
  } catch (error) {
    logger.warn("Teaching could not read the On Call teaching list", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { relocated: [], relocatedUnavailable: true };
  }
}

async function live(client: AdminClient, ownerId: string, query: TeachingOverviewQuery): Promise<unknown> {
  switch (query.view) {
    case "week": {
      const range = weekRange(query);
      const [week, relocated] = await Promise.all([
        readWeek(client, ownerId, range),
        relocatedFor(client, ownerId, range),
      ]);
      return { ...week, ...relocated } satisfies TeachingWeekResponse;
    }
    case "logbook":
      return { attendance: await readLogbook(client, ownerId) };
    case "unlogged-count":
      return { count: await fetchTeachingUnloggedCount(client, ownerId) };
    case "session":
      if (!query.occurrenceId) throw notInProgramme();
      return readSession(client, ownerId, null, query.occurrenceId);
  }
}

/** Demo mode: the made-up programme, with no sign-in and no database. */
function demo(query: TeachingOverviewQuery): unknown {
  switch (query.view) {
    case "week":
      return {
        ...demoTeachingWeek(weekRange(query)),
        relocated: [],
        relocatedUnavailable: false,
      } satisfies TeachingWeekResponse;
    case "logbook":
      return { attendance: demoTeachingLogbook() };
    case "unlogged-count":
      return { count: demoTeachingLogbook().filter((row) => row.cpdEntryId === null).length };
    case "session": {
      const session = query.occurrenceId ? demoTeachingSessionDetail(query.occurrenceId) : null;
      if (!session) throw notInProgramme();
      return session;
    }
  }
}

export async function GET(request: Request) {
  return withTeachingApi(
    request,
    (client, ownerId) => live(client, ownerId, parseRequestQuery(request, teachingOverviewQuerySchema)),
    { demo: () => demo(parseRequestQuery(request, teachingOverviewQuerySchema)) },
  );
}
