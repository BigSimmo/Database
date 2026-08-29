import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifySiteContentHealth,
  classifySiteContentPartition,
  parseSiteContentReleaseEvidence,
} from "../src/lib/site-content/site-content-health";

const ARGUMENT_ERROR = "SITE_CONTENT_FRESHNESS_ARGUMENTS_INVALID";
const EVIDENCE_ERROR = "SITE_CONTENT_OFFLINE_EVIDENCE_INVALID";
const LIVE_ERROR = "SITE_CONTENT_LIVE_MODE_NOT_AUTHORIZED";
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const LOGICAL_ID = /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$/;

function stop(code: string): never {
  process.stderr.write(`${code}\n`);
  process.exit(1);
}

function parseArguments(args: string[]) {
  if (args.includes("--live")) {
    const allowed = new Set(["--live", "--project-ref", "--confirm-project-ref", "--approval-marker"]);
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (!allowed.has(arg)) stop(ARGUMENT_ERROR);
      if (arg !== "--live") index += 1;
    }
    stop(LIVE_ERROR);
  }
  let evidencePath: string | undefined;
  let now: string | undefined;
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || (flag !== "--evidence" && flag !== "--now")) stop(ARGUMENT_ERROR);
    if (flag === "--evidence") {
      if (evidencePath !== undefined) stop(ARGUMENT_ERROR);
      evidencePath = value;
    } else {
      if (now !== undefined) stop(ARGUMENT_ERROR);
      now = value;
    }
  }
  if (!evidencePath) stop(ARGUMENT_ERROR);
  return { evidencePath, now };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

const { evidencePath, now: injectedNow } = parseArguments(process.argv.slice(2));
const absolutePath = resolve(evidencePath);
try {
  if (lstatSync(absolutePath).isSymbolicLink() || realpathSync.native(absolutePath) !== absolutePath)
    stop(EVIDENCE_ERROR);
} catch {
  stop(EVIDENCE_ERROR);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(absolutePath, "utf8"));
} catch {
  stop(EVIDENCE_ERROR);
}
if (!isRecord(raw)) stop(EVIDENCE_ERROR);
const expectedKeys = [
  "artifactDeploymentSha",
  "expectedSiteStaticManifestDigest",
  "health",
  "logicalIds",
  "observedAt",
  "publishedLogicalIds",
  "version",
].sort();
if (Object.keys(raw).sort().join("|") !== expectedKeys.join("|")) stop(EVIDENCE_ERROR);
if (
  raw.version !== "site-content-offline-evidence-v1" ||
  typeof raw.artifactDeploymentSha !== "string" ||
  !COMMIT_SHA.test(raw.artifactDeploymentSha) ||
  typeof raw.expectedSiteStaticManifestDigest !== "string" ||
  !SHA256.test(raw.expectedSiteStaticManifestDigest) ||
  !isIsoTimestamp(raw.observedAt) ||
  !Array.isArray(raw.logicalIds) ||
  !Array.isArray(raw.publishedLogicalIds) ||
  raw.logicalIds.some((id) => typeof id !== "string" || !LOGICAL_ID.test(id)) ||
  raw.publishedLogicalIds.some((id) => typeof id !== "string" || !LOGICAL_ID.test(id))
) {
  stop(EVIDENCE_ERROR);
}
const logicalIds = raw.logicalIds as string[];
const publishedLogicalIds = raw.publishedLogicalIds as string[];
const sortedLogicalIds = [...logicalIds].sort();
const sortedPublishedLogicalIds = [...publishedLogicalIds].sort();
if (
  new Set(logicalIds).size !== logicalIds.length ||
  new Set(publishedLogicalIds).size !== publishedLogicalIds.length ||
  sortedLogicalIds.length !== sortedPublishedLogicalIds.length ||
  sortedLogicalIds.some((logicalId, index) => logicalId !== sortedPublishedLogicalIds[index])
) {
  stop(EVIDENCE_ERROR);
}

let evidence;
try {
  evidence = parseSiteContentReleaseEvidence({
    ...(raw.health as Record<string, unknown>),
    artifactDeploymentSha: raw.artifactDeploymentSha,
  });
} catch {
  stop(EVIDENCE_ERROR);
}
const now = injectedNow ?? raw.observedAt;
if (!isIsoTimestamp(now)) {
  stop(ARGUMENT_ERROR);
}
const partition = classifySiteContentPartition({
  expectedSiteStaticManifestDigest: raw.expectedSiteStaticManifestDigest,
  activePublicSiteRelease: evidence.activePublicSiteRelease,
  publicSiteChangeEpoch: evidence.publicSiteChangeEpoch,
  pendingPublicSiteChangeCount: evidence.outstandingHeadCount,
});
const health = classifySiteContentHealth({ ...evidence, partition, now });
const summary = {
  version: "site-content-freshness-summary-v1",
  artifactDeploymentSha: raw.artifactDeploymentSha,
  state: health.state,
  ready: health.ready,
  operationStop: health.operationStop,
  reasons: health.reasons,
  health: health.publicProjection,
};
process.stdout.write(`${JSON.stringify(summary)}\n`);
if (health.operationStop) process.exit(1);
