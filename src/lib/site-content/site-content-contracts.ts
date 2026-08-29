import type {
  ClinicalSourceRole,
  RagInsufficiencyReason,
  SiteContentDomain,
  SiteContentPartitionState,
  SourceCorpusScope,
} from "@/lib/types";

/** The evaluation-owned corpus value used by every first-party site record. */
export type SiteContentCorpusScope = Extract<SourceCorpusScope, "clinical_kb_site">;

/** Typed site-lane failures which may be recorded on a request snapshot. */
export type SiteContentInsufficiencyReason = Extract<
  RagInsufficiencyReason,
  "site_content_updating" | "site_content_stale" | "site_content_unavailable"
>;

export type SiteContentRecord = {
  version: "site-content-record-v1";
  logicalId: string;
  producerClass: "static_repository" | "dynamic_registry";
  domain: SiteContentDomain;
  route: string;
  title: string;
  body: string;
  sourceRole: ClinicalSourceRole;
  access: "public";
  validationStatus: "unverified" | "locally_reviewed" | "approved";
  sourceStatus: "current" | "review_due" | "outdated" | "unknown";
  publicationVersion: string;
  sourceLineage: Array<{
    sourceId: string;
    sourceHash: string;
    relationship: "derived_from" | "references";
  }>;
  contentHash: string;
};

export type ActiveSiteContentRelease = {
  version: "clinical-kb-site-release-v1";
  releaseId: string;
  registryVersion: string;
  staticManifestDigest: string;
  dynamicStateDigest: string;
  releaseDigest: string;
  state: "active";
  activatedAt: string;
};

export type SiteContentPartitionSnapshot = {
  releaseId: string | null;
  staticManifestDigest: string | null;
  dynamicStateDigest: string | null;
  releaseDigest: string | null;
  changeEpoch: string | null;
  state: SiteContentPartitionState;
};

export type RagContextSnapshot = {
  version: "rag-context-snapshot-v1";
  resolvedAt: string;
  documentIndexGeneration: string;
  sourcePolicyVersion: string;
  rolloutVersion: string;
  siteContentRegistryVersion: string | null;
  publicSiteContent: SiteContentPartitionSnapshot;
};
