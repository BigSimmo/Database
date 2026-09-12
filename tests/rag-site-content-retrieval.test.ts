import { describe, expect, it, vi } from "vitest";

import { retrievalCorpusScopes, searchGovernedCorpora } from "../src/lib/rag/rag-candidate-sources";
import type { RagContextSnapshot } from "../src/lib/site-content/site-content-contracts";

const RELEASE_ID = "e4a1dd29-14f6-556c-8fb7-f4f947d8b846";
const OTHER_RELEASE_ID = "d1f6c316-b6f8-5c55-87ce-6b486032af03";
const DIGEST = "b".repeat(64);

function snapshot(state: RagContextSnapshot["publicSiteContent"]["state"]): RagContextSnapshot {
  return {
    version: "rag-context-snapshot-v1",
    resolvedAt: "2026-08-30T00:00:00.000Z",
    documentIndexGeneration: "generation-1",
    sourcePolicyVersion: "source-policy-v1",
    rolloutVersion: "rollout-v1",
    siteContentRegistryVersion: "site-content-registry-v1",
    publicSiteContent: {
      releaseId: RELEASE_ID,
      staticManifestDigest: DIGEST,
      dynamicStateDigest: DIGEST,
      releaseDigest: DIGEST,
      changeEpoch: "9",
      state,
    },
  };
}

function siteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "site-chunk",
    document_id: "site-document",
    title: "Clozapine",
    file_name: "/medications/clozapine",
    page_number: null,
    chunk_index: 0,
    section_heading: "medications",
    content: "Current approved clozapine site content.",
    image_ids: [],
    source_metadata: {
      corpus_scope: "clinical_kb_site",
      source_kind: "registry_record",
      source_role: "supporting",
      content_mode: "indexed_content",
      source_title: "Clozapine",
      version: "2026.08",
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      content_hash: DIGEST,
      site_content_lineage: [],
    },
    similarity: 0.8,
    text_rank: 0.7,
    hybrid_score: 0.8,
    corpus_scope: "clinical_kb_site",
    site_content_domain: "medications",
    site_release_id: RELEASE_ID,
    site_change_epoch: "9",
    pending_exclusion_exact: true,
    images: [],
    ...overrides,
  };
}

describe("current first-party site retrieval", () => {
  it("removes only the site lane for stale or unavailable snapshots", () => {
    for (const state of ["stale", "unavailable", "disabled"] as const) {
      const phases = retrievalCorpusScopes({
        siteContentEnabled: true,
        siteContentState: state,
        australianAugmentationEnabled: true,
        australianCurrent: true,
        internationalCoverageGap: false,
      });
      expect(phases[0]?.corpusScopes).toEqual(["uploaded_local", "australian_public"]);
    }
  });

  it("binds site candidates to the exact release, change epoch, domains, and pending anti-join proof", async () => {
    const abortSignal = vi.fn(async () => ({
      data: [
        siteRow(),
        siteRow({ id: "wrong-release", site_release_id: OTHER_RELEASE_ID }),
        siteRow({ id: "wrong-epoch", site_change_epoch: "8" }),
        siteRow({ id: "wrong-domain", site_content_domain: "services" }),
        siteRow({ id: "unproven-pending", pending_exclusion_exact: false }),
        siteRow({
          id: "wrong-source-kind",
          source_metadata: { corpus_scope: "clinical_kb_site", source_kind: "document" },
        }),
      ],
      error: null,
    }));
    const supabase = { rpc: vi.fn(() => ({ abortSignal })) };
    const controller = new AbortController();

    const results = await searchGovernedCorpora({
      supabase: supabase as never,
      queryVariants: ["clozapine"],
      matchCount: 12,
      snapshot: snapshot("updating"),
      components: { siteContent: true, australianAugmentation: false, australianCurrent: false },
      targetSiteDomains: ["medications"],
      internationalCoverageGap: false,
      signal: controller.signal,
    });

    expect(results.map(({ id }) => id)).toEqual(["site-chunk"]);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "match_document_chunks_text_v3",
      expect.objectContaining({
        corpus_scopes: ["uploaded_local", "clinical_kb_site"],
        expected_site_release_digest: DIGEST,
        expected_site_release_id: RELEASE_ID,
        expected_site_change_epoch: "9",
        site_content_domains: ["medications"],
      }),
    );
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(results[0]).not.toHaveProperty("site_release_id");
    expect(results[0]).not.toHaveProperty("site_change_epoch");
    expect(results[0]).not.toHaveProperty("pending_exclusion_exact");
    expect(results[0]?.source_metadata).toMatchObject({ source_kind: "registry_record" });
  });

  it("fails the site component closed while preserving independently enabled Australian retrieval", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const supabase = {
      rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        return { abortSignal: vi.fn(async () => ({ data: [], error: null })) };
      }),
    };

    await searchGovernedCorpora({
      supabase: supabase as never,
      queryVariants: ["monitoring"],
      matchCount: 12,
      snapshot: snapshot("stale"),
      components: { siteContent: true, australianAugmentation: true, australianCurrent: true },
      targetSiteDomains: ["medications"],
      internationalCoverageGap: false,
    });

    expect(calls[0]?.corpus_scopes).toEqual(["uploaded_local", "australian_public"]);
    expect(calls[0]?.corpus_scopes).not.toContain("clinical_kb_site");
  });
});
