import { withTeachingApi } from "@/lib/teaching/api";
import { teachingDepthViewSchema } from "@/lib/teaching/depth-model";
import {
  readCpdReview,
  readFeedbackOpen,
  readPendingConfirmations,
  readSupervisionViews,
  readTeach,
} from "@/lib/teaching/depth-repository";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

/**
 * The reader's own depth reads across every service they belong to (and, for supervision, the
 * services they left in the last 90 days, read-only). No demo option: demo mode reads depth-demo.ts.
 */
export async function GET(request: Request) {
  return withTeachingApi(request, async (client, ownerId) => {
    const { view } = parseRequestQuery(request, teachingDepthViewSchema);
    switch (view) {
      case "supervision":
        return { pairings: await readSupervisionViews(client, ownerId, new Date(), { includeLeft: true }) };
      case "pending":
        return readPendingConfirmations(client, ownerId);
      case "teach":
        return readTeach(client, ownerId);
      case "feedback-open":
        return readFeedbackOpen(client, ownerId);
      case "cpd-review":
        return readCpdReview(client, ownerId);
    }
  });
}
