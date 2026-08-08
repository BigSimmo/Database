import { describe, expect, it } from "vitest";

import {
  projectDocumentLabelForClient,
  projectDocumentLabelsForClient,
  projectRelatedDocumentForClient,
} from "@/lib/client-source-projection";
import type { DocumentLabel, RelatedDocument } from "@/lib/types";

function label(overrides: Partial<DocumentLabel> = {}): DocumentLabel {
  return {
    id: "label-1",
    document_id: "doc-1",
    owner_id: "owner-uuid-should-not-leak",
    label: "clozapine",
    label_type: "clinical_topic",
    source: "generated",
    confidence: 0.9,
    metadata: { review_status: "approved", reviewer_notes: "internal note that should not leak" },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function relatedDocument(overrides: Partial<RelatedDocument> = {}): RelatedDocument {
  return {
    document_id: "doc-1",
    title: "Clozapine monitoring guideline",
    file_name: "clozapine.pdf",
    labels: [label()],
    summary: "Summary text",
    best_pages: [1, 2],
    best_chunk_ids: ["chunk-1"],
    image_count: 0,
    match_reason: "Matched indexed passages",
    score: 0.8,
    ...overrides,
  };
}

describe("projectDocumentLabelForClient", () => {
  it("strips owner_id and arbitrary metadata, keeping only review_status", () => {
    const projected = projectDocumentLabelForClient(label());
    expect(projected.owner_id).toBeUndefined();
    expect(projected.metadata).toEqual({ review_status: "approved" });
    expect(JSON.stringify(projected)).not.toContain("owner-uuid-should-not-leak");
    expect(JSON.stringify(projected)).not.toContain("internal note");
  });
});

describe("projectDocumentLabelsForClient", () => {
  it("drops hidden labels entirely", () => {
    const labels = [
      label({ id: "visible", metadata: { review_status: "approved" } }),
      label({ id: "hidden", metadata: { review_status: "hidden" } }),
    ];
    const projected = projectDocumentLabelsForClient(labels);
    expect(projected.map((l) => l.id)).toEqual(["visible"]);
  });
});

describe("projectRelatedDocumentForClient", () => {
  it("never leaks owner_id or raw label metadata through the labels array", () => {
    const projected = projectRelatedDocumentForClient(relatedDocument());
    expect(JSON.stringify(projected)).not.toContain("owner-uuid-should-not-leak");
    expect(JSON.stringify(projected)).not.toContain("internal note");
    expect(projected.labels).toHaveLength(1);
    expect(projected.labels[0].metadata).toEqual({ review_status: "approved" });
  });

  it("preserves document identity, score, and pagination fields", () => {
    const projected = projectRelatedDocumentForClient(relatedDocument());
    expect(projected.document_id).toBe("doc-1");
    expect(projected.title).toBe("Clozapine monitoring guideline");
    expect(projected.score).toBe(0.8);
    expect(projected.best_pages).toEqual([1, 2]);
  });

  it("preserves cover_image_id and table_count when present", () => {
    const projected = projectRelatedDocumentForClient(relatedDocument({ cover_image_id: "image-1", table_count: 3 }));
    expect(projected.cover_image_id).toBe("image-1");
    expect(projected.table_count).toBe(3);
  });
});
