#!/usr/bin/env node
/**
 * mutation-run.mjs — a mutation driver that cannot strand a mutant.
 *
 * ⚠️ **WHY THIS EXISTS AS A HARNESS RATHER THAN A HABIT.** On 2026-09-04 four Ward Flow sessions
 * independently found guards that could not fail, and the habit recommended for finding them —
 * break the thing, watch it go red, put it back — was itself run four different ways, none of them
 * crash-safe. One session's driver died after writing the mutant and before restoring it (Node
 * decoded a UTF-8 test stream as cp1252 and threw), leaving a deliberate falsehood on disk in a
 * repository where another session's pre-commit hook inspects the whole tree. **The file was
 * untracked and minutes old, so `git` had nothing to restore it from.** It was found because
 * somebody ran a status check out of reflex.
 *
 * **A reflex does not survive a tired session and does not transfer to whoever works on this next.**
 *
 * Each guard below is here because it was actually breached, not because it seemed prudent:
 *
 *   1. REFUSES AN UNTRACKED TARGET. Every discussion of mutation assumes version control is the
 *      backstop. For a new file it is not — and a new file is exactly what you mutate when you have
 *      just written a guard, so the exposure concentrates on the case the habit exists for.
 *   2. REFUSES A FIND STRING THAT DOES NOT MATCH EXACTLY ONCE. A non-global substitution silently
 *      prefers the first occurrence, which in this heavily-commented codebase is very often the doc
 *      comment ABOUT the value rather than the value. The mutation "applies", the suite goes green,
 *      and a green from a mutant that landed in prose reads exactly like a test that does not guard.
 *   3. PROVES THE MUTANT APPLIED, BY CONTENT. A mutation that never applied reports as a pass, and
 *      the pass is the only thing you see. Green after a mutation means one of two opposite things —
 *      the guard is weak, or nothing happened — and the run cannot tell you which.
 *   4. RESTORES IN A `finally`, FROM BYTES CAPTURED BEFORE THE EDIT. Not from `HEAD`: whenever the
 *      file carries uncommitted work, `HEAD` is a different thing from "the file a moment ago", and
 *      restoring to it silently discards the very change under test.
 *   5. VERIFIES THE RESTORE BY CONTENT and fails loudly on mismatch. A clean `git diff` is a weaker
 *      claim that looks identical and is also satisfied by a file that was never mutated at all.
 *   6. REPORTS WHICH ASSERTIONS WENT RED, not merely that something did. Two reds from one edit is
 *      not a stronger signal — it hides which half moved, and it is how an assertion that is not
 *      mapped to the site its name claims stays hidden.
 *
 * ⚠️ **AND THE ONE THING THIS HARNESS CANNOT CLOSE, WHICH BELONGS IN THE RECORD RATHER THAN IN A
 * DOCSTRING.** Guard 1 was written down in a personal note before the night it was needed, was
 * retrievable, and still did not reach the advice given to four sessions. **A lesson recorded is not
 * a lesson applied.** This closes that gap for one case. Nothing closes it in general.
 *
 * Usage:
 *   node scripts/ward-flow/mutation-run.mjs \
 *     --file src/components/ward-management/ward-patients.ts \
 *     --find "return age;" --replace "return 999;" \
 *     --command "npx vitest run tests/ward-patient-model.test.ts tests/ward-person-screen.dom.test.tsx"
 *
 *   node scripts/ward-flow/mutation-run.mjs --self-test
 *
 * Exit codes: 0 the mutant was caught (the run went red) · 1 the mutant SURVIVED (nothing caught
 * it — the finding) · 2 refused before mutating · 3 the restore failed (act now) · 4 INDETERMINATE:
 * the mutant never ran, so the result means nothing either way.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

const REFUSED = 2;

/**
 * A stable, unique string that exists ONLY so `--self-test` has something safe to mutate in a
 * tracked file. Do not read it for anything, and do not reuse the text elsewhere or tidy it
 * away: the self-test anchors on it, and guard 2 refuses any anchor that does not match exactly
 * once — so a second copy anywhere in this file silently turns three verdict cases into
 * refusals, which the self-test would report as RED without saying why.
 */
const SELF_TEST_ANCHOR = "self-test-mutation-anchor-do-not-duplicate";
void SELF_TEST_ANCHOR;
const RESTORE_FAILED = 3;
// Neither caught nor survived. Kept distinct from both, because the failure mode
// this guards is a conclusion drawn from a run that did not happen.
const INDETERMINATE = 4;

function die(code, ...lines) {
  for (const line of lines) console.error(line);
  process.exit(code);
}

/** git's own object id, so the value is comparable with `git hash-object` and `git rev-parse`. */
function blobHash(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([header, bytes]))
    .digest("hex");
}

function isTracked(file) {
  const probe = spawnSync("git", ["ls-files", "--error-unmatch", "--", file], {
    encoding: "utf8",
  });
  return probe.status === 0;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[name] = true;
    } else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
}

/**
 * Which assertions went red — guard 6.
 *
 * Deliberately reports the NAMES rather than a count. A count answers "did something catch it",
 * which is the question that hides a test asserting over the wrong site.
 */
function redAssertions(output) {
  const names = new Set();
  const reasons = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    const failing = line.match(/^[×✕x]\s+(.+?)(?:\s+\d+ms)?$/u);
    if (failing) names.add(failing[1].trim());
    if (/^(AssertionError|Error):/.test(line)) reasons.push(line);
  }
  return { names: [...names], reasons };
}

/**
 * DID ANYTHING GO RED — asked separately from WHICH assertion went red.
 *
 * 🔴 THIS SPLIT EXISTS BECAUSE THE VERDICT USED TO BE `names.length === 0`, AND
 * `names` COMES ONLY FROM VITEST'S `× <test name>` LINES, WHICH THE DOT REPORTER
 * DOES NOT PRINT. `--reporter=dot` is what this repository's own build plans tell
 * people to run, so the harness reported "🔴 THE MUTANT SURVIVED. Nothing went
 * red." for runs that had gone red — and it says a survived mutant means the
 * assertion cannot fail, which invites somebody to rewrite a guard that works.
 * A tool built to stop false confidence was manufacturing it, in the one
 * direction that costs you a working safeguard.
 *
 * Measured 2026-09-05 as a controlled pair: the same file, the same one-character
 * mutation and the same test, run twice with only the reporter changed.
 * `--reporter=dot` said SURVIVED; the default reporter said "caught by 1
 * assertion". Everything else was held constant.
 *
 * So the verdict now keys on the process status plus vitest's own summary, and
 * `names` is demoted to what it always was — the ANSWER TO A DIFFERENT AND
 * BETTER QUESTION, which is which assertion did it. When a run goes red without
 * naming anything, that is reported as caught-but-unnamed rather than silently
 * turned into its opposite.
 */
function failureSignal(output, status) {
  const summary = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    // "Tests  1 failed | 6 passed (7)" and "Test Files  1 failed (1)".
    //
    // ⚠️ `[1-9]\d*`, NOT `\d+`. The first version of this used `\d+`, which
    // matches ZERO — so "Tests  0 failed | 7 passed (7)" set summary.length > 0
    // and a fully green run read as CAUGHT, with no non-zero exit needed. Found
    // by Ward Verifier, 2026-09-05, by reading the regex rather than by seeing it
    // happen: whether today's reporter emits a zero-failure line or not, the
    // pattern accepted one, so it was latent regardless of the reporter.
    if (/^Test(s| Files)\s+[1-9]\d* failed/.test(line)) summary.push(line);
    // The per-file banner, printed by every reporter including dot.
    else if (/^FAIL\b/.test(line)) summary.push(line);
  }
  return { failed: status !== 0 || summary.length > 0, summary };
}

/**
 * DID THE TESTS ACTUALLY EXECUTE — asked separately from whether anything failed.
 *
 * Vitest prints a `Tests  …` summary line whenever it collected and ran at least
 * one test, under every reporter including dot. Its absence alongside a non-zero
 * exit means the process died before running anything: a parse error in the
 * mutant, a missing file, a runner that refused.
 */
function ranTests(output) {
  /*
   * 🔴 `[ \t]*`, AND ITS ABSENCE MADE THIS FUNCTION RETURN FALSE FOR EVERY REAL RUN.
   *
   * The first version was `/^Tests\s+\S/m`, anchored at column 0. **Vitest indents that summary
   * line by six spaces.** Measured with `cat -A`:
   *
   *     ␣␣␣␣␣␣Tests  3 passed (3)$
   *
   * So `ranTests` was false on every genuine vitest run, and `didNotRun`'s third clause —
   * `status !== 0 && !ranTests(output)` — fired on **every real catch**, because a real catch is
   * exactly "vitest exits non-zero". The harness could no longer report a caught mutant at all.
   *
   * ⚠️ **AND IT IS WORSE THAN THE BUG IT REPLACED.** The defect Ward Verifier found here earlier
   * made a guard that does nothing look proven. This one made a guard that WORKS look unproven —
   * and the doc comment in this file already names that harm: a wrong verdict here *"invites
   * somebody to rewrite a guard that works."*
   *
   * ⚠️ **THE OTHER FOUR ANCHORED MATCHES IN THIS FILE ARE FINE, AND THAT IS THE TELL.** Lines 124,
   * 126, 166 and 168 all run against `raw.trim()`. This was the only one matching raw output. One
   * file, two summary parsers, and only the untrimmed one was broken — so the working sibling three
   * dozen lines away was the available counter-example the whole time.
   *
   * Found by Ward Verifier, 2026-09-05, checking a fix I had reported green and asked nothing of it
   * about — on the stated grounds that a self-reported fix most needs a second reader precisely when
   * its author has just misread evidence twice in one night.
   */
  return /^[ \t]*Tests\s+\S/m.test(output);
}

/**
 * A mutant that never executed is neither caught nor survived, and the second is
 * the reading that gets published. `run-vitest.mjs` memoises a gate that already
 * passed on identical content and exits 0 WITHOUT running vitest, printing that
 * it did so. If that message is in the output, this harness must refuse to draw
 * any conclusion — an exit 0 from a run that did not happen is indistinguishable
 * from an exit 0 from a run that happened and passed.
 */
/**
 * POSITIVE EVIDENCE THAT SOMETHING ACTUALLY EXECUTED - runner-agnostic, unlike `ranTests`.
 *
 * `ranTests` looks for vitest's own summary line. A PLAYWRIGHT command never emits one, so
 * `didNotRun`'s third clause fired on every genuinely CAUGHT browser mutant and reported "the
 * mutant never ran". Ward Builder Three hit it on a real production-build run: a mutation that
 * failed with the exact assertion it was aiming at came back INDETERMINATE. The restore was
 * correct; only the verdict was wrong - and a wrong verdict here is the specific harm this file's
 * header warns about, because it invites somebody to rewrite a guard that works.
 *
 * THE FIRST FIX I TRIED WAS TO NARROW THE CLAUSE TO VITEST COMMANDS, AND THE SELF-TEST REFUSED IT.
 * Two INVERSE cases went red, correctly: narrowing by command text would have restored the original
 * defect for every non-vitest runner - a Playwright process that died having run nothing would once
 * again be reported CAUGHT. The self-test caught a fix that traded one runner's false negative for
 * another runner's false positive.
 *
 * So the question asked is not "was this vitest" but "is there evidence a test executed". A named
 * failing test or an assertion message is that evidence in any runner, and `redAssertions` already
 * extracts both from trimmed output. This deliberately does NOT try to recognise Playwright's
 * summary format: writing that from memory would be a stand-in typed by whoever wrote the parser,
 * which is the exact failure Ward Verifier caught in this same file a few hours ago.
 */
function ranEvidence(output) {
  if (ranTests(output)) return true;
  const red = redAssertions(output);
  return red.names.length > 0 || red.reasons.length > 0;
}

function didNotRun(output, status, commandText = "") {
  if (/reused receipt, not a fresh run|\[gate-receipts\] REUSED/.test(output)) {
    return "the command reused a recorded gate receipt and exited without running vitest";
  }
  // 🔴 THE ONE THAT FIRES ON THIS MACHINE, AND IT FIRED THREE TIMES IN ONE
  // SESSION. `scripts/run-heavy.mjs` exits 75 with this marker when another
  // worktree holds the heavy-run lease. 75 is non-zero, so the previous verdict
  // called it CAUGHT — while nothing ran at all. And `npm run test` is the
  // obvious thing to put in --command, so with several sessions live a mutation
  // run that loses the lease race certified the guard as working having executed
  // nothing. Found by Ward Verifier with a control, 2026-09-05.
  if (status === 75 || /DATABASE_HEAVY_RUN_ADMISSION_BUSY/.test(output)) {
    return "another worktree held the heavy-run lease, so the command exited 75 without running vitest";
  }
  // A non-zero exit with no `Tests …` summary anywhere: the process died before
  // running a test. The worst case is a SYNTACTICALLY INVALID MUTANT — vitest
  // exits non-zero, no assertion executes, and the old verdict said CAUGHT. That
  // is worse than the lease case because an invalid mutant is MORE likely on an
  // aggressive mutation, which is exactly when the verdict matters most.
  //
  // NARROWED 2026-09-05: THIS CLAUSE ONLY APPLIES TO A VITEST COMMAND, and the first version did
  // not say so. `ranTests` looks for vitest's own summary line. A PLAYWRIGHT command never emits
  // one, so every genuinely CAUGHT browser mutant came back as "the mutant never ran".
  //
  // Ward Builder Three hit it on a real production-build run: a mutation that failed with the
  // exact assertion it was aiming at was reported INDETERMINATE. The restore was correct and only
  // the verdict was wrong - but a wrong verdict here is the specific harm this file's own header
  // warns about, because it invites somebody to rewrite a guard that works.
  //
  // THE FIX IS TO NARROW THE HEURISTIC, NOT TO GUESS ANOTHER RUNNER'S OUTPUT FORMAT. A Playwright
  // summary pattern written from memory would be a stand-in typed by whoever wrote the parser -
  // the exact failure Ward Verifier caught in this file a few hours ago. The two clauses above
  // still apply to every runner: a reused receipt and a lease refusal are both detectable without
  // knowing what a test summary looks like.
  //
  // So a non-vitest command falls through to the ordinary red/green signal, and the failing test
  // name plus the assertion message settle it, as they always did for browser gates.
  if (status !== 0 && !ranEvidence(output)) {
    return `the command exited ${status} without vitest running a single test — a parse error in the mutant, a missing file, or a runner that refused`;
  }
  return null;
}

function runMutation({ file, find, replace, command }) {
  const absolute = resolve(file);

  if (!existsSync(absolute)) die(REFUSED, `REFUSED: no such file — ${file}`);

  // Guard 1 — the one that bit, and the one nobody does.
  if (!isTracked(file)) {
    die(
      REFUSED,
      `REFUSED: ${file} is UNTRACKED.`,
      "",
      "  Version control cannot restore a file it has never seen, so if this run dies between the",
      "  edit and the restore, the only recovery is reversing the edit by hand — which is possible",
      "  only if somebody knows an edit is there.",
      "",
      "  Commit the file first. A new file is exactly what you mutate when you have just written a",
      "  guard, which is why this refusal exists rather than a warning.",
    );
  }

  const original = readFileSync(absolute);
  const originalHash = blobHash(original);
  const text = original.toString("utf8");

  // Guard 2 — a non-global substitution silently prefers a comment.
  const occurrences = text.split(find).length - 1;
  if (occurrences !== 1) {
    /*
     * 🔴 A MULTI-LINE --find CAN NEVER MATCH A CRLF FILE, AND THE ADVICE HERE USED TO SEND YOU
     * SOMEWHERE ELSE ENTIRELY.
     *
     * This repository is checked out on Windows, so working files routinely hold CRLF while the
     * committed blob holds LF. A `--find` typed with `\n` between two lines then matches the blob
     * and NOT the file on disk, which is what this guard reads. The old message offered "Prettier
     * may have reflowed the line" — plausible, wrong, and expensive: it points the reader at the
     * formatter rather than at the line endings, and a single-line anchor works fine, so nothing
     * else in the session contradicts it.
     *
     * ⚠️ The refusal itself is correct behaviour and stays. A mutation harness that guessed at what
     * you meant would be worse than one that stops. What was wrong was only the diagnosis, and a
     * confident wrong diagnosis in a tool nobody re-reads is how an hour goes missing.
     */
    const crlfWouldMatch =
      occurrences === 0 && find.includes("\n") && text.replaceAll("\r\n", "\n").split(find).length - 1 === 1;
    die(
      REFUSED,
      `REFUSED: --find matched ${occurrences} times in ${file}; it must match exactly once.`,
      crlfWouldMatch
        ? "  IT WOULD MATCH EXACTLY ONCE WITH LF LINE ENDINGS. This file holds CRLF on disk while its\n" +
            "  committed blob holds LF, so a multi-line --find typed with \\n matches the blob and not the\n" +
            "  working file. This is not a formatting problem and re-running will not fix it.\n" +
            "  Anchor on a SINGLE line instead, or split the change into one mutation per line."
        : occurrences === 0
          ? "  Nothing to mutate. Prettier may have reflowed the line you anchored on, or — if your\n" +
            "  --find spans lines — this file may hold CRLF while your pattern assumes LF."
          : "  Ambiguous. The first match in this codebase is very often the doc comment ABOUT the\n" +
            "  value rather than the value — anchor on the whole declaration or JSX element instead.",
    );
  }

  console.log(`pre-mutation blob  ${originalHash}  ${file}`);

  let mutantApplied = false;
  let exitCode = 0;

  try {
    writeFileSync(absolute, text.replace(find, replace), "utf8");

    // Guard 3 — prove it landed. A mutation that never applied reports as a pass.
    const afterHash = blobHash(readFileSync(absolute));
    if (afterHash === originalHash) {
      die(
        REFUSED,
        "REFUSED: the file is byte-identical after the edit — the mutant did NOT apply.",
        "  Do not interpret any run from here; a non-run and a weak guard are the same colour.",
      );
    }
    mutantApplied = true;
    console.log(`mutant blob        ${afterHash}  (applied)`);
    console.log(`running: ${command}\n`);

    // Explicit utf8 on both streams. Decoding a UTF-8 test stream as the Windows code page is what
    // killed the driver this harness replaces — and it died AFTER writing the mutant.
    const run = spawnSync(command, {
      shell: true,
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "C.UTF-8", PYTHONIOENCODING: "utf-8" },
      maxBuffer: 64 * 1024 * 1024,
    });

    const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
    process.stdout.write(output);

    const { names, reasons } = redAssertions(output);
    const { failed, summary } = failureSignal(output, run.status);
    console.log("\n──────── mutation result ────────");

    const didNot = didNotRun(output, run.status, args.command ?? "");
    if (didNot) {
      console.log("⚠️  INDETERMINATE — THE MUTANT NEVER RAN.");
      console.log(`   ${didNot},`);
      console.log("   so this says nothing about whether an assertion covers the mutation.");
      console.log("   A verdict from a run that did not happen is indistinguishable from one that did.");
      console.log("   Re-run when the lease is free, or with GATE_RECEIPTS=refresh, as applicable.");
      exitCode = INDETERMINATE;
    } else if (!failed) {
      console.log("🔴 THE MUTANT SURVIVED. Nothing went red.");
      console.log("   Either no assertion covers this, or the one that claims to cannot fail.");
      exitCode = 1;
    } else if (names.length === 0) {
      // Red, but the reporter did not name the test. Do not call this survived:
      // that is the exact inversion this harness shipped with until 2026-09-05.
      console.log("✅ caught — the run went red, but this reporter did not name the assertion.");
      for (const line of summary.slice(0, 3)) console.log(`   ${line}`);
      for (const reason of reasons.slice(0, 4)) console.log(`   ${reason}`);
      console.log("");
      console.log("⚠️  WHICH assertion went red is the more useful half and you do not have it.");
      console.log("   Drop --reporter=dot from the command and run again to get the test name;");
      console.log("   a mutation caught by the wrong assertion looks identical to one caught by");
      console.log("   the right one.");
    } else {
      console.log(`✅ caught by ${names.length} assertion${names.length === 1 ? "" : "s"}:`);
      for (const name of names) console.log(`   × ${name}`);
      for (const reason of reasons.slice(0, 4)) console.log(`     ${reason}`);
      if (names.length > 1) {
        console.log(
          "\n⚠️  MORE THAN ONE WENT RED FOR ONE EDIT. That is not a stronger signal — check that\n" +
            "   each of these is really asserting over the site its name claims, rather than two\n" +
            "   assertions sharing one predicate.",
        );
      }
    }
  } finally {
    // Guard 4 — restore from the bytes captured before the edit, never from HEAD.
    writeFileSync(absolute, original);
    const restoredHash = blobHash(readFileSync(absolute));

    // Guard 5 — verify by content, and be loud.
    if (restoredHash === originalHash) {
      console.log(`restored           ${restoredHash}  (byte-identical)`);
    } else {
      console.error("");
      console.error("🔴🔴 RESTORE FAILED — A MUTANT MAY BE ON DISK RIGHT NOW.");
      console.error(`     expected ${originalHash}`);
      console.error(`     actual   ${restoredHash}`);
      console.error(`     file     ${file}`);
      console.error("     Do not commit anything from this tree until it is resolved.");
      process.exitCode = RESTORE_FAILED;
      return;
    }
    if (!mutantApplied) process.exitCode = REFUSED;
  }

  process.exitCode = exitCode;
}

/**
 * Anti-vacuity: a harness that cannot fail would be the exact defect it exists to find.
 *
 * Each case asserts the harness REFUSES or REPORTS something, against a real temporary file — so a
 * change that made the guards inert takes this red rather than leaving it silently permissive.
 */
function selfTest() {
  const dir = resolve("scripts/ward-flow/.mutation-self-test");
  const file = `${dir}/subject.txt`;
  mkdirSync(dirname(file), { recursive: true });
  let failures = 0;

  const check = (label, actual, expected) => {
    const ok = actual === expected;
    console.log(`${ok ? "  ok  " : "  RED "} ${label} (exit ${actual}, expected ${expected})`);
    if (!ok) failures += 1;
  };

  const invoke = (args) =>
    spawnSync(process.execPath, [resolve("scripts/ward-flow/mutation-run.mjs"), ...args], {
      encoding: "utf8",
    }).status;

  writeFileSync(file, "alpha\n", "utf8");
  check(
    "refuses an untracked target",
    invoke(["--file", file, "--find", "alpha", "--replace", "beta", "--command", "true"]),
    REFUSED,
  );

  // A tracked file that certainly exists, mutated with an anchor that cannot match.
  const tracked = "scripts/ward-flow/mutation-run.mjs";
  /**
   * ⚠️ ASSEMBLED AT RUNTIME, AND THE FIRST VERSION OF THIS TEST WENT RED BECAUSE IT WAS NOT.
   *
   * It searched for a literal absent-anchor string — which then occurred exactly once, in this
   * file, because writing the test put it here. The harness matched it, mutated, ran, and correctly
   * reported a surviving mutant; the self-test read that as a broken refusal.
   *
   * **That is guard 2's own defect, committed inside guard 2's test**: the needle was in the
   * haystack because somebody wrote it there — the same reason a doc comment about a value is so
   * often the first textual match for it. **A subject that contains its own probe cannot test an
   * absence.**
   */
  const absentAnchor = ["@@", "no", "such", "anchor", "@@"].join("~");
  check(
    "refuses a find string matching zero times",
    invoke(["--file", tracked, "--find", absentAnchor, "--replace", "x", "--command", "true"]),
    REFUSED,
  );
  check(
    "refuses an ambiguous find string",
    invoke(["--file", tracked, "--find", "const", "--replace", "let", "--command", "true"]),
    REFUSED,
  );

  /**
   * THE VERDICT CASES, AND WHY THEY ARE HERE RATHER THAN ASSUMED.
   *
   * Until 2026-09-05 this self-test walked the three REFUSALS and nothing else,
   * so the harness shipped for a day with its verdict INVERTED for any command
   * using `--reporter=dot` — the reporter this repository's own build plans
   * prescribe. It printed "THE MUTANT SURVIVED" for runs that had gone red, and
   * a survived mutant is defined here as "no assertion covers this", so the
   * reading invites somebody to rewrite a guard that works.
   *
   * Every guard fired throughout. The conclusion was still wrong, and
   * "self-test: all guards fire" read as a clean bill of health for the tool.
   *
   * These drive the real binary with a stand-in command, so they pin the WIRING.
   * A unit test of the helpers would not have caught the original defect,
   * because the original defect had no helper — the verdict was
   * `names.length === 0` written inline.
   *
   * Case 1 is the discriminating one: a non-zero exit with no `×` line is
   * exactly the dot-reporter shape, and the old code called that survival.
   */
  // ⚠️ THE STAND-IN MUST LOOK LIKE WHAT THE DOT REPORTER ACTUALLY EMITS, and the
  // first version of it did not. It printed a FAIL banner and no `Tests …`
  // summary — which is precisely the shape of a COLLECT ERROR, where no assertion
  // executes and INDETERMINATE is the correct verdict. So the case went red
  // against correct logic, and "fixing" it by loosening the logic would have
  // re-opened the very defect this round closed.
  //
  // A real red run under --reporter=dot prints BOTH lines. Verified against a
  // genuine failing run earlier tonight:
  //     Test Files  1 failed (1)
  //          Tests  1 failed | 6 passed (7)
  //
  // 🔴 AND THE INDENTATION BELOW IS LOAD-BEARING. The comment above quotes the real
  // output correctly, WITH its leading spaces — and the first version of the stand-in
  // was typed flush left anyway, three lines under its own evidence. That fixture
  // satisfied a column-0 anchor that real vitest output cannot, so the self-test
  // passed on a shape the world never produces while the harness returned
  // INDETERMINATE for every genuine catch.
  //
  // ⚠️ **A STAND-IN TYPED BY WHOEVER WROTE THE PARSER AGREES WITH THE PARSER BY
  // CONSTRUCTION.** Ward Verifier's clause, and it is the rule now: the fixture a
  // self-test feeds a parser must be captured from the real producer, not typed from
  // memory. Six spaces, because that is what vitest emits — asserted just below so
  // this cannot be quietly tidied back to the left margin.
  const failLine = "FAIL  |node| tests/x.test.ts > d > a name";
  const failSummary = "      Tests  1 failed | 6 passed (7)";
  const greenSummary = "      Tests  7 passed (7)";
  const zeroFailSummary = "      Tests  0 failed | 7 passed (7)";
  check(
    "the self-test's own summary fixtures reproduce vitest's leading indentation",
    [failSummary, greenSummary, zeroFailSummary].every((line) => /^ {6}Tests\b/.test(line)) &&
      ranTests(failSummary) &&
      !/^Tests\b/.test(failSummary)
      ? 0
      : 1,
    0,
  );
  const verdictCase = (label, command, expected) =>
    check(
      label,
      invoke(["--file", tracked, "--find", SELF_TEST_ANCHOR, "--replace", "mutated", "--command", command]),
      expected,
    );

  verdictCase(
    "a red run naming no assertion is CAUGHT, not survived (the dot-reporter shape)",
    `node -e "console.log('${failLine}'); console.log('${failSummary}'); process.exit(1)"`,
    0,
  );
  verdictCase(
    "a green run is still SURVIVED (this was not made to always say caught)",
    `node -e "console.log('${greenSummary}')"`,
    1,
  );
  verdictCase(
    "a reused gate receipt is INDETERMINATE, neither caught nor survived",
    `node -e "console.log('[gate-receipts] REUSED, a reused receipt, not a fresh run')"`,
    INDETERMINATE,
  );

  /**
   * ⚠️ THE INVERSE CASES, AND WARD VERIFIER IS RIGHT THAT THEY ARE THE ONLY ONES
   * THAT DISCRIMINATE.
   *
   * The three cases above assert that a red run is reported CAUGHT. **They pass
   * just as happily on the broken version**, because the broken version said
   * CAUGHT for every non-zero exit. A forward probe cannot separate "reports
   * caught correctly" from "reports caught always" — so it proved nothing about
   * the very property it looked like it was proving.
   *
   * These four fail on the broken version and pass on the fixed one. That is what
   * makes them a test rather than a demonstration.
   */
  verdictCase(
    "INVERSE: a non-zero exit with NO output is INDETERMINATE, not caught",
    `node -e "process.exit(1)"`,
    INDETERMINATE,
  );
  verdictCase(
    "INVERSE: the heavy-run lease marker is INDETERMINATE, not caught",
    `node -e "console.log('DATABASE_HEAVY_RUN_ADMISSION_BUSY'); process.exit(75)"`,
    INDETERMINATE,
  );
  verdictCase(
    "INVERSE: a non-zero exit that collected no tests is INDETERMINATE, not caught",
    `node -e "console.log('${failLine}'); process.exit(1)"`.replace(failLine, "Test Files  1 failed (1)"),
    INDETERMINATE,
  );
  /*
   * THE CASE THAT PROVES THE BROWSER-GATE FIX, rather than only proving nothing broke.
   *
   * A browser gate emits no vitest summary. Before `ranEvidence` this exact shape - non-zero exit,
   * an assertion message, no `Tests` line - was reported INDETERMINATE, i.e. a caught mutant
   * reported as one that never ran. Ward Builder Three hit it on a real production build.
   *
   * The fixture carries an ASSERTION LINE and deliberately not a fabricated Playwright summary:
   * the property under test is "there is evidence a test executed", and an assertion message is
   * that evidence in any runner. Inventing another runner's summary format from memory is the
   * stand-in-typed-by-the-parser-author failure this file has already been caught by once.
   */
  verdictCase(
    "a browser gate with no vitest summary but a real assertion is CAUGHT, not indeterminate",
    `node -e "console.log('AssertionError: the confirmed group no longer carries exactly these columns'); process.exit(1)"`,
    0,
  );

  verdictCase(
    "INVERSE: a green run printing a ZERO-failure summary is SURVIVED, not caught",
    `node -e "console.log('${zeroFailSummary}')"`,
    1,
  );

  rmSync(dir, { recursive: true, force: true });
  console.log(failures === 0 ? "\nself-test: all guards fire" : `\nself-test: ${failures} RED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

const args = parseArgs(process.argv.slice(2));
if (args["self-test"]) {
  selfTest();
} else if (!args.file || !args.find || !args.replace || !args.command) {
  die(
    REFUSED,
    "usage: mutation-run.mjs --file <path> --find <literal> --replace <literal> --command <cmd>",
    "       mutation-run.mjs --self-test",
  );
} else {
  runMutation({
    file: args.file,
    find: args.find,
    replace: args.replace,
    command: args.command,
  });
}
