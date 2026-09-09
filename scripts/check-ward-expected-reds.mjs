#!/usr/bin/env node
/**
 * THE WARD SUITE'S FAILING SET MUST EQUAL THE MANIFEST — IN BOTH DIRECTIONS.
 *
 * 🔴 **WHY THIS EXISTS.** The convention was "one deliberate red; any second red is a real failure".
 * It degrades silently: with two reds a run LOOKS normal to whoever reads it next and neither gets
 * investigated. It broke twice on 2026-09-06 inside one hour — once when a fix sat unfolded and the
 * line genuinely carried two, and once when a red was retired under CI pressure by quoting a
 * builder's open position as if it were the owner's ruling.
 *
 * ⚠️ **THE THIRD CHECK IS THE POINT, AND AN `it.fails` TRIPWIRE CANNOT DO IT.** An entry that STOPS
 * failing fails this gate. `it.fails` passes on ANY error including a typo in the test body, and it
 * keeps passing after the underlying defect is fixed — so it converts a visible red into an
 * invisible green. Here, a red is retired by a person deleting its entry and saying why.
 *
 * ⚠️ **AND IT MUST BE A GATE WHILE THE MANIFEST IS EMPTY, WHICH IS THE STATE IT SHIPS IN.** Set
 * equality alone is vacuous against a broken run: discover nothing, run nothing, fail nothing, and
 * `actual === expected === {}` reports success. So the run is floored on BOTH the number of files
 * walked and the number of tests executed, and either floor breaking is a hard failure with its own
 * message. The floors are the load-bearing half of this script; the comparison is the easy half.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(projectRoot, "tests", "ward-expected-reds.json");

/**
 * Floors, deliberately well below the real population rather than at it.
 *
 * ⚠️ A floor set AT the current size goes red the day the population legitimately shrinks by one,
 * and the reflex is to lower it — which is how a floor becomes decoration. These sit far enough
 * below that only a BROKEN discovery or a BROKEN run trips them, and
 * `tests/ward-expected-reds-manifest.test.ts` asserts the real population still clears them, so the
 * headroom cannot silently evaporate.
 */
const FLOOR_FILES = 200;
const FLOOR_TESTS = 2500;

/**
 * The ward population, discovered from disk by the union the handover specifies: the `tests/ward-*`
 * glob PLUS any test file whose ward reference sits on a non-comment line, minus `tests/ui-*`.
 *
 * A glob alone misses files that exercise ward code without the name; matching any textual mention
 * pulls in files that only name it in prose. Union, not glob; executable, not mention.
 */
function wardPopulation() {
  const testsDir = path.join(projectRoot, "tests");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(test|spec)\.tsx?$/u.test(entry.name)) files.push(full);
    }
  };
  walk(testsDir);

  const chosen = new Set();
  for (const file of files) {
    const relative = path.relative(projectRoot, file).replace(/\\/gu, "/");
    if (relative.startsWith("tests/ui-")) continue;
    if (/^tests\/ward-/u.test(relative)) {
      chosen.add(relative);
      continue;
    }
    const executable = readFileSync(file, "utf8")
      .split("\n")
      .some((line) => /ward-(management|flow)/u.test(line) && !/^\s*(\*|\/\/|\/\*)/u.test(line));
    if (executable) chosen.add(relative);
  }
  return [...chosen].sort();
}

/**
 * The comparison, as a pure function, so BOTH directions can be proved without a nine-minute run.
 *
 * 🔴 **THE SECOND DIRECTION IS THE ONE THAT MATTERS AND THE ONE NOBODY TESTS.** "An unexpected red
 * fails the gate" is easy to believe and easy to check. "An entry that STOPS failing also fails the
 * gate" is the property `it.fails` structurally cannot give, it is the property that would have
 * caught a red being retired under deadline pressure — and it only ever fires on a day when
 * everything looks like it is going right. A control for it belongs in the suite, not in a habit.
 */
export function compareFailingSet({ failing, expected }) {
  const failingCount = new Map(failing.map((entry) => [entry.file, entry.count]));
  const expectedCount = new Map(expected.map((entry) => [entry.file, entry.failing]));

  const unexpected = [...failingCount.keys()].filter((file) => !expectedCount.has(file)).sort();
  const recovered = [...expectedCount.keys()].filter((file) => !failingCount.has(file)).sort();

  /*
   * ⚠️ **THE COUNT IS WHY FILE-LEVEL KEYING IS SAFE ENOUGH, and it is Ward Builder Three's fix.**
   * Keying on file alone, a listed file with one expected red and one NEW real red is
   * indistinguishable from a listed file with one expected red — the new failure hides inside an
   * entry that is already sanctioned. Pinning test NAMES would close it and re-open the wording-pin
   * trap, where a rename reads as a fix.
   *
   * An integer closes most of it for free: `assertionResults` is already in the report. A second red
   * in a listed file moves 1 to 2 and fails. **It does NOT close everything** — swap one red for
   * another in the same file and the count is unchanged — but it turns "any number of extra reds in
   * a listed file" into "only an exactly-compensating swap".
   */
  const miscounted = [...expectedCount.entries()]
    .filter(([file]) => failingCount.has(file))
    .filter(([file, expectedFailures]) => failingCount.get(file) !== expectedFailures)
    .map(([file, expectedFailures]) => ({ file, expected: expectedFailures, actual: failingCount.get(file) }))
    .sort((a, b) => a.file.localeCompare(b.file));

  return { unexpected, recovered, miscounted };
}

/**
 * Whether a run is big enough, and COMPLETE enough, to be worth comparing at all.
 *
 * 🔴 **`filesRan` VERSUS `files` IS THE ONE THAT MATTERS, AND THE FIRST VERSION OF THIS DID NOT HAVE
 * IT.** Found by Ward Builder Three reviewing the script rather than my summary of it. I floored on
 * files DISCOVERED and tests EXECUTED and never checked that the files I asked for came back.
 *
 * ⚠️ **THAT IS NOT HYPOTHETICAL ON THIS MACHINE.** It dropped test files three times tonight —
 * batches printing a normal summary having silently not run five files, and once two — on the same
 * box that OOMed a dev server and a commit hook. With files dropped: enough tests still run to clear
 * the sum floor, a dropped file that WOULD have failed is simply absent from `failing`, and if it is
 * not in the manifest **its red vanishes and the gate reports OK.** A new real red, silently
 * absorbed, which is the one thing this gate exists to prevent.
 *
 * **A floor on a SUM cannot substitute: a sum survives losing members.**
 */
export function floorBreaches({ files, filesRan, tests }, floors = { files: FLOOR_FILES, tests: FLOOR_TESTS }) {
  const breaches = [];
  if (files < floors.files) breaches.push(`files ${files} < ${floors.files}`);
  if (tests < floors.tests) breaches.push(`tests ${tests} < ${floors.tests}`);
  if (filesRan !== undefined && filesRan !== files) {
    breaches.push(`asked for ${files} files, ${filesRan} came back — ${files - filesRan} dropped`);
  }
  return breaches;
}

function fail(lines) {
  console.error(`\ncheck:ward-expected-reds FAILED\n`);
  for (const line of lines) console.error(line);
  console.error("");
  process.exit(1);
}

/*
 * Everything below runs ONLY when this file is executed directly. Importing it — which the control
 * test does — must never kick off the ward suite as a side effect.
 */
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (!invokedDirectly) {
  // Imported for its pure helpers above.
} else {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const expected = new Map(manifest.expected.map((entry) => [entry.file, entry]));

  const population = wardPopulation();
  if (population.length < FLOOR_FILES) {
    fail([
      `Discovered only ${population.length} ward test files, below the floor of ${FLOOR_FILES}.`,
      "",
      "This is a BROKEN DISCOVERY, not a small suite. The comparison below would have compared an",
      "empty failing set against an empty manifest and reported success — which is the exact vacuity",
      "this floor exists to stop. Fix the walk before trusting any result from this gate.",
    ]);
  }

  const reportDir = mkdtempSync(path.join(tmpdir(), "ward-reds-"));
  const reportPath = path.join(reportDir, "report.json");
  try {
    /*
     * Vitest is invoked DIRECTLY rather than through `scripts/run-vitest.mjs`, and that is deliberate:
     * the wrapper memoises a passing run behind a gate receipt, so a second invocation could hand this
     * gate a cached success without executing anything. A gate that can be satisfied by a cache is not
     * a gate. The cost is that this does not take the heavy-run lock, so it should not be run beside
     * another heavy suite.
     */
    try {
      execFileSync(
        process.execPath,
        [
          path.join(projectRoot, "node_modules", "vitest", "vitest.mjs"),
          "run",
          "--reporter=json",
          `--outputFile=${reportPath}`,
          ...population,
        ],
        { cwd: projectRoot, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, CI: "true" } },
      );
    } catch {
      // A non-zero exit is EXPECTED whenever anything is failing — which is the normal state when the
      // manifest is non-empty. The report is the evidence, not the exit code.
    }

    if (!existsSync(reportPath) || statSync(reportPath).size === 0) {
      fail([
        "Vitest produced no JSON report, so nothing can be compared.",
        "",
        "Treated as a failure rather than as an empty result: a missing report and a clean run are",
        "indistinguishable to a set comparison, and one of them is a green that means nothing.",
      ]);
    }

    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const totalTests = report.numTotalTests ?? 0;
    const suites = report.testResults ?? [];

    const failingFiles = [];
    for (const suite of suites) {
      const relative = path.relative(projectRoot, suite.name).split(path.sep).join("/");
      const count = (suite.assertionResults ?? []).filter((result) => result.status === "failed").length;
      // A suite marked failed with zero failed assertions threw before running anything — a collection
      // error. That is a red, and counting it as one keeps it visible rather than invisible.
      if (count > 0 || suite.status === "failed") failingFiles.push({ file: relative, count: Math.max(count, 1) });
    }

    const breaches = floorBreaches({ files: population.length, filesRan: suites.length, tests: totalTests });
    if (breaches.length > 0) {
      fail([
        "The run is not sound enough to compare:",
        ...breaches.map((breach) => `    ${breach}`),
        "",
        "A DROPPED FILE IS THE DANGEROUS ONE. Its tests simply do not appear, so a red inside it is",
        "absent from the failing set rather than reported — and if it is not in the manifest, this gate",
        "would have said OK. This machine has dropped files repeatedly; re-run before believing this.",
      ]);
    }

    const { unexpected, recovered, miscounted } = compareFailingSet({
      failing: failingFiles,
      expected: [...expected.values()],
    });

    const problems = [];
    if (unexpected.length > 0) {
      problems.push(
        `${unexpected.length} ward test file(s) are failing and are NOT in the manifest:`,
        ...unexpected.map((file) => `    ${file}`),
        "",
        "These are real failures. Fix them, or — only if a red is deliberate and holds something open —",
        "add an entry to tests/ward-expected-reds.json with its kind, its reason, and whose question it",
        "is. An entry whose reason is a guess is worse than no entry.",
        "",
      );
    }
    if (recovered.length > 0) {
      problems.push(
        `${recovered.length} manifest entr(y/ies) are NO LONGER FAILING:`,
        ...recovered.map((file) => `    ${file} — ${expected.get(file)?.reason ?? "(no reason recorded)"}`),
        "",
        "⚠️ THIS IS THE CHECK THAT EXISTS FOR THIS DIRECTION AND IT IS NOT A FORMALITY. A red that stops",
        "failing has either been fixed — in which case delete the entry and say so — or, if its kind is",
        "owner-question, the question it was holding open may have just been answered BY DEFAULT by",
        "somebody's change. Read the entry before clearing it. Do not delete an entry to make this pass.",
        "",
      );
    }
    if (miscounted.length > 0) {
      problems.push(
        `${miscounted.length} manifest entr(y/ies) are failing a DIFFERENT NUMBER of times than recorded:`,
        ...miscounted.map((entry) => `    ${entry.file} — expected ${entry.expected}, found ${entry.actual}`),
        "",
        "A listed file is sanctioned for the reds its entry records, not for any number of them. A count",
        "that went UP is a new failure hiding inside an entry somebody already approved. A count that",
        "went DOWN means part of what the entry was holding open has resolved — read the entry before",
        "adjusting the number.",
        "",
      );
    }
    if (problems.length > 0) fail(problems);

    console.log(
      `check:ward-expected-reds OK — ${population.length} files, ${totalTests} tests, ` +
        `${failingFiles.size} failing, all ${expected.size} manifest entr${expected.size === 1 ? "y" : "ies"} accounted for.`,
    );
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}
