import type { ActiveSiteContentRelease, SiteContentPartitionSnapshot } from "@/lib/site-content/site-content-contracts";

export const SITE_CONTENT_ACTIVATION_SLO_MS = 300_000;
export const SITE_CONTENT_QUEUE_STOP_AGE_MS = 600_000;
export const SITE_CONTENT_WORKER_FRESH_MS = 300_000;
export const SITE_CONTENT_HEALTH_COUNT_CAP = 9_999;
export const SITE_CONTENT_HEALTH_AGE_CAP_MS = 86_400_000;

const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const RELEASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CHANGE_EPOCH = /^(?:0|[1-9][0-9]*)$/;
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;
const INVALID_EVIDENCE = "SITE_CONTENT_RELEASE_EVIDENCE_INVALID";
const RETAINED_BOOTSTRAP_RELEASE_ID = "e4a1dd29-14f6-556c-8fb7-f4f947d8b846";
const RETAINED_BOOTSTRAP_REGISTRY_VERSION = "site-content-bootstrap-public-release-v1";
const RETAINED_BOOTSTRAP_STATIC_MANIFEST_DIGEST = "0".repeat(64);

export type SiteContentBootstrapIntegrityState = "not_applicable" | "valid_retained" | "invalid";
export type SiteContentHealthReasonCode =
  | "active_release_missing"
  | "activation_slo_exceeded"
  | "administrator_attestation_invalid"
  | "artifact_deployment_sha_invalid"
  | "bootstrap_invalid"
  | "bootstrap_missing"
  | "change_epoch_invalid"
  | "count_overflow"
  | "dynamic_digest_invalid"
  | "expected_static_digest_invalid"
  | "expected_static_digest_missing"
  | "expired_processing_lease"
  | "governance_invalid"
  | "invocation_failed"
  | "invocation_future"
  | "invocation_missing"
  | "invocation_stale"
  | "oldest_queue_age_invalid"
  | "outstanding_count_mismatch"
  | "over_age_queue"
  | "partition_disabled"
  | "pending_count_invalid"
  | "pending_set_invalid"
  | "population_incomplete"
  | "quarantined_work"
  | "release_digest_invalid"
  | "release_identity_invalid"
  | "retry_pending_work"
  | "static_manifest_mismatch"
  | "successful_invocation_future"
  | "successful_invocation_missing"
  | "successful_invocation_stale"
  | "time_integrity_invalid"
  | "unexpected_current_queue"
  | "worker_unseen";

export type SiteContentReleaseEvidence = {
  initialized: boolean;
  bootstrapIntegrityState: SiteContentBootstrapIntegrityState;
  activePublicSiteRelease: ActiveSiteContentRelease | null;
  publicSiteChangeEpoch: string | null;
  outstandingHeadCount: number;
  populationComplete: boolean;
  releaseDigestValid: boolean;
  dynamicDigestValid: boolean;
  administratorAttestationValid: boolean;
  governanceValid: boolean;
  pendingSetExact: boolean;
  outstandingHeadCountAgrees: boolean;
  pendingCount: number;
  retryPendingCount: number;
  processingCount: number;
  readyCount: number;
  quarantinedCount: number;
  oldestOutstandingOriginAgeMs: number | null;
  countOverflow: boolean;
  timeIntegrityValid: boolean;
  expiredProcessingLeaseCount: number;
  synchronizerSeen: boolean;
  lastInvocationAt: string | null;
  lastSuccessfulInvocationAt: string | null;
  latestInvocationSucceeded: boolean;
  lastActivation: string | null;
  rollbackAvailable: boolean;
  artifactDeploymentSha?: string;
};

export type SiteContentPartitionInput = {
  expectedSiteStaticManifestDigest?: string;
  activePublicSiteRelease: ActiveSiteContentRelease | null;
  publicSiteChangeEpoch: string | null;
  pendingPublicSiteChangeCount: number;
};
export type SiteContentPartitionClassification = SiteContentPartitionSnapshot & {
  staticMatches: boolean;
  reasons: readonly SiteContentHealthReasonCode[];
};
export type SiteContentHealthInput = SiteContentReleaseEvidence & {
  partition: SiteContentPartitionClassification;
  now: string;
};
export type SiteContentPublicHealthProjection = {
  releaseId: string | null;
  staticMatches: boolean;
  releaseDigestPrefix: string | null;
  state: SiteContentPartitionSnapshot["state"];
  synchronizerSeen: boolean;
  invocationFresh: boolean;
  lastSuccessfulInvocationFresh: boolean;
  pendingCount: number;
  retryPendingCount: number;
  processingCount: number;
  readyCount: number;
  failedCount: number;
  oldestQueueAgeMs: number | null;
  lastActivation: string | null;
  rollbackAvailable: boolean;
};
export type SiteContentHealthClassification = {
  state: SiteContentPartitionSnapshot["state"];
  ready: boolean;
  operationStop: boolean;
  reasons: readonly SiteContentHealthReasonCode[];
  publicProjection: SiteContentPublicHealthProjection;
};

const evidenceKeys = [
  "activePublicSiteRelease",
  "administratorAttestationValid",
  "bootstrapIntegrityState",
  "countOverflow",
  "dynamicDigestValid",
  "expiredProcessingLeaseCount",
  "governanceValid",
  "initialized",
  "lastActivation",
  "lastInvocationAt",
  "lastSuccessfulInvocationAt",
  "latestInvocationSucceeded",
  "oldestOutstandingOriginAgeMs",
  "outstandingHeadCount",
  "outstandingHeadCountAgrees",
  "pendingCount",
  "pendingSetExact",
  "populationComplete",
  "processingCount",
  "publicSiteChangeEpoch",
  "quarantinedCount",
  "readyCount",
  "releaseDigestValid",
  "retryPendingCount",
  "rollbackAvailable",
  "synchronizerSeen",
  "timeIntegrityValid",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function isTimestamp(value: unknown): value is string {
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
  ) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}
function isRelease(value: unknown): value is ActiveSiteContentRelease {
  if (!isRecord(value)) return false;
  const keys = [
    "activatedAt",
    "dynamicStateDigest",
    "registryVersion",
    "releaseDigest",
    "releaseId",
    "state",
    "staticManifestDigest",
    "version",
  ].sort();
  if (Object.keys(value).sort().join("|") !== keys.join("|")) return false;
  return (
    value.version === "clinical-kb-site-release-v1" &&
    value.state === "active" &&
    typeof value.registryVersion === "string" &&
    value.registryVersion.length > 0 &&
    typeof value.releaseId === "string" &&
    RELEASE_ID.test(value.releaseId) &&
    typeof value.staticManifestDigest === "string" &&
    SHA256.test(value.staticManifestDigest) &&
    typeof value.dynamicStateDigest === "string" &&
    SHA256.test(value.dynamicStateDigest) &&
    typeof value.releaseDigest === "string" &&
    SHA256.test(value.releaseDigest) &&
    isTimestamp(value.activatedAt)
  );
}
function failEvidence(): never {
  throw new Error(INVALID_EVIDENCE);
}

export function parseSiteContentReleaseEvidence(value: unknown): SiteContentReleaseEvidence {
  if (!isRecord(value)) failEvidence();
  const allowed = new Set<string>([...evidenceKeys, "artifactDeploymentSha"]);
  if (Object.keys(value).some((key) => !allowed.has(key)) || evidenceKeys.some((key) => !(key in value)))
    failEvidence();
  const booleans = [
    "administratorAttestationValid",
    "countOverflow",
    "dynamicDigestValid",
    "governanceValid",
    "initialized",
    "latestInvocationSucceeded",
    "outstandingHeadCountAgrees",
    "pendingSetExact",
    "populationComplete",
    "releaseDigestValid",
    "rollbackAvailable",
    "synchronizerSeen",
    "timeIntegrityValid",
  ] as const;
  const counts = [
    "expiredProcessingLeaseCount",
    "outstandingHeadCount",
    "pendingCount",
    "processingCount",
    "quarantinedCount",
    "readyCount",
    "retryPendingCount",
  ] as const;
  if (booleans.some((key) => !isBoolean(value[key])) || counts.some((key) => !isCount(value[key]))) failEvidence();
  if (!["not_applicable", "valid_retained", "invalid"].includes(value.bootstrapIntegrityState as string))
    failEvidence();
  if (value.activePublicSiteRelease !== null && !isRelease(value.activePublicSiteRelease)) failEvidence();
  if (
    value.publicSiteChangeEpoch !== null &&
    (typeof value.publicSiteChangeEpoch !== "string" || !CHANGE_EPOCH.test(value.publicSiteChangeEpoch))
  )
    failEvidence();
  if (value.oldestOutstandingOriginAgeMs !== null && !isCount(value.oldestOutstandingOriginAgeMs)) failEvidence();
  for (const key of ["lastActivation", "lastInvocationAt", "lastSuccessfulInvocationAt"] as const) {
    if (value[key] !== null && !isTimestamp(value[key])) failEvidence();
  }
  if (
    value.artifactDeploymentSha !== undefined &&
    (typeof value.artifactDeploymentSha !== "string" || !COMMIT_SHA.test(value.artifactDeploymentSha))
  )
    failEvidence();
  return value as SiteContentReleaseEvidence;
}

function sortedReasons(reasons: Iterable<SiteContentHealthReasonCode>): SiteContentHealthReasonCode[] {
  return [...new Set(reasons)].sort();
}

export function classifySiteContentPartition(input: SiteContentPartitionInput): SiteContentPartitionClassification {
  const {
    activePublicSiteRelease: release,
    publicSiteChangeEpoch: epoch,
    pendingPublicSiteChangeCount: pending,
  } = input;
  const expected = input.expectedSiteStaticManifestDigest;
  const validRelease = isRelease(release);
  const base = {
    releaseId: validRelease ? release.releaseId : null,
    staticManifestDigest: validRelease ? release.staticManifestDigest : null,
    dynamicStateDigest: validRelease ? release.dynamicStateDigest : null,
    releaseDigest: validRelease ? release.releaseDigest : null,
    changeEpoch: typeof epoch === "string" && CHANGE_EPOCH.test(epoch) ? epoch : null,
  };
  const reasons: SiteContentHealthReasonCode[] = [];
  if (!isCount(pending)) reasons.push("pending_count_invalid");
  if (expected !== undefined && !SHA256.test(expected)) reasons.push("expected_static_digest_invalid");
  if (release !== null && !validRelease) reasons.push("release_identity_invalid");
  if (epoch !== null && (typeof epoch !== "string" || !CHANGE_EPOCH.test(epoch))) reasons.push("change_epoch_invalid");
  if (reasons.length > 0)
    return { ...base, state: "unavailable", staticMatches: false, reasons: sortedReasons(reasons) };
  if (expected === undefined && release === null && epoch === null && pending === 0) {
    return { ...base, state: "disabled", staticMatches: false, reasons: ["partition_disabled"] };
  }
  if (expected === undefined) reasons.push("expected_static_digest_missing");
  if (release === null) reasons.push("active_release_missing");
  if (epoch === null) reasons.push("change_epoch_invalid");
  if (reasons.length > 0 || !validRelease || expected === undefined || epoch === null) {
    return { ...base, state: "unavailable", staticMatches: false, reasons: sortedReasons(reasons) };
  }
  if (
    release.releaseId === RETAINED_BOOTSTRAP_RELEASE_ID &&
    release.registryVersion === RETAINED_BOOTSTRAP_REGISTRY_VERSION &&
    release.staticManifestDigest === RETAINED_BOOTSTRAP_STATIC_MANIFEST_DIGEST
  ) {
    return { ...base, state: "unavailable", staticMatches: false, reasons: ["bootstrap_invalid"] };
  }
  if (release.staticManifestDigest !== expected) {
    return { ...base, state: "stale", staticMatches: false, reasons: ["static_manifest_mismatch"] };
  }
  return { ...base, state: pending === 0 ? "current" : "updating", staticMatches: true, reasons: [] };
}

function timestampAge(now: number, value: string | null): number | null {
  if (value === null || !isTimestamp(value)) return null;
  return now - Date.parse(value);
}
function capCount(value: number): number {
  return Math.min(value, SITE_CONTENT_HEALTH_COUNT_CAP);
}

function hasExactRetainedBootstrapIdentity(input: SiteContentHealthInput): boolean {
  const activeRelease = input.activePublicSiteRelease;
  return (
    isRelease(activeRelease) &&
    activeRelease.releaseId === RETAINED_BOOTSTRAP_RELEASE_ID &&
    activeRelease.registryVersion === RETAINED_BOOTSTRAP_REGISTRY_VERSION &&
    activeRelease.staticManifestDigest === RETAINED_BOOTSTRAP_STATIC_MANIFEST_DIGEST &&
    activeRelease.state === "active" &&
    input.publicSiteChangeEpoch === "0" &&
    input.partition.releaseId === activeRelease.releaseId &&
    input.partition.staticManifestDigest === activeRelease.staticManifestDigest &&
    input.partition.dynamicStateDigest === activeRelease.dynamicStateDigest &&
    input.partition.releaseDigest === activeRelease.releaseDigest &&
    input.partition.changeEpoch === input.publicSiteChangeEpoch
  );
}

export function classifySiteContentHealth(input: SiteContentHealthInput): SiteContentHealthClassification {
  const reasons = new Set<SiteContentHealthReasonCode>(input.partition.reasons);
  const now = isTimestamp(input.now) ? Date.parse(input.now) : Number.NaN;
  const counts = [
    input.outstandingHeadCount,
    input.pendingCount,
    input.retryPendingCount,
    input.processingCount,
    input.readyCount,
    input.quarantinedCount,
    input.expiredProcessingLeaseCount,
  ];
  if (!Number.isFinite(now) || !input.timeIntegrityValid) reasons.add("time_integrity_invalid");
  if (!counts.every(isCount)) reasons.add("pending_count_invalid");
  if (input.countOverflow) reasons.add("count_overflow");
  if (input.artifactDeploymentSha !== undefined && !COMMIT_SHA.test(input.artifactDeploymentSha))
    reasons.add("artifact_deployment_sha_invalid");

  const retainedBootstrapOperationallyClean =
    input.outstandingHeadCount === 0 &&
    input.pendingCount === 0 &&
    input.retryPendingCount === 0 &&
    input.processingCount === 0 &&
    input.readyCount === 0 &&
    input.quarantinedCount === 0 &&
    input.expiredProcessingLeaseCount === 0 &&
    input.pendingSetExact &&
    input.outstandingHeadCountAgrees &&
    input.oldestOutstandingOriginAgeMs === null;
  const retainedBootstrapOverride =
    !input.initialized &&
    input.bootstrapIntegrityState === "valid_retained" &&
    retainedBootstrapOperationallyClean &&
    input.partition.state === "unavailable" &&
    input.partition.reasons.length === 1 &&
    input.partition.reasons[0] === "expected_static_digest_missing" &&
    hasExactRetainedBootstrapIdentity(input);
  let state: SiteContentPartitionSnapshot["state"] = retainedBootstrapOverride ? "disabled" : input.partition.state;
  if (retainedBootstrapOverride) reasons.delete("expected_static_digest_missing");
  if (input.initialized && state === "disabled") {
    state = "unavailable";
    reasons.delete("partition_disabled");
    reasons.add("active_release_missing");
    reasons.add("change_epoch_invalid");
    reasons.add("expected_static_digest_missing");
  }
  if (input.bootstrapIntegrityState === "invalid") reasons.add("bootstrap_invalid");
  if (!input.initialized && !retainedBootstrapOverride) {
    reasons.add(input.bootstrapIntegrityState === "not_applicable" ? "bootstrap_missing" : "bootstrap_invalid");
  }
  if (input.initialized && input.bootstrapIntegrityState !== "not_applicable") reasons.add("bootstrap_invalid");

  if (input.initialized) {
    if (!input.populationComplete) reasons.add("population_incomplete");
    if (!input.releaseDigestValid) reasons.add("release_digest_invalid");
    if (!input.dynamicDigestValid) reasons.add("dynamic_digest_invalid");
    if (!input.administratorAttestationValid) reasons.add("administrator_attestation_invalid");
    if (!input.governanceValid) reasons.add("governance_invalid");
    if (!input.pendingSetExact) reasons.add("pending_set_invalid");
    if (!input.outstandingHeadCountAgrees) reasons.add("outstanding_count_mismatch");
  }
  if (input.retryPendingCount > 0) reasons.add("retry_pending_work");
  if (input.quarantinedCount > 0) reasons.add("quarantined_work");
  if (input.expiredProcessingLeaseCount > 0) reasons.add("expired_processing_lease");
  if (input.outstandingHeadCount === 0) {
    if (input.oldestOutstandingOriginAgeMs !== null) reasons.add("oldest_queue_age_invalid");
  } else if (!isCount(input.oldestOutstandingOriginAgeMs)) {
    reasons.add("oldest_queue_age_invalid");
  } else {
    if (input.oldestOutstandingOriginAgeMs > SITE_CONTENT_ACTIVATION_SLO_MS) reasons.add("activation_slo_exceeded");
    if (input.oldestOutstandingOriginAgeMs > SITE_CONTENT_QUEUE_STOP_AGE_MS) reasons.add("over_age_queue");
  }

  const invocationAge = timestampAge(now, input.lastInvocationAt);
  const successAge = timestampAge(now, input.lastSuccessfulInvocationAt);
  const activationAge = timestampAge(now, input.lastActivation);
  if (input.initialized && (activationAge === null || !Number.isFinite(activationAge) || activationAge < 0)) {
    reasons.add("time_integrity_invalid");
  }
  const invocationFresh = invocationAge !== null && invocationAge >= 0 && invocationAge <= SITE_CONTENT_WORKER_FRESH_MS;
  const successFresh = successAge !== null && successAge >= 0 && successAge <= SITE_CONTENT_WORKER_FRESH_MS;
  if (state === "current" || state === "updating") {
    if (!input.synchronizerSeen) reasons.add("worker_unseen");
    if (input.lastInvocationAt === null) reasons.add("invocation_missing");
    else if (invocationAge === null || invocationAge < 0) reasons.add("invocation_future");
    else if (!invocationFresh) reasons.add("invocation_stale");
    if (input.lastSuccessfulInvocationAt === null) reasons.add("successful_invocation_missing");
    else if (successAge === null || successAge < 0) reasons.add("successful_invocation_future");
    else if (!successFresh) reasons.add("successful_invocation_stale");
    if (!input.latestInvocationSucceeded) reasons.add("invocation_failed");
  }
  if (
    state === "current" &&
    [input.pendingCount, input.retryPendingCount, input.processingCount, input.readyCount, input.quarantinedCount].some(
      (value) => value !== 0,
    )
  ) {
    reasons.add("unexpected_current_queue");
  }

  const nonStopping = new Set<SiteContentHealthReasonCode>(["activation_slo_exceeded", "partition_disabled"]);
  const stoppingReasons = [...reasons].filter((reason) => !nonStopping.has(reason));
  const staticMismatchOnly =
    state === "stale" && stoppingReasons.length === 1 && stoppingReasons[0] === "static_manifest_mismatch";
  if (stoppingReasons.length > 0 && !staticMismatchOnly) state = "unavailable";
  const operationStop = state === "stale" || state === "unavailable" || stoppingReasons.length > 0;
  const ready = !operationStop && (state === "disabled" || state === "current" || state === "updating");
  const failedCount = input.retryPendingCount + input.quarantinedCount;
  return {
    state,
    ready,
    operationStop,
    reasons: sortedReasons(reasons),
    publicProjection: {
      releaseId: input.partition.releaseId,
      staticMatches: input.partition.staticMatches,
      releaseDigestPrefix: input.partition.releaseDigest?.slice(0, 12) ?? null,
      state,
      synchronizerSeen: input.synchronizerSeen,
      invocationFresh,
      lastSuccessfulInvocationFresh: successFresh,
      pendingCount: capCount(input.pendingCount),
      retryPendingCount: capCount(input.retryPendingCount),
      processingCount: capCount(input.processingCount),
      readyCount: capCount(input.readyCount),
      failedCount: capCount(failedCount),
      oldestQueueAgeMs:
        input.oldestOutstandingOriginAgeMs === null
          ? null
          : Math.min(input.oldestOutstandingOriginAgeMs, SITE_CONTENT_HEALTH_AGE_CAP_MS),
      lastActivation: input.lastActivation,
      rollbackAvailable: input.rollbackAvailable,
    },
  };
}
