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
