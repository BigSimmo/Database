#!/usr/bin/env node
/**
 * Prevent the append-only branch review ledger from becoming a recurring merge
 * hazard. The union driver preserves concurrent appends; this gate catches a
 * missing attribute, accidentally committed conflict markers, and exact duplicate
 * records before they can land on the shared branch.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER_PATH = "docs/branch-review-ledger.md";
const PROTOCOL_PATH = "docs/codex-review-protocol.md";

const conflictMarker = /^(?:<{7}(?: .*)?|={7}|>{7}(?: .*)?)\r?$/gm;
const datedTableRow = /^\| \d{4}-\d{2}-\d{2} \|/;

export function validateLedger({ ledger, mergeAttribute, protocol }) {
  const failures = [];

  if (mergeAttribute !== "union") {
    failures.push(`${LEDGER_PATH} must resolve to merge=union (found ${JSON.stringify(mergeAttribute || "unset")}).`);
  }

  const markers = [...ledger.matchAll(conflictMarker)];
  if (markers.length > 0) {
    const lines = markers.map((match) => ledger.slice(0, match.index).split(/\r?\n/).length);
    failures.push(`conflict marker(s) found at ledger line(s): ${lines.join(", ")}.`);
  }

  const rows = ledger.split(/\r?\n/).filter((line) => datedTableRow.test(line));
  const seen = new Set();
  const duplicates = [];
  for (const row of rows) {
    if (seen.has(row)) duplicates.push(row);
    seen.add(row);
  }
  if (duplicates.length > 0) {
    failures.push(`${duplicates.length} exact duplicate review record(s) found.`);
  }

  if (!ledger.includes("This file is append-only.")) {
    failures.push(`${LEDGER_PATH} is missing its append-only editing contract.`);
  }
  if (!protocol.includes("The ledger is append-only:")) {
    failures.push(`${PROTOCOL_PATH} is missing its append-only reviewer instruction.`);
  }

  return { failures, recordCount: rows.length };
}

function effectiveMergeAttribute() {
  const output = execFileSync("git", ["check-attr", "merge", "--", LEDGER_PATH], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  return output.match(/:\s*merge:\s*(\S+)$/)?.[1] ?? "";
}

function assert(condition, label) {
  if (!condition) throw new Error(`self-test failed: ${label}`);
}

function selfTest() {
  const valid = {
    ledger: "# Ledger\n\nThis file is append-only.\n| 2026-07-24 | branch | head | scope | outcome | checks |\n",
    mergeAttribute: "union",
    protocol: "The ledger is append-only: append corrections.",
  };

  assert(validateLedger(valid).failures.length === 0, "valid ledger passes");
  assert(
    validateLedger({ ...valid, mergeAttribute: "" }).failures.some((failure) => failure.includes("merge=union")),
    "missing union attribute fails",
  );
  assert(
    validateLedger({ ...valid, ledger: `${valid.ledger}<<<<<<< ours\n` }).failures.some((failure) =>
      failure.includes("conflict marker"),
    ),
    "conflict marker fails",
  );
  const row = "| 2026-07-24 | branch | head | scope | outcome | checks |";
  assert(
    validateLedger({ ...valid, ledger: `This file is append-only.\n${row}\n${row}\n` }).failures.some((failure) =>
      failure.includes("duplicate"),
    ),
    "exact duplicate record fails",
  );
  assert(
    validateLedger({ ...valid, protocol: "append records" }).failures.some((failure) =>
      failure.includes("reviewer instruction"),
    ),
    "missing protocol contract fails",
  );

  console.log("branch-review-ledger self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }

  const result = validateLedger({
    ledger: readFileSync(path.join(root, LEDGER_PATH), "utf8"),
    mergeAttribute: effectiveMergeAttribute(),
    protocol: readFileSync(path.join(root, PROTOCOL_PATH), "utf8"),
  });

  if (result.failures.length > 0) {
    console.error("Branch review ledger guard failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Branch review ledger guard passed: ${result.recordCount} table records, union merge active, no conflict markers or exact duplicates.`,
  );
}

main();
