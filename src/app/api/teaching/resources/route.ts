import { withTeachingApi } from "@/lib/teaching/api";
import { demoTeachingResources } from "@/lib/teaching/demo-resources";
import { teachingResourcesQuerySchema } from "@/lib/teaching/model";
import { teachingResourcesRead } from "@/lib/teaching/repository";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

/**
 * Materials for the week or one session, or a collection. There is no search here: the page's
 * filter box filters the loaded list on the device and never calls the server.
 */
export async function GET(request: Request) {
  return withTeachingApi(
    request,
    (client, ownerId) =>
      teachingResourcesRead(client, ownerId, parseRequestQuery(request, teachingResourcesQuerySchema)),
    // Master plan R8: the demo's made-up collections and resources.
    { demo: () => demoTeachingResources(parseRequestQuery(request, teachingResourcesQuerySchema)) },
  );
}
