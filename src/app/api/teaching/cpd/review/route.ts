import { withTeachingApi } from "@/lib/teaching/api";
import { cpdReviewBodySchema } from "@/lib/teaching/depth-model";
import { saveCpdReview } from "@/lib/teaching/depth-repository";
import { parseTeachingBody } from "@/lib/teaching/request";

export const runtime = "nodejs";

/** The weekly CPD review's one "Log N sessions" tap. Nothing is saved without it (spec §9). */
export async function POST(request: Request) {
  return withTeachingApi(request, async (client, ownerId) =>
    saveCpdReview(client, ownerId, await parseTeachingBody(request, cpdReviewBodySchema)),
  );
}
