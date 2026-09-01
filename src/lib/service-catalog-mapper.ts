import type { CatalogService } from "@/lib/service-catalog";
import { catalogServiceSlug, extractEmails, extractPhones } from "@/lib/service-catalog";
import {
  compactBestUseTitle,
  compactCatalogField,
  parseLabeledReferralDetails,
  splitCatalogClauses,
} from "@/lib/compact-best-use-title";
import type {
  ServiceChipTone,
  ServiceContact,
  ServiceCriterion,
  ServiceInfoRow,
  ServiceRecord,
  ServiceSource,
  ServiceStatusChip,
  ServiceSummaryCard,
} from "@/lib/services";

export { compactBestUseTitle, compactCatalogField, parseLabeledReferralDetails, splitCatalogClauses };

const UNKNOWN_VALUES = /^(?:not publicly stated|not applicable|none|n\/a|unknown)$/i;

const CARD_MAX = 120;
const ROW_MAX = 160;

function isUnknown(value: string | undefined | null) {
  if (!value?.trim()) return true;
  return UNKNOWN_VALUES.test(value.trim());
}

function cleanField(value: string | undefined | null) {
  if (isUnknown(value)) return undefined;
  return value?.trim() || undefined;
}

/** Clean + compact a catalogue field for UI; returns undefined when empty/unknown. */
function displayField(value: string | undefined | null, maxLength = CARD_MAX): string | undefined {
  const cleaned = cleanField(value);
  if (!cleaned) return undefined;
  const compacted = compactCatalogField(cleaned, maxLength);
  return compacted || undefined;
}

function confidenceTone(confidence: string): ServiceChipTone {
  if (confidence === "High") return "success";
  if (confidence === "Medium") return "warning";
  if (confidence === "Low") return "danger";
  return "neutral";
}

function acuityChipTone(flag: string): ServiceChipTone {
  if (flag === "crisis_high" || flag === "high") return "danger";
  if (flag === "moderate") return "warning";
  return "info";
}

function acuityLabel(flag: string) {
  if (flag === "crisis_high") return "Crisis / urgent";
  if (flag === "high") return "High acuity";
  if (flag === "moderate") return "Moderate acuity";
  if (flag === "supportive") return "Supportive";
  return flag.replace(/_/g, " ");
}

function sourceStatusForService(service: CatalogService): string {
  if (
    service.confidence === "High" &&
    service.public_source_urls.length > 0 &&
    Boolean(service.web_review_status.trim()) &&
    service.verification_flags.length === 0
  ) {
    return "Source checked";
  }
  if (service.verification_flags.length > 0 || service.confidence === "Medium" || service.confidence === "Low") {
    return "Local confirmation required";
  }
  return "Review required";
}

function resolvePathway(service: CatalogService): string | undefined {
  const labeled = parseLabeledReferralDetails(service.referral_details);
  return displayField(service.referral_pathway) ?? displayField(labeled.pathway) ?? undefined;
}

function buildContacts(service: CatalogService): ServiceContact[] {
  const contacts: ServiceContact[] = [];
  const contactBlob = [service.contact_details, service.referral_details].filter(Boolean).join(" ");
  const phones = extractPhones(contactBlob);
  const emails = extractEmails(contactBlob);
  const hours = displayField(service.hours, ROW_MAX);

  for (const phone of phones) {
    contacts.push({
      label: phones.length > 1 ? `Phone ${contacts.filter((entry) => entry.kind === "phone").length + 1}` : "Phone",
      value: phone,
      detail: hours,
      kind: "phone",
    });
  }

  for (const email of emails) {
    contacts.push({
      label: "Email",
      value: email,
      kind: "email",
    });
  }

  for (const url of service.public_source_urls) {
    contacts.push({
      label: "Website",
      value: url,
      detail: "Public source URL",
      kind: "web",
    });
  }

  if (contacts.length === 0) {
    const contactValue = displayField(service.contact_details, ROW_MAX);
    if (contactValue) {
      contacts.push({
        label: "Contact",
        value: contactValue,
        kind: "unknown",
      });
    }
  }

  return contacts;
}

function buildStatusChips(service: CatalogService): ServiceStatusChip[] {
  const chips: ServiceStatusChip[] = [];

  for (const flag of service.tags.acuity_flags) {
    chips.push({ label: acuityLabel(flag), tone: acuityChipTone(flag) });
  }

  if (service.confidence) {
    chips.push({ label: `${service.confidence} confidence`, tone: confidenceTone(service.confidence) });
  }

  if (service.verification_flags.length > 0) {
    chips.push({ label: "Verify before use", tone: "warning" });
  }

  for (const section of service.sections.slice(0, 2)) {
    chips.push({ label: section, tone: "info" });
  }

  return chips;
}

function buildSummaryCards(service: CatalogService): ServiceSummaryCard[] {
  const cards: ServiceSummaryCard[] = [];
  const pathway = resolvePathway(service);

  if (pathway) {
    cards.push({
      id: "route",
      label: "Route",
      title: pathway,
      detail: displayField(service.patient_group) ?? displayField(service.region_catchment),
    });
  }

  const eligibility = displayField(service.eligibility_referral_criteria);
  if (eligibility) {
    cards.push({
      id: "eligibility",
      label: "Eligibility",
      title: eligibility,
      detail: displayField(service.patient_group),
    });
  }

  const cost = displayField(service.cost_funding);
  if (cost) {
    cards.push({
      id: "cost",
      label: "Cost",
      title: cost,
      detail: undefined,
    });
  }

  const bestUseRaw = cleanField(service.best_use_indication) ?? cleanField(service.discharge_planning_usefulness);
  if (bestUseRaw) {
    const title = compactCatalogField(bestUseRaw, CARD_MAX);
    if (title) {
      const patientGroup = displayField(service.patient_group);
      const sectionDetail = displayField(service.sections[0]);
      cards.push({
        id: "best-use",
        label: "Best use",
        title,
        detail: patientGroup ?? sectionDetail,
      });
    }
  }

  return cards;
}

function buildReferralInfo(service: CatalogService): ServiceInfoRow[] {
  const rows: ServiceInfoRow[] = [];
  const labeled = parseLabeledReferralDetails(service.referral_details);

  const add = (label: string, value: string | undefined, maxLength = ROW_MAX) => {
    const compacted = displayField(value, maxLength);
    if (compacted) rows.push({ label, value: compacted });
  };

  const pathway = displayField(service.referral_pathway, ROW_MAX) ?? displayField(labeled.pathway, ROW_MAX);
  if (pathway) {
    rows.push({ label: "Primary route", value: pathway });
  }

  const phones = extractPhones([service.contact_details, service.referral_details].join(" "));
  phones.forEach((phone, index) => add(phones.length > 1 ? `Phone ${index + 1}` : "Phone", phone));

  const emails = extractEmails([service.contact_details, service.referral_details].join(" "));
  emails.forEach((email) => add("Email", email));

  add("Provider", cleanField(service.provider) ?? labeled.provider);
  add("Region", cleanField(service.region_catchment) ?? labeled.region);
  add("Patient group", cleanField(service.patient_group) ?? labeled.patientGroup);
  add("Hours", cleanField(service.hours) ?? labeled.hours);
  add("Cost / funding", cleanField(service.cost_funding) ?? labeled.cost);
  const exclusions = splitCatalogClauses(service.exclusion_rejection_criteria, ROW_MAX);
  if (exclusions.length > 0) {
    rows.push({ label: "Exclusions", value: exclusions.join(" | ") });
  }
  add("Discharge planning", service.discharge_planning_usefulness);

  return rows;
}

function buildCriteria(service: CatalogService): ServiceCriterion[] {
  const criteria: ServiceCriterion[] = [];
  const seen = new Set<string>();

  const addMeet = (value: string | undefined, prefix?: string) => {
    const compacted = displayField(value, CARD_MAX);
    if (!compacted) return;
    const label = prefix ? `${prefix}${compacted}` : compacted;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    criteria.push({ label, tone: "meet" });
  };

  addMeet(service.best_use_indication);
  addMeet(service.referral_pathway, "Referral: ");

  for (const clause of splitCatalogClauses(service.eligibility_referral_criteria, CARD_MAX)) {
    addMeet(clause);
  }

  for (const clause of splitCatalogClauses(service.exclusion_rejection_criteria, CARD_MAX)) {
    const key = clause.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    criteria.push({ label: clause, tone: "reject" });
  }

  for (const flag of service.verification_flags) {
    const note = displayField(flag, CARD_MAX);
    if (note) criteria.push({ label: note, tone: "caution" });
  }

  if (isUnknown(service.hours)) {
    criteria.push({ label: "Hours not confirmed", tone: "caution" });
  }

  return criteria;
}

function flattenTags(service: CatalogService): string[] {
  return [
    ...service.sections,
    ...service.tags.age_groups,
    ...service.tags.setting_flags,
    ...service.tags.acuity_flags,
    ...service.tags.substance_flags,
    ...service.tags.housing_flags,
    ...service.merged_aliases,
    service.id,
  ].filter((value, index, array) => value && array.indexOf(value) === index);
}

function buildCatchments(service: CatalogService): string[] {
  const catchments = [...service.tags.catchments];
  const region = displayField(service.region_catchment, ROW_MAX);
  if (region && !catchments.some((entry) => entry.toLowerCase() === region.toLowerCase())) {
    catchments.unshift(region);
  }
  return catchments;
}

function buildSource(service: CatalogService): ServiceSource {
  const notes = [
    ...service.verification_flags,
    service.web_review_status,
    service.analyst_notes,
    service.source_documents.length > 0 ? `Source documents: ${service.source_documents.join(", ")}` : "",
  ].filter(Boolean);

  return {
    label: service.sections[0] ?? "WA psychiatric services catalogue",
    status: sourceStatusForService(service),
    url: service.public_source_urls[0] ?? undefined,
    reviewed: service.web_review_status || undefined,
    notes,
  };
}

export function catalogToServiceRecord(service: CatalogService): ServiceRecord {
  const contacts = buildContacts(service);
  const primaryContact = contacts[0];
  const pathway = resolvePathway(service);
  const bestUse = displayField(service.best_use_indication) ?? displayField(service.discharge_planning_usefulness);
  const eligibility = displayField(service.eligibility_referral_criteria) ?? displayField(service.inclusion_criteria);
  const cost = displayField(service.cost_funding);
  const referral = pathway ?? displayField(service.referral_details, ROW_MAX);

  return {
    slug: catalogServiceSlug(service),
    title: service.name,
    subtitle: bestUse ?? displayField(service.sections[0]) ?? undefined,
    statusChips: buildStatusChips(service),
    primaryContact,
    contacts,
    route: pathway,
    eligibility,
    cost,
    referral,
    location: displayField(service.region_catchment, ROW_MAX),
    summaryCards: buildSummaryCards(service),
    referralInfo: buildReferralInfo(service),
    bestUse,
    criteria: buildCriteria(service),
    verification: {
      locallyVerified: false,
      confidence: (service.confidence as "High" | "Medium" | "Low" | undefined) ?? "Unknown",
      notes: service.verification_flags.length > 0 ? service.verification_flags : ["Verify locally before use"],
    },
    tags: flattenTags(service),
    catchments: buildCatchments(service),
    catalogueLabel: service.sections[0] ?? "Catalogue service",
    navigatorQuery:
      cleanField(service.search_text) ?? `${service.name} ${service.provider} ${service.region_catchment}`,
    source: buildSource(service),
    // Facet matching needs the typed tag dimensions only. Keeping the full
    // catalogue record here would inflate every registry response with unused
    // source text and metadata.
    catalogPayload: { tags: service.tags },
  };
}

export function mapCatalogToServiceRecords(services: CatalogService[]): ServiceRecord[] {
  const records: ServiceRecord[] = [];
  const seenSlugs = new Set<string>();

  for (const service of services) {
    const record = catalogToServiceRecord(service);
    if (!record.title.trim()) {
      throw new Error(`Catalog service ${service.id} is missing a title.`);
    }
    if (seenSlugs.has(record.slug)) {
      throw new Error(`Duplicate service slug: ${record.slug}`);
    }
    seenSlugs.add(record.slug);
    records.push(record);
  }

  return records;
}
