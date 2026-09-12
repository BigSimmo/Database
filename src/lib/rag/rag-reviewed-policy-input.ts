import { annotateSearchResults } from "@/lib/evidence-relevance";
import { createAnswerRouteDeadline } from "@/lib/rag/rag-route-budget";
import { retrievalAccessScopeForArgs, retrievalAccessScopeKey, type RetrievalAccessScope } from "@/lib/owner-scope";
import { resolveLocalAndAustralianEvidence } from "@/lib/source-role-policy";
import { assertRagRequestContextIntegrity, type RagRequestContext } from "@/lib/rag/rag-context-snapshot";
import type { SearchChunksArgs } from "@/lib/rag/rag-contracts";
import type { SearchResult, SourcePolicyConflict, VerifiedSourcePolicyDifference } from "@/lib/types";

/** Trusted server adapter only. No API DTO accepts review events or reviewer authority. */
export type ReviewedSourcePolicyLoader = (
  input: Readonly<{
    requestContext: RagRequestContext;
    accessScope: RetrievalAccessScope;
    signal?: AbortSignal;
  }>,
) => Promise<unknown>;

type EvidenceVersion = { chunkId: string; documentId: string; sourceVersion: string; contentHash: string };
export type ReviewedPolicyEvent = {
  version: "reviewed-policy-event-v1";
  recordId: string;
  sequence: number;
  previousSequence: number | null;
  status: "approved" | "revoked" | "pending";
  provenance: "human_review";
  reviewerRole: "clinical_source_governance";
  /** Audit-store identity; stripped from the request snapshot and all projections. */
  reviewerId: string;
  reviewedAt: string;
  expiresAt: string;
  sourcePolicyVersion: string;
  difference: VerifiedSourcePolicyDifference;
  evidence: EvidenceVersion[];
};
type RequestDifference = Pick<ReviewedPolicyEvent, "difference" | "evidence" | "expiresAt">;
export type ReviewedPolicyRequest = Readonly<{
  state: "not_assessed" | "unavailable" | "reviewed";
  snapshotCacheKey: string;
  accessScopeKey: string;
  resolvedAt: number;
  differences: readonly RequestDifference[];
}>;
function freezeReview<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeReview(child);
    Object.freeze(value);
  }
  return value;
}
const issued = new WeakSet<ReviewedPolicyRequest>();
const effectiveReviewStates = new WeakMap<ReviewedPolicyRequest, ReviewedPolicyRequest["state"]>();
export function reviewedPolicyStateForRequest(request?: ReviewedPolicyRequest): ReviewedPolicyRequest["state"] {
  if (!request || !issued.has(request)) return "not_assessed";
  return effectiveReviewStates.get(request) ?? (request.state === "reviewed" ? "unavailable" : request.state);
}
const roles = ["treatment", "dose_or_monitoring", "safety", "legal", "subsidy", "quality", "service_workflow"];
const differenceReasons = [
  "recommendation_differs",
  "dose_differs",
  "threshold_differs",
  "monitoring_differs",
  "legal_status_differs",
  "other_reviewed_material_difference",
];
const text = (value: unknown, max = 200): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 8 &&
  value.every((item) => text(item)) &&
  new Set(value).size === value.length;

function validEvent(input: unknown, policyVersion: string, now: number): input is ReviewedPolicyEvent {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const event = input as ReviewedPolicyEvent;
  if (
    Object.keys(event).sort().join() !==
    "difference,evidence,expiresAt,previousSequence,provenance,recordId,reviewedAt,reviewerId,reviewerRole,sequence,sourcePolicyVersion,status,version"
  )
    return false;
  const reviewedAt = Date.parse(event.reviewedAt),
    expiresAt = Date.parse(event.expiresAt);
  if (
    event.version !== "reviewed-policy-event-v1" ||
    !text(event.recordId) ||
    !Number.isInteger(event.sequence) ||
    event.sequence < 1 ||
    event.sequence > 64 ||
    event.provenance !== "human_review" ||
    event.reviewerRole !== "clinical_source_governance" ||
    !text(event.reviewerId) ||
    !["approved", "pending", "revoked"].includes(event.status) ||
    event.sourcePolicyVersion !== policyVersion ||
    !Number.isFinite(reviewedAt) ||
    reviewedAt > now ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= reviewedAt
  )
    return false;
  const difference = event.difference;
  if (
    !difference ||
    Object.keys(difference).sort().join() !==
      "australianChunkIds,claimRole,localChunkIds,materialDifferenceReason,overlapReason,topicKey" ||
    !roles.includes(difference.claimRole) ||
    !text(difference.topicKey) ||
    !["same_claim", "same_topic_and_population"].includes(difference.overlapReason) ||
    !differenceReasons.includes(difference.materialDifferenceReason) ||
    !strings(difference.localChunkIds) ||
    !strings(difference.australianChunkIds)
  )
    return false;
  const ids = [...difference.localChunkIds, ...difference.australianChunkIds];
  return (
    Array.isArray(event.evidence) &&
    event.evidence.length === ids.length &&
    new Set(event.evidence.map((row) => row?.chunkId)).size === ids.length &&
    event.evidence.every(
      (row) =>
        row &&
        Object.keys(row).sort().join() === "chunkId,contentHash,documentId,sourceVersion" &&
        ids.includes(row.chunkId) &&
        text(row.documentId) &&
        text(row.sourceVersion) &&
        /^[a-f0-9]{64}$/.test(row.contentHash),
    )
  );
}

/** Freeze an append-only, version-bound review log once at the request boundary. */
export async function loadReviewedPolicyRequest<T extends SearchChunksArgs>(
  args: T,
  now = Date.now(),
  startedAt = Date.now(),
): Promise<T> {
  if (!args.ragRequestContext) return args;
  assertRagRequestContextIntegrity(args.ragRequestContext);
  const accessScope = retrievalAccessScopeForArgs(args);
  const scopeKey = retrievalAccessScopeKey(accessScope);
  if (
    args.reviewedPolicyRequest &&
    issued.has(args.reviewedPolicyRequest) &&
    args.reviewedPolicyRequest.snapshotCacheKey === args.ragRequestContext.snapshotCacheKey &&
    args.reviewedPolicyRequest.accessScopeKey === scopeKey
  )
    return args;
  let state: ReviewedPolicyRequest["state"] = "not_assessed";
  let differences: RequestDifference[] = [];
  if (args.loadReviewedSourcePolicyInput) {
    state = "unavailable";
    const deadline = createAnswerRouteDeadline({ routeMode: "strong", callerSignal: args.signal, startedAt });
    try {
      deadline.signal.throwIfAborted();
      const raw = await deadline.race(
        args.loadReviewedSourcePolicyInput({
          requestContext: args.ragRequestContext,
          accessScope: Object.freeze(accessScope),
          signal: deadline.signal,
        }),
      );
      if (args.signal?.aborted) throw args.signal.reason;
      if (!Array.isArray(raw) || raw.length > 64 || !Number.isFinite(now))
        throw new Error("Invalid reviewed policy log.");
      const current = new Map<string, ReviewedPolicyEvent>();
      for (const event of raw) {
        if (!validEvent(event, args.ragRequestContext.snapshot.sourcePolicyVersion, now))
          throw new Error("Invalid reviewed policy event.");
        const previous = current.get(event.recordId);
        if (
          event.sequence !== (previous?.sequence ?? 0) + 1 ||
          event.previousSequence !== (previous?.sequence ?? null) ||
          (previous && Date.parse(event.reviewedAt) < Date.parse(previous.reviewedAt))
        )
          throw new Error("Ambiguous reviewed policy history.");
        current.set(event.recordId, event);
      }
      differences = [...current.values()]
        .filter((event) => event.status === "approved" && Date.parse(event.expiresAt) > now)
        .map(({ difference, evidence, expiresAt }) => structuredClone({ difference, evidence, expiresAt }));
      state = differences.length ? "reviewed" : raw.length ? "unavailable" : "not_assessed";
    } catch {
      if (deadline.signal.aborted) throw deadline.signal.reason;
    } finally {
      deadline.dispose();
    }
  }
  const request: ReviewedPolicyRequest = Object.freeze({
    state,
    snapshotCacheKey: args.ragRequestContext.snapshotCacheKey,
    accessScopeKey: scopeKey,
    resolvedAt: now,
    differences: freezeReview(differences),
  });
  issued.add(request);
  // Raw caller-injected conflict objects do not establish human review authority.
  return {
    ...args,
    skipCache: args.skipCache || Boolean(args.loadReviewedSourcePolicyInput),
    sourcePolicyConflicts: [],
    reviewedPolicyRequest: request,
  };
}

/** Reuse the canonical resolver after the current request's access-filtered rows arrive. */
export function revalidateReviewedPolicyRequest(args: SearchChunksArgs, candidates: SearchResult[], now = Date.now()) {
  const request = args.reviewedPolicyRequest;
  const conflicts: SourcePolicyConflict[] = [];
  if (!request || !issued.has(request)) return { state: "not_assessed" as const, conflicts };
  const finish = (state: ReviewedPolicyRequest["state"]) => {
    effectiveReviewStates.set(request, state);
    return { state, conflicts };
  };
  if (
    !Number.isFinite(now) ||
    !args.ragRequestContext ||
    request.snapshotCacheKey !== args.ragRequestContext.snapshotCacheKey ||
    request.accessScopeKey !== retrievalAccessScopeKey(retrievalAccessScopeForArgs(args))
  )
    return finish("unavailable");
  for (const input of request.differences) {
    if (Date.parse(input.expiresAt) <= Math.max(request.resolvedAt, now)) continue;
    const bound = input.evidence.map((version) =>
      candidates.find(
        (row) =>
          row.id === version.chunkId &&
          row.document_id === version.documentId &&
          row.source_metadata?.version === version.sourceVersion &&
          row.source_metadata?.content_hash === version.contentHash,
      ),
    );
    if (bound.some((row) => !row)) continue;
    const currentEvidence = annotateSearchResults(args.query, bound as SearchResult[]);
    const result = resolveLocalAndAustralianEvidence({
      local: currentEvidence.filter((row) => row.corpus_scope === "uploaded_local"),
      australian: currentEvidence.filter((row) => row.corpus_scope === "australian_public"),
      claimRole: input.difference.claimRole,
      verifiedDifferences: [input.difference],
    });
    conflicts.push(...result.conflicts);
  }
  return finish(request.state === "reviewed" && !conflicts.length ? "unavailable" : request.state);
}
