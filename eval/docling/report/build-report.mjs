#!/usr/bin/env node
/**
 * build-report — assemble (or just validate) the Docling lab's aggregate-only report.
 *
 * Modes:
 *   --validate-only
 *       Offline contract check: the fixture manifest, the lab config, and the Gate B
 *       decision-record template. No measurements needed; this is what
 *       `npm run check:docling-lab` runs and what CI covers via the unit test.
 *   --validate-record <path> [--final]
 *       Validate a copied Gate B decision record (template mode by default; --final
 *       for an owner-filled record after a dispatched run).
 *   --raw <measurements.json> --out <report.json>
 *       Build the aggregate report from a benchmark run's raw measurements, stamp the
 *       S4 report key, scan the serialised report for canary/real-source leaks, and
 *       fail closed on any hit. Run on the host after the sandboxed phases finish —
 *       it needs `git rev-parse` and the migrations directory, nothing heavy.
 *
 * On a leak the process prints a count only: printing the matched tokens would be
 * the leak (same posture as scripts/check-rag-adversarial-fixtures.mjs).
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  validateLabManifest,
  validateGateBRecord,
  buildReportKey,
  buildLabReport,
  buildSummaryLines,
  scanReportForLeaks,
  collectManifestCanaryTokens,
  labDatasetVersion,
} from "./lab-contract.mjs";

const REPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const LAB_DIR = path.dirname(REPORT_DIR);
const REPO_ROOT = path.dirname(path.dirname(LAB_DIR));
const MANIFEST_PATH = path.join(LAB_DIR, "fixtures", "manifest.v1.json");
const CONFIG_PATH = path.join(REPORT_DIR, "lab-config.json");
const TEMPLATE_PATH = path.join(REPORT_DIR, "gate-b-decision-record.template.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function fail(failures) {
  for (const failure of failures) console.error(`docling-lab: ${failure}`);
  process.exit(1);
}

function latestMigrationVersion() {
  const migrationsDir = path.join(REPO_ROOT, "supabase", "migrations");
  const entries = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (entries.length === 0) fail(["no migrations found under supabase/migrations — cannot derive index_version"]);
  return entries[entries.length - 1].replace(/\.sql$/, "");
}

function validateOnly() {
  const failures = [];
  const manifest = readJson(MANIFEST_PATH);
  failures.push(...validateLabManifest(manifest));

  const config = readJson(CONFIG_PATH);
  if (config.labConfigVersion !== config.reportKeySources?.eval_config_version) {
    failures.push("lab-config: labConfigVersion and reportKeySources.eval_config_version must match");
  }

  const template = readJson(TEMPLATE_PATH);
  failures.push(...validateGateBRecord(template, "template"));

  // The template's gate caseCounts must describe the manifest that ships with them.
  const counts = new Map((template.gates ?? []).map((gate) => [gate.id, gate.caseCount]));
  const fixtureCount = manifest.fixtures?.length ?? 0;
  const hostileCount = manifest.hostile?.length ?? 0;
  const tableFixtureCount = (manifest.fixtures ?? []).filter((fixture) => (fixture.tables ?? []).length > 0).length;
  const expected = new Map([
    ["parse_success", fixtureCount],
    ["resource_bounds", fixtureCount + hostileCount],
    ["table_precision_recall", tableFixtureCount],
    ["numeric_exactness", fixtureCount],
    ["hostile_containment", hostileCount],
  ]);
  for (const [gateId, expectedCount] of expected) {
    if (counts.get(gateId) !== expectedCount) {
      failures.push(`gateB template: gate ${gateId} caseCount must be ${expectedCount} (found ${counts.get(gateId)})`);
    }
  }

  if (failures.length > 0) fail(failures);
  console.log(
    `docling-lab contract passed (${fixtureCount} fixtures, ${hostileCount} hostile, ` +
      `${collectManifestCanaryTokens(manifest).length} canaries; Gate B template valid).`,
  );
}

function validateRecord(recordPath, mode) {
  const failures = validateGateBRecord(readJson(path.resolve(recordPath)), mode);
  if (failures.length > 0) fail(failures);
  console.log(`docling-lab: Gate B record valid (${mode} mode).`);
}

function buildFromRaw(rawPath, outPath) {
  const manifest = readJson(MANIFEST_PATH);
  const manifestFailures = validateLabManifest(manifest);
  if (manifestFailures.length > 0) fail(manifestFailures);

  const config = readJson(CONFIG_PATH);
  const measurements = readJson(path.resolve(rawPath));

  const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  const { key, failures: keyFailures } = buildReportKey({
    commitSha,
    datasetVersion: labDatasetVersion,
    indexVersion: latestMigrationVersion(),
    config,
  });
  if (keyFailures.length > 0) fail(keyFailures);

  const { report, failures: reportFailures } = buildLabReport(measurements, key, config);
  if (reportFailures.length > 0) fail(reportFailures);

  const serialised = `${JSON.stringify(report, null, 2)}\n`;
  const leakFailures = scanReportForLeaks(serialised, collectManifestCanaryTokens(manifest));
  if (leakFailures.length > 0) fail(leakFailures);
  if (Buffer.byteLength(serialised, "utf8") > config.outputCaps.reportBytes) {
    fail([`report exceeds the ${config.outputCaps.reportBytes}-byte cap`]);
  }

  writeFileSync(path.resolve(outPath), serialised);
  for (const line of buildSummaryLines(report)) console.log(line);
  console.log(`Wrote ${outPath}`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--validate-only")) {
    validateOnly();
    return;
  }
  const recordFlag = args.indexOf("--validate-record");
  if (recordFlag !== -1) {
    const recordPath = args[recordFlag + 1];
    if (!recordPath) fail(["--validate-record requires a path"]);
    validateRecord(recordPath, args.includes("--final") ? "final" : "template");
    return;
  }
  const rawFlag = args.indexOf("--raw");
  const outFlag = args.indexOf("--out");
  if (rawFlag !== -1 && outFlag !== -1 && args[rawFlag + 1] && args[outFlag + 1]) {
    buildFromRaw(args[rawFlag + 1], args[outFlag + 1]);
    return;
  }
  fail(["usage: build-report.mjs --validate-only | --validate-record <path> [--final] | --raw <path> --out <path>"]);
}

main();
