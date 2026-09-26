import {
  australianSourceByKey,
  australianSourcePolicyVersion,
  type AustralianSourceDefinition,
} from "@/lib/australian-source-catalogue";
import type { ClinicalSourceMetadata } from "@/lib/types";

export type AustralianSourceTier = "wa_validated" | "australian_national" | "australian_state" | "supplementary";
export type SourceDesignation = "official" | "trusted" | "unclassified";
export type SourceOfficialBasis = "wa_hospital" | "wa_health_service_network" | null;

export type SourceAuthorityScope = "wa" | "australian_national" | "australian_state" | "international";
export type SourceAuthorityLifecycle = "active" | "historical";

export type SourceAuthorityDefinition = {
  key: string;
  codes: readonly string[];
  publisher: string;
  publisherAliases: readonly string[];
  jurisdictions: readonly string[];
  scope: SourceAuthorityScope;
  tier: Exclude<AustralianSourceTier, "supplementary"> | "supplementary";
  designation: SourceDesignation;
  officialBasis: SourceOfficialBasis;
  catalogueIdentityOnly: boolean;
  lifecycle: SourceAuthorityLifecycle;
};

export type SourceAuthorityIdentity = SourceAuthorityDefinition;

export type SourceAuthorityConflict = "publisher_mismatch" | "jurisdiction_mismatch";
export type SourceDesignationReasonCode =
  | "recognized_official_wa_hospital"
  | "recognized_official_wa_health_service_network"
  | "recognized_trusted_authority"
  | "registry_summary_identity"
  | "unrecognized_authority"
  | "publisher_alias_requires_jurisdiction"
  | "authority_metadata_conflict";

export type SourceAuthorityClassification = {
  tier: AustralianSourceTier;
  designation: SourceDesignation;
  authorityKey: string | null;
  officialBasis: SourceOfficialBasis;
  reasonCodes: SourceDesignationReasonCode[];
  authorityTier: SourceAuthorityDefinition["tier"] | null;
  authority: SourceAuthorityDefinition | null;
  matchedBy: "source_catalogue_key" | "publisher_code" | "publisher_alias" | "none";
  codeKnown: boolean;
  conflict: boolean;
  conflicts: SourceAuthorityConflict[];
  eligibilityReasons: string[];
  cataloguePolicyResolved: boolean;
  catalogueEntry: AustralianSourceDefinition | null;
  australianAugmentationEligible: boolean;
};

function sourceMetadataRecord(input: unknown): Partial<ClinicalSourceMetadata> {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Partial<ClinicalSourceMetadata>) : {};
}

function sourceMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sourceMetadataStatus<T extends string>(value: unknown, fallback: T): T {
  return typeof value === "string" && value.trim() ? (value as T) : fallback;
}

const waJurisdictions = ["Australia/WA", "Australia/Western Australia", "Western Australia", "WA"] as const;
const nationalJurisdictions = [
  "Australia",
  "Australia/National",
  "Australia/Commonwealth",
  "Australian national",
  "Commonwealth of Australia",
] as const;

function authority(
  definition: Omit<
    SourceAuthorityDefinition,
    "publisherAliases" | "designation" | "officialBasis" | "catalogueIdentityOnly" | "lifecycle"
  > & {
    publisherAliases?: readonly string[];
    designation?: SourceDesignation;
    officialBasis?: SourceOfficialBasis;
    catalogueIdentityOnly?: boolean;
    lifecycle?: SourceAuthorityLifecycle;
  },
): SourceAuthorityDefinition {
  return {
    designation: "trusted",
    officialBasis: null,
    catalogueIdentityOnly: false,
    lifecycle: "active",
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
    key: "wa-chief-psychiatrist",
    codes: ["OCPWA", "OCP WA"],
    publisher: "Office of the Chief Psychiatrist WA",
    publisherAliases: [
      "Office of the Chief Psychiatrist",
      "Chief Psychiatrist of Western Australia",
      "Office of Chief Psychiatrist WA",
    ],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "wa-legislation",
    codes: ["WALEG"],
    publisher: "Western Australian Legislation",
    publisherAliases: ["WA Legislation", "Government of Western Australia Legislation"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "armadale-kalamunda-group",
    codes: ["AKG"],
    publisher: "Armadale Kalamunda Group",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_hospital",
  }),
  authority({
    key: "child-and-adolescent-health-service",
    codes: ["CAHS"],
    publisher: "Child and Adolescent Health Service",
    publisherAliases: ["Perth Children's Hospital", "Princess Margaret Hospital"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_health_service_network",
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
    designation: "official",
    officialBasis: "wa_health_service_network",
  }),
  authority({
    key: "fiona-stanley-fremantle-hospitals-group",
    codes: ["FSH", "FSFH", "FSFHG"],
    publisher: "Fiona Stanley Fremantle Hospitals Group",
    publisherAliases: ["Fiona Stanley Hospital", "Fiona Stanley Fremantle Hospitals"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_hospital",
  }),
  authority({
    key: "healthywa",
    codes: ["HEALTHYWA"],
    publisher: "HealthyWA",
    publisherAliases: ["Healthy WA", "HealthyWA - Western Australian Government health information"],
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
    designation: "official",
    officialBasis: "wa_hospital",
  }),
  authority({
    key: "mental-health-commission-wa",
    codes: ["MHCWA", "MHC WA"],
    publisher: "Mental Health Commission WA",
    publisherAliases: [
      "Mental Health Commission Western Australia",
      "Western Australian Mental Health Commission",
      "Government of Western Australia Mental Health Commission",
    ],
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
    designation: "official",
    officialBasis: "wa_health_service_network",
  }),
  authority({
    key: "peel-health-campus",
    codes: ["PHC"],
    publisher: "Peel Health Campus",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_hospital",
  }),
  authority({
    key: "rockingham-peel-group",
    codes: ["RKPG"],
    publisher: "Rockingham Peel Group",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_hospital",
  }),
  authority({
    key: "royal-perth-bentley-group",
    codes: ["RPBG"],
    publisher: "Royal Perth Bentley Group",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_hospital",
  }),
  authority({
    key: "south-metropolitan-health-service",
    codes: ["SMHS"],
    publisher: "South Metropolitan Health Service",
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_health_service_network",
  }),
  authority({
    key: "wa-country-health-service",
    codes: ["WACHS"],
    publisher: "WA Country Health Service",
    publisherAliases: ["Western Australia Country Health Service"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    designation: "official",
    officialBasis: "wa_health_service_network",
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
    key: "aihw",
    codes: ["AIHW"],
    publisher: "Australian Institute of Health and Welfare",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "australian-prescriber",
    codes: ["AUSPRES", "AUSTPRESC"],
    publisher: "Australian Prescriber",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "australian-department-of-health",
    codes: ["AUSDOH", "DOHA"],
    publisher: "Australian Government Department of Health and Aged Care",
    publisherAliases: [
      "Australian Department of Health and Aged Care",
      "Australian Government Department of Health",
      // The department was renamed again in 2025; the older names stay because
      // documents published under them do not get retitled.
      "Australian Government Department of Health, Disability and Ageing",
      "Department of Health, Disability and Ageing",
    ],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "australian-medicines-handbook",
    codes: ["AMH"],
    publisher: "Australian Medicines Handbook",
    publisherAliases: ["Australian Medicines Handbook Pty Ltd"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
  }),
  authority({
    key: "healthdirect-australia",
    codes: ["HEALTHDIRECT"],
    publisher: "Healthdirect Australia",
    publisherAliases: ["healthdirect"],
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
    lifecycle: "historical",
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
    key: "racp",
    codes: ["RACP"],
    publisher: "Royal Australasian College of Physicians",
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
  authority({
    key: "therapeutic-guidelines",
    codes: ["TG", "ETG"],
    publisher: "Therapeutic Guidelines",
    publisherAliases: ["Therapeutic Guidelines Limited", "Therapeutic Guidelines Ltd", "eTG complete"],
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
  /*
   * Publishers the DSM-5-TR handover supplied, registered for CATALOGUE IDENTITY
   * ONLY.
   *
   * Without an entry the catalogue cannot place a publisher in a jurisdiction,
   * so every source it publishes fails `acquisitionLedgerIssues` and can never
   * leave D band. That is what blocked 20 of the 24 supplied sources.
   *
   * `catalogueIdentityOnly: true` is the safety boundary, not a formality.
   * `sourceAuthorityIsRuntimeClassifiable` filters these out of
   * `registeredCodes`, and `sourceAuthorityForPublisher` /
   * `sourceAuthorityForPublisherCode` return null for them, so nothing here
   * reaches the runtime classification that steers retrieval selection. Removing
   * the flag from any of these entries is a retrieval-behaviour change and needs
   * the evaluation the RAG safeguards require.
   * `tests/dsm5tr-source-registration.test.ts` holds that boundary.
   *
   * None of these is a WA or Australian clinical authority for treatment
   * guidance. The APA and IHACPA are subject authorities for diagnostic
   * classification and Australian admitted-care coding respectively, which is a
   * narrower claim and the only one made here.
   */
  authority({
    key: "american-psychiatric-association",
    codes: ["APA"],
    publisher: "American Psychiatric Association",
    publisherAliases: ["APA Publishing", "American Psychiatric Association Publishing"],
    // One entry per publisher: a second entry under this key used to override
    // this one silently by position (#T9MZ7V). The order below is the one that
    // was winning every lookup, so the first-listed jurisdiction is unchanged.
    jurisdictions: ["International", "Global", "United States", "USA"],
    scope: "international",
    tier: "supplementary",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "samhsa",
    codes: ["SAMHSA"],
    publisher: "Substance Abuse and Mental Health Services Administration",
    jurisdictions: ["United States", "USA", "International", "Global"],
    scope: "international",
    tier: "supplementary",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "ihacpa",
    codes: ["IHACPA", "IHPA"],
    publisher: "Independent Health and Aged Care Pricing Authority",
    publisherAliases: [
      "Independent Hospital Pricing Authority",
      "Independent Health and Aged Care Pricing Authority (IHACPA)",
    ],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "university-of-sydney-addiction-medicine",
    codes: ["USYDADDMED"],
    publisher: "Specialty of Addiction Medicine, Faculty of Medicine and Health, The University of Sydney",
    publisherAliases: ["The University of Sydney", "University of Sydney Specialty of Addiction Medicine"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  /*
   * Whole-of-government WA, which is not WA Health. `wa.gov.au` carries
   * cross-portfolio material such as the mandatory reporting guidance, and
   * folding it into the `wa-health` aliases would let a justice or education page
   * inherit a health authority's designation.
   */
  authority({
    key: "wa-government",
    codes: ["WAGOV"],
    publisher: "Government of Western Australia",
    publisherAliases: ["Western Australian Government", "WA Government"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
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
    key: "cochrane",
    codes: ["COCHRANE"],
    publisher: "Cochrane",
    publisherAliases: ["The Cochrane Collaboration", "Cochrane Library", "Cochrane Database of Systematic Reviews"],
    jurisdictions: ["International", "Global"],
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
  // Publishers cited by the 2026-09 Dictionary handover that the register did not
  // know. Each is `catalogueIdentityOnly`, which is the Chief Psychiatrist's own
  // setting: it lets the catalogue place the publisher in a jurisdiction — without
  // which a source can never leave D band — while leaving runtime retrieval
  // selection exactly as it was. Registering them outright would have changed which
  // sources retrieval picks, which is a separate decision from letting the register
  // name them.
  //
  // Four further publishers were deliberately NOT registered, because the strings
  // are descriptions rather than agencies: "Government of Western Australia",
  // "WA Health service providers", "Mental Health Commission / WA Health" (two
  // publishers in one field) and "4AT developers". Registering a catch-all like
  // "Government of Western Australia" would resolve every WA government document to
  // one authority, which is worse than leaving those four records held until their
  // actual publishing agency is established.
  authority({
    key: "mental-health-tribunal-wa",
    codes: ["MHTWA"],
    publisher: "Mental Health Tribunal Western Australia",
    publisherAliases: ["Mental Health Tribunal WA", "Mental Health Tribunal (WA)"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "health-support-services-wa",
    codes: ["HSSWA"],
    publisher: "Health Support Services",
    publisherAliases: ["Health Support Services, Western Australia", "Health Support Services WA"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "nsw-agency-for-clinical-innovation",
    codes: ["NSWACI"],
    publisher: "NSW Agency for Clinical Innovation",
    publisherAliases: ["Agency for Clinical Innovation"],
    jurisdictions: ["Australia/NSW"],
    scope: "australian_state",
    tier: "australian_state",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "western-sydney-local-health-district",
    codes: ["WSLHD"],
    publisher: "Western Sydney Local Health District",
    jurisdictions: ["Australia/NSW"],
    scope: "australian_state",
    tier: "australian_state",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "royal-childrens-hospital-melbourne",
    codes: ["RCHMELB"],
    publisher: "Royal Children's Hospital Melbourne",
    publisherAliases: ["The Royal Children's Hospital Melbourne"],
    jurisdictions: ["Australia/VIC"],
    scope: "australian_state",
    tier: "australian_state",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "australasian-adhd-professionals-association",
    codes: ["AADPA"],
    publisher: "Australasian ADHD Professionals Association",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "amhocn",
    codes: ["AMHOCN"],
    publisher: "Australian Mental Health Outcomes and Classification Network",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "centre-of-perinatal-excellence",
    codes: ["COPE"],
    publisher: "Centre of Perinatal Excellence",
    // COPE prints the acronym as part of its own name, so a record that copies the
    // masthead verbatim must still resolve to this entry rather than fall through
    // to "publisher not in the register".
    publisherAliases: ["COPE: Centre of Perinatal Excellence", "Centre of Perinatal Excellence (COPE)"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "naccho",
    codes: ["NACCHO"],
    publisher: "National Aboriginal Community Controlled Health Organisation",
    publisherAliases: ["National Aboriginal Community Controlled Health Organization"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "columbia-lighthouse-project",
    codes: ["CSSRS"],
    publisher: "Columbia Lighthouse Project",
    publisherAliases: ["The Columbia Lighthouse Project"],
    jurisdictions: ["International", "Global", "United States"],
    scope: "international",
    tier: "supplementary",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "diva-foundation",
    codes: ["DIVA"],
    publisher: "DIVA Foundation",
    jurisdictions: ["International", "Global"],
    scope: "international",
    tier: "supplementary",
    catalogueIdentityOnly: true,
  }),
  /*
   * Publishers the 2026-09 Therapy and Services handovers named that the register
   * still could not place (ledger #RR3N4H and #YDENFM). Same reasoning, and the
   * same safety setting, as the two blocks above: without an entry
   * `acquisitionLedgerIssues` cannot derive a jurisdiction for the publisher, so
   * every source it publishes is refused by the acquisition gate and can never
   * leave D band — which is what left eight Australian sources held while the 14
   * UK NICE guidelines were admitted, inverting the WA-first order the
   * acquisition protocol requires.
   *
   * Every entry here is `catalogueIdentityOnly: true`. That is the whole safety
   * argument, not a formality: `sourceAuthorityIsRuntimeClassifiable` excludes
   * them from `registeredCodes`, and `sourceAuthorityForPublisher` /
   * `sourceAuthorityForPublisherCode` return null for them, so none of them
   * reaches the runtime classification that steers retrieval selection.
   * Registering one outright would be a retrieval-behaviour change and needs the
   * evaluation the RAG safeguards require.
   * `tests/therapy-services-source-registration.test.ts` holds that boundary.
   *
   * None of these is a WA or Australian clinical authority for treatment guidance
   * by virtue of being named here. Each is registered as the issuer of its own
   * material and nothing wider. The Department of Communities and the City of
   * Vincent are named agencies, not the "Government of Western Australia"
   * catch-all the block above deliberately refused: a catch-all would resolve
   * every WA government document to one authority, whereas these two resolve only
   * their own.
   */
  authority({
    key: "centre-for-clinical-interventions",
    codes: ["CCI"],
    publisher: "Centre for Clinical Interventions",
    publisherAliases: [
      "Centre for Clinical Interventions (CCI)",
      "Centre for Clinical Interventions, North Metropolitan Health Service",
    ],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "phoenix-australia",
    codes: ["PHOENIXAU"],
    publisher: "Phoenix Australia",
    publisherAliases: [
      "Phoenix Australia - Centre for Posttraumatic Mental Health",
      "Phoenix Australia Centre for Posttraumatic Mental Health",
      "Australian Centre for Posttraumatic Mental Health",
    ],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "monash-university",
    codes: ["MONASH"],
    publisher: "Monash University",
    publisherAliases: [
      "Monash University Department of Psychiatry",
      "Monash Centre for Health Research and Implementation",
      "Monash Centre for Health Research and Implementation, Monash University",
    ],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "wa-department-of-communities",
    codes: ["DOCWA"],
    publisher: "Department of Communities (WA)",
    publisherAliases: [
      "Department of Communities",
      "Department of Communities Western Australia",
      "WA Department of Communities",
      "Government of Western Australia Department of Communities",
    ],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "city-of-vincent",
    codes: ["VINCENT"],
    publisher: "City of Vincent",
    publisherAliases: ["The City of Vincent"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  /*
   * Crisis and support lines the 2026-09-25 WA psychiatry build verified in
   * `src/lib/crisis-contacts.ts` and the part-08 service records, registered on the
   * owner's decision of 2026-09-26 (ledger #2TRAJA). Same safety setting as the
   * block above: `catalogueIdentityOnly: true`, so each resolves a jurisdiction
   * for the catalogue and the acquisition gate and never reaches the runtime
   * classification that steers retrieval. Each is the issuer of its own service
   * information and nothing wider. `tests/crisis-line-source-registration.test.ts`
   * holds that boundary.
   */
  authority({
    key: "lifeline-australia",
    codes: ["LIFELINE"],
    publisher: "Lifeline Australia",
    publisherAliases: ["Lifeline"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "suicide-call-back-service",
    codes: ["SCBS"],
    publisher: "Suicide Call Back Service",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "13yarn",
    codes: ["13YARN"],
    publisher: "13YARN",
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "legal-aid-wa",
    codes: ["LEGALAIDWA"],
    publisher: "Legal Aid Western Australia",
    publisherAliases: ["Legal Aid WA"],
    jurisdictions: waJurisdictions,
    scope: "wa",
    tier: "wa_validated",
    catalogueIdentityOnly: true,
  }),
  authority({
    key: "tis-national",
    codes: ["TISNATIONAL"],
    publisher: "TIS National",
    publisherAliases: ["Department of Home Affairs (TIS National)", "Translating and Interpreting Service"],
    jurisdictions: nationalJurisdictions,
    scope: "australian_national",
    tier: "australian_national",
    catalogueIdentityOnly: true,
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

export function sourceAuthorityIsRuntimeClassifiable(authorityEntry: SourceAuthorityDefinition) {
  return !authorityEntry.catalogueIdentityOnly;
}

export function sourceAuthorityIdentityForPublisherCode(code: string | null | undefined) {
  return authorityByCode.get(normalizePublisherCode(code)) ?? null;
}

/** Resolve the catalogue's publisher identity without making it runtime-trusted by code alone. */
export function authorityIdentityForCatalogueEntry(entry: AustralianSourceDefinition): SourceAuthorityIdentity | null {
  const identity = sourceAuthorityIdentityForPublisherCode(entry.publisherCode);
  if (!identity) return null;
  if (normalizeSourceAuthorityText(identity.publisher) !== normalizeSourceAuthorityText(entry.publisher)) return null;
  if (!jurisdictionCompatible(identity, entry.jurisdiction)) return null;
  return identity;
}

export function sourceAuthorityForPublisherCode(code: string | null | undefined) {
  const authorityEntry = sourceAuthorityIdentityForPublisherCode(code);
  return authorityEntry && sourceAuthorityIsRuntimeClassifiable(authorityEntry) ? authorityEntry : null;
}

/**
 * The registry entry for a publisher, including `catalogueIdentityOnly` ones.
 *
 * This is the catalogue-identity lookup: it answers "which authority is this,
 * and what jurisdiction does that place it in". `sourceAuthorityForPublisher`
 * below is the runtime-classification lookup and deliberately returns null for
 * an identity-only entry, which is what keeps such an entry out of retrieval.
 */
export function sourceAuthorityIdentityForPublisher(publisher: string | null | undefined) {
  return authorityByPublisher.get(normalizeSourceAuthorityText(publisher)) ?? null;
}

export function sourceAuthorityForPublisher(publisher: string | null | undefined) {
  const authorityEntry = sourceAuthorityIdentityForPublisher(publisher);
  return authorityEntry && sourceAuthorityIsRuntimeClassifiable(authorityEntry) ? authorityEntry : null;
}

type SourceCatalogueIdentityInput = {
  publisherCode: string | null;
  publisher: string | null;
  jurisdiction: string | null;
};

function compatibleSourceCatalogueIdentity(input: SourceCatalogueIdentityInput) {
  const code = normalizePublisherCode(input.publisherCode);
  const byCode = sourceAuthorityIdentityForPublisherCode(code);
  if (code && !byCode) return null;
  const byPublisher = authorityByPublisher.get(normalizeSourceAuthorityText(input.publisher)) ?? null;
  const identity = byCode ?? byPublisher;
  if (!identity) return null;
  if (input.publisher && !publisherCompatible(identity, input.publisher)) return null;
  if (input.jurisdiction && !jurisdictionCompatible(identity, input.jurisdiction)) return null;
  return identity;
}

/** Descriptive catalogue geography only; this never grants retrieval eligibility or trust. */
export function sourceCatalogueGeographyScope(input: SourceCatalogueIdentityInput) {
  return compatibleSourceCatalogueIdentity(input)?.scope ?? null;
}

/** Registered catalogue designation for source ratings, never runtime admission or ranking. */
export function sourceCatalogueDesignation(input: SourceCatalogueIdentityInput): SourceDesignation {
  const identity = compatibleSourceCatalogueIdentity(input);
  // As at the runtime designation boundary, a publisher alias without a code
  // needs a jurisdiction before it can identify an authority for a rating.
  if (!identity || (!normalizePublisherCode(input.publisherCode) && !input.jurisdiction?.trim())) {
    return "unclassified";
  }
  return identity.designation;
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

type ResolvedAustralianCataloguePolicy = {
  entry: AustralianSourceDefinition;
  identity: SourceAuthorityIdentity;
};

function resolveAustralianCataloguePolicy(metadata: {
  source_kind: string | null;
  source_catalogue_key: string | null;
  publisher_code: string | null;
  publisher: string | null;
  jurisdiction: string | null;
}): ResolvedAustralianCataloguePolicy | null {
  if (metadata.source_kind !== "document") return null;
  if (!metadata.source_catalogue_key || !metadata.publisher_code || !metadata.jurisdiction) return null;
  const entry = australianSourceByKey(metadata.source_catalogue_key);
  if (!entry) return null;
  const identity = authorityIdentityForCatalogueEntry(entry);
  if (!identity) return null;
  const claimedIdentity = sourceAuthorityIdentityForPublisherCode(metadata.publisher_code);
  if (!claimedIdentity || claimedIdentity.key !== identity.key) return null;
  if (!jurisdictionCompatible(identity, metadata.jurisdiction)) return null;
  if (metadata.publisher && !publisherCompatible(identity, metadata.publisher)) return null;
  return { entry, identity };
}

function isCurrentUsableDocument(
  metadata: Pick<ClinicalSourceMetadata, "source_kind" | "document_status" | "extraction_quality">,
) {
  return (
    metadata.source_kind !== "registry_record" &&
    metadata.document_status === "current" &&
    metadata.extraction_quality === "good"
  );
}

function isLocallyValidated(metadata: Pick<ClinicalSourceMetadata, "clinical_validation_status">) {
  return (
    metadata.clinical_validation_status === "approved" || metadata.clinical_validation_status === "locally_reviewed"
  );
}

export function classifySourceAuthority(input: unknown): SourceAuthorityClassification {
  const rawMetadata = sourceMetadataRecord(input);
  const metadata = {
    source_kind: sourceMetadataString(rawMetadata.source_kind),
    publisher: sourceMetadataString(rawMetadata.publisher),
    publisher_code: sourceMetadataString(rawMetadata.publisher_code),
    jurisdiction: sourceMetadataString(rawMetadata.jurisdiction),
    corpus_scope: sourceMetadataString(rawMetadata.corpus_scope),
    source_role: sourceMetadataString(rawMetadata.source_role),
    content_mode: sourceMetadataString(rawMetadata.content_mode),
    source_catalogue_key: sourceMetadataString(rawMetadata.source_catalogue_key),
    source_policy_version: sourceMetadataString(rawMetadata.source_policy_version),
    licence_policy: sourceMetadataString(rawMetadata.licence_policy),
    document_status: sourceMetadataStatus(rawMetadata.document_status, "unknown"),
    clinical_validation_status: sourceMetadataStatus(rawMetadata.clinical_validation_status, "unverified"),
    extraction_quality: sourceMetadataStatus(rawMetadata.extraction_quality, "unknown"),
  };
  const code = normalizePublisherCode(metadata.publisher_code);
  const codeAuthority = sourceAuthorityForPublisherCode(code);
  const publisherAuthority = sourceAuthorityForPublisher(metadata.publisher);
  const cataloguePolicy = resolveAustralianCataloguePolicy(metadata);
  const authorityEntry = cataloguePolicy?.identity ?? codeAuthority ?? publisherAuthority;
  const matchedBy = cataloguePolicy
    ? "source_catalogue_key"
    : codeAuthority
      ? "publisher_code"
      : publisherAuthority
        ? "publisher_alias"
        : "none";
  const conflicts: SourceAuthorityConflict[] = [];
  const eligibilityReasons: string[] = [];

  if (authorityEntry && metadata.publisher && !publisherCompatible(authorityEntry, metadata.publisher)) {
    conflicts.push("publisher_mismatch");
  }
  if (authorityEntry && metadata.jurisdiction && !jurisdictionCompatible(authorityEntry, metadata.jurisdiction)) {
    conflicts.push("jurisdiction_mismatch");
  }

  const reasonCodes: SourceDesignationReasonCode[] = [];

  if (metadata.source_kind === "registry_record") reasonCodes.push("registry_summary_identity");
  if (!authorityEntry) {
    eligibilityReasons.push("unrecognized_authority");
    reasonCodes.push("unrecognized_authority");
  }
  if (!codeAuthority && publisherAuthority && !metadata.jurisdiction) {
    eligibilityReasons.push("publisher_alias_requires_jurisdiction");
    reasonCodes.push("publisher_alias_requires_jurisdiction");
  }
  if (conflicts.length > 0) {
    eligibilityReasons.push("authority_metadata_conflict");
    reasonCodes.push("authority_metadata_conflict");
  }
  if (!isCurrentUsableDocument(metadata)) eligibilityReasons.push("source_not_current_usable_document");
  if (authorityEntry && authorityEntry.lifecycle !== "active") eligibilityReasons.push("catalogue_inactive");
  if (authorityEntry?.tier === "wa_validated" && !isLocallyValidated(metadata)) {
    eligibilityReasons.push("wa_source_not_locally_validated");
  }

  if (cataloguePolicy) {
    if (cataloguePolicy.entry.lifecycle !== "active") eligibilityReasons.push("catalogue_inactive");
    if (metadata.corpus_scope !== cataloguePolicy.entry.corpusScope) {
      eligibilityReasons.push("catalogue_corpus_scope_mismatch");
    }
    if (!metadata.source_role || !cataloguePolicy.entry.roles.some((role) => role === metadata.source_role)) {
      eligibilityReasons.push("catalogue_source_role_mismatch");
    }
    if (metadata.content_mode !== cataloguePolicy.entry.contentMode) {
      eligibilityReasons.push("catalogue_content_mode_mismatch");
    }
    if (metadata.source_policy_version !== australianSourcePolicyVersion) {
      eligibilityReasons.push("catalogue_policy_version_mismatch");
    }
    if (
      cataloguePolicy.entry.contentMode !== "indexed_content" ||
      cataloguePolicy.entry.licencePolicy === "index_forbidden" ||
      metadata.licence_policy !== "public_index_permitted"
    ) {
      eligibilityReasons.push("catalogue_licence_ineligible");
    }
  }

  const cataloguePolicyEligible =
    Boolean(cataloguePolicy) &&
    cataloguePolicy?.entry.lifecycle === "active" &&
    cataloguePolicy?.entry.contentMode === "indexed_content" &&
    cataloguePolicy?.entry.licencePolicy !== "index_forbidden" &&
    metadata.corpus_scope === cataloguePolicy?.entry.corpusScope &&
    Boolean(metadata.source_role && cataloguePolicy?.entry.roles.some((role) => role === metadata.source_role)) &&
    metadata.content_mode === cataloguePolicy?.entry.contentMode &&
    metadata.source_policy_version === australianSourcePolicyVersion &&
    metadata.licence_policy === "public_index_permitted";

  const eligible =
    Boolean(authorityEntry) &&
    authorityEntry?.lifecycle === "active" &&
    conflicts.length === 0 &&
    (Boolean(cataloguePolicy) || Boolean(codeAuthority) || Boolean(metadata.jurisdiction)) &&
    isCurrentUsableDocument(metadata) &&
    (authorityEntry?.tier !== "wa_validated" || isLocallyValidated(metadata)) &&
    (!cataloguePolicy || cataloguePolicyEligible);

  const australianAugmentationEligible =
    eligible &&
    cataloguePolicyEligible &&
    cataloguePolicy?.identity.scope !== "international" &&
    metadata.source_kind === "document";

  const designationRecognized =
    Boolean(authorityEntry) &&
    metadata.source_kind !== "registry_record" &&
    conflicts.length === 0 &&
    (Boolean(cataloguePolicy) || Boolean(codeAuthority) || Boolean(metadata.jurisdiction));
  const designation = designationRecognized ? (authorityEntry?.designation ?? "trusted") : "unclassified";
  if (designation === "official" && authorityEntry?.officialBasis === "wa_hospital") {
    reasonCodes.push("recognized_official_wa_hospital");
  } else if (designation === "official" && authorityEntry?.officialBasis === "wa_health_service_network") {
    reasonCodes.push("recognized_official_wa_health_service_network");
  } else if (designation === "trusted") {
    reasonCodes.push("recognized_trusted_authority");
  }

  return {
    tier: eligible ? (authorityEntry?.tier ?? "supplementary") : "supplementary",
    designation,
    authorityKey: designationRecognized ? (authorityEntry?.key ?? null) : null,
    officialBasis: designationRecognized ? (authorityEntry?.officialBasis ?? null) : null,
    reasonCodes: [...new Set(reasonCodes)],
    authorityTier: authorityEntry?.tier ?? null,
    authority: authorityEntry ?? null,
    matchedBy,
    codeKnown: Boolean(cataloguePolicy || codeAuthority),
    conflict: conflicts.length > 0,
    conflicts,
    eligibilityReasons: [...new Set(eligibilityReasons)],
    cataloguePolicyResolved: Boolean(cataloguePolicy),
    catalogueEntry: cataloguePolicy?.entry ?? null,
    australianAugmentationEligible,
  };
}
