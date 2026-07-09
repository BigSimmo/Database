import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";
import { defaultServiceRecords } from "@/lib/registry-fixtures";

export type ServiceChipTone = "danger" | "info" | "warning" | "success" | "neutral";
export type ServiceCriterionTone = "meet" | "caution" | "reject";

export type ServiceStatusChip = {
  label?: string | null;
  tone?: ServiceChipTone | null;
};

export type ServiceContact = {
  label: string;
  value?: string | null;
  detail?: string | null;
  kind: "phone" | "email" | "web" | "text" | "unknown";
};

export type ServiceSummaryCard = {
  id: string;
  label?: string | null;
  title?: string | null;
  detail?: string | null;
};

export type ServiceInfoRow = {
  label: string;
  value?: string | null;
};

export type ServiceCriterion = {
  label: string;
  tone: ServiceCriterionTone;
};

export type ServiceVerification = {
  locallyVerified?: boolean | null;
  confidence?: "High" | "Medium" | "Low" | "Unknown" | null;
  notes?: string[] | null;
};

export type ServiceSource = {
  label?: string | null;
  status?: string | null;
  url?: string | null;
  published?: string | null;
  reviewed?: string | null;
  notes?: string[] | null;
};

export type ServiceRecord = {
  slug: string;
  title: string;
  subtitle?: string;
  statusChips?: ServiceStatusChip[];
  primaryContact?: ServiceContact;
  contacts?: ServiceContact[];
  route?: string;
  eligibility?: string;
  cost?: string;
  referral?: string;
  location?: string;
  summaryCards?: ServiceSummaryCard[];
  referralInfo?: ServiceInfoRow[];
  bestUse?: string;
  criteria?: ServiceCriterion[];
  verification?: ServiceVerification;
  tags?: string[];
  catchments?: string[];
  catalogueLabel?: string;
  navigatorQuery?: string;
  source?: ServiceSource;
};

export type ServiceSearchMatch = {
  service: ServiceRecord;
  score: number;
  reasons: string[];
};

export const serviceRecords: ServiceRecord[] = defaultServiceRecords();

export function loadServiceRecords(): ServiceRecord[] {
  return defaultServiceRecords();
}

export function getServiceRecord(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  return serviceRecords.find((service) => service.slug === normalizedSlug) ?? null;
}

export function serviceStaticParams() {
  return serviceRecords.map((service) => ({ slug: service.slug }));
}

export function defaultServiceSlug() {
  return serviceRecords[0]?.slug ?? null;
}

export function serviceNavigatorQuery(service: ServiceRecord) {
  return (
    [service.navigatorQuery, service.title, service.primaryContact?.value, service.subtitle].find((value) =>
      value?.trim(),
    ) ?? service.slug
  );
}

function serviceRecordSearchParts(service: ServiceRecord) {
  return [
    service.title,
    service.slug,
    service.subtitle,
    service.route,
    service.eligibility,
    service.cost,
    service.referral,
    service.location,
    service.bestUse,
    service.catalogueLabel,
    service.navigatorQuery,
    service.primaryContact?.value,
    service.primaryContact?.detail,
    service.source?.label,
    service.source?.status,
    service.source?.reviewed,
    ...(service.tags ?? []),
    ...(service.catchments ?? []),
    ...(service.statusChips ?? []).flatMap((chip) => [chip.label, chip.tone]),
    ...(service.contacts ?? []).flatMap((contact) => [contact.label, contact.value, contact.detail, contact.kind]),
    ...(service.summaryCards ?? []).flatMap((card) => [card.label, card.title, card.detail]),
    ...(service.referralInfo ?? []).flatMap((row) => [row.label, row.value]),
    ...(service.criteria ?? []).flatMap((criterion) => [criterion.label, criterion.tone]),
    ...(service.verification?.notes ?? []),
    ...(service.source?.notes ?? []),
    "service",
    "services",
    "source record",
    "pathway",
  ].filter((value): value is string => Boolean(value?.trim()));
}

export function serviceRecordSearchText(service: ServiceRecord) {
  return normalizeSearchText(serviceRecordSearchParts(service).join(" "));
}

export function rankServiceRecords(
  records: ServiceRecord[],
  query: string,
  limit = records.length,
  // Low-weight synonym/acronym/alias terms (see rankMedicationRecords) for the expanded lane.
  expansions: string[] = [],
): ServiceSearchMatch[] {
  return rankCatalogRecords(records, query, {
    fields: [
      { id: "title", weight: 6, text: (service) => normalizeSearchText(`${service.title} ${service.slug}`) },
      { id: "contact", weight: 5, text: (service) => normalizeSearchText(service.primaryContact?.value ?? "") },
      {
        id: "tags",
        weight: 3,
        text: (service) => normalizeSearchText([...(service.tags ?? []), ...(service.catchments ?? [])].join(" ")),
      },
    ],
    fullText: serviceRecordSearchText,
    contentWeight: 2,
    compactBonus: 5,
    phraseBonus: 4,
    broadTerms: ["service", "services", "pathway", "pathways"],
    broadBonus: 1,
    expandTokens: expansions.length ? (terms) => [...terms, ...expansions] : undefined,
    limit,
    tieBreak: (left, right) => left.title.localeCompare(right.title),
  }).map(({ record, score, signals }) => ({
    service: record,
    score,
    reasons: [
      signals.fields.title ? "title" : "",
      signals.fields.contact || signals.compact ? "contact" : "",
      signals.fields.tags ? "tags" : "",
      signals.content ? "record fields" : "",
      signals.broad ? "services catalogue" : "",
    ].filter(Boolean),
  }));
}

export function searchServiceRecords(query: string, limit = serviceRecords.length): ServiceSearchMatch[] {
  return rankServiceRecords(serviceRecords, query, limit);
}
