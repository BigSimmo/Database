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
      .sort()
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

function normalizedLineage(lineage: SiteContentRecord["sourceLineage"]) {
  return lineage
    .map((entry) => ({
      sourceId: canonicalSiteContentText(entry.sourceId),
      sourceHash: entry.sourceHash.toLowerCase(),
      relationship: entry.relationship,
    }))
    .sort(
      (left, right) =>
        left.sourceId.localeCompare(right.sourceId) ||
        left.sourceHash.localeCompare(right.sourceHash) ||
        left.relationship.localeCompare(right.relationship),
    );
}

function contentHashFor(record: Pick<SiteContentRecord, "title" | "body">) {
  return siteContentValueHash({ title: record.title, body: record.body });
}

export function createSiteContentRecord(
  input: Omit<SiteContentRecord, "contentHash"> & { contentHash?: never },
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
  const record: Omit<SiteContentRecord, "contentHash"> = {
    ...input,
    logicalId: input.logicalId.trim(),
    route: input.route.trim(),
    title: canonicalSiteContentText(input.title),
    body: canonicalSiteContentText(input.body),
    publicationVersion: input.publicationVersion.trim(),
    sourceLineage,
  };
  return { ...record, contentHash: contentHashFor(record) };
}

function validateRecord(record: SiteContentRecord) {
  assertNoAuditIdentifiers(record);
  if (record.version !== "site-content-record-v1") throw new Error(`Unsupported site-content record version.`);
  if (!LOGICAL_ID_PATTERN.test(record.logicalId) || !record.logicalId.startsWith(`${record.domain}:`)) {
    throw new Error(`Invalid site-content logicalId ${record.logicalId} for domain ${record.domain}.`);
  }
  if (record.access !== "public") throw new Error(`Site-content record ${record.logicalId} is not public.`);
  if (!record.title || !record.body || !record.publicationVersion) {
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
  if (record.sourceStatus === "outdated") {
    return { eligible: false, exclusionReason: "source_outdated" } as const;
  }
  if (record.sourceStatus === "unknown") {
    return { eligible: false, exclusionReason: "source_status_unknown" } as const;
  }
  return { eligible: true, exclusionReason: null } as const;
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
    .sort((left, right) => left.logicalId.localeCompare(right.logicalId))
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

  const staticManifestDigest = siteContentValueHash({
    version: "clinical-kb-site-static-manifest-v1",
    registryVersion: metadata.registryVersion,
    records: staticRecords,
  });

  return {
    version: "clinical-kb-site-static-manifest-v1",
    gitSha: metadata.gitSha.toLowerCase(),
    registryVersion: metadata.registryVersion,
    generatedAt: metadata.generatedAt ?? new Date().toISOString(),
    records: staticRecords,
    staticManifestDigest,
  };
}
