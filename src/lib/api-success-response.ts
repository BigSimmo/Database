import type { z } from "zod";

/**
 * Parses a successful JSON response without trusting the server-side TypeScript
 * contract at the network boundary. The caller supplies a user-safe message so
 * validation details (and potentially sensitive response fragments) never reach
 * the UI.
 */
export async function parseApiSuccessResponse<Schema extends z.ZodTypeAny>(
  response: Response,
  schema: Schema,
  invalidMessage: string,
): Promise<z.infer<Schema>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(invalidMessage);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error(invalidMessage);
  return parsed.data;
}
