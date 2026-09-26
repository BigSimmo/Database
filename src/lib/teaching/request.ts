import { z } from "zod";

import { PublicApiError } from "@/lib/http";
import { parseJsonBody } from "@/lib/validation/body";

const GENERIC_MESSAGE = "Check the details and try again.";

/**
 * Teaching's schema messages are plain sentences ending in a full stop ("Remove the passcode
 * from this link. Share passcodes another way."). Zod's built-in English ("Too small: expected
 * string to have >=3 characters", "Invalid UUID") never ends in one, so it becomes a generic line.
 */
export function plainTeachingIssue(issues: readonly { message: string }[]): string {
  return issues.find((issue) => /^[A-Z][^{}<>]*\.$/.test(issue.message))?.message ?? GENERIC_MESSAGE;
}

/** A JSON body, size-limited as everywhere else, with a doctor-readable message when a field is wrong. */
export async function parseTeachingBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const body = await parseJsonBody(request, z.unknown());
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new PublicApiError(plainTeachingIssue(parsed.error.issues), 400, { code: "teaching_invalid_request" });
  return parsed.data;
}
