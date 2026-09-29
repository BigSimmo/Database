import { withTeachingApi } from "@/lib/teaching/api";
import { teachingCpdBodySchema } from "@/lib/teaching/model";
import { saveTeachingCpdEntry } from "@/lib/teaching/repository";
import { parseTeachingBody } from "@/lib/teaching/request";

export const runtime = "nodejs";

/** The session page's single "Log to CPD". The owner is the session's user, never the body's. */
export async function POST(request: Request) {
  return withTeachingApi(request, async (client, ownerId) =>
    saveTeachingCpdEntry(client, ownerId, await parseTeachingBody(request, teachingCpdBodySchema)),
  );
}
