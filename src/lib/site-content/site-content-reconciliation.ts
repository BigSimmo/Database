import { createHash } from "node:crypto";

const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LOGICAL_ID = /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$/;
const SOURCE_VERSION = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Reconciliation canonical JSON requires finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Reconciliation canonical JSON cannot encode ${typeof value}.`);
}

function reconciliationHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export type SiteContentReconciliationInput = {
  version: "site-content-reconciliation-plan-v1";
  planDigest: string;
  trustedSnapshotDigest: string;
  expectedRecordCount: number;
  expectedGroupCount: number;
  batchSize: number;
  batchCount: number;
  counts: { adopt: number; retire: number; identicalDuplicate: number; total: number };
  trustedSnapshots: Array<Record<string, unknown>>;
  dispositions: Array<Record<string, unknown>>;
};

export function assertSiteContentReconciliationInput(value: unknown): asserts value is SiteContentReconciliationInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Reviewed reconciliation plan is invalid.");
  const plan = value as Record<string, unknown>;
  const expectedKeys = [
    "batchCount",
    "batchSize",
    "counts",
    "dispositions",
    "expectedRecordCount",
    "expectedGroupCount",
    "planDigest",
    "trustedSnapshotDigest",
    "trustedSnapshots",
    "version",
  ].sort();
  if (
    JSON.stringify(Object.keys(plan).sort()) !== JSON.stringify(expectedKeys) ||
    plan.version !== "site-content-reconciliation-plan-v1" ||
    typeof plan.planDigest !== "string" ||
    !SHA256.test(plan.planDigest) ||
    typeof plan.trustedSnapshotDigest !== "string" ||
    !SHA256.test(plan.trustedSnapshotDigest) ||
    !Number.isInteger(plan.expectedRecordCount) ||
    !Number.isInteger(plan.expectedGroupCount) ||
    !Number.isInteger(plan.batchSize) ||
    !Number.isInteger(plan.batchCount) ||
    !Array.isArray(plan.dispositions) ||
    !Array.isArray(plan.trustedSnapshots) ||
    !plan.counts ||
    typeof plan.counts !== "object"
  ) {
    throw new Error("Reviewed reconciliation plan is invalid.");
  }
  const dispositions = plan.dispositions as Array<Record<string, unknown>>;
  const trustedSnapshots = plan.trustedSnapshots as Array<Record<string, unknown>>;
  const batchSize = Number(plan.batchSize);
  const sourceIds = dispositions.map((item) => `${String(item.sourceKind)}:${String(item.sourceRowId)}`);
  const allowed = new Set(["adopt", "retire", "identical_duplicate"]);
  const dispositionKeys = [
    "contentHash",
    "disposition",
    "logicalId",
    "publicationVersion",
    "sourceKind",
    "sourceRowId",
    "sourceVersion",
    "trustedGovernanceHash",
    "trustedPublicRecordId",
    "trustedRoute",
  ].sort();
  const counts = plan.counts as Record<string, unknown>;
  const trustedKeys = [
    "contentHash",
    "governanceHash",
    "logicalId",
    "publicationVersion",
    "publicRecordId",
    "route",
  ].sort();
  const snapshotsByLogicalId = new Map(trustedSnapshots.map((snapshot) => [String(snapshot.logicalId), snapshot]));
  if (
    dispositions.length !== plan.expectedRecordCount ||
    new Set(sourceIds).size !== dispositions.length ||
    dispositions.some((item, index) => {
      if (index === 0) return false;
      const previous = dispositions[index - 1]!;
      const left = `${String(previous.logicalId)}\u0000${String(previous.sourceKind)}\u0000${String(previous.sourceRowId)}`;
      const right = `${String(item.logicalId)}\u0000${String(item.sourceKind)}\u0000${String(item.sourceRowId)}`;
      return left >= right;
    }) ||
    trustedSnapshots.length !== plan.expectedGroupCount ||
    snapshotsByLogicalId.size !== trustedSnapshots.length ||
    trustedSnapshots.some(
      (snapshot, index) =>
        JSON.stringify(Object.keys(snapshot).sort()) !== JSON.stringify(trustedKeys) ||
        typeof snapshot.logicalId !== "string" ||
        !LOGICAL_ID.test(snapshot.logicalId) ||
        typeof snapshot.publicRecordId !== "string" ||
        snapshot.publicRecordId !== snapshot.logicalId ||
        typeof snapshot.route !== "string" ||
        !snapshot.route.startsWith("/") ||
        !SHA256.test(String(snapshot.contentHash)) ||
        !SHA256.test(String(snapshot.publicationVersion)) ||
        !SHA256.test(String(snapshot.governanceHash)) ||
        (index > 0 && String(trustedSnapshots[index - 1]!.logicalId) >= String(snapshot.logicalId)),
    ) ||
    batchSize < 1 ||
    batchSize > 500 ||
    Number(plan.expectedRecordCount) < 1 ||
    Number(plan.expectedRecordCount) > 5000 ||
    Number(plan.expectedGroupCount) < 1 ||
    Number(plan.expectedGroupCount) > Number(plan.expectedRecordCount) ||
    Number(plan.batchCount) < 1 ||
    Number(plan.batchCount) > 5000 ||
    plan.batchCount !== Math.ceil(Number(plan.expectedRecordCount) / batchSize) ||
    JSON.stringify(Object.keys(counts).sort()) !==
      JSON.stringify(["adopt", "identicalDuplicate", "retire", "total"].sort()) ||
    counts.total !== dispositions.length ||
    counts.adopt !== dispositions.filter((item) => item.disposition === "adopt").length ||
    counts.retire !== dispositions.filter((item) => item.disposition === "retire").length ||
    counts.identicalDuplicate !== dispositions.filter((item) => item.disposition === "identical_duplicate").length ||
    dispositions.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(dispositionKeys) ||
        typeof item.logicalId !== "string" ||
        !LOGICAL_ID.test(item.logicalId) ||
        typeof item.disposition !== "string" ||
        !allowed.has(item.disposition) ||
        !["service", "form", "medication", "differential", "presentation"].includes(String(item.sourceKind)) ||
        !UUID.test(String(item.sourceRowId)) ||
        typeof item.sourceVersion !== "string" ||
        !SOURCE_VERSION.test(item.sourceVersion) ||
        !SHA256.test(String(item.contentHash)) ||
        !SHA256.test(String(item.publicationVersion)) ||
        !SHA256.test(String(item.trustedGovernanceHash)) ||
        typeof item.trustedPublicRecordId !== "string" ||
        typeof item.trustedRoute !== "string" ||
        !item.trustedRoute.startsWith("/") ||
        !snapshotsByLogicalId.has(String(item.logicalId)),
    )
  ) {
    throw new Error("Reviewed reconciliation plan is not an exact unique population.");
  }
  for (const snapshot of trustedSnapshots) {
    const logicalId = String(snapshot.logicalId);
    const group = dispositions.filter((item) => item.logicalId === logicalId);
    const matchesTrusted = (item: Record<string, unknown>) =>
      item.contentHash === snapshot.contentHash &&
      item.publicationVersion === snapshot.publicationVersion &&
      item.trustedGovernanceHash === snapshot.governanceHash &&
      item.trustedPublicRecordId === snapshot.publicRecordId &&
      item.trustedRoute === snapshot.route;
    if (
      group.filter((item) => item.disposition === "adopt").length !== 1 ||
      !group.filter((item) => item.disposition !== "retire").every(matchesTrusted) ||
      group.filter((item) => item.disposition === "retire").some(matchesTrusted)
    ) {
      throw new Error("Reviewed reconciliation dispositions do not match the trusted snapshot group.");
    }
  }
  if (
    plan.trustedSnapshotDigest !==
    reconciliationHash({ version: "site-content-trusted-snapshot-v1", records: trustedSnapshots })
  ) {
    throw new Error("Reviewed reconciliation trusted snapshot digest does not match its exact population.");
  }
  const governed = { ...plan };
  delete governed.planDigest;
  if (plan.planDigest !== reconciliationHash(governed)) {
    throw new Error("Reviewed reconciliation plan digest does not match its immutable fields.");
  }
}
