import type { CatalogService } from "@/lib/service-catalog";
import { catalogServiceSlug, extractEmails, extractPhones, splitReferralLines } from "@/lib/service-catalog";
import { compactBestUseTitle } from "@/lib/compact-best-use-title";
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

const UNKNOWN_VALUES = /^(?:not publicly stated|not applicable|none|n\/a|unknown)$/i;

function isUnknown(value: string | undefined | null) {
  if (!value?.trim()) return true;
  return UNKNOWN_VALUES.test(value.trim());
}

function cleanField(value: string | undefined | null) {
  if (isUnknown(value)) return undefined;
  return value?.trim() || undefined;
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
  if (service.confidence === "High" && service.verification_flags.length === 0) {
    return "Source checked";
  }
  if (service.verification_flags.length > 0 || service.confidence === "Medium" || service.confidence === "Low") {
    return "Local confirmation required";
  }
  return "Review required";
}

function buildContacts(service: CatalogService): ServiceContact[] {
  const contacts: ServiceContact[] = [];
  const contactBlob = [service.contact_details, service.referral_details].filter(Boolean).join(" ");
  const phones = extractPhones(contactBlob);
  const emails = extractEmails(contactBlob);

  for (const phone of phones) {
    contacts.push({
      label: phones.length > 1 ? `Phone ${contacts.filter((entry) => entry.kind === "phone").length + 1}` : "Phone",
      value: phone,
      detail: cleanField(service.hours),
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

  if (contacts.length === 0 && !isUnknown(service.contact_details)) {
    contacts.push({
      label: "Contact",
      value: service.contact_details,
      kind: "unknown",
    });
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

  if (cleanField(service.referral_pathway)) {
    cards.push({
      id: "route",
      label: "Route",
      title: service.referral_pathway,
      detail: splitReferralLines(service.referral_details)[0],
    });
  } else if (cleanField(service.referral_details)) {
    cards.push({
      id: "route",
      label: "Route",
      title: splitReferralLines(service.referral_details)[0] ?? "See referral details",
      detail: cleanField(service.contact_details),
    });
  } else {
    cards.push({
      id: "route",
      label: "Route",
      title: "Contact service directly",
      detail: cleanField(service.contact_details) ?? "Confirm referral pathway locally",
    });
  }

  if (cleanField(service.eligibility_referral_criteria)) {
    cards.push({
      id: "eligibility",
      label: "Eligibility",
      title: service.eligibility_referral_criteria,
      detail: cleanField(service.patient_group),
    });
  }

  if (cleanField(service.cost_funding)) {
    cards.push({
      id: "cost",
      label: "Cost",
      title: service.cost_funding,
      detail: cleanField(service.hours) ?? "Confirm hours locally",
    });
  } else {
    cards.push({
      id: "cost",
      label: "Cost",
      title: "Confirm locally",
      detail: cleanField(service.hours) ?? "Cost not publicly stated",
    });
  }

  const bestUse = cleanField(service.best_use_indication) ?? cleanField(service.discharge_planning_usefulness);
  if (bestUse) {
<<<<<<< ours
<<<<<<< ours
    cards.push({
      id: "best-use",
      label: "Best use",
      title: bestUse,
      detail: cleanField(service.patient_group) ?? cleanField(service.sections[0]) ?? "Clinical fit and referral priority",
=======
    const title = compactBestUseTitle(bestUse);
    cards.push({
      id: "best-use",
      label: "Best use",
=======
    const title = compactBestUseTitle(bestUse);
    cards.push({
      id: "best-use",
      label: "Best use",
>>>>>>> theirs
      title,
      detail:
        compactBestUseTitle(cleanField(service.patient_group) ?? cleanField(service.sections[0]) ?? "") ||
        (title === bestUse ? "Clinical fit and referral priority" : bestUse),
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    });
  }

  return cards;
}

function buildReferralInfo(service: CatalogService): ServiceInfoRow[] {
  const rows: ServiceInfoRow[] = [];

  const add = (label: string, value: string | undefined) => {
    if (cleanField(value)) rows.push({ label, value: value!.trim() });
  };

  if (cleanField(service.referral_details)) {
    rows.push({ label: "Primary route", value: service.referral_details });
  }

  const phones = extractPhones([service.contact_details, service.referral_details].join(" "));
  phones.forEach((phone, index) => add(phones.length > 1 ? `Phone ${index + 1}` : "Phone", phone));

  const emails = extractEmails([service.contact_details, service.referral_details].join(" "));
  emails.forEach((email) => add("Email", email));

  add("Provider", service.provider);
  add("Region", service.region_catchment);
  add("Patient group", service.patient_group);
  add("Hours", service.hours);
  add("Cost / funding", service.cost_funding);
  add("Exclusions", service.exclusion_rejection_criteria);
  add("Discharge planning", service.discharge_planning_usefulness);

  return rows;
}

function buildCriteria(service: CatalogService): ServiceCriterion[] {
  const criteria: ServiceCriterion[] = [];

  if (cleanField(service.eligibility_referral_criteria)) {
    criteria.push({ label: service.eligibility_referral_criteria, tone: "meet" });
  }

  if (cleanField(service.best_use_indication)) {
    criteria.push({ label: service.best_use_indication, tone: "meet" });
  }

  if (cleanField(service.referral_pathway)) {
    criteria.push({ label: `Referral: ${service.referral_pathway}`, tone: "meet" });
  }

  if (cleanField(service.exclusion_rejection_criteria)) {
    criteria.push({ label: service.exclusion_rejection_criteria, tone: "reject" });
  }

  if (service.tags.acuity_flags.includes("crisis_high")) {
    criteria.push({ label: "Non-crisis routine referral only", tone: "reject" });
  }

  for (const flag of service.verification_flags) {
    criteria.push({ label: flag, tone: "caution" });
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
  if (cleanField(service.region_catchment) && !catchments.includes(service.region_catchment)) {
    catchments.unshift(service.region_catchment);
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

  return {
    slug: catalogServiceSlug(service),
    title: service.name,
    subtitle:
      cleanField(service.best_use_indication) ??
      cleanField(service.sections[0]) ??
      cleanField(service.discharge_planning_usefulness),
    statusChips: buildStatusChips(service),
    primaryContact,
    contacts,
    route:
      cleanField(service.referral_pathway) ??
      splitReferralLines(service.referral_details)[0] ??
      "Contact service directly",
    eligibility: cleanField(service.eligibility_referral_criteria) ?? cleanField(service.inclusion_criteria),
    cost: cleanField(service.cost_funding) ?? "Confirm locally",
    referral:
      cleanField(service.referral_details) ??
      [cleanField(service.referral_pathway), cleanField(service.contact_details)].filter(Boolean).join(" | "),
    location: cleanField(service.region_catchment),
    summaryCards: buildSummaryCards(service),
    referralInfo: buildReferralInfo(service),
    bestUse: cleanField(service.best_use_indication) ?? cleanField(service.discharge_planning_usefulness),
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
