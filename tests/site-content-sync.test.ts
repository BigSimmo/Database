import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

import { createSiteContentRecord, buildStaticSiteContentManifest } from "@/lib/site-content/site-content-manifest";
import { planSiteContentSync, type SiteContentSyncSourceRecord } from "@/lib/site-content/site-content-sync";

const SHA = "a".repeat(40);

function sourceRecord(
  logicalId: string,
  body: string,
  producerClass: "static_repository" | "dynamic_registry" = "dynamic_registry",
): SiteContentSyncSourceRecord {
  const domain = producerClass === "static_repository" ? "dictionary" : "medications";
  const slug = logicalId.split(":").slice(1).join(":");
  const record = createSiteContentRecord({
    version: "site-content-record-v1",
    logicalId,
    producerClass,
    domain,
    route: producerClass === "static_repository" ? `/dictionary/${slug}` : `/medications/${slug}`,
    title: slug,
    body,
    sourceRole: "clinical_reference",
    access: "public",
    validationStatus: "approved",
    sourceStatus: "current",
    sourceLineage: [{ sourceId: `source:${slug}`, sourceHash: "b".repeat(64), relationship: "references" }],
  });
  return {
    record,
    targetPublicationId: producerClass === "dynamic_registry" ? record.publicationVersion : undefined,
    documentId: `00000000-0000-4000-8000-${slug.padEnd(12, "0").slice(0, 12)}`,
    chunkId: `10000000-0000-4000-8000-${slug.padEnd(12, "0").slice(0, 12)}`,
    publicMetadataFingerprint: "metadata-v1",
    governanceFingerprint: record.validationStatus,
    lineageFingerprint: record.sourceLineage[0]!.sourceHash,
  };
}

function input(dynamicRecords: SiteContentSyncSourceRecord[]) {
  const staticRecord = sourceRecord("dictionary:alpha", "Alpha definition", "static_repository");
  const manifest = buildStaticSiteContentManifest([staticRecord.record], {
    gitSha: SHA,
    registryVersion: "site-content-registry-v1",
    generatedAt: "2026-08-24T00:00:00.000Z",
  });
  return {
    manifest,
    staticRecords: [staticRecord],
    dynamicRecords,
    existingReleaseRecords: [],
    registryVersion: "site-content-registry-v1",
    targetChangeEpoch: "7",
    generationId: "generation-7",
    embedding: { model: "text-embedding-3-small", dimensions: 1536, fingerprint: "model-v1" },
  } as const;
}

describe("site-content synchronization planning", () => {
  it("keeps the CLI offline-by-default and byte-deterministic for equal inputs", () => {
    const args = [
      "scripts/run-tsx.mjs",
      "scripts/sync-site-content-corpus.ts",
      "--manifest",
      "tests/fixtures/site-content/static-manifest-baseline.json",
      "--dynamic",
      "tests/fixtures/site-content/dynamic-empty.json",
      "--dry-run",
    ];
    const first = execFileSync("node", args, { encoding: "utf8" });
    const second = execFileSync("node", args, { encoding: "utf8" });
    expect(first).toBe(second);
    expect(JSON.parse(first)).toMatchObject({
      version: "site-content-sync-plan-v1",
      dryRun: true,
      counts: { added: 1079, changed: 0, tombstones: 0 },
    });
  });

  it("is deterministic across input order and excludes actor/lease noise from digests", () => {
    const a = sourceRecord("medications:alpha", "Alpha medication");
    const b = sourceRecord("medications:beta", "Beta medication");
    const first = planSiteContentSync({ ...input([b, a]), actorId: "actor-a", leaseToken: "lease-a" });
    const second = planSiteContentSync({ ...input([a, b]), actorId: "actor-b", leaseToken: "lease-b" });

    expect(first.releaseDigest).toBe(second.releaseDigest);
    expect(first.dynamicStateDigest).toBe(second.dynamicStateDigest);
    expect(first.added.map((entry) => entry.logicalId)).toEqual([
      "dictionary:alpha",
      "medications:alpha",
      "medications:beta",
    ]);
  });

  it("reuses only exact embeddings, stages metadata-only changes, and tombstones deletions", () => {
    const unchanged = sourceRecord("medications:unchanged", "Same text");
    const metadataChanged = {
      ...sourceRecord("medications:metadata", "Same reusable text"),
      publicMetadataFingerprint: "metadata-v2",
    };
    const changed = sourceRecord("medications:changed", "New text");
    const removed = sourceRecord("medications:removed", "Retired text");
    const existing = [unchanged, metadataChanged, changed, removed].map((entry) => ({
      logicalId: entry.record.logicalId,
      targetPublicationId: entry.record.publicationVersion,
      publicationFingerprint: entry.record.publicationVersion,
      contentHash: entry.record.contentHash,
      governanceFingerprint: entry.governanceFingerprint,
      lineageFingerprint: entry.lineageFingerprint,
      publicMetadataFingerprint: "metadata-v1",
      normalizedText: entry.record.body,
      documentId: entry.documentId,
      chunkId: entry.chunkId,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      embeddingFingerprint: "model-v1",
      embedding: [0.1, 0.2],
      tombstone: false,
    }));
    existing[2] = { ...existing[2]!, contentHash: "c".repeat(64), normalizedText: "Old text" };

    const plan = planSiteContentSync({
      ...input([changed, metadataChanged, unchanged]),
      existingReleaseRecords: existing,
    });

    expect(plan.unchanged.map((entry) => entry.logicalId)).toEqual(["medications:unchanged"]);
    expect(plan.changed.map((entry) => [entry.logicalId, entry.reuseEmbedding])).toEqual([
      ["medications:changed", false],
      ["medications:metadata", true],
    ]);
    expect(plan.tombstones.map((entry) => entry.logicalId)).toEqual(["medications:removed"]);
  });

  it("changes the release digest for public governance and lineage changes", () => {
    const base = sourceRecord("medications:alpha", "Alpha medication");
    const governance = { ...base, governanceFingerprint: "locally_reviewed" };
    const lineage = { ...base, lineageFingerprint: "d".repeat(64) };

    expect(planSiteContentSync(input([base])).releaseDigest).not.toBe(
      planSiteContentSync(input([governance])).releaseDigest,
    );
    expect(planSiteContentSync(input([base])).releaseDigest).not.toBe(
      planSiteContentSync(input([lineage])).releaseDigest,
    );
  });
});
