import servicesSnapshot from "../../data/services-snapshot.json";

export type CatalogServiceTags = {
  catchments: string[];
  age_groups: string[];
  setting_flags: string[];
  acuity_flags: string[];
  substance_flags: string[];
  housing_flags: string[];
};

export type CatalogService = {
  id: string;
  name: string;
  sections: string[];
  inclusion_criteria: string;
  exclusions: string;
  referral_details: string;
  tags: CatalogServiceTags;
  source_files: string[];
  provider: string;
  region_catchment: string;
  patient_group: string;
  best_use_indication: string;
  referral_pathway: string;
  eligibility_referral_criteria: string;
  exclusion_rejection_criteria: string;
  contact_details: string;
  hours: string;
  cost_funding: string;
  discharge_planning_usefulness: string;
  confidence: string;
  confidence_rank?: number;
  public_source_urls: string[];
  web_review_status: string;
  source_documents: string[];
  source_row_count?: number;
  merged_aliases: string[];
  source_table_lines: string;
  deep_research_citation_tokens: string;
  verification_flags: string[];
  analyst_notes: string;
  search_text: string;
  canonical_name_key: string;
};

export type ServiceCatalogSnapshot = {
  source?: string[];
  service_count: number;
  package?: Record<string, unknown>;
  services: CatalogService[];
};

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(\+?\d[\d ()-]{6,}\d)/g;

let cachedSnapshot: ServiceCatalogSnapshot | null = null;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter((entry) => entry.length > 0);
}

function toCleanText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const clean = value.trim();
  return clean.length > 0 ? clean : fallback;
}

function toCleanNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeServiceId(value: unknown, fallback: string): string {
  const clean = toCleanText(value, fallback);
  if (/^S\d{3}$/i.test(clean)) return clean.toUpperCase();
  return clean.toLowerCase().replace(/\s+/g, "-");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function extractEmails(text: string): string[] {
  return unique((text.match(EMAIL_PATTERN) ?? []).map((value) => value.trim()));
}

export function extractPhones(text: string): string[] {
  return unique(
    (text.match(PHONE_PATTERN) ?? [])
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter((value) => value.length >= 8),
  );
}

export function splitReferralLines(text: string): string[] {
  return text
    .split(/[|\n\r]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeCatalogService(raw: unknown, index: number): CatalogService {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const fallbackId = `service-${index + 1}`;
  const tagsSource =
    typeof source.tags === "object" && source.tags !== null
      ? (source.tags as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  return {
    id: normalizeServiceId(source.id, fallbackId),
    name: toCleanText(source.name, `Untitled Service ${index + 1}`),
    sections: toStringArray(source.sections),
    inclusion_criteria: toCleanText(source.inclusion_criteria),
    exclusions: toCleanText(source.exclusions),
    referral_details: toCleanText(source.referral_details),
    tags: {
      catchments: toStringArray(tagsSource.catchments),
      age_groups: toStringArray(tagsSource.age_groups),
      setting_flags: toStringArray(tagsSource.setting_flags),
      acuity_flags: toStringArray(tagsSource.acuity_flags),
      substance_flags: toStringArray(tagsSource.substance_flags),
      housing_flags: toStringArray(tagsSource.housing_flags),
    },
    source_files: toStringArray(source.source_files),
    provider: toCleanText(source.provider),
    region_catchment: toCleanText(source.region_catchment),
    patient_group: toCleanText(source.patient_group),
    best_use_indication: toCleanText(source.best_use_indication),
    referral_pathway: toCleanText(source.referral_pathway),
    eligibility_referral_criteria: toCleanText(source.eligibility_referral_criteria),
    exclusion_rejection_criteria: toCleanText(source.exclusion_rejection_criteria),
    contact_details: toCleanText(source.contact_details),
    hours: toCleanText(source.hours),
    cost_funding: toCleanText(source.cost_funding),
    discharge_planning_usefulness: toCleanText(source.discharge_planning_usefulness),
    confidence: toCleanText(source.confidence),
    confidence_rank: toCleanNumber(source.confidence_rank),
    public_source_urls: toStringArray(source.public_source_urls),
    web_review_status: toCleanText(source.web_review_status),
    source_documents: toStringArray(source.source_documents),
    source_row_count: toCleanNumber(source.source_row_count),
    merged_aliases: toStringArray(source.merged_aliases),
    source_table_lines: toCleanText(source.source_table_lines),
    deep_research_citation_tokens: toCleanText(source.deep_research_citation_tokens),
    verification_flags: toStringArray(source.verification_flags),
    analyst_notes: toCleanText(source.analyst_notes),
    search_text: toCleanText(source.search_text),
    canonical_name_key: toCleanText(source.canonical_name_key),
  };
}

export function normalizeCatalogServices(rawCatalog: unknown): CatalogService[] {
  const source =
    typeof rawCatalog === "object" && rawCatalog !== null
      ? (rawCatalog as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const services = Array.isArray(source.services) ? source.services : [];
  const seenIds = new Map<string, number>();

  return services.map((service, index) => {
    const normalized = normalizeCatalogService(service, index);
    const seenCount = seenIds.get(normalized.id) ?? 0;
    seenIds.set(normalized.id, seenCount + 1);

    if (seenCount === 0) return normalized;
    return {
      ...normalized,
      id: `${normalized.id}-${seenCount + 1}`,
    };
  });
}

export function loadServicesSnapshot(): ServiceCatalogSnapshot {
  if (cachedSnapshot) return cachedSnapshot;
  const parsed = servicesSnapshot as ServiceCatalogSnapshot;
  cachedSnapshot = {
    ...parsed,
    services: normalizeCatalogServices(parsed),
  };
  return cachedSnapshot;
}

export function catalogServiceSlug(service: CatalogService): string {
  const key = service.canonical_name_key.trim().toLowerCase();
  if (key) return key;
  return service.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function catalogPayloadBySlug(snapshot = loadServicesSnapshot()): Map<string, CatalogService> {
  const map = new Map<string, CatalogService>();
  for (const service of snapshot.services) {
    map.set(catalogServiceSlug(service), service);
  }
  return map;
}
