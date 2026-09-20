import { z } from "zod";

import { cmeCategories } from "@/lib/cme/types";

const perthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");

export const cmeAllocationSchema = z.object({
  category: z.enum(cmeCategories),
  hours: z.number().positive().max(24),
});

export const cmeEntryCreateSchema = z.object({
  date: perthDate,
  title: z.string().trim().min(1).max(200),
  allocations: z.array(cmeAllocationSchema).min(1).max(cmeCategories.length),
  reflection: z.string().max(2000).default(""),
  costCents: z.number().int().nonnegative().nullable().default(null),
  routineId: z.string().uuid().nullable().default(null),
  documentId: z.string().uuid().nullable().default(null),
  buckets: z.array(z.string().trim().min(1).max(80)).max(8).default([]),
});

export const cmeListQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

/**
 * PATCH bodies must be COMPLETE (a full replace, not a true partial update).
 *
 * `.required()` strips every `.default(...)` `cmeEntryCreateSchema` declares (`reflection`,
 * `costCents`, `routineId`, `documentId`, `buckets`) and makes each mandatory. Defaults are
 * correct on create — a new entry that omits `reflection` genuinely has none — but dangerous on
 * update: without this, `cmeEntryCreateSchema` would accept a PATCH body that only corrected
 * `title`, and silently reset every other field to its default. That would discard the owner's
 * reflection text, the cost he recorded, and the routine/document he attached, with a 200
 * response — in a CPD record he may one day have to defend to a regulator. A partial body is
 * rejected with a 400 instead, and the caller must resend the whole entry to change any part of
 * it. Same pattern, same reasoning, as `updateOnCallEntrySchema` in
 * `src/lib/on-call/api-schemas.ts`.
 */
export const cmeEntryUpdateSchema = cmeEntryCreateSchema.required();
