import type { SearchScopeFilters } from "@/lib/search-scope";
import type { ClinicalQueryMode } from "@/lib/types";

export type SearchNavigationContext = {
  queryMode?: ClinicalQueryMode;
  scopeFilters?: SearchScopeFilters;
};

export type SearchNavigationOptions = SearchNavigationContext & {
  query?: string;
  focus?: boolean;
  run?: boolean;
};

type ReadableSearchParams = Pick<URLSearchParams, "get" | "getAll">;
type FreeTextScopeKey =
  | "medications"
  | "topics"
  | "documentTypes"
  | "sites"
  | "services"
  | "settings"
  | "populations"
  | "risks"
  | "workflows"
  | "clinicalActions"
  | "carePhases"
  | "documentIntents"
  | "contentFeatures"
  | "collections";

const queryModeParam = "queryMode";
const localityParam = "scope.locality";
const scopeParam = (key: keyof SearchScopeFilters) => `scope.${key}`;

const queryModes = new Set<ClinicalQueryMode>([
  "auto",
  "monitoring_schedule",
  "dose_threshold_lookup",
  "contraindications_cautions",
  "escalation_criteria",
  "required_documentation",
  "compare_guidance",
]);

const freeTextScopeKeys: readonly FreeTextScopeKey[] = [
  "medications",
  "topics",
  "documentTypes",
  "sites",
  "services",
  "settings",
  "populations",
  "risks",
  "workflows",
  "clinicalActions",
  "carePhases",
  "documentIntents",
  "contentFeatures",
  "collections",
];

const sourceStatuses = new Set<NonNullable<SearchScopeFilters["sourceStatuses"]>[number]>([
  "current",
  "review_due",
  "outdated",
  "unknown",
]);
const validationStatuses = new Set<NonNullable<SearchScopeFilters["validationStatuses"]>[number]>([
  "unverified",
  "locally_reviewed",
  "approved",
]);
const extractionQualities = new Set<NonNullable<SearchScopeFilters["extractionQualities"]>[number]>([
  "good",
  "partial",
  "poor",
  "unknown",
]);
const labelTypes = new Set<NonNullable<SearchScopeFilters["labelTypesAny"]>[number]>([
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
]);
const localityValues = new Set<NonNullable<SearchScopeFilters["locality"]>>(["local", "non_local"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uniqueTrimmed(values: string[], limit: number, maxLength: number) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .filter((value) => value.length <= maxLength)
    .slice(0, limit);
}

function allowedValues<T extends string>(values: string[], allowed: ReadonlySet<T>, limit: number): T[] {
  return uniqueTrimmed(values, limit, 120).filter((value): value is T => allowed.has(value as T));
}

function appendValues(
  params: URLSearchParams,
  key: keyof SearchScopeFilters,
  values: readonly string[] | undefined,
  limit: number,
  maxLength: number,
  isAllowed: (value: string) => boolean = () => true,
) {
  for (const value of uniqueTrimmed([...(values ?? [])], limit, maxLength).filter(isAllowed)) {
    params.append(scopeParam(key), value);
  }
}

export function appendSearchNavigationContext(params: URLSearchParams, context: SearchNavigationContext = {}) {
  if (context.queryMode && context.queryMode !== "auto" && queryModes.has(context.queryMode)) {
    params.set(queryModeParam, context.queryMode);
  }

  const filters = context.scopeFilters;
  if (!filters) return params;

  for (const key of freeTextScopeKeys) {
    appendValues(params, key, filters[key], 20, key === "sites" || key === "collections" ? 120 : 80);
  }
  appendValues(params, "sourceStatuses", filters.sourceStatuses, 4, 120, (value) =>
    sourceStatuses.has(value as NonNullable<SearchScopeFilters["sourceStatuses"]>[number]),
  );
  appendValues(params, "validationStatuses", filters.validationStatuses, 3, 120, (value) =>
    validationStatuses.has(value as NonNullable<SearchScopeFilters["validationStatuses"]>[number]),
  );
  appendValues(params, "extractionQualities", filters.extractionQualities, 4, 120, (value) =>
    extractionQualities.has(value as NonNullable<SearchScopeFilters["extractionQualities"]>[number]),
  );
  appendValues(params, "importBatchIds", filters.importBatchIds, 25, 36, (value) => uuidPattern.test(value));
  appendValues(params, "labelTypesAny", filters.labelTypesAny, 13, 120, (value) =>
    labelTypes.has(value as NonNullable<SearchScopeFilters["labelTypesAny"]>[number]),
  );
  if (filters.locality && localityValues.has(filters.locality)) params.set(localityParam, filters.locality);
  return params;
}

export function readSearchNavigationContext(params: ReadableSearchParams): Required<SearchNavigationContext> {
  const rawQueryMode = params.get(queryModeParam);
  const queryMode =
    rawQueryMode && queryModes.has(rawQueryMode as ClinicalQueryMode) ? (rawQueryMode as ClinicalQueryMode) : "auto";
  const scopeFilters: SearchScopeFilters = {};

  for (const key of freeTextScopeKeys) {
    const values = uniqueTrimmed(
      params.getAll(scopeParam(key)),
      20,
      key === "sites" || key === "collections" ? 120 : 80,
    );
    if (values.length) Object.assign(scopeFilters, { [key]: values });
  }

  const parsedSourceStatuses = allowedValues(params.getAll(scopeParam("sourceStatuses")), sourceStatuses, 4);
  if (parsedSourceStatuses.length) scopeFilters.sourceStatuses = parsedSourceStatuses;
  const parsedValidationStatuses = allowedValues(
    params.getAll(scopeParam("validationStatuses")),
    validationStatuses,
    3,
  );
  if (parsedValidationStatuses.length) scopeFilters.validationStatuses = parsedValidationStatuses;
  const parsedExtractionQualities = allowedValues(
    params.getAll(scopeParam("extractionQualities")),
    extractionQualities,
    4,
  );
  if (parsedExtractionQualities.length) scopeFilters.extractionQualities = parsedExtractionQualities;
  const parsedLabelTypes = allowedValues(params.getAll(scopeParam("labelTypesAny")), labelTypes, 13);
  if (parsedLabelTypes.length) scopeFilters.labelTypesAny = parsedLabelTypes;

  const importBatchIds = uniqueTrimmed(params.getAll(scopeParam("importBatchIds")), 25, 36).filter((value) =>
    uuidPattern.test(value),
  );
  if (importBatchIds.length) scopeFilters.importBatchIds = importBatchIds;

  const locality = params.get(localityParam);
  if (locality && localityValues.has(locality as NonNullable<SearchScopeFilters["locality"]>)) {
    scopeFilters.locality = locality as NonNullable<SearchScopeFilters["locality"]>;
  }

  return { queryMode, scopeFilters };
}
