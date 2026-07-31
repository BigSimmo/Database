import { z } from "zod";
import { clinicalQueryModeSchema } from "@/lib/clinical-query-mode";
import { searchScopeFiltersSchema } from "@/lib/search-scope";

export const answerRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    documentId: z.string().uuid().optional(),
    documentIds: z.array(z.string().uuid()).max(25).optional(),
    filters: searchScopeFiltersSchema.optional(),
    queryMode: clinicalQueryModeSchema.optional().default("auto"),
    summaryMode: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    if (value.summaryMode && !value.documentId) {
      context.addIssue({
        code: "custom",
        path: ["documentId"],
        message: "Document summary mode requires a document id.",
      });
    }
    if (value.summaryMode && value.documentId && value.documentIds?.some((id) => id !== value.documentId)) {
      context.addIssue({
        code: "custom",
        path: ["documentIds"],
        message: "Document summary mode only supports the selected document id.",
      });
    }
    if (value.summaryMode && value.documentIds && value.documentIds.length > 1) {
      context.addIssue({
        code: "custom",
        path: ["documentIds"],
        message: "Document summary mode only supports one document id.",
      });
    }
  });

export type AnswerRequestBody = z.infer<typeof answerRequestSchema>;
