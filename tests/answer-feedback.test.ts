import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { answerFeedbackTypes } from "@/lib/answer-feedback";

const clinicalAskReasons = [
  "wrong_mode",
  "missed_source",
  "unsupported_conclusion",
  "important_information_missing",
  "source_conflict",
  "outdated_source",
  "presentation_problem",
] as const;

describe("answer feedback reasons", () => {
  const schema = z.enum(answerFeedbackTypes);

  it.each(clinicalAskReasons)("accepts the Clinical Ask reason %s", (reason) => {
    expect(schema.parse(reason)).toBe(reason);
  });

  it("retains all existing feedback reasons and rejects free text", () => {
    expect(answerFeedbackTypes).toEqual([
      "verified",
      "needs_correction",
      "source_insufficient",
      "wrong_source",
      "missing_source",
      "unsupported_answer",
      "numeric_error",
      "outdated_guidance",
      ...clinicalAskReasons,
    ]);
    expect(schema.safeParse("The answer omitted a detail from my case").success).toBe(false);
  });

  it("keeps the migration limited to the named 15-value check constraint", () => {
    const sql = readFileSync("supabase/migrations/20260822120000_expand_answer_feedback_for_clinical_ask.sql", "utf8");
    expect(sql).toContain("drop constraint if exists rag_answer_feedback_feedback_category_check");
    expect(sql).toContain("add constraint rag_answer_feedback_feedback_category_check");
    for (const reason of answerFeedbackTypes) expect(sql).toContain(`'${reason}'`);
    expect(sql).not.toMatch(/\b(update|delete|insert|grant|revoke|policy)\b/i);
  });
});
