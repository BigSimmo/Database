import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSource = readFileSync(new URL("../worker/main.ts", import.meta.url), "utf8");
const extractorSource = readFileSync(new URL("../worker/python/extract_pdf_assets.py", import.meta.url), "utf8");

describe("worker visual capture hardening", () => {
  it("guards every local worker vector write before Supabase inserts", () => {
    expect(workerSource).toContain('import { assertEmbeddingDim } from "../src/lib/embedding-dimensions"');
    expect(workerSource).toContain(
      "embedding: assertEmbeddingDim(embeddings[index], `document_chunks.${chunk.chunk_index}`)",
    );
    expect(workerSource).toContain(
      "embedding: assertEmbeddingDim(embeddings[index], `document_embedding_fields.${field.field_type}`)",
    );
    expect(workerSource).toContain(
      "embedding: assertEmbeddingDim(fieldEmbeddings[index], `document_embedding_fields.section_context.${index}`)",
    );
    expect(workerSource).toContain(
      "embedding: assertEmbeddingDim(unitEmbeddings[start + index], `document_index_units.visual.${start + index}`)",
    );
    expect(workerSource).toContain(
      "embedding: assertEmbeddingDim(additionalEmbeddings[index], `document_embedding_fields.${field.field_type}`)",
    );
  });

  it("leaves optional artifact write failures claimable by the Supabase v3 repair agent", () => {
    expect(workerSource).toContain("const optionalRepairRequired = optionalIndexWriteIssues.length > 0");
    expect(workerSource).toContain(
      'const agentRepairRequired = enrichmentStatus !== "completed" || optionalRepairRequired',
    );
    expect(workerSource).toContain('enrichmentStatus = "pending"');
    expect(workerSource).toContain('indexing_v3_agent_status: "pending"');
    expect(workerSource).toContain('"optional_index_write_issues"');
    expect(workerSource).toContain("indexing_v3_agent_repair_reason: agentRepairReason");
    expect(workerSource).toContain('indexing_v3_agent_status: "completed"');
  });

  it("keeps atomic reindex fallback rows and image uploads generation-scoped", () => {
    expect(workerSource).toContain("await replacePageRows(args.documentId, args.pages)");
    expect(workerSource).toContain("await deleteStaleIndexGenerationRows(args.documentId, args.indexGenerationId)");
    expect(workerSource).toContain("async function deleteStaleIndexGenerationRows");
    expect(workerSource).toContain("`${imagePrefix}/${indexGenerationId}/image-${index + 1}${ext}`");
    expect(workerSource).toContain('indexing_v3_agent_repair_reason: "core_index_committed"');
  });

  it("uses the strict completion RPC when inline enrichment succeeds", () => {
    expect(workerSource).toContain("async function completeStrictEnrichmentJob(job: JobRow)");
    expect(workerSource).toContain("complete_strict_enrichment_job");
    expect(workerSource).toContain('p_agent_version: "visual-core-v3"');
    expect(workerSource).toContain('p_visual_indexing_version: "visual-v3"');
    expect(workerSource).toContain('indexing_v3_agent_repair_reason: "strict_completion_gate_blocked"');
  });

  it("invalidates stale image caption cache entries by policy, prompt, and context versions", () => {
    expect(workerSource).toContain('const imageCaptionCacheVersion = "clinical-image-caption-cache-v2"');
    expect(workerSource).toContain('const visionClassificationPromptVersion = "clinical-image-classification-v1"');
    expect(workerSource).toContain("metadata.image_caption_cache_version !== imageCaptionCacheVersion");
    expect(workerSource).toContain("metadata.image_policy_version !== clinicalImagePolicyVersion");
    expect(workerSource).toContain("metadata.visual_intelligence_version !== visualIntelligenceVersion");
    expect(workerSource).toContain("metadata.caption_context_hash !== contextHash");
  });

  it("computes perceptual duplicate groups before caption budget selection", () => {
    expect(workerSource.indexOf("const preparedImages = await Promise.all")).toBeLessThan(
      workerSource.indexOf("const scoredCandidates = rankVisualCandidates"),
    );
    expect(workerSource).toContain("lightweightPerceptualHash(bytes, image.width, image.height)");
    expect(workerSource).toContain("perceptualHash: preparedImages[index]?.perceptualHash ?? null");
  });

  it("propagates OCR failures and captures image-dominant page regions", () => {
    expect(extractorSource).toContain('return "", f"OCR failed on page');
    expect(extractorSource).toContain("warnings.append(ocr_warning)");
    expect(extractorSource).toContain('"warnings": warnings');
    expect(extractorSource).toContain("image_dominant_page_region");
    expect(extractorSource).toContain("source_regions");
    expect(extractorSource).toContain("render_dpi");
  });
});
