import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalSourceMetadata, DocumentLabelType } from "@/lib/types";
import { normalizeSourceMetadata } from "@/lib/source-metadata";
import type { RetrievalAccessScope } from "@/lib/owner-scope";

const labelTypes = [
  "site",
  "medication",
  "topic",
  "document_type",
  "service",
  "setting",
  "population",
  "risk",
  "workflow",
  "clinical_action",
  "care_phase",
  "document_intent",
  "content_feature",
] as const satisfies readonly DocumentLabelType[];
const sourceStatusValues = ["current", "review_due", "outdated", "unknown"] as const;
const validationStatusValues = ["unverified", "locally_reviewed", "approved"] as const;
const documentScopeQueryPageSize = 1000;
const labelScopeDocumentBatchSize = 200;
const labelScopeQueryPageSize = 1000;

export const searchScopeFiltersSchema = z
  .object({
    medications: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    topics: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    documentTypes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    sites: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    services: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    settings: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    populations: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    risks: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    workflows: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    clinicalActions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    carePhases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    documentIntents: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    contentFeatures: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
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
    // Match documents carrying ANY label of the requested type(s), without
    // enumerating label values (e.g. "any document with a service label").
    // Used by mode-default scopes for the Services/Forms surfaces.
    labelTypesAny: z.array(z.enum(labelTypes)).max(13).optional(),
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
  id?: string;
  document_id: string;
  label: string;
  label_type: DocumentLabelType;
};

function normalizeFilterText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9/+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasValues(values?: string[]) {
  return Boolean(values?.length);
}

function escapePostgrestValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildStatusFallbackClauses(args: {
  fieldName: string;
  values?: string[];
  fallbackValue: string;
  knownValues: readonly string[];
  orParts: string[];
}) {
  const normalizedValues = (args.values ?? []).map(normalizeFilterText);
  for (const value of normalizedValues) {
    args.orParts.push(`${args.fieldName}.eq.${value}`);
  }

  if (!normalizedValues.includes(args.fallbackValue)) {
    return;
  }

  args.orParts.push(`${args.fieldName}.is.null`);
  args.orParts.push(`${args.fieldName}.not.in.(${args.knownValues.join(",")})`);
}

export function activeScopeFilterCount(filters: SearchScopeFilters) {
  return [
    filters.medications,
    filters.topics,
    filters.documentTypes,
    filters.sites,
    filters.services,
    filters.settings,
    filters.populations,
    filters.risks,
    filters.workflows,
    filters.clinicalActions,
    filters.carePhases,
    filters.documentIntents,
    filters.contentFeatures,
    filters.sourceStatuses,
    filters.validationStatuses,
    filters.extractionQualities,
    filters.locality ? [filters.locality] : [],
    filters.importBatchIds,
    filters.collections,
    filters.labelTypesAny,
  ].filter((values) => values && values.length > 0).length;
}

function labelTypeAnyMatches(labels: ScopeLabelRow[], requestedTypes?: SearchScopeFilters["labelTypesAny"]) {
  if (!hasValues(requestedTypes)) return true;
  const wanted = new Set(requestedTypes!);
  return labels.some((label) => wanted.has(label.label_type as (typeof labelTypes)[number]));
}

function labelMatches(labels: ScopeLabelRow[], type: DocumentLabelType, requested?: string[]) {
  if (!hasValues(requested)) return true;
  const wanted = new Set(requested!.map(normalizeFilterText));
  return labels.some((label) => label.label_type === type && wanted.has(normalizeFilterText(label.label)));
}

async function loadScopeLabels(args: {
  supabase: SupabaseClient;
  candidateIds: string[];
  signal?: AbortSignal;
}): Promise<ScopeLabelRow[]> {
  const rows: ScopeLabelRow[] = [];

  for (let start = 0; start < args.candidateIds.length; start += labelScopeDocumentBatchSize) {
    const documentIdBatch = args.candidateIds.slice(start, start + labelScopeDocumentBatchSize);
    for (let offset = 0; ; offset += labelScopeQueryPageSize) {
      let labelQuery = args.supabase
        .from("document_labels")
        .select("id,document_id,label,label_type")
        .in("document_id", documentIdBatch)
        .in("label_type", [...labelTypes])
        .order("document_id", { ascending: true })
        .order("label_type", { ascending: true })
        .order("label", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + labelScopeQueryPageSize - 1);
      if (args.signal) labelQuery = labelQuery.abortSignal(args.signal);

      const { data, error } = await labelQuery;
      if (error) throw new Error(error.message);
      const page = (data ?? []) as ScopeLabelRow[];
      rows.push(...page);
      if (page.length < labelScopeQueryPageSize) break;
    }
  }

  return rows;
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
  accessScope: RetrievalAccessScope;
  documentIds?: string[];
  filters?: SearchScopeFilters;
  maxResolvedDocuments?: number;
  signal?: AbortSignal;
}): Promise<ResolvedSearchScope> {
  const filters = searchScopeFiltersSchema.parse(args.filters ?? {});
  const explicitIds = unique(args.documentIds ?? []);
  const activeFilterCount = activeScopeFilterCount(filters);
  const warnings: string[] = [];
  const publicOnly = !args.accessScope.ownerId;

  if (activeFilterCount === 0 && publicOnly && explicitIds.length === 0) {
    return {
      documentIds: undefined,
      filters,
      activeFilterCount,
      matchedDocumentCount: null,
      warnings,
      summary: "All public documents",
    };
  }

  if (activeFilterCount === 0 && !publicOnly && !(args.accessScope.ownerId && explicitIds.length)) {
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

  const documentRows: ScopeDocumentRow[] = [];
  for (let offset = 0; offset < maxResolvedDocuments; offset += documentScopeQueryPageSize) {
    let documentQuery = args.supabase
      .from("documents")
      .select("id,metadata,import_batch_id")
      .eq("status", "indexed")
      // Deterministic total order over the unique id column. Without it, separate
      // LIMIT/OFFSET page queries have no stable order, so rows can be silently
      // skipped or duplicated across pages and the resolved scope is incomplete.
      .order("id", { ascending: true })
      .range(offset, Math.min(offset + documentScopeQueryPageSize - 1, maxResolvedDocuments - 1));
    if (args.accessScope.ownerId && args.accessScope.includePublic) {
      documentQuery = documentQuery.or(`owner_id.eq.${args.accessScope.ownerId},owner_id.is.null`);
    } else if (args.accessScope.ownerId) {
      documentQuery = documentQuery.eq("owner_id", args.accessScope.ownerId);
    } else if (publicOnly) documentQuery = documentQuery.is("owner_id", null);
    if (explicitIds.length) documentQuery = documentQuery.in("id", explicitIds);

    // Push metadata enum filters into SQL using JSONB text extraction. Keep
    // fallback semantics by matching nulls, fallback values, and malformed rows.
    if (filters.sourceStatuses?.length) {
      const orParts: string[] = [];
      buildStatusFallbackClauses({
        fieldName: "metadata->>document_status",
        values: filters.sourceStatuses,
        fallbackValue: "unknown",
        knownValues: sourceStatusValues,
        orParts,
      });
      documentQuery = documentQuery.or(orParts.join(","));
    }
    if (filters.validationStatuses?.length) {
      const orParts: string[] = [];
      buildStatusFallbackClauses({
        fieldName: "metadata->>clinical_validation_status",
        values: filters.validationStatuses,
        fallbackValue: "unverified",
        knownValues: validationStatusValues,
        orParts,
      });
      documentQuery = documentQuery.or(orParts.join(","));
    }
    if (filters.extractionQualities?.length) {
      const orParts = filters.extractionQualities.map(
        (q) => `metadata->>extraction_quality.eq.${normalizeFilterText(q)}`,
      );
      if (filters.extractionQualities.includes("unknown")) orParts.push("metadata->>extraction_quality.is.null");
      documentQuery = documentQuery.or(orParts.join(","));
    }
    if (filters.importBatchIds?.length) {
      documentQuery = documentQuery.in("import_batch_id", filters.importBatchIds);
    }
    if (filters.collections?.length) {
      const orParts = filters.collections.map(
        (collection) => `metadata->>collection.ilike.${escapePostgrestValue(normalizeFilterText(collection))}`,
      );
      documentQuery = documentQuery.or(orParts.join(","));
    }

    if (args.signal) documentQuery = documentQuery.abortSignal(args.signal);
    const { data, error: documentError } = await documentQuery;
    if (documentError) throw new Error(documentError.message);
    documentRows.push(...((data ?? []) as ScopeDocumentRow[]));

    if ((data ?? []).length < documentScopeQueryPageSize) {
      break;
    }
  }

  if (documentRows.length >= maxResolvedDocuments) {
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

  const needsLabels =
    hasValues(filters.medications) ||
    hasValues(filters.topics) ||
    hasValues(filters.documentTypes) ||
    hasValues(filters.sites) ||
    hasValues(filters.services) ||
    hasValues(filters.settings) ||
    hasValues(filters.populations) ||
    hasValues(filters.risks) ||
    hasValues(filters.workflows) ||
    hasValues(filters.clinicalActions) ||
    hasValues(filters.carePhases) ||
    hasValues(filters.documentIntents) ||
    hasValues(filters.contentFeatures) ||
    hasValues(filters.labelTypesAny);
  let labelsByDocument = new Map<string, ScopeLabelRow[]>();
  if (needsLabels) {
    const labelRows = await loadScopeLabels({ supabase: args.supabase, candidateIds, signal: args.signal });
    labelsByDocument = new Map();
    for (const label of labelRows) {
      labelsByDocument.set(label.document_id, [...(labelsByDocument.get(label.document_id) ?? []), label]);
    }
  }

  const resolvedIds = candidateIds.filter((id) => {
    const labels = labelsByDocument.get(id) ?? [];
    return (
      labelMatches(labels, "medication", filters.medications) &&
      labelMatches(labels, "topic", filters.topics) &&
      labelMatches(labels, "document_type", filters.documentTypes) &&
      labelMatches(labels, "site", filters.sites) &&
      labelMatches(labels, "service", filters.services) &&
      labelMatches(labels, "setting", filters.settings) &&
      labelMatches(labels, "population", filters.populations) &&
      labelMatches(labels, "risk", filters.risks) &&
      labelMatches(labels, "workflow", filters.workflows) &&
      labelMatches(labels, "clinical_action", filters.clinicalActions) &&
      labelMatches(labels, "care_phase", filters.carePhases) &&
      labelMatches(labels, "document_intent", filters.documentIntents) &&
      labelMatches(labels, "content_feature", filters.contentFeatures) &&
      labelTypeAnyMatches(labels, filters.labelTypesAny)
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
