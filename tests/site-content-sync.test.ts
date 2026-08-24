import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  it("binds a retirement tombstone to the retirement publication event", () => {
    const removed = sourceRecord("medications:removed", "Retired text");
    const retirementPublicationId = "22222222-2222-4222-8222-222222222222";
    const existing = {
      logicalId: removed.record.logicalId,
      targetPublicationId: removed.record.publicationVersion,
      publicationFingerprint: removed.record.publicationVersion,
      contentHash: removed.record.contentHash,
      governanceFingerprint: removed.governanceFingerprint,
      lineageFingerprint: removed.lineageFingerprint,
      publicMetadataFingerprint: removed.publicMetadataFingerprint,
      normalizedText: removed.record.body,
      documentId: removed.documentId,
      chunkId: removed.chunkId,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      embeddingFingerprint: "model-v1",
      embedding: [0.1],
      tombstone: false,
    };

    const plan = planSiteContentSync({
      ...input([]),
      existingReleaseRecords: [existing],
      retirementTargets: [{ logicalId: removed.record.logicalId, targetPublicationId: retirementPublicationId }],
    } as Parameters<typeof planSiteContentSync>[0]);

    expect(plan.tombstones).toEqual([
      expect.objectContaining({
        logicalId: removed.record.logicalId,
        targetPublicationId: retirementPublicationId,
        tombstone: true,
      }),
    ]);
  });

  it("classifies a faithfully loaded static null publication target as unchanged", () => {
    const base = input([]);
    const source = base.staticRecords[0]!;
    const existing = {
      logicalId: source.record.logicalId,
      targetPublicationId: null,
      publicationFingerprint: source.record.publicationVersion,
      contentHash: source.record.contentHash,
      governanceFingerprint: source.governanceFingerprint,
      lineageFingerprint: source.lineageFingerprint,
      publicMetadataFingerprint: source.publicMetadataFingerprint,
      normalizedText: source.record.body,
      documentId: source.documentId,
      chunkId: source.chunkId,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      embeddingFingerprint: "model-v1",
      embedding: [0.1],
      tombstone: false,
    };
    const plan = planSiteContentSync({ ...base, existingReleaseRecords: [existing] } as Parameters<
      typeof planSiteContentSync
    >[0]);

    expect(plan.unchanged.map((record) => record.logicalId)).toEqual([source.record.logicalId]);
    expect(plan.changed).toEqual([]);
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

  it("keeps the dynamic population digest embedding-free while release identity remains embedding-bound", () => {
    const source = sourceRecord("medications:alpha", "Alpha medication");
    const first = planSiteContentSync(input([source]));
    const second = planSiteContentSync({
      ...input([source]),
      embedding: { model: "text-embedding-4", dimensions: 1536, fingerprint: "model-v2" },
    });

    expect(first.dynamicStateDigest).toBe(second.dynamicStateDigest);
    expect(first.releaseDigest).not.toBe(second.releaseDigest);
  });

  it("rejects embedding dimensions that cannot fit the physical release vector", () => {
    const source = sourceRecord("medications:alpha", "Alpha medication");
    expect(() =>
      planSiteContentSync({
        ...input([source]),
        embedding: { model: "text-embedding-3-large", dimensions: 3072, fingerprint: "model-v2" },
      }),
    ).toThrow(/1536|dimension/i);
  });

  it("uses a distinct deterministic physical release id for byte-identical later epochs", () => {
    const source = sourceRecord("medications:alpha", "Alpha medication");
    const first = planSiteContentSync(input([source]));
    const repeated = planSiteContentSync({ ...input([source]), targetChangeEpoch: "8", generationId: "generation-8" });
    const firstReleaseId = (first as typeof first & { releaseId?: string }).releaseId;
    const repeatedReleaseId = (repeated as typeof repeated & { releaseId?: string }).releaseId;

    expect(first.releaseDigest).toBe(repeated.releaseDigest);
    expect(firstReleaseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(repeatedReleaseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(firstReleaseId).not.toBe(repeatedReleaseId);
    expect(planSiteContentSync(input([source]))).toMatchObject({ releaseId: firstReleaseId });
  });

  it("does not create --out before every guarded write authorization succeeds", () => {
    const directory = mkdtempSync(join(tmpdir(), "site-content-write-guard-"));
    const output = join(directory, "plan.json");
    try {
      const result = spawnSync(
        process.execPath,
        [
          "scripts/run-tsx.mjs",
          "scripts/sync-site-content-corpus.ts",
          "--manifest",
          "tests/fixtures/site-content/static-manifest-baseline.json",
          "--dynamic",
          "tests/fixtures/site-content/dynamic-empty.json",
          "--write",
          "--project-ref",
          "project-ref",
          "--expected-state-digest",
          "0".repeat(64),
          "--recovery-evidence",
          "tests/fixtures/site-content/dynamic-empty.json",
          "--out",
          output,
        ],
        { encoding: "utf8" },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/confirm-project-ref|guarded write authorization/i);
      expect(existsSync(output)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
