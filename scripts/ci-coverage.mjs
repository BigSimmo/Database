#!/usr/bin/env node
/**
 * ci-coverage.mjs — does `.github/workflows/ci.yml` actually re-run a named gate
 * for a given change scope?
 *
 * Extracted from the retired `gate-arbiter.mjs` (owner-approved governance cut,
 * 2026-09-17) because `scripts/browser-test-plan.mjs` depends on `deriveCiCoverage`
 * to report, honestly, whether GitHub will repeat the browser gate it is about to
 * narrow locally. The arbiter's deferral logic did not survive the cut; this
 * derivation did, because it answers a question with no other source of truth:
 * a step's presence in the YAML is not coverage — its guard, and its job's guard,
 * must actually be satisfied by the current change scope.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The `npm run <script>` invoked by a real YAML `run:` step.
 *
 * Anchored the same way `check-gate-manifest.mjs` anchors it, so a comment
 * mentioning `run: npm run X` cannot masquerade as an executed step.
 */
const npmRunScript = (line) =>
  line.match(
    /^\s*(?:-\s*)?run:\s+npm run ([\w:.-]+)(?:\s+--\s+--merge-reports=[\w./-]+(?:\s+--reporter=default)?)?\s*(?:#.*)?$/,
  )?.[1];

/** A `run: |` or `run: >` block opener; its body is the following more-indented lines. */
const isRunBlockOpener = (line) => /^\s*(?:-\s*)?run:\s*[|>][-+]?\s*$/.test(line);

/** Whether one shell line inside a `run:` block invokes `npm run <name>` as a command (not a comment). */
const shellLineRunsScript = (line, name) =>
  !/^\s*#/.test(line) &&
  line
    .split(/[\s;&|()]+/)
    .some((token, index, tokens) => token === "npm" && tokens[index + 1] === "run" && tokens[index + 2] === name);

/**
 * Local gate name -> the CI script that covers it under a different name.
 * e.g. locally `npm run test` is the plain Vitest run, and CI enforces it as
 * `test:coverage` in the dedicated coverage job.
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
 * package.json body contains the gate.
 *
 * A step's presence in the YAML is not coverage: `lint` and `typecheck` are
 * step-conditional on `static_heavy_changed`, and `test:coverage` is job-conditional
 * on `coverage_changed`, so a docs-only change is covered by none of them. Every
 * guard on the step and its job is evaluated against the current change scope, and
 * an unsatisfied guard means not covered.
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

  /**
   * Every CI line index whose `run:` invokes `name`: a single-line `run: npm run <name>`, or a
   * `run: |` block with `npm run <name>` on any body line (reported at the `run:` line, so the
   * step's guards are found the same way).
   */
  const stepsRunning = (name) =>
    lines.flatMap((line, index) => {
      if (npmRunScript(line) === name) return [index];
      if (!isRunBlockOpener(line)) return [];
      const indent = line.search(/\S/);
      for (let next = index + 1; next < lines.length; next += 1) {
        if (lines[next].trim() === "") continue;
        if (lines[next].search(/\S/) <= indent) break;
        if (shellLineRunsScript(lines[next], name)) return [index];
      }
      return [];
    });

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
    // Report the unverifiable TERMS, not only wholly-unverifiable guards, so a guard
    // containing one satisfied scope flag alongside one unverifiable term (e.g. draft
    // state) does not get silently dropped from `assumed`.
    const assumed = guards.flatMap((guard) =>
      String(guard)
        .split("&&")
        .map((term) => term.trim())
        .filter((term) => term.length > 0 && scopeFlagsInGuard(term).length === 0),
    );
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
