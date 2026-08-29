import { createHash } from "node:crypto";

import type { ActiveSiteContentRelease, RagContextSnapshot } from "@/lib/site-content/site-content-contracts";
import { classifySiteContentPartition } from "@/lib/site-content/site-content-health";

export type RagContextSnapshotInput = {
  expectedSiteStaticManifestDigest: string | null;
  activePublicSiteRelease: ActiveSiteContentRelease | null;
  publicSiteChangeEpoch: string | null;
  pendingPublicSiteChangeCount: number;
  documentIndexGeneration: string;
  sourcePolicyVersion: string;
  rolloutVersion: string;
};

export type RagRequestContext = Readonly<{
  snapshot: RagContextSnapshot;
  snapshotCacheKey: string;
}>;

const legacySnapshotInput: RagContextSnapshotInput = Object.freeze({
  expectedSiteStaticManifestDigest: null,
  activePublicSiteRelease: null,
  publicSiteChangeEpoch: null,
  pendingPublicSiteChangeCount: 0,
  documentIndexGeneration: "rag-legacy-document-index-v1",
  sourcePolicyVersion: "rag-legacy-source-policy-v1",
  rolloutVersion: "rag-legacy-rollout-v1",
});

export function resolveRagContextSnapshot(input: RagContextSnapshotInput): RagContextSnapshot {
  const partition = classifySiteContentPartition({
    expectedSiteStaticManifestDigest: input.expectedSiteStaticManifestDigest ?? undefined,
    activePublicSiteRelease: input.activePublicSiteRelease,
    publicSiteChangeEpoch: input.publicSiteChangeEpoch,
    pendingPublicSiteChangeCount: input.pendingPublicSiteChangeCount,
  });
  const publicSiteContent = Object.freeze({
    releaseId: partition.releaseId,
    staticManifestDigest: partition.staticManifestDigest,
    dynamicStateDigest: partition.dynamicStateDigest,
    releaseDigest: partition.releaseDigest,
    changeEpoch: partition.changeEpoch,
    state: partition.state,
  });
  const siteContentRegistryVersion = partition.releaseId
    ? (input.activePublicSiteRelease?.registryVersion ?? null)
    : null;
  return Object.freeze({
    version: "rag-context-snapshot-v1",
    resolvedAt: new Date().toISOString(),
    documentIndexGeneration: input.documentIndexGeneration,
    sourcePolicyVersion: input.sourcePolicyVersion,
    rolloutVersion: input.rolloutVersion,
    siteContentRegistryVersion,
    publicSiteContent,
  });
}

function isExactDisabledSnapshot(snapshot: RagContextSnapshot) {
  const partition = snapshot.publicSiteContent;
  return (
    partition.state === "disabled" &&
    snapshot.siteContentRegistryVersion === null &&
    partition.releaseId === null &&
    partition.staticManifestDigest === null &&
    partition.dynamicStateDigest === null &&
    partition.releaseDigest === null &&
    partition.changeEpoch === null
  );
}

export function ragContextSnapshotCacheKey(snapshot: RagContextSnapshot): string {
  if (isExactDisabledSnapshot(snapshot)) return "";
  const partition = snapshot.publicSiteContent;
  const identity = [
    "rag-context-snapshot-cache-v1",
    snapshot.documentIndexGeneration,
    snapshot.sourcePolicyVersion,
    snapshot.rolloutVersion,
    snapshot.siteContentRegistryVersion,
    partition.state,
    partition.releaseId,
    partition.staticManifestDigest,
    partition.dynamicStateDigest,
    partition.releaseDigest,
    partition.changeEpoch,
  ];
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function withRagRequestContext<
  T extends { ragRequestContext?: RagRequestContext; ragContextSnapshotInput?: RagContextSnapshotInput },
>(args: T): T & { ragRequestContext: RagRequestContext } {
  if (args.ragRequestContext) return args as T & { ragRequestContext: RagRequestContext };
  const snapshot = resolveRagContextSnapshot(args.ragContextSnapshotInput ?? legacySnapshotInput);
  return {
    ...args,
    ragRequestContext: Object.freeze({ snapshot, snapshotCacheKey: ragContextSnapshotCacheKey(snapshot) }),
  };
}
