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

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
): ServiceSearchMatch[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const terms = Array.from(new Set(normalizedQuery.split(/\s+/).filter((term) => term.length > 1)));
  const broadServicesQuery = terms.some((term) => ["service", "services", "pathway", "pathways"].includes(term));

  return records
    .map((service) => {
      const title = normalizeSearchText(service.title);
      const slug = normalizeSearchText(service.slug);
      const contact = normalizeSearchText(service.primaryContact?.value ?? "");
      const tags = normalizeSearchText([...(service.tags ?? []), ...(service.catchments ?? [])].join(" "));
      const text = serviceRecordSearchText(service);
      const compactText = text.replace(/\s+/g, "");
      const matchedTerms = terms.filter((term) => text.includes(term));
      const titleMatches = terms.filter((term) => title.includes(term) || slug.includes(term));
      const contactMatches = terms.filter((term) => contact.includes(term));
      const tagMatches = terms.filter((term) => tags.includes(term));
      const compactContactMatch = compactQuery.length >= 4 && compactText.includes(compactQuery);

      let score = 0;
      score += titleMatches.length * 6;
      score += contactMatches.length * 5;
      if (compactContactMatch) score += 5;
      score += tagMatches.length * 3;
      score += matchedTerms.length * 2;
      if (broadServicesQuery) score += 1;
      if (normalizedQuery && text.includes(normalizedQuery)) score += 4;

      const reasons = [
        titleMatches.length ? "title" : "",
        contactMatches.length || compactContactMatch ? "contact" : "",
        tagMatches.length ? "tags" : "",
        matchedTerms.length ? "record fields" : "",
        broadServicesQuery ? "services catalogue" : "",
      ].filter(Boolean);

      return { service, score, reasons };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.service.title.localeCompare(right.service.title))
    .slice(0, limit);
}

export function searchServiceRecords(query: string, limit = serviceRecords.length): ServiceSearchMatch[] {
  return rankServiceRecords(serviceRecords, query, limit);
}
