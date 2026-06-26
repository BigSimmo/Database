import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateStructuredTextResponse: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_ANSWER_MODEL: "gpt-test",
    OPENAI_STRONG_ANSWER_MODEL: "gpt-strong-test",
  },
}));

vi.mock("@/lib/openai", () => ({
  generateStructuredTextResponse: mocks.generateStructuredTextResponse,
}));

import { generateModelIndexProfile } from "@/lib/model-index-extraction";

describe("model index extraction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses coverage-aware chunk selection so late high-yield content reaches the model prompt", async () => {
    mocks.generateStructuredTextResponse.mockResolvedValueOnce(
      JSON.stringify({
        sections: [],
        askable_questions: [],
        clinical_facts: [],
        table_facts: [],
        aliases: [],
        quality_issues: [],
      }),
    );

    await generateModelIndexProfile({
      document: { title: "Large Clozapine Protocol", file_name: "large-clozapine.pdf" },
      chunks: Array.from({ length: 140 }, (_, index) => ({
        id: `chunk-${index}`,
        page_number: index + 1,
        chunk_index: index,
        section_heading: index % 20 === 0 ? `Section ${index}` : null,
        content:
          index === 132
            ? "If ANC is < 1.5, stop clozapine and seek urgent specialist review."
            : `Routine source content ${index}.`,
      })),
      images: [],
    });

    const prompt = String(mocks.generateStructuredTextResponse.mock.calls[0]?.[0] ?? "");
    expect(prompt).toContain("Coverage strategy: coverage_spread_high_yield_headings");
    expect(prompt).toContain("chunk_id: chunk-132");
    expect(prompt).toContain("remain indexed and retrievable");
  });
});
