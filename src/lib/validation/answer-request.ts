import { z } from "zod";
import { clinicalQueryModeSchema } from "@/lib/clinical-query-mode";
import { searchScopeFiltersSchema } from "@/lib/search-scope";

export const answerRequestSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
  filters: searchScopeFiltersSchema.optional(),
  queryMode: clinicalQueryModeSchema.optional().default("auto"),
});

export type AnswerRequestBody = z.infer<typeof answerRequestSchema>;
