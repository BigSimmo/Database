import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reportKeyFields, findCanaryLeaks } from "../scripts/rag-adversarial-contract.mjs";
import {
  assertionKinds,
  buildLabReport,
  buildReportKey,
  buildSummaryLines,
  collectManifestCanaryTokens,
  hostileConstructions,
  hostileStatKeys,
  labDatasetVersion,
  labEngines,
  labGateIds,
  labHardTableFeatureIds,
  labStrata,
  scanReportForLeaks,
  stratumStatKeys,
  validateGateBRecord,
  validateLabManifest,
} from "../eval/docling/report/lab-contract.mjs";

const manifestPath = "eval/docling/fixtures/manifest.v2.json";
const configPath = "eval/docling/report/lab-config.json";
const templatePath = "eval/docling/report/gate-b-decision-record.template.json";

const readJson = (relativePath: string) => JSON.parse(readFileSync(relativePath, "utf8"));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const manifest = readJson(manifestPath);
const config = readJson(configPath);
const template = readJson(templatePath);
const tokens = collectManifestCanaryTokens(manifest);

const validKey = () =>
  buildReportKey({
    commitSha: "a".repeat(40),
    datasetVersion: labDatasetVersion,
    indexVersion: "20260101000000_synthetic_migration",
    config,
  });

const stat = () => ({
  docCount: 6,
  parseSuccessCount: 6,
  wallClockMsP50: 800,
  wallClockMsP95: 2000,
  peakRssBytesMax: 500 * 1024 * 1024,
  tableCellPrecision: 0.9,
  tableCellRecall: 0.8,
  tableCellF1: 0.85,
  assertionsTotal: 24,
  assertionsFound: 22,
});

const validMeasurements = () => ({
  datasetVersion: labDatasetVersion,
  engines: Object.fromEntries(
    labEngines.map((engine) => [
      engine,
      {
        perStratum: Object.fromEntries(labStrata.map((stratum) => [stratum, stat()])),
        hostile: { docCount: 10, containedCount: 10, crashArtifactCount: 0, canaryEchoCount: 0 },
      },
    ]),
  ),
});

describe("docling lab fixture manifest", () => {
  it("accepts the committed manifest", () => {
    expect(validateLabManifest(manifest)).toEqual([]);
  });

  it("stays inside the README §B3 fixture band with every stratum covered", () => {
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(30);
    expect(manifest.fixtures.length).toBeLessThanOrEqual(50);
    const strata = new Set(manifest.fixtures.map((fixture: { stratum: string }) => fixture.stratum));
    expect([...strata].sort()).toEqual([...labStrata].sort());
    const constructions = manifest.hostile.map((entry: { construction: string }) => entry.construction);
    expect([...constructions].sort()).toEqual([...hostileConstructions].sort());
  });

  it("rejects an assertion whose text is not literally present in its fixture", () => {
    const broken = clone(manifest) as typeof manifest;
    broken.fixtures[0].assertions[0].text = "999999 zg";
    expect(validateLabManifest(broken).join("\n")).toContain(
      "does not appear in the fixture's bodyText or table cells",
    );
  });

  it("rejects an undeclared planted canary and an unplanted declared one", () => {
    const undeclared = clone(manifest) as typeof manifest;
    const planted = undeclared.fixtures.find(
      (fixture: { plantedCanaries: string[] }) => fixture.plantedCanaries.length > 0,
    );
    planted.plantedCanaries = [];
    expect(validateLabManifest(undeclared).join("\n")).toContain("planted but not declared");

    const unplanted = clone(manifest) as typeof manifest;
    const absentToken = tokens.find((token: string) => !unplanted.fixtures[0].plantedCanaries.includes(token));
    unplanted.fixtures[0].plantedCanaries = [absentToken, ...unplanted.fixtures[0].plantedCanaries];
    expect(validateLabManifest(unplanted).join("\n")).toContain("declared but never planted");
  });

  it("rejects a fixture that names a real clinical source", () => {
    const broken = clone(manifest) as typeof manifest;
    broken.fixtures[0].bodyText.push("According to Maudsley this is fine.");
    expect(validateLabManifest(broken).join("\n")).toContain("names real clinical source");
  });

  it("keeps every canary token digit-free so secret scanners cannot flag it", () => {
    expect(tokens.length).toBeGreaterThanOrEqual(4);
    for (const token of tokens) expect(token).toMatch(/^CANARY-[A-Z]+(?:-[A-Z]+)+$/);
  });

  it("keeps assertion kinds within the scored vocabulary", () => {
    for (const fixture of manifest.fixtures) {
      for (const assertion of fixture.assertions) expect(assertionKinds).toContain(assertion.kind);
    }
  });

  it("pins the v2 table-hardness corpus to real shapes and table-only exactness checks", () => {
    expect(manifest.datasetVersion).toBe("docling-lab-fixtures.v2");
    expect(labDatasetVersion).toBe("docling-lab-fixtures.v2");
    expect([...labHardTableFeatureIds]).toEqual(["unruled", "merged_cell", "rotated_header"]);

    const tableHeavy = manifest.fixtures.filter((fixture: { stratum: string }) => fixture.stratum === "table_heavy");
    type HardTableCandidate = { features: Set<string>; scopedKinds: Set<string> };
    const candidates: HardTableCandidate[] = tableHeavy.flatMap(
      (fixture: {
        assertions: Array<{ kind: string; source?: string; tableId?: string }>;
        tables: Array<{
          tableId: string;
          unruled?: boolean;
          style?: string;
          rotatedHeaders?: boolean;
          rotated_headers?: boolean;
          cells: Array<{ row: number; colSpan?: number; rowSpan?: number; rotate?: number; rotated?: boolean }>;
        }>;
      }) =>
        fixture.tables.map((table) => {
          const features = new Set<string>();
          if (table.unruled === true || table.style === "unruled") features.add("unruled");
          if (table.cells.some((cell) => (cell.colSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1)) {
            features.add("merged_cell");
          }
          if (
            table.rotatedHeaders === true ||
            table.rotated_headers === true ||
            table.cells.some((cell) => cell.row === 0 && (cell.rotate === 90 || cell.rotated === true))
          ) {
            features.add("rotated_header");
          }
          const scopedKinds = new Set(
            fixture.assertions
              .filter((assertion) => assertion.source === "table" && assertion.tableId === table.tableId)
              .map((assertion) => assertion.kind),
          );
          return { features, scopedKinds };
        }),
    );

    for (const feature of labHardTableFeatureIds) {
      const matching = candidates.filter((candidate) => candidate.features.has(feature));
      expect(matching.length).toBeGreaterThan(0);
      expect(matching.some((candidate) => assertionKinds.every((kind) => candidate.scopedKinds.has(kind)))).toBe(true);
    }
  });

  it("rejects removing a hard shape even when a decorative mergedCells marker remains", () => {
    const cases = [
      {
        feature: "unruled",
        mutate: (table: Record<string, unknown>) => {
          delete table.unruled;
          delete table.style;
        },
      },
      {
        feature: "merged_cell",
        mutate: (table: { cells?: Array<Record<string, unknown>> }) => {
          for (const cell of table.cells ?? []) {
            delete cell.colSpan;
            delete cell.rowSpan;
          }
        },
      },
      {
        feature: "rotated_header",
        mutate: (table: { cells?: Array<Record<string, unknown>> } & Record<string, unknown>) => {
          delete table.rotatedHeaders;
          delete table.rotated_headers;
          for (const cell of table.cells ?? []) {
            delete cell.rotate;
            delete cell.rotated;
          }
        },
      },
    ];

    for (const scenario of cases) {
      const broken = clone(manifest) as typeof manifest;
      for (const fixture of broken.fixtures.filter(
        (candidate: { stratum: string }) => candidate.stratum === "table_heavy",
      )) {
        for (const table of fixture.tables) scenario.mutate(table);
      }
      expect(validateLabManifest(broken).join("\n")).toContain(
        `table_heavy corpus requires at least one ${scenario.feature} table`,
      );
    }
  });

  it("rejects table-scoped checks that can pass from prose or no longer cover the hard shapes", () => {
    const proseDuplicate = clone(manifest) as typeof manifest;
    const fixture = proseDuplicate.fixtures.find(
      (candidate: { id: string }) => candidate.id === "table-heavy-dostrelin",
    );
    const assertion = fixture.assertions.find((candidate: { source?: string }) => candidate.source === "table");
    fixture.bodyText.push(`This synthetic prose repeats ${assertion.text}.`);
    expect(validateLabManifest(proseDuplicate).join("\n")).toContain("must not also appear in title or bodyText");

    const unscoped = clone(manifest) as typeof manifest;
    for (const candidate of unscoped.fixtures) {
      for (const item of candidate.assertions) {
        delete item.source;
        delete item.tableId;
      }
    }
    const failures = validateLabManifest(unscoped).join("\n");
    for (const feature of labHardTableFeatureIds) {
      expect(failures).toContain(`${feature} table requires table-scoped`);
    }
  });
});

describe("docling lab report key", () => {
  // The six fields and their order are the S4 programme contract
  // (docs/rag-improvement/baseline-record.md §1) — imported, never re-declared.
  it("emits exactly the shared report-key fields in the pinned order", () => {
    const { key, failures } = validKey();
    expect(failures).toEqual([]);
    expect(Object.keys(key as object)).toEqual([...reportKeyFields]);
  });

  it("rejects a short or uppercase commit SHA", () => {
    const short = buildReportKey({
      commitSha: "abc123",
      datasetVersion: labDatasetVersion,
      indexVersion: "20260101000000_x",
      config,
    });
    expect(short.failures.join("\n")).toContain("40-character");
  });

  it("cross-checks the config's answer-model and embedding pins against src/lib/env.ts", () => {
    const env = readFileSync("src/lib/env.ts", "utf8");
    const sources = config.reportKeySources;
    for (const model of sources.model_version.matchAll(/=([a-z0-9.-]+)/g)) {
      expect(env).toContain(model[1]);
    }
    const [embeddingModel, dimensions] = sources.embedding_version.split("@");
    expect(env).toContain(embeddingModel);
    expect(env).toContain(dimensions);
  });

  it("cross-checks the extractor pins against both hashed lockfiles", () => {
    const doclingPin = config.extractorVersions.docling.match(/docling==([0-9.]+)/)?.[1];
    const legacyPin = config.extractorVersions.legacy.match(/pymupdf==([0-9.]+)/)?.[1];
    expect(readFileSync("eval/docling/requirements.txt", "utf8")).toContain(`docling==${doclingPin}`);
    expect(readFileSync("worker/python/requirements.txt", "utf8")).toContain(`pymupdf==${legacyPin}`);
  });
});

describe("docling lab aggregate report", () => {
  it("builds from valid measurements and stays canary-clean", () => {
    const { key } = validKey();
    const { report, failures } = buildLabReport(validMeasurements(), key, config);
    expect(failures).toEqual([]);
    const serialised = JSON.stringify(report);
    expect(scanReportForLeaks(serialised, tokens)).toEqual([]);
    expect(buildSummaryLines(report).length).toBeGreaterThan(labStrata.length);
  });

  // The allowlist copy is the leak boundary: a measurements file polluted with
  // document text (here: a planted canary) must produce a clean report, because
  // nothing outside the numeric keys is ever read.
  it("drops non-allowlisted fields from polluted measurements", () => {
    const { key } = validKey();
    const polluted = validMeasurements() as Record<string, unknown>;
    (polluted as { pollutant?: string }).pollutant = `leaked text ${tokens[0]}`;
    const engines = polluted.engines as Record<string, { perStratum: Record<string, Record<string, unknown>> }>;
    engines.legacy.perStratum.text_simple.extractedText = `body carrying ${tokens[1]}`;
    const { report, failures } = buildLabReport(polluted, key, config);
    expect(failures).toEqual([]);
    const serialised = JSON.stringify(report);
    expect(findCanaryLeaks(serialised, tokens)).toEqual([]);
    expect(serialised).not.toContain("pollutant");
    expect(serialised).not.toContain("extractedText");
  });

  it("rejects measurements missing an engine or carrying a non-numeric stat", () => {
    const { key } = validKey();
    const missingEngine = validMeasurements() as { engines: Record<string, unknown> };
    delete missingEngine.engines.docling;
    expect(buildLabReport(missingEngine, key, config).failures.join("\n")).toContain("engines.docling is required");

    const wrongType = validMeasurements() as {
      engines: Record<string, { perStratum: Record<string, Record<string, unknown>> }>;
    };
    wrongType.engines.legacy.perStratum.table_heavy.tableCellF1 = "0.9";
    expect(buildLabReport(wrongType, key, config).failures.join("\n")).toContain("must be a finite number");
  });

  it("pins the stat allowlists this contract copies through", () => {
    expect([...stratumStatKeys]).toEqual([
      "docCount",
      "parseSuccessCount",
      "wallClockMsP50",
      "wallClockMsP95",
      "peakRssBytesMax",
      "tableCellPrecision",
      "tableCellRecall",
      "tableCellF1",
      "assertionsTotal",
      "assertionsFound",
    ]);
    expect([...hostileStatKeys]).toEqual(["docCount", "containedCount", "crashArtifactCount", "canaryEchoCount"]);
  });
});

describe("gate B decision record", () => {
  it("accepts the committed template in template mode", () => {
    expect(validateGateBRecord(template, "template")).toEqual([]);
  });

  it("requires every Gate B measure to appear as a gate", () => {
    const ids = template.gates.map((gate: { id: string }) => gate.id);
    expect([...ids].sort()).toEqual([...labGateIds].sort());
  });

  it("rejects a template carrying a recorded result or agreed thresholds", () => {
    const withResult = clone(template) as typeof template;
    withResult.gates[0] = {
      ...withResult.gates[0],
      status: "recorded",
      result: "36/36",
      evidence: "run 1",
    };
    expect(validateGateBRecord(withResult, "template").join("\n")).toContain("must not carry recorded results");

    const agreed = clone(template) as typeof template;
    agreed.preAgreedThresholds.tableHeavyCellF1ImprovementTargetPp = 5;
    expect(validateGateBRecord(agreed, "template").join("\n")).toContain("thresholds are owner-agreed");
  });

  it("requires agreed thresholds and evidence-or-reason in final mode", () => {
    const finalRecord = clone(template) as typeof template;
    finalRecord.status = "pass";
    expect(validateGateBRecord(finalRecord, "final").join("\n")).toContain("agreedBeforeRun true");

    finalRecord.preAgreedThresholds = {
      agreedBeforeRun: true,
      parseSuccessNonInferiorityMarginPp: 0,
      numericExactnessNonInferiorityMarginPp: 0,
      tableHeavyCellF1ImprovementTargetPp: 5,
      resourceCeilings: "eval/docling/report/lab-config.json at commit",
    };
    finalRecord.reportKey = (validKey().key ?? {}) as typeof finalRecord.reportKey;
    const stillPending = validateGateBRecord(finalRecord, "final");
    expect(stillPending).toEqual([]);

    const recordedWithoutEvidence = clone(finalRecord) as typeof finalRecord;
    recordedWithoutEvidence.gates[0] = { id: "parse_success", caseCount: 36, status: "recorded", result: "ok" };
    expect(validateGateBRecord(recordedWithoutEvidence, "final").join("\n")).toContain("must cite the run or file");
  });

  it("keeps the template's caseCounts describing the shipped manifest", () => {
    const counts = new Map(template.gates.map((gate: { id: string; caseCount: number }) => [gate.id, gate.caseCount]));
    const tableFixtures = manifest.fixtures.filter(
      (fixture: { tables: unknown[] }) => fixture.tables.length > 0,
    ).length;
    expect(counts.get("parse_success")).toBe(manifest.fixtures.length);
    expect(counts.get("resource_bounds")).toBe(manifest.fixtures.length + manifest.hostile.length);
    expect(counts.get("table_precision_recall")).toBe(tableFixtures);
    expect(counts.get("numeric_exactness")).toBe(manifest.fixtures.length);
    expect(counts.get("hostile_containment")).toBe(manifest.hostile.length);
  });
});
