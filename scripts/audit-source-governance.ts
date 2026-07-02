import { readFile } from "node:fs/promises";

import * as nextEnv from "@next/env";
import type { DocumentLabel } from "@/lib/types";

const loadEnvConfig =
  nextEnv.loadEnvConfig ??
  (nextEnv as unknown as { default?: { loadEnvConfig?: typeof nextEnv.loadEnvConfig } }).default?.loadEnvConfig;

if (!loadEnvConfig) throw new Error("Unable to load @next/env loadEnvConfig.");
loadEnvConfig(process.cwd());

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

function parseArgs(argv: string[]): AuditArgs {
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
  table: "documents" | "document_labels",
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  const debtPolicy = args.debtPolicyPath ? await loadDebtPolicy(args.debtPolicyPath) : undefined;

  const supabase = await loadAdminClient();
  const documents = await fetchAll<DocumentRow>(supabase, "documents", "id,title,file_name,status,metadata", (query) =>
    query.eq("status", "indexed"),
  );
  const labels = await fetchAll<LabelRow>(supabase, "document_labels", "id,document_id,label_type,source", (query) =>
    query.eq("source", "generated"),
  );

  const statusCounts = new Map<string, number>();
  const validationCounts = new Map<string, number>();
  const extractionCounts = new Map<string, number>();
  const requiredMissingCounts = new Map<string, number>();
  const missingRequiredDocuments: Array<ReturnType<typeof compactDocument> & { missing_keys: string[] }> = [];

  for (const document of documents) {
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
  const debtCounts = {
    review_due: statusCounts.get("review_due") ?? 0,
    unknown_status: statusCounts.get("unknown") ?? 0,
    unverified_validation: validationCounts.get("unverified") ?? 0,
    poor_extraction: extractionCounts.get("poor") ?? 0,
    partial_extraction: extractionCounts.get("partial") ?? 0,
    missing_smart_v2_labels: missingSmartV2LabelDocuments.length,
  };
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
    sample_review_due_documents: documents
      .filter((document) => metadataRecord(document.metadata).document_status === "review_due")
      .slice(0, 10)
      .map(compactDocument),
    sample_unknown_status_documents: documents
      .filter((document) => metadataRecord(document.metadata).document_status === "unknown")
      .slice(0, 10)
      .map(compactDocument),
    sample_unverified_documents: documents
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
    if (report.missing_smart_v2_label_documents.length) {
      console.log("Documents missing smart-v2 labels:");
      for (const document of report.missing_smart_v2_label_documents) {
        console.log(`- ${document.title} (${document.file_name})`);
      }
    }
    console.log(
      report.passed_required_metadata_gate
        ? "PASS: required source governance metadata is complete."
        : "FAIL: required source governance metadata has gaps.",
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
  if (report.debt_policy && !report.debt_policy.passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
