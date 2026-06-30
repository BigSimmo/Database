import { z } from "zod";
import { parseSchema } from "@/lib/validation/http";

type QueryIntegerOptions = {
  fallback: number;
  min: number;
  max: number;
};

export function queryInteger(options: QueryIntegerOptions) {
  return z
    .preprocess((value) => {
      if (value === undefined || value === null || value === "") return options.fallback;
      const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
      return Number.isFinite(parsed) ? parsed : options.fallback;
    }, z.number().int())
    .transform((value) => Math.min(options.max, Math.max(options.min, value)));
}

export function queryBoolean(options: { defaultValue: boolean }) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return options.defaultValue;
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    return options.defaultValue;
  }, z.boolean());
}

export function optionalQueryString(options: { maxLength?: number } = {}) {
  const textSchema =
    typeof options.maxLength === "number" ? z.string().max(options.maxLength).optional() : z.string().optional();
  return z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return text || undefined;
  }, textSchema);
}

export function optionalUuidQuery() {
  return z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    const text = String(value).trim();
    return text || undefined;
  }, z.string().uuid().optional());
}

export function parseRequestQuery<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  message = "Invalid query parameters.",
): z.infer<TSchema> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return parseSchema(schema, params, message, "invalid_query");
}
