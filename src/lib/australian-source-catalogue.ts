import type { ClinicalSourceRole, SourceContentMode, SourceCorpusScope, SourceLicencePolicy } from "@/lib/types";

export type { SourceContentMode, SourceLicencePolicy } from "@/lib/types";
export type SourceLifecycle = "active" | "historical" | "retired";
export const sourceLicencePolicies = [
  "review_required",
  "public_index_permitted",
  "metadata_link_only",
  "index_forbidden",
] as const;

export type AustralianSourceDefinition = Readonly<{
  key: string;
  publisherCode: string;
  publisher: string;
  canonicalUrl: string;
  jurisdiction: string;
  corpusScope: Extract<SourceCorpusScope, "australian_public">;
  roles: readonly ClinicalSourceRole[];
  contentMode: SourceContentMode;
  licencePolicy: SourceLicencePolicy;
  lifecycle: SourceLifecycle;
  fallbackRank: number;
}>;

export const australianSourcePolicyVersion = "australian-source-policy-v1" as const;

const indexedSource = (
  definition: Omit<AustralianSourceDefinition, "corpusScope" | "contentMode" | "licencePolicy" | "lifecycle"> &
    Partial<Pick<AustralianSourceDefinition, "licencePolicy" | "lifecycle">>,
): AustralianSourceDefinition => ({
  ...definition,
  corpusScope: "australian_public",
  contentMode: "indexed_content",
  licencePolicy: definition.licencePolicy ?? "review_required",
  lifecycle: definition.lifecycle ?? "active",
});

const linkOnlySource = (
  definition: Omit<AustralianSourceDefinition, "corpusScope" | "contentMode" | "licencePolicy" | "lifecycle">,
): AustralianSourceDefinition => ({
  ...definition,
  corpusScope: "australian_public",
  contentMode: "link_only",
  licencePolicy: "metadata_link_only",
  lifecycle: "active",
});

/**
 * Explicit Australian public-source policy. Publisher roots identify a
 * governed source family; they never grant document-level indexing rights.
 */
export const australianSourceCatalogue = [
  indexedSource({
    key: "wa-health",
    publisherCode: "WAHEALTH",
    publisher: "WA Health",
    canonicalUrl: "https://www.health.wa.gov.au/About-us/Policy-frameworks",
    jurisdiction: "Australia/WA",
    roles: ["service_policy"],
    fallbackRank: 10,
  }),
  indexedSource({
    key: "wa-chief-psychiatrist",
    publisherCode: "OCPWA",
    publisher: "Office of the Chief Psychiatrist WA",
    canonicalUrl: "https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/standards-and-guidelines/",
    jurisdiction: "Australia/WA",
    roles: ["clinical_guideline", "quality_standard"],
    fallbackRank: 11,
  }),
  indexedSource({
    key: "wa-legislation",
    publisherCode: "WALEG",
    publisher: "Western Australian Legislation",
    canonicalUrl: "https://www.legislation.wa.gov.au/",
    jurisdiction: "Australia/WA",
    roles: ["legal"],
    fallbackRank: 12,
  }),
  indexedSource({
    key: "tga",
    publisherCode: "TGA",
    publisher: "Therapeutic Goods Administration",
    canonicalUrl: "https://www.tga.gov.au/",
    jurisdiction: "Australia",
    roles: ["regulatory", "safety_alert"],
    fallbackRank: 20,
  }),
  indexedSource({
    key: "acsqhc",
    publisherCode: "ACSQHC",
    publisher: "Australian Commission on Safety and Quality in Health Care",
    canonicalUrl: "https://www.safetyandquality.gov.au/",
    jurisdiction: "Australia",
    roles: ["quality_standard"],
    fallbackRank: 21,
  }),
  indexedSource({
    key: "australian-health-disability-ageing",
    publisherCode: "AUSDOH",
    publisher: "Australian Government Department of Health and Aged Care",
    canonicalUrl: "https://www.health.gov.au/",
    jurisdiction: "Australia",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 22,
  }),
  indexedSource({
    key: "nhmrc",
    publisherCode: "NHMRC",
    publisher: "National Health and Medical Research Council",
    canonicalUrl: "https://www.nhmrc.gov.au/guidelines",
    jurisdiction: "Australia",
    roles: ["clinical_guideline"],
    fallbackRank: 23,
  }),
  indexedSource({
    key: "ranzcp",
    publisherCode: "RANZCP",
    publisher: "Royal Australian and New Zealand College of Psychiatrists",
    canonicalUrl: "https://www.ranzcp.org/clinical-guidelines-publications",
    jurisdiction: "Australia",
    roles: ["clinical_guideline"],
    fallbackRank: 24,
  }),
  indexedSource({
    key: "racgp",
    publisherCode: "RACGP",
    publisher: "Royal Australian College of General Practitioners",
    canonicalUrl: "https://www.racgp.org.au/clinical-resources/clinical-guidelines",
    jurisdiction: "Australia",
    roles: ["clinical_guideline"],
    fallbackRank: 25,
  }),
  indexedSource({
    key: "pbs",
    publisherCode: "PBS",
    publisher: "Pharmaceutical Benefits Scheme",
    canonicalUrl: "https://www.pbs.gov.au/",
    jurisdiction: "Australia",
    roles: ["subsidy"],
    fallbackRank: 26,
  }),
  indexedSource({
    key: "australian-prescriber",
    publisherCode: "AUSPRES",
    publisher: "Australian Prescriber",
    canonicalUrl: "https://australianprescriber.tg.org.au/",
    jurisdiction: "Australia",
    roles: ["professional_review"],
    fallbackRank: 27,
  }),
  linkOnlySource({
    key: "etg-complete",
    publisherCode: "ETG",
    publisher: "Therapeutic Guidelines Limited",
    canonicalUrl: "https://www.tg.org.au/",
    jurisdiction: "Australia",
    roles: ["reference_link"],
    fallbackRank: 30,
  }),
  linkOnlySource({
    key: "australian-medicines-handbook",
    publisherCode: "AMH",
    publisher: "Australian Medicines Handbook",
    canonicalUrl: "https://shop.amh.net.au/",
    jurisdiction: "Australia",
    roles: ["reference_link"],
    fallbackRank: 31,
  }),
  indexedSource({
    key: "nps-medicinewise",
    publisherCode: "NPS",
    publisher: "NPS MedicineWise",
    canonicalUrl: "https://www.medicinewise.org.au/",
    jurisdiction: "Australia",
    roles: ["professional_review"],
    licencePolicy: "index_forbidden",
    lifecycle: "historical",
    fallbackRank: 200,
  }),
  indexedSource({
    key: "nsw-health",
    publisherCode: "NSWHEALTH",
    publisher: "NSW Health",
    canonicalUrl: "https://www.health.nsw.gov.au/",
    jurisdiction: "Australia/NSW",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 100,
  }),
  indexedSource({
    key: "queensland-health",
    publisherCode: "QLDHEALTH",
    publisher: "Queensland Health",
    canonicalUrl: "https://www.health.qld.gov.au/",
    jurisdiction: "Australia/QLD",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 101,
  }),
  indexedSource({
    key: "sa-health",
    publisherCode: "SAHEALTH",
    publisher: "SA Health",
    canonicalUrl: "https://www.sahealth.sa.gov.au/",
    jurisdiction: "Australia/SA",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 102,
  }),
  indexedSource({
    key: "victoria-health",
    publisherCode: "VICHEALTH",
    publisher: "Victorian Department of Health",
    canonicalUrl: "https://www.health.vic.gov.au/",
    jurisdiction: "Australia/VIC",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 103,
  }),
  indexedSource({
    key: "tasmania-health",
    publisherCode: "TASHEALTH",
    publisher: "Tasmanian Department of Health",
    canonicalUrl: "https://www.health.tas.gov.au/",
    jurisdiction: "Australia/TAS",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 104,
  }),
  indexedSource({
    key: "nt-health",
    publisherCode: "NTHEALTH",
    publisher: "NT Health",
    canonicalUrl: "https://health.nt.gov.au/",
    jurisdiction: "Australia/NT",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 105,
  }),
  indexedSource({
    key: "act-health",
    publisherCode: "ACTHEALTH",
    publisher: "ACT Health",
    canonicalUrl: "https://www.health.act.gov.au/",
    jurisdiction: "Australia/ACT",
    roles: ["service_policy", "clinical_guideline"],
    fallbackRank: 106,
  }),
] as const satisfies readonly AustralianSourceDefinition[];

const australianSourceCatalogueByKey = new Map(
  australianSourceCatalogue.map((source) => [source.key, source] as const),
);

export function australianSourceByKey(key: string): AustralianSourceDefinition | null {
  return australianSourceCatalogueByKey.get(key) ?? null;
}

export function isSourceLicencePolicy(value: unknown): value is SourceLicencePolicy {
  return typeof value === "string" && sourceLicencePolicies.some((policy) => policy === value);
}

export function assertIndexableCatalogueEntry(
  source: AustralianSourceDefinition | null,
): asserts source is AustralianSourceDefinition {
  if (!source) throw new Error("Unknown Australian source catalogue entry.");
  if (source.contentMode === "link_only") {
    throw new Error(`Australian source ${source.key} is link-only and cannot enter a content-bearing index.`);
  }
  if (source.lifecycle !== "active") {
    throw new Error(`Australian source ${source.key} is ${source.lifecycle} and cannot be indexed.`);
  }
  if (source.licencePolicy === "metadata_link_only" || source.licencePolicy === "index_forbidden") {
    throw new Error(`Australian source ${source.key} is forbidden from indexing by licence policy.`);
  }
}

export function isIndexableAustralianSource(key: string, exactDocumentLicence: SourceLicencePolicy): boolean {
  const source = australianSourceByKey(key);
  try {
    assertIndexableCatalogueEntry(source);
  } catch {
    return false;
  }
  return exactDocumentLicence === "public_index_permitted";
}
