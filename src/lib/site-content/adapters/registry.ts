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
  compareCanonicalSiteContentIdentifiers,
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

/**
 * Bounded evidence acquired from the separately trusted canonical public
 * projection. Adoption validates this snapshot but never derives it from the
 * persisted candidate whose publication claim is under review.
 */
export type CanonicalPublicRegistrySnapshot = {
  version: "clinical-kb-site-canonical-public-snapshot-v1";
  publicRecordId: string;
  logicalId: string;
  route: string;
  contentHash: string;
  governanceHash: string;
  publicationVersion: string;
};

export type CanonicalRegistrySiteContentProjection = {
  record: SiteContentRecord;
  documentId: string;
  chunkId: string;
  metadata: Record<string, Json>;
};

function registryEntryRecord(
  entry: RegistryCorpusEntry,
  identity: Pick<RegistrySiteContentIdentity, "logicalId" | "sourceLineage">,
) {
  const domain = domainByKind[entry.kind];
  const producer = siteContentProducerForMode(modeByKind[entry.kind]);
  if (!producer || producer.producerClass !== "dynamic_registry" || producer.domain !== domain) {
    throw new Error(`Missing dynamic site-content producer for ${entry.kind}.`);
  }
  const route = registryCorpusDetailHref(detailTarget(entry));
  if (!route) throw new Error(`Registry entry ${entry.recordId} has no canonical public route.`);
  return createSiteContentRecord({
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
    sourceLineage: identity.sourceLineage ?? [],
  });
}

function registryPublicGovernanceHash(record: SiteContentRecord) {
  return siteContentValueHash({
    version: record.version,
    producerClass: record.producerClass,
    domain: record.domain,
    sourceRole: record.sourceRole,
    access: record.access,
    validationStatus: record.validationStatus,
    sourceStatus: record.sourceStatus,
    sourceLineage: record.sourceLineage,
  });
}

function expectedCanonicalPublicRegistrySnapshot(
  publicRecordId: string,
  record: SiteContentRecord,
): CanonicalPublicRegistrySnapshot {
  return {
    version: "clinical-kb-site-canonical-public-snapshot-v1",
    publicRecordId,
    logicalId: record.logicalId,
    route: record.route,
    contentHash: record.contentHash,
    governanceHash: registryPublicGovernanceHash(record),
    publicationVersion: record.publicationVersion,
  };
}

function assertCanonicalPublicSnapshot(
  record: SiteContentRecord,
  publicRecordId: string,
  snapshot: CanonicalPublicRegistrySnapshot | undefined,
) {
  if (!snapshot) {
    throw new Error("Trusted canonical-public snapshot evidence is required for registry adoption.");
  }
  const expected = expectedCanonicalPublicRegistrySnapshot(publicRecordId, record);
  if (siteContentValueHash(snapshot) !== siteContentValueHash(expected)) {
    throw new Error(`Trusted canonical-public snapshot mismatch for ${record.logicalId}.`);
  }
}

/**
 * Adds public-release metadata without changing the existing registry text or
 * deterministic document/chunk identities. Generic owner rows never call this
 * projection and therefore remain outside `clinical_kb_site`.
 */
export function canonicalRegistrySiteContentProjection(
  entry: RegistryCorpusEntry,
  identity: RegistrySiteContentIdentity,
  trustedPublicSnapshot: CanonicalPublicRegistrySnapshot,
): CanonicalRegistrySiteContentProjection {
  if (
    entry.ownerId !== identity.rowOwnerId ||
    identity.rowOwnerId !== null ||
    identity.publicationState !== "published" ||
    !identity.renderedByPublicSite ||
    !identity.explicitlyReconciled
  ) {
    throw new Error(
      "Registry site-content classification requires persisted owner truth to match an ownerless reconciled public projection.",
    );
  }
  const record = registryEntryRecord(entry, identity);
  assertCanonicalPublicSnapshot(record, identity.publicRecordId, trustedPublicSnapshot);
  const domain = record.domain;
  const route = record.route;
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
  identity: Pick<RegistrySiteContentIdentity, "logicalId" | "sourceLineage">,
): SiteContentRecord {
  return registryEntryRecord(entry, identity);
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
  const retrievalMetadata = { ...registryCorpusMetadata(candidate.entry) };
  delete retrievalMetadata.registry_record_id;
  delete retrievalMetadata.clinical_validation_evidence;
  return siteContentValueHash({
    logicalId: candidate.logicalId,
    kind: candidate.entry.kind,
    subkind: candidate.entry.subkind,
    slug: candidate.entry.slug,
    route: registryCorpusDetailHref(detailTarget(candidate.entry)),
    title: canonicalSiteContentText(candidate.entry.title),
    content: canonicalSiteContentText(candidate.entry.content),
    searchText: canonicalSiteContentText(candidate.entry.searchText),
    sourceRole: roleByKind[candidate.entry.kind],
    sourceStatus: sourceStatus(candidate.entry.sourceStatus),
    validationStatus: validationStatus(candidate.entry.validationStatus),
    sourceLineage: candidate.sourceLineage ?? [],
    retrievalMetadata,
  });
}

function canonicalCandidate(candidates: readonly RegistryReconciliationCandidate[]) {
  const reconciled = reconcileCanonicalPublicSiteContent(
    candidates.map((candidate) => ({
      candidate,
      recordId: candidate.publicRecordId ?? candidate.entry.recordId,
      logicalId: candidate.logicalId,
      rowOwnerId: candidate.rowOwnerId,
      publicationState: candidate.publicationState ?? "draft",
      renderedByPublicSite: candidate.renderedByPublicSite ?? false,
      explicitlyReconciled: candidate.explicitlyReconciled ?? false,
    })),
  );
  return reconciled?.candidate ?? null;
}

function assertUniqueReconciliationIds(candidates: readonly RegistryReconciliationCandidate[]) {
  const recordIds = new Set<string>();
  const publicRecordIds = new Set<string>();
  for (const candidate of candidates) {
    if (candidate.rowOwnerId !== candidate.entry.ownerId) {
      throw new Error("Registry reconciliation row owner mismatch with persisted entry owner.");
    }
    if (recordIds.has(candidate.entry.recordId)) {
      throw new Error(`Duplicate registry record ID: ${candidate.entry.recordId}`);
    }
    recordIds.add(candidate.entry.recordId);
    if (candidate.publicRecordId) {
      if (publicRecordIds.has(candidate.publicRecordId)) {
        throw new Error(`Duplicate registry public record ID: ${candidate.publicRecordId}`);
      }
      publicRecordIds.add(candidate.publicRecordId);
    }
  }
}

export function buildRegistryReconciliationReport(
  candidates: readonly RegistryReconciliationCandidate[],
  trustedPublicSnapshots: readonly CanonicalPublicRegistrySnapshot[] = [],
): RegistryReconciliationReport {
  assertUniqueReconciliationIds(candidates);
  const candidateLogicalIds = new Set(candidates.map((candidate) => candidate.logicalId));
  const snapshotsByLogicalId = new Map<string, CanonicalPublicRegistrySnapshot>();
  for (const snapshot of trustedPublicSnapshots) {
    if (snapshotsByLogicalId.has(snapshot.logicalId)) {
      throw new Error(`Duplicate trusted canonical-public snapshot for ${snapshot.logicalId}.`);
    }
    if (!candidateLogicalIds.has(snapshot.logicalId)) {
      throw new Error(`Trusted canonical-public snapshot has no reconciliation group: ${snapshot.logicalId}.`);
    }
    snapshotsByLogicalId.set(snapshot.logicalId, snapshot);
  }
  const byLogicalId = new Map<string, RegistryReconciliationCandidate[]>();
  for (const candidate of candidates) {
    const group = byLogicalId.get(candidate.logicalId) ?? [];
    group.push(candidate);
    byLogicalId.set(candidate.logicalId, group);
  }
  const groups = [...byLogicalId.entries()]
    .sort(([left], [right]) => compareCanonicalSiteContentIdentifiers(left, right))
    .map(([logicalId, group]) => {
      const normalizedContentHashes = [...new Set(group.map(reconciliationContentHash))].sort(
        compareCanonicalSiteContentIdentifiers,
      );
      const canonical = canonicalCandidate(group);
      const trustedSnapshot = snapshotsByLogicalId.get(logicalId);
      let matchesTrustedSnapshot = false;
      if (canonical && trustedSnapshot) {
        const record = registryEntryRecord(canonical.entry, canonical);
        try {
          assertCanonicalPublicSnapshot(record, canonical.publicRecordId ?? canonical.entry.recordId, trustedSnapshot);
          matchesTrustedSnapshot = true;
        } catch {
          matchesTrustedSnapshot = false;
        }
      }
      const disposition: RegistryReconciliationDisposition =
        normalizedContentHashes.length > 1
          ? "divergent_requires_administrator_review"
          : canonical && matchesTrustedSnapshot
            ? "adoptable"
            : !canonical && !trustedSnapshot && group.length > 1
              ? "identical_duplicates"
              : "divergent_requires_administrator_review";
      const renderedPublicContentHash = trustedSnapshot?.contentHash ?? null;
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
  trustedPublicSnapshot: CanonicalPublicRegistrySnapshot,
): CanonicalRegistrySiteContentProjection {
  if (candidates.length === 0) throw new Error("Registry adoption requires at least one candidate.");
  if (!trustedPublicSnapshot) {
    throw new Error("Trusted canonical-public snapshot evidence is required for registry adoption.");
  }
  const report = buildRegistryReconciliationReport(candidates, [trustedPublicSnapshot]);
  if (report.groups.length !== 1 || report.groups[0]?.disposition !== "adoptable") {
    const candidate = canonicalCandidate(candidates);
    if (candidate) {
      const record = registryEntryRecord(candidate.entry, candidate);
      assertCanonicalPublicSnapshot(
        record,
        candidate.publicRecordId ?? candidate.entry.recordId,
        trustedPublicSnapshot,
      );
    }
    throw new Error("Registry adoption is divergent or requires administrator review.");
  }
  const candidate = canonicalCandidate(candidates);
  if (!candidate) throw new Error("Registry adoption has no unique reconciled canonical public projection.");
  return canonicalRegistrySiteContentProjection(
    candidate.entry,
    {
      logicalId: candidate.logicalId,
      publicRecordId: candidate.publicRecordId ?? candidate.entry.recordId,
      rowOwnerId: null,
      publicationState: "published",
      renderedByPublicSite: true,
      explicitlyReconciled: true,
      sourceLineage: candidate.sourceLineage,
    },
    trustedPublicSnapshot,
  );
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
