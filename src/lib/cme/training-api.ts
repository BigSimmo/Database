import { z } from "zod";

import {
  trainingMilestoneInputSchema,
  trainingPeriodInputSchema,
  type TrainingMilestoneInput,
  type TrainingPeriodInput,
} from "@/lib/cme/training-timeline";
import { PublicApiError } from "@/lib/http";

/**
 * Request parsing shared by `/api/cme/training` and `/api/cme/training/[id]`.
 *
 * A body names which record it is (`type: "period" | "milestone"`) beside the
 * record's own fields. The type is read first, then the rest is checked with
 * that record's schema, and the schema's own first message is returned so the
 * form can show the person exactly what to fix.
 */

export const trainingRecordTypes = ["period", "milestone"] as const;
export type TrainingRecordType = (typeof trainingRecordTypes)[number];

export const trainingRecordTypeSchema = z.enum(trainingRecordTypes);

/** `{ type, ...fields }`; the fields are checked separately by `parseTrainingRecordInput`. */
export const trainingRecordBodySchema = z.looseObject({ type: trainingRecordTypeSchema });

export type ParsedTrainingRecord =
  { type: "period"; input: TrainingPeriodInput } | { type: "milestone"; input: TrainingMilestoneInput };

function firstIssueMessage(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

export function parseTrainingRecordInput(body: z.infer<typeof trainingRecordBodySchema>): ParsedTrainingRecord {
  const { type, ...fields } = body;
  if (type === "period") {
    const parsed = trainingPeriodInputSchema.safeParse(fields);
    if (!parsed.success) {
      throw new PublicApiError(firstIssueMessage(parsed.error, "Check the period details and try again."), 400, {
        code: "invalid_body",
      });
    }
    return { type, input: parsed.data };
  }
  const parsed = trainingMilestoneInputSchema.safeParse(fields);
  if (!parsed.success) {
    throw new PublicApiError(firstIssueMessage(parsed.error, "Check the milestone details and try again."), 400, {
      code: "invalid_body",
    });
  }
  return { type, input: parsed.data };
}
