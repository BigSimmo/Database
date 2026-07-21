import { describe, expect, it } from "vitest";

import { buildAnswerDumpRecord, parseArgs } from "../scripts/eval-answer-quality";
import type { RagAnswer } from "../src/lib/types";
import { answerQualityEvalCases, scoreAnswerTargeting } from "../src/lib/rag/rag-eval-cases";

describe("eval-answer-quality argument parsing", () => {
  it("leaves dump-answers off by default and keeps --json independent", () => {
    const args = parseArgs(["--json"]);
    expect(args.dumpAnswers).toBeUndefined();
    expect(args.json).toBe(true);
  });

  it("captures the --dump-answers path alongside other flags", () => {
    const args = parseArgs(["--dump-answers", "/tmp/out.json", "--limit", "5"]);
    expect(args.dumpAnswers).toBe("/tmp/out.json");
    expect(args.limit).toBe(5);
    expect(args.json).toBe(false);
  });
});

describe("answer dump records", () => {
  const testCase = answerQualityEvalCases[0];
  const answer = {
    answer: "Check lithium levels at baseline and every 3 months.",
    grounded: true,
    confidence: "medium",
    routingMode: "extractive",
    routingReason: "high_confidence_extractive_retrieval",
    queryClass: "medication_dose_risk",
    citations: [{ chunk_id: "chunk-1" }],
    answerSections: [{ heading: "Monitoring", body: "Baseline then 3-monthly.", citation_chunk_ids: ["chunk-1"] }],
    sources: [],
  } as unknown as RagAnswer;

  it("captures the answer text, sections, and targeting verdict", () => {
    const targeting = scoreAnswerTargeting(testCase, answer);
    const record = buildAnswerDumpRecord(testCase, answer, targeting);
    expect(record.id).toBe(testCase.id);
    expect(record.question).toBe(testCase.question);
    expect(record.answer).toContain("lithium levels");
    expect(record.answer_sections).toEqual([{ heading: "Monitoring", body: "Baseline then 3-monthly." }]);
    expect(record.citation_count).toBe(1);
    expect(record.targeting).toEqual({
      applicable: targeting.applicable,
      score: targeting.score,
      reason: targeting.reason,
    });
    expect(record.answer_length).toBe(answer.answer?.length ?? 0);
  });

  it("tolerates missing answer text and sections", () => {
    const bare = { grounded: false, confidence: "unsupported", citations: [], sources: [] } as unknown as RagAnswer;
    const targeting = scoreAnswerTargeting(testCase, bare);
    const record = buildAnswerDumpRecord(testCase, bare, targeting);
    expect(record.answer).toBe("");
    expect(record.answer_length).toBe(0);
    expect(record.answer_sections).toEqual([]);
    expect(record.route).toBeNull();
  });
});
