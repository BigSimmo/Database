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

const SNAPSHOT_KEYS = [
  "documentIndexGeneration",
  "publicSiteContent",
  "resolvedAt",
  "rolloutVersion",
  "siteContentRegistryVersion",
  "sourcePolicyVersion",
  "version",
] as const;
const PARTITION_KEYS = [
  "changeEpoch",
  "dynamicStateDigest",
  "releaseDigest",
  "releaseId",
  "state",
  "staticManifestDigest",
] as const;
const CONTEXT_KEYS = ["snapshot", "snapshotCacheKey"] as const;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CHANGE_EPOCH = /^(?:0|[1-9][0-9]*)$/;
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;
const LEGACY_DOCUMENT_INDEX_GENERATION = "rag-legacy-document-index-v1";
const LEGACY_SOURCE_POLICY_VERSION = "rag-legacy-source-policy-v1";
const LEGACY_ROLLOUT_VERSION = "rag-legacy-rollout-v1";
const issuedRequestContexts = new WeakSet<RagRequestContext>();

const legacySnapshotInput: RagContextSnapshotInput = Object.freeze({
  expectedSiteStaticManifestDigest: null,
  activePublicSiteRelease: null,
  publicSiteChangeEpoch: null,
  pendingPublicSiteChangeCount: 0,
  documentIndexGeneration: LEGACY_DOCUMENT_INDEX_GENERATION,
  sourcePolicyVersion: LEGACY_SOURCE_POLICY_VERSION,
  rolloutVersion: LEGACY_ROLLOUT_VERSION,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactOwnKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && ownKeys.every((key) => keys.some((expected) => expected === key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > (daysInMonth[month - 1] ?? 0) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  )
    return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function hasNullReleaseBundle(snapshot: RagContextSnapshot) {
  const partition = snapshot.publicSiteContent;
  return (
    snapshot.siteContentRegistryVersion === null &&
    partition.releaseId === null &&
    partition.staticManifestDigest === null &&
    partition.dynamicStateDigest === null &&
    partition.releaseDigest === null
  );
}

function hasCompleteReleaseBundle(snapshot: RagContextSnapshot) {
  const partition = snapshot.publicSiteContent;
  return (
    isNonEmptyString(snapshot.siteContentRegistryVersion) &&
    typeof partition.releaseId === "string" &&
    RELEASE_ID.test(partition.releaseId) &&
    typeof partition.staticManifestDigest === "string" &&
    SHA256.test(partition.staticManifestDigest) &&
    typeof partition.dynamicStateDigest === "string" &&
    SHA256.test(partition.dynamicStateDigest) &&
    typeof partition.releaseDigest === "string" &&
    SHA256.test(partition.releaseDigest)
  );
}

function isExactLegacyDisabledSnapshot(snapshot: RagContextSnapshot) {
  const partition = snapshot.publicSiteContent;
  return (
    partition.state === "disabled" &&
    snapshot.documentIndexGeneration === LEGACY_DOCUMENT_INDEX_GENERATION &&
    snapshot.sourcePolicyVersion === LEGACY_SOURCE_POLICY_VERSION &&
    snapshot.rolloutVersion === LEGACY_ROLLOUT_VERSION &&
    hasNullReleaseBundle(snapshot) &&
    partition.changeEpoch === null
  );
}

function assertRagContextSnapshotIntegrity(snapshot: RagContextSnapshot): asserts snapshot is RagContextSnapshot {
  let valid = isRecord(snapshot) && hasExactOwnKeys(snapshot, SNAPSHOT_KEYS);
  const partition = valid && isRecord(snapshot.publicSiteContent) ? snapshot.publicSiteContent : null;
  valid = Boolean(
    valid &&
    partition &&
    hasExactOwnKeys(partition, PARTITION_KEYS) &&
    snapshot.version === "rag-context-snapshot-v1" &&
    isValidIsoTimestamp(snapshot.resolvedAt) &&
    isNonEmptyString(snapshot.documentIndexGeneration) &&
    isNonEmptyString(snapshot.sourcePolicyVersion) &&
    isNonEmptyString(snapshot.rolloutVersion) &&
    (snapshot.siteContentRegistryVersion === null || isNonEmptyString(snapshot.siteContentRegistryVersion)) &&
    isNullableString(partition.releaseId) &&
    isNullableString(partition.staticManifestDigest) &&
    isNullableString(partition.dynamicStateDigest) &&
    isNullableString(partition.releaseDigest) &&
    isNullableString(partition.changeEpoch) &&
    ["disabled", "current", "updating", "stale", "unavailable"].includes(partition.state as string) &&
    (partition.changeEpoch === null || CHANGE_EPOCH.test(partition.changeEpoch)) &&
    (partition.staticManifestDigest === null || SHA256.test(partition.staticManifestDigest)) &&
    (partition.dynamicStateDigest === null || SHA256.test(partition.dynamicStateDigest)) &&
    (partition.releaseDigest === null || SHA256.test(partition.releaseDigest)),
  );
  if (valid) {
    switch (snapshot.publicSiteContent.state) {
      case "disabled":
        valid = isExactLegacyDisabledSnapshot(snapshot);
        break;
      case "current":
      case "updating":
      case "stale":
        valid = hasCompleteReleaseBundle(snapshot) && snapshot.publicSiteContent.changeEpoch !== null;
        break;
      case "unavailable":
        valid = hasCompleteReleaseBundle(snapshot) || hasNullReleaseBundle(snapshot);
        break;
    }
  }
  if (!valid) throw new Error("Invalid RAG context snapshot.");
}

function resolveRagContextSnapshotInternal(input: RagContextSnapshotInput, allowDisabled: boolean): RagContextSnapshot {
  const partition = classifySiteContentPartition({
    expectedSiteStaticManifestDigest: input.expectedSiteStaticManifestDigest ?? undefined,
    activePublicSiteRelease: input.activePublicSiteRelease,
    publicSiteChangeEpoch: input.publicSiteChangeEpoch,
    pendingPublicSiteChangeCount: input.pendingPublicSiteChangeCount,
  });
  if (partition.state === "disabled" && !allowDisabled) {
    throw new Error("Invalid RAG context snapshot input.");
  }
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
  const snapshot = Object.freeze({
    version: "rag-context-snapshot-v1" as const,
    resolvedAt: new Date().toISOString(),
    documentIndexGeneration: input.documentIndexGeneration,
    sourcePolicyVersion: input.sourcePolicyVersion,
    rolloutVersion: input.rolloutVersion,
    siteContentRegistryVersion,
    publicSiteContent,
  });
  assertRagContextSnapshotIntegrity(snapshot);
  return snapshot;
}

export function resolveRagContextSnapshot(input: RagContextSnapshotInput): RagContextSnapshot {
  return resolveRagContextSnapshotInternal(input, false);
}

export function ragContextSnapshotCacheKey(snapshot: RagContextSnapshot): string {
  assertRagContextSnapshotIntegrity(snapshot);
  if (isExactLegacyDisabledSnapshot(snapshot)) return "";
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

function createRagRequestContext(snapshot: RagContextSnapshot): RagRequestContext {
  Object.freeze(snapshot.publicSiteContent);
  Object.freeze(snapshot);
  const context = Object.freeze({ snapshot, snapshotCacheKey: ragContextSnapshotCacheKey(snapshot) });
  issuedRequestContexts.add(context);
  return context;
}

export function assertRagRequestContextIntegrity(context: RagRequestContext): asserts context is RagRequestContext {
  let valid = false;
  try {
    valid =
      isRecord(context) &&
      issuedRequestContexts.has(context) &&
      hasExactOwnKeys(context, CONTEXT_KEYS) &&
      isRecord(context.snapshot) &&
      isRecord(context.snapshot.publicSiteContent) &&
      Object.isFrozen(context) &&
      Object.isFrozen(context.snapshot) &&
      Object.isFrozen(context.snapshot.publicSiteContent) &&
      ragContextSnapshotCacheKey(context.snapshot) === context.snapshotCacheKey;
  } catch {
    valid = false;
  }
  if (!valid) throw new Error("Invalid RAG request context.");
}

export function withRagRequestContext<
  T extends { ragRequestContext?: RagRequestContext; ragContextSnapshotInput?: RagContextSnapshotInput },
>(args: T): T & { ragRequestContext: RagRequestContext } {
  if (args.ragRequestContext) {
    assertRagRequestContextIntegrity(args.ragRequestContext);
    return args as T & { ragRequestContext: RagRequestContext };
  }
  const snapshot = args.ragContextSnapshotInput
    ? resolveRagContextSnapshot(args.ragContextSnapshotInput)
    : resolveRagContextSnapshotInternal(legacySnapshotInput, true);
  return { ...args, ragRequestContext: createRagRequestContext(snapshot) };
}
