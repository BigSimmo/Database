#!/usr/bin/env node
/**
 * gate-arbiter.mjs — decide whether an expensive local gate is still worth running.
 *
 * `gate-receipts.mjs` removed the local-versus-local duplication: the same gate
 * twice on content that did not change between the two runs. It deliberately
 * cannot touch the *other* duplication, the one that costs the most and that
 * nothing measured until now:
 *
 *     run the full suite locally  ->  push  ->  GitHub runs the same suite again
 *
 * `check:gate-manifest` proves that second run always happens. Its invariant is
 * one-way — CI must never run LESS of the local static set than `verify:cheap`
 * does — so for every gate in that chain, a local run before a push is by
 * construction work GitHub is about to repeat.
 *
 * That does not make the local run waste. It is a bet: a local run that FAILS
 * saves a CI round trip, and in this repository a red or superseded push is
 * expensive (~40% of PR CI runs measured 2026-07-30 were cancellations). A local
 * run that PASSES bought nothing that the CI run would not have established.
 *
 * So the question is never "local or CI" in the abstract. It is:
 *
 *     is this gate, on this kind of change, still catching anything?
 *
 * The arbiter answers that from three inputs, none of them hard-coded, so the
 * answer moves as the repository moves:
 *
 *   1. CI coverage, derived live from `package.json` + `.github/workflows/ci.yml`.
 *      Delete the CI job and the arbiter stops deferring to it the same day. A
 *      gate CI does not run is never deferrable: local is the only gate there is.
 *   2. Observed yield, a rolling per-gate, per-change-class window of local run
 *      outcomes, recorded automatically by the gate wrappers. A gate that has
 *      caught nothing across a full clean window on this class of change has
 *      stopped earning its runtime. The FIRST catch resets the window and the
 *      gate runs locally again — the loop re-arms itself rather than decaying.
 *   3. Content identity, so a verdict GitHub already reached on exactly this
 *      content is not re-derived locally at all.
 *
 * Deliberate boundaries, all of them the conservative direction:
 *
 * - **Fail open, always.** Missing data, unparseable CI, an unknown change class,
 *   a git failure — every one of them runs the gate. A bug here costs a redundant
 *   run, never a skipped one. That is the same contract `gate-receipts.mjs` holds.
 * - **CI is never advised by this file.** `CI` being set disables the arbiter
 *   outright. GitHub remains the authoritative merge gate; nothing computed here
 *   may influence what it decides to run.
 * - **High-risk change classes never defer**, however clean the window. Database,
 *   RAG, dependency, container, workflow and unrecognised scopes run locally.
 *   This mirrors CI's own fail-closed routing rather than inventing a second
 *   risk model.
 * - **Advisory by default.** A deferral is a recommendation printed with its
 *   evidence. The wrappers honour it only under `GATE_ARBITER=enforce`, because
 *   silently skipping a gate a human typed is precisely the failure this
 *   repository's evidence rules exist to prevent.
 * - **A deferred gate is not a passed gate.** The verdict says so in as many
 *   words, and must be reported as "deferred to CI", never as green.
 *
 * CLI:
 *   node scripts/gate-arbiter.mjs <gate>        decision + evidence for one gate
 *   node scripts/gate-arbiter.mjs status        the yield ledger, per gate/class
 *   node scripts/gate-arbiter.mjs record-ci <sha> [jobs...]
 *   node scripts/gate-arbiter.mjs clear
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { consultGateReceipt, describeAge } from "./gate-receipts.mjs";

export const LEDGER_FORMAT_VERSION = 1;

export const LEDGER_RELATIVE_PATH = path.join("node_modules", ".cache", "database-gate-yield.json");

/** Observations retained per (gate, class). Long enough to see a trend, short enough to forget stale ones. */
export const MAX_OBSERVATIONS = 40;

/**
 * The gates worth arbitrating: the ones whose runtime is measured in minutes and
 * which CI repeats wholesale. Anything absent is simply run — the arbiter holds no
 * opinion about a check that costs a second.
 */
export const ARBITRATED_GATES = new Set([
  "lint",
  "lint:internal",
  "typecheck",
  "typecheck:internal",
  "typecheck:source:internal",
  "test",
  "vitest",
  "vitest(selected)",
  "verify:cheap",
  "verify:pr-local",
]);

/**
 * The yield identity for a Vitest invocation.
 *
 * A focused run and the full suite are not the same evidence. Recording both as
 * plain `vitest` let twelve passing single-file runs build a clean window that would
 * then permit `npm test` to skip the entire suite — a history produced entirely by a
 * selection that never executed most of it. Reported as P2 by Codex on PR #2245.
 *
 * Only the canonical whole-suite invocation keeps the `vitest` identity; anything
 * that narrows what executes gets `vitest(selected)`, so the two histories never mix.
 * Output-only flags (reporters) do not narrow execution and keep the plain identity.
 *
 * @param {string[]} argumentList
 * @returns {"vitest" | "vitest(selected)"}
 */
export function vitestGateIdentity(argumentList) {
  const narrowing = (argumentList ?? []).some((argument, index) => {
    if (argument === "run") return false;
    if (argument.startsWith("-")) {
      return /^--?(project|t|testNamePattern|grep|shard|dir|related)(?:[.=]|$)/.test(argument);
    }
    // A positional that is not the value of a preceding valueless long option is a
    // file or directory filter.
    const previous = index > 0 ? argumentList[index - 1] : "";
    return !(previous.startsWith("--") && !previous.includes("="));
  });
  return narrowing ? "vitest(selected)" : "vitest";
}

/**
 * Clean observations required before a gate may be deferred, per change class.
 *
 * These are not one number because the classes are not one bet. A docs-only change
 * that has not broken the Vitest suite three times running is very unlikely to break
 * it the fourth; a source change that has not broken it three times running is a
 * small sample of a genuinely risky population, so it must clear a much longer run
 * before the arbiter will spend a CI round trip on it.
 *
 * A class absent from this map is not deferrable at any window length. That is the
 * fail-closed half of the policy and is why `unknown` is not listed.
 */
export const CLEAN_WINDOW_BY_CLASS = new Map([
  ["docs", 3],
  ["source", 12],
]);

/**
 * Change classes that never defer regardless of observed yield.
 *
 * Deliberately the same shape as CI's own fail-closed routing in
 * `scripts/ci-change-scope.mjs`: unknown scope is heavy scope. Adding a class here
 * is safe; removing one is a policy change that needs its own review.
 */
export const NEVER_DEFER_CLASSES = new Set(["db", "rag", "deps", "container", "workflow", "ui", "unknown"]);

function projectRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ enabled: boolean, enforce: boolean, reason: string }}
 */
export function arbiterMode(env = process.env) {
  // CI is the authoritative merge gate; it must never consult a local yield ledger.
  if (env.CI) return { enabled: false, enforce: false, reason: "CI is set — the arbiter never advises CI" };
  const setting = String(env.GATE_ARBITER ?? "").toLowerCase();
  if (setting === "off" || setting === "0" || setting === "false") {
    return { enabled: false, enforce: false, reason: "GATE_ARBITER is off" };
  }
  if (setting === "enforce") return { enabled: true, enforce: true, reason: "GATE_ARBITER=enforce" };
  return { enabled: true, enforce: false, reason: "advisory (set GATE_ARBITER=enforce to act on deferrals)" };
}

function runGit(projectRoot, args) {
  return execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/* ------------------------------------------------------------------ *
 * 1. CI coverage — derived, never assumed                            *
 * ------------------------------------------------------------------ */

/**
 * The `npm run <script>` invoked by a real YAML `run:` step.
 *
 * Anchored to the field exactly as `check-gate-manifest.mjs` anchors it, so a
 * comment mentioning `run: npm run X` cannot masquerade as an executed step. The
 * two files must agree: if this one were looser, the arbiter would defer to a CI
 * job that the manifest check knows does not exist.
 */
const npmRunScript = (line) => line.match(/^\s*(?:-\s*)?run:\s+npm run ([\w:.-]+)\s*(?:#.*)?$/)?.[1];

/**
 * Local gate -> the CI script that covers it under a different name.
 *
 * Mirrors `CI_EQUIVALENT` in `check-gate-manifest.mjs`: locally `npm run test` is
 * the plain Vitest run, and CI enforces it as `test:coverage` in the dedicated
 * coverage job.
 */
export const CI_EQUIVALENT = new Map([
  ["test", "test:coverage"],
  ["vitest", "test:coverage"],
  ["lint:internal", "lint"],
  ["typecheck:internal", "typecheck"],
  ["typecheck:source:internal", "typecheck"],
]);

/**
 * Every `needs.changes.outputs.<flag> == 'true'` reference in a guard expression.
 * @param {string} guard
 * @returns {string[]}
 */
export function scopeFlagsInGuard(guard) {
  return [...String(guard ?? "").matchAll(/needs\.changes\.outputs\.([a-z_0-9]+)\s*==\s*'true'/g)].map((m) => m[1]);
}

/**
 * The guard expressions protecting the CI step at `lineIndex`: the step's own
 * `if:` and the enclosing job's `if:` (which may be a folded `if: >` block).
 *
 * Line-based, like `check-gate-manifest.mjs`, because this repository has no YAML
 * dependency and the shapes involved are the ones that file already parses.
 *
 * @param {string[]} lines
 * @param {number} lineIndex
 * @returns {{ guards: string[], job: string | null }}
 */
export function guardsForStep(lines, lineIndex) {
  const guards = [];
  let job = null;

  // The step's own `if:`, searching back to the start of this step ("- name:" or "- run:").
  for (let i = lineIndex; i >= 0; i -= 1) {
    const line = lines[i];
    if (/^\s*-\s/.test(line) && i !== lineIndex) {
      // Reached the previous step's first line without finding this step's start.
      if (!/^\s*-\s*(name|run|uses):/.test(line)) break;
    }
    const stepIf = line.match(/^\s*(?:-\s*)?if:\s*(.+?)\s*$/);
    if (stepIf) guards.push(stepIf[1]);
    if (/^\s*-\s*name:/.test(line)) break; // start of this step
  }

  // The enclosing job and its job-level `if:`.
  for (let i = lineIndex; i >= 0; i -= 1) {
    if (!/^  \S.*:\s*$/.test(lines[i])) continue;
    job = lines[i].trim().replace(/:$/, "");
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^  \S/.test(lines[j])) break; // next top-level job
      const jobIf = lines[j].match(/^    if:\s*(.*)$/);
      if (!jobIf) continue;
      if (jobIf[1].trim() === ">" || jobIf[1].trim() === "|") {
        // Folded block: collect the more-indented continuation lines.
        const block = [];
        for (let k = j + 1; k < lines.length && /^\s{6,}\S/.test(lines[k]); k += 1) block.push(lines[k].trim());
        guards.push(block.join(" "));
      } else {
        guards.push(jobIf[1].trim());
      }
      break;
    }
    break;
  }

  return { guards, job };
}

/**
 * Does CI re-run `gate` on push, **for this change**?
 *
 * Resolved through three routes, in order: the gate's own name appearing in a CI
 * `run:` step, its declared CI equivalent, or a CI-invoked aggregate script whose
 * package.json body contains the gate. The third route keeps this honest as the
 * chains are reshuffled — CI runs `verify:cheap:internal`, which contains
 * `npm run test`, so `test` is covered without anyone maintaining a list.
 *
 * **A step's presence in the YAML is not coverage.** Reported as P1 by Codex review
 * on PR #2245, and demonstrably so on that PR's own CI: `lint` and `typecheck` are
 * step-conditional on `static_heavy_changed`, and `test:coverage` is job-conditional
 * on `coverage_changed`. For a docs-only change all three are false, so CI skips
 * every arbitrated gate — while a name-only scan reports all three "covered". Under
 * `GATE_ARBITER=enforce` that combination produced the one outcome this module
 * exists to prevent: the local gate deferred, the CI gate skipped, and no verdict
 * anywhere. So every guard on the step and its job is evaluated against the current
 * change scope, and an unsatisfied guard means not covered.
 *
 * Conditions that are not change-scope flags (draft state, event name) cannot be
 * evaluated from a local worktree. They are returned in `assumed` and printed with
 * the decision rather than silently treated as true.
 *
 * @param {string} projectRoot
 * @param {string} gate
 * @param {{ scope?: Record<string, boolean> | null, readFile?: typeof readFileSync }} [options]
 * @returns {{ covered: boolean, via: string | null, reason: string, assumed: string[] }}
 */
export function deriveCiCoverage(projectRoot, gate, { scope = null, readFile = readFileSync } = {}) {
  let ci;
  let scripts;
  try {
    ci = String(readFile(path.join(projectRoot, ".github", "workflows", "ci.yml"), "utf8"));
    scripts = JSON.parse(String(readFile(path.join(projectRoot, "package.json"), "utf8"))).scripts ?? {};
  } catch (error) {
    // Cannot read CI: assume it covers nothing, which makes every gate run locally.
    return {
      covered: false,
      via: null,
      assumed: [],
      reason: `could not read CI definition (${String(error?.message ?? error)})`,
    };
  }

  const lines = ci.split(/\r?\n/);
  const equivalent = CI_EQUIVALENT.get(gate);

  /** Every CI line index whose `run:` invokes `name`. */
  const stepsRunning = (name) =>
    lines.map((line, index) => (npmRunScript(line) === name ? index : -1)).filter((index) => index >= 0);

  /** Aggregate CI scripts whose package.json body invokes `name`. */
  const aggregatesRunning = (name) =>
    Object.keys(scripts).filter((script) => {
      if (typeof scripts[script] !== "string") return false;
      return [...scripts[script].matchAll(/npm run ([\w:.-]+)/g)].some((match) => match[1] === name);
    });

  const candidates = [];
  for (const name of [gate, ...(equivalent ? [equivalent] : [])]) {
    for (const index of stepsRunning(name)) candidates.push({ name, index });
    for (const aggregate of aggregatesRunning(name)) {
      for (const index of stepsRunning(aggregate)) candidates.push({ name: `${aggregate} → ${name}`, index });
    }
  }

  if (candidates.length === 0) {
    return { covered: false, via: null, assumed: [], reason: `no CI step runs ${gate} — local is the only gate` };
  }

  // One satisfied invocation is enough; report the first, and the reason the last
  // candidate failed when none is satisfied.
  let lastUnsatisfied = null;
  for (const candidate of candidates) {
    const { guards, job } = guardsForStep(lines, candidate.index);
    const flags = guards.flatMap(scopeFlagsInGuard);
    const unmet = scope ? flags.filter((flag) => scope[flag] !== true) : flags;
    if (unmet.length > 0) {
      lastUnsatisfied = scope
        ? `CI runs ${candidate.name} in "${job}" only when ${unmet.map((f) => `${f}=true`).join(" and ")}, which this change does not satisfy`
        : `CI runs ${candidate.name} in "${job}" under conditions that could not be evaluated`;
      continue;
    }
    const assumed = guards
      .filter((guard) => scopeFlagsInGuard(guard).length === 0 && guard.trim().length > 0)
      .map((guard) => guard.trim());
    return {
      covered: true,
      via: candidate.name,
      assumed,
      reason:
        `ci.yml runs "${candidate.name}" in job "${job}"` +
        (flags.length > 0 ? `, whose guard ${flags.map((f) => `${f}=true`).join(" and ")} this change satisfies` : ""),
    };
  }

  return {
    covered: false,
    via: null,
    assumed: [],
    reason: lastUnsatisfied ?? `no CI step runs ${gate} for this change`,
  };
}

/* ------------------------------------------------------------------ *
 * 2. Change class                                                     *
 * ------------------------------------------------------------------ */

/**
 * Compact risk label for the working tree's changed files.
 *
 * Delegates the actual path routing to `scripts/ci-change-scope.mjs` rather than
 * re-implementing it. That script is what CI itself uses to decide which jobs run,
 * so the arbiter and CI cannot drift into two different opinions about what a path
 * means — and a future edit to CI's routing moves the arbiter with it for free.
 *
 * Most-specific wins, highest risk first. Anything unrecognised is `unknown`,
 * which never defers.
 *
 * @returns {{ class: string, scope: Record<string, boolean> | null, reason: string }}
 */
export function classifyChange(projectRoot, { exec = execFileSync } = {}) {
  let scope;
  try {
    const output = exec(process.execPath, [path.join(projectRoot, "scripts", "ci-change-scope.mjs"), "--json"], {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    scope = JSON.parse(String(output));
  } catch (error) {
    return { class: "unknown", scope: null, reason: `change scope unavailable (${String(error?.message ?? error)})` };
  }
  return { class: classFromScope(scope), scope, reason: "classified by scripts/ci-change-scope.mjs" };
}

/**
 * Most-specific-wins, highest risk first. Anything unrecognised is `unknown`.
 * @param {Record<string, boolean>} scope
 * @returns {string}
 */
export function classFromScope(scope) {
  if (scope.db_changed) return "db";
  if (scope.rag_eval_changed) return "rag";
  if (scope.lockfile_changed) return "deps";
  if (scope.container_changed) return "container";
  if (scope.workflow_changed || scope.workflow_only) return "workflow";
  if (scope.ui_changed || scope.advisory_ui_changed) return "ui";
  if (scope.source_changed || scope.build_changed || scope.static_heavy_changed) return "source";
  if (scope.docs_only) return "docs";
  return "unknown";
}

/* ------------------------------------------------------------------ *
 * 3. Yield ledger                                                     *
 * ------------------------------------------------------------------ */

export function ledgerPath(projectRoot) {
  return path.join(projectRoot, LEDGER_RELATIVE_PATH);
}

export function observationKey(gate, changeClass) {
  return `${gate}::${changeClass}`;
}

/** @returns {{ observations: Record<string, Array<{at:string,failed:boolean,durationMs:number,head:string|null}>>, ci: Record<string, {sha:string, at:string}> }} */
export function loadLedger(projectRoot, { readFile = readFileSync } = {}) {
  try {
    const parsed = JSON.parse(String(readFile(ledgerPath(projectRoot), "utf8")));
    if (parsed?.version !== LEDGER_FORMAT_VERSION) return { observations: {}, ci: {} };
    return { observations: parsed.observations ?? {}, ci: parsed.ci ?? {} };
  } catch {
    return { observations: {}, ci: {} };
  }
}

function saveLedger(projectRoot, ledger) {
  const target = ledgerPath(projectRoot);
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  const payload = { version: LEDGER_FORMAT_VERSION, observations: ledger.observations, ci: ledger.ci };
  writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(temporary, target); // Atomic: a crash mid-write cannot leave a half-parsed ledger.
}

/**
 * Record one local gate run.
 *
 * Called by the gate wrappers after every arbitrated run. Recording is pure
 * observation — it never changes what the run did — so it is safe to do
 * unconditionally, and it is what fills the window the decision reads.
 *
 * @param {{ projectRoot: string, gate: string, exitCode: number, durationMs?: number, changeClass?: string, env?: Record<string,string|undefined>, now?: () => Date }} options
 */
export function recordGateOutcome({
  projectRoot,
  gate,
  exitCode,
  durationMs = 0,
  changeClass,
  env = process.env,
  now = () => new Date(),
}) {
  if (!arbiterMode(env).enabled) return { recorded: false, reason: arbiterMode(env).reason };
  if (!ARBITRATED_GATES.has(gate)) return { recorded: false, reason: `${gate} is not arbitrated` };

  // An admission-busy exit (75) is a lock-contention outcome, not a verdict about
  // the code. Recording it as a pass would let contention manufacture a clean
  // window; recording it as a catch would keep a healthy gate running forever.
  if (exitCode === 75) return { recorded: false, reason: "admission-busy exit — not a verdict" };

  const resolvedClass = changeClass ?? classifyChange(projectRoot).class;
  const key = observationKey(gate, resolvedClass);
  let head = null;
  try {
    head = runGit(projectRoot, ["rev-parse", "HEAD"]).trim();
  } catch {
    /* detached or not a worktree — the observation is still valid without a head */
  }
  const entry = { at: now().toISOString(), failed: exitCode !== 0, durationMs, head };
  try {
    // Re-read immediately before the write. `renameSync` makes each write atomic, but the
    // read-modify-write around it is not: the lock module permits two shared leases in one
    // worktree, so two gates finishing together would both read the same ledger and the
    // later write would discard the earlier observation. A dropped pass only lengthens a
    // clean window (safe); a dropped CATCH could leave a gate deferred that has started
    // failing again (not safe). Reported by CodeRabbit on PR #2245.
    const current = loadLedger(projectRoot);
    current.observations[key] = [entry, ...(current.observations[key] ?? [])].slice(0, MAX_OBSERVATIONS);
    saveLedger(projectRoot, current);
  } catch (error) {
    return { recorded: false, reason: `could not write the yield ledger: ${String(error?.message ?? error)}` };
  }
  return { recorded: true, reason: "recorded", key, failed: entry.failed };
}

/**
 * Record a CI verdict the session observed, so a later local run on identical
 * content does not re-derive it.
 *
 * Deliberately manual: reading GitHub is provider-backed and needs the
 * confirmation `AGENTS.md` requires, so the arbiter never reaches for it. The
 * session that already looked at CI passes what it saw.
 */
export function recordCiVerdict({ projectRoot, sha, gates, now = () => new Date(), git = runGit }) {
  if (!/^[0-9a-f]{40}$/.test(String(sha ?? "")))
    return { recorded: false, reason: "a full 40-character SHA is required" };
  if (!Array.isArray(gates) || gates.length === 0) return { recorded: false, reason: "name at least one gate" };
  // The regex accepts any 40 hex characters, so a SHA from another checkout would be
  // stored as proof and only surface later as "content differs" rather than "unknown
  // commit". Resolve it here instead. Reported by CodeRabbit on PR #2245.
  try {
    git(projectRoot, ["cat-file", "-e", `${sha}^{commit}`]);
  } catch {
    return { recorded: false, reason: `${sha.slice(0, 12)} does not resolve to a commit in this repository` };
  }
  const ledger = loadLedger(projectRoot);
  for (const gate of gates) ledger.ci[gate] = { sha, at: now().toISOString() };
  try {
    saveLedger(projectRoot, ledger);
  } catch (error) {
    return { recorded: false, reason: `could not write the yield ledger: ${String(error?.message ?? error)}` };
  }
  return { recorded: true, reason: `recorded ${gates.length} CI verdict(s) at ${sha.slice(0, 12)}` };
}

/**
 * Is the working tree byte-identical to a commit CI already proved green?
 *
 * Both halves are required. A clean tree alone proves nothing (HEAD may have moved
 * past the proven commit); a matching diff alone proves nothing (an uncommitted
 * edit is invisible to `git diff <sha> HEAD`). Together they are exact: the content
 * CI judged is the content in front of us. This is what catches the common case —
 * CI goes green on a branch head, and a later session runs the whole suite again on
 * that same head.
 *
 * @returns {{ proven: boolean, sha: string | null, at: string | null, reason: string }}
 */
export function ciVerdictCoversWorkingTree(projectRoot, gate, { git = runGit } = {}) {
  const record = loadLedger(projectRoot).ci?.[gate];
  if (!record?.sha) return { proven: false, sha: null, at: null, reason: "no recorded CI verdict for this gate" };
  try {
    const dirty = git(projectRoot, ["status", "--porcelain"]).trim();
    if (dirty.length > 0) {
      return { proven: false, sha: record.sha, at: record.at, reason: "the working tree has uncommitted changes" };
    }
    // Exit 0 means no difference. `--quiet` implies `--exit-code`.
    git(projectRoot, ["diff", "--quiet", record.sha, "HEAD"]);
  } catch {
    return { proven: false, sha: record.sha, at: record.at, reason: "content differs from the CI-proven commit" };
  }
  return { proven: true, sha: record.sha, at: record.at, reason: "content is identical to the CI-proven commit" };
}

/**
 * Yield of `gate` on `changeClass` over the retained window.
 * @returns {{ runs: number, catches: number, cleanStreak: number, wastedMs: number, lastCatchAt: string | null }}
 */
export function summariseYield(ledger, gate, changeClass) {
  const entries = ledger.observations?.[observationKey(gate, changeClass)] ?? [];
  let cleanStreak = 0;
  for (const entry of entries) {
    if (entry.failed) break;
    cleanStreak += 1;
  }
  const catches = entries.filter((entry) => entry.failed).length;
  return {
    runs: entries.length,
    catches,
    cleanStreak,
    // Time spent on passing local runs of a gate CI repeats: the duplication bill.
    wastedMs: entries.filter((entry) => !entry.failed).reduce((total, entry) => total + (entry.durationMs ?? 0), 0),
    lastCatchAt: entries.find((entry) => entry.failed)?.at ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * The decision                                                        *
 * ------------------------------------------------------------------ */

/**
 * @typedef {{ action: "run"|"defer"|"proven", gate: string, changeClass: string, reason: string,
 *             evidence: string[], enforce: boolean, message: string }} ArbiterDecision
 */

/**
 * Decide whether `gate` should run locally now.
 *
 * Every branch that cannot prove deferral is safe returns `run`. Read the order as
 * a series of veto gates: each one can only send the decision toward running.
 *
 * The `overrides` parameter exists so the decision table can be exercised without a
 * git worktree, a CI file, or a real gate run behind it. Production callers pass
 * none of it and every input is resolved live.
 *
 * @param {{ projectRoot: string, gate: string, env?: Record<string,string|undefined>, now?: () => Date,
 *           overrides?: { receipt?: object, coverage?: object, ciVerdict?: object, changeClass?: string, ledger?: object } }} options
 * @returns {ArbiterDecision}
 */
export function arbitrate({ projectRoot, gate, args = [], env = process.env, now = () => new Date(), overrides = {} }) {
  const evidence = [];
  const mode = arbiterMode(env);
  const run = (reason) => finalise({ action: "run", gate, changeClass: "n/a", reason, evidence, mode });

  if (!mode.enabled) return run(mode.reason);
  if (!ARBITRATED_GATES.has(gate)) return run(`${gate} is not an arbitrated gate — nothing to weigh`);

  // A receipt is stronger than any yield argument: the gate already exited 0 on
  // exactly this content, so defer to the existing memo rather than re-deciding.
  const receipt = overrides.receipt ?? consultGateReceipt({ projectRoot, gate, args, env });
  if (receipt.reuse) {
    evidence.push("a gate receipt already proves this exact content");
    return finalise({
      action: "proven",
      gate,
      changeClass: "n/a",
      reason: "a local receipt already covers this content",
      evidence,
      mode,
    });
  }

  // The change class is resolved FIRST because CI coverage depends on it: a step's
  // guard is evaluated against this change's scope, not in the abstract.
  const change = overrides.changeClass
    ? { class: overrides.changeClass, scope: overrides.scope ?? null, reason: "supplied by the caller" }
    : classifyChange(projectRoot);

  // Veto 1 — CI must actually repeat the gate FOR THIS CHANGE. If it does not,
  // local is the only place the failure is ever caught and deferral is a hole.
  const coverage = overrides.coverage ?? deriveCiCoverage(projectRoot, gate, { scope: change.scope });
  evidence.push(`CI coverage: ${coverage.reason}`);
  if (coverage.assumed?.length > 0) {
    evidence.push(`unverifiable CI preconditions (assumed true): ${coverage.assumed.join("; ")}`);
  }
  if (!coverage.covered) return run(`CI does not re-run ${gate} for this change — local is the only gate`);

  // Veto 2 — content GitHub already judged green needs no local re-derivation.
  const ciVerdict = overrides.ciVerdict ?? ciVerdictCoversWorkingTree(projectRoot, gate);
  if (ciVerdict.proven) {
    evidence.push(`CI verdict recorded at ${ciVerdict.sha.slice(0, 12)} (${ciVerdict.at})`);
    return finalise({
      action: "proven",
      gate,
      changeClass: "n/a",
      reason: `GitHub already ran ${gate} green on this exact content`,
      evidence,
      mode,
    });
  }

  // Veto 3 — high-risk scope always runs locally, however clean the history.
  evidence.push(`change class: ${change.class} (${change.reason})`);
  if (NEVER_DEFER_CLASSES.has(change.class)) {
    return finalise({
      action: "run",
      gate,
      changeClass: change.class,
      reason: `${change.class} scope never defers — CI's own routing treats it as heavy`,
      evidence,
      mode,
    });
  }

  const required = CLEAN_WINDOW_BY_CLASS.get(change.class);
  if (!required) {
    return finalise({
      action: "run",
      gate,
      changeClass: change.class,
      reason: `no deferral window is defined for ${change.class} scope`,
      evidence,
      mode,
    });
  }

  // Veto 4 — the gate must have stopped catching things on this class of change.
  const stats = summariseYield(overrides.ledger ?? loadLedger(projectRoot), gate, change.class);
  evidence.push(
    `observed yield on ${change.class}: ${stats.catches} catch(es) in ${stats.runs} run(s), ` +
      `clean streak ${stats.cleanStreak}/${required}` +
      (stats.lastCatchAt
        ? `, last catch ${describeAge(Math.max(0, Math.round((now().getTime() - Date.parse(stats.lastCatchAt)) / 1000)))}`
        : ""),
  );
  if (stats.cleanStreak < required) {
    const shortfall = required - stats.cleanStreak;
    return finalise({
      action: "run",
      gate,
      changeClass: change.class,
      reason:
        stats.runs === 0
          ? `no observations yet for ${gate} on ${change.class} scope — running to gather one`
          : `${gate} is still earning its cost on ${change.class} scope (${shortfall} more clean run(s) before it may defer)`,
      evidence,
      mode,
    });
  }

  if (stats.wastedMs > 0) {
    evidence.push(`duplicated so far: ${Math.round(stats.wastedMs / 1000)}s of passing local runs CI repeated`);
  }
  return finalise({
    action: "defer",
    gate,
    changeClass: change.class,
    reason: `${gate} has caught nothing in ${stats.cleanStreak} consecutive ${change.class}-scope runs, and CI re-runs it via ${coverage.via}`,
    evidence,
    mode,
  });
}

function finalise({ action, gate, changeClass, reason, evidence, mode }) {
  // Both non-run verdicts are enforceable. A "proven" verdict is the stronger of the
  // two — the gate already passed on exactly this content — so leaving it
  // unenforceable made the whole content-identity path inert while the docs claimed
  // it prevented re-derivation. Reported by Codex and CodeRabbit on PR #2245.
  const enforce = mode.enforce && (action === "defer" || action === "proven");
  const headline =
    action === "defer"
      ? `[gate-arbiter] DEFER "${gate}" to CI — ${reason}`
      : action === "proven"
        ? `[gate-arbiter] PROVEN "${gate}" — ${reason}`
        : `[gate-arbiter] RUN "${gate}" — ${reason}`;
  const lines = [headline, ...evidence.map((item) => `[gate-arbiter]   · ${item}`)];
  if (action === "defer") {
    lines.push(
      '[gate-arbiter] A deferred gate is NOT a passed gate. Report it as "deferred to CI", never as green.',
      `[gate-arbiter] ${enforce ? "GATE_ARBITER=enforce — the wrapper will skip this run." : "Advisory only: the gate will still run. Set GATE_ARBITER=enforce to act on this."}`,
    );
  }
  return { action, gate, changeClass, reason, evidence, enforce, message: lines.join("\n") };
}

/* ------------------------------------------------------------------ *
 * CLI                                                                 *
 * ------------------------------------------------------------------ */

function statusReport(projectRoot) {
  const ledger = loadLedger(projectRoot);
  const keys = Object.keys(ledger.observations).sort();
  if (keys.length === 0) {
    console.log("[gate-arbiter] no observations recorded yet — every gate will run until the window fills.");
  }
  let duplicated = 0;
  for (const key of keys) {
    const [gate, changeClass] = key.split("::");
    const stats = summariseYield(ledger, gate, changeClass);
    const required = CLEAN_WINDOW_BY_CLASS.get(changeClass);
    duplicated += stats.wastedMs;
    const window = required ? `${stats.cleanStreak}/${required}` : `${stats.cleanStreak}/never defers`;
    console.log(
      `  ${key.padEnd(34)} runs=${String(stats.runs).padStart(3)} catches=${String(stats.catches).padStart(3)} ` +
        `clean=${window.padEnd(16)} passing-local-time=${Math.round(stats.wastedMs / 1000)}s`,
    );
  }
  const ciKeys = Object.keys(ledger.ci ?? {});
  for (const gate of ciKeys.sort()) {
    const record = ledger.ci[gate];
    console.log(`  CI verdict: ${gate} green at ${record.sha.slice(0, 12)} (${record.at})`);
  }
  if (duplicated > 0) {
    console.log(
      `\n[gate-arbiter] ${Math.round(duplicated / 60000)} minute(s) of local gate time so far passed on content CI re-ran.`,
    );
  }
  console.log(`[gate-arbiter] mode: ${arbiterMode().reason}`);
}

async function main() {
  const projectRoot = projectRootFromHere();
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "status") return statusReport(projectRoot);
  if (command === "clear") {
    const target = ledgerPath(projectRoot);
    if (existsSync(target)) rmSync(target);
    console.log("[gate-arbiter] yield ledger cleared.");
    return;
  }
  if (command === "record-ci") {
    const [, sha, ...gates] = args;
    // Defaulting to every arbitrated gate turned ONE observed green job into stored
    // proof for all of them — and the proven branch runs before the coverage veto and
    // before NEVER_DEFER_CLASSES, so it would report PROVEN even on db or unknown
    // scope. Reported by CodeRabbit on PR #2245. Name what CI actually ran.
    if (gates.length === 0) {
      console.log(
        "[gate-arbiter] name the gates CI actually ran green, e.g. record-ci <sha> lint typecheck test.\n" +
          "[gate-arbiter] Recording every arbitrated gate from one observation would claim proof this session does not have.",
      );
      process.exit(2);
    }
    const result = recordCiVerdict({ projectRoot, sha, gates });
    console.log(`[gate-arbiter] ${result.reason}`);
    process.exit(result.recorded ? 0 : 2);
  }

  const decision = arbitrate({ projectRoot, gate: command });
  console.log(decision.message);
  if (args.includes("--json")) console.log(JSON.stringify(decision, null, 2));
  // Always exit 0: the arbiter advises, it does not fail a build.
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
