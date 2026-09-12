import { createHash } from "node:crypto";

import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";
import { siteContentProducerRegistry } from "@/lib/site-content/site-content-registry";
import type { SiteContentDomain } from "@/lib/types";

export type StaticSiteContentManifest = {
  version: "clinical-kb-site-static-manifest-v1";
  gitSha: string;
  registryVersion: string;
  generatedAt: string;
  records: Array<{
    logicalId: string;
    domain: SiteContentDomain;
    route: string;
    contentHash: string;
    lineageDigest: string;
    validationStatus: SiteContentRecord["validationStatus"];
    sourceStatus: SiteContentRecord["sourceStatus"];
    eligible: boolean;
    exclusionReason: string | null;
  }>;
  staticManifestDigest: string;
};

export type SiteContentManifestMetadata = {
  gitSha: string;
  registryVersion: string;
  generatedAt?: string;
};

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const LOGICAL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$/;
const protectedDerivedSourcePattern = /(^|[:/_-])(etg|amh|healthdirect)([:/_-]|$)/i;
const staticManifestKeys = ["generatedAt", "gitSha", "records", "registryVersion", "staticManifestDigest", "version"];
const staticManifestRecordKeys = [
  "contentHash",
  "domain",
  "eligible",
  "exclusionReason",
  "lineageDigest",
  "logicalId",
  "route",
  "sourceStatus",
  "validationStatus",
];
const validationStatuses = new Set<SiteContentRecord["validationStatus"]>([
  "unverified",
  "locally_reviewed",
  "approved",
]);
const sourceStatuses = new Set<SiteContentRecord["sourceStatus"]>(["current", "review_due", "outdated", "unknown"]);

const auditIdentifierKeys = new Set([
  "actorid",
  "authorid",
  "editorid",
  "ownerid",
  "creatorid",
  "updaterid",
  "publisherid",
  "reviewerid",
  "retireeid",
  "createdby",
  "updatedby",
  "publishedby",
  "reviewedby",
  "retiredby",
]);

export function canonicalSiteContentJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Site-content canonical JSON cannot encode non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalSiteContentJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort(compareCanonicalSiteContentIdentifiers)
      .filter((key) => object[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalSiteContentJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error(`Site-content canonical JSON cannot encode ${typeof value}.`);
}

export function siteContentValueHash(value: unknown): string {
  return createHash("sha256").update(canonicalSiteContentJson(value)).digest("hex");
}

export function canonicalSiteContentText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t\f\v ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Locale/ICU-independent code-unit ordering over normalized identifiers. */
export function compareCanonicalSiteContentIdentifiers(left: string, right: string): number {
  const normalizedLeft = canonicalSiteContentText(left).normalize("NFC");
  const normalizedRight = canonicalSiteContentText(right).normalize("NFC");
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertNoAuditIdentifiers(value: unknown, path = "record") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoAuditIdentifiers(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (auditIdentifierKeys.has(normalized)) {
      throw new Error(`Site-content records cannot contain audit/editor identifier ${path}.${key}.`);
    }
    assertNoAuditIdentifiers(child, `${path}.${key}`);
  }
}

function assertCanonicalRoute(route: string) {
  if (!route.startsWith("/") || route.startsWith("//") || /[\r\n]/.test(route)) {
    throw new Error(`Site-content route must be a canonical root-relative route: ${route}`);
  }
  const parsed = new URL(route, "https://clinical-kb.invalid");
  if (parsed.origin !== "https://clinical-kb.invalid" || parsed.hash || parsed.pathname !== route.split("?")[0]) {
    throw new Error(`Site-content route is invalid or non-canonical: ${route}`);
  }
}

function assertExactObjectKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  const actual = Object.keys(value).sort(compareCanonicalSiteContentIdentifiers);
  if (
    canonicalSiteContentJson(actual) !==
    canonicalSiteContentJson([...expected].sort(compareCanonicalSiteContentIdentifiers))
  ) {
    throw new Error(`${label} has missing or unsupported fields.`);
  }
}

function normalizedLineage(lineage: SiteContentRecord["sourceLineage"]) {
  return lineage
    .map((entry) => ({
      sourceId: canonicalSiteContentText(entry.sourceId),
      sourceHash: entry.sourceHash.toLowerCase(),
      relationship: entry.relationship,
    }))
    .sort(
      (left, right) =>
        compareCanonicalSiteContentIdentifiers(left.sourceId, right.sourceId) ||
        compareCanonicalSiteContentIdentifiers(left.sourceHash, right.sourceHash) ||
        compareCanonicalSiteContentIdentifiers(left.relationship, right.relationship),
    );
}

function contentHashFor(record: Pick<SiteContentRecord, "title" | "body">) {
  return siteContentValueHash({ title: record.title, body: record.body });
}

type SiteContentPublicationProjection = Omit<SiteContentRecord, "contentHash" | "publicationVersion">;

function publicationVersionFor(record: SiteContentPublicationProjection | SiteContentRecord) {
  const {
    contentHash: _contentHash,
    publicationVersion: _publicationVersion,
    ...projection
  } = record as SiteContentRecord;
  void _contentHash;
  void _publicationVersion;
  return siteContentValueHash(projection);
}

export function createSiteContentRecord(
  input: SiteContentPublicationProjection & { contentHash?: never; publicationVersion?: never },
): SiteContentRecord {
  assertNoAuditIdentifiers(input);
  const sourceLineage = normalizedLineage(input.sourceLineage);
  for (const source of sourceLineage) {
    if (!source.sourceId || !SHA256_PATTERN.test(source.sourceHash)) {
      throw new Error(`Site-content source lineage is invalid for ${input.logicalId}.`);
    }
    if (source.relationship === "derived_from" && protectedDerivedSourcePattern.test(source.sourceId)) {
      throw new Error(`Protected/link-only source content cannot be derived into ${input.logicalId}.`);
    }
  }
  const record: SiteContentPublicationProjection = {
    ...input,
    logicalId: input.logicalId.trim(),
    route: input.route.trim(),
    title: canonicalSiteContentText(input.title),
    body: canonicalSiteContentText(input.body),
    sourceLineage,
  };
  return {
    ...record,
    publicationVersion: publicationVersionFor(record),
    contentHash: contentHashFor(record),
  };
}

function validateRecord(record: SiteContentRecord) {
  assertNoAuditIdentifiers(record);
  if (record.version !== "site-content-record-v1") throw new Error(`Unsupported site-content record version.`);
  if (!LOGICAL_ID_PATTERN.test(record.logicalId) || !record.logicalId.startsWith(`${record.domain}:`)) {
    throw new Error(`Invalid site-content logicalId ${record.logicalId} for domain ${record.domain}.`);
  }
  if (record.access !== "public") throw new Error(`Site-content record ${record.logicalId} is not public.`);
  if (!record.title || !record.body) {
    throw new Error(`Site-content record ${record.logicalId} has empty required content.`);
  }
  if (
    record.title !== canonicalSiteContentText(record.title) ||
    record.body !== canonicalSiteContentText(record.body)
  ) {
    throw new Error(`Site-content record ${record.logicalId} is not canonically whitespace-normalized.`);
  }
  assertCanonicalRoute(record.route);
  const producer = siteContentProducerRegistry.find(
    (candidate) => candidate.domain === record.domain && candidate.producerClass === record.producerClass,
  );
  if (!producer) {
    throw new Error(`Site-content record ${record.logicalId} has no registered producer.`);
  }
  if (!producer.allowedRoles.includes(record.sourceRole)) {
    throw new Error(`Site-content record ${record.logicalId} uses a source role not allowed by its producer.`);
  }
  const logicalParts = record.logicalId.split(":");
  const subkind = record.domain === "differentials" ? logicalParts[1] : null;
  const slug = record.domain === "differentials" ? logicalParts.slice(2).join(":") : logicalParts.slice(1).join(":");
  let expectedRoute: string;
  try {
    expectedRoute = producer.routeBuilder(slug, subkind);
  } catch {
    throw new Error(`Site-content record ${record.logicalId} does not identify a registered public route.`);
  }
  if (record.route !== expectedRoute) {
    throw new Error(`Site-content record ${record.logicalId} route does not match its canonical producer route.`);
  }
  const expectedHash = contentHashFor(record);
  if (record.contentHash !== expectedHash) {
    throw new Error(`Site-content record ${record.logicalId} has a stale or invalid contentHash.`);
  }
  const lineage = normalizedLineage(record.sourceLineage);
  if (canonicalSiteContentJson(lineage) !== canonicalSiteContentJson(record.sourceLineage)) {
    throw new Error(`Site-content record ${record.logicalId} has non-canonical lineage order.`);
  }
  for (const source of lineage) {
    if (!source.sourceId || !SHA256_PATTERN.test(source.sourceHash)) {
      throw new Error(`Site-content source lineage is invalid for ${record.logicalId}.`);
    }
    if (source.relationship === "derived_from" && protectedDerivedSourcePattern.test(source.sourceId)) {
      throw new Error(`Protected/link-only source content cannot be derived into ${record.logicalId}.`);
    }
  }
  if (!SHA256_PATTERN.test(record.publicationVersion) || record.publicationVersion !== publicationVersionFor(record)) {
    throw new Error(`Site-content record ${record.logicalId} has a stale or invalid publicationVersion.`);
  }
}

export function validateSiteContentRecords(records: readonly SiteContentRecord[]): readonly SiteContentRecord[] {
  const logicalIds = new Set<string>();
  for (const record of records) {
    validateRecord(record);
    if (logicalIds.has(record.logicalId)) throw new Error(`Duplicate logicalId: ${record.logicalId}`);
    logicalIds.add(record.logicalId);
  }
  return records;
}

function eligibility(record: SiteContentRecord) {
  if (record.validationStatus === "unverified") {
    return { eligible: false, exclusionReason: "validation_unverified" } as const;
  }
  // `review_due` remains in force under the answer-state contract. It is
  // eligible only after local review/approval; `outdated` is superseded.
  if (record.sourceStatus === "outdated") {
    return { eligible: false, exclusionReason: "source_outdated" } as const;
  }
  if (record.sourceStatus === "unknown") {
    return { eligible: false, exclusionReason: "source_status_unknown" } as const;
  }
  return { eligible: true, exclusionReason: null } as const;
}

function computeStaticManifestDigest(registryVersion: string, records: StaticSiteContentManifest["records"]): string {
  return siteContentValueHash({
    version: "clinical-kb-site-static-manifest-v1",
    registryVersion,
    records,
  });
}

export function validateStaticSiteContentManifest(
  value: unknown,
  options: { expectedRegistryVersion?: string } = {},
): StaticSiteContentManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Static site-content manifest must be an object.");
  }
  const manifest = value as Record<string, unknown>;
  assertExactObjectKeys(manifest, staticManifestKeys, "Static site-content manifest");
  if (manifest.version !== "clinical-kb-site-static-manifest-v1") {
    throw new Error("Unsupported static site-content manifest version.");
  }
  if (typeof manifest.gitSha !== "string" || !/^[0-9a-f]{40}$/i.test(manifest.gitSha)) {
    throw new Error("Static site-content manifest gitSha must be a full Git SHA.");
  }
  if (typeof manifest.registryVersion !== "string" || !manifest.registryVersion.trim()) {
    throw new Error("Static site-content manifest registryVersion is required.");
  }
  if (options.expectedRegistryVersion && manifest.registryVersion !== options.expectedRegistryVersion) {
    throw new Error(
      `Static site-content manifest registryVersion ${manifest.registryVersion} does not match ${options.expectedRegistryVersion}.`,
    );
  }
  if (
    typeof manifest.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(manifest.generatedAt)) ||
    new Date(manifest.generatedAt).toISOString() !== manifest.generatedAt
  ) {
    throw new Error("Static site-content manifest generatedAt must be a canonical ISO timestamp.");
  }
  if (!Array.isArray(manifest.records)) throw new Error("Static site-content manifest records must be an array.");

  const staticProducers = siteContentProducerRegistry.filter(
    (producer) => producer.producerClass === "static_repository",
  );
  const logicalIds = new Set<string>();
  let previousLogicalId: string | null = null;
  const records = manifest.records.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Static site-content manifest record ${index} must be an object.`);
    }
    const record = value as Record<string, unknown>;
    assertExactObjectKeys(record, staticManifestRecordKeys, `Static site-content manifest record ${index}`);
    if (typeof record.logicalId !== "string" || !LOGICAL_ID_PATTERN.test(record.logicalId)) {
      throw new Error(`Static site-content manifest record ${index} has an invalid logicalId.`);
    }
    if (logicalIds.has(record.logicalId)) throw new Error(`Duplicate logicalId: ${record.logicalId}`);
    if (
      previousLogicalId !== null &&
      compareCanonicalSiteContentIdentifiers(previousLogicalId, record.logicalId) >= 0
    ) {
      throw new Error("Static site-content manifest records are not in canonical logicalId order.");
    }
    logicalIds.add(record.logicalId);
    previousLogicalId = record.logicalId;

    const producer = staticProducers.find((candidate) => candidate.domain === record.domain);
    if (!producer || !record.logicalId.startsWith(`${producer.domain}:`)) {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid domain.`);
    }
    if (typeof record.route !== "string") {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid route.`);
    }
    assertCanonicalRoute(record.route);
    const slug = record.logicalId.slice(record.logicalId.indexOf(":") + 1);
    if (record.route !== producer.routeBuilder(slug, null)) {
      throw new Error(`Static site-content manifest record ${record.logicalId} route is not canonical.`);
    }
    if (typeof record.contentHash !== "string" || !SHA256_PATTERN.test(record.contentHash)) {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid contentHash.`);
    }
    if (typeof record.lineageDigest !== "string" || !SHA256_PATTERN.test(record.lineageDigest)) {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid lineageDigest.`);
    }
    if (!validationStatuses.has(record.validationStatus as SiteContentRecord["validationStatus"])) {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid validationStatus.`);
    }
    if (!sourceStatuses.has(record.sourceStatus as SiteContentRecord["sourceStatus"])) {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid sourceStatus.`);
    }
    if (typeof record.eligible !== "boolean") {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid eligible flag.`);
    }
    if (record.exclusionReason !== null && typeof record.exclusionReason !== "string") {
      throw new Error(`Static site-content manifest record ${record.logicalId} has an invalid exclusionReason.`);
    }
    const expectedEligibility = eligibility({
      validationStatus: record.validationStatus,
      sourceStatus: record.sourceStatus,
    } as SiteContentRecord);
    if (
      record.eligible !== expectedEligibility.eligible ||
      record.exclusionReason !== expectedEligibility.exclusionReason
    ) {
      throw new Error(`Static site-content manifest record ${record.logicalId} has inconsistent eligibility.`);
    }
    return record as StaticSiteContentManifest["records"][number];
  });
  if (typeof manifest.staticManifestDigest !== "string" || !SHA256_PATTERN.test(manifest.staticManifestDigest)) {
    throw new Error("Static site-content manifest has an invalid staticManifestDigest.");
  }
  const expectedDigest = computeStaticManifestDigest(manifest.registryVersion, records);
  if (manifest.staticManifestDigest !== expectedDigest) {
    throw new Error("Static site-content manifest digest does not match its governed fields.");
  }
  return { ...manifest, records } as StaticSiteContentManifest;
}

export function buildStaticSiteContentManifest(
  records: readonly SiteContentRecord[],
  metadata: SiteContentManifestMetadata,
): StaticSiteContentManifest {
  validateSiteContentRecords(records);
  if (!metadata.registryVersion.trim()) throw new Error("Site-content registryVersion is required.");
  if (!/^[0-9a-f]{40}$/i.test(metadata.gitSha)) throw new Error("Site-content gitSha must be a full Git SHA.");

  const staticRecords = records
    .filter((record) => record.producerClass === "static_repository")
    .sort((left, right) => compareCanonicalSiteContentIdentifiers(left.logicalId, right.logicalId))
    .map((record) => ({
      logicalId: record.logicalId,
      domain: record.domain,
      route: record.route,
      contentHash: record.contentHash,
      lineageDigest: siteContentValueHash(record.sourceLineage),
      validationStatus: record.validationStatus,
      sourceStatus: record.sourceStatus,
      ...eligibility(record),
    }));

  const staticManifestDigest = computeStaticManifestDigest(metadata.registryVersion, staticRecords);

  return {
    version: "clinical-kb-site-static-manifest-v1",
    gitSha: metadata.gitSha.toLowerCase(),
    registryVersion: metadata.registryVersion,
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    records: staticRecords,
    staticManifestDigest,
  };
}
