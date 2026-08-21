#!/usr/bin/env node
/**
 * check-dead-code-candidate — refuse to call a symbol dead on "nothing imports it".
 *
 * Written after the 2026-08-20 cleanup sweep (PR #2204) targeted ~1,644 lines on that
 * single test and had to be walked back seven times. Four of those seven survivors —
 * Ward Flow's `wallClockNow` and `movementsByStage`, Caring Contacts' fixtures, and
 * `bestEffortReembedRegistryRecordAfterEdit` — had zero importers and were all alive.
 * "No importer" is necessary and nowhere near sufficient: a module contract whose
 * consumer has not been written yet looks exactly like dead code to a reachability scan.
 *
 * Every check below exists because it caught a real would-be deletion in that sweep.
 * The gate fails CLOSED: an unanswerable question (shallow clone, unreadable file) is a
 * REFUSE, never a pass, because the sweep's whole failure mode was proceeding on a weak
 * signal when the strong one was unavailable.
 *
 * Usage:
 *   node scripts/check-dead-code-candidate.mjs --symbol <name> --file <path> [...]
 *   node scripts/check-dead-code-candidate.mjs --diff <base-ref>     # audit a whole diff
 *   node scripts/check-dead-code-candidate.mjs --self-test
 *
 * Exit 0 = every candidate cleared. Exit 1 = at least one REFUSE.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const RECENT_DAYS = Number(process.env.DEAD_CODE_RECENT_DAYS || 30);

const sh = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 });
  } catch (error) {
    return error.stdout ?? "";
  }
};

const rg = (pattern, paths, flags = []) =>
  sh("grep", ["-rln", ...flags, pattern, ...paths.filter((p) => existsSync(p))])
    .split("\n")
    .filter(Boolean);

/** Fail closed: a shallow clone cannot date anything, and age is a load-bearing check. */
export function historyIsComplete() {
  return !existsSync(".git/shallow");
}

/** A symbol named in a plan whose tasks are unchecked is scaffolding, not debris. */
export function planContractHits(symbol) {
  const hits = rg(`\\b${symbol}\\b`, ["docs/superpowers/plans", "docs/superpowers/specs"]);
  return hits.map((file) => {
    const body = readFileSync(file, "utf8");
    const open = (body.match(/^- \[ \]/gm) || []).length;
    const done = (body.match(/^- \[x\]/gim) || []).length;
    return { file, open, done, inFlight: open > 0 };
  });
}

/** "Any future X must call Y" lives in ordinary docs too — that is a forward contract. */
export function docMentions(symbol) {
  return rg(`\\b${symbol}\\b`, ["docs"]).filter(
    (f) => !/\/archive\/|outstanding-issues-inbox|branch-review-records|adoption-manifest/.test(f),
  );
}

/** A committed test naming the symbol pins it, even when no production file imports it. */
export function testPins(symbol) {
  return rg(`\\b${symbol}\\b`, ["tests"]);
}

/** A string literal is a dynamic-lookup path a reachability scan cannot see. */
export function stringLiteralHits(symbol) {
  return [
    ...rg(`"${symbol}"`, ["src", "tests", "scripts", "worker"], ["-F"]),
    ...rg(`'${symbol}'`, ["src", "tests", "scripts", "worker"], ["-F"]),
  ];
}

/** Introduced recently = probably a consumer that has not landed yet. */
export function introducedAt(symbol, file) {
  if (!historyIsComplete()) return null;
  const out = sh("git", ["log", "--reverse", "--format=%ad", "--date=short", "-S", symbol, "--", file]);
  return out.split("\n").filter(Boolean)[0] ?? null;
}

export function daysSince(isoDate, today = new Date()) {
  const then = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.floor((today.getTime() - then) / 86_400_000);
}

/** Deleting a whole file is only safe when NOTHING else in it is still exported. */
export function otherLiveExports(file, symbol) {
  if (!existsSync(file)) return [];
  const names = [
    ...readFileSync(file, "utf8").matchAll(
      /^export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_$][\w$]*)/gm,
    ),
  ]
    .map((m) => m[1])
    .filter((n) => n !== symbol);
  return [...new Set(names)];
}

export function assess(symbol, file, { today = new Date() } = {}) {
  const refusals = [];
  const warnings = [];

  if (!historyIsComplete()) {
    refusals.push("shallow clone — cannot date this symbol; run `git fetch --deepen=2000` first");
  }

  for (const plan of planContractHits(symbol)) {
    if (plan.inFlight) {
      refusals.push(`named in ${plan.file}, a plan with ${plan.open} unchecked task(s) — in-flight scaffolding`);
    } else {
      warnings.push(`named in ${plan.file} (all ${plan.done} tasks complete)`);
    }
  }

  const docs = docMentions(symbol);
  if (docs.length) warnings.push(`documented in: ${docs.slice(0, 3).join(", ")} — read before deleting`);

  const pins = testPins(symbol);
  if (pins.length) refusals.push(`pinned by committed test(s): ${pins.slice(0, 3).join(", ")}`);

  const literals = stringLiteralHits(symbol);
  if (literals.length)
    refusals.push(`appears as a string literal in ${literals.slice(0, 3).join(", ")} — possible dynamic lookup`);

  const added = introducedAt(symbol, file);
  if (added) {
    const age = daysSince(added, today);
    if (age !== null && age <= RECENT_DAYS) {
      refusals.push(`introduced ${added} (${age}d ago, threshold ${RECENT_DAYS}d) — likely awaiting its consumer`);
    }
  }

  const siblings = otherLiveExports(file, symbol);
  if (siblings.length) {
    warnings.push(`${file} still exports ${siblings.length} other symbol(s) — remove the symbol, never the file`);
  }

  return { symbol, file, refusals, warnings, ok: refusals.length === 0 };
}

function removedDeclarationsInDiff(base) {
  const diff = sh("git", ["diff", base, "-U0", "--", "src", "scripts", "worker"]);
  const out = [];
  let file = null;
  for (const line of diff.split("\n")) {
    const header = /^\+\+\+ b\/(.+)$/.exec(line);
    if (header) file = header[1];
    const decl = /^-(?:export\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (decl && file) out.push({ symbol: decl[1], file });
  }
  return [...new Map(out.map((d) => [`${d.file}:${d.symbol}`, d])).values()];
}

function selfTest() {
  const fixedToday = new Date("2026-09-01T00:00:00Z");
  const cases = [
    ["daysSince counts whole days", daysSince("2026-08-20", fixedToday) === 12],
    ["daysSince rejects nonsense", daysSince("not-a-date", fixedToday) === null],
    [
      "otherLiveExports ignores the candidate itself",
      !otherLiveExports("scripts/check-dead-code-candidate.mjs", "assess").includes("assess"),
    ],
    [
      "otherLiveExports finds siblings",
      otherLiveExports("scripts/check-dead-code-candidate.mjs", "assess").includes("historyIsComplete"),
    ],
  ];
  let failed = 0;
  for (const [name, pass] of cases) {
    if (!pass) {
      console.error(`  FAIL ${name}`);
      failed++;
    } else console.log(`  ok   ${name}`);
  }
  if (failed) {
    console.error(`dead-code-candidate self-test: ${failed} failure(s)`);
    process.exit(1);
  }
  console.log("dead-code-candidate self-test passed.");
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();

  const arg = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };
  let candidates = [];

  const symbol = arg("--symbol");
  const file = arg("--file");
  if (symbol && file) {
    candidates = [{ symbol, file }];
  } else if (symbol || file) {
    console.error("usage: --symbol <name> --file <path> | --diff <base-ref> | --self-test");
    process.exit(2);
  } else {
    // Default to auditing this branch against its merge-base, so the bare npm script
    // is the gate an agent runs before proposing any deletion.
    const base = arg("--diff") || sh("git", ["merge-base", "origin/main", "HEAD"]).trim() || "origin/main";
    candidates = removedDeclarationsInDiff(base);
  }

  if (!candidates.length) {
    console.log("[dead-code] no removed declarations to assess.");
    return;
  }

  let refused = 0;
  for (const { symbol, file } of candidates) {
    const r = assess(symbol, file);
    if (r.ok && !r.warnings.length) {
      console.log(`  CLEAR   ${symbol}  (${file})`);
      continue;
    }
    console.log(`  ${r.ok ? "REVIEW " : "REFUSE "} ${symbol}  (${file})`);
    for (const m of r.refusals) console.log(`      x ${m}`);
    for (const m of r.warnings) console.log(`      ! ${m}`);
    if (!r.ok) refused++;
  }

  console.log(`\n[dead-code] ${candidates.length} candidate(s), ${refused} refused.`);
  if (refused) {
    console.error("[dead-code] FAIL — at least one candidate is not safe to delete on reachability alone.");
    process.exit(1);
  }
  console.log(
    "[dead-code] PASS — no candidate tripped a safety check. Reachability is still only necessary, not sufficient.",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
