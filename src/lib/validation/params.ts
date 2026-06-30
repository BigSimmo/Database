import { z } from "zod";
import { parseSchema } from "@/lib/validation/http";

export function parseRouteParams<TSchema extends z.ZodType>(
  params: Record<string, unknown>,
  schema: TSchema,
  message = "Invalid route parameters.",
): z.infer<TSchema> {
  return parseSchema(schema, params, message, "invalid_route_params");
}
