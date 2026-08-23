import type { AppModeId } from "@/lib/app-modes";
import type {
  ActiveSiteContentRelease,
  SiteContentCorpusScope,
  SiteContentRecord,
} from "@/lib/site-content/site-content-contracts";
import type { ClinicalSourceRole, SiteContentDomain, SourceCorpusScope } from "@/lib/types";

export const SITE_CONTENT_REGISTRY_VERSION = "site-content-registry-v1" as const;

export type SiteContentProducerDefinition = {
  version: "site-content-producer-v1";
  modeId: Exclude<AppModeId, "answer" | "documents" | "favourites">;
  corpusScope: SiteContentCorpusScope;
  domain: SiteContentDomain;
  producerClass: SiteContentRecord["producerClass"];
  canonicalOwner: string;
  dataSource: string;
  publicationVersionField: string;
  adapter: string;
  allowedRoles: readonly ClinicalSourceRole[];
  readPolicy: "public_active_release";
  mutationPolicy: "administrator_only" | "repository_release_only";
  routeBuilder: (slug: string, subkind?: string | null) => string;
  reviewOwner: "clinical_content_governance";
  activationState: "active";
};

const publicRoute = (base: string) => (slug: string) => `${base}/${encodeURIComponent(slug)}`;

const producer = (
  definition: Omit<
    SiteContentProducerDefinition,
    "version" | "corpusScope" | "readPolicy" | "reviewOwner" | "activationState"
  >,
): SiteContentProducerDefinition => ({
  version: "site-content-producer-v1",
  corpusScope: "clinical_kb_site",
  readPolicy: "public_active_release",
  reviewOwner: "clinical_content_governance",
  activationState: "active",
  ...definition,
});

/**
 * Explicit public knowledge producers. These are exact modules/tables and
 * adapters rather than filesystem patterns: adding a page or dataset alone
 * never makes it eligible for retrieval.
 */
export const siteContentProducerRegistry = [
  producer({
    modeId: "services",
    domain: "services",
    producerClass: "dynamic_registry",
    canonicalOwner: "src/lib/registry-records.ts",
    dataSource: "clinical_registry_records:service",
    publicationVersionField: "publication_version",
    adapter: "site-content/adapters/registry:services",
    allowedRoles: ["service_directory"],
    mutationPolicy: "administrator_only",
    routeBuilder: publicRoute("/services"),
  }),
  producer({
    modeId: "forms",
    domain: "forms",
    producerClass: "dynamic_registry",
    canonicalOwner: "src/lib/registry-records.ts",
    dataSource: "clinical_registry_records:form",
    publicationVersionField: "publication_version",
    adapter: "site-content/adapters/registry:forms",
    allowedRoles: ["form_reference"],
    mutationPolicy: "administrator_only",
    routeBuilder: publicRoute("/forms"),
  }),
  producer({
    modeId: "differentials",
    domain: "differentials",
    producerClass: "dynamic_registry",
    canonicalOwner: "src/lib/differential-records.ts",
    dataSource: "differential_records",
    publicationVersionField: "publication_version",
    adapter: "site-content/adapters/registry:differentials",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "administrator_only",
    routeBuilder: (slug, subkind) =>
      `/differentials/${subkind === "presentation" ? "presentations" : "diagnoses"}/${encodeURIComponent(slug)}`,
  }),
  producer({
    modeId: "dsm",
    domain: "dsm",
    producerClass: "static_repository",
    canonicalOwner: "src/lib/dsm.ts",
    dataSource: "dsmDiagnoses",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/index:dsm",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: publicRoute("/dsm/diagnoses"),
  }),
  producer({
    modeId: "specifiers",
    domain: "specifiers",
    producerClass: "static_repository",
    canonicalOwner: "src/lib/specifiers.ts",
    dataSource: "specifierRecords",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/specifiers",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: publicRoute("/specifiers"),
  }),
  producer({
    modeId: "formulation",
    domain: "formulation",
    producerClass: "static_repository",
    canonicalOwner: "src/lib/formulation.ts",
    dataSource: "formulationMechanisms",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/index:formulation",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: publicRoute("/formulation"),
  }),
  producer({
    modeId: "prescribing",
    domain: "medications",
    producerClass: "dynamic_registry",
    canonicalOwner: "src/lib/medication-records.ts",
    dataSource: "medication_records",
    publicationVersionField: "publication_version",
    adapter: "site-content/adapters/registry:medications",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "administrator_only",
    routeBuilder: publicRoute("/medications"),
  }),
  producer({
    modeId: "tools",
    domain: "tools",
    producerClass: "static_repository",
    canonicalOwner: "src/lib/tools-catalog.ts",
    dataSource: "toolCatalogRecords",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/index:tools",
    allowedRoles: ["tool_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: publicRoute("/tools"),
  }),
  producer({
    modeId: "calculators",
    domain: "calculators",
    producerClass: "static_repository",
    canonicalOwner: "src/components/calculators/calculator-fixtures.ts",
    dataSource: "calculators",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/index:calculators",
    allowedRoles: ["tool_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: (slug) => `/calculators/search?q=${encodeURIComponent(slug)}`,
  }),
  producer({
    modeId: "therapy-compass",
    domain: "therapies",
    producerClass: "static_repository",
    canonicalOwner: "src/lib/therapies.ts",
    dataSource: "therapyRecords",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/index:therapies",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: publicRoute("/therapy-compass"),
  }),
  producer({
    modeId: "factsheets",
    domain: "factsheets",
    producerClass: "static_repository",
    canonicalOwner: "src/components/factsheets/factsheets-data.ts",
    dataSource: "factsheets",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/index:factsheets",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: publicRoute("/factsheets"),
  }),
  producer({
    modeId: "dictionary",
    domain: "dictionary",
    producerClass: "static_repository",
    canonicalOwner: "src/lib/dictionary-data.ts",
    dataSource: "dictionaryEntries",
    publicationVersionField: "contentHash",
    adapter: "site-content/adapters/index:dictionary",
    allowedRoles: ["clinical_reference"],
    mutationPolicy: "repository_release_only",
    routeBuilder: publicRoute("/dictionary"),
  }),
] as const satisfies readonly SiteContentProducerDefinition[];

export type SiteContentModeExclusionReason =
  | "corpus_consumer"
  | "managed_uploaded_local"
  | "private_user_state"
  | "operational_chrome"
  | "unsafe_content"
  | "non_knowledge_content"
  | "outside_public_knowledge_corpus";

export type SiteContentModeExclusion = {
  modeId: string;
  reason: SiteContentModeExclusionReason;
  permanent: true;
  reviewed: true;
  reviewOwner: "clinical_content_governance";
};

export const siteContentModeExclusions = [
  {
    modeId: "answer",
    reason: "corpus_consumer",
    permanent: true,
    reviewed: true,
    reviewOwner: "clinical_content_governance",
  },
  {
    modeId: "documents",
    reason: "managed_uploaded_local",
    permanent: true,
    reviewed: true,
    reviewOwner: "clinical_content_governance",
  },
  {
    modeId: "favourites",
    reason: "private_user_state",
    permanent: true,
    reviewed: true,
    reviewOwner: "clinical_content_governance",
  },
] as const satisfies readonly SiteContentModeExclusion[];

const producerByMode = new Map(siteContentProducerRegistry.map((entry) => [entry.modeId, entry] as const));
const excludedModeIds: ReadonlySet<string> = new Set(siteContentModeExclusions.map((entry) => entry.modeId));

export function siteContentProducerForMode(modeId: string): SiteContentProducerDefinition | null {
  return producerByMode.get(modeId as SiteContentProducerDefinition["modeId"]) ?? null;
}

export type SiteContentModeCoverageDecision =
  | { modeId: string; status: "pending_review" }
  | {
      modeId: string;
      status: "permanently_excluded";
      reason: SiteContentModeExclusionReason;
      reviewed: true;
    };

export function siteContentModeCoverage(
  modeIds: readonly string[],
  decisions: readonly SiteContentModeCoverageDecision[] = [],
) {
  const decisionByMode = new Map(decisions.map((decision) => [decision.modeId, decision] as const));
  const missing: string[] = [];
  const pendingReview: string[] = [];

  for (const modeId of modeIds) {
    if (producerByMode.has(modeId as SiteContentProducerDefinition["modeId"]) || excludedModeIds.has(modeId)) continue;
    const decision = decisionByMode.get(modeId);
    if (decision?.status === "permanently_excluded" && decision.reviewed) continue;
    if (decision?.status === "pending_review") pendingReview.push(modeId);
    else missing.push(modeId);
  }

  return { complete: missing.length === 0 && pendingReview.length === 0, missing, pendingReview };
}

export function resolveSiteContentReadTarget(
  _reader: "anonymous" | "authenticated",
  release: ActiveSiteContentRelease,
) {
  return {
    audience: "public" as const,
    corpusScope: "clinical_kb_site" as const satisfies SiteContentCorpusScope,
    readPolicy: "public_active_release" as const,
    releaseId: release.releaseId,
    releaseDigest: release.releaseDigest,
  };
}

export type SiteContentMutationOperation = "create" | "edit" | "publish" | "retire";

export function canMutateSiteContent(
  producerDefinition: SiteContentProducerDefinition,
  _operation: SiteContentMutationOperation,
  actor: { isAdministrator: boolean },
) {
  return producerDefinition.producerClass === "dynamic_registry" &&
    producerDefinition.mutationPolicy === "administrator_only"
    ? actor.isAdministrator
    : false;
}

export type SiteContentRegistrationCandidate = {
  modeId: string;
  access: "public" | "private";
  publicationState: "published" | "draft" | "preview";
  renderedByPublicSite: boolean;
  contentClass:
    | "public_knowledge"
    | "application_code"
    | "test_fixture"
    | "prompt"
    | "developer_documentation"
    | "mockup"
    | "synthetic_ward_data"
    | "private_user_state";
  authoritySource: "clinical_kb" | "etg_link" | "amh_link" | "healthdirect";
};

export type SiteContentRegistrationDecision =
  | { eligible: true; corpusScope: SiteContentCorpusScope; producer: SiteContentProducerDefinition }
  | {
      eligible: false;
      reason:
        | "mode_excluded"
        | "unregistered_mode"
        | "not_public"
        | "not_published"
        | "not_publicly_rendered_version"
        | "forbidden_content_class"
        | "forbidden_authority_source";
    };

export function evaluateSiteContentRegistration(
  candidate: SiteContentRegistrationCandidate,
): SiteContentRegistrationDecision {
  if (excludedModeIds.has(candidate.modeId)) return { eligible: false, reason: "mode_excluded" };
  const registeredProducer = siteContentProducerForMode(candidate.modeId);
  if (!registeredProducer) return { eligible: false, reason: "unregistered_mode" };
  if (candidate.access !== "public") return { eligible: false, reason: "not_public" };
  if (candidate.publicationState !== "published") return { eligible: false, reason: "not_published" };
  if (!candidate.renderedByPublicSite) return { eligible: false, reason: "not_publicly_rendered_version" };
  if (candidate.contentClass !== "public_knowledge") return { eligible: false, reason: "forbidden_content_class" };
  if (candidate.authoritySource !== "clinical_kb") {
    return { eligible: false, reason: "forbidden_authority_source" };
  }
  return { eligible: true, corpusScope: "clinical_kb_site", producer: registeredProducer };
}

export type SiteContentClaimKind = "product_catalogue" | "patient_diagnosis" | "clinical_guidance";

export function siteContentClaimPolicy(args: {
  claimKind: SiteContentClaimKind;
  siteSourceRole: ClinicalSourceRole;
  directlyRelevantUploadedGuideline: boolean;
}) {
  if (args.claimKind === "product_catalogue") {
    return {
      primaryCorpus: "clinical_kb_site" as const satisfies SourceCorpusScope,
      siteUse: "primary_product_evidence" as const,
      requiresEligibleClinicalEvidence: false,
    };
  }

  if (args.directlyRelevantUploadedGuideline) {
    return {
      primaryCorpus: "uploaded_local" as const satisfies SourceCorpusScope,
      siteUse:
        args.siteSourceRole === "clinical_reference"
          ? ("attributed_navigation_context" as const)
          : ("ineligible_for_clinical_claim" as const),
      requiresEligibleClinicalEvidence: false,
    };
  }

  return {
    primaryCorpus: null,
    siteUse: "ineligible_for_clinical_claim" as const,
    requiresEligibleClinicalEvidence: true,
  };
}

export type EvidenceFamilySource = {
  sourceId: string;
  sourceHash: string;
  sourceLineage: SiteContentRecord["sourceLineage"];
};

export function evidenceFamilyKey(source: EvidenceFamilySource) {
  const parents = source.sourceLineage
    .filter((lineage) => lineage.relationship === "derived_from")
    .map((lineage) => `${lineage.sourceId}:${lineage.sourceHash}`)
    .sort();
  return parents.length > 0
    ? `source-family:${parents.join("|")}`
    : `source-family:${source.sourceId}:${source.sourceHash}`;
}

export type LegacySiteContentPublicationCandidate = {
  recordId: string;
  logicalId: string;
  publicationState: "published" | "draft" | "preview";
  renderedByPublicSite: boolean;
  explicitlyReconciled: boolean;
};

/**
 * A legacy owner-keyed row is not public merely because it exists. Adoption is
 * deterministic only when exactly one same-entity row is explicitly reviewed
 * as the canonical publication rendered by the public site.
 */
export function reconcileCanonicalPublicSiteContent<T extends LegacySiteContentPublicationCandidate>(
  candidates: readonly T[],
): T | null {
  if (new Set(candidates.map((candidate) => candidate.logicalId)).size !== 1) return null;
  const eligible = candidates.filter(
    (candidate) =>
      candidate.publicationState === "published" && candidate.renderedByPublicSite && candidate.explicitlyReconciled,
  );
  return eligible.length === 1 ? eligible[0]! : null;
}
