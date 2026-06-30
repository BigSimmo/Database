import { z } from "zod";
import { parseSchema } from "@/lib/validation/http";

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  message = "Invalid request body.",
): Promise<z.infer<TSchema>> {
  const body = await request.json().catch(() => null);
  return parseSchema(schema, body, message, "invalid_body");
}

export async function parseJsonBodyOrDefault<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  fallback: z.infer<TSchema>,
): Promise<z.infer<TSchema>> {
  const body = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : fallback;
}
