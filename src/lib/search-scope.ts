import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalSourceMetadata, DocumentLabelType } from "@/lib/types";
import { normalizeSourceMetadata } from "@/lib/source-metadata";

const labelTypes = ["medication", "topic", "document_type"] as const satisfies readonly DocumentLabelType[];

export const searchScopeFiltersSchema = z
  .object({
    medications: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    topics: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    documentTypes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    sourceStatuses: z
      .array(z.enum(["current", "review_due", "outdated", "unknown"]))
      .max(4)
      .optional(),
    validationStatuses: z
      .array(z.enum(["unverified", "locally_reviewed", "approved"]))
      .max(3)
      .optional(),
    extractionQualities: z
      .array(z.enum(["good", "partial", "poor", "unknown"]))
      .max(4)
      .optional(),
    locality: z.enum(["local", "non_local"]).optional(),
    importBatchIds: z.array(z.string().uuid()).max(25).optional(),
    collections: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  })
  .default({});

export type SearchScopeFilters = z.infer<typeof searchScopeFiltersSchema>;

export type ResolvedSearchScope = {
  documentIds?: string[];
  filters: SearchScopeFilters;
  activeFilterCount: number;
  matchedDocumentCount: number | null;
  warnings: string[];
  summary: string;
};

type ScopeDocumentRow = {
  id: string;
  metadata: unknown;
  import_batch_id: string | null;
};

type ScopeLabelRow = {
  document_id: string;
  label: string;
  label_type: DocumentLabelType;
};

function normalizeFilterText(value: string) {
  return value.trim().toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasValues(values?: string[]) {
  return Boolean(values?.length);
}

export function activeScopeFilterCount(filters: SearchScopeFilters) {
  return [
    filters.medications,
    filters.topics,
    filters.documentTypes,
    filters.sourceStatuses,
    filters.validationStatuses,
    filters.extractionQualities,
    filters.locality ? [filters.locality] : [],
    filters.importBatchIds,
    filters.collections,
  ].filter((values) => values && values.length > 0).length;
}

function labelMatches(labels: ScopeLabelRow[], type: DocumentLabelType, requested?: string[]) {
  if (!hasValues(requested)) return true;
  const wanted = new Set(requested!.map(normalizeFilterText));
  return labels.some((label) => label.label_type === type && wanted.has(normalizeFilterText(label.label)));
}

function isLocalSource(metadata: ClinicalSourceMetadata) {
  const jurisdiction = `${metadata.jurisdiction ?? ""} ${metadata.publisher ?? ""}`.toLowerCase();
  return /\b(?:wa|western australia|north metropolitan|east metropolitan|south metropolitan|perth|health service)\b/.test(
    jurisdiction,
  );
}

function metadataMatchesLocality(row: ScopeDocumentRow, filters: SearchScopeFilters) {
  if (!filters.locality) return true;
  const source = normalizeSourceMetadata(row.metadata);
  if (filters.locality === "local" && !isLocalSource(source)) return false;
  if (filters.locality === "non_local" && isLocalSource(source)) return false;
  return true;
}

export async function resolveSearchScope(args: {
  supabase: SupabaseClient;
  ownerId?: string | null;
  documentIds?: string[];
  filters?: SearchScopeFilters;
  maxResolvedDocuments?: number;
}): Promise<ResolvedSearchScope> {
  const filters = searchScopeFiltersSchema.parse(args.filters ?? {});
  const explicitIds = unique(args.documentIds ?? []);
  const activeFilterCount = activeScopeFilterCount(filters);
  const warnings: string[] = [];

  if (activeFilterCount === 0) {
    return {
      documentIds: explicitIds.length ? explicitIds : undefined,
      filters,
      activeFilterCount,
      matchedDocumentCount: explicitIds.length || null,
      warnings,
      summary: explicitIds.length
        ? `${explicitIds.length} selected document${explicitIds.length === 1 ? "" : "s"}`
        : "All documents",
    };
  }

  const maxResolvedDocuments = args.maxResolvedDocuments ?? 5000;

  // Build a single SQL query with filters pushed down to avoid O(N) full scans.
  let documentQuery = args.supabase
    .from("documents")
    .select("id,metadata,import_batch_id")
    .eq("status", "indexed")
    .limit(maxResolvedDocuments + 1); // fetch one extra to detect overflow
  if (args.ownerId) documentQuery = documentQuery.eq("owner_id", args.ownerId);
  if (explicitIds.length) documentQuery = documentQuery.in("id", explicitIds);

  // Push metadata enum filters into SQL using JSONB text extraction. For each
  // filter that includes the fallback "unknown"/"unverified" value we also
  // accept rows where the field is absent (NULL in JSON extraction).
  if (filters.sourceStatuses?.length) {
    const parts = filters.sourceStatuses.map((s) => `metadata->>document_status.eq.${s}`);
    if (filters.sourceStatuses.includes("unknown")) parts.push("metadata->>document_status.is.null");
    documentQuery = documentQuery.or(parts.join(","));
  }
  if (filters.validationStatuses?.length) {
    const parts = filters.validationStatuses.map((s) => `metadata->>clinical_validation_status.eq.${s}`);
    if (filters.validationStatuses.includes("unverified")) parts.push("metadata->>clinical_validation_status.is.null");
    documentQuery = documentQuery.or(parts.join(","));
  }
  if (filters.extractionQualities?.length) {
    const parts = filters.extractionQualities.map((q) => `metadata->>extraction_quality.eq.${q}`);
    if (filters.extractionQualities.includes("unknown")) parts.push("metadata->>extraction_quality.is.null");
    documentQuery = documentQuery.or(parts.join(","));
  }
  if (filters.importBatchIds?.length) {
    documentQuery = documentQuery.in("import_batch_id", filters.importBatchIds);
  }
  if (filters.collections?.length) {
    // Use ilike for case-insensitive collection matching (mirrors the in-memory
    // toLowerCase comparison in the original metadataMatches helper).
    const parts = filters.collections.map((c) => `metadata->>collection.ilike.${normalizeFilterText(c)}`);
    documentQuery = documentQuery.or(parts.join(","));
  }

  const { data, error: documentError } = await documentQuery;
  if (documentError) throw new Error(documentError.message);

  let documentRows = (data ?? []) as ScopeDocumentRow[];
  if (documentRows.length > maxResolvedDocuments) {
    documentRows = documentRows.slice(0, maxResolvedDocuments);
    warnings.push(
      `Scope resolution matched more than ${maxResolvedDocuments} indexed documents; narrow the filters if expected documents are missing.`,
    );
  }

  // Apply locality filter in application code — it requires a regex match
  // across two JSONB fields that cannot be expressed via PostgREST alone.
  const rows = filters.locality ? documentRows.filter((row) => metadataMatchesLocality(row, filters)) : documentRows;
  const candidateIds = rows.map((row) => row.id);
  if (candidateIds.length === 0) {
    warnings.push("No indexed documents matched the selected filters.");
    return {
      documentIds: [],
      filters,
      activeFilterCount,
      matchedDocumentCount: 0,
      warnings,
      summary: "No matching documents",
    };
  }

  const needsLabels = hasValues(filters.medications) || hasValues(filters.topics) || hasValues(filters.documentTypes);
  let labelsByDocument = new Map<string, ScopeLabelRow[]>();
  if (needsLabels) {
    const { data: labelRows, error: labelError } = await args.supabase
      .from("document_labels")
      .select("document_id,label,label_type")
      .in("document_id", candidateIds)
      .in("label_type", [...labelTypes]);
    if (labelError) throw new Error(labelError.message);
    labelsByDocument = new Map();
    for (const label of (labelRows ?? []) as ScopeLabelRow[]) {
      labelsByDocument.set(label.document_id, [...(labelsByDocument.get(label.document_id) ?? []), label]);
    }
  }

  const resolvedIds = candidateIds.filter((id) => {
    const labels = labelsByDocument.get(id) ?? [];
    return (
      labelMatches(labels, "medication", filters.medications) &&
      labelMatches(labels, "topic", filters.topics) &&
      labelMatches(labels, "document_type", filters.documentTypes)
    );
  });

  if (resolvedIds.length === 0) warnings.push("No indexed documents matched the selected label filters.");
  if (resolvedIds.length > 100)
    warnings.push(`${resolvedIds.length} documents match the selected scope; answers may be broad.`);

  return {
    documentIds: resolvedIds,
    filters,
    activeFilterCount,
    matchedDocumentCount: resolvedIds.length,
    warnings,
    summary:
      resolvedIds.length === 0
        ? "No matching documents"
        : `${resolvedIds.length} scoped document${resolvedIds.length === 1 ? "" : "s"}`,
  };
}
