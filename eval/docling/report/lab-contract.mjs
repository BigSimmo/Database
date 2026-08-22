/**
 * lab-contract.mjs — pure validation and report assembly for the isolated Docling
 * lab benchmark (programme packet B3, docs/rag-improvement/README.md §B3).
 *
 * Deliberately dependency-free and network-free, like scripts/rag-adversarial-contract.mjs
 * (packet B0), whose shared conventions this module imports rather than re-declares:
 * the six-field report key, the canary-leak scan, and the real-source denylist. The
 * gate-status discipline is the same: a result is either `recorded` with evidence or
 * `pending_owner_run` with a reason — a number without a run behind it is the failure
 * mode both records exist to prevent.
 *
 * The rules a JSON Schema cannot express are the reason this file exists:
 *  - every assertion string is literally present in its fixture's own text or cells,
 *    so ground truth cannot drift from what the generator renders;
 *  - every planted canary is declared and every declared canary is planted;
 *  - the aggregate report is built through a numeric allowlist, so fixture text can
 *    never leak into a reportable sink even if a measurement file carries it;
 *  - the Gate B record's pre-agreed thresholds exist before any result may be recorded.
 */
import {
  reportKeyFields,
  canaryKinds,
  findCanaryLeaks,
  findRealSourceMentions,
} from "../../../scripts/rag-adversarial-contract.mjs";

export const labDatasetVersion = "docling-lab-fixtures.v1";
export const labReportVersion = "docling-lab-report.v1";
export const gateBRecordVersion = "docling-lab-gate-b.v1";

export const labStrata = Object.freeze([
  "text_simple",
  "layout_multicolumn",
  "table_simple",
  "table_heavy",
  "scanned_ocr",
  "numeric_dense",
]);

export const hostileConstructions = Object.freeze([
  "truncated_pdf",
  "malformed_xref",
  "deep_object_nesting",
  "compression_bomb",
  "encrypted_pdf",
  "zero_byte",
  "absurd_mediabox",
  "mislabelled_extension",
  "huge_page_tree",
  "injection_text",
]);

export const labEngines = Object.freeze(["legacy", "docling"]);

/** Gate B measures, one gate per safety/exactness surface README §B3 names. */
export const labGateIds = Object.freeze([
  "parse_success",
  "resource_bounds",
  "table_precision_recall",
  "numeric_exactness",
  "hostile_containment",
]);

export const assertionKinds = Object.freeze(["number", "number_unit", "comparator"]);

// Same shape as the S4 contract's token rule (letters only — digit-bearing canaries
// read as secrets to Gitleaks/GitGuardian). The regex is not exported there, so it is
// restated here; the kinds list is imported, keeping the registry vocabulary shared.
const CANARY_TOKEN = /^CANARY-[A-Z]+(?:-[A-Z]+)+$/;
const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

function missingFields(value, required, label, failures) {
  for (const field of required) {
    if (!isObject(value) || !(field in value)) failures.push(`${label}: missing required field '${field}'`);
  }
}

const flattenWhitespace = (text) => text.split(/\s+/).join(" ").trim();

/** Every prose fragment of a fixture the generator will render. */
function fixtureTextFragments(fixture) {
  const fragments = [fixture.title, ...(Array.isArray(fixture.bodyText) ? fixture.bodyText : [])];
  if (Array.isArray(fixture.tables)) {
    for (const table of fixture.tables) {
      if (!isObject(table) || !Array.isArray(table.cells)) continue;
      for (const cell of table.cells) if (isObject(cell)) fragments.push(cell.text);
    }
  }
  return fragments.filter((fragment) => typeof fragment === "string");
}

export function collectManifestCanaryTokens(manifest) {
  if (!isObject(manifest) || !Array.isArray(manifest.canaryRegistry)) return [];
  return manifest.canaryRegistry.map((entry) => (isObject(entry) ? entry.token : entry)).filter(hasText);
}

function validateRegistry(manifest, failures) {
  const registry = manifest.canaryRegistry;
  if (!Array.isArray(registry) || registry.length === 0) {
    failures.push("canaryRegistry must be a non-empty array");
    return;
  }
  const seen = new Set();
  registry.forEach((entry, index) => {
    const label = `canaryRegistry[${index}]`;
    missingFields(entry, ["token", "kind", "note"], label, failures);
    if (!isObject(entry)) return;
    if (!hasText(entry.token) || !CANARY_TOKEN.test(entry.token)) {
      failures.push(`${label}: token must match ${CANARY_TOKEN} so detection is an exact literal scan`);
    } else if (seen.has(entry.token)) {
      failures.push(`${label}: duplicate canary token ${entry.token}`);
    } else {
      seen.add(entry.token);
    }
    if (!canaryKinds.includes(entry.kind)) failures.push(`${label}: kind must be one of ${canaryKinds.join(", ")}`);
    if (!hasText(entry.note)) failures.push(`${label}: note is required`);
  });
}

function validateTable(fixture, table, index, seenTableIds, failures) {
  const label = `${fixture.id}.tables[${index}]`;
  missingFields(table, ["tableId", "page", "rows", "cols", "cells"], label, failures);
  if (!isObject(table)) return;
  if (!hasText(table.tableId)) failures.push(`${label}: tableId is required`);
  else if (seenTableIds.has(table.tableId)) failures.push(`${label}: duplicate tableId ${table.tableId}`);
  else seenTableIds.add(table.tableId);
  if (!Number.isInteger(table.page) || table.page < 1 || table.page > fixture.pages) {
    failures.push(`${label}: page must be within the fixture's ${fixture.pages} page(s)`);
  }
  if (!Number.isInteger(table.rows) || table.rows < 2) failures.push(`${label}: rows must be an integer >= 2`);
  if (!Number.isInteger(table.cols) || table.cols < 2) failures.push(`${label}: cols must be an integer >= 2`);
  if (!Array.isArray(table.cells) || table.cells.length === 0) {
    failures.push(`${label}: cells must be a non-empty array`);
    return;
  }
  const positions = new Set();
  const headerCols = new Set();
  for (const cell of table.cells) {
    if (!isObject(cell) || !Number.isInteger(cell.row) || !Number.isInteger(cell.col) || !hasText(cell.text)) {
      failures.push(`${label}: every cell needs integer row/col and non-empty text`);
      continue;
    }
    const colSpan = Number.isInteger(cell.colSpan) && cell.colSpan > 1 ? cell.colSpan : 1;
    const rowSpan = Number.isInteger(cell.rowSpan) && cell.rowSpan > 1 ? cell.rowSpan : 1;
    if (cell.row < 0 || cell.row + rowSpan > table.rows || cell.col < 0 || cell.col + colSpan > table.cols) {
      failures.push(
        `${label}: cell (${cell.row},${cell.col}) is outside the declared ${table.rows}x${table.cols} grid`,
      );
    }
    for (let r = 0; r < rowSpan; r++) {
      for (let c = 0; c < colSpan; c++) {
        const position = `${cell.row + r}:${cell.col + c}`;
        if (positions.has(position)) failures.push(`${label}: duplicate cell at (${cell.row + r},${cell.col + c})`);
        positions.add(position);
      }
    }
    if (cell.row === 0) {
      for (let c = 0; c < colSpan; c++) headerCols.add(cell.col + c);
    }
  }
  if (headerCols.size !== table.cols) {
    failures.push(`${label}: header row 0 must fill all ${table.cols} columns — table recall scoring anchors on it`);
  }
}

function validateAssertion(fixture, assertion, index, seenAssertionIds, haystack, failures) {
  const label = `${fixture.id}.assertions[${index}]`;
  missingFields(assertion, ["id", "kind", "text", "value"], label, failures);
  if (!isObject(assertion)) return;
  if (!hasText(assertion.id)) failures.push(`${label}: id is required`);
  else if (seenAssertionIds.has(assertion.id)) failures.push(`${label}: duplicate assertion id ${assertion.id}`);
  else seenAssertionIds.add(assertion.id);
  if (!assertionKinds.includes(assertion.kind)) {
    failures.push(`${label}: kind must be one of ${assertionKinds.join(", ")}`);
  }
  if (!hasText(assertion.text)) {
    failures.push(`${label}: text is required`);
    return;
  }
  if (assertion.kind === "number_unit" && !hasText(assertion.unit)) {
    failures.push(`${label}: number_unit assertions must carry a unit`);
  }
  if (assertion.kind === "comparator" && !hasText(assertion.comparator)) {
    failures.push(`${label}: comparator assertions must carry a comparator`);
  }
  // Ground truth by construction: the assertion string must exist in the fixture's own
  // declared text, because the generator renders exactly that text.
  if (!haystack.includes(flattenWhitespace(assertion.text))) {
    failures.push(`${label}: text '${assertion.text}' does not appear in the fixture's bodyText or table cells`);
  }
}

function validateFixture(fixture, index, tokens, seenIds, seenTableIds, failures) {
  const label = isObject(fixture) && hasText(fixture.id) ? `fixtures[${index}] (${fixture.id})` : `fixtures[${index}]`;
  missingFields(
    fixture,
    ["id", "stratum", "pages", "title", "bodyText", "tables", "assertions", "plantedCanaries"],
    label,
    failures,
  );
  if (!isObject(fixture)) return;

  if (!hasText(fixture.id) || !KEBAB_ID.test(fixture.id)) failures.push(`${label}: id must be lowercase kebab-case`);
  else if (seenIds.has(fixture.id)) failures.push(`${label}: duplicate fixture id`);
  else seenIds.add(fixture.id);

  if (!labStrata.includes(fixture.stratum)) failures.push(`${label}: stratum must be one of ${labStrata.join(", ")}`);
  if (!Number.isInteger(fixture.pages) || fixture.pages < 1)
    failures.push(`${label}: pages must be a positive integer`);
  if (!hasText(fixture.title) || !fixture.title.startsWith("SYNTHETIC ")) {
    failures.push(`${label}: title must start with 'SYNTHETIC ' to assert synthetic provenance`);
  }
  if (!Array.isArray(fixture.bodyText) || fixture.bodyText.length === 0 || !fixture.bodyText.every(hasText)) {
    failures.push(`${label}: bodyText must be a non-empty array of non-empty strings`);
  }

  if (!Array.isArray(fixture.tables)) failures.push(`${label}: tables must be an array`);
  else fixture.tables.forEach((table, tableIndex) => validateTable(fixture, table, tableIndex, seenTableIds, failures));

  const fragments = fixtureTextFragments(fixture);
  const haystack = flattenWhitespace(fragments.join("\n"));

  for (const fragment of fragments) {
    for (const mention of findRealSourceMentions(fragment)) {
      failures.push(`${label}: names real clinical source '${mention}' — fixtures are synthetic only`);
    }
  }

  const seenAssertionIds = new Set();
  if (!Array.isArray(fixture.assertions) || fixture.assertions.length === 0) {
    failures.push(`${label}: assertions must be a non-empty array — an unscored fixture proves nothing`);
  } else {
    fixture.assertions.forEach((assertion, assertionIndex) =>
      validateAssertion(fixture, assertion, assertionIndex, seenAssertionIds, haystack, failures),
    );
  }

  const planted = new Set();
  for (const fragment of fragments) for (const token of findCanaryLeaks(fragment, tokens)) planted.add(token);
  if (!Array.isArray(fixture.plantedCanaries)) {
    failures.push(`${label}: plantedCanaries must be an array`);
  } else {
    for (const token of fixture.plantedCanaries) {
      if (!tokens.includes(token)) failures.push(`${label}: canary ${token} is not in canaryRegistry`);
      else if (!planted.has(token)) failures.push(`${label}: canary ${token} is declared but never planted`);
    }
    for (const token of planted) {
      if (!fixture.plantedCanaries.includes(token))
        failures.push(`${label}: canary ${token} is planted but not declared`);
    }
  }
}

function validateHostileEntry(entry, index, tokens, seenIds, seenConstructions, failures) {
  const label = isObject(entry) && hasText(entry.id) ? `hostile[${index}] (${entry.id})` : `hostile[${index}]`;
  missingFields(entry, ["id", "construction", "description", "expect"], label, failures);
  if (!isObject(entry)) return;

  if (!hasText(entry.id) || !KEBAB_ID.test(entry.id)) failures.push(`${label}: id must be lowercase kebab-case`);
  else if (seenIds.has(entry.id)) failures.push(`${label}: duplicate hostile id`);
  else seenIds.add(entry.id);

  if (!hostileConstructions.includes(entry.construction)) {
    failures.push(`${label}: construction must be one of ${hostileConstructions.join(", ")}`);
  } else if (seenConstructions.has(entry.construction)) {
    failures.push(`${label}: duplicate construction ${entry.construction} — each hostile shape is exercised once`);
  } else {
    seenConstructions.add(entry.construction);
  }
  if (!hasText(entry.description)) failures.push(`${label}: description is required`);

  for (const fragment of [entry.description, entry.embeddedText].filter((value) => typeof value === "string")) {
    for (const mention of findRealSourceMentions(fragment)) {
      failures.push(`${label}: names real clinical source '${mention}' — fixtures are synthetic only`);
    }
  }

  const expectation = entry.expect;
  if (!isObject(expectation) || typeof expectation.containedFailure !== "boolean") {
    failures.push(`${label}.expect: containedFailure must be a boolean`);
  } else if (entry.construction === "injection_text" && expectation.containedFailure !== false) {
    failures.push(
      `${label}.expect: injection_text parses successfully — containment is about its content, not a failure`,
    );
  } else if (entry.construction !== "injection_text" && expectation.containedFailure !== true) {
    failures.push(`${label}.expect: byte-hostile constructions must expect a contained failure`);
  }
  if (!isObject(expectation) || expectation.noCrashArtifacts !== true) {
    failures.push(`${label}.expect: noCrashArtifacts must be exactly true`);
  }

  if (entry.construction === "injection_text" && !hasText(entry.embeddedText)) {
    failures.push(`${label}: injection_text requires embeddedText`);
  }
  const planted = new Set(findCanaryLeaks(entry.embeddedText ?? "", tokens));
  const declared = Array.isArray(entry.plantedCanaries) ? entry.plantedCanaries : [];
  for (const token of declared) {
    if (!tokens.includes(token)) failures.push(`${label}: canary ${token} is not in canaryRegistry`);
    else if (!planted.has(token)) failures.push(`${label}: canary ${token} is declared but never planted`);
  }
  for (const token of planted) {
    if (!declared.includes(token)) failures.push(`${label}: canary ${token} is planted but not declared`);
  }
}

/** Validate the lab fixture manifest. Returns a list of failures. */
export function validateLabManifest(manifest) {
  const failures = [];
  if (!isObject(manifest)) return ["lab manifest must be an object"];

  missingFields(
    manifest,
    ["datasetVersion", "synthetic", "description", "generatorSeed", "strata", "canaryRegistry", "fixtures", "hostile"],
    "manifest",
    failures,
  );
  if (manifest.datasetVersion !== labDatasetVersion) {
    failures.push(`manifest: datasetVersion must be '${labDatasetVersion}' and match the fixture filename`);
  }
  if (manifest.synthetic !== true) failures.push("manifest: synthetic must be exactly true");
  if (!hasText(manifest.description)) failures.push("manifest: description is required");
  if (!Number.isInteger(manifest.generatorSeed)) failures.push("manifest: generatorSeed must be an integer");
  if (
    !Array.isArray(manifest.strata) ||
    manifest.strata.length !== labStrata.length ||
    manifest.strata.some((stratum, index) => stratum !== labStrata[index])
  ) {
    failures.push(`manifest: strata must be exactly ${labStrata.join(", ")} in that order`);
  }

  validateRegistry(manifest, failures);
  const tokens = collectManifestCanaryTokens(manifest);

  if (!Array.isArray(manifest.fixtures)) {
    failures.push("manifest: fixtures must be an array");
    return failures;
  }
  if (manifest.fixtures.length < 30 || manifest.fixtures.length > 50) {
    failures.push(`manifest: fixtures must contain 30-50 entries (found ${manifest.fixtures.length}) — README §B3`);
  }

  const seenIds = new Set();
  const seenTableIds = new Set();
  manifest.fixtures.forEach((fixture, index) =>
    validateFixture(fixture, index, tokens, seenIds, seenTableIds, failures),
  );

  const perStratum = new Map(labStrata.map((stratum) => [stratum, 0]));
  for (const fixture of manifest.fixtures) {
    if (isObject(fixture) && perStratum.has(fixture.stratum)) {
      perStratum.set(fixture.stratum, perStratum.get(fixture.stratum) + 1);
    }
  }
  for (const [stratum, count] of perStratum) {
    if (count < 5) failures.push(`manifest: stratum ${stratum} needs at least 5 fixtures (found ${count})`);
  }

  if (!Array.isArray(manifest.hostile)) {
    failures.push("manifest: hostile must be an array");
    return failures;
  }
  if (manifest.hostile.length < 8 || manifest.hostile.length > 12) {
    failures.push(`manifest: hostile corpus must contain 8-12 entries (found ${manifest.hostile.length})`);
  }
  const seenConstructions = new Set();
  manifest.hostile.forEach((entry, index) =>
    validateHostileEntry(entry, index, tokens, seenIds, seenConstructions, failures),
  );

  // Canary breadth, as in the S4 dataset: a leak scan that only exercises one corner
  // proves little, and an unplanted registry token silently stops testing anything.
  const plantedBuckets = new Set();
  const plantedTokens = new Set();
  for (const fixture of manifest.fixtures) {
    if (!isObject(fixture) || !Array.isArray(fixture.plantedCanaries) || fixture.plantedCanaries.length === 0) continue;
    plantedBuckets.add(fixture.stratum);
    for (const token of fixture.plantedCanaries) plantedTokens.add(token);
  }
  for (const entry of manifest.hostile) {
    if (!isObject(entry) || !Array.isArray(entry.plantedCanaries) || entry.plantedCanaries.length === 0) continue;
    plantedBuckets.add("hostile");
    for (const token of entry.plantedCanaries) plantedTokens.add(token);
  }
  if (plantedBuckets.size < 4) {
    failures.push(
      `manifest: canaries must be planted across at least 4 strata/hostile buckets (found ${plantedBuckets.size})`,
    );
  }
  for (const token of tokens) {
    if (!plantedTokens.has(token)) failures.push(`manifest: registry canary ${token} is never planted`);
  }

  return failures;
}

/**
 * Assemble the six-field report key in the pinned order. `sources` carries values the
 * CLI reads from the repository so this function stays pure:
 * `{ commitSha, datasetVersion, indexVersion, config }`.
 */
export function buildReportKey(sources) {
  const failures = [];
  if (!isObject(sources)) return { key: null, failures: ["report-key sources must be an object"] };
  const config = sources.config;
  const keySources = isObject(config) ? config.reportKeySources : null;
  if (!isObject(keySources)) failures.push("lab-config: reportKeySources is required");
  if (!hasText(sources.commitSha) || !COMMIT_SHA.test(sources.commitSha)) {
    failures.push("report key: commitSha must be a full 40-character lowercase SHA");
  }
  if (sources.datasetVersion !== labDatasetVersion) {
    failures.push(`report key: datasetVersion must be '${labDatasetVersion}'`);
  }
  if (!hasText(sources.indexVersion)) failures.push("report key: indexVersion is required");
  if (failures.length > 0) return { key: null, failures };

  const key = {
    commit_sha: sources.commitSha,
    dataset_version: sources.datasetVersion,
    eval_config_version: keySources.eval_config_version,
    model_version: keySources.model_version,
    embedding_version: keySources.embedding_version,
    index_version: sources.indexVersion,
  };
  for (const field of reportKeyFields) {
    if (!hasText(key[field])) failures.push(`report key: ${field} is required`);
  }
  // The field order is part of the S4 contract; building from a literal keeps it, and
  // this assertion keeps a future edit honest.
  const actual = Object.keys(key);
  if (actual.length !== reportKeyFields.length || actual.some((field, index) => field !== reportKeyFields[index])) {
    failures.push(`report key: fields must be exactly ${reportKeyFields.join(", ")} in that order`);
  }
  return failures.length > 0 ? { key: null, failures } : { key, failures: [] };
}

/**
 * The only measurement fields a report may carry, per bucket. Copying through this
 * allowlist — never spreading — is what makes the report aggregate-only by
 * construction: a measurements file polluted with fixture text cannot leak, because
 * nothing outside these numeric keys is ever read.
 */
export const stratumStatKeys = Object.freeze([
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

export const hostileStatKeys = Object.freeze(["docCount", "containedCount", "crashArtifactCount", "canaryEchoCount"]);

function copyNumericStats(source, allowedKeys, label, failures) {
  const copied = {};
  for (const key of allowedKeys) {
    const value = isObject(source) ? source[key] : undefined;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      failures.push(`${label}: '${key}' must be a finite number`);
      continue;
    }
    copied[key] = value;
  }
  return copied;
}

const toPp = (value) => Math.round(value * 10000) / 100;

/** Build the aggregate-only lab report. Returns `{ report, failures }`. */
export function buildLabReport(measurements, key, config) {
  const failures = [];
  if (!isObject(measurements)) return { report: null, failures: ["measurements must be an object"] };
  if (measurements.datasetVersion !== labDatasetVersion) {
    failures.push(`measurements: datasetVersion must be '${labDatasetVersion}'`);
  }
  if (!isObject(config) || !isObject(config.sandbox) || !isObject(config.outputCaps)) {
    failures.push("lab-config: sandbox and outputCaps are required");
  }

  const engines = {};
  for (const engine of labEngines) {
    const source = isObject(measurements.engines) ? measurements.engines[engine] : undefined;
    if (!isObject(source)) {
      failures.push(`measurements: engines.${engine} is required`);
      continue;
    }
    const perStratum = {};
    for (const stratum of labStrata) {
      perStratum[stratum] = copyNumericStats(
        isObject(source.perStratum) ? source.perStratum[stratum] : undefined,
        stratumStatKeys,
        `measurements: engines.${engine}.perStratum.${stratum}`,
        failures,
      );
    }
    engines[engine] = {
      perStratum,
      hostile: copyNumericStats(source.hostile, hostileStatKeys, `measurements: engines.${engine}.hostile`, failures),
    };
  }
  if (failures.length > 0) return { report: null, failures };

  const comparison = { perStratum: {}, hostile: {} };
  for (const stratum of labStrata) {
    const legacy = engines.legacy.perStratum[stratum];
    const docling = engines.docling.perStratum[stratum];
    comparison.perStratum[stratum] = {
      parseSuccessDeltaPp: toPp(
        docling.parseSuccessCount / Math.max(1, docling.docCount) -
          legacy.parseSuccessCount / Math.max(1, legacy.docCount),
      ),
      tableCellF1DeltaPp: toPp(docling.tableCellF1 - legacy.tableCellF1),
      assertionCoverageDeltaPp: toPp(
        docling.assertionsFound / Math.max(1, docling.assertionsTotal) -
          legacy.assertionsFound / Math.max(1, legacy.assertionsTotal),
      ),
    };
  }
  comparison.hostile = {
    containedDeltaCount: engines.docling.hostile.containedCount - engines.legacy.hostile.containedCount,
    crashArtifactTotal: engines.docling.hostile.crashArtifactCount + engines.legacy.hostile.crashArtifactCount,
    canaryEchoTotal: engines.docling.hostile.canaryEchoCount + engines.legacy.hostile.canaryEchoCount,
  };

  const report = {
    reportVersion: labReportVersion,
    reportKey: key,
    labConfigVersion: config.labConfigVersion,
    extractorVersions: config.extractorVersions,
    sandbox: config.sandbox,
    outputCaps: config.outputCaps,
    engines,
    comparison,
  };
  return { report, failures: [] };
}

/**
 * Scan a serialised report for anything that must never reach a reportable sink.
 * Returns failure strings; a hit is a hard failure, and — as in the S4 CLI — the
 * caller must print counts, never the matched tokens themselves.
 */
export function scanReportForLeaks(serialisedReport, tokens) {
  const failures = [];
  const canaryHits = findCanaryLeaks(serialisedReport, tokens);
  if (canaryHits.length > 0) failures.push(`report leaks ${canaryHits.length} canary token(s)`);
  const sourceHits = findRealSourceMentions(serialisedReport);
  if (sourceHits.length > 0) failures.push(`report names ${sourceHits.length} real clinical source token(s)`);
  return failures;
}

/**
 * Validate a Gate B decision record. `mode` is "template" (shipped with the harness:
 * no thresholds agreed, every gate pending) or "final" (owner-filled after a
 * dispatched run: thresholds agreed and every gate recorded or explicitly pending).
 */
export function validateGateBRecord(record, mode = "template") {
  const failures = [];
  if (!isObject(record)) return ["gate B record must be an object"];
  if (!["template", "final"].includes(mode)) return [`unknown validation mode '${mode}'`];

  missingFields(record, ["recordVersion", "status", "preAgreedThresholds", "reportKey", "gates"], "gateB", failures);
  if (record.recordVersion !== gateBRecordVersion) {
    failures.push(`gateB: recordVersion must be '${gateBRecordVersion}'`);
  }
  if (mode === "template" && record.status !== "template") {
    failures.push("gateB: the committed template's status must be 'template'");
  }
  if (mode === "final" && !["pass", "fail", "deferred"].includes(record.status)) {
    failures.push("gateB: a final record's status must be 'pass', 'fail' or 'deferred'");
  }

  const thresholds = record.preAgreedThresholds;
  missingFields(
    thresholds,
    [
      "agreedBeforeRun",
      "parseSuccessNonInferiorityMarginPp",
      "numericExactnessNonInferiorityMarginPp",
      "tableHeavyCellF1ImprovementTargetPp",
      "resourceCeilings",
    ],
    "gateB.preAgreedThresholds",
    failures,
  );
  if (isObject(thresholds)) {
    const numericThresholds = [
      "parseSuccessNonInferiorityMarginPp",
      "numericExactnessNonInferiorityMarginPp",
      "tableHeavyCellF1ImprovementTargetPp",
    ];
    if (mode === "template") {
      if (thresholds.agreedBeforeRun !== false) {
        failures.push("gateB.preAgreedThresholds: the template ships with agreedBeforeRun false — the owner sets it");
      }
      for (const field of numericThresholds) {
        if (field in thresholds && thresholds[field] !== null) {
          failures.push(
            `gateB.preAgreedThresholds: ${field} must be null in the template — thresholds are owner-agreed`,
          );
        }
      }
    } else {
      if (thresholds.agreedBeforeRun !== true) {
        failures.push("gateB.preAgreedThresholds: a final record requires agreedBeforeRun true");
      }
      for (const field of numericThresholds) {
        if (field in thresholds && (typeof thresholds[field] !== "number" || !Number.isFinite(thresholds[field]))) {
          failures.push(`gateB.preAgreedThresholds: ${field} must be a finite number in a final record`);
        }
      }
    }
    if (!hasText(thresholds.resourceCeilings)) {
      failures.push("gateB.preAgreedThresholds: resourceCeilings must name where the ceilings are pinned");
    }
  }

  const key = record.reportKey;
  if (!isObject(key)) {
    failures.push("gateB: reportKey must be an object");
  } else {
    const actual = Object.keys(key);
    if (actual.length !== reportKeyFields.length || actual.some((field, index) => field !== reportKeyFields[index])) {
      failures.push(`gateB.reportKey: fields must be exactly ${reportKeyFields.join(", ")} in that order`);
    }
    for (const field of reportKeyFields) {
      if (!hasText(key[field])) failures.push(`gateB.reportKey: ${field} is required`);
    }
    if (mode === "template") {
      for (const field of reportKeyFields) {
        if (hasText(key[field]) && key[field] !== "pending_owner_run") {
          failures.push(`gateB.reportKey: template ${field} must be the literal 'pending_owner_run'`);
        }
      }
    } else if (hasText(key.commit_sha) && !COMMIT_SHA.test(key.commit_sha)) {
      failures.push("gateB.reportKey: commit_sha must be a full 40-character lowercase SHA");
    }
  }

  if (!Array.isArray(record.gates) || record.gates.length === 0) {
    failures.push("gateB: gates must be a non-empty array");
    return failures;
  }
  const seenGateIds = new Set();
  record.gates.forEach((gate, index) => {
    const label = isObject(gate) && hasText(gate.id) ? `gateB.gates (${gate.id})` : `gateB.gates[${index}]`;
    missingFields(gate, ["id", "caseCount", "status"], label, failures);
    if (!isObject(gate)) return;
    if (hasText(gate.id)) {
      if (seenGateIds.has(gate.id)) failures.push(`${label}: duplicate gate id`);
      seenGateIds.add(gate.id);
    }
    if (!Number.isInteger(gate.caseCount) || gate.caseCount < 1) {
      failures.push(`${label}: caseCount must be a positive integer`);
    }
    if (gate.status === "recorded") {
      if (mode === "template") failures.push(`${label}: the committed template must not carry recorded results`);
      if (!hasText(gate.result)) failures.push(`${label}: a recorded gate must carry its result`);
      if (!hasText(gate.evidence)) failures.push(`${label}: a recorded gate must cite the run or file it came from`);
    } else if (gate.status === "pending_owner_run") {
      if (!hasText(gate.blockedReason)) failures.push(`${label}: a pending gate must state why it has not run`);
      if ("result" in gate) failures.push(`${label}: a pending gate must not carry a result`);
      if ("priorRun" in gate && !hasText(gate.priorRun))
        failures.push(`${label}: priorRun must name the run it refers to`);
    } else {
      failures.push(`${label}: status must be 'recorded' or 'pending_owner_run'`);
    }
  });
  for (const required of labGateIds) {
    if (!seenGateIds.has(required)) failures.push(`gateB.gates: missing required gate '${required}'`);
  }

  return failures;
}

/** Human-readable summary lines: ids, counts and statuses only — never fixture text. */
export function buildSummaryLines(report) {
  const lines = [];
  lines.push(
    `Docling lab report ${report.reportVersion} at ${report.reportKey.commit_sha} ` +
      `(dataset ${report.reportKey.dataset_version}, config ${report.labConfigVersion}).`,
  );
  for (const stratum of labStrata) {
    const delta = report.comparison.perStratum[stratum];
    lines.push(
      `- ${stratum}: parse ${delta.parseSuccessDeltaPp >= 0 ? "+" : ""}${delta.parseSuccessDeltaPp}pp, ` +
        `table F1 ${delta.tableCellF1DeltaPp >= 0 ? "+" : ""}${delta.tableCellF1DeltaPp}pp, ` +
        `assertions ${delta.assertionCoverageDeltaPp >= 0 ? "+" : ""}${delta.assertionCoverageDeltaPp}pp`,
    );
  }
  lines.push(
    `- hostile: contained delta ${report.comparison.hostile.containedDeltaCount}, ` +
      `crash artifacts ${report.comparison.hostile.crashArtifactTotal}, ` +
      `canary echoes ${report.comparison.hostile.canaryEchoTotal}`,
  );
  return lines;
}
