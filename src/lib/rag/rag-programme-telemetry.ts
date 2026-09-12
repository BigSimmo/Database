import type {
  RagAugmentationOutcome,
  RagGenerationOutcome,
  RagProgrammeMode,
  RagQueryPlanKind,
  RagReconciliationOutcome,
} from "@/lib/rag/rag-programme-eval";
import {
  sanitizeRagCandidateMatchCounts,
  type RagCandidateMatchCounts,
  type RagObservationContext,
} from "@/lib/rag/rag-contracts";
import { ragAnswerQueryPlanDiagnostics } from "@/lib/rag/rag-cache";
import {
  classifyRagFallbackReason,
  isProviderGenerationFallbackCode,
  normalizeRagFallbackReasonCode,
} from "@/lib/rag/rag-fallback-reason";
import type {
  RagAnswer,
  RagFallbackReasonCode,
  RagInsufficiencyReason,
  RetrievalDiagnostics,
  SiteContentDomain,
  SiteContentPartitionState,
  SourceCorpusScope,
} from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORPUS_SCOPES = [
  "uploaded_local",
  "clinical_kb_site",
  "australian_public",
  "international_supplementary",
] as const satisfies readonly SourceCorpusScope[];
const PROGRAMME_MODES = ["legacy", "shadow", "canary"] as const satisfies readonly RagProgrammeMode[];
const QUERY_PLAN_KINDS = [
  "single",
  "decomposed",
  "clarification_required",
] as const satisfies readonly RagQueryPlanKind[];
const SITE_DOMAINS = [
  "services",
  "forms",
  "medications",
  "differentials",
  "specifiers",
  "dsm",
  "formulation",
  "therapies",
  "dictionary",
  "factsheets",
  "calculators",
  "tools",
] as const satisfies readonly SiteContentDomain[];
const SITE_STATES = [
  "current",
  "updating",
  "stale",
  "unavailable",
  "disabled",
] as const satisfies readonly SiteContentPartitionState[];
const PENDING_COUNT_BUCKETS = ["0", "1", "2_to_5", "6_plus"] as const;
const AUGMENTATION_OUTCOMES = [
  "not_needed",
  "used",
  "no_eligible_evidence",
  "unavailable",
  "disabled",
] as const satisfies readonly RagAugmentationOutcome[];
const INSUFFICIENCY_REASONS = [
  "not_in_corpus",
  "retrieval_miss",
  "insufficient_claim_support",
  "source_role_mismatch",
  "source_conflict",
  "governance_block",
  "site_content_updating",
  "site_content_stale",
  "site_content_unavailable",
  "timeout",
  "provider_failure",
] as const satisfies readonly RagInsufficiencyReason[];
const GENERATION_OUTCOMES = [
  "generated",
  "extractive",
  "source_only",
  "failed",
] as const satisfies readonly RagGenerationOutcome[];
const RECONCILIATION_OUTCOMES = [
  "not_applicable",
  "matched",
  "mismatch",
] as const satisfies readonly RagReconciliationOutcome[];
const FALLBACK_REASON_CODES = [
  "provider_offline",
  "provider_missing_key",
  "provider_auth",
  "provider_quota",
  "provider_rate_limit",
  "provider_timeout",
  "provider_failure",
  "retrieval_degraded",
  "no_candidates",
  "low_signal",
  "coverage_gap",
  "source_role_mismatch",
  "source_conflict",
  "source_governance_block",
  "site_content_updating",
  "site_content_stale",
  "site_content_unavailable",
  "citation_or_claim_gate",
  "unsupported",
  "unknown",
] as const satisfies readonly RagFallbackReasonCode[];

type ProgrammeCounts = Record<SourceCorpusScope, number>;
type CoverageCounts = { direct: number; partial: number; conflicting: number; absent: number };
type PendingCountBucket = (typeof PENDING_COUNT_BUCKETS)[number];

export type RagProgrammeTelemetry = {
  version: "rag-programme-telemetry-v1";
  interaction_id: string;
  rollout_mode: RagProgrammeMode;
  query_plan_kind: RagQueryPlanKind;
  subquestion_count: number;
  material_ambiguity: boolean;
  coverage_counts: CoverageCounts;
  candidate_match_counts: RagCandidateMatchCounts | null;
  candidate_counts: ProgrammeCounts;
  selected_counts: ProgrammeCounts;
  selected_site_domains: SiteContentDomain[];
  site_candidate_count: number;
  site_selected_count: number;
  public_site_content_state: SiteContentPartitionState;
  site_static_manifest_match: boolean | null;
  site_pending_count_bucket: PendingCountBucket | null;
  augmentation_outcome: RagAugmentationOutcome;
  role_exclusion_count: number;
  insufficiency_reason: RagInsufficiencyReason | null;
  fallback_reason_code: RagFallbackReasonCode | null;
  generation_outcome: RagGenerationOutcome;
  verified_units_emitted: number;
  verified_units_discarded: number;
  reconciliation_outcome: RagReconciliationOutcome;
};

export type RagProgrammeTelemetryInput = {
  interactionId: string;
  rolloutMode: RagProgrammeMode;
  queryPlanKind: RagQueryPlanKind;
  subquestionCount: number;
  materialAmbiguity: boolean;
  coverageCounts: CoverageCounts;
  candidateMatchCounts: RagCandidateMatchCounts | null;
  candidateCounts: ProgrammeCounts;
  selectedCounts: ProgrammeCounts;
  selectedSiteDomains: SiteContentDomain[];
  siteCandidateCount: number;
  siteSelectedCount: number;
  publicSiteContentState: SiteContentPartitionState;
  siteStaticManifestMatch: boolean | null;
  sitePendingCountBucket: PendingCountBucket | null;
  augmentationOutcome: RagAugmentationOutcome;
  roleExclusionCount: number;
  insufficiencyReason: RagInsufficiencyReason | null;
  fallbackReasonCode?: RagFallbackReasonCode | null;
  /** Future decomposed coverage owners can supply nested reasons; validate them even though v1 emits one aggregate reason. */
  nestedInsufficiencyReasons?: Array<RagInsufficiencyReason | null>;
  generationOutcome: RagGenerationOutcome;
  verifiedUnitsEmitted: number;
  verifiedUnitsDiscarded: number;
  reconciliationOutcome: RagReconciliationOutcome;
};

export type RagQueryObservation = {
  sourceChunkIds: string[];
  model: string | null;
  metadata: Record<string, unknown>;
};

type RagQueryObservationRow = {
  source_chunk_ids?: string[] | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
};

const programmeTelemetryByAnswer = new WeakMap<RagAnswer, RagProgrammeTelemetry>();
const queryObservationByAnswer = new WeakMap<RagAnswer, RagQueryObservation>();

function enumValue<T extends string>(name: string, value: unknown, allowed: readonly T[]): T {
  if (typeof value === "string" && allowed.includes(value as T)) return value as T;
  throw new TypeError(`Invalid ${name}.`);
}

function nullableEnumValue<T extends string>(name: string, value: unknown, allowed: readonly T[]): T | null {
  return value === null ? null : enumValue(name, value, allowed);
}

function countValue(name: string, value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new TypeError(`Invalid ${name}.`);
}

function booleanValue(name: string, value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new TypeError(`Invalid ${name}.`);
}

function nullableBooleanValue(name: string, value: unknown): boolean | null {
  return value === null ? null : booleanValue(name, value);
}

function projectCounts(name: string, counts: ProgrammeCounts): ProgrammeCounts {
  return Object.fromEntries(
    CORPUS_SCOPES.map((scope) => [scope, countValue(`${name}.${scope}`, counts[scope])]),
  ) as ProgrammeCounts;
}

function projectCoverageCounts(counts: CoverageCounts): CoverageCounts {
  return {
    direct: countValue("coverageCounts.direct", counts.direct),
    partial: countValue("coverageCounts.partial", counts.partial),
    conflicting: countValue("coverageCounts.conflicting", counts.conflicting),
    absent: countValue("coverageCounts.absent", counts.absent),
  };
}

function projectCandidateMatchCounts(
  counts: RagCandidateMatchCounts | null,
  subquestionCount: number,
): RagCandidateMatchCounts | null {
  if (counts === null) return null;
  const sanitized = sanitizeRagCandidateMatchCounts(counts, subquestionCount);
  if (!sanitized) throw new TypeError("Invalid candidateMatchCounts.");
  return sanitized;
}

export function buildRagProgrammeTelemetry(input: RagProgrammeTelemetryInput): RagProgrammeTelemetry {
  if (!UUID_PATTERN.test(input.interactionId)) throw new TypeError("Invalid interactionId.");
  for (const [index, reason] of (input.nestedInsufficiencyReasons ?? []).entries()) {
    nullableEnumValue(`nestedInsufficiencyReasons[${index}]`, reason, INSUFFICIENCY_REASONS);
  }
  const selectedSiteDomains = input.selectedSiteDomains.map((domain, index) =>
    enumValue(`selectedSiteDomains[${index}]`, domain, SITE_DOMAINS),
  );
  const subquestionCount = countValue("subquestionCount", input.subquestionCount);

  return {
    version: "rag-programme-telemetry-v1",
    interaction_id: input.interactionId,
    rollout_mode: enumValue("rolloutMode", input.rolloutMode, PROGRAMME_MODES),
    query_plan_kind: enumValue("queryPlanKind", input.queryPlanKind, QUERY_PLAN_KINDS),
    subquestion_count: subquestionCount,
    material_ambiguity: booleanValue("materialAmbiguity", input.materialAmbiguity),
    coverage_counts: projectCoverageCounts(input.coverageCounts),
    candidate_match_counts: projectCandidateMatchCounts(input.candidateMatchCounts, subquestionCount),
    candidate_counts: projectCounts("candidateCounts", input.candidateCounts),
    selected_counts: projectCounts("selectedCounts", input.selectedCounts),
    selected_site_domains: [...new Set(selectedSiteDomains)],
    site_candidate_count: countValue("siteCandidateCount", input.siteCandidateCount),
    site_selected_count: countValue("siteSelectedCount", input.siteSelectedCount),
    public_site_content_state: enumValue("publicSiteContentState", input.publicSiteContentState, SITE_STATES),
    site_static_manifest_match: nullableBooleanValue("siteStaticManifestMatch", input.siteStaticManifestMatch),
    site_pending_count_bucket: nullableEnumValue(
      "sitePendingCountBucket",
      input.sitePendingCountBucket,
      PENDING_COUNT_BUCKETS,
    ),
    augmentation_outcome: enumValue("augmentationOutcome", input.augmentationOutcome, AUGMENTATION_OUTCOMES),
    role_exclusion_count: countValue("roleExclusionCount", input.roleExclusionCount),
    insufficiency_reason: nullableEnumValue("insufficiencyReason", input.insufficiencyReason, INSUFFICIENCY_REASONS),
    fallback_reason_code: nullableEnumValue(
      "fallbackReasonCode",
      input.fallbackReasonCode ?? null,
      FALLBACK_REASON_CODES,
    ),
    generation_outcome: enumValue("generationOutcome", input.generationOutcome, GENERATION_OUTCOMES),
    verified_units_emitted: countValue("verifiedUnitsEmitted", input.verifiedUnitsEmitted),
    verified_units_discarded: countValue("verifiedUnitsDiscarded", input.verifiedUnitsDiscarded),
    reconciliation_outcome: enumValue("reconciliationOutcome", input.reconciliationOutcome, RECONCILIATION_OUTCOMES),
  };
}

function emptyProgrammeCounts(): ProgrammeCounts {
  return {
    uploaded_local: 0,
    clinical_kb_site: 0,
    australian_public: 0,
    international_supplementary: 0,
  };
}

function fallbackReasonCodeForAnswer(answer: RagAnswer): RagFallbackReasonCode | null {
  if (Object.prototype.hasOwnProperty.call(answer, "fallbackReasonCode")) {
    return normalizeRagFallbackReasonCode(answer.fallbackReasonCode);
  }
  const legacyReason = [answer.fallbackReason, answer.degradedMode?.reason, answer.routingReason]
    .filter(Boolean)
    .join("; ");
  return legacyReason ? classifyRagFallbackReason({ routingReason: legacyReason }) : null;
}

function insufficiencyReasonForAnswer(answer: RagAnswer): RagInsufficiencyReason | null {
  const code = fallbackReasonCodeForAnswer(answer);
  if (code === "provider_timeout") return "timeout";
  if (code?.startsWith("provider_")) return "provider_failure";
  if (code === "no_candidates" || code === "low_signal" || code === "retrieval_degraded") return "retrieval_miss";
  if (code === "coverage_gap" || code === "citation_or_claim_gate") return "insufficient_claim_support";
  if (code === "source_role_mismatch") return "source_role_mismatch";
  if (code === "source_conflict") return "source_conflict";
  if (code === "source_governance_block") return "governance_block";
  if (code === "site_content_updating") return "site_content_updating";
  if (code === "site_content_stale") return "site_content_stale";
  if (code === "site_content_unavailable") return "site_content_unavailable";
  const reason = [answer.fallbackReason, answer.routingReason, answer.retrievalDiagnostics?.fallbackReason]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/governance|prompt.injection/.test(reason)) return "governance_block";
  if (/source[_ ]role/.test(reason)) return "source_role_mismatch";
  if (/conflict/.test(reason)) return "source_conflict";
  if (/out.of.corpus|not.in.corpus/.test(reason)) return "not_in_corpus";
  if (/timeout|deadline|max_output_tokens/.test(reason)) return "timeout";
  if (/provider|openai|generation_failure/.test(reason)) return "provider_failure";
  if (/claim.support|numeric.faithfulness|insufficient/.test(reason)) return "insufficient_claim_support";
  if (/retrieval|no_candidates|no.results|low_signal/.test(reason)) return "retrieval_miss";
  return answer.grounded === false || answer.confidence === "unsupported" ? "insufficient_claim_support" : null;
}

function generationOutcomeForAnswer(answer: RagAnswer): RagGenerationOutcome {
  if (
    answer.grounded === false ||
    answer.confidence === "unsupported" ||
    answer.routingMode === "unsupported" ||
    answer.responseMode === "evidence_gap"
  )
    return "failed";
  if (
    isProviderGenerationFallbackCode(fallbackReasonCodeForAnswer(answer)) ||
    answer.answerQualityTier === "source_only" ||
    answer.providerMode === "offline"
  )
    return "source_only";
  if (answer.routingMode === "extractive" || (answer.modelUsed == null && answer.grounded)) return "extractive";
  if (answer.modelUsed) return "generated";
  return answer.grounded ? "extractive" : "failed";
}

function coverageCountsForAnswer(answer: RagAnswer): CoverageCounts {
  const counts: CoverageCounts = { direct: 0, partial: 0, conflicting: 0, absent: 0 };
  if (answer.supportedClaims?.length) {
    for (const claim of answer.supportedClaims) {
      if (claim.supportStatus === "direct") counts.direct += 1;
      else if (claim.supportStatus === "partial") counts.partial += 1;
      else counts.absent += 1;
    }
  } else if (answer.grounded && answer.confidence !== "unsupported") {
    counts.direct = 1;
  } else {
    counts.absent = 1;
  }
  counts.conflicting = answer.conflictsOrGaps?.filter((item) => item.type === "conflict").length ?? 0;
  return counts;
}

function inputForAnswer(answer: RagAnswer, context: RagObservationContext): RagProgrammeTelemetryInput {
  const queryPlan = ragAnswerQueryPlanDiagnostics(answer);
  const candidates = emptyProgrammeCounts();
  const selected = emptyProgrammeCounts();
  candidates.uploaded_local = Math.max(answer.retrievalDiagnostics?.candidateCount ?? answer.sources.length, 0);
  selected.uploaded_local = answer.sources.length;
  return {
    interactionId: context.interactionId,
    rolloutMode: context.rolloutMode,
    queryPlanKind: queryPlan?.queryPlanKind ?? "single",
    subquestionCount: queryPlan?.subquestionCount ?? 1,
    materialAmbiguity: queryPlan?.queryPlanKind === "clarification_required",
    coverageCounts: coverageCountsForAnswer(answer),
    candidateMatchCounts: context.rolloutMode === "shadow" ? (queryPlan?.candidateMatchCounts ?? null) : null,
    candidateCounts: candidates,
    selectedCounts: selected,
    selectedSiteDomains: [],
    siteCandidateCount: 0,
    siteSelectedCount: 0,
    publicSiteContentState: "disabled",
    siteStaticManifestMatch: null,
    sitePendingCountBucket: null,
    augmentationOutcome: "disabled",
    roleExclusionCount: 0,
    insufficiencyReason: insufficiencyReasonForAnswer(answer),
    fallbackReasonCode: fallbackReasonCodeForAnswer(answer),
    generationOutcome: generationOutcomeForAnswer(answer),
    verifiedUnitsEmitted: 0,
    verifiedUnitsDiscarded: 0,
    reconciliationOutcome: "not_applicable",
  };
}

export function observeRagAnswer(answer: RagAnswer, context?: RagObservationContext): RagAnswer {
  if (!context) return answer;
  programmeTelemetryByAnswer.set(answer, buildRagProgrammeTelemetry(inputForAnswer(answer, context)));
  if (!queryObservationByAnswer.has(answer)) {
    queryObservationByAnswer.set(answer, {
      sourceChunkIds: answer.sources.map((source) => source.id),
      model: answer.modelUsed ?? null,
      metadata: {},
    });
  }
  return answer;
}

export function carryRagProgrammeTelemetry(source: RagAnswer, target: RagAnswer): RagAnswer {
  const telemetry = programmeTelemetryByAnswer.get(source);
  if (telemetry) {
    observeRagAnswer(target, { interactionId: telemetry.interaction_id, rolloutMode: telemetry.rollout_mode });
    const finalTelemetry = programmeTelemetryByAnswer.get(target)!;
    programmeTelemetryByAnswer.set(target, {
      ...finalTelemetry,
      query_plan_kind: telemetry.query_plan_kind,
      subquestion_count: telemetry.subquestion_count,
      material_ambiguity: telemetry.material_ambiguity,
      candidate_match_counts: telemetry.candidate_match_counts ? { ...telemetry.candidate_match_counts } : null,
      candidate_counts: { ...telemetry.candidate_counts },
      selected_counts: { ...telemetry.selected_counts },
      selected_site_domains: [...telemetry.selected_site_domains],
      site_candidate_count: telemetry.site_candidate_count,
      site_selected_count: telemetry.site_selected_count,
      public_site_content_state: telemetry.public_site_content_state,
      site_static_manifest_match: telemetry.site_static_manifest_match,
      site_pending_count_bucket: telemetry.site_pending_count_bucket,
      augmentation_outcome: telemetry.augmentation_outcome,
      role_exclusion_count: telemetry.role_exclusion_count,
    });
  }
  const observation = queryObservationByAnswer.get(source);
  if (observation) queryObservationByAnswer.set(target, observation);
  return target;
}

export function ragProgrammeTelemetryForAnswer(answer: RagAnswer): RagProgrammeTelemetry | undefined {
  return programmeTelemetryByAnswer.get(answer);
}

export function setRagQueryObservation(answer: RagAnswer, observation: RagQueryObservation): void {
  queryObservationByAnswer.set(answer, observation);
}

export async function recordRagQueryForAnswer<T extends RagQueryObservationRow>(
  context: RagObservationContext | undefined,
  answer: RagAnswer,
  row: T,
  legacyWriter: (row: T) => Promise<void>,
): Promise<void> {
  const loggedRow = {
    ...row,
    metadata: {
      ...row.metadata,
      fallback_reason_code: fallbackReasonCodeForAnswer(answer),
      provider_generation_truncated: Boolean(answer.latencyTimings?.provider_generation_truncated),
    },
  } as T;
  if (!context) return legacyWriter(loggedRow);
  setRagQueryObservation(answer, {
    sourceChunkIds: loggedRow.source_chunk_ids ?? [],
    model: loggedRow.model ?? null,
    metadata: loggedRow.metadata ?? {},
  });
}

export function ragQueryObservationForAnswer(answer: RagAnswer): RagQueryObservation | undefined {
  return queryObservationByAnswer.get(answer);
}

export function buildRagQueryMetadata(telemetry: RagProgrammeTelemetry, includeDiagnostics: boolean) {
  return {
    interaction_id: telemetry.interaction_id,
    ...(includeDiagnostics ? { rag_programme: telemetry } : {}),
  };
}

export function retrievalLogMetadata(diagnostics: RetrievalDiagnostics) {
  return {
    retrieval_depth: diagnostics.retrievalDepth,
    retrieval_distinct_documents: diagnostics.distinctDocumentCount,
    retrieval_candidate_count: diagnostics.candidateCount,
    retrieval_top_score: diagnostics.topScore,
    retrieval_second_score: diagnostics.secondScore,
    retrieval_score_spread: diagnostics.scoreSpread,
    retrieval_gate_status: diagnostics.gateStatus,
    retrieval_fallback_reason: diagnostics.fallbackReason,
    retrieval_reason: diagnostics.retrievalReason,
    retrieval_query_class: diagnostics.queryClass,
    retrieval_route_mode: diagnostics.routeMode,
  };
}
