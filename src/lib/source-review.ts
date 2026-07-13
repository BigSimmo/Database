import { z } from "zod";

export const sourceReviewDecisionSchema = z.enum([
  "locally_reviewed",
  "approved",
  "rejected",
  "decommissioned",
  "superseded",
]);

export type SourceReviewDecision = z.infer<typeof sourceReviewDecisionSchema>;
