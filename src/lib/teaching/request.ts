import { z } from "zod";

import { PublicApiError } from "@/lib/http";
import { plainTeachingIssue } from "@/lib/teaching/model";
import { parseJsonBody } from "@/lib/validation/body";

// Defined in the client-safe model so the import preview (import-sheet.ts) shares it; re-exported here.
export { plainTeachingIssue };

/** A JSON body, size-limited as everywhere else, with a doctor-readable message when a field is wrong. */
export async function parseTeachingBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const body = await parseJsonBody(request, z.unknown());
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new PublicApiError(plainTeachingIssue(parsed.error.issues), 400, { code: "teaching_invalid_request" });
  return parsed.data;
}
