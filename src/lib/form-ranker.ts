import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";
import type { ServiceRecord, ServiceSearchMatch } from "@/lib/service-ranker";

export type FormRecord = ServiceRecord;
export type FormSearchMatch = ServiceSearchMatch;

export type FormAvailability = "downloadable" | "unavailable" | "contact_ocp";

export type FormCatalogDetails = {
  id: string;
  form: string;
  name: string;
  category: string;
  purpose: string;
  maker: string;
  involved: string;
  threshold: string;
  clock: string;
  destination: string;
  authorises: string;
  doesNotAuthorise: string;
  before: string[];
  parallel: string[];
  after: string[];
  copies: string;
  documentationStem: string;
  traps: string[];
  safetyPearl: string;
  sourceNote: string;
  aliases: string[];
  searchTerms: string[];
  riskLevel: "high" | "medium" | "low";
  indexedClock?: string;
  indexedTerms?: string[];
  legalNote: string;
  practicePearls: string[];
  preUseChecks: string[];
  sourceFacts?: {
    documentTitle?: string;
    fileName?: string;
    pages?: number;
    timings?: string[];
    sectionCue?: string;
    indexedAt?: string;
  };
  availability: FormAvailability;
  officialPdfUrl?: string;
  officialRegisterUrl: string;
  localPdfPath?: string;
  localPdfSha256?: string;
  localPdfBytes?: number;
  officialPdfPasswordProtected?: boolean;
  officialTitleCheckedAt: string;
  archiveGeneratedAt?: string;
};

export function formCatalogDetails(record: FormRecord): FormCatalogDetails | null {
  const payload = record.catalogPayload;
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Partial<FormCatalogDetails>;
  if (!candidate.form || !candidate.name || !candidate.category || !candidate.availability) return null;
  return candidate as FormCatalogDetails;
}

export function formRecordSearchText(form: FormRecord) {
  const details = formCatalogDetails(form);
  const values = [
    form.title,
    form.slug,
    form.subtitle,
    form.route,
    form.eligibility,
    form.cost,
    form.referral,
    form.location,
    form.bestUse,
    form.catalogueLabel,
    form.navigatorQuery,
    form.primaryContact?.value,
    form.primaryContact?.detail,
    form.source?.label,
    form.source?.status,
    form.source?.reviewed,
    ...(form.tags ?? []),
    ...(form.catchments ?? []),
    ...(form.statusChips ?? []).flatMap((chip) => [chip.label]),
    ...(form.contacts ?? []).flatMap((contact) => [contact.label, contact.value, contact.detail]),
    ...(form.summaryCards ?? []).flatMap((card) => [card.label, card.title, card.detail]),
    ...(form.referralInfo ?? []).flatMap((row) => [row.label, row.value]),
    ...(form.criteria ?? []).flatMap((criterion) => [criterion.label, criterion.tone]),
    ...(form.verification?.notes ?? []),
    details?.form,
    details?.category,
    details?.purpose,
    details?.maker,
    details?.threshold,
    details?.clock,
    details?.authorises,
    details?.doesNotAuthorise,
    ...(details?.aliases ?? []),
    ...(details?.searchTerms ?? []),
    ...(details?.indexedTerms ?? []),
    "form",
    "forms",
    "checklist",
    "assessment",
    "transfer",
    "template",
  ].filter((value): value is string => Boolean(value?.trim()));

  return normalizeSearchText(values.join(" "));
}

export function formNavigatorQuery(form: FormRecord) {
  return (
    [form.navigatorQuery, form.title, form.primaryContact?.value, form.subtitle, form.slug].find((value) =>
      value?.trim(),
    ) ?? form.slug
  );
}

export function rankFormRecords(
  records: FormRecord[],
  query: string,
  limit = records.length,
  // Low-weight synonym/acronym/alias terms (see rankMedicationRecords) for the expanded lane.
  expansions: string[] = [],
): FormSearchMatch[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];
  // A bare "service(s)" query belongs to the services catalogue, not forms.
  if (/^services?$/.test(normalizedQuery)) return [];

  return rankCatalogRecords(records, query, {
    fields: [
      { id: "title", weight: 6, text: (form) => normalizeSearchText(`${form.title} ${form.slug}`) },
      { id: "contact", weight: 5, text: (form) => normalizeSearchText(form.primaryContact?.value ?? "") },
    ],
    fullText: formRecordSearchText,
    contentWeight: 2,
    compactBonus: 5,
    phraseBonus: 4,
    broadTerms: [
      "form",
      "forms",
      "checklist",
      "transport",
      "transfer",
      "extension",
      "detention",
      "movement",
      "examination",
      "template",
      "assessment",
    ],
    broadBonus: 1,
    expandTokens: expansions.length ? (terms) => [...terms, ...expansions] : undefined,
    limit,
    // No tieBreak: forms historically tie-break by catalogue (input) order, which is the
    // generic ranker's default.
  }).map(({ record, score, signals }) => ({
    service: record,
    score,
    reasons: [
      signals.fields.title ? "title" : "",
      signals.fields.contact || signals.compact ? "contact" : "",
      signals.content ? "record fields" : "",
      signals.broad ? "psychiatry forms catalogue" : "",
    ].filter(Boolean),
  }));
}
