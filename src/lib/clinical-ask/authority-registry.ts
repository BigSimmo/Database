import type { ClinicalAskModeId } from "@/lib/clinical-ask/contracts";
import { env } from "@/lib/env";

export type ClinicalAskAuthority = {
  id: string;
  domain: string;
  publisher: string;
  jurisdiction: string;
  allowedModes: readonly ClinicalAskModeId[];
  profileAuthorityIds: readonly string[];
  reviewNote: string;
};

const allModes: readonly ClinicalAskModeId[] = [
  "services",
  "forms",
  "differentials",
  "formulation",
  "dsm",
  "specifiers",
  "therapy-compass",
];

export const clinicalAskAuthorityRegistry: readonly ClinicalAskAuthority[] = [
  {
    id: "wa-health",
    domain: "health.wa.gov.au",
    publisher: "WA Health",
    jurisdiction: "Australia/WA",
    allowedModes: allModes,
    profileAuthorityIds: [
      "official-service-directories",
      "official-form-publishers",
      "clinical-guideline-publishers",
      "therapy-guideline-publishers",
    ],
    reviewNote: "Official WA health authority.",
  },
  {
    id: "wa-chief-psychiatrist",
    domain: "chiefpsychiatrist.wa.gov.au",
    publisher: "Office of the Chief Psychiatrist WA",
    jurisdiction: "Australia/WA",
    allowedModes: ["services", "forms", "differentials", "dsm", "specifiers"],
    profileAuthorityIds: ["official-service-directories", "official-form-publishers", "diagnostic-authorities"],
    reviewNote: "Official WA statutory clinical authority.",
  },
  {
    id: "acsqhc",
    domain: "safetyandquality.gov.au",
    publisher: "Australian Commission on Safety and Quality in Health Care",
    jurisdiction: "Australia",
    allowedModes: ["services", "forms", "differentials", "formulation", "therapy-compass"],
    profileAuthorityIds: ["clinical-guideline-publishers", "therapy-guideline-publishers"],
    reviewNote: "Australian national safety and quality authority.",
  },
  {
    id: "healthdirect",
    domain: "healthdirect.gov.au",
    publisher: "Healthdirect Australia",
    jurisdiction: "Australia",
    allowedModes: ["services", "differentials", "therapy-compass"],
    profileAuthorityIds: ["official-service-directories", "clinical-guideline-publishers"],
    reviewNote: "Australian government-funded health information service.",
  },
  {
    id: "tga",
    domain: "tga.gov.au",
    publisher: "Therapeutic Goods Administration",
    jurisdiction: "Australia",
    allowedModes: ["differentials", "therapy-compass"],
    profileAuthorityIds: ["clinical-guideline-publishers", "therapy-guideline-publishers"],
    reviewNote: "Australian medicines and therapeutic goods regulator.",
  },
  {
    id: "ranzcp",
    domain: "ranzcp.org",
    publisher: "Royal Australian and New Zealand College of Psychiatrists",
    jurisdiction: "Australia/New Zealand",
    allowedModes: ["services", "differentials", "formulation", "dsm", "specifiers", "therapy-compass"],
    profileAuthorityIds: ["clinical-guideline-publishers", "diagnostic-authorities", "therapy-guideline-publishers"],
    reviewNote: "Professional clinical authority; page-level currency remains visible.",
  },
  {
    id: "nice",
    domain: "nice.org.uk",
    publisher: "National Institute for Health and Care Excellence",
    jurisdiction: "United Kingdom",
    allowedModes: ["services", "differentials", "formulation", "dsm", "specifiers", "therapy-compass"],
    profileAuthorityIds: ["clinical-guideline-publishers", "diagnostic-authorities", "therapy-guideline-publishers"],
    reviewNote: "International guideline authority; local applicability requires clinician review.",
  },
  {
    id: "who",
    domain: "who.int",
    publisher: "World Health Organization",
    jurisdiction: "International",
    allowedModes: ["services", "differentials", "formulation", "therapy-compass"],
    profileAuthorityIds: ["clinical-guideline-publishers", "therapy-guideline-publishers"],
    reviewNote: "International public-health authority.",
  },
] as const;

const trackingKeys = /^(?:utm_.+|gclid|fbclid|mc_cid|mc_eid)$/i;

export function authorityDomainsForMode(mode: ClinicalAskModeId): readonly string[] {
  return clinicalAskAuthorityRegistry
    .filter((authority) => authority.allowedModes.includes(mode))
    .map(({ domain }) => domain);
}

export function authorityDomainsForProfile(
  mode: ClinicalAskModeId,
  allowedAuthorityIds: readonly string[],
): readonly string[] {
  const profileAllowed = new Set(allowedAuthorityIds);
  return clinicalAskAuthorityRegistry
    .filter(
      (authority) =>
        authority.allowedModes.includes(mode) &&
        authority.profileAuthorityIds.some((authorityId) => profileAllowed.has(authorityId)),
    )
    .map(({ domain }) => domain);
}

export function authorityForUrl(mode: ClinicalAskModeId, url: URL): ClinicalAskAuthority | null {
  return (
    clinicalAskAuthorityRegistry.find(
      (authority) => authority.domain === url.hostname && authority.allowedModes.includes(mode),
    ) ?? null
  );
}

export function validateAuthorityUrl(mode: ClinicalAskModeId, rawUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":")) return null;
  url.hostname = hostname;
  if (!authorityForUrl(mode, url)) return null;
  let removedTracking = false;
  for (const key of [...url.searchParams.keys()]) {
    if (trackingKeys.test(key)) {
      url.searchParams.delete(key);
      removedTracking = true;
    }
  }
  if (removedTracking && url.pathname === "/" && !url.search) return null;
  return url;
}

export function clinicalAskFeatureDecision(
  mode: ClinicalAskModeId,
  config: { enabled: boolean; externalEnabled: boolean; disabledModes: readonly string[] },
) {
  const modeEnabled = config.enabled && !config.disabledModes.includes(mode);
  return { modeEnabled, externalEnabled: modeEnabled && config.externalEnabled };
}

export function clinicalAskModeEnabled(mode: ClinicalAskModeId) {
  return clinicalAskFeatureDecision(mode, {
    enabled: env.CLINICAL_ASK_ENABLED,
    externalEnabled: env.CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED,
    disabledModes: env.CLINICAL_ASK_DISABLED_MODES,
  }).modeEnabled;
}

export function clinicalAskExternalSearchEnabled(mode: ClinicalAskModeId) {
  return clinicalAskFeatureDecision(mode, {
    enabled: env.CLINICAL_ASK_ENABLED,
    externalEnabled: env.CLINICAL_ASK_EXTERNAL_SEARCH_ENABLED,
    disabledModes: env.CLINICAL_ASK_DISABLED_MODES,
  }).externalEnabled;
}
