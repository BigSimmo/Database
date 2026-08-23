import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateParsedTextResult: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_INDEXING_MODEL: "gpt-indexing-test",
  },
}));

vi.mock("@/lib/openai", () => ({
  generateParsedTextResult: mocks.generateParsedTextResult,
}));

import {
  fallbackModelIndexProfile,
  generateModelIndexProfile,
  modelIndexExtractionVersion,
} from "@/lib/model-index-extraction";

const chunks = [
  {
    id: "chunk-1",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "Check lithium levels 12 hours after the evening dose.",
  },
  {
    id: "chunk-2",
    page_number: 2,
    chunk_index: 1,
    section_heading: "Escalation",
    content: "Withhold the next dose and contact the treating team when the level exceeds 1.2 mmol/L.",
  },
];

const images = [{ id: "image-1", page_number: 2, caption: "Lithium monitoring table", source_kind: "table_crop" }];

function modelResult(profile: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  mocks.generateParsedTextResult.mockResolvedValueOnce({
    parsed: profile,
    truncated: false,
    status: "completed",
    incompleteReason: undefined,
    ...overrides,
  });
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    title: "Lithium level monitoring",
    content: "Take the level 12 hours after the evening dose.",
    source_chunk_ids: ["chunk-1"],
    source_image_ids: [],
    confidence: 0.8,
    ...overrides,
  };
}

async function profileFrom(raw: Record<string, unknown>) {
  modelResult(raw);
  return generateModelIndexProfile({
    document: { title: "Lithium Protocol", file_name: "lithium.pdf" },
    chunks,
    images,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("model index profile parsing", () => {
  it("returns an empty profile without calling the model when a document has no chunks", async () => {
    const profile = await generateModelIndexProfile({
      document: { title: "Empty", file_name: "empty.pdf" },
      chunks: [],
    });

    expect(mocks.generateParsedTextResult).not.toHaveBeenCalled();
    expect(profile).toEqual({ ...fallbackModelIndexProfile(), version: modelIndexExtractionVersion });
    expect(profile.model).toBeNull();
  });

  it("keeps only items grounded in supplied chunk or image ids", async () => {
    const profile = await profileFrom({
      sections: [
        item({ title: "Grounded section", source_chunk_ids: ["chunk-1", "chunk-hallucinated"] }),
        item({ title: "Image-grounded section", source_chunk_ids: [], source_image_ids: ["image-1"] }),
        item({ title: "Ungrounded section", source_chunk_ids: ["chunk-hallucinated"], source_image_ids: ["image-9"] }),
        item({ title: "Missing citations", source_chunk_ids: "chunk-1", source_image_ids: null }),
        "not an object",
      ],
    });

    expect(profile.sections.map((section) => section.title)).toEqual(["Grounded section", "Image-grounded section"]);
    expect(profile.sections[0].source_chunk_ids).toEqual(["chunk-1"]);
    expect(profile.sections[1].source_image_ids).toEqual(["image-1"]);
    expect(profile.model).toBe("gpt-indexing-test");
    expect(profile.version).toBe(modelIndexExtractionVersion);
  });

  it("drops items whose title or content is empty after cleaning", async () => {
    const profile = await profileFrom({
      clinical_facts: [
        item({ title: "Short" }),
        item({ content: "  " }),
        item({ title: "Serum level threshold", content: "Escalate above 1.2 mmol/L." }),
      ],
    });

    expect(profile.clinical_facts).toHaveLength(1);
    expect(profile.clinical_facts[0].title).toBe("Serum level threshold");
  });

  it("clamps confidence into the unit interval and defaults unusable values", async () => {
    const profile = await profileFrom({
      askable_questions: [
        item({ title: "When to take the level", confidence: 9 }),
        item({ title: "When to withhold a dose", confidence: -4 }),
        item({ title: "Who to contact after a high level", confidence: "not a number" }),
      ],
    });

    expect(profile.askable_questions.map((question) => question.confidence)).toEqual([1, 0, 0.55]);
  });

  it("collapses duplicate items that differ only by punctuation or case", async () => {
    const profile = await profileFrom({
      sections: [
        item({ title: "Lithium monitoring", content: "Take the level 12 hours after the dose." }),
        item({ title: "LITHIUM, MONITORING", content: "Take the level 12 hours after the dose!" }),
      ],
    });

    expect(profile.sections).toHaveLength(1);
  });

  it("normalizes table facts and nulls structured fields that carry no usable text", async () => {
    const profile = await profileFrom({
      table_facts: [
        {
          ...item({ title: "Level above 1.2 mmol/L", source_image_ids: ["image-1"] }),
          table_title: "Lithium monitoring thresholds",
          clinical_parameter: "Serum lithium level",
          threshold_value: "> 1.2 mmol/L",
          action: "Withhold the next dose and contact the treating team.",
        },
        {
          ...item({ title: "Level within range" }),
          table_title: "  ",
          clinical_parameter: null,
          threshold_value: undefined,
          action: "n/a",
        },
        { table_title: "Orphan table", clinical_parameter: "Serum lithium level" },
      ],
    });

    expect(profile.table_facts).toHaveLength(2);
    expect(profile.table_facts[0]).toMatchObject({
      table_title: "Lithium monitoring thresholds",
      clinical_parameter: "Serum lithium level",
      threshold_value: "> 1.2 mmol/L",
      source_image_ids: ["image-1"],
    });
    expect(profile.table_facts[1]).toMatchObject({
      table_title: null,
      clinical_parameter: null,
      threshold_value: null,
      action: null,
    });
  });

  it("keeps only aliases that differ from their canonical term and cite a real chunk", async () => {
    const profile = await profileFrom({
      aliases: [
        { alias: "Li levels", canonical: "Serum lithium level", alias_type: "acronym", source_chunk_ids: ["chunk-1"] },
        {
          alias: "Serum lithium level",
          canonical: "serum lithium LEVEL",
          alias_type: "clinical_term",
          source_chunk_ids: ["chunk-1"],
          confidence: 0.9,
        },
        { alias: "Lithium trough", canonical: "Serum lithium level", source_chunk_ids: ["chunk-hallucinated"] },
        { alias: "Lithium trough level", canonical: "Serum lithium level", source_chunk_ids: ["chunk-2"] },
        null,
      ],
    });

    expect(profile.aliases).toEqual([
      {
        alias: "Li levels",
        canonical: "Serum lithium level",
        alias_type: "acronym",
        source_chunk_ids: ["chunk-1"],
        confidence: 0.55,
      },
      {
        alias: "Lithium trough level",
        canonical: "Serum lithium level",
        alias_type: "clinical_term",
        source_chunk_ids: ["chunk-2"],
        confidence: 0.55,
      },
    ]);
  });

  it("cleans quality issues and tolerates non-array model fields", async () => {
    const profile = await profileFrom({
      sections: "not an array",
      aliases: null,
      quality_issues: ["Scanned pages produced low-confidence OCR text.", "  ", 42],
    });

    expect(profile.sections).toEqual([]);
    expect(profile.aliases).toEqual([]);
    expect(profile.quality_issues).toEqual(["Scanned pages produced low-confidence OCR text."]);
  });

  it("warns with the document identity when the model response is truncated", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    modelResult({ sections: [item()] }, { truncated: true, incompleteReason: "max_output_tokens" });

    const profile = await generateModelIndexProfile({
      document: { title: "Lithium Protocol", file_name: "lithium.pdf" },
      chunks,
    });

    expect(warn).toHaveBeenCalledWith("model-index extraction truncated", {
      document: "lithium.pdf",
      reason: "max_output_tokens",
    });
    expect(profile.sections).toHaveLength(1);
  });

  it("fails closed and logs document identity when schema parsing rejects the response", async () => {
    const failure = new Error("OpenAI returned no parsed structured output.");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.generateParsedTextResult.mockRejectedValueOnce(failure);

    await expect(
      generateModelIndexProfile({
        document: { title: "Lithium Protocol", file_name: "lithium.pdf" },
        chunks,
      }),
    ).rejects.toBe(failure);
    expect(log).toHaveBeenCalledWith("model-index extraction rejected", {
      document: "lithium.pdf",
      reason: failure.message,
    });
  });
});
