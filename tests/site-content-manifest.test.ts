import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeJsonAtomically } from "../scripts/build-site-content-manifest";

import { calculatorRecordHref } from "@/components/calculators/calculator-routes";
import { THERAPY_CATALOGUE_ASSETS } from "@/components/therapy-compass/data/generated-assets";
import type { Therapy } from "@/components/therapy-compass/data/types";
import therapiesSourceJson from "@/data/therapies-source.json";
import {
  allSiteContentRecords,
  buildDynamicSiteContentProjections,
  staticSiteContentRecords,
  therapySiteContentRecord,
} from "@/lib/site-content/adapters";
import { buildDefaultDifferentialRows } from "@/lib/differential-fixtures";
import type { DifferentialRecordRow } from "@/lib/differential-records";
import { buildDefaultMedicationRows } from "@/lib/medication-fixtures";
import type { MedicationRecordRow } from "@/lib/medication-records";
import { buildDefaultFormRows, buildDefaultServiceRows } from "@/lib/registry-fixtures";
import {
  adoptCanonicalRegistryProjection,
  buildRegistryReconciliationReport,
  canCarryForwardRegistryEmbedding,
  canonicalRegistrySiteContentProjection,
  registryEntryToSiteContentRecord,
} from "@/lib/site-content/adapters/registry";
import {
  buildStaticSiteContentManifest,
  compareCanonicalSiteContentIdentifiers,
  createSiteContentRecord,
  siteContentValueHash,
  validateSiteContentRecords,
} from "@/lib/site-content/site-content-manifest";
import { SITE_CONTENT_REGISTRY_VERSION } from "@/lib/site-content/site-content-registry";
import { publicKnowledgeToolCatalogRecords } from "@/lib/tools-catalog";
import {
  clinicalRegistryRowsToCorpusEntries,
  differentialRowsToCorpusEntries,
  medicationRowsToCorpusEntries,
  registryCorpusChunkId,
  registryCorpusDocumentId,
  type RegistryCorpusEntry,
} from "@/lib/registry-corpus";
import type { RegistryRecordRow } from "@/lib/registry-records";
import type { SiteContentRecord } from "@/lib/site-content/site-content-contracts";
import type { SiteContentDomain } from "@/lib/types";

const metadata = {
  gitSha: "1111111111111111111111111111111111111111",
  registryVersion: SITE_CONTENT_REGISTRY_VERSION,
  generatedAt: "2026-08-23T00:00:00.000Z",
};

const baselinePath = "tests/fixtures/site-content/static-manifest-baseline.json";

function runManifestCli(args: readonly string[]) {
  return spawnSync(process.execPath, ["scripts/run-tsx.mjs", "scripts/build-site-content-manifest.ts", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function persistedRow<T>(row: object, id: string): T {
  return {
    ...row,
    id,
    created_at: "2026-08-23T00:00:00.000Z",
    updated_at: "2026-08-23T00:00:00.000Z",
    last_reviewed_at: "2026-08-23T00:00:00.000Z",
    review_due_at: "2027-08-23T00:00:00.000Z",
  } as T;
}

function ownerlessPersistedRow<T>(row: object, id: string): T {
  return persistedRow({ ...row, owner_id: null }, id);
}

function record(
  logicalId: string,
  overrides: Partial<Omit<SiteContentRecord, "contentHash" | "publicationVersion">> = {},
): SiteContentRecord {
  const domain = logicalId.split(":")[0] as SiteContentDomain;
  const suffix = logicalId.split(":").slice(1).join(":");
  const routeByDomain: Partial<Record<SiteContentDomain, string>> = {
    dsm: `/dsm/diagnoses/${suffix}`,
    factsheets: `/factsheets/${suffix}`,
    services: `/services/${suffix}`,
  };
  const roleByDomain: Partial<Record<SiteContentDomain, SiteContentRecord["sourceRole"]>> = {
    services: "service_directory",
    forms: "form_reference",
    calculators: "tool_reference",
    tools: "tool_reference",
  };
  return createSiteContentRecord({
    version: "site-content-record-v1",
    logicalId,
    producerClass: "static_repository",
    domain,
    route: routeByDomain[domain] ?? `/${domain}/${suffix}`,
    title: logicalId,
    body: "First line\nSecond line",
    sourceRole: roleByDomain[domain] ?? "clinical_reference",
    access: "public",
    validationStatus: "locally_reviewed",
    sourceStatus: "current",
    sourceLineage: [],
    ...overrides,
  });
}

function canonicalPublicSnapshot(publicRecordId: string, record: SiteContentRecord) {
  return {
    version: "clinical-kb-site-canonical-public-snapshot-v1" as const,
    publicRecordId,
    logicalId: record.logicalId,
    route: record.route,
    contentHash: record.contentHash,
    governanceHash: siteContentValueHash({
      version: record.version,
      producerClass: record.producerClass,
      domain: record.domain,
      sourceRole: record.sourceRole,
      access: record.access,
      validationStatus: record.validationStatus,
      sourceStatus: record.sourceStatus,
      sourceLineage: record.sourceLineage,
    }),
    publicationVersion: record.publicationVersion,
  };
}

function registryPublicSnapshot(entry: RegistryCorpusEntry, logicalId: string, publicRecordId: string) {
  return canonicalPublicSnapshot(publicRecordId, registryEntryToSiteContentRecord(entry, { logicalId }));
}

function dynamicLogicalIdForTest(entry: RegistryCorpusEntry) {
  if (entry.kind === "differential") return `differentials:${entry.subkind}:${entry.slug}`;
  return `${entry.kind === "medication" ? "medications" : `${entry.kind}s`}:${entry.slug}`;
}

describe("static site-content manifest", () => {
  it("uses canonical whitespace and stable logical-id order", () => {
    const first = buildStaticSiteContentManifest(
      [record("factsheets:z"), record("dsm:a", { body: "  First   line\r\n\r\n Second\tline  " })],
      metadata,
    );
    const second = buildStaticSiteContentManifest(
      [record("dsm:a", { body: "First line\nSecond line" }), record("factsheets:z")],
      { ...metadata, gitSha: "2222222222222222222222222222222222222222", generatedAt: "2030-01-01T00:00:00Z" },
    );

    expect(first.records.map((entry) => entry.logicalId)).toEqual(["dsm:a", "factsheets:z"]);
    expect(first.records.map((entry) => entry.contentHash)).toEqual(second.records.map((entry) => entry.contentHash));
    expect(first.staticManifestDigest).toBe(second.staticManifestDigest);
  });

  it("changes only the edited record hash and the static digest", () => {
    const before = buildStaticSiteContentManifest([record("dsm:a"), record("factsheets:b")], metadata);
    const after = buildStaticSiteContentManifest(
      [record("dsm:a", { body: "A changed clinical field" }), record("factsheets:b")],
      metadata,
    );

    expect(after.records[0]?.contentHash).not.toBe(before.records[0]?.contentHash);
    expect(after.records[1]?.contentHash).toBe(before.records[1]?.contentHash);
    expect(after.staticManifestDigest).not.toBe(before.staticManifestDigest);
  });

  it("keeps lineage separate from content and collapses derived evidence families", () => {
    const base = record("factsheets:a", {
      sourceLineage: [{ sourceId: "uploaded:guideline", sourceHash: "a".repeat(64), relationship: "derived_from" }],
    });
    const changedLineage = record("factsheets:a", {
      sourceLineage: [{ sourceId: "uploaded:guideline", sourceHash: "b".repeat(64), relationship: "derived_from" }],
    });
    const first = buildStaticSiteContentManifest([base], metadata);
    const second = buildStaticSiteContentManifest([changedLineage], metadata);

    expect(first.records[0]?.contentHash).toBe(second.records[0]?.contentHash);
    expect(first.records[0]?.lineageDigest).not.toBe(second.records[0]?.lineageDigest);
    expect(first.staticManifestDigest).not.toBe(second.staticManifestDigest);
  });

  it("validates dynamic records without folding them into the static digest", () => {
    const dynamic = record("services:a", { producerClass: "dynamic_registry", domain: "services" });
    const staticRecord = record("factsheets:b");
    const withoutDynamic = buildStaticSiteContentManifest([staticRecord], metadata);
    const withDynamic = buildStaticSiteContentManifest([dynamic, staticRecord], metadata);

    expect(withDynamic.staticManifestDigest).toBe(withoutDynamic.staticManifestDigest);
    expect(withDynamic.records.map((entry) => entry.logicalId)).toEqual(["factsheets:b"]);
    expect(validateSiteContentRecords([dynamic])).toEqual([dynamic]);
  });

  it("fails closed on duplicate IDs, invalid routes/public state, audit IDs, and protected derived content", () => {
    const valid = record("factsheets:a");
    const { contentHash: _contentHash, publicationVersion: _publicationVersion, ...validInput } = valid;
    void _contentHash;
    void _publicationVersion;
    expect(() => buildStaticSiteContentManifest([valid, valid], metadata)).toThrow(/duplicate logicalId/i);
    expect(() => validateSiteContentRecords([{ ...valid, route: "https://example.test/tools/a" }])).toThrow(/route/i);
    expect(() => validateSiteContentRecords([{ ...valid, access: "private" as "public" }])).toThrow(/public/i);
    expect(() => validateSiteContentRecords([{ ...valid, publicationVersion: "f".repeat(64) }])).toThrow(
      /publicationVersion/i,
    );
    expect(() => validateSiteContentRecords([{ ...valid, editorId: "actor-1" } as SiteContentRecord])).toThrow(
      /audit|editor/i,
    );
    expect(() =>
      createSiteContentRecord({
        ...validInput,
        sourceLineage: [
          { sourceId: "healthdirect:copied-page", sourceHash: "c".repeat(64), relationship: "derived_from" },
        ],
      }),
    ).toThrow(/protected|link-only/i);
  });

  it("keeps reviewed review-due content eligible while excluding superseded or unverified content", () => {
    // `review_due` is still in force under answer-state semantics; `outdated` is superseded.
    const manifest = buildStaticSiteContentManifest(
      [
        record("factsheets:review-due", { sourceStatus: "review_due", validationStatus: "locally_reviewed" }),
        record("factsheets:unverified", { sourceStatus: "review_due", validationStatus: "unverified" }),
        record("factsheets:outdated", { sourceStatus: "outdated", validationStatus: "approved" }),
      ],
      metadata,
    );

    expect(manifest.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ logicalId: "factsheets:review-due", eligible: true, exclusionReason: null }),
        expect.objectContaining({
          logicalId: "factsheets:unverified",
          eligible: false,
          exclusionReason: "validation_unverified",
        }),
        expect.objectContaining({
          logicalId: "factsheets:outdated",
          eligible: false,
          exclusionReason: "source_outdated",
        }),
      ]),
    );
  });

  it("uses code-unit canonical order for punctuation and case with stable reversed-input digests", () => {
    expect(["a", "_", "A", ".", "-"].sort(compareCanonicalSiteContentIdentifiers)).toEqual(["-", ".", "A", "_", "a"]);
    const lineage = ["source:a", "source:_", "source:A", "source:.", "source:-"].map((sourceId) => ({
      sourceId,
      sourceHash: "a".repeat(64),
      relationship: "references" as const,
    }));
    const logicalIds = ["factsheets:aa", "factsheets:a_b", "factsheets:a.b", "factsheets:a-b", "factsheets:a"];
    const first = buildStaticSiteContentManifest(
      logicalIds.map((logicalId) => record(logicalId, { sourceLineage: lineage })),
      metadata,
    );
    const reversed = buildStaticSiteContentManifest(
      [...logicalIds].reverse().map((logicalId) => record(logicalId, { sourceLineage: [...lineage].reverse() })),
      metadata,
    );

    expect(first.records.map((entry) => entry.logicalId)).toEqual([
      "factsheets:a",
      "factsheets:a-b",
      "factsheets:a.b",
      "factsheets:a_b",
      "factsheets:aa",
    ]);
    expect(first.records[0]?.lineageDigest).toBe(
      siteContentValueHash(
        ["source:-", "source:.", "source:A", "source:_", "source:a"].map((sourceId) => ({
          sourceId,
          sourceHash: "a".repeat(64),
          relationship: "references",
        })),
      ),
    );
    expect(first.staticManifestDigest).toBe(reversed.staticManifestDigest);
  });
});

describe("site-content manifest CLI integrity", () => {
  it("rejects forged, stale, reordered, duplicate, and domain-mutated baselines", () => {
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<string, unknown> & {
      records: Array<Record<string, unknown>>;
    };
    const mutations: Array<[string, (manifest: typeof baseline) => void]> = [
      ["manifest version", (manifest) => void (manifest.version = "clinical-kb-site-static-manifest-v0")],
      ["registry version", (manifest) => void (manifest.registryVersion = "site-content-producers-v0")],
      ["forged digest", (manifest) => void (manifest.staticManifestDigest = "f".repeat(64))],
      ["record order", (manifest) => void manifest.records.reverse()],
      ["duplicate record", (manifest) => void manifest.records.splice(1, 0, { ...manifest.records[0] })],
      ["record domain", (manifest) => void (manifest.records[0]!.domain = "tools")],
      ["missing governed field", (manifest) => void delete manifest.records[0]!.eligible],
    ];

    const directory = mkdtempSync(join(tmpdir(), "site-content-manifest-integrity-"));
    try {
      for (const [label, mutate] of mutations) {
        const candidate = structuredClone(baseline);
        mutate(candidate);
        const candidatePath = join(directory, `${label.replaceAll(" ", "-")}.json`);
        writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
        const result = runManifestCli(["--check", "--baseline", candidatePath]);
        expect(result.status, `${label}: ${result.stdout}\n${result.stderr}`).not.toBe(0);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }, 120_000);

  it("rejects baseline/output aliases before writing any artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "site-content-manifest-alias-"));
    const baseline = join(directory, "baseline.json");
    const output = join(directory, "output.json");
    const sentinel = '{"sentinel":"preserve"}\n';
    writeFileSync(baseline, sentinel, "utf8");
    writeFileSync(output, sentinel, "utf8");
    try {
      for (const args of [
        ["--baseline", baseline, "--out", baseline, "--diff", output],
        ["--baseline", baseline, "--out", output, "--diff", baseline],
        ["--baseline", baseline, "--out", output, "--diff", output],
      ]) {
        const result = runManifestCli(args);
        expect(result.status, `${result.stdout}\n${result.stderr}`).not.toBe(0);
        expect(readFileSync(baseline, "utf8")).toBe(sentinel);
        expect(readFileSync(output, "utf8")).toBe(sentinel);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it("rejects non-existent output leaves beneath aliased existing parents", () => {
    const directory = mkdtempSync(join(tmpdir(), "site-content-manifest-parent-alias-"));
    const realParent = join(directory, "real-parent");
    const aliasParent = join(directory, "alias-parent");
    mkdirSync(realParent);
    symlinkSync(realParent, aliasParent, process.platform === "win32" ? "junction" : "dir");
    const output = join(realParent, "not-created.json");
    const diff = join(aliasParent, "not-created.json");
    try {
      const result = runManifestCli(["--baseline", baselinePath, "--out", output, "--diff", diff]);
      expect(result.status, `${result.stdout}\n${result.stderr}`).not.toBe(0);
      expect(readdirSync(realParent)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it("preserves existing artifacts when baseline validation fails before publication", () => {
    const directory = mkdtempSync(join(tmpdir(), "site-content-manifest-write-order-"));
    const baseline = join(directory, "invalid-baseline.json");
    const output = join(directory, "output.json");
    const diff = join(directory, "diff.json");
    const sentinel = '{"sentinel":"preserve"}\n';
    writeFileSync(baseline, '{"invalid":true}\n', "utf8");
    writeFileSync(output, sentinel, "utf8");
    writeFileSync(diff, sentinel, "utf8");
    try {
      const result = runManifestCli(["--baseline", baseline, "--out", output, "--diff", diff]);
      expect(result.status, `${result.stdout}\n${result.stderr}`).not.toBe(0);
      expect(readFileSync(output, "utf8")).toBe(sentinel);
      expect(readFileSync(diff, "utf8")).toBe(sentinel);
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  it("atomically preserves the prior artifact and cleans its sibling temporary on an interrupted write", () => {
    const directory = mkdtempSync(join(tmpdir(), "site-content-manifest-atomic-"));
    const output = join(directory, "output.json");
    const sentinel = '{"sentinel":"preserve"}\n';
    writeFileSync(output, sentinel, "utf8");
    try {
      expect(() =>
        writeJsonAtomically(
          output,
          { replacement: true },
          {
            writeFileSync: (temporaryPath, value, encoding) => {
              writeFileSync(temporaryPath, value, encoding);
              throw new Error("simulated interruption before atomic replacement");
            },
            renameSync,
            rmSync,
          },
        ),
      ).toThrow(/simulated interruption/i);
      expect(readFileSync(output, "utf8")).toBe(sentinel);
      expect(readdirSync(directory)).toEqual(["output.json"]);
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });
});

describe("canonical producer adapters", () => {
  it("covers every static owner and retains truthful pending dispositions", () => {
    const domains = new Set(staticSiteContentRecords.map((entry) => entry.domain));
    expect(domains).toEqual(
      new Set(["specifiers", "dsm", "formulation", "therapies", "dictionary", "factsheets", "calculators", "tools"]),
    );
    for (const domain of ["dsm", "formulation", "therapies"] as const) {
      const records = staticSiteContentRecords.filter((entry) => entry.domain === domain);
      expect(records.length).toBeGreaterThan(0);
      const manifest = buildStaticSiteContentManifest(records, metadata);
      expect(manifest.records.every((entry) => !entry.eligible && entry.exclusionReason)).toBe(true);
    }
  });

  it("uses curated-first specifiers, exact calculator routes, and the Tools allowlist hrefs", () => {
    expect(
      staticSiteContentRecords.find((entry) => entry.logicalId === "specifiers:with-anxious-distress")?.title,
    ).toBe("With anxious distress");
    for (const calculator of staticSiteContentRecords.filter((entry) => entry.domain === "calculators")) {
      expect(calculator.route).toBe(calculatorRecordHref(calculator.logicalId.slice("calculators:".length)));
      expect(calculator.body).not.toMatch(/answer selected|calculation result|item responses:/i);
    }
    expect(
      staticSiteContentRecords
        .filter((entry) => entry.domain === "tools")
        .map((entry) => [entry.logicalId.slice("tools:".length), entry.route]),
    ).toEqual(publicKnowledgeToolCatalogRecords.map((entry) => [entry.id, entry.href]));
  });

  it("builds Therapy Compass records and lineage from the declared full public catalogue", () => {
    const publicFullCatalogue = JSON.parse(
      readFileSync(join("public", "therapy-compass-data", THERAPY_CATALOGUE_ASSETS.full), "utf8"),
    ) as Therapy[];
    const fullTherapy = publicFullCatalogue[0]!;
    const authoringTherapy = therapiesSourceJson.find((therapy) => therapy.slug === fullTherapy.slug)! as Therapy;
    const therapy = staticSiteContentRecords.find((entry) => entry.logicalId === `therapies:${fullTherapy.slug}`)!;
    const authoringSourceOnlyDrift = therapySiteContentRecord({
      ...authoringTherapy,
      contraindicationsOrCautions: `${authoringTherapy.contraindicationsOrCautions} Authoring-only draft.`,
    });
    const changed = therapySiteContentRecord({
      ...fullTherapy,
      contraindicationsOrCautions: `${fullTherapy.contraindicationsOrCautions} Updated governed caution.`,
    });
    const adapterSource = readFileSync("src/lib/site-content/adapters/index.ts", "utf8");

    expect(adapterSource).not.toContain("therapies-source.json");
    expect(fullTherapy.contraindicationsOrCautions).toBeTruthy();
    expect(therapy.body).toContain(fullTherapy.contraindicationsOrCautions);
    expect(therapy.publicationVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(therapy.sourceLineage).toEqual([
      {
        sourceId: `repository:public/therapy-compass-data/${THERAPY_CATALOGUE_ASSETS.full}`,
        sourceHash: siteContentValueHash(fullTherapy),
        relationship: "derived_from",
      },
    ]);
    expect(therapySiteContentRecord(fullTherapy)).toEqual(therapy);
    expect(authoringSourceOnlyDrift).not.toEqual(therapy);
    expect(therapy.sourceLineage[0]?.sourceHash).toBe(siteContentValueHash(fullTherapy));
    expect(changed.contentHash).not.toBe(therapy.contentHash);
    expect(changed.publicationVersion).not.toBe(therapy.publicationVersion);
    expect(changed.sourceLineage[0]?.sourceHash).not.toBe(therapy.sourceLineage[0]?.sourceHash);
    expect(buildStaticSiteContentManifest([changed], metadata).staticManifestDigest).not.toBe(
      buildStaticSiteContentManifest([therapy], metadata).staticManifestDigest,
    );
    expect(buildStaticSiteContentManifest([therapy], metadata).records[0]).toMatchObject({
      eligible: false,
      exclusionReason: "validation_unverified",
    });
  });

  it("uses deterministic SHA-256 publication versions for every governed projection", () => {
    const publicationVersionPattern = /^[0-9a-f]{64}$/;
    expect(staticSiteContentRecords.every((entry) => publicationVersionPattern.test(entry.publicationVersion))).toBe(
      true,
    );

    const canonicalEntry = {
      kind: "service" as const,
      subkind: "service",
      ownerId: null,
      recordId: "stable-row-id",
      slug: "stable-service",
      title: "Stable service",
      subtitle: "Public service",
      content: "Service: Stable service\nPublic service",
      searchText: "stable service public",
      sourceStatus: "current",
      validationStatus: "locally_reviewed",
      metadata: {},
    } satisfies RegistryCorpusEntry;
    const identity = {
      logicalId: "services:stable-service",
      publicRecordId: "stable-public-id",
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true as const,
      explicitlyReconciled: true as const,
    };
    const base = registryEntryToSiteContentRecord(canonicalEntry, identity);
    const contentChanged = registryEntryToSiteContentRecord(
      { ...canonicalEntry, content: `${canonicalEntry.content}\nChanged content` },
      identity,
    );
    const governanceChanged = registryEntryToSiteContentRecord(
      { ...canonicalEntry, validationStatus: "approved" },
      identity,
    );

    expect(
      [base, contentChanged, governanceChanged].every((entry) =>
        publicationVersionPattern.test(entry.publicationVersion),
      ),
    ).toBe(true);
    expect(
      new Set([base.publicationVersion, contentChanged.publicationVersion, governanceChanged.publicationVersion]),
    ).toHaveLength(3);
  });

  it("adopts all dynamic families with the persisted row converters and their exact document/chunk IDs", () => {
    const ownerId = "editor-owner";
    const service = ownerlessPersistedRow<RegistryRecordRow>(
      buildDefaultServiceRows(ownerId)[0]!,
      "10000000-0000-4000-8000-000000000001",
    );
    const form = ownerlessPersistedRow<RegistryRecordRow>(
      buildDefaultFormRows(ownerId)[0]!,
      "10000000-0000-4000-8000-000000000002",
    );
    const medication = ownerlessPersistedRow<MedicationRecordRow>(
      buildDefaultMedicationRows(ownerId)[0]!,
      "10000000-0000-4000-8000-000000000003",
    );
    const differentialRows = buildDefaultDifferentialRows(ownerId);
    const diagnosis = ownerlessPersistedRow<DifferentialRecordRow>(
      differentialRows.find((row) => row.kind === "diagnosis")!,
      "10000000-0000-4000-8000-000000000004",
    );
    const presentation = ownerlessPersistedRow<DifferentialRecordRow>(
      differentialRows.find((row) => row.kind === "presentation")!,
      "10000000-0000-4000-8000-000000000005",
    );
    const rows = {
      clinicalRegistryRows: [service, form],
      medicationRows: [medication],
      differentialRows: [diagnosis, presentation],
    };
    const expectedEntries = [
      ...clinicalRegistryRowsToCorpusEntries(rows.clinicalRegistryRows),
      ...medicationRowsToCorpusEntries(rows.medicationRows),
      ...differentialRowsToCorpusEntries(rows.differentialRows),
    ];
    const decisions = expectedEntries.map((entry) => ({
      kind: entry.kind,
      recordId: entry.recordId,
      publicRecordId: `public-${entry.recordId}`,
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true,
      explicitlyReconciled: true,
    }));
    const projections = buildDynamicSiteContentProjections(
      rows,
      decisions,
      expectedEntries.map((entry) =>
        registryPublicSnapshot(entry, dynamicLogicalIdForTest(entry), `public-${entry.recordId}`),
      ),
    );

    expect(new Set(projections.map((projection) => projection.record.domain))).toEqual(
      new Set(["services", "forms", "medications", "differentials"]),
    );
    expect(projections.every((projection) => /^[0-9a-f]{64}$/.test(projection.record.publicationVersion))).toBe(true);
    expect(projections.map((projection) => projection.record.logicalId)).toEqual(
      expect.arrayContaining([
        `services:${service.slug}`,
        `forms:${form.slug}`,
        `medications:${medication.slug}`,
        `differentials:diagnosis:${diagnosis.slug}`,
        `differentials:presentation:${presentation.slug}`,
      ]),
    );
    for (const entry of expectedEntries) {
      const projection = projections.find((candidate) => candidate.metadata.registry_record_id === entry.recordId);
      expect(projection?.documentId).toBe(registryCorpusDocumentId(entry.kind, entry.recordId));
      expect(projection?.chunkId).toBe(registryCorpusChunkId(entry.kind, entry.recordId));
    }
    expect(new Set(projections.map((projection) => projection.documentId)).size).toBe(projections.length);
    expect(allSiteContentRecords).toEqual(staticSiteContentRecords);
  });

  it("requires exactly one reconciliation decision for every persisted dynamic entry", () => {
    const ownerId = "editor-owner";
    const first = persistedRow<RegistryRecordRow>(
      buildDefaultServiceRows(ownerId)[0]!,
      "20000000-0000-4000-8000-000000000001",
    );
    const divergent = persistedRow<RegistryRecordRow>(
      { ...first, title: "Divergent persisted duplicate", validation_status: "unverified" },
      "20000000-0000-4000-8000-000000000002",
    );
    const rows = { clinicalRegistryRows: [first, divergent], medicationRows: [], differentialRows: [] };
    const decision = {
      kind: "service" as const,
      recordId: first.id,
      publicRecordId: `public-${first.id}`,
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true as const,
      explicitlyReconciled: true as const,
    };

    expect(() => buildDynamicSiteContentProjections(rows, [decision], [])).toThrow(/decision.*every persisted/i);
    expect(() => buildDynamicSiteContentProjections(rows, [decision, decision], [])).toThrow(
      /duplicate reconciliation decision/i,
    );
    expect(() =>
      buildDynamicSiteContentProjections(
        rows,
        [
          decision,
          {
            ...decision,
            recordId: divergent.id,
            publicRecordId: `public-${divergent.id}`,
            rowOwnerId: ownerId,
            publicationState: "draft",
            renderedByPublicSite: false,
            explicitlyReconciled: false,
          },
          { ...decision, recordId: "missing-row", publicRecordId: "public-missing-row" },
        ],
        [],
      ),
    ).toThrow(/decision.*persisted entry/i);
  });

  it("keeps the CLI provider-free and bounded to metadata/hash outputs", () => {
    const cli = readFileSync("scripts/build-site-content-manifest.ts", "utf8");
    expect(cli).not.toMatch(/supabase|openai|embedTexts|body\s*:/i);
    expect(cli).toContain("--check");
    expect(cli).toContain("--baseline");
    expect(cli).toContain("--diff");
  });
});

describe("registry adoption", () => {
  const entry: RegistryCorpusEntry = {
    kind: "service",
    subkind: "service",
    ownerId: "actor-a",
    recordId: "record-a",
    slug: "crisis-service",
    title: "Crisis service",
    subtitle: "Urgent access",
    content: "Service: Crisis service\nUrgent access",
    searchText: "crisis service urgent access",
    sourceStatus: "current",
    validationStatus: "locally_reviewed",
    metadata: {},
  };

  it("requires exact canonical-public snapshot truth beyond reconciliation booleans", () => {
    const canonicalEntry = { ...entry, ownerId: null };
    const identity = {
      logicalId: "services:crisis-service",
      publicRecordId: "canonical-public-record",
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true as const,
      explicitlyReconciled: true as const,
    };
    const projected = registryEntryToSiteContentRecord(canonicalEntry, identity);
    const snapshot = canonicalPublicSnapshot(identity.publicRecordId, projected);

    expect(() => canonicalRegistrySiteContentProjection(canonicalEntry, identity, snapshot)).not.toThrow();
    for (const mismatchedSnapshot of [
      { ...snapshot, publicRecordId: "different-public-record" },
      { ...snapshot, logicalId: "services:different-service" },
      { ...snapshot, route: "/services/different-service" },
      { ...snapshot, contentHash: "f".repeat(64) },
      { ...snapshot, governanceHash: "d".repeat(64) },
      { ...snapshot, publicationVersion: "e".repeat(64) },
    ]) {
      expect(() => canonicalRegistrySiteContentProjection(canonicalEntry, identity, mismatchedSnapshot)).toThrow(
        /canonical.public.*snapshot.*mismatch/i,
      );
      expect(() =>
        adoptCanonicalRegistryProjection(
          [
            {
              entry: canonicalEntry,
              ...identity,
            },
          ],
          mismatchedSnapshot,
        ),
      ).toThrow(/canonical.public.*snapshot.*(mismatch|no reconciliation group)/i);
    }
  });

  it("has no boolean-only canonical-public adoption path", () => {
    const canonicalEntry = { ...entry, ownerId: null };
    const projection = {
      entry: canonicalEntry,
      logicalId: "services:crisis-service",
      publicRecordId: "canonical-public-record",
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true,
      explicitlyReconciled: true,
    };
    const booleanOnlyAdoption = adoptCanonicalRegistryProjection as unknown as (
      candidates: readonly (typeof projection)[],
    ) => unknown;

    expect(() => booleanOnlyAdoption([projection])).toThrow(/canonical.public.*snapshot.*required/i);
  });

  it("binds ownerless public claims to the persisted entry owner", () => {
    const identity = {
      logicalId: "services:crisis-service",
      publicRecordId: "canonical-public-record",
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true as const,
      explicitlyReconciled: true as const,
    };
    const ownerlessEntry = { ...entry, ownerId: null };
    const snapshot = registryPublicSnapshot(ownerlessEntry, identity.logicalId, identity.publicRecordId);

    expect(() => canonicalRegistrySiteContentProjection(entry, identity, snapshot)).toThrow(
      /persisted.*owner|owner.*mismatch/i,
    );
    expect(() =>
      adoptCanonicalRegistryProjection(
        [
          {
            entry,
            ...identity,
          },
        ],
        snapshot,
      ),
    ).toThrow(/persisted.*owner|owner.*mismatch/i);
    expect(() => canonicalRegistrySiteContentProjection(ownerlessEntry, identity, snapshot)).not.toThrow();
  });

  it("preserves registry text and IDs while assigning only the canonical public projection", () => {
    const canonicalEntry = { ...entry, ownerId: null };
    const projection = {
      entry: canonicalEntry,
      logicalId: "services:crisis-service",
      publicRecordId: "record-a",
      rowOwnerId: null,
      publicationState: "published" as const,
      renderedByPublicSite: true,
      explicitlyReconciled: true,
    };
    const direct = registryEntryToSiteContentRecord(canonicalEntry, { logicalId: projection.logicalId });
    const snapshot = canonicalPublicSnapshot(projection.publicRecordId, direct);
    const adopted = adoptCanonicalRegistryProjection([projection], snapshot);

    expect(adopted.record).toEqual(direct);
    expect(adopted.record.body).toBe(canonicalEntry.content);
    expect(adopted.record.publicationVersion).toMatch(/^[0-9a-f]{64}$/);
    expect(adopted.documentId).toBe(adopted.metadata.site_content_document_id);
    expect(adopted.chunkId).toBe(adopted.metadata.site_content_chunk_id);
    const adoptedProjection = canonicalRegistrySiteContentProjection(
      canonicalEntry,
      {
        logicalId: projection.logicalId,
        publicRecordId: projection.publicRecordId,
        rowOwnerId: null,
        publicationState: "published",
        renderedByPublicSite: true,
        explicitlyReconciled: true,
      },
      snapshot,
    );
    expect(adoptedProjection.metadata).toMatchObject({
      corpus_scope: "clinical_kb_site",
      site_content_domain: "services",
      site_content_route: "/services/crisis-service",
      site_content_logical_id: "services:crisis-service",
    });
    expect(JSON.stringify(adoptedProjection.metadata)).not.toMatch(/actor-a|owner_id/i);
    expect(() =>
      canonicalRegistrySiteContentProjection(
        entry,
        {
          logicalId: projection.logicalId,
          publicRecordId: projection.publicRecordId,
          rowOwnerId: null,
          publicationState: "published",
          renderedByPublicSite: true,
          explicitlyReconciled: true,
        },
        snapshot,
      ),
    ).toThrow(/persisted.*owner|owner.*mismatch/i);
    expect(() =>
      canonicalRegistrySiteContentProjection(
        entry,
        {
          logicalId: projection.logicalId,
          publicRecordId: projection.publicRecordId,
          rowOwnerId: "actor-a" as never,
          publicationState: "published",
          renderedByPublicSite: true,
          explicitlyReconciled: true,
        },
        snapshot,
      ),
    ).toThrow(/ownerless reconciled public projection/i);
  });

  it("carries an embedding only when text, model, and dimensions are identical", () => {
    const existing = { normalizedText: "A  summary", model: "embedding-v1", dimensions: 1536 };
    expect(
      canCarryForwardRegistryEmbedding(existing, {
        normalizedText: "A summary",
        model: "embedding-v1",
        dimensions: 1536,
      }),
    ).toBe(true);
    expect(
      canCarryForwardRegistryEmbedding(existing, {
        normalizedText: "Changed summary",
        model: "embedding-v1",
        dimensions: 1536,
      }),
    ).toBe(false);
    expect(
      canCarryForwardRegistryEmbedding(existing, {
        normalizedText: "A summary",
        model: "embedding-v2",
        dimensions: 1536,
      }),
    ).toBe(false);
  });

  it("reports identical owner duplicates and rejects divergent adoption", () => {
    const identical = buildRegistryReconciliationReport([
      { logicalId: "services:crisis-service", rowOwnerId: "actor-a", entry },
      {
        logicalId: "services:crisis-service",
        rowOwnerId: "actor-b",
        entry: { ...entry, ownerId: "actor-b", recordId: "record-b" },
      },
    ]);
    expect(identical.groups[0]?.disposition).toBe("identical_duplicates");
    expect(JSON.stringify(identical)).not.toMatch(/actor-a|actor-b/);

    const divergent = [
      {
        entry: { ...entry, ownerId: null },
        logicalId: "services:crisis-service",
        publicRecordId: "record-a",
        rowOwnerId: null,
        publicationState: "published" as const,
        renderedByPublicSite: true,
        explicitlyReconciled: true,
      },
      {
        entry: { ...entry, ownerId: "actor-b", recordId: "record-b", content: "Divergent content" },
        logicalId: "services:crisis-service",
        publicRecordId: "record-b",
        rowOwnerId: "actor-b",
        publicationState: "published" as const,
        renderedByPublicSite: false,
        explicitlyReconciled: false,
      },
    ];
    expect(buildRegistryReconciliationReport(divergent).groups[0]?.disposition).toBe(
      "divergent_requires_administrator_review",
    );
    const snapshot = registryPublicSnapshot(divergent[0]!.entry, divergent[0]!.logicalId, divergent[0]!.publicRecordId);
    expect(() => adoptCanonicalRegistryProjection(divergent, snapshot)).toThrow(/divergent|administrator/i);
  });

  it("rejects colliding row/public IDs instead of reselecting an owner row", () => {
    const candidates = [
      {
        entry: { ...entry, recordId: "owner-row", slug: "owner-only-route", sourceStatus: "outdated" },
        logicalId: "services:crisis-service",
        publicRecordId: "shared-public-id",
        rowOwnerId: "actor-a",
        publicationState: "published" as const,
        renderedByPublicSite: false,
        explicitlyReconciled: false,
      },
      {
        entry: { ...entry, ownerId: null, recordId: "shared-public-id" },
        logicalId: "services:crisis-service",
        publicRecordId: "shared-public-id",
        rowOwnerId: null,
        publicationState: "published" as const,
        renderedByPublicSite: true,
        explicitlyReconciled: true,
      },
    ];
    const snapshot = registryPublicSnapshot(
      candidates[1]!.entry,
      candidates[1]!.logicalId,
      candidates[1]!.publicRecordId,
    );

    expect(() => buildRegistryReconciliationReport(candidates)).toThrow(/duplicate.*(public|record).*id/i);
    expect(() => adoptCanonicalRegistryProjection(candidates, snapshot)).toThrow(/duplicate.*(public|record).*id/i);
  });

  it("treats route and governance drift as divergent even when text is identical", () => {
    const candidates = [
      {
        entry: { ...entry, ownerId: null },
        logicalId: "services:crisis-service",
        publicRecordId: "public-record",
        rowOwnerId: null,
        publicationState: "published" as const,
        renderedByPublicSite: true,
        explicitlyReconciled: true,
      },
      {
        entry: {
          ...entry,
          ownerId: "actor-b",
          recordId: "owner-row",
          slug: "different-route",
          validationStatus: "unverified",
        },
        logicalId: "services:crisis-service",
        rowOwnerId: "actor-b",
        publicationState: "draft" as const,
        renderedByPublicSite: false,
        explicitlyReconciled: false,
      },
    ];

    expect(buildRegistryReconciliationReport(candidates).groups[0]?.disposition).toBe(
      "divergent_requires_administrator_review",
    );
    const snapshot = registryPublicSnapshot(candidates[0]!.entry, candidates[0]!.logicalId, "public-record");
    expect(() => adoptCanonicalRegistryProjection(candidates, snapshot)).toThrow(/divergent|administrator/i);
  });
});
