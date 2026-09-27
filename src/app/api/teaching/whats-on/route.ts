import { addDays } from "@/lib/calendar/calendar-event";
import { withTeachingApi } from "@/lib/teaching/api";
import { demoWhatsOnSessions } from "@/lib/teaching/demo-programme";
import { teachingWhatsOnActionSchema, teachingWhatsOnQuerySchema, type WhatsOnRead } from "@/lib/teaching/model";
import { readWhatsOn, teachingWhatsOnMutation } from "@/lib/teaching/repository";
import { parseTeachingBody } from "@/lib/teaching/request";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

/** Demo mode (master plan R8): the demo service and the two made-up services open to the demo health service. */
function demoRead(request: Request): WhatsOnRead {
  const { weekStart } = parseRequestQuery(request, teachingWhatsOnQuerySchema);
  return { healthServices: ["demo"], sessions: demoWhatsOnSessions({ from: weekStart, to: addDays(weekStart, 6) }) };
}

export async function GET(request: Request) {
  return withTeachingApi(
    request,
    (client, ownerId) => {
      const { weekStart } = parseRequestQuery(request, teachingWhatsOnQuerySchema);
      return readWhatsOn(client, ownerId, weekStart);
    },
    { demo: () => demoRead(request) },
  );
}

/** Personal writes (add to my week, "I was there", bookmarks). Refused in demo mode, like every Teaching write. */
export async function POST(request: Request) {
  return withTeachingApi(request, async (client, ownerId) => {
    const input = await parseTeachingBody(request, teachingWhatsOnActionSchema);
    return teachingWhatsOnMutation(client, ownerId, input);
  });
}
