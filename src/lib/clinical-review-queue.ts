import { normalizeSourceAuthorityText, sourceAuthorityForPublisherCode } from "@/lib/source-authority-registry";

type JsonRecord = Record<string, unknown>;

export type ClinicalReviewClass = "local_wa" | "third_party_reference" | "unknown";

type ObservedGovernance = {
  document_statuses: string[];
  clinical_validation_statuses: string[];
  extraction_qualities: string[];
};

export type ClinicalReviewQueueEntry = {
  key: string;
  document_id: string | null;
  title: string;
  file_name: string;
  publisher_code: string | null;
  jurisdiction: string | null;
  top_result_slots: number;
  best_rank: number;
  case_ids: string[];
  review_class: ClinicalReviewClass;
  reasons: string[];
  observed: ObservedGovernance;
};

export type ClinicalReviewQueue = {
  version: "clinical-review-queue-v1";
  source_generated_at: string | null;
  status_change_policy: string;
  entry_count: number;
  entries: ClinicalReviewQueueEntry[];
};

export type TopLocalReviewEvidenceEntry = Omit<ClinicalReviewQueueEntry, "reasons"> & {
  review_status: "pending_qualified_human_review";
  attestation_applied: false;
};

export type TopLocalReviewEvidenceManifest = {
  version: "top-local-review-evidence-v1";
  source_artifact: string | null;
  source_generated_at: string | null;
  review_status: "pending_qualified_human_review";
  attestation_applied: false;
  entry_count: number;
  entries: TopLocalReviewEvidenceEntry[];
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedIdentity(value: string) {
  return value.trim().toLowerCase();
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function retrievalResults(input: unknown) {
  const root = record(input);
  const retrieval = record(root?.retrieval);
  const candidates = retrieval?.results ?? root?.results ?? (Array.isArray(input) ? input : null);
  if (!Array.isArray(candidates)) throw new Error("Eval JSON must contain retrieval.results or a results array.");
  return candidates.map(record).filter((item): item is JsonRecord => item !== null);
}

function topResults(result: JsonRecord) {
  return Array.isArray(result.topResults)
    ? result.topResults.map(record).filter((item): item is JsonRecord => item !== null)
    : [];
}

function reviewReasons(result: JsonRecord) {
  const status = text(result.document_status) ?? "unknown";
  const validation = text(result.clinical_validation_status) ?? "unverified";
  const extraction = text(result.extraction_quality) ?? "unknown";
  const reasons: string[] = [];
  if (["outdated", "review_due", "unknown"].includes(status)) reasons.push(`document_status:${status}`);
  if (validation === "unverified") reasons.push("clinical_validation_status:unverified");
  if (["unknown", "poor"].includes(extraction)) reasons.push(`extraction_quality:${extraction}`);
  return { status, validation, extraction, reasons };
}

function sourceReviewClass(source: JsonRecord): ClinicalReviewClass {
  const publisherCode = text(source.publisher_code);
  const authority = sourceAuthorityForPublisherCode(publisherCode);
  if (authority?.scope === "wa") return "local_wa";
  if (authority) return "third_party_reference";

  const jurisdiction = normalizeSourceAuthorityText(text(source.jurisdiction));
  return ["australia/wa", "australia/western australia", "western australia", "wa"].includes(jurisdiction)
    ? "local_wa"
    : "unknown";
}

function positiveRank(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

type QueueAccumulator = {
  documentId: string | null;
  title: string;
  fileName: string;
  slots: number;
  bestRank: number;
  caseIds: Set<string>;
  reasons: Set<string>;
  statuses: Set<string>;
  validations: Set<string>;
  extractions: Set<string>;
  publisherCodes: Set<string>;
  jurisdictions: Set<string>;
  reviewClasses: Set<ClinicalReviewClass>;
};

function resolvedReviewClass(classes: Set<ClinicalReviewClass>): ClinicalReviewClass {
  const recognized = [...classes].filter((value) => value !== "unknown");
  return new Set(recognized).size === 1 ? recognized[0]! : "unknown";
}

function aggregateSources(input: unknown, reviewRequiredOnly: boolean) {
  const root = record(input);
  const results = retrievalResults(input);
  const documentIdByFileName = new Map<string, string>();
  for (const result of results) {
    for (const source of topResults(result)) {
      const fileName = text(source.file_name);
      const documentId = text(source.document_id);
      if (fileName && documentId) documentIdByFileName.set(normalizedIdentity(fileName), documentId);
    }
  }

  const queue = new Map<string, QueueAccumulator>();
  for (const [caseIndex, result] of results.entries()) {
    const caseId = text(result.id) ?? `case-${caseIndex + 1}`;
    for (const [sourceIndex, source] of topResults(result).entries()) {
      const governance = reviewReasons(source);
      if (reviewRequiredOnly && governance.reasons.length === 0) continue;
      const sourceFileName = text(source.file_name);
      const fileName = sourceFileName ?? "unknown";
      const title = text(source.title) ?? fileName;
      const documentId = text(source.document_id) ?? documentIdByFileName.get(normalizedIdentity(fileName)) ?? null;
      const key = documentId
        ? `document:${documentId}`
        : sourceFileName
          ? `file:${normalizedIdentity(sourceFileName)}`
          : `title:${normalizedIdentity(title)}`;
      const current = queue.get(key) ?? {
        documentId,
        title,
        fileName,
        slots: 0,
        bestRank: Number.POSITIVE_INFINITY,
        caseIds: new Set<string>(),
        reasons: new Set<string>(),
        statuses: new Set<string>(),
        validations: new Set<string>(),
        extractions: new Set<string>(),
        publisherCodes: new Set<string>(),
        jurisdictions: new Set<string>(),
        reviewClasses: new Set<ClinicalReviewClass>(),
      };
      current.slots += 1;
      current.bestRank = Math.min(current.bestRank, positiveRank(source.rank, sourceIndex + 1));
      current.caseIds.add(caseId);
      for (const reason of governance.reasons) current.reasons.add(reason);
      current.statuses.add(governance.status);
      current.validations.add(governance.validation);
      current.extractions.add(governance.extraction);
      const publisherCode = text(source.publisher_code);
      const jurisdiction = text(source.jurisdiction);
      if (publisherCode) current.publisherCodes.add(publisherCode);
      if (jurisdiction) current.jurisdictions.add(jurisdiction);
      current.reviewClasses.add(sourceReviewClass(source));
      queue.set(key, current);
    }
  }
  return { root, queue };
}

function queueEntry(key: string, item: QueueAccumulator): ClinicalReviewQueueEntry {
  return {
    key,
    document_id: item.documentId,
    title: item.title,
    file_name: item.fileName,
    publisher_code: [...item.publisherCodes].sort()[0] ?? null,
    jurisdiction: [...item.jurisdictions].sort()[0] ?? null,
    top_result_slots: item.slots,
    best_rank: item.bestRank,
    case_ids: [...item.caseIds].sort(),
    review_class: resolvedReviewClass(item.reviewClasses),
    reasons: [...item.reasons].sort(),
    observed: {
      document_statuses: [...item.statuses].sort(),
      clinical_validation_statuses: [...item.validations].sort(),
      extraction_qualities: [...item.extractions].sort(),
    },
  };
}

/** Build a deterministic, deduplicated work queue from an eval-quality JSON
 * report. The queue only records observed states and review reasons; it never
 * proposes or writes a replacement governance status. */
export function buildClinicalReviewQueue(input: unknown): ClinicalReviewQueue {
  const { root, queue } = aggregateSources(input, true);
  const entries = [...queue.entries()]
    .map(([key, item]) => queueEntry(key, item))
    .sort(
      (left, right) =>
        right.top_result_slots - left.top_result_slots ||
        compareText(left.file_name, right.file_name) ||
        compareText(left.key, right.key),
    );

  return {
    version: "clinical-review-queue-v1",
    source_generated_at: text(root?.generated_at),
    status_change_policy:
      "Clinical evidence must be reviewed before document_status or clinical_validation_status changes; this queue never auto-promotes either status.",
    entry_count: entries.length,
    entries,
  };
}

/** Build a visibility-weighted evidence pack for qualified human review. It
 * includes warning-bearing local WA results and cannot express an applied
 * attestation. */
export function buildTopLocalReviewEvidenceManifest(
  input: unknown,
  options: { limit?: number; sourceArtifact?: string } = {},
): TopLocalReviewEvidenceManifest {
  const { root, queue } = aggregateSources(input, true);
  const limit = Math.max(0, Math.trunc(options.limit ?? 10));
  const entries = [...queue.entries()]
    .map(([key, item]) => queueEntry(key, item))
    .filter((entry) => entry.review_class === "local_wa")
    .sort(
      (left, right) =>
        right.top_result_slots - left.top_result_slots ||
        left.best_rank - right.best_rank ||
        compareText(left.file_name, right.file_name) ||
        compareText(left.key, right.key),
    )
    .slice(0, limit)
    .map((entry): TopLocalReviewEvidenceEntry => ({
      key: entry.key,
      document_id: entry.document_id,
      title: entry.title,
      file_name: entry.file_name,
      publisher_code: entry.publisher_code,
      jurisdiction: entry.jurisdiction,
      top_result_slots: entry.top_result_slots,
      best_rank: entry.best_rank,
      case_ids: entry.case_ids,
      review_class: entry.review_class,
      observed: entry.observed,
      review_status: "pending_qualified_human_review",
      attestation_applied: false,
    }));

  return {
    version: "top-local-review-evidence-v1",
    source_artifact: text(options.sourceArtifact),
    source_generated_at: text(root?.generated_at),
    review_status: "pending_qualified_human_review",
    attestation_applied: false,
    entry_count: entries.length,
    entries,
  };
}
