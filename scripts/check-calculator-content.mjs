#!/usr/bin/env node
/**
 * Static governance guard for the calculator evidence/rights/golden-vector content that
 * `tests/calculators-governance-hardening.test.ts` also checks at runtime. This script is the
 * fast `verify:cheap` sibling: it reads the same JSON data files and the calculator fixtures
 * source text without importing the TypeScript module graph, so it stays cheap to run on every
 * push while the vitest suite does the authoritative check (it actually executes
 * `deriveCalculator` against every golden vector).
 *
 * It validates:
 *  - every evidence source in data/calculators/evidence.json carries accessedAt, lastReviewed
 *    and nextReview as well-formed ISO dates with nextReview after lastReviewed, and an
 *    explicit `supersedes` key.
 *  - data/calculators/golden-vectors.json exists, is valid JSON, and every entry has a
 *    calculatorId, a pinned responseAnchorSetId, and at least one vector with an answers
 *    object, a numeric expectedScore and a string expectedBand.
 *  - the registry's responseAnchorSetId for each calculator matches the pinned value in
 *    calculator-fixtures.ts, so the two files cannot silently drift apart.
 *  - every calculator fixture's active-instrument id has a rights record with status
 *    "available", a rights holder, digitalUseAllowed true, and explicit
 *    modificationAllowed/attributionRequired/verifiedAt fields.
 *  - every active calculator has a golden-vector registry entry.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidencePath = resolve(root, "data/calculators/evidence.json");
const vectorPath = resolve(root, "data/calculators/golden-vectors.json");
const fixturesPath = resolve(root, "src/components/calculators/calculator-fixtures.ts");

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  return typeof value === "string" && isoDate.test(value) && Number.isFinite(Date.parse(value));
}

/** Pulls the quoted string ids out of `new Set([...])` for activeCalculatorIds. */
function extractActiveCalculatorIds(source) {
  const match = source.match(/const activeCalculatorIds = new Set\(\[([^\]]*)\]\)/);
  if (!match) return null;
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

/** Pulls `id: "value"` pairs out of a named `Record<string, string>` object literal block. */
function extractStringRecord(source, constName) {
  const match = source.match(new RegExp(`const ${constName}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`));
  if (!match) return null;
  const record = {};
  for (const entry of match[1].matchAll(/(\w+):\s*"([^"]*)"/g)) record[entry[1]] = entry[2];
  return record;
}

/**
 * Pulls each `id: { ... },` object block out of the `rightsInfo` record and checks whether the
 * required fields for an available-rights instrument are present, without fully parsing the
 * object (values here are always string/boolean/date literals, never nested).
 */
function extractRightsBlocks(source) {
  const match = source.match(/const rightsInfo: Record<string, CalculatorRights> = \{([\s\S]*?)\n\};/);
  if (!match) return null;
  const body = match[1];
  const blocks = {};
  for (const entry of body.matchAll(/(\w+):\s*\{([^}]*)\}/g)) blocks[entry[1]] = entry[2];
  return blocks;
}

function main() {
  const errors = [];

  if (!existsSync(evidencePath)) {
    errors.push(`missing ${evidencePath}`);
  } else {
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    for (const source of evidence.sources ?? []) {
      const label = source.id ?? "<missing-id>";
      if (!validDate(source.accessedAt)) errors.push(`${label}: accessedAt must be an ISO date`);
      if (!validDate(source.lastReviewed)) errors.push(`${label}: lastReviewed must be an ISO date`);
      if (!validDate(source.nextReview)) errors.push(`${label}: nextReview must be an ISO date`);
      if (
        validDate(source.lastReviewed) &&
        validDate(source.nextReview) &&
        Date.parse(source.nextReview) <= Date.parse(source.lastReviewed)
      ) {
        errors.push(`${label}: nextReview must be after lastReviewed`);
      }
      if (!Object.prototype.hasOwnProperty.call(source, "supersedes")) errors.push(`${label}: missing supersedes key`);
    }
  }

  let vectorsByCalculatorId = new Map();
  if (!existsSync(vectorPath)) {
    errors.push(`missing ${vectorPath}`);
  } else {
    const registry = JSON.parse(readFileSync(vectorPath, "utf8"));
    const entries = Array.isArray(registry.calculators) ? registry.calculators : [];
    for (const entry of entries) {
      const label = entry.calculatorId ?? "<missing-calculatorId>";
      if (!entry.calculatorId) errors.push("golden-vector entry missing calculatorId");
      if (!entry.responseAnchorSetId) errors.push(`${label}: golden-vector entry missing responseAnchorSetId`);
      const vectors = Array.isArray(entry.vectors) ? entry.vectors : [];
      if (vectors.length === 0) errors.push(`${label}: golden-vector entry has no vectors`);
      vectors.forEach((vector, index) => {
        const vectorLabel = `${label} vector #${index}`;
        if (typeof vector?.answers !== "object" || vector.answers === null) {
          errors.push(`${vectorLabel}: answers must be an object`);
        }
        if (typeof vector?.expectedScore !== "number") errors.push(`${vectorLabel}: expectedScore must be a number`);
        if (typeof vector?.expectedBand !== "string" || !vector.expectedBand) {
          errors.push(`${vectorLabel}: expectedBand must be a non-empty string`);
        }
      });
      if (entry.calculatorId) vectorsByCalculatorId.set(entry.calculatorId, entry);
    }
  }

  if (!existsSync(fixturesPath)) {
    errors.push(`missing ${fixturesPath}`);
  } else {
    const source = readFileSync(fixturesPath, "utf8");
    const activeIds = extractActiveCalculatorIds(source);
    const responseAnchorSetIds = extractStringRecord(source, "responseAnchorSetIds");
    const rightsBlocks = extractRightsBlocks(source);

    if (!activeIds) errors.push("could not find activeCalculatorIds in calculator-fixtures.ts");
    if (!responseAnchorSetIds) errors.push("could not find responseAnchorSetIds in calculator-fixtures.ts");
    if (!rightsBlocks) errors.push("could not find rightsInfo in calculator-fixtures.ts");

    for (const id of activeIds ?? []) {
      const entry = vectorsByCalculatorId.get(id);
      if (!entry) {
        errors.push(`${id}: no golden-vector registry entry for this active calculator`);
      } else if (responseAnchorSetIds && entry.responseAnchorSetId !== responseAnchorSetIds[id]) {
        errors.push(
          `${id}: golden-vector responseAnchorSetId (${entry.responseAnchorSetId}) does not match the pinned fixture ID (${responseAnchorSetIds[id]})`,
        );
      }

      const rights = rightsBlocks?.[id];
      if (!rights) {
        errors.push(`${id}: no rightsInfo entry`);
        continue;
      }
      if (!/status:\s*"available"/.test(rights)) errors.push(`${id}: rights status must be "available"`);
      if (!/holder:\s*"[^"]+"/.test(rights)) errors.push(`${id}: rights holder must be a non-empty string`);
      if (!/digitalUseAllowed:\s*true/.test(rights)) errors.push(`${id}: digitalUseAllowed must be true`);
      if (!/modificationAllowed:\s*(true|false)/.test(rights)) errors.push(`${id}: modificationAllowed must be set`);
      if (!/attributionRequired:\s*(true|false)/.test(rights)) errors.push(`${id}: attributionRequired must be set`);
      if (!/verifiedAt:\s*"\d{4}-\d{2}-\d{2}"/.test(rights)) errors.push(`${id}: verifiedAt must be an ISO date`);
    }
  }

  if (errors.length) {
    console.error("CALCULATOR_CONTENT_FAIL");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`CALCULATOR_CONTENT_PASS sources=ok golden-vectors=ok rights=ok`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
