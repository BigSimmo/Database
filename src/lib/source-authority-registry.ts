import { normalizeSourceMetadata } from "@/lib/source-metadata";
import type { ClinicalSourceMetadata } from "@/lib/types";

export type AustralianSourceTier = "wa_validated" | "australian_national" | "australian_state" | "supplementary";

export type SourceAuthorityScope = "wa" | "australian_national" | "australian_state" | "international";

export type SourceAuthorityDefinition = {
  key: string;
  codes: readonly string[];
  publisher: string;
  publisherAliases: readonly string[];
  jurisdictions: readonly string[];
  scope: SourceAuthorityScope;
  tier: Exclude<AustralianSourceTier, "supplementary"> | "supplementary";
};

export type SourceAuthorityConflict = "publisher_mismatch" | "jurisdiction_mismatch";

export type SourceAuthorityClassification = {
  tier: AustralianSourceTier;
  authorityTier: SourceAuthorityDefinition["tier"] | null;
  authority: SourceAuthorityDefinition | null;
  matchedBy: "publisher_code" | "publisher_alias" | "none";
  codeKnown: boolean;
  conflict: boolean;
  conflicts: SourceAuthorityConflict[];
  eligibilityReasons: string[];
};

const waJurisdictions = ["Australia/WA", "Australia/Western Australia", "Western Australia", "WA"] as const;
const nationalJurisdictions = [
  "Australia",
  "Australia/National",
  "Australia/Commonwealth",
  "Australian national",
  "Commonwealth of Australia",
] as const;

function authority(
  definition: Omit<SourceAuthorityDefinition, "publisherAliases"> & { publisherAliases?: readonly string[] },
): SourceAuthorityDefinition {
  return {
    ...definition,
    publisherAliases: [definition.publisher, ...(definition.publisherAliases ?? [])],
  };
}

/**
 * Canonical authority registry shared by runtime selection and metadata tooling.
 *
 * Runtime classification is deliberately metadata-only: titles, filenames and
 * document prose are never accepted as authority evidence here.
 */
export const sourceAuthorityRegistry = [
  authority({
    key: "wa-health",
    codes: ["WAHEALTH", "DOHWA"],
    publisher: "WA Health",
    publisherAliases: [
      "WA Department of Health",
      "Western Australian Department of Health",
      "Department of Health Western Australia",
      "Government of Western Australia Department of Health",
    ],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "armadale-kalamunda-group",
    codes: ["AKG"],
    publisher: "Armadale Kalamunda Group",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "camhs-wa",
    codes: ["CAMHS"],
    publisher: "Child and Adolescent Mental Health Service",
    publisherAliases: ["Child and Adolescent Mental Health Services"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "east-metropolitan-health-service",
    codes: ["EMHS"],
    publisher: "East Metropolitan Health Service",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "fiona-stanley-fremantle-hospitals-group",
    codes: ["FSH", "FSFH", "FSFHG"],
    publisher: "Fiona Stanley Fremantle Hospitals Group",
    publisherAliases: ["Fiona Stanley Hospital", "Fiona Stanley Fremantle Hospitals"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "king-edward-memorial-hospital",
    codes: ["KEMH", "KEMHS"],
    publisher: "King Edward Memorial Hospital",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "north-metropolitan-health-service",
    codes: ["NMHS"],
    publisher: "North Metropolitan Health Service",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "peel-health-campus",
    codes: ["PHC"],
    publisher: "Peel Health Campus",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "rockingham-peel-group",
    codes: ["RKPG"],
    publisher: "Rockingham Peel Group",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "royal-perth-bentley-group",
    codes: ["RPBG"],
    publisher: "Royal Perth Bentley Group",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "south-metropolitan-health-service",
    codes: ["SMHS"],
    publisher: "South Metropolitan Health Service",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "wa-country-health-service",
    codes: ["WACHS"],
    publisher: "WA Country Health Service",
    publisherAliases: ["Western Australia Country Health Service"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
  }),
  authority({
    key: "acsqhc",
    codes: ["ACSQHC"],
    publisher: "Australian Commission on Safety and Quality in Health Care",
    publisherAliases: ["Australian Commission on Safety and Quality in Healthcare"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "australian-department-of-health",
    codes: ["AUSDOH", "DOHA"],
    publisher: "Australian Government Department of Health and Aged Care",
    publisherAliases: ["Australian Department of Health and Aged Care", "Australian Government Department of Health"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "nhmrc",
    codes: ["NHMRC"],
    publisher: "National Health and Medical Research Council",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "nps-medicinewise",
    codes: ["NPS"],
    publisher: "NPS MedicineWise",
    publisherAliases: ["National Prescribing Service"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "pbs",
    codes: ["PBS"],
    publisher: "Pharmaceutical Benefits Scheme",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "racgp",
    codes: ["RACGP"],
    publisher: "Royal Australian College of General Practitioners",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "ranzcp",
    codes: ["RANZCP"],
    publisher: "Royal Australian and New Zealand College of Psychiatrists",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "tga",
    codes: ["TGA"],
    publisher: "Therapeutic Goods Administration",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  ...[
    ["act-health", "ACTHEALTH", "ACT Health", "Australia/ACT"],
    ["nsw-health", "NSWHEALTH", "NSW Health", "Australia/NSW"],
    ["nt-health", "NTHEALTH", "NT Health", "Australia/NT"],
    ["queensland-health", "QLDHEALTH", "Queensland Health", "Australia/QLD"],
    ["sa-health", "SAHEALTH", "SA Health", "Australia/SA"],
    ["tasmania-health", "TASHEALTH", "Tasmanian Department of Health", "Australia/TAS"],
    ["victoria-health", "VICHEALTH", "Victorian Department of Health", "Australia/VIC"],
  ].map(([key, code, publisher, jurisdiction]) =>
    authority({
      key,
      codes: [code],
      publisher,
      jurisdictions: [jurisdiction],
      scope: "australian_state",
      tier: "australian_state",
    }),
  ),
  authority({
    key: "bmj-best-practice",
    codes: ["BMJ"],
    publisher: "BMJ Best Practice",
    publisherAliases: ["BMJ Publishing Group"],
    jurisdictions: ["International", "Global", "United Kingdom", "UK"],
    scope: "international",
    tier: "supplementary",
  }),
  authority({
    key: "nice",
    codes: ["NICE"],
    publisher: "National Institute for Health and Care Excellence",
    jurisdictions: ["United Kingdom", "UK", "England"],
    scope: "international",
    tier: "supplementary",
  }),
  authority({
    key: "world-health-organization",
    codes: ["WHO"],
    publisher: "World Health Organization",
    jurisdictions: ["International", "Global"],
    scope: "international",
    tier: "supplementary",
  }),
] satisfies SourceAuthorityDefinition[];

export function normalizeSourceAuthorityText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePublisherCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

const authorityByCode = new Map(
  sourceAuthorityRegistry.flatMap((entry) => entry.codes.map((code) => [normalizePublisherCode(code), entry] as const)),
);
const authorityByPublisher = new Map(
  sourceAuthorityRegistry.flatMap((entry) =>
    entry.publisherAliases.map((publisher) => [normalizeSourceAuthorityText(publisher), entry] as const),
  ),
);
const genericWaPublishers = new Set(
  sourceAuthorityRegistry
    .find((entry) => entry.key === "wa-health")!
    .publisherAliases.map((publisher) => normalizeSourceAuthorityText(publisher)),
);

export function sourceAuthorityForPublisherCode(code: string | null | undefined) {
  return authorityByCode.get(normalizePublisherCode(code)) ?? null;
}

export function sourceAuthorityForPublisher(publisher: string | null | undefined) {
  return authorityByPublisher.get(normalizeSourceAuthorityText(publisher)) ?? null;
}

function publisherCompatible(authorityEntry: SourceAuthorityDefinition, publisher: string) {
  const normalizedPublisher = normalizeSourceAuthorityText(publisher);
  if (!normalizedPublisher) return true;
  if (authorityEntry.publisherAliases.some((alias) => normalizeSourceAuthorityText(alias) === normalizedPublisher)) {
    return true;
  }
  return authorityEntry.scope === "wa" && genericWaPublishers.has(normalizedPublisher);
}

function jurisdictionCompatible(authorityEntry: SourceAuthorityDefinition, jurisdiction: string) {
  const normalizedJurisdiction = normalizeSourceAuthorityText(jurisdiction);
  if (!normalizedJurisdiction) return true;
  return authorityEntry.jurisdictions.some(
    (candidate) => normalizeSourceAuthorityText(candidate) === normalizedJurisdiction,
  );
}

function isCurrentUsableDocument(metadata: ClinicalSourceMetadata) {
  return (
    metadata.source_kind !== "registry_record" &&
    metadata.document_status === "current" &&
    metadata.extraction_quality === "good"
  );
}

function isLocallyValidated(metadata: ClinicalSourceMetadata) {
  return (
    metadata.clinical_validation_status === "approved" || metadata.clinical_validation_status === "locally_reviewed"
  );
}

export function classifySourceAuthority(input: unknown): SourceAuthorityClassification {
  const metadata = normalizeSourceMetadata(input);
  const code = normalizePublisherCode(metadata.publisher_code);
  const codeAuthority = sourceAuthorityForPublisherCode(code);
  const publisherAuthority = sourceAuthorityForPublisher(metadata.publisher);
  const authorityEntry = codeAuthority ?? publisherAuthority;
  const matchedBy = codeAuthority ? "publisher_code" : publisherAuthority ? "publisher_alias" : "none";
  const conflicts: SourceAuthorityConflict[] = [];
  const eligibilityReasons: string[] = [];

  if (authorityEntry && metadata.publisher && !publisherCompatible(authorityEntry, metadata.publisher)) {
    conflicts.push("publisher_mismatch");
  }
  if (authorityEntry && metadata.jurisdiction && !jurisdictionCompatible(authorityEntry, metadata.jurisdiction)) {
    conflicts.push("jurisdiction_mismatch");
  }

  if (!authorityEntry) eligibilityReasons.push("unrecognized_authority");
  if (!codeAuthority && publisherAuthority && !metadata.jurisdiction) {
    eligibilityReasons.push("publisher_alias_requires_jurisdiction");
  }
  if (conflicts.length > 0) eligibilityReasons.push("authority_metadata_conflict");
  if (!isCurrentUsableDocument(metadata)) eligibilityReasons.push("source_not_current_usable_document");
  if (authorityEntry?.tier === "wa_validated" && !isLocallyValidated(metadata)) {
    eligibilityReasons.push("wa_source_not_locally_validated");
  }

  const eligible =
    Boolean(authorityEntry) &&
    conflicts.length === 0 &&
    (Boolean(codeAuthority) || Boolean(metadata.jurisdiction)) &&
    isCurrentUsableDocument(metadata) &&
    (authorityEntry?.tier !== "wa_validated" || isLocallyValidated(metadata));

  return {
    tier: eligible ? (authorityEntry?.tier ?? "supplementary") : "supplementary",
    authorityTier: authorityEntry?.tier ?? null,
    authority: authorityEntry ?? null,
    matchedBy,
    codeKnown: Boolean(codeAuthority),
    conflict: conflicts.length > 0,
    conflicts,
    eligibilityReasons,
  };
}
