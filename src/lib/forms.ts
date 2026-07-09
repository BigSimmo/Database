import { normalizeSearchText, rankCatalogRecords } from "@/lib/catalog-search";
import type { ServiceRecord, ServiceSearchMatch } from "@/lib/services";

export type FormRecord = ServiceRecord;
export type FormSearchMatch = ServiceSearchMatch;

export const formRecords: FormRecord[] = [
  {
    slug: "transport-crisis-form",
    title: "Transport order",
    subtitle: "Use where a person must be conveyed and no other safe means is reasonably available.",
    statusChips: [
      { label: "High risk", tone: "danger" },
      { label: "Transport", tone: "info" },
      { label: "MHA readiness", tone: "success" },
    ],
    primaryContact: {
      label: "Primary contact",
      value: "Crisis and transfer coordination",
      detail: "24/7 transfer coordination desk",
      kind: "text",
    },
    route: "Use for non-routine transfers with destination, expiry, and escort notes confirmed",
    eligibility: "A person must be conveyed and no other safe means is reasonably available",
    cost: "Internal clinical form",
    referral: "Only complete once destination, authorised maker, escort capacity, and red flags are confirmed.",
    location: "Crisis, emergency department, inpatient, and transfer pathways",
    summaryCards: [
      {
        id: "clock",
        label: "Clock / expiry",
        title: "Referral window aligned",
        detail: "Confirm live referral, detention pathway, and time limits before signing.",
      },
      {
        id: "destination",
        label: "Destination / place",
        title: "Destination is essential",
        detail: "Exact destination must match the transport pathway and receiving service.",
      },
      {
        id: "authority",
        label: "Made by / authority",
        title: "Authorised maker",
        detail: "The maker must be specified by the transport pathway and local governance.",
      },
      {
        id: "criteria",
        label: "Criteria / threshold",
        title: "Transport is necessary",
        detail: "Document why no less restrictive safe option is available.",
      },
    ],
    referralInfo: [
      { label: "Use only when", value: "A person must be conveyed and no other safe means is reasonably available." },
      {
        label: "Before signing",
        value: "Confirm origin, destination, transport provider, linked form, expiry, and less restrictive options.",
      },
      {
        label: "Clinical pearl",
        value: "Transport is a separate legal step, not an automatic consequence of referral.",
      },
      { label: "Documentation stem", value: "Use this stem to document the form in the clinical record." },
    ],
    bestUse:
      "Use this form to keep transport authority specific to the journey, destination, linked live authority, and least restrictive option review.",
    criteria: [
      { label: "Destination confirmed", tone: "meet" },
      { label: "Authorised maker specified", tone: "meet" },
      { label: "Risk mitigation plan", tone: "meet" },
      { label: "Less restrictive safe option available", tone: "reject" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: [
        "Supports psychiatry transfer safety and escort-readiness workflows",
        "Confirm local MHA form wording and expiry windows before use",
      ],
    },
    tags: ["Transport", "Transfer", "Crisis", "Mental Health Act", "Dispatch"],
    catchments: ["Urban transfer network", "Remote outreach", "Crisis mobile teams", "Emergency psychiatry"],
    catalogueLabel: "Clinical form",
    navigatorQuery: "transport order form destination authority least restrictive safe transport",
    source: {
      label: "Official transport order source",
      status: "Local confirmation required",
      reviewed: "Template reviewed July 2026",
      notes: [
        "Confirm local dispatch thresholds and documentation rules",
        "Use the current approved form or PSOLIS pathway where available",
      ],
    },
  },
  {
    slug: "extension-transport-order",
    title: "Extension of Transport Order",
    subtitle: "Extend a transport authority when the current conveyance window will not safely cover the journey.",
    statusChips: [{ label: "Transport", tone: "info" }],
    primaryContact: {
      label: "Primary contact",
      value: "Crisis and transfer coordination",
      detail: "Confirm current transport authority before extension",
      kind: "text",
    },
    route: "Use only where the transport pathway remains live and the original journey still requires authority",
    eligibility: "Person subject to an active transport order where extra time is clinically and legally required",
    cost: "Internal clinical form",
    referral: "Check current order, maker, destination, escort plan, and expiry before completing the extension.",
    location: "Crisis, emergency department, inpatient, and transfer pathways",
    bestUse: "Keeps a delayed but continuous transport episode aligned to the same destination and receiving service.",
    criteria: [
      { label: "Current order confirmed", tone: "meet" },
      { label: "Destination unchanged", tone: "meet" },
      { label: "Expiry reviewed", tone: "meet" },
      { label: "New transfer episode required", tone: "reject" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: ["Use only with the current approved local form and transport pathway"],
    },
    tags: ["Transport", "Extension", "Expiry", "Mental Health Act"],
    catchments: ["Urban transfer network", "Remote outreach", "Crisis mobile teams"],
    catalogueLabel: "Clinical form",
    navigatorQuery: "extension of transport order expiry transport pathway destination",
    source: {
      label: "Official transport pathway source",
      status: "Official source",
      reviewed: "Template reviewed July 2026",
      notes: ["Confirm local expiry rules before use"],
    },
  },
  {
    slug: "detention-examination-movement",
    title: "Detention to enable examination or movement",
    subtitle: "Authority used when detention is required so an examination or movement step can occur safely.",
    statusChips: [
      { label: "High risk", tone: "danger" },
      { label: "Detention", tone: "info" },
    ],
    primaryContact: {
      label: "Primary contact",
      value: "Assessment pathway lead",
      detail: "Coordinate with authorised examiner and receiving place",
      kind: "text",
    },
    route: "Sits parallel to transport where detention and examination requirements intersect",
    eligibility: "Person requiring detention to enable examination or movement under the pathway",
    cost: "Internal clinical form",
    referral: "Use where examination, place, time limit, and detention threshold have been confirmed.",
    location: "Emergency department, inpatient, crisis, and receiving destination pathways",
    bestUse: "Clarifies the legal basis for detention while a transport or examination step is underway.",
    criteria: [
      { label: "Examination pathway confirmed", tone: "meet" },
      { label: "Detention threshold documented", tone: "meet" },
      { label: "Destination confirmed", tone: "meet" },
      { label: "Voluntary pathway available", tone: "reject" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: ["Shown as a parallel linked pathway in the transport workflow"],
    },
    tags: ["Detention", "Examination", "Movement", "Transport pathway"],
    catchments: ["Emergency psychiatry", "Crisis mobile teams", "Receiving services"],
    catalogueLabel: "Clinical form",
    navigatorQuery: "detention to enable examination or movement transport pathway",
    source: {
      label: "Official examination and movement source",
      status: "Official source",
      reviewed: "Template reviewed July 2026",
      notes: ["Confirm local detention threshold and time limit"],
    },
  },
  {
    slug: "transfer-order",
    title: "Transfer order",
    subtitle: "Transfer authority for movement between services or destinations when transfer and transport overlap.",
    statusChips: [{ label: "Transfer", tone: "success" }],
    primaryContact: {
      label: "Primary contact",
      value: "Transfer coordination desk",
      detail: "Confirm receiving service acceptance before use",
      kind: "text",
    },
    route: "Use after referral and transport checks where a transfer authority is required",
    eligibility: "Person requiring transfer between approved services, places, or pathway stages",
    cost: "Internal clinical form",
    referral: "Confirm receiving service, current authority, clinical escort plan, and transport timing.",
    location: "Transfer, inpatient, destination, and transport pathways",
    bestUse: "Supports a transfer step where transport details must stay aligned with the receiving service.",
    criteria: [
      { label: "Receiving service accepted", tone: "meet" },
      { label: "Transfer authority confirmed", tone: "meet" },
      { label: "Transport timing aligned", tone: "meet" },
      { label: "Destination unclear", tone: "reject" },
    ],
    verification: {
      locallyVerified: true,
      confidence: "High",
      notes: ["Use with the approved transfer and transport pathway documentation"],
    },
    tags: ["Transfer", "Transport", "Destination", "Mental Health Act"],
    catchments: ["Inpatient units", "Emergency psychiatry", "Receiving facilities"],
    catalogueLabel: "Clinical form",
    navigatorQuery: "transfer order transport pathway receiving service destination",
    source: {
      label: "Official transfer pathway source",
      status: "Official source",
      reviewed: "Template reviewed July 2026",
      notes: ["Confirm current local transfer form before use"],
    },
  },
];

export function formRecordSearchText(form: FormRecord) {
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
    "form",
    "forms",
    "checklist",
    "assessment",
    "transfer",
    "template",
  ].filter((value): value is string => Boolean(value?.trim()));

  return normalizeSearchText(values.join(" "));
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function getFormRecord(slug: string) {
  const normalizedSlug = normalizeSlug(slug);
  return formRecords.find((form) => form.slug === normalizedSlug) ?? null;
}

export function formStaticParams() {
  return formRecords.map((form) => ({ slug: form.slug }));
}

export function defaultFormSlug() {
  return formRecords[0]?.slug ?? null;
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

export function searchFormRecords(query: string, limit = formRecords.length): FormSearchMatch[] {
  return rankFormRecords(formRecords, query, limit);
}
