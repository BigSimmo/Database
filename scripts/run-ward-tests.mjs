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
 *
 * ⚠️ KNOWN LIMITATION, 2026-08-30: THIS DOES NOT TAKE A REPOSITORY COORDINATOR LEASE.
 *
 * It spawns `npx vitest` directly. `npm run test` goes through `scripts/run-vitest.mjs`, which calls
 * `acquireHeavyRunLock` first; the coordinator permits at most two focused Vitest leases across all
 * worktrees and treats a full run as exclusive. So several sessions running the whole ward suite
 * through this wrapper bypass that limit entirely — and the limit is real: probed at 13:34 the
 * coordinator refused a run outright because a live Codex worktree held capacity.
 *
 * That is a CANDIDATE cause of the `VirtualAlloc failed` worker death this tool exists to catch —
 * memory exhaustion from concurrent unthrottled runs. Stated as a hypothesis and not a measurement,
 * because nobody correlated the death with what other sessions were doing at that second and nobody
 * can now. A correct-sounding cause that ends the inquiry is its own failure mode.
 *
 * ⚠️ AND A LIMIT THAT SITS UPSTREAM OF THIS TOOL ENTIRELY, 2026-08-30. This guarantees that every
 * file you handed in produced a result. IT CANNOT GUARANTEE THAT THE EDIT YOU MEANT TO TEST WAS
 * EVER WRITTEN TO DISK. Under commit-charge exhaustion this machine failed to fork: a `python` and
 * a `git commit` both died with `0xC000012D` (STATUS_COMMITMENT_LIMIT), and an edit was silently
 * lost — the command printed an error, the file simply did not change, and the next step carried on
 * as though it had. Later, PowerShell itself could not start.
 *
 * That failure is invisible in the way that matters: AN UNWRITTEN EDIT FOLLOWED BY A CLEAN
 * `git status` IS INDISTINGUISHABLE FROM HAVING NOTHING TO COMMIT, and a run over the old content
 * is honestly green. Every number this tool prints would be correct and the result would still be
 * about code you did not write.
 *
 * SO: after a heavy or long step, VERIFY THE EDIT LANDED before trusting any run over it. ⚠️ AND
 * VERIFY IT IN `HEAD`, NOT IN THE WORKING TREE — this correction is from Ward Board and it inverts
 * the weaker rule that stood here first. A working-tree check passes in the WORST case: the edit
 * landed, the COMMIT died, the files on disk look perfect, and `HEAD` does not have them. So:
 * `git show HEAD:<path> | grep <the thing you added>`, never `grep <path>`.
 *
 * ⚠️ AND DO NOT REACH FOR `git commit --amend` WHEN A COMMIT SEEMS TO HAVE GONE WRONG. It is the one
 * common git operation that DESTROYS the previous state as a precondition of creating the new one,
 * so under a machine that is failing to fork it can leave a branch that has simply lost a commit
 * with no error anywhere. A follow-up commit costs one line of history and cannot do that.
 *
 * ⚠️ AND WRITE INSPECTION SEQUENCES WITH `;`, NOT `&&`. A `grep -c` that correctly finds ZERO
 * matches exits 1, so an `&&` chain aborts there and every later check silently never runs — while
 * the output still reads as a finished report. THAT IS THE SAME SHAPE AS `83 passed (83)` WHEN 84
 * WENT IN: a truthful-looking result whose missing half is invisible. Two sessions hit it within an
 * hour on 2026-08-30 and the first treated it as a nuisance rather than as the finding it is.
 *
 * Same discipline throughout as reading a mutation back from disk instead of assuming it applied.
 *
 * MITIGATION THAT COSTS NOTHING: hand in only the files your change touches. The guarantee here is
 * COMPLETENESS OF WHAT YOU HANDED IN, not breadth — a narrow run is the same check over a smaller
 * set, not a weaker one. Keep the full suite for a fold, and say so when you run it.
 *
 * WHY THIS IS NOT SIMPLY FIXED BY CALLING `run-vitest.mjs`: a capacity refusal is NOT a test
 * failure. The coordinator throws when full, and the repository's own convention treats "blocked,
 * retry" as a distinct outcome from "red" (see `verify:ui`'s exit 75 /
 * DATABASE_HEAVY_RUN_ADMISSION_BUSY). Routing through the lease therefore needs a fourth outcome
 * here, not a changed spawn line — and adding that to a tool several sessions depend on, while they
 * are mid-build, is the wrong moment. Recorded for a quiet one.
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

/**
 * The ward files this tool DELIBERATELY does not run. Printed every run, never silently omitted.
 *
 * ⚠️ A CONTROL'S COVERAGE IS PART OF WHAT IT CLAIMS (Ward Settings, 2026-08-30, after a citation
 * checker reported `documents scanned: 31` over a ~130-document corpus — a whole guarantee about a
 * set nobody had stated). `files handed in: 84` reads as "the ward suite" unless the boundary is
 * said out loud, and this tool exists precisely because a number that agrees with itself is not a
 * number anybody checked.
 *
 * Here the exclusion is CORRECT and still has to be stated: `tests/ui-ward-*.spec.ts` are Playwright
 * journeys and vitest cannot run them at all — a different runner, not a hole in this one. That is
 * the difference from the citation checker, whose missing 70 documents were genuinely in scope.
 * Measured 2026-08-30 on `claude/ward-flow-setup-967aa0-wf`: 84 discovered here, 6 excluded.
 *
 * ⚠️ DO NOT WIDEN EITHER PATTERN TO A BARE `ward` MATCH.
 * `tests/forward-codify-retrieval-targets.test.ts` contains "ward" inside "forward" and has nothing
 * to do with this project — it turned up in my own measurement of this very gap, so the trap is not
 * hypothetical. A substring match on a common English fragment is a measurement error waiting for
 * the right filename.
 */
function discoverExcludedWardSpecs() {
  const dir = "tests";
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^ui-ward-.*.spec.tsx?$/.test(f))
    .sort()
    .map((f) => `tests/${f}`);
}

function main() {
  const usedDiscovery = process.argv.slice(2).length === 0;
  const handedIn = usedDiscovery ? discoverWardTests() : process.argv.slice(2);

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

  // State the boundary on every discovered run, not only when somebody thinks to ask.
  // See discoverExcludedWardSpecs for why these are excluded and why that is still worth printing.
  if (usedDiscovery) {
    const excluded = discoverExcludedWardSpecs();
    console.log(
      `Coverage: tests/ward-*.test.ts(x) only. ${excluded.length} Playwright ward journey(s) are NOT in` +
        ` this run — vitest cannot run them; use verify:ui. Excluded: ${excluded.join(", ") || "(none found)"}`,
    );
  }

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
