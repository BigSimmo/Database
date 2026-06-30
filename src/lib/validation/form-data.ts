import { z } from "zod";
import { parseSchema } from "@/lib/validation/http";

export function optionalFormText(maxLength: number) {
  return z
    .preprocess(
      (value) => {
        if (value === undefined || value === null) return null;
        return typeof value === "string" ? value : value;
      },
      z.union([z.string().trim().max(maxLength), z.null()]),
    )
    .transform((value) => (value ? value : null));
}

export function parseFormDataFields<TSchema extends z.ZodType>(
  formData: FormData,
  schema: TSchema,
  fields: string[],
  message = "Invalid form data.",
): z.infer<TSchema> {
  const values = Object.fromEntries(fields.map((field) => [field, formData.get(field)]));
  return parseSchema(schema, values, message, "invalid_form_data");
}
