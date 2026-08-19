import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import * as nextEnv from "@next/env";
import { auditSourceAuthorityDocuments, isRegistryRecordSource } from "@/lib/source-authority-metadata";
import {
  BMJ_THIRD_PARTY_ATTESTATION_BASIS,
  countOperationalUnattestedReviewDebt,
  type BmjThirdPartyAttestationEvent,
} from "@/lib/source-review";
import type { DocumentLabel } from "@/lib/types";

export type AuditableRecord = {
  record: Record<string, unknown>;
  recordType: string;
  identifier: string;
  title: string;
  source: string;
};

export type ReviewAttributionViolation = {
  record_type: string;
  identifier: string;
  title: string;
  source: string;
  review_status: string;
  found_attribution: Record<string, string>;
  reason: string;
};

export type ReviewAttributionAuditReport = {
  audited_record_count: number;
  reviewed_record_count: number;
  unattributed_reviewed_record_count: number;
  passed: boolean;
  violations: ReviewAttributionViolation[];
};

const TRIVIAL_REVIEWER_PATTERNS = new Set([
  "",
  "unknown",
  "none",
  "n/a",
  "na",
  "null",
  "undefined",
  "todo",
  "tbd",
  "test",
  "testing",
  "placeholder",
  "anonymous",
  "anon",
  "unattributed",
  "unassigned",
  "missing",
  "pending",
  "default",
  "system",
  "bot",
  "automated",
  "auto",
]);

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export function isNonTrivialReviewerString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (TRIVIAL_REVIEWER_PATTERNS.has(trimmed.toLowerCase())) return false;
  if (trimmed === NIL_UUID) return false;
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return false;
  return true;
}

export function isRecordMarkedReviewed(record: Record<string, unknown>): {
  isReviewed: boolean;
  rawStatus: string | null;
} {
  const metadata = metadataRecord(record.metadata);
  const candidates = [record.reviewStatus, record.review_status, metadata.reviewStatus, metadata.review_status];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const normalized = candidate.trim().toLowerCase();
      if (normalized === "reviewed") {
        return { isReviewed: true, rawStatus: candidate.trim() };
      }
    }
  }

  return { isReviewed: false, rawStatus: null };
}

export function extractReviewerAttribution(record: Record<string, unknown>): {
  hasAttribution: boolean;
  attribution: unknown;
  foundFields: Record<string, unknown>;
} {
  const metadata = metadataRecord(record.metadata);
  const reviewChecklist = metadataRecord(record.reviewChecklist);
  const clinicalValidationEvidence = metadataRecord(metadata.clinical_validation_evidence);
  const attestation = metadataRecord(record.attestation ?? metadata.attestation);

  const candidateEntries: Array<[string, unknown]> = [
    ["reviewedBy", record.reviewedBy],
    ["reviewed_by", record.reviewed_by],
    ["reviewedByClinician", record.reviewedByClinician],
    ["reviewer", record.reviewer],
    ["reviewer_id", record.reviewer_id],
    ["reviewer_name", record.reviewer_name],
    ["reviewerQualification", record.reviewerQualification],
    ["reviewer_qualification", record.reviewer_qualification],
    ["metadata.reviewedBy", metadata.reviewedBy],
    ["metadata.reviewed_by", metadata.reviewed_by],
    ["metadata.reviewer", metadata.reviewer],
    ["metadata.reviewer_id", metadata.reviewer_id],
    ["metadata.reviewer_name", metadata.reviewer_name],
    ["metadata.reviewer_qualification", metadata.reviewer_qualification],
    ["metadata.clinical_validation_evidence.attested_by", clinicalValidationEvidence.attested_by],
    ["metadata.clinical_validation_evidence.reviewer_id", clinicalValidationEvidence.reviewer_id],
    ["reviewChecklist.reviewedBy", reviewChecklist.reviewedBy],
    ["reviewChecklist.reviewer", reviewChecklist.reviewer],
    ["attestation.reviewedBy", attestation.reviewedBy],
    ["attestation.reviewer", attestation.reviewer],
    ["attestation.attested_by", attestation.attested_by],
  ];

  const foundFields: Record<string, unknown> = {};
  for (const [key, value] of candidateEntries) {
    if (value !== undefined && value !== null) {
      foundFields[key] = value;
    }
  }

  for (const [, value] of candidateEntries) {
    if (isNonTrivialReviewerString(value)) {
      return { hasAttribution: true, attribution: value.trim(), foundFields };
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const innerCandidateKeys = [
        "name",
        "reviewer_name",
        "full_name",
        "id",
        "reviewer_id",
        "user_id",
        "email",
        "qualification",
        "reviewer_qualification",
        "title",
      ];
      for (const innerKey of innerCandidateKeys) {
        const innerVal = obj[innerKey];
        if (isNonTrivialReviewerString(innerVal)) {
          return { hasAttribution: true, attribution: innerVal.trim(), foundFields };
        }
      }
    }
    if (Array.isArray(value) && value.length > 0) {
      for (const item of value) {
        if (isNonTrivialReviewerString(item)) {
          return { hasAttribution: true, attribution: item.trim(), foundFields };
        }
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const obj = item as Record<string, unknown>;
          for (const innerKey of ["name", "id", "reviewer_id", "email", "qualification"]) {
            const innerVal = obj[innerKey];
            if (isNonTrivialReviewerString(innerVal)) {
              return { hasAttribution: true, attribution: innerVal.trim(), foundFields };
            }
          }
        }
      }
    }
  }

  return { hasAttribution: false, attribution: null, foundFields };
}

export function auditReviewAttribution(records: AuditableRecord[]): ReviewAttributionAuditReport {
  const violations: ReviewAttributionViolation[] = [];
  let reviewedCount = 0;

  for (const item of records) {
    const { isReviewed, rawStatus } = isRecordMarkedReviewed(item.record);
    if (!isReviewed) continue;

    reviewedCount += 1;
    const { hasAttribution, foundFields } = extractReviewerAttribution(item.record);

    if (!hasAttribution) {
      const attributionFieldNames = Object.keys(foundFields).sort();
      const redactedAttributionFields = Object.fromEntries(
        attributionFieldNames.map((fieldName) => [fieldName, "[redacted]"]),
      );
      violations.push({
        record_type: item.recordType,
        identifier: item.identifier,
        title: item.title,
        source: item.source,
        review_status: rawStatus ?? "reviewed",
        found_attribution: redactedAttributionFields,
        reason:
          attributionFieldNames.length === 0
            ? "Record is marked as reviewed but has no reviewer attribution (e.g. reviewedBy or reviewer field is missing)."
            : `Record is marked as reviewed but reviewer attribution contains empty or trivial placeholder value(s) in: ${attributionFieldNames.join(", ")}.`,
      });
    }
  }

  return {
    audited_record_count: records.length,
    reviewed_record_count: reviewedCount,
    unattributed_reviewed_record_count: violations.length,
    passed: violations.length === 0,
    violations,
  };
}

async function loadStaticJson<T>(relativePath: string): Promise<T> {
  const fullPath = join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Required source governance input is missing: ${relativePath}`);
  }
  try {
    const raw = await readFile(fullPath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Required source governance input is missing: ${relativePath}`, { cause: error });
    }
    throw new Error(
      `Failed to load source governance input: ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

const loadEnvConfig =
  nextEnv.loadEnvConfig ??
  (nextEnv as unknown as { default?: { loadEnvConfig?: typeof nextEnv.loadEnvConfig } }).default?.loadEnvConfig;

type AuditArgs = {
  json: boolean;
  help: boolean;
  debtPolicyPath?: string;
};

type DebtPolicy = {
  path: string;
  accepted: boolean;
  accepted_by: string;
  accepted_at: string;
  expires_at?: string;
  ceilings: {
    max_stale_rate: number;
    max_review_required_rate: number;
    max_outdated_top_results: number;
    max_poor_extraction_top_results: number;
    max_source_governance_danger_failure_rate: number;
  };
  observed_retrieval_eval?: {
    stale_rate?: number;
    review_required_rate?: number;
    stale_top_results?: number;
    poor_extraction_top_results?: number;
  };
};

type SupabaseAdmin = Awaited<ReturnType<typeof loadAdminClient>>;

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  source_path: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
};

type LabelRow = {
  id: string;
  document_id: string;
  label_type: DocumentLabel["label_type"];
  source: DocumentLabel["source"];
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  eq(column: string, value: unknown): QueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
};

const requiredMetadataKeys = [
  "document_status",
  "clinical_validation_status",
  "clinical_validation_evidence",
  "extraction_quality",
] as const;

const smartV2LabelTypes = new Set<DocumentLabel["label_type"]>([
  "clinical_action",
  "care_phase",
  "document_intent",
  "content_feature",
]);

async function loadAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

export function parseSourceGovernanceAuditArgs(argv: string[]): AuditArgs {
  const args: AuditArgs = { json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--debt-policy") {
      const value = argv[index + 1];
      if (!value) throw new Error("--debt-policy requires a path.");
      args.debtPolicyPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function loadProjectEnvironment() {
  if (!loadEnvConfig) throw new Error("Unable to load @next/env loadEnvConfig.");
  loadEnvConfig(process.cwd());
}

function usage() {
  return [
    "Usage: npm run audit:source-governance -- [options]",
    "",
    "Read-only audit of source governance metadata and smart-v2 label debt.",
    "",
    "Options:",
    "  --json                Print machine-readable JSON.",
    "  --debt-policy <path>  Compare against a release source metadata debt file.",
    "  --help                Show this help.",
  ].join("\n");
}

async function fetchAll<T>(
  supabase: SupabaseAdmin,
  table: "documents" | "document_labels" | "source_review_events",
  select: string,
  filter?: (query: QueryBuilder<T>) => QueryBuilder<T>,
) {
  const rows: T[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from(table)
      .select(select)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1) as unknown as QueryBuilder<T>;
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "missing";
}

function increment(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedCounts(counts: Map<string, number>) {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function compactDocument(document: DocumentRow) {
  const metadata = metadataRecord(document.metadata);
  return {
    id: document.id,
    title: document.title,
    file_name: document.file_name,
    document_status: stringValue(metadata.document_status),
    clinical_validation_status: stringValue(metadata.clinical_validation_status),
    extraction_quality: stringValue(metadata.extraction_quality),
  };
}

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`debt policy ${key} must be a non-empty string.`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new Error(`debt policy ${key} must be a non-empty string.`);
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`debt policy ${key} must be a number.`);
  return value;
}

async function loadDebtPolicy(path: string): Promise<DebtPolicy> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  const record = asRecord(parsed, "debt policy");
  const ceilings = asRecord(record.ceilings, "debt policy ceilings");
  const observedRetrievalEval =
    record.observed_retrieval_eval === undefined
      ? undefined
      : asRecord(record.observed_retrieval_eval, "debt policy observed_retrieval_eval");

  return {
    path,
    accepted: record.accepted === true,
    accepted_by: requiredString(record, "accepted_by"),
    accepted_at: requiredString(record, "accepted_at"),
    expires_at: optionalString(record, "expires_at"),
    ceilings: {
      max_stale_rate: requiredNumber(ceilings, "max_stale_rate"),
      max_review_required_rate: requiredNumber(ceilings, "max_review_required_rate"),
      max_outdated_top_results: requiredNumber(ceilings, "max_outdated_top_results"),
      max_poor_extraction_top_results: requiredNumber(ceilings, "max_poor_extraction_top_results"),
      max_source_governance_danger_failure_rate: requiredNumber(ceilings, "max_source_governance_danger_failure_rate"),
    },
    observed_retrieval_eval: observedRetrievalEval
      ? {
          stale_rate:
            typeof observedRetrievalEval.stale_rate === "number" ? observedRetrievalEval.stale_rate : undefined,
          review_required_rate:
            typeof observedRetrievalEval.review_required_rate === "number"
              ? observedRetrievalEval.review_required_rate
              : undefined,
          stale_top_results:
            typeof observedRetrievalEval.stale_top_results === "number"
              ? observedRetrievalEval.stale_top_results
              : undefined,
          poor_extraction_top_results:
            typeof observedRetrievalEval.poor_extraction_top_results === "number"
              ? observedRetrievalEval.poor_extraction_top_results
              : undefined,
        }
      : undefined,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseSourceGovernanceAuditArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  loadProjectEnvironment();
  const debtPolicy = args.debtPolicyPath ? await loadDebtPolicy(args.debtPolicyPath) : undefined;

  const supabase = await loadAdminClient();
  const documents = await fetchAll<DocumentRow>(
    supabase,
    "documents",
    "id,title,file_name,source_path,status,metadata",
    (query) => query.eq("status", "indexed"),
  );
  const labels = await fetchAll<LabelRow>(supabase, "document_labels", "id,document_id,label_type,source", (query) =>
    query.eq("source", "generated"),
  );
  const clinicalGovernanceDocuments = documents.filter((document) => !isRegistryRecordSource(document));
  const registryRecordsExcludedFromClinicalMetadataGate = documents.length - clinicalGovernanceDocuments.length;
  const clinicalGovernanceDocumentIds = new Set(clinicalGovernanceDocuments.map((document) => document.id));
  // source_review_events is service-role-only. This global operator audit uses
  // the existing admin client, reads only the fields needed to bind an
  // attestation, scopes them back to audited documents, and never emits event
  // evidence in either the JSON report or console output.
  const bmjAttestationEvents = (
    await fetchAll<BmjThirdPartyAttestationEvent>(
      supabase,
      "source_review_events",
      "id,document_id,reviewer_id,decision,evidence_references,new_document_status,new_validation_status,review_date,policy_version,reviewer_qualification,created_at",
      (query) => query.eq("decision", BMJ_THIRD_PARTY_ATTESTATION_BASIS),
    )
  ).filter((event) => clinicalGovernanceDocumentIds.has(event.document_id));

  const statusCounts = new Map<string, number>();
  const validationCounts = new Map<string, number>();
  const extractionCounts = new Map<string, number>();
  const requiredMissingCounts = new Map<string, number>();
  const missingRequiredDocuments: Array<ReturnType<typeof compactDocument> & { missing_keys: string[] }> = [];

  for (const document of clinicalGovernanceDocuments) {
    const metadata = metadataRecord(document.metadata);
    increment(statusCounts, stringValue(metadata.document_status));
    increment(validationCounts, stringValue(metadata.clinical_validation_status));
    increment(extractionCounts, stringValue(metadata.extraction_quality));

    const missingKeys = requiredMetadataKeys.filter((key) => {
      const value = metadata[key];
      return value === undefined || value === null || value === "";
    });
    for (const key of missingKeys) increment(requiredMissingCounts, key);
    if (missingKeys.length > 0) {
      missingRequiredDocuments.push({ ...compactDocument(document), missing_keys: missingKeys });
    }
  }

  const indexedDocumentIds = new Set(documents.map((document) => document.id));
  const generatedLabelDocumentIds = new Set(labels.map((label) => label.document_id));
  const smartV2DocumentIds = new Set(
    labels.filter((label) => smartV2LabelTypes.has(label.label_type)).map((label) => label.document_id),
  );
  const missingGeneratedLabelDocuments = documents.filter((document) => !generatedLabelDocumentIds.has(document.id));
  const missingSmartV2LabelDocuments = documents.filter((document) => !smartV2DocumentIds.has(document.id));
  const requiredMetadataMissingTotal = [...requiredMissingCounts.values()].reduce((total, count) => total + count, 0);
  const sourceAuthorityAudit = auditSourceAuthorityDocuments(documents);
  const debtCounts = {
    review_due: statusCounts.get("review_due") ?? 0,
    unknown_status: statusCounts.get("unknown") ?? 0,
    unverified_validation: validationCounts.get("unverified") ?? 0,
    poor_extraction: extractionCounts.get("poor") ?? 0,
    partial_extraction: extractionCounts.get("partial") ?? 0,
    missing_smart_v2_labels: missingSmartV2LabelDocuments.length,
  };
  // Raw validation telemetry above is intentionally unchanged. This second,
  // explicitly operational measure removes only complete, current, structured
  // BMJ attestations from the work queue; review-due or malformed attestations
  // remain debt and the source remains clinically unverified.
  const operationalDebtCounts = countOperationalUnattestedReviewDebt(
    clinicalGovernanceDocuments.map((document) => ({
      documentId: document.id,
      metadata: metadataRecord(document.metadata),
    })),
    bmjAttestationEvents,
  );

  const auditableRecords: AuditableRecord[] = documents.map((doc) => ({
    record: doc as unknown as Record<string, unknown>,
    recordType: isRegistryRecordSource(doc) ? "registry_record" : "document",
    identifier: doc.id,
    title: doc.title || doc.file_name,
    source: doc.source_path || doc.file_name,
  }));

  const therapiesSource = await loadStaticJson<Array<Record<string, unknown>>>("src/data/therapies-source.json");
  if (therapiesSource && Array.isArray(therapiesSource)) {
    for (const therapy of therapiesSource) {
      auditableRecords.push({
        record: therapy,
        recordType: "therapy",
        identifier: stringValue(therapy.slug) !== "missing" ? (therapy.slug as string) : (therapy.name as string),
        title: stringValue(therapy.name) !== "missing" ? (therapy.name as string) : "Unnamed therapy",
        source: "src/data/therapies-source.json",
      });
    }
  }

  const pathwaysSource = await loadStaticJson<Array<Record<string, unknown>>>(
    "public/therapy-compass-data/pathways.json",
  );
  if (pathwaysSource && Array.isArray(pathwaysSource)) {
    for (const pathway of pathwaysSource) {
      auditableRecords.push({
        record: pathway,
        recordType: "pathway",
        identifier: stringValue(pathway.slug) !== "missing" ? (pathway.slug as string) : (pathway.name as string),
        title: stringValue(pathway.name) !== "missing" ? (pathway.name as string) : "Unnamed pathway",
        source: "public/therapy-compass-data/pathways.json",
      });
    }
  }

  const referenceSource = await loadStaticJson<{ measures?: Array<Record<string, unknown>> }>(
    "public/therapy-compass-data/reference.json",
  );
  if (referenceSource && Array.isArray(referenceSource.measures)) {
    for (const measure of referenceSource.measures) {
      auditableRecords.push({
        record: measure,
        recordType: "measure",
        identifier: stringValue(measure.name) !== "missing" ? (measure.name as string) : "unnamed_measure",
        title: stringValue(measure.name) !== "missing" ? (measure.name as string) : "Unnamed measure",
        source: "public/therapy-compass-data/reference.json",
      });
    }
  }

  const differentialsSource = await loadStaticJson<
    { records?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
  >("data/differentials-snapshot.json");
  const diffItems = Array.isArray(differentialsSource) ? differentialsSource : (differentialsSource?.records ?? []);
  for (const diff of diffItems) {
    auditableRecords.push({
      record: diff,
      recordType: "differential",
      identifier:
        stringValue(diff.id ?? diff.slug) !== "missing"
          ? String(diff.id ?? diff.slug)
          : String(diff.title ?? "unknown"),
      title:
        stringValue(diff.title ?? diff.name) !== "missing" ? String(diff.title ?? diff.name) : "Unnamed differential",
      source: "data/differentials-snapshot.json",
    });
  }

  const specifiersSource = await loadStaticJson<
    { specifiers?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>
  >("data/specifiers-content.json");
  const specItems = Array.isArray(specifiersSource) ? specifiersSource : (specifiersSource?.specifiers ?? []);
  for (const spec of specItems) {
    auditableRecords.push({
      record: spec,
      recordType: "specifier",
      identifier:
        stringValue(spec.id ?? spec.slug) !== "missing"
          ? String(spec.id ?? spec.slug)
          : String(spec.title ?? "unknown"),
      title: stringValue(spec.title ?? spec.name) !== "missing" ? String(spec.title ?? spec.name) : "Unnamed specifier",
      source: "data/specifiers-content.json",
    });
  }

  const reviewerAttributionAudit = auditReviewAttribution(auditableRecords);
  const debtPolicyFailures: string[] = [];

  if (debtPolicy) {
    if (!debtPolicy.accepted) debtPolicyFailures.push("debt policy must set accepted to true");
    const acceptedAt = Date.parse(debtPolicy.accepted_at);
    if (!Number.isFinite(acceptedAt)) {
      debtPolicyFailures.push(`debt policy accepted_at is invalid: ${debtPolicy.accepted_at}`);
    }
    if (debtPolicy.expires_at) {
      const expiresAt = Date.parse(debtPolicy.expires_at);
      if (!Number.isFinite(expiresAt)) {
        debtPolicyFailures.push(`debt policy expires_at is invalid: ${debtPolicy.expires_at}`);
      } else if (expiresAt < Date.now()) {
        debtPolicyFailures.push(`debt policy expired at ${debtPolicy.expires_at}`);
      }
    }
    if (requiredMetadataMissingTotal > 0) {
      debtPolicyFailures.push(`required source metadata missing total ${requiredMetadataMissingTotal} must be 0`);
    }
    if (debtCounts.poor_extraction > debtPolicy.ceilings.max_poor_extraction_top_results) {
      debtPolicyFailures.push(
        `poor extraction documents ${debtCounts.poor_extraction} exceeds ceiling ${debtPolicy.ceilings.max_poor_extraction_top_results}`,
      );
    }
    if (debtCounts.missing_smart_v2_labels > 0) {
      debtPolicyFailures.push(`missing smart-v2 labels ${debtCounts.missing_smart_v2_labels} must be 0`);
    }
    const observedEval = debtPolicy.observed_retrieval_eval;
    if (observedEval?.stale_rate !== undefined && observedEval.stale_rate > debtPolicy.ceilings.max_stale_rate) {
      debtPolicyFailures.push(
        `accepted stale_rate ${observedEval.stale_rate} exceeds ceiling ${debtPolicy.ceilings.max_stale_rate}`,
      );
    }
    if (
      observedEval?.review_required_rate !== undefined &&
      observedEval.review_required_rate > debtPolicy.ceilings.max_review_required_rate
    ) {
      debtPolicyFailures.push(
        `accepted review_required_rate ${observedEval.review_required_rate} exceeds ceiling ${debtPolicy.ceilings.max_review_required_rate}`,
      );
    }
    if (
      observedEval?.stale_top_results !== undefined &&
      observedEval.stale_top_results > debtPolicy.ceilings.max_outdated_top_results
    ) {
      debtPolicyFailures.push(
        `accepted stale top results ${observedEval.stale_top_results} exceeds ceiling ${debtPolicy.ceilings.max_outdated_top_results}`,
      );
    }
    if (
      observedEval?.poor_extraction_top_results !== undefined &&
      observedEval.poor_extraction_top_results > debtPolicy.ceilings.max_poor_extraction_top_results
    ) {
      debtPolicyFailures.push(
        `accepted poor extraction top results ${observedEval.poor_extraction_top_results} exceeds ceiling ${debtPolicy.ceilings.max_poor_extraction_top_results}`,
      );
    }
  }

  const report = {
    mode: "read-only",
    indexed_documents: documents.length,
    clinical_governance_documents: clinicalGovernanceDocuments.length,
    registry_records_excluded_from_clinical_metadata_gate: registryRecordsExcludedFromClinicalMetadataGate,
    required_metadata_missing_total: requiredMetadataMissingTotal,
    required_metadata_missing_counts: Object.fromEntries(
      requiredMetadataKeys.map((key) => [key, requiredMissingCounts.get(key) ?? 0]),
    ),
    document_status_counts: sortedCounts(statusCounts),
    clinical_validation_status_counts: sortedCounts(validationCounts),
    extraction_quality_counts: sortedCounts(extractionCounts),
    generated_label_coverage: {
      documents_with_generated_labels: generatedLabelDocumentIds.size,
      indexed_without_generated_labels: missingGeneratedLabelDocuments.length,
    },
    smart_v2_label_coverage: {
      documents_with_smart_v2_labels: smartV2DocumentIds.size,
      indexed_without_smart_v2_labels: missingSmartV2LabelDocuments.length,
    },
    debt_counts: debtCounts,
    operational_review_debt_counts: operationalDebtCounts,
    reviewer_attribution: reviewerAttributionAudit,
    sample_review_due_documents: clinicalGovernanceDocuments
      .filter((document) => metadataRecord(document.metadata).document_status === "review_due")
      .slice(0, 10)
      .map(compactDocument),
    sample_unknown_status_documents: clinicalGovernanceDocuments
      .filter((document) => metadataRecord(document.metadata).document_status === "unknown")
      .slice(0, 10)
      .map(compactDocument),
    sample_unverified_documents: clinicalGovernanceDocuments
      .filter((document) => metadataRecord(document.metadata).clinical_validation_status === "unverified")
      .slice(0, 10)
      .map(compactDocument),
    missing_required_metadata_documents: missingRequiredDocuments.slice(0, 25),
    missing_smart_v2_label_documents: missingSmartV2LabelDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      file_name: document.file_name,
    })),
    indexed_document_id_count: indexedDocumentIds.size,
    passed_required_metadata_gate: requiredMetadataMissingTotal === 0,
    source_authority: sourceAuthorityAudit,
    passed_source_authority_gate: sourceAuthorityAudit.passed,
    passed_reviewer_attribution_gate: reviewerAttributionAudit.passed,
    debt_policy: debtPolicy
      ? {
          path: debtPolicy.path,
          accepted_by: debtPolicy.accepted_by,
          accepted_at: debtPolicy.accepted_at,
          expires_at: debtPolicy.expires_at,
          ceilings: debtPolicy.ceilings,
          observed_retrieval_eval: debtPolicy.observed_retrieval_eval,
          passed: debtPolicyFailures.length === 0,
          failures: debtPolicyFailures,
        }
      : null,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("[Source Governance Audit]");
    console.log(`Mode: ${report.mode}`);
    console.log(`Indexed documents: ${report.indexed_documents}`);
    console.log(
      `Clinical governance documents: ${report.clinical_governance_documents} (registry projections excluded: ${report.registry_records_excluded_from_clinical_metadata_gate})`,
    );
    console.log(`Required metadata missing: ${report.required_metadata_missing_total}`);
    console.log(
      `Document status: ${Object.entries(report.document_status_counts)
        .map(([value, count]) => `${value}=${count}`)
        .join(", ")}`,
    );
    console.log(
      `Clinical validation: ${Object.entries(report.clinical_validation_status_counts)
        .map(([value, count]) => `${value}=${count}`)
        .join(", ")}`,
    );
    console.log(
      `Operational unattested review debt: ${report.operational_review_debt_counts.unattested_review_debt} (complete current BMJ attestations: ${report.operational_review_debt_counts.complete_bmj_third_party_attestations}; raw unverified: ${report.operational_review_debt_counts.raw_unverified_validation})`,
    );
    console.log(
      `Extraction quality: ${Object.entries(report.extraction_quality_counts)
        .map(([value, count]) => `${value}=${count}`)
        .join(", ")}`,
    );
    console.log(
      `Generated labels: missing=${report.generated_label_coverage.indexed_without_generated_labels}, covered=${report.generated_label_coverage.documents_with_generated_labels}`,
    );
    console.log(
      `Smart-v2 labels: missing=${report.smart_v2_label_coverage.indexed_without_smart_v2_labels}, covered=${report.smart_v2_label_coverage.documents_with_smart_v2_labels}`,
    );
    console.log(
      `Source authority: recognised=${report.source_authority.recognized_documents}, Australian candidates=${report.source_authority.australian_authority_candidates}, conflicts=${report.source_authority.authority_conflict_count}, missing locality=${report.source_authority.missing_australian_locality_count}, safe corrections=${report.source_authority.proposed_locality_correction_count}`,
    );
    if (report.source_authority.authority_conflict_count) {
      console.log(
        `Source authority conflict reasons: ${JSON.stringify(report.source_authority.authority_conflict_reason_counts)}`,
      );
    }
    if (report.source_authority.conflicts.length) {
      console.log("Source authority conflicts:");
      for (const document of report.source_authority.conflicts) {
        console.log(`- ${document.title} (${document.file_name}): ${document.conflicts.join(", ")}`);
      }
    }
    if (report.source_authority.missing_australian_locality.length) {
      console.log("Australian sources missing locality metadata:");
      for (const document of report.source_authority.missing_australian_locality) {
        console.log(`- ${document.title} (${document.file_name}): ${document.missing_keys.join(", ")}`);
      }
    }
    if (report.source_authority.proposed_locality_corrections.length) {
      console.log("Proposed safe locality corrections:");
      for (const document of report.source_authority.proposed_locality_corrections) {
        console.log(`- ${document.title} (${document.file_name}): ${JSON.stringify(document.changes)}`);
      }
    }
    if (report.missing_smart_v2_label_documents.length) {
      console.log("Documents missing smart-v2 labels:");
      for (const document of report.missing_smart_v2_label_documents) {
        console.log(`- ${document.title} (${document.file_name})`);
      }
    }
    console.log(
      `Reviewer attribution: audited=${report.reviewer_attribution.audited_record_count}, reviewed=${report.reviewer_attribution.reviewed_record_count}, violations=${report.reviewer_attribution.unattributed_reviewed_record_count}`,
    );
    if (report.reviewer_attribution.violations.length) {
      console.log("Reviewer attribution governance violations:");
      for (const violation of report.reviewer_attribution.violations) {
        console.log(`- [${violation.record_type}] ${violation.identifier} (${violation.title}): ${violation.reason}`);
      }
    }
    console.log(
      report.passed_required_metadata_gate
        ? "PASS: required source governance metadata is complete."
        : "FAIL: required source governance metadata has gaps.",
    );
    console.log(
      report.passed_source_authority_gate
        ? "PASS: recognised source authority metadata is complete and compatible."
        : "FAIL: recognised source authority metadata has missing or conflicting locality fields.",
    );
    console.log(
      report.passed_reviewer_attribution_gate
        ? "PASS: all reviewed records have non-empty, non-trivial reviewer attribution."
        : "FAIL: un-attributed reviewed records found (governance violation).",
    );
    if (report.debt_policy) {
      console.log(
        report.debt_policy.passed
          ? `PASS: release debt policy accepted (${report.debt_policy.path}).`
          : `FAIL: release debt policy rejected (${report.debt_policy.path}).`,
      );
      for (const failure of report.debt_policy.failures) console.log(`- ${failure}`);
    }
  }

  if (!report.passed_required_metadata_gate) process.exitCode = 1;
  if (!report.passed_source_authority_gate) process.exitCode = 1;
  if (!report.passed_reviewer_attribution_gate) process.exitCode = 1;
  if (report.debt_policy && !report.debt_policy.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
