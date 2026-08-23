import expectedRegistryJson from "../data/rag-expected-source-coverage.v1.json";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runOfflineIngestionAudit } from "../scripts/audit-ingestion-corpus";
import { australianSourceCatalogue } from "../src/lib/australian-source-catalogue";
import { ragProgrammeFixture } from "../src/lib/rag/rag-programme-eval";
import {
  auditExpectedSourceCoverage,
  parseExpectedSourceCoverageRegistry,
  type ExpectedSourceCoverageRecord,
} from "../src/lib/source-coverage-registry";

const expectedCoverageFixture = (): ExpectedSourceCoverageRecord[] => [
  {
    key: "wa-health",
    owner: "source_governance:wa-health",
    reviewStatus: "active",
    expectedDocumentIds: ["expected-doc"],
    mustPassCaseIds: ["must-pass-1"],
  },
];

describe("expected source coverage", () => {
  it("distinguishes an absent source from a retrieval miss", () => {
    const expected = expectedCoverageFixture();
    expect(
      auditExpectedSourceCoverage({ expected, activeDocumentIds: new Set(), retrievedDocumentIdsByCase: new Map() }),
    ).toContainEqual(expect.objectContaining({ outcome: "not_in_corpus" }));
    expect(
      auditExpectedSourceCoverage({
        expected,
        activeDocumentIds: new Set(["expected-doc"]),
        retrievedDocumentIdsByCase: new Map([["must-pass-1", new Set()]]),
      }),
    ).toContainEqual(expect.objectContaining({ outcome: "retrieval_miss" }));
  });

  it("gives governance states precedence over corpus and retrieval evidence", () => {
    const base = expectedCoverageFixture()[0]!;
    const findings = auditExpectedSourceCoverage({
      expected: [
        { ...base, key: "retired", reviewStatus: "retired" },
        { ...base, key: "not-approved", reviewStatus: "not_approved" },
      ],
      activeDocumentIds: new Set(["expected-doc"]),
      retrievedDocumentIdsByCase: new Map([["must-pass-1", new Set(["expected-doc"])]]),
    });
    expect(findings).toEqual([
      expect.objectContaining({ key: "not-approved", outcome: "not_approved" }),
      expect.objectContaining({ key: "retired", outcome: "retired" }),
    ]);
  });

  it("parses the committed registry with P01/P02 referential integrity", () => {
    const registry = parseExpectedSourceCoverageRegistry(expectedRegistryJson, {
      catalogue: australianSourceCatalogue,
      evaluationCases: ragProgrammeFixture.cases,
    });
    const catalogueKeys = australianSourceCatalogue.map(({ key }) => key).sort();
    expect(registry.records.map(({ key }) => key)).toEqual(catalogueKeys);
    expect(registry.schemaVersion).toBe(1);
  });

  it("rejects duplicate identities, missing owners, bad case-document mappings, and active link-only sources", () => {
    const valid = {
      schemaVersion: 1,
      records: expectedCoverageFixture(),
    };
    const catalogue = australianSourceCatalogue.filter(({ key }) => key === "wa-health");
    const evaluationCases = [{ id: "must-pass-1", expectedDocuments: ["expected-doc"] }];
    expect(() =>
      parseExpectedSourceCoverageRegistry(
        { ...valid, records: [...valid.records, ...valid.records] },
        { catalogue, evaluationCases },
      ),
    ).toThrow(/duplicate/i);
    expect(() =>
      parseExpectedSourceCoverageRegistry(
        { ...valid, records: [{ ...valid.records[0], owner: " " }] },
        { catalogue, evaluationCases },
      ),
    ).toThrow(/owner/i);
    expect(() =>
      parseExpectedSourceCoverageRegistry(
        { ...valid, records: [{ ...valid.records[0], expectedDocumentIds: ["other-doc"] }] },
        { catalogue, evaluationCases },
      ),
    ).toThrow(/expected document/i);
    const linkOnly = australianSourceCatalogue.find(({ key }) => key === "etg-complete")!;
    expect(() =>
      parseExpectedSourceCoverageRegistry(
        { schemaVersion: 1, records: [{ ...valid.records[0], key: linkOnly.key }] },
        { catalogue: [linkOnly], evaluationCases },
      ),
    ).toThrow(/link-only|link_only/i);
  });

  it("writes byte-identical, content-free offline reports", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ingestion-audit-"));
    const input = fileURLToPath(new URL("fixtures/ingestion/active-corpus-inventory.json", import.meta.url));
    const expected = fileURLToPath(new URL("../data/rag-expected-source-coverage.v1.json", import.meta.url));
    const first = path.join(directory, "first.json");
    const second = path.join(directory, "second.json");
    await runOfflineIngestionAudit(["--input", input, "--expected", expected, "--output", first]);
    await runOfflineIngestionAudit(["--input", input, "--expected", expected, "--output", second]);
    const [firstBytes, secondBytes] = await Promise.all([readFile(first), readFile(second)]);
    expect(firstBytes.equals(secondBytes)).toBe(true);
    const report = JSON.parse(firstBytes.toString("utf8")) as Record<string, unknown>;
    expect(report).toMatchObject({ schemaVersion: 1, mode: "offline_read_only" });
    expect(JSON.stringify(report)).not.toMatch(
      /clinicalText|content|title|prompt|canonicalUrl|ownerId|embeddingVector/,
    );
  });

  it("fails closed before any live adapter can load", async () => {
    await expect(runOfflineIngestionAudit(["--live-read"])).rejects.toThrow(/target confirmation.*authorization/i);
    await expect(
      runOfflineIngestionAudit([
        "--live-read",
        "--confirm-target",
        "development",
        "--authorization-receipt",
        "operator-confirmed",
      ]),
    ).rejects.toThrow(/no live-read adapter is installed/i);
  });
});
