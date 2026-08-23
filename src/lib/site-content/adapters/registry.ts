import { registryCorpusDetailHref } from "@/lib/registry-corpus-links";
import {
  registryCorpusChunkId,
  registryCorpusDocumentId,
  registryCorpusMetadata,
  type RegistryCorpusEntry,
} from "@/lib/registry-corpus";
import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";
import {
  reconcileCanonicalPublicSiteContent,
  siteContentProducerForMode,
} from "@/lib/site-content/site-content-registry";
import {
  canonicalSiteContentText,
  createSiteContentRecord,
  siteContentValueHash,
} from "@/lib/site-content/site-content-manifest";
import type { Json } from "@/lib/supabase/database.types";
import type { ClinicalSourceRole, SiteContentDomain } from "@/lib/types";

const domainByKind: Record<RegistryCorpusEntry["kind"], SiteContentDomain> = {
  service: "services",
  form: "forms",
  medication: "medications",
  differential: "differentials",
};

const modeByKind = {
  service: "services",
  form: "forms",
  medication: "prescribing",
  differential: "differentials",
} as const;

const roleByKind: Record<RegistryCorpusEntry["kind"], ClinicalSourceRole> = {
  service: "service_directory",
  form: "form_reference",
  medication: "clinical_reference",
  differential: "clinical_reference",
};

function validationStatus(value: string): SiteContentRecord["validationStatus"] {
  return value === "approved" || value === "locally_reviewed" ? value : "unverified";
}

function sourceStatus(value: string): SiteContentRecord["sourceStatus"] {
  return value === "current" || value === "review_due" || value === "outdated" ? value : "unknown";
}

function detailTarget(entry: RegistryCorpusEntry) {
  return {
    kind: entry.kind,
    slug: entry.slug,
    subkind: entry.subkind,
    recordId: entry.recordId,
  };
}

export type RegistrySiteContentIdentity = {
  logicalId: string;
  publicRecordId: string;
  rowOwnerId: null;
  publicationState: "published";
  renderedByPublicSite: true;
  explicitlyReconciled: true;
  sourceLineage?: SiteContentRecord["sourceLineage"];
};

export type CanonicalRegistrySiteContentProjection = {
  record: SiteContentRecord;
  documentId: string;
  chunkId: string;
  metadata: Record<string, Json>;
};

/**
 * Adds public-release metadata without changing the existing registry text or
 * deterministic document/chunk identities. Generic owner rows never call this
 * projection and therefore remain outside `clinical_kb_site`.
 */
export function canonicalRegistrySiteContentProjection(
  entry: RegistryCorpusEntry,
  identity: RegistrySiteContentIdentity,
): CanonicalRegistrySiteContentProjection {
  if (
    identity.rowOwnerId !== null ||
    identity.publicationState !== "published" ||
    !identity.renderedByPublicSite ||
    !identity.explicitlyReconciled
  ) {
    throw new Error("Registry site-content classification requires an ownerless reconciled public projection.");
  }
  const domain = domainByKind[entry.kind];
  const producer = siteContentProducerForMode(modeByKind[entry.kind]);
  if (!producer || producer.producerClass !== "dynamic_registry" || producer.domain !== domain) {
    throw new Error(`Missing dynamic site-content producer for ${entry.kind}.`);
  }
  const route = registryCorpusDetailHref(detailTarget(entry));
  if (!route) throw new Error(`Registry entry ${entry.recordId} has no canonical public route.`);
  const record = createSiteContentRecord({
    version: "site-content-record-v1",
    logicalId: identity.logicalId,
    producerClass: "dynamic_registry",
    domain,
    route,
    title: entry.title,
    body: entry.content,
    sourceRole: roleByKind[entry.kind],
    access: "public",
    validationStatus: validationStatus(entry.validationStatus),
    sourceStatus: sourceStatus(entry.sourceStatus),
    publicationVersion: identity.publicRecordId,
    sourceLineage: identity.sourceLineage ?? [],
  });
  const documentId = registryCorpusDocumentId(entry.kind, entry.recordId);
  const chunkId = registryCorpusChunkId(entry.kind, entry.recordId);
  return {
    record,
    documentId,
    chunkId,
    metadata: {
      ...registryCorpusMetadata(entry),
      corpus_scope: "clinical_kb_site",
      site_content_domain: domain,
      site_content_route: route,
      site_content_logical_id: identity.logicalId,
      site_content_public_release_identity: identity.publicRecordId,
      site_content_lineage_digest: siteContentValueHash(record.sourceLineage),
      site_content_document_id: documentId,
      site_content_chunk_id: chunkId,
    },
  };
}

export function registryEntryToSiteContentRecord(
  entry: RegistryCorpusEntry,
  identity: RegistrySiteContentIdentity,
): SiteContentRecord {
  return canonicalRegistrySiteContentProjection(entry, identity).record;
}

export type RegistryReconciliationCandidate = {
  entry: RegistryCorpusEntry;
  logicalId: string;
  publicRecordId?: string;
  rowOwnerId: string | null;
  publicationState?: "published" | "draft" | "preview";
  renderedByPublicSite?: boolean;
  explicitlyReconciled?: boolean;
  sourceLineage?: SiteContentRecord["sourceLineage"];
};

export type RegistryReconciliationDisposition =
  "adoptable" | "identical_duplicates" | "divergent_requires_administrator_review";

export type RegistryReconciliationReport = {
  version: "clinical-kb-site-registry-reconciliation-v1";
  groups: Array<{
    logicalId: string;
    candidateCount: number;
    normalizedContentHashes: string[];
    renderedPublicContentHash: string | null;
    disposition: RegistryReconciliationDisposition;
  }>;
  adoptableCount: number;
  identicalDuplicateCount: number;
  administratorReviewCount: number;
};

function reconciliationContentHash(candidate: RegistryReconciliationCandidate) {
  return siteContentValueHash({
    title: canonicalSiteContentText(candidate.entry.title),
    content: canonicalSiteContentText(candidate.entry.content),
    searchText: canonicalSiteContentText(candidate.entry.searchText),
  });
}

function canonicalCandidate(candidates: readonly RegistryReconciliationCandidate[]) {
  return reconcileCanonicalPublicSiteContent(
    candidates.map((candidate) => ({
      ...candidate,
      recordId: candidate.publicRecordId ?? candidate.entry.recordId,
      publicationState: candidate.publicationState ?? "draft",
      renderedByPublicSite: candidate.renderedByPublicSite ?? false,
      explicitlyReconciled: candidate.explicitlyReconciled ?? false,
    })),
  );
}

export function buildRegistryReconciliationReport(
  candidates: readonly RegistryReconciliationCandidate[],
): RegistryReconciliationReport {
  const byLogicalId = new Map<string, RegistryReconciliationCandidate[]>();
  for (const candidate of candidates) {
    const group = byLogicalId.get(candidate.logicalId) ?? [];
    group.push(candidate);
    byLogicalId.set(candidate.logicalId, group);
  }
  const groups = [...byLogicalId.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([logicalId, group]) => {
      const normalizedContentHashes = [...new Set(group.map(reconciliationContentHash))].sort();
      const canonical = canonicalCandidate(group);
      const disposition: RegistryReconciliationDisposition =
        normalizedContentHashes.length > 1
          ? "divergent_requires_administrator_review"
          : canonical
            ? "adoptable"
            : group.length > 1
              ? "identical_duplicates"
              : "divergent_requires_administrator_review";
      const renderedPublicContentHash = canonical
        ? reconciliationContentHash(
            group.find((candidate) => (candidate.publicRecordId ?? candidate.entry.recordId) === canonical.recordId)!,
          )
        : null;
      return {
        logicalId,
        candidateCount: group.length,
        normalizedContentHashes,
        renderedPublicContentHash,
        disposition,
      };
    });
  return {
    version: "clinical-kb-site-registry-reconciliation-v1",
    groups,
    adoptableCount: groups.filter((group) => group.disposition === "adoptable").length,
    identicalDuplicateCount: groups.filter((group) => group.disposition === "identical_duplicates").length,
    administratorReviewCount: groups.filter((group) => group.disposition === "divergent_requires_administrator_review")
      .length,
  };
}

export function adoptCanonicalRegistryProjection(
  candidates: readonly RegistryReconciliationCandidate[],
): SiteContentRecord {
  if (candidates.length === 0) throw new Error("Registry adoption requires at least one candidate.");
  const report = buildRegistryReconciliationReport(candidates);
  if (report.groups.length !== 1 || report.groups[0]?.disposition !== "adoptable") {
    throw new Error("Registry adoption is divergent or requires administrator review.");
  }
  const adopted = canonicalCandidate(candidates);
  if (!adopted) throw new Error("Registry adoption has no unique reconciled canonical public projection.");
  const candidate = candidates.find((entry) => (entry.publicRecordId ?? entry.entry.recordId) === adopted.recordId);
  if (!candidate) throw new Error("Registry reconciliation selected an unknown candidate.");
  return registryEntryToSiteContentRecord(candidate.entry, {
    logicalId: candidate.logicalId,
    publicRecordId: candidate.publicRecordId ?? candidate.entry.recordId,
    rowOwnerId: null,
    publicationState: "published",
    renderedByPublicSite: true,
    explicitlyReconciled: true,
    sourceLineage: candidate.sourceLineage,
  });
}

export type RegistryEmbeddingFingerprint = {
  normalizedText: string;
  model: string;
  dimensions: number;
};

/** Metadata-only adoption can reuse a verified embedding only on exact identity. */
export function canCarryForwardRegistryEmbedding(
  existing: RegistryEmbeddingFingerprint,
  candidate: RegistryEmbeddingFingerprint,
) {
  return (
    canonicalSiteContentText(existing.normalizedText) === canonicalSiteContentText(candidate.normalizedText) &&
    existing.model === candidate.model &&
    existing.dimensions === candidate.dimensions
  );
}
