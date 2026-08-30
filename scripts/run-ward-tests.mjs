#!/usr/bin/env node
/**
 * Run a set of Vitest files and REFUSE to report success unless every file handed in actually ran.
 *
 * Written 2026-08-30 for Ward Flow process-audit finding P1-05, after the failure below was
 * reproduced by accident rather than found by looking:
 *
 *   84 test files were handed to `vitest run`. A worker died with `VirtualAlloc failed`. Vitest
 *   printed `Test Files  83 passed (83)` and `Tests  1234 passed (1234)`, and EXITED 0.
 *
 * Read that pass line closely: `83 passed (83)`. THE COUNT AGREES WITH ITSELF AND NOT WITH ITS
 * INPUT. There is no red anywhere, no failing assertion, and no non-zero exit — the only evidence
 * is a number the reader has to compare against something the output does not contain. Every other
 * false-green in this project's history needed somebody to make a mistake. This one needs only the
 * machine to be busy, which is why it is the worst of the family and why it gets a wrapper.
 *
 * What this refuses:
 *   - a file handed in that produced no result   (the failure above)
 *   - zero collected tests                       (a selector that matches nothing, reported green)
 *   - a file that ran but contains no test       (an empty suite passing vacuously)
 *   - a non-zero exit from vitest itself
 *
 * It always prints BOTH numbers — handed in, and ran — because a single number cannot be checked.
 *
 * Usage:
 *   node scripts/run-ward-tests.mjs                       # every tests/ward-*.test.ts(x)
 *   node scripts/run-ward-tests.mjs tests/ward-clock.test.ts tests/ward-nav.test.ts
 *
 * Exit codes: 0 all handed-in files ran and passed · 1 a real test failure · 2 a coverage
 * discrepancy (files vanished, nothing collected) — deliberately distinct, because "your tests are
 * broken" and "your test RUN is not telling you the truth" need different responses.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const EXIT_OK = 0;
const EXIT_TEST_FAILURE = 1;
const EXIT_COVERAGE_DISCREPANCY = 2;

const base = (p) => p.split(/[\\/]/).pop();

/** Discover from disk rather than from a hand-written list: a named set silently omits new files. */
function discoverWardTests() {
  const dir = "tests";
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^ward-.*\.test\.tsx?$/.test(f))
    .sort()
    .map((f) => `tests/${f}`);
}

function main() {
  const handedIn = process.argv.slice(2).length > 0 ? process.argv.slice(2) : discoverWardTests();

  if (handedIn.length === 0) {
    console.error("REFUSED: no test files selected. An empty selection cannot pass.");
    return EXIT_COVERAGE_DISCREPANCY;
  }

  const missing = handedIn.filter((f) => !existsSync(f));
  if (missing.length > 0) {
    console.error(`REFUSED: ${missing.length} selected file(s) do not exist:\n  ${missing.join("\n  ")}`);
    return EXIT_COVERAGE_DISCREPANCY;
  }

  // Forward slashes even on Windows: vitest parses `--outputFile=` as a value, and a backslash path
  // survives argv but not every downstream join. `shell: true` with one command string is used
  // because spawning `npx.cmd` with an argv array returned a null status here — killed, no report,
  // which this wrapper then correctly refused for the wrong reason. A wrapper whose own harness is
  // unreliable teaches people to ignore it.
  const reportPath = path.join(mkdtempSync(path.join(tmpdir(), "ward-tests-")), "report.json").replace(/\\/g, "/");
  console.log(`Handed in: ${handedIn.length} file(s). Running…`);

  const run = spawnSync(`npx vitest run ${handedIn.join(" ")} --reporter=json --outputFile="${reportPath}"`, {
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
  });

  if (!existsSync(reportPath)) {
    console.error(
      `\nREFUSED: vitest exited ${run.status} and wrote no report.\n` +
        "No report means no evidence about what ran. This is NOT a pass.",
    );
    return EXIT_COVERAGE_DISCREPANCY;
  }

  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    console.error(`\nREFUSED: could not parse the vitest report (${error.message}). Not a pass.`);
    return EXIT_COVERAGE_DISCREPANCY;
  }

  const results = report.testResults ?? [];
  const ran = new Set(results.map((r) => base(r.name)));

  // The dropped-file check below is the whole point of this wrapper, and a check nobody has watched
  // fail is a check nobody should trust. `WARD_TESTS_SELFTEST=1` removes one file from the observed
  // set for one run, which must be REFUSED. It is env-gated rather than committed into the data,
  // because a canary left in the list is not a test, it is an outage — learned 2026-08-30 from a
  // backup script that could not run for exactly that reason.
  if (process.env.WARD_TESTS_SELFTEST === "1") {
    const dropped = [...ran][0];
    ran.delete(dropped);
    console.log(`SELF-TEST: pretending "${dropped}" produced no result; this run MUST be refused.`);
  }
  const absent = handedIn.filter((f) => !ran.has(base(f)));
  const empty = results.filter((r) => (r.assertionResults ?? []).length === 0).map((r) => base(r.name));

  console.log(
    `\n  files handed in : ${handedIn.length}` +
      `\n  files that ran  : ${ran.size}` +
      `\n  tests collected : ${report.numTotalTests ?? 0}` +
      `\n  passed          : ${report.numPassedTests ?? 0}` +
      `\n  failed          : ${report.numFailedTests ?? 0}` +
      `\n  vitest exit     : ${run.status}`,
  );

  // Coverage discrepancies are checked BEFORE pass/fail. A run that lost a file is not
  // "passing with a caveat" — it is a run whose result is unknown for that file.
  if (absent.length > 0) {
    console.error(
      `\nREFUSED — ${absent.length} of ${handedIn.length} file(s) produced no result:\n  ${absent.join("\n  ")}\n` +
        "\nThis is the P1-05 failure: vitest can print a pass line that agrees with itself and not\n" +
        "with its input, and exit 0. A dropped file is an UNKNOWN result, never a passing one.\n" +
        "Re-run; if it recurs, the worker is dying (look for VirtualAlloc/OOM above).",
    );
    return EXIT_COVERAGE_DISCREPANCY;
  }

  if ((report.numTotalTests ?? 0) === 0) {
    console.error("\nREFUSED: zero tests collected. A selector matching nothing is not a pass.");
    return EXIT_COVERAGE_DISCREPANCY;
  }

  if (empty.length > 0) {
    console.error(`\nREFUSED: ${empty.length} file(s) ran but contain no test:\n  ${empty.join("\n  ")}`);
    return EXIT_COVERAGE_DISCREPANCY;
  }

  if ((report.numFailedTests ?? 0) > 0 || run.status !== 0) {
    console.error(`\nFAILED: ${report.numFailedTests} test(s) failed.`);
    return EXIT_TEST_FAILURE;
  }

  console.log(`\nOK — all ${handedIn.length} handed-in file(s) ran, ${report.numPassedTests} test(s) passed.`);
  return EXIT_OK;
}

process.exit(main());
