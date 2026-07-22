import type { EvidenceRelevance, SearchResult } from "@/lib/types";
import { normalizeSourceMetadata } from "@/lib/source-metadata";

export type SourceGovernanceWarning = {
  code:
    | "outdated_source"
    | "review_due_source"
    | "non_local_source"
    | "unverified_source"
    | "poor_extraction"
    | "partial_extraction"
    | "low_index_quality"
    | "weak_evidence"
    | "weak_table_extraction"
    | "registry_record_source";
  severity: "info" | "warning" | "danger";
  message: string;
  document_id?: string;
  title?: string;
};

export type GroupedSourceGovernanceWarning = {
  code: SourceGovernanceWarning["code"];
  severity: SourceGovernanceWarning["severity"];
  message: string;
  count: number;
  documentIds: string[];
  titles: string[];
};

export const sourceGovernanceRefusalAnswer =
  "I cannot provide a clinical answer because one or more matched documents are not suitable for clinical use yet. Try a narrower clinical term or scope the search to a current approved document.";

// Canonical per-source danger-severity warning messages. These are the exact
// strings emitted by sourceGovernanceWarnings below AND the strings persisted by
// UI captures (ClinicalDashboard submits warning.message to /api/eval-cases,
// which drops the severity), so a consumer can recover danger severity from a
// persisted message via isDangerSourceGovernanceMessage. weak_evidence danger is
// intentionally excluded: its message is dynamic (relevance.supportReason) and
// its fallback text is shared with the non-danger partial-verdict variant, so it
// cannot be recovered from a message string without false positives.
export const OUTDATED_SOURCE_WARNING_MESSAGE = "One or more supporting sources are marked outdated.";
export const POOR_EXTRACTION_WARNING_MESSAGE = "One or more supporting sources have poor extraction quality.";

const dangerSourceGovernanceMessages = new Set<string>([
  OUTDATED_SOURCE_WARNING_MESSAGE,
  POOR_EXTRACTION_WARNING_MESSAGE,
]);

export function isDangerSourceGovernanceMessage(message: string) {
  return dangerSourceGovernanceMessages.has(message.trim());
}

const frontendVisibleWarningCodes = new Set<SourceGovernanceWarning["code"]>([
  "outdated_source",
  "poor_extraction",
  "weak_evidence",
  // Since the public-corpus promotion (all indexed documents are anonymously
  // searchable regardless of clinical_validation_status), "not locally
  // validated" is a clinically material caveat, not routine review metadata.
  "unverified_source",
  "registry_record_source",
  // A source past its review date is a material currency caveat: guidance may have
  // moved on. Surfacing the badge keeps the governance notice consistent with the
  // review-due language already emitted in the render-policy copy text
  // (answer-render-policy.buildWarnings), which the badge list previously suppressed.
  "review_due_source",
]);

function isLocalMetadataText(value: string) {
  return /\b(?:wa|western australia|perth|north metropolitan|east metropolitan|south metropolitan|health service)\b/i.test(
    value,
  );
}

function pushUnique(warnings: SourceGovernanceWarning[], warning: SourceGovernanceWarning) {
  const key = `${warning.code}:${warning.document_id ?? ""}:${warning.message}`;
  if (warnings.some((item) => `${item.code}:${item.document_id ?? ""}:${item.message}` === key)) return;
  warnings.push(warning);
}

export function sourceGovernanceWarnings(args: {
  results: SearchResult[];
  relevance?: EvidenceRelevance | null;
  limit?: number;
}) {
  const warnings: SourceGovernanceWarning[] = [];

  if (args.relevance && !args.relevance.isSourceBacked) {
    pushUnique(warnings, {
      code: "weak_evidence",
      severity: args.relevance.verdict === "none" ? "danger" : "warning",
      message: args.relevance.supportReason || "The retrieved evidence is weak or nearby-only.",
    });
  }

  for (const result of args.results) {
    const source = normalizeSourceMetadata(result.source_metadata);
    const title = result.title;
    const document_id = result.document_id;

    if (source.document_status === "outdated") {
      pushUnique(warnings, {
        code: "outdated_source",
        severity: "danger",
        message: OUTDATED_SOURCE_WARNING_MESSAGE,
        document_id,
        title,
      });
    } else if (source.document_status === "review_due") {
      pushUnique(warnings, {
        code: "review_due_source",
        severity: "warning",
        message: "One or more supporting sources are due for review.",
        document_id,
        title,
      });
    }

    if (source.clinical_validation_status === "unverified") {
      pushUnique(warnings, {
        code: "unverified_source",
        severity: "warning",
        message: "One or more supporting sources have not been locally validated.",
        document_id,
        title,
      });
    }

    if (source.extraction_quality === "poor" || result.indexing_quality?.extraction_quality === "poor") {
      pushUnique(warnings, {
        code: "poor_extraction",
        severity: "danger",
        message: POOR_EXTRACTION_WARNING_MESSAGE,
        document_id,
        title,
      });
    } else if (source.extraction_quality === "partial" || result.indexing_quality?.extraction_quality === "partial") {
      pushUnique(warnings, {
        code: "partial_extraction",
        severity: "warning",
        message: "One or more supporting sources have partial extraction quality.",
        document_id,
        title,
      });
    }

    if (typeof result.indexing_quality?.quality_score === "number" && result.indexing_quality.quality_score < 0.45) {
      pushUnique(warnings, {
        code: "low_index_quality",
        severity: "warning",
        message: "One or more supporting sources have a low indexing quality score.",
        document_id,
        title,
      });
    }

    const localityText = [source.jurisdiction, source.publisher].filter(Boolean).join(" ");
    if (localityText && !isLocalMetadataText(localityText)) {
      pushUnique(warnings, {
        code: "non_local_source",
        severity: "info",
        message: "One or more supporting sources do not appear to be local WA/Perth guidance.",
        document_id,
        title,
      });
    }

    if (
      result.table_facts?.some((fact) =>
        ["bad_extraction", "unrelated", "administrative"].includes(String(fact.metadata?.review_class ?? "")),
      )
    ) {
      pushUnique(warnings, {
        code: "weak_table_extraction",
        severity: "warning",
        message: "Some matched table evidence has been reviewed as administrative, unrelated, or poor extraction.",
        document_id,
        title,
      });
    }

    if (source.source_kind === "registry_record") {
      pushUnique(warnings, {
        code: "registry_record_source",
        severity: "info",
        message:
          "One or more supporting sources are curated registry summaries, not source documents; verify against linked source documents for clinical decisions.",
        document_id,
        title,
      });
    }
  }

  const severityRank = { danger: 0, warning: 1, info: 2 } satisfies Record<SourceGovernanceWarning["severity"], number>;
  return warnings
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
    .slice(0, args.limit ?? 8);
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function groupedMessage(warning: SourceGovernanceWarning, count: number) {
  if (warning.code === "outdated_source") return `${plural(count, "source")} marked outdated.`;
  if (warning.code === "review_due_source") return `${plural(count, "source")} due for review.`;
  if (warning.code === "non_local_source") return `${plural(count, "source")} may not be local WA/Perth guidance.`;
  if (warning.code === "unverified_source")
    return `${plural(count, "source")} ${count === 1 ? "has" : "have"} not been locally validated.`;
  if (warning.code === "poor_extraction")
    return `${plural(count, "source")} ${count === 1 ? "has" : "have"} poor extraction quality.`;
  if (warning.code === "partial_extraction")
    return `${plural(count, "source")} ${count === 1 ? "has" : "have"} partial extraction quality.`;
  if (warning.code === "low_index_quality")
    return `${plural(count, "source")} ${count === 1 ? "has" : "have"} low indexing quality.`;
  if (warning.code === "weak_table_extraction")
    return `${plural(count, "table evidence item")} reviewed as administrative, unrelated, or poor extraction.`;
  if (warning.code === "registry_record_source")
    return `${plural(count, "registry summary", "registry summaries")} used as supporting evidence.`;
  return warning.message;
}

export function groupSourceGovernanceWarnings(warnings: SourceGovernanceWarning[]) {
  const grouped = new Map<string, GroupedSourceGovernanceWarning>();

  for (const warning of warnings) {
    const key = warning.code;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      if (warning.document_id && !existing.documentIds.includes(warning.document_id)) {
        existing.documentIds.push(warning.document_id);
      }
      if (warning.title && !existing.titles.includes(warning.title)) existing.titles.push(warning.title);
      existing.message = groupedMessage(warning, existing.count);
      continue;
    }
    grouped.set(key, {
      code: warning.code,
      severity: warning.severity,
      message: groupedMessage(warning, 1),
      count: 1,
      documentIds: warning.document_id ? [warning.document_id] : [],
      titles: warning.title ? [warning.title] : [],
    });
  }

  const severityRank = { danger: 0, warning: 1, info: 2 } satisfies Record<SourceGovernanceWarning["severity"], number>;
  return Array.from(grouped.values()).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export function isFrontendVisibleSourceGovernanceWarning(warning: SourceGovernanceWarning) {
  return frontendVisibleWarningCodes.has(warning.code);
}

export function frontendSourceGovernanceWarnings(warnings: SourceGovernanceWarning[]) {
  return warnings.filter(isFrontendVisibleSourceGovernanceWarning);
}

export function hasDangerSourceGovernanceWarning(warnings: SourceGovernanceWarning[]) {
  return warnings.some((warning) => warning.severity === "danger");
}
