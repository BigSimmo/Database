import { afterEach, describe, expect, it, vi } from "vitest";
import { withRagRequestContext } from "@/lib/rag/rag-context-snapshot";
import { loadReviewedPolicyRequest, revalidateReviewedPolicyRequest } from "@/lib/rag/rag-reviewed-policy-input";
import { sourceEligibilityForClaim } from "@/lib/source-role-policy";
import type { SearchChunksArgs } from "@/lib/rag/rag-contracts";
import type { ReviewedPolicyEvent } from "@/lib/rag/rag-reviewed-policy-input";
import type { SearchResult } from "@/lib/types";

// Explicit synthetic fixture input, not evidence of a hosted clinical review store.
function side(id: string, local: boolean): SearchResult {
  return {
    id,
    document_id: id + "-document",
    title: local ? "Local PBS policy" : "PBS listing",
    file_name: "fixture.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "PBS",
    content: "PBS subsidy authority restriction applies to this listed medicine.",
    image_ids: [],
    images: [],
    similarity: 0.9,
    corpus_scope: local ? "uploaded_local" : "australian_public",
    source_metadata: {
      source_title: "fixture",
      publisher: local ? "Local service" : "Pharmaceutical Benefits Scheme",
      publisher_code: local ? null : "PBS",
      jurisdiction: "Australia",
      version: "fixture-v1",
      publication_date: "2026-01-01",
      review_date: "2027-01-01",
      uploaded_by: null,
      uploaded_at: null,
      indexed_at: null,
      source_kind: "document",
      corpus_scope: local ? "uploaded_local" : "australian_public",
      source_role: "subsidy",
      content_mode: "indexed_content",
      source_catalogue_key: local ? "local-policy" : "pbs",
      source_policy_version: "australian-source-policy-v1",
      licence_policy: "public_index_permitted",
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
      content_hash: "a".repeat(64),
    },
  };
}
const rows = [side("local", true), side("au", false)];
function event(sequence = 1, status: ReviewedPolicyEvent["status"] = "approved"): ReviewedPolicyEvent {
  return {
    version: "reviewed-policy-event-v1",
    recordId: "fixture-review",
    sequence,
    previousSequence: sequence === 1 ? null : sequence - 1,
    status,
    provenance: "human_review",
    reviewerRole: "clinical_source_governance",
    reviewerId: "AUDIT_ONLY_CANARY",
    reviewedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-10-01T00:00:00.000Z",
    sourcePolicyVersion: "rag-legacy-source-policy-v1",
    difference: {
      claimRole: "subsidy",
      topicKey: "fixture-subsidy",
      overlapReason: "same_topic_and_population",
      materialDifferenceReason: "recommendation_differs",
      localChunkIds: ["local"],
      australianChunkIds: ["au"],
    },
    evidence: rows.map((row) => ({
      chunkId: row.id,
      documentId: row.document_id,
      sourceVersion: "fixture-v1",
      contentHash: "a".repeat(64),
    })),
  };
}
afterEach(() => vi.useRealTimers());
describe("reviewed policy request lifecycle (fixtures)", () => {
  it("T8-R7 cancels a non-settling trusted adapter promptly", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error("fixture abort");
    let outcome: unknown;
    const args = withRagRequestContext<SearchChunksArgs>({
      query: "PBS",
      signal: controller.signal,
      loadReviewedSourcePolicyInput: () => new Promise(() => undefined),
    });
    void loadReviewedPolicyRequest(args).then(
      (value) => {
        outcome = value;
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    controller.abort(reason);
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBe(reason);
  });
  it("T8-R7 spends only the remaining existing route budget on an adapter", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
    let outcome: unknown;
    const startedAt = Date.now() - 34000;
    const args = withRagRequestContext<SearchChunksArgs>({
      query: "PBS",
      loadReviewedSourcePolicyInput: () => new Promise(() => undefined),
    });
    void loadReviewedPolicyRequest(args, Date.now(), startedAt).then(
      (value) => {
        outcome = value;
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toMatchObject({ name: "AnswerRouteDeadlineExceededError", budgetMs: 35000 });
  });
  it("T8-R8 final diagnostics reflect failed current-evidence revalidation", async () => {
    const { withRagAnswerQueryPlanDiagnostics } = await import("@/lib/rag/rag-cache");
    const loaded = await loadReviewedPolicyRequest(
      withRagRequestContext<SearchChunksArgs>({ query: "PBS", loadReviewedSourcePolicyInput: async () => [event()] }),
      Date.parse("2026-09-08T00:00:00Z"),
    );
    expect(loaded.reviewedPolicyRequest?.state).toBe("reviewed");
    expect(revalidateReviewedPolicyRequest(loaded, []).state).toBe("unavailable");
    const answer = withRagAnswerQueryPlanDiagnostics(
      { answer: "fixture", grounded: false, confidence: "unsupported", citations: [], sources: [] },
      loaded,
    );
    expect(answer.ragDiagnostics?.reviewed_input_state).toBe("unavailable");
  });
  it("loads a reviewed fixture and revalidates current eligible evidence before canonical conflict delivery", async () => {
    const args = withRagRequestContext<SearchChunksArgs>({
      query: "PBS subsidy",
      accessScope: { includePublic: true },
      loadReviewedSourcePolicyInput: async () => [event()],
    });
    const loaded = await loadReviewedPolicyRequest(args, Date.parse("2026-09-08T00:00:00Z"));
    expect(loaded.reviewedPolicyRequest?.state).toBe("reviewed");
    for (const row of rows)
      expect(sourceEligibilityForClaim({ source: row.source_metadata!, claimRole: "subsidy" })).toEqual({
        eligible: true,
        reason: "eligible",
      });
    const result = revalidateReviewedPolicyRequest(loaded, rows);
    expect(result.state).toBe("reviewed");
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.localPrimaryDecision.selected).toBe("uploaded_local");
    expect(JSON.stringify(result)).not.toContain("AUDIT_ONLY_CANARY");
    expect(revalidateReviewedPolicyRequest(loaded, rows.slice(1)).conflicts).toEqual([]);
    expect(
      revalidateReviewedPolicyRequest(
        { ...loaded, accessScope: { includePublic: false, ownerId: "other-owner" } },
        rows,
      ).conflicts,
    ).toEqual([]);
    expect(revalidateReviewedPolicyRequest(loaded, rows, Date.parse("2026-10-02T00:00:00Z")).conflicts).toEqual([]);
    expect(
      revalidateReviewedPolicyRequest(
        loaded,
        rows.map((row) => ({ ...row, source_metadata: { ...row.source_metadata!, content_hash: "b".repeat(64) } })),
      ).conflicts,
    ).toEqual([]);
    expect(
      revalidateReviewedPolicyRequest(
        loaded,
        rows.map((row) => ({ ...row, source_metadata: { ...row.source_metadata!, version: "changed" } })),
      ).conflicts,
    ).toEqual([]);
  });
  it.each([
    { label: "absent", history: [], expected: "not_assessed" },
    { label: "pending", history: [event(1, "pending")], expected: "unavailable" },
    { label: "revoked", history: [event(), event(2, "revoked")], expected: "unavailable" },
    { label: "expired", history: [{ ...event(), expiresAt: "2026-09-02T00:00:00Z" }], expected: "unavailable" },
    { label: "duplicate sequence", history: [event(), event()], expected: "unavailable" },
    { label: "nonhuman role", history: [{ ...event(), reviewerRole: "model" }], expected: "unavailable" },
  ])("rejects $label fixture history", async ({ history, expected }) => {
    const args = withRagRequestContext<SearchChunksArgs>({
      query: "PBS",
      accessScope: { includePublic: true },
      loadReviewedSourcePolicyInput: async () => history,
    });
    const loaded = await loadReviewedPolicyRequest(args, Date.parse("2026-09-08T00:00:00Z"));
    expect(loaded.reviewedPolicyRequest?.state).toBe(expected);
    expect(revalidateReviewedPolicyRequest(loaded, rows)).toEqual({ state: expected, conflicts: [] });
  });
  it("missing adapter means not assessed", async () => {
    const loaded = await loadReviewedPolicyRequest(
      withRagRequestContext<SearchChunksArgs>({ query: "PBS", accessScope: { includePublic: true } }),
    );
    expect(revalidateReviewedPolicyRequest(loaded, rows)).toEqual({ state: "not_assessed", conflicts: [] });
  });
});
