import { describe, expect, it } from "vitest";
import { assertAuditTargetState, auditDocument, type IngestionDocumentAuditInput } from "../src/lib/ingestion-audit";

function fixture(overrides: Partial<IngestionDocumentAuditInput> = {}): IngestionDocumentAuditInput {
  return {
    documentId: "expected-doc",
    fileName: "guideline.pdf",
    metadata: { source_kind: "clinical_guideline" },
    registryProjection: false,
    integrityExpectation: {
      pages: 12,
      chunks: 24,
      tables: 1,
      images: 2,
      searchableUnits: 24,
      embeddings: 24,
      unitQualityPolicyVersion: "index-quality-v1",
      embeddingModel: "current-model",
      embeddingDimensions: 1536,
      embeddingStrategy: "chunk",
    },
    activeGenerationId: "g1",
    lifecycle: "active",
    governanceValid: true,
    publisher: "Governed publisher",
    pageCount: 12,
    indexedPageCount: 12,
    chunkCount: 24,
    tableCount: 1,
    imageCount: 2,
    searchableUnitCount: 24,
    embeddingCount: 24,
    duplicateChunks: 0,
    orphanedArtifacts: 0,
    emptyIndexUnits: 0,
    oversizedIndexUnits: 0,
    undersizedIndexUnits: 0,
    lowInformationIndexUnits: 0,
    chunkBoundsValid: true,
    headingContinuityPassed: true,
    tableContinuityPassed: true,
    extractionQuality: "acceptable",
    embeddingModel: "current-model",
    embeddingDimensions: 1536,
    embeddingStrategy: "chunk",
    chunkGenerations: ["g1"],
    mustPassCases: [],
    ...overrides,
  };
}

describe("ingestion integrity audit", () => {
  it("does not recommend re-index for a metadata-only defect", () => {
    expect(auditDocument(fixture({ publisher: null }))).toMatchObject({
      action: "metadata_only",
      reasons: ["metadata_incomplete"],
    });
  });

  it("targets a proven extraction or generation defect", () => {
    expect(auditDocument(fixture({ pageCount: 12, indexedPageCount: 8 }))).toMatchObject({
      action: "targeted_reprocess",
      reasons: ["missing_pages"],
    });
    expect(auditDocument(fixture({ activeGenerationId: "g1", chunkGenerations: ["g1", "g2"] }))).toMatchObject({
      action: "shadow_reindex",
      reasons: ["generation_incomplete"],
    });
  });

  it("classifies unit-quality and embedding defects with deterministic precedence", () => {
    expect(auditDocument(fixture({ emptyIndexUnits: 2, oversizedIndexUnits: 1 }))).toMatchObject({
      action: "targeted_reprocess",
      reasons: ["empty_index_units", "oversized_index_units"],
    });
    expect(auditDocument(fixture({ embeddingModel: "old-model" }))).toMatchObject({
      action: "shadow_reindex",
      reasons: ["embedding_missing_or_mismatched"],
    });
    expect(auditDocument(fixture({ indexedPageCount: 0, embeddingModel: "old-model" }))).toMatchObject({
      action: "targeted_reprocess",
      reasons: ["missing_pages", "embedding_missing_or_mismatched"],
    });
  });

  it("blocks missing integrity, invalid governance, and withdrawn content", () => {
    expect(auditDocument(fixture({ integrityExpectation: null }))).toMatchObject({
      eligibleForShadowPlan: false,
      blockingDisposition: "quarantine_review",
      reasons: ["integrity_expectation_missing"],
    });
    expect(auditDocument(fixture({ governanceValid: false }))).toMatchObject({
      eligibleForShadowPlan: false,
      blockingDisposition: "quarantine_review",
      reasons: ["source_governance_invalid"],
    });
    expect(auditDocument(fixture({ lifecycle: "withdrawn", indexedPageCount: 0 }))).toMatchObject({
      eligibleForShadowPlan: false,
      blockingDisposition: "tombstone",
      reasons: ["withdrawn_or_superseded", "missing_pages"],
    });
  });

  it("excludes registry projections from guideline repair classification", () => {
    expect(
      auditDocument(
        fixture({
          fileName: "site.registry.json",
          metadata: { source_kind: "registry_record", registry_record_id: "site-record" },
          registryProjection: true,
          pageCount: 0,
          indexedPageCount: 0,
          embeddingModel: "old-model",
          chunkGenerations: ["stale-generation"],
          mustPassCases: [
            {
              id: "registry-case",
              passed: false,
              expectedDocumentRank: 1,
              actualDocumentRank: null,
              failedExpectations: ["retrieval_miss"],
            },
          ],
        }),
      ),
    ).toMatchObject({ action: "no_change", reasons: [] });
  });

  it("fails closed when the state digest changes between plan and apply", () => {
    const audit = auditDocument(fixture());
    expect(() => assertAuditTargetState(audit, "different-digest")).toThrow(/state digest changed/i);
    expect(() => assertAuditTargetState(audit, audit.expectedStateDigest)).not.toThrow();
  });

  it("sorts evidence deterministically and treats unmeasured findings as neutral", () => {
    const first = auditDocument(
      fixture({
        pageCount: null,
        indexedPageCount: null,
        chunkGenerations: ["g2", "g1", "g2"],
        mustPassCases: [
          { id: "z", passed: true, expectedDocumentRank: 1, actualDocumentRank: 1, failedExpectations: [] },
          { id: "a", passed: true, expectedDocumentRank: 2, actualDocumentRank: 2, failedExpectations: [] },
        ],
      }),
    );
    const second = auditDocument(
      fixture({
        pageCount: null,
        indexedPageCount: null,
        chunkGenerations: ["g1", "g2"],
        mustPassCases: [...first.mustPassCases].reverse(),
      }),
    );
    expect(first.reasons).not.toContain("missing_pages");
    expect(first.expectedStateDigest).toBe(second.expectedStateDigest);
    expect(first.mustPassCases.map(({ id }) => id)).toEqual(["a", "z"]);
  });
});
