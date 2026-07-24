import formsCatalog from "../../data/forms-catalog.json";
import formsPdfManifest from "../../data/forms-pdf-manifest.json";

import type { FormAvailability, FormCatalogDetails } from "@/lib/form-ranker";
import type { ServiceChipTone, ServiceRecord } from "@/lib/services";

export { formCatalogDetails } from "@/lib/form-ranker";
export type { FormAvailability, FormCatalogDetails } from "@/lib/form-ranker";
export type FormRecord = ServiceRecord;

export const officialFormsRegisterUrl =
  "https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/legislation/mental-health-act-2014-forms/";
export const officialFormsReviewedDate = "17 July 2026";

type OfficialForm = {
  code: string;
  title: string;
  category: string;
  availability?: FormAvailability;
};

const officialForms: OfficialForm[] = [
  { code: "1A", title: "Referral for examination by a psychiatrist", category: "Referral and detention" },
  {
    code: "1A attachment",
    title: "Information provided by another person in confidence",
    category: "Referral and detention",
  },
  { code: "1B", title: "Variation of referral", category: "Referral and detention" },
  {
    code: "2",
    title: "Order to detain voluntary inpatient in authorised hospital for assessment",
    category: "Referral and detention",
  },
  { code: "3A", title: "Detention order", category: "Referral and detention" },
  { code: "3B", title: "Continuation of detention", category: "Referral and detention" },
  {
    code: "3C",
    title: "Continuation of detention to enable a further examination by a psychiatrist",
    category: "Referral and detention",
  },
  {
    code: "3D",
    title: "Order authorising reception and detention in an authorised hospital for further examination",
    category: "Referral and detention",
  },
  { code: "3E", title: "Order that person cannot continue to be detained", category: "Referral and detention" },
  { code: "4A", title: "Transport order", category: "Transport and transfer" },
  { code: "4B", title: "Extension of transport order", category: "Transport and transfer" },
  { code: "4C", title: "Transfer order", category: "Transport and transfer" },
  { code: "4D", title: "Interstate transfer order", category: "Transport and transfer", availability: "unavailable" },
  {
    code: "4E",
    title: "Approval of interstate transfer order",
    category: "Transport and transfer",
    availability: "unavailable",
  },
  { code: "5A", title: "Community Treatment Order", category: "Community treatment orders" },
  { code: "5B", title: "Continuation of Community Treatment Order", category: "Community treatment orders" },
  { code: "5C", title: "Variation of terms of Community Treatment Order", category: "Community treatment orders" },
  {
    code: "5D",
    title:
      "Request made by a supervising psychiatrist for a practitioner to conduct the monthly examination of a patient",
    category: "Community treatment orders",
  },
  {
    code: "5E",
    title: "Notice and record of breach of Community Treatment Order",
    category: "Community treatment orders",
  },
  { code: "5F", title: "Order to attend", category: "Community treatment orders" },
  { code: "6A", title: "Inpatient treatment order in authorised hospital", category: "Inpatient treatment orders" },
  { code: "6B", title: "Inpatient treatment order in general hospital", category: "Inpatient treatment orders" },
  {
    code: "6B attachment",
    title: "Inpatient treatment order in a general hospital: report to Chief Psychiatrist",
    category: "Inpatient treatment orders",
  },
  { code: "6C", title: "Continuation of inpatient treatment order", category: "Inpatient treatment orders" },
  { code: "6D", title: "Confirmation of inpatient treatment order", category: "Inpatient treatment orders" },
  { code: "7A", title: "Grant of leave to involuntary inpatient", category: "Leave and absence without leave" },
  { code: "7B", title: "Extension and/or variation of leave", category: "Leave and absence without leave" },
  { code: "7C", title: "Cancellation of grant of leave", category: "Leave and absence without leave" },
  { code: "7D", title: "Apprehension and return order", category: "Leave and absence without leave" },
  { code: "8A", title: "Record of search and seizure", category: "Search and seizure" },
  { code: "8B", title: "Record dealing with seized article", category: "Search and seizure" },
  { code: "9A", title: "Record of emergency psychiatric treatment", category: "Treatments" },
  {
    code: "9B",
    title: "Report to Chief Psychiatrist about provision of urgent non-psychiatric treatment",
    category: "Treatments",
  },
  { code: "10A", title: "Record of oral authorisation of bodily restraint", category: "Restraint" },
  { code: "10B", title: "Written bodily restraint order", category: "Restraint" },
  {
    code: "10C",
    title: "Record of informing medical practitioner and treating psychiatrist of bodily restraint",
    category: "Restraint",
  },
  { code: "10D", title: "Record of observations made of restrained person", category: "Restraint" },
  {
    code: "10E",
    title: "Record of examination of restrained person and possible extension of bodily restraint",
    category: "Restraint",
  },
  { code: "10F", title: "Variation of bodily restraint order", category: "Restraint" },
  { code: "10G", title: "Revocation of expiry of bodily restraint order", category: "Restraint" },
  { code: "10H", title: "Review of bodily restraint order by a psychiatrist", category: "Restraint" },
  { code: "10I", title: "Record of post-bodily restraint examination", category: "Restraint" },
  { code: "11A", title: "Record of oral authorisation of seclusion", category: "Seclusion" },
  { code: "11B", title: "Written seclusion order", category: "Seclusion" },
  {
    code: "11C",
    title: "Record of informing medical practitioner and treating psychiatrist of seclusion",
    category: "Seclusion",
  },
  { code: "11D", title: "Record of observations made of secluded person", category: "Seclusion" },
  {
    code: "11E",
    title: "Record of examination of secluded person and possible extension of seclusion",
    category: "Seclusion",
  },
  { code: "11F", title: "Revocation or expiry of seclusion order", category: "Seclusion" },
  { code: "11G", title: "Record of post-seclusion examination", category: "Seclusion" },
  { code: "12A", title: "Nomination of nominated person", category: "Access to information and communication" },
  {
    code: "12B",
    title: "Record of refusal of patient’s request to access document",
    category: "Access to information and communication",
  },
  {
    code: "12C",
    title: "Restriction on freedom of communication",
    category: "Access to information and communication",
  },
  {
    code: "12C attachment",
    title: "Record of confirmation, amendment or revocation of restriction of freedom of communication",
    category: "Access to information and communication",
  },
  { code: "13", title: "Statistics about ECT", category: "Electroconvulsive therapy", availability: "contact_ocp" },
];

const legacySlugs: Record<string, string> = {
  "3A": "detention-examination-movement",
  "4A": "transport-crisis-form",
  "4B": "extension-transport-order",
  "4C": "transfer-order",
};

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formSlug(code: string) {
  return (
    legacySlugs[code] ??
    `form-${normalizeCode(code)
      .replace(/attachment/g, "attachment")
      .replace(/[^a-z0-9]+/g, "-")}`
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function riskLevel(value: unknown): FormCatalogDetails["riskLevel"] {
  return value === "high" || value === "low" ? value : "medium";
}

const archiveGeneratedAt = text(
  (formsCatalog as { exportMetadata?: { generatedAt?: unknown } }).exportMetadata?.generatedAt,
);
const archivedForms = Array.isArray((formsCatalog as { forms?: unknown[] }).forms)
  ? (formsCatalog as { forms: unknown[] }).forms
  : [];
const archivedByCode = new Map(
  archivedForms.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const code = text(raw.form);
    return code ? ([[normalizeCode(code), raw]] as const) : [];
  }),
);
const pdfAssetByCode = new Map(formsPdfManifest.assets.map((asset) => [normalizeCode(asset.code), asset] as const));

function fallbackDetails(form: OfficialForm): Partial<FormCatalogDetails> {
  const action = form.availability === "unavailable" ? "is currently unavailable" : "must be obtained from the OCP";
  return {
    purpose:
      form.availability && form.availability !== "downloadable"
        ? `The official register lists this form, but it ${action}. Check the register and local governance before proceeding.`
        : `Use the current approved Form ${form.code} to record ${form.title.toLowerCase()} when the statutory and local requirements are met.`,
    maker:
      "Only an appropriately authorised person under the Mental Health Act 2014 and the approved form instructions.",
    involved:
      "Confirm the required recipients, support persons, records and local PSOLIS workflow on the current approved form.",
    threshold: "Confirm the statutory criteria and completion instructions on the current approved form before use.",
    clock: "Confirm any time limit, expiry or review point on the current approved form and local policy.",
    destination: "Confirm any required place or destination on the approved form.",
    authorises: `Only the action or record expressly described by Form ${form.code} and the Mental Health Act 2014.`,
    doesNotAuthorise: "No action beyond the current Act, approved form wording and the maker’s lawful authority.",
    legalNote:
      "Use only the current approved form or PSOLIS pathway. This catalogue is a reference aid, not legal advice, and does not replace the Act, form instructions or local governance.",
    sourceNote: "Official title and availability checked against the Office of the Chief Psychiatrist register.",
    safetyPearl:
      "Open the current official source and confirm authority, timing, notices and filing requirements before completion.",
    preUseChecks: [
      "Open the current official form or PSOLIS workflow before use.",
      "Confirm the maker is appropriately authorised and all statutory criteria are met.",
      "Confirm identifiers, date, time, signatures, notices, copies and filing requirements.",
    ],
    practicePearls: ["Treat the approved form and current legislation as authoritative."],
  };
}

function detailsFor(form: OfficialForm): FormCatalogDetails {
  const raw = archivedByCode.get(normalizeCode(form.code)) ?? {};
  const fallback = fallbackDetails(form);
  const availability = form.availability ?? "downloadable";
  const pdfAsset = pdfAssetByCode.get(normalizeCode(form.code));
  if (availability === "downloadable" && !pdfAsset) {
    throw new Error(`Missing official PDF manifest entry for Form ${form.code}.`);
  }
  const details: FormCatalogDetails = {
    id: `form-${normalizeCode(form.code).replace(/[^a-z0-9]+/g, "-")}`,
    form: form.code,
    name: form.title,
    category: form.category,
    purpose: text(raw.purpose, fallback.purpose),
    maker: text(raw.maker, fallback.maker),
    involved: text(raw.involved, fallback.involved),
    threshold: text(raw.threshold, fallback.threshold),
    clock: text(raw.clock, fallback.clock),
    destination: text(raw.destination, fallback.destination),
    authorises: text(raw.authorises, fallback.authorises),
    doesNotAuthorise: text(raw.doesNotAuthorise, fallback.doesNotAuthorise),
    before: stringArray(raw.before),
    parallel: stringArray(raw.parallel),
    after: stringArray(raw.after),
    copies: text(raw.copies, "Confirm notices, copies, handover and filing requirements on the approved form."),
    documentationStem: text(raw.documentationStem),
    traps: stringArray(raw.traps),
    safetyPearl: text(raw.safetyPearl, fallback.safetyPearl),
    sourceNote: text(raw.sourceNote, fallback.sourceNote),
    aliases: stringArray(raw.aliases),
    searchTerms: stringArray(raw.searchTerms),
    riskLevel: riskLevel(raw.riskLevel),
    indexedClock: text(raw.indexedClock) || undefined,
    indexedTerms: stringArray(raw.indexedTerms),
    legalNote: text(raw.legalNote, fallback.legalNote),
    practicePearls: stringArray(raw.practicePearls).length
      ? stringArray(raw.practicePearls)
      : (fallback.practicePearls ?? []),
    preUseChecks: stringArray(raw.preUseChecks).length ? stringArray(raw.preUseChecks) : (fallback.preUseChecks ?? []),
    sourceFacts:
      raw.sourceFacts && typeof raw.sourceFacts === "object"
        ? (raw.sourceFacts as FormCatalogDetails["sourceFacts"])
        : undefined,
    availability,
    officialPdfUrl: pdfAsset?.officialPdfUrl,
    officialRegisterUrl: officialFormsRegisterUrl,
    localPdfPath: pdfAsset?.localPath,
    localPdfSha256: pdfAsset?.sha256,
    localPdfBytes: pdfAsset?.bytes,
    officialPdfPasswordProtected: pdfAsset?.passwordProtected,
    officialTitleCheckedAt: officialFormsReviewedDate,
    archiveGeneratedAt: archiveGeneratedAt || undefined,
  };
  return details;
}

function riskTone(risk: FormCatalogDetails["riskLevel"]): ServiceChipTone {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "info";
}

function pathwayText(details: FormCatalogDetails) {
  const parts = [
    details.before.length ? `Before: ${details.before.join(", ")}` : "",
    details.parallel.length ? `Parallel: ${details.parallel.join(", ")}` : "",
    details.after.length ? `After: ${details.after.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(" | ") || "Confirm the current approved form pathway and local policy.";
}

function detailRows(details: FormCatalogDetails) {
  const rows = [
    { label: "Purpose", value: details.purpose },
    { label: "Authorises", value: details.authorises },
    { label: "Does not authorise", value: details.doesNotAuthorise },
    { label: "Before", value: details.before.join(", ") },
    { label: "Parallel", value: details.parallel.join(", ") },
    { label: "After", value: details.after.join(", ") },
    { label: "Copies and filing", value: details.copies },
    { label: "Documentation stem", value: details.documentationStem },
    { label: "Safety pearl", value: details.safetyPearl },
    { label: "Common traps", value: details.traps.join(" ") },
    { label: "Pre-use checks", value: details.preUseChecks.join(" ") },
  ];
  return rows.filter((row) => row.value.trim().length > 0);
}

function toFormRecord(details: FormCatalogDetails): ServiceRecord {
  const availabilityLabel =
    details.availability === "downloadable"
      ? "Official PDF"
      : details.availability === "unavailable"
        ? "Currently unavailable"
        : "Contact OCP";
  const availabilityTone: ServiceChipTone = details.availability === "downloadable" ? "success" : "warning";

  return {
    slug: formSlug(details.form),
    title: details.name,
    subtitle: details.purpose,
    statusChips: [
      { label: `${details.riskLevel} risk`, tone: riskTone(details.riskLevel) },
      { label: details.category, tone: "info" },
      { label: availabilityLabel, tone: availabilityTone },
    ],
    primaryContact: {
      label: "Form code",
      value: `Form ${details.form}`,
      detail: availabilityLabel,
      kind: "text",
    },
    contacts: [
      ...(details.officialPdfUrl
        ? [
            {
              label: "Official public PDF",
              value: details.officialPdfUrl,
              detail: "Current OCP source",
              kind: "web" as const,
            },
          ]
        : []),
      {
        label: "Official forms register",
        value: details.officialRegisterUrl,
        detail: "Check current availability",
        kind: "web",
      },
    ],
    route: pathwayText(details),
    eligibility: details.threshold,
    cost: "Official WA Mental Health Act 2014 form",
    referral: details.preUseChecks[0] ?? details.safetyPearl,
    location: "Western Australia",
    summaryCards: [
      { id: "clock", label: "Clock / review", title: details.clock, detail: details.indexedClock },
      { id: "authority", label: "Made by / authority", title: details.maker, detail: details.authorises },
      { id: "criteria", label: "Criteria / threshold", title: details.threshold, detail: details.doesNotAuthorise },
      {
        id: "source",
        label: "Source status",
        title: availabilityLabel,
        detail: `Official register checked ${officialFormsReviewedDate}`,
      },
    ],
    referralInfo: detailRows(details),
    bestUse: details.legalNote,
    criteria: [
      ...details.preUseChecks.slice(0, 3).map((label) => ({ label, tone: "caution" as const })),
      ...details.traps.slice(0, 2).map((label) => ({ label, tone: "reject" as const })),
    ],
    verification: {
      locallyVerified: false,
      confidence: "Medium",
      notes: [
        `Official title and availability checked ${officialFormsReviewedDate}`,
        "Archive guidance remains a prototype reference aid and requires local clinical/legal governance review",
        "Use the current approved PDF or PSOLIS form; do not modify approved form content",
      ],
    },
    tags: [
      ...new Set([
        `Form ${details.form}`,
        details.category,
        "Mental Health Act 2014",
        ...details.aliases,
        ...details.searchTerms,
      ]),
    ],
    catchments: ["Western Australia"],
    catalogueLabel: `Form ${details.form}`,
    navigatorQuery: [
      `Form ${details.form}`,
      details.name,
      details.category,
      details.purpose,
      details.indexedClock,
      ...(details.indexedTerms ?? []),
    ]
      .filter(Boolean)
      .join(" "),
    source: {
      label: "Office of the Chief Psychiatrist WA — approved MHA 2014 forms",
      status: "Source checked",
      url: details.officialPdfUrl ?? details.officialRegisterUrl,
      reviewed: `Official register checked ${officialFormsReviewedDate}`,
      notes: [
        details.availability === "unavailable"
          ? "The official register currently marks this form unavailable"
          : details.availability === "contact_ocp"
            ? "Contact OCP monitoring to obtain or submit this form"
            : "Open the official source to confirm the current approved version before use",
        "PSOLIS is the preferred completion method where available",
      ],
    },
    catalogPayload: details,
  };
}

export function formTitleForCode(code: string) {
  const normalized = normalizeCode(code);
  return officialForms.find((form) => normalizeCode(form.code) === normalized)?.title ?? null;
}

export function loadFormCatalogDetails(): FormCatalogDetails[] {
  return officialForms.map(detailsFor);
}

export function mapFormCatalogToRecords(): ServiceRecord[] {
  return loadFormCatalogDetails().map(toFormRecord);
}
