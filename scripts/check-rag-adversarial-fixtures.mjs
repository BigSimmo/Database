#!/usr/bin/env node
/**
 * check-rag-adversarial-fixtures.mjs — validate the RAG adversarial fixture
 * dataset and its baseline record (programme packet B0,
 * docs/rag-improvement/README.md §B0).
 *
 * Run: `npm run check:rag:adversarial-fixtures`.
 *
 * This is a separate command from `check:rag:fixtures`, which validates the golden
 * retrieval fixture and the offline contract manifest and is deliberately left
 * untouched. Nothing here reads the network, the database, or a provider: it parses
 * three repository files, applies scripts/rag-adversarial-contract.mjs, and prints
 * counts. The same validation runs inside the unit suite via
 * tests/rag-adversarial-fixtures.test.ts, so the contract holds on every PR whether
 * or not this command is invoked; CI routing for the adversarial *runner* is packet
 * B2's work, not this one's.
 *
 * The last step is the one that matters for Gate A: the report this script prints is
 * scanned for every registered canary literal before it is written to stdout. A
 * canary reaching a reportable sink is a hard failure, not a warning.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReport,
  collectCanaryTokens,
  findCanaryLeaks,
  validateAdversarialDataset,
  validateBaselineRecord,
} from "./rag-adversarial-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetPath = "scripts/fixtures/rag-adversarial-cases.v1.json";
const baselinePath = "scripts/fixtures/rag-adversarial-baseline.v1.json";
const versioningPath = "src/lib/rag/rag-versioning.ts";

const readJson = (relative) => JSON.parse(readFileSync(path.join(repoRoot, relative), "utf8"));

/** The live prompt version, so the baseline cannot silently describe an older prompt. */
function readPromptVersion() {
  const source = readFileSync(path.join(repoRoot, versioningPath), "utf8");
  return source.match(/ragAnswerPromptVersion\s*=\s*"([^"]+)"/)?.[1] ?? "";
}

const dataset = readJson(datasetPath);
const baseline = readJson(baselinePath);

const failures = [
  ...validateAdversarialDataset(dataset).map((failure) => `${datasetPath} — ${failure}`),
  ...validateBaselineRecord(baseline, {
    promptVersion: readPromptVersion(),
    datasetVersion: dataset.datasetVersion,
  }).map((failure) => `${baselinePath} — ${failure}`),
];

if (failures.length > 0) {
  console.error("RAG adversarial fixture and baseline validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const report = buildReport(dataset, baseline);
const leaked = findCanaryLeaks(report, collectCanaryTokens(dataset));
if (leaked.length > 0) {
  // Deliberately does not name the tokens: printing them would be the leak.
  console.error(`RAG adversarial validation failed: ${leaked.length} canary literal(s) reached the report output.`);
  process.exit(1);
}

console.log(report);
