import { describe, expect, it } from "vitest";
import { buildRagSourceBlock, parseAnswerJson } from "../src/lib/rag";
import type { SearchResult } from "../src/lib/types";

function source(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "chunk-1",
    document_id: "doc-1",
    title: "WA source",
    file_name: "wa-source.pdf",
    page_number: 2,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "Monitor symptoms and escalate review if urgent warning features are present.",
    image_ids: [],
    similarity: 0.86,
    source_metadata: {
      source_title: "WA source",
      publisher: "Local service",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
    images: [],
    ...overrides,
  };
}

describe("RAG trust validation", () => {
  it("falls back safely when model JSON is invalid", () => {
    const answer = parseAnswerJson("not json", [source()]);

    expect(answer.answer).toBe("not json");
    expect(answer.citations).toHaveLength(1);
    expect(answer.grounded).toBe(true);
  });

  it("rejects hallucinated citations that are not retrieved chunks", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Unsupported",
        grounded: true,
        confidence: "high",
        citations: [{ chunk_id: "missing" }],
      }),
      [source()],
    );

    expect(answer.citations).toEqual([]);
    expect(answer.grounded).toBe(false);
    expect(answer.confidence).toBe("unsupported");
  });

  it("downgrades missing model citations instead of trusting high confidence", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Supported but uncited",
        grounded: true,
        confidence: "high",
        citations: [],
      }),
      [source()],
    );

    expect(answer.citations).toHaveLength(1);
    expect(answer.confidence).toBe("low");
  });

  it("preserves valid citations using retrieved source metadata", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Supported",
        grounded: true,
        confidence: "medium",
        citations: [{ chunk_id: "chunk-1" }],
        answerSections: [{ heading: "Monitoring", body: "Monitor symptoms.", citation_chunk_ids: ["chunk-1"] }],
      }),
      [source()],
    );

    expect(answer.citations[0]).toMatchObject({
      chunk_id: "chunk-1",
      document_id: "doc-1",
      title: "WA source",
    });
    expect(answer.citations[0].source_metadata?.document_status).toBe("current");
    const sections = answer.answerSections ?? [];
    expect(sections).toHaveLength(1);
  });

  it("removes JSON-like artifact sections while keeping valid sections", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Supported by source.",
        grounded: true,
        confidence: "medium",
        citations: [{ chunk_id: "chunk-1" }],
        answerSections: [
          {
            heading: "Monitoring",
            body: "Monitor the patient closely for escalation.",
            citation_chunk_ids: ["chunk-1"],
          },
          {
            heading: `{\"answer\":\"or  \",\"citation_chunk_ids\":[\"chunk-1\"]}`,
            body: `{\"answer\":\" or  \",\"citation_chunk_ids\":[\"chunk-1\"]}`,
            citation_chunk_ids: ["chunk-1"],
          },
        ],
      }),
      [source()],
    );

    const sections = answer.answerSections ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]?.heading).toBe("Monitoring");
    expect(sections[0]?.body).toBe("Monitor the patient closely for escalation.");
  });

  it("returns empty answer sections when all sections are artifact-shaped", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Supported by source.",
        grounded: true,
        confidence: "medium",
        citations: [{ chunk_id: "chunk-1" }],
        answerSections: [
          {
            heading: `{\"answer\":\"or  \",\"heading\":\"monitor\",\"citation_chunk_ids\":[\"chunk-1\"]}`,
            body: `{\"answer\":\"Supported with JSON-shape\", \"citation_chunk_ids\":[\"chunk-1\"]}`,
            citation_chunk_ids: ["chunk-1"],
          },
        ],
      }),
      [source()],
    );

    const sections = answer.answerSections ?? [];
    expect(sections).toHaveLength(0);
  });

  it("keeps valid sections while filtering invalid citation IDs", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Supported and scoped.",
        grounded: true,
        confidence: "high",
        citations: [{ chunk_id: "chunk-1" }],
        answerSections: [
          { heading: "Escalation", body: "Escalate on acute risk signs.", citation_chunk_ids: ["chunk-1", "missing"] },
          {
            heading: '{"heading":"artifact","body":"should be removed"}',
            body: `{\"heading\":\"artifact\",\"body\":\"should be removed\"}`,
            citation_chunk_ids: ["chunk-1"],
          },
        ],
      }),
      [source()],
    );

    const sections = answer.answerSections ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]?.citation_chunk_ids).toEqual(["chunk-1"]);
  });

  it("includes exact citation chunk IDs in the model source block", () => {
    const block = buildRagSourceBlock([source()]);

    expect(block).toContain("citation_chunk_id: chunk-1");
    expect(block).toContain("document_id: doc-1");
  });

  it("does not pack administrative table images into model source context", () => {
    const block = buildRagSourceBlock([
      source({
        images: [
          {
            id: "admin-table",
            page_number: 3,
            storage_path: "private/admin.png",
            caption: "Authorisation and publication details.",
            searchable: true,
            image_type: "clinical_table",
            source_kind: "table_crop",
            tableRole: "admin",
            tableTextSnippet: "Authorised by | Authorisation date | Published date",
            metadata: {
              clinical_use_class: "administrative",
              table_role: "admin",
              table_text: "Authorised by | Authorisation date | Published date",
            },
          },
        ],
      }),
    ]);

    expect(block).not.toContain("Authorisation date");
    expect(block).not.toContain("Images:");
  });

  it("packs adjacent context under the same citation without creating new citation IDs", () => {
    const block = buildRagSourceBlock([
      source({
        adjacent_context: "Previous and next table rows explain monitoring timing and escalation thresholds.",
      }),
    ]);

    expect(block).toContain("Nearby context from the same source");
    expect(block).toContain("monitoring timing and escalation thresholds");
    expect(block).not.toContain("citation_chunk_id: Previous");
  });

  it("clamps model confidence to retrieval strength", () => {
    const answer = parseAnswerJson(
      JSON.stringify({
        answer: "Weakly supported",
        grounded: true,
        confidence: "high",
        citations: [{ chunk_id: "chunk-1" }],
      }),
      [source({ similarity: 0.5 })],
    );

    expect(answer.confidence).toBe("low");
  });
});
