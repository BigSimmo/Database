#!/usr/bin/env node
/**
 * flake-ledger — loader + matcher for the known-flaky Playwright specs recorded in
 * tests/flake-ledger.json.
 *
 * Purpose: stop re-diagnosing the same flakes from memory every time CI goes red.
 * The CI failure-triage workflow uses isKnownFlake() to attribute a failed test to
 * a known flake; a serial re-run of only-flaky failures can be layered on top.
 *
 * CLI:
 *   node scripts/flake-ledger.mjs --list        print the ledger
 *   node scripts/flake-ledger.mjs --self-test   validate shape + matcher
 *   node scripts/flake-ledger.mjs --match "<test title>"   → prints matching id or "none"
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LEDGER_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tests", "flake-ledger.json");

export function loadFlakeLedger(ledgerPath = LEDGER_PATH) {
  const raw = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const flakes = Array.isArray(raw.flakes) ? raw.flakes : [];
  for (const flake of flakes) {
    if (!flake.id || !flake.match || !flake.spec || !flake.reason) {
      throw new Error(`flake-ledger entry missing required field (id/match/spec/reason): ${JSON.stringify(flake)}`);
    }
  }
  return flakes;
}

/** Return the matching flake entry for a test title, or null. Case-insensitive substring. */
export function matchFlake(testTitle, flakes = loadFlakeLedger()) {
  if (!testTitle) return null;
  const haystack = String(testTitle).toLowerCase();
  return flakes.find((flake) => haystack.includes(String(flake.match).toLowerCase())) ?? null;
}

export function isKnownFlake(testTitle, flakes = loadFlakeLedger()) {
  return matchFlake(testTitle, flakes) !== null;
}

function selfTest() {
  const flakes = loadFlakeLedger();
  const assert = (cond, label) => {
    if (!cond) {
      console.error(`✖ self-test failed: ${label}`);
      process.exitCode = 1;
      throw new Error(label);
    }
  };
  assert(flakes.length > 0, "ledger is non-empty");
  const ids = new Set(flakes.map((f) => f.id));
  assert(ids.size === flakes.length, "flake ids are unique");
  assert(isKnownFlake("composer hero renders on hydrate", flakes), "matches a known flake by title substring");
  assert(!isKnownFlake("a totally unrelated passing test", flakes), "does not match an unrelated title");
  assert(matchFlake("", flakes) === null, "empty title matches nothing");
  if (process.exitCode !== 1) console.error("[flake-ledger] self-test passed");
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  if (process.argv.includes("--list")) {
    for (const flake of loadFlakeLedger()) console.log(`${flake.id}\t${flake.spec}\t"${flake.match}"`);
    return;
  }
  const matchIndex = process.argv.indexOf("--match");
  if (matchIndex >= 0) {
    const hit = matchFlake(process.argv[matchIndex + 1], loadFlakeLedger());
    console.log(hit ? hit.id : "none");
    return;
  }
  console.error('usage: flake-ledger.mjs [--list | --self-test | --match "<title>"]');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
