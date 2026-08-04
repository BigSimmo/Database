import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  answerTargetingThresholdFailure,
  buildAnswerDumpRecord,
  buildBoundedRagSourceDiagnostics,
  buildRagDiagnosticDumpRecord,
  parseArgs,
  resolveLocalDiagnosticOutputPath,
  selectAnswerQualityCases,
} from "../scripts/eval-answer-quality";
import type { RagAnswer } from "../src/lib/types";
import { answerQualityEvalCases, scoreAnswerTargeting } from "../src/lib/rag/rag-eval-cases";

describe("eval-answer-quality argument parsing", () => {
  it("is import-safe and validates exact selection before loading provider clients", () => {
    const source = readFileSync(new URL("../scripts/eval-answer-quality.ts", import.meta.url), "utf8");
    expect(source).toContain("import.meta.url === pathToFileURL(process.argv[1]).href");
    expect(source.indexOf("selectAnswerQualityCases(args)")).toBeLessThan(source.indexOf("loadAdminClient()"));
    expect(typeof parseArgs).toBe("function");
  });

  it("leaves dump-answers off by default and keeps --json independent", () => {
    const args = parseArgs(["--json"]);
    expect(args.dumpAnswers).toBeUndefined();
    expect(args.json).toBe(true);
    expect(args.failOnThreshold).toBe(false);
  });

  it("requires an explicit targeting floor when threshold failure is enabled", () => {
    expect(parseArgs(["--fail-on-threshold", "--targeting-floor", "0.9"])).toMatchObject({
      failOnThreshold: true,
      targetingFloor: 0.9,
    });
    expect(() => parseArgs(["--fail-on-threshold"])).toThrow("--fail-on-threshold requires --targeting-floor.");
  });

  it("keeps a targeting floor informational unless fail-on-threshold is set", () => {
    expect(
      answerTargetingThresholdFailure({ failOnThreshold: false, targetingFloor: 0.9, targetingRate: 0.5 }),
    ).toBeNull();
    expect(answerTargetingThresholdFailure({ failOnThreshold: true, targetingFloor: 0.9, targetingRate: 0.5 })).toBe(
      "targeting_rate 0.5 < floor 0.9",
    );
  });

  it("captures the --dump-answers path alongside other flags", () => {
    const args = parseArgs(["--dump-answers", ".local/out.json", "--limit", "5"]);
    expect(args.dumpAnswers).toBe(".local/out.json");
    expect(args.limit).toBe(5);
    expect(args.json).toBe(false);
  });

  it("captures repeatable exact case IDs before the limit", () => {
    const args = parseArgs([
      "--case-id",
      "quality-adhd-medication-monitoring",
      "--case-id",
      "quality-lithium-monitoring-range",
      "--limit",
      "1",
    ]);
    expect(args.caseIds).toEqual(["quality-adhd-medication-monitoring", "quality-lithium-monitoring-range"]);
    expect(selectAnswerQualityCases(args).map((testCase) => testCase.id)).toEqual([
      "quality-adhd-medication-monitoring",
    ]);
  });

  it("rejects an unknown exact case before evaluation", () => {
    expect(() => selectAnswerQualityCases({ caseIds: ["unknown-case"] })).toThrow(
      "Unknown answer-quality case ID: unknown-case",
    );
  });

  it("rejects blank exact IDs rather than falling back to the full suite", () => {
    expect(() => parseArgs(["--case-id", " "])).toThrow("--case-id must be a non-empty exact case ID.");
    expect(() => selectAnswerQualityCases({ caseIds: [" "] })).toThrow("--case-id must be a non-empty exact case ID.");
  });

  it("restricts private diagnostic output to repo-local ignored roots", () => {
    expect(resolveLocalDiagnosticOutputPath(".local/evals/case.json")).toContain(".local");
    expect(resolveLocalDiagnosticOutputPath("output/evals/case.json")).toContain("output");
    expect(() => resolveLocalDiagnosticOutputPath("docs/case.json")).toThrow(
      "repo-local file under .local/ or output/",
    );
    expect(() => resolveLocalDiagnosticOutputPath(".local/../../docs/case.json")).toThrow(
      "repo-local file under .local/ or output/",
    );
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

  it("persists source-backed review stubs as applicable targeting misses", () => {
    const reviewStub = {
      ...answer,
      routingReason: "high_confidence_extractive_retrieval; source_backed_review_fallback",
    } as RagAnswer;
    const targeting = scoreAnswerTargeting(testCase, reviewStub);
    const record = buildAnswerDumpRecord(testCase, reviewStub, targeting);

    expect(record.targeting).toEqual({
      applicable: true,
      score: 0,
      reason: "source-backed review stub",
    });
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

  it("adds bounded source diagnostics without identifiers, URLs, or full content", () => {
    const sources = Array.from({ length: 12 }, (_, index) => ({
      id: `chunk-${index}`,
      document_id: "11111111-1111-4111-8111-111111111111",
      title: `Source ${index} operator@example.test`,
      file_name: `source-${index}-11111111-1111-4111-8111-111111111111.pdf`,
      page_number: index + 1,
      chunk_index: index,
      section_heading: "Monitoring\nSchedule",
      content: `Visit https://example.test/private mailto:operator@example.test s3://private-bucket/key bare.example.org 11111111-1111-4111-8111-111111111111 \u202Esecretdirection ${"x".repeat(900)}`,
      image_ids: ["image-private"],
      similarity: 0.8,
      images: [
        {
          id: "image-private",
          page_number: 1,
          storage_path: "s3://private-bucket/image-private",
          caption: "Monitoring table at operator@example.test",
          source_kind: "table_crop",
          image_type: "clinical_table",
          accessibleTableMarkdown:
            "| Parameter | Frequency |\n| --- | --- |\n| Weight | every 3 months | https://example.test/private 11111111-1111-4111-8111-111111111111",
        },
      ],
      index_unit: {
        id: "unit-private",
        unit_type: "medication_chart_row",
        title: "Private unit",
        content: "private",
        source_chunk_id: "chunk-private",
        source_image_id: null,
        page_start: 2,
        page_end: 3,
        heading_path: ["Dose", "Route"],
        normalized_terms: [],
        quality_score: 1,
        extraction_mode: "deterministic",
      },
      table_facts: [
        {
          id: "fact-private",
          document_id: "11111111-1111-4111-8111-111111111111",
          source_chunk_id: "chunk-private",
          source_image_id: null,
          page_number: 2,
          table_title: "Chart",
          row_label: "Dose",
          clinical_parameter: "Medication",
          threshold_value: "5 mg",
          action: "Review",
        },
      ],
    })) as RagAnswer["sources"];

    const diagnostics = buildBoundedRagSourceDiagnostics(sources);
    expect(diagnostics).toHaveLength(10);
    expect(diagnostics[0]).toMatchObject({
      rank: 1,
      page: 1,
      section_heading: "Monitoring Schedule",
      index_unit: { type: "medication_chart_row", heading_depth: 2, page_span: { start: 2, end: 3 } },
      table_shape: { fact_count: 1, labelled_row_count: 1, parameter_count: 1, threshold_count: 1, action_count: 1 },
      image_shape: { image_count: 1, table_image_count: 1, accessible_table_count: 1 },
    });
    expect(diagnostics[0].content_preview.length).toBeLessThanOrEqual(800);
    expect(diagnostics[0].image_table_preview).toContain("Weight | every 3 months");
    expect(diagnostics[0].image_table_preview?.length).toBeLessThanOrEqual(800);
    expect(JSON.stringify(diagnostics)).not.toMatch(
      /operator@example|example\.test|bare\.example|private-bucket|11111111-1111|chunk-private|unit-private|fact-private|image-private|\\u202e/i,
    );
    expect(Object.keys(diagnostics[0])).not.toContain("document_id");
  });

  it("redacts the question, answer, routing and section fields while preserving clinical prose", () => {
    const hostileAnswer = {
      ...answer,
      answer:
        "Monitor lithium monthly; see bare.example.org/path or ftp://private.example.test and patient 11111111-1111-4111-8111-111111111111.",
      routingReason: "provider_timeout mailto:operator@example.test",
      answerSections: [
        {
          heading: "Schedule\u202Ehidden",
          body: "Continue clinical monitoring at s3://private-bucket/key.",
          citation_chunk_ids: ["chunk-1"],
        },
      ],
    } as RagAnswer;
    const record = buildRagDiagnosticDumpRecord(
      "case-11111111-1111-4111-8111-111111111111",
      "Question at mailto:operator@example.test?",
      hostileAnswer,
    );
    const serialized = JSON.stringify(record);
    expect(serialized).toContain("Monitor lithium monthly");
    expect(serialized).not.toMatch(
      /bare\.example|private\.example|operator@example|11111111-1111|private-bucket|\u202e/i,
    );
  });

  it("records usage and cost controls without persisting provider request IDs", () => {
    const record = buildRagDiagnosticDumpRecord("usage-case", "Monitoring question", {
      ...answer,
      modelUsed: "gpt-test",
      openAIRequestIds: ["request-private-1", "request-private-2"],
      openAIUsage: { input_tokens: 1_000, cached_input_tokens: 100, output_tokens: 200 },
    } as RagAnswer);
    expect(record).toMatchObject({
      model: "gpt-test",
      provider_attempted: true,
      observed_provider_request_id_count: 2,
      openai_usage: { input_tokens: 1_000, cached_input_tokens: 100, output_tokens: 200 },
    });
    expect(Object.keys(record)).not.toContain("openAIRequestIds");
    expect(JSON.stringify(record)).not.toContain("request-private");
  });

  it("treats a timed-out provider attempt without usage or request IDs as unknown cost", () => {
    const record = buildRagDiagnosticDumpRecord("timeout-case", "Dosing question", {
      ...answer,
      modelUsed: null,
      openAIRequestIds: [],
      openAIUsage: undefined,
      routingReason: "generation_fallback:provider_timeout; source_backed_review_fallback",
      latencyTimings: { generation_latency_ms: 20_000 },
    } as RagAnswer);
    expect(record).toMatchObject({
      provider_attempted: true,
      observed_provider_request_id_count: 0,
      estimated_cost_usd: null,
    });
  });
});
