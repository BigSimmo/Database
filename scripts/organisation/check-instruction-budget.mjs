#!/usr/bin/env node
// Instruction-size budget (organisation framework, suggestion 9). AGENTS.md and CLAUDE.md load into
// every agent session, so each has a byte ceiling in docs/organisation/instruction-budget.json.
//
// Modes:
//   (no arguments)              fail when a budgeted file in the working tree is over its ceiling
//   --base <sha> --head <sha>   fail only when a head file is over its ceiling AND the change grew
//                               it (the base copy was smaller or missing); a file that was already
//                               over and did not grow is a warning, so no PR is blamed for main
//   INSTRUCTIONS_CHECK_MODE=ci  the same, reading BASE_SHA and HEAD_SHA from the environment; an
//                               all-zero BASE_SHA (new branch) checks the head against the ceilings
// Options: --root <repo>, --budget <file> (default docs/organisation/instruction-budget.json).
// Sizes are bytes as git stores the file (CRLF counted as LF).
// Exit: 0 within budget, 1 over budget, 2 bad input (including a budgeted file that is missing).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BadInput,
  formatBytes,
  normalisedText,
  parseInstructionArgs,
  readAtCommit,
  readManyAtCommit,
  resolveRange,
} from "./instruction-checks-shared.mjs";

export const BUDGET_FILE = "docs/organisation/instruction-budget.json";

/** Validate the budget file: { version: 1, files: { "<repo path>": <ceiling in bytes> } }. */
export function loadBudget(text, source = BUDGET_FILE) {
  if (text === null || text === undefined) throw new BadInput(`${source} is missing`);
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new BadInput(`${source} is not valid JSON: ${error.message}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new BadInput(`${source} must be a JSON object`);
  for (const key of Object.keys(data)) {
    if (key !== "version" && key !== "files") throw new BadInput(`${source}: unknown key "${key}"`);
  }
  if (data.version !== 1) throw new BadInput(`${source}: version ${JSON.stringify(data.version)} is not supported`);
  if (!data.files || typeof data.files !== "object" || Array.isArray(data.files)) {
    throw new BadInput(`${source}: "files" must map each file to its ceiling in bytes`);
  }
  const entries = Object.entries(data.files);
  if (entries.length === 0) throw new BadInput(`${source}: "files" is empty`);
  for (const [file, ceiling] of entries) {
    if (!Number.isInteger(ceiling) || ceiling <= 0) {
      throw new BadInput(`${source}: the ceiling for ${file} must be a positive whole number of bytes`);
    }
  }
  return entries.map(([file, ceiling]) => ({ file, ceiling }));
}

/**
 * Judge each budgeted file. `headSizes` maps file -> bytes (a missing file is bad input);
 * `baseSizes` is null when there is no base, otherwise file -> bytes with absent meaning "missing".
 */
export function evaluateBudget(budget, headSizes, baseSizes) {
  const results = budget.map(({ file, ceiling }) => {
    const size = headSizes.get(file);
    if (size === undefined) throw new BadInput(`${file} is in the budget but does not exist`);
    const baseSize = baseSizes ? (baseSizes.get(file) ?? null) : null;
    const over = size > ceiling;
    const grew = baseSizes === null ? null : baseSize === null || baseSize < size;
    const blocking = over && (baseSizes === null || grew);
    return { file, ceiling, size, baseSize, over, grew, blocking };
  });
  return { results, exitCode: results.some((r) => r.blocking) ? 1 : 0 };
}

function sizesAtCommit(root, commit, files) {
  const sizes = new Map();
  for (const [file, buffer] of readManyAtCommit(root, commit, files)) {
    sizes.set(file, Buffer.byteLength(normalisedText(buffer), "utf8"));
  }
  return sizes;
}

function sizesInTree(root, files) {
  const sizes = new Map();
  for (const file of files) {
    const full = path.join(root, file);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      sizes.set(file, Buffer.byteLength(normalisedText(fs.readFileSync(full)), "utf8"));
    }
  }
  return sizes;
}

/**
 * Run the check. Options: { root, mode: "tree"|"range", base, head, budgetPath, cwd }.
 * Returns { exitCode, scope, results, error }.
 */
export function runInstructionBudgetCheck(options) {
  const { root, mode, cwd = process.cwd() } = options;
  const result = { exitCode: 0, scope: "", results: [], error: null };
  try {
    if (mode === "paths") throw new BadInput("--paths does not apply to the size budget");
    const custom = options.budgetPath ? path.resolve(cwd, options.budgetPath) : null;
    const readFile = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
    let evaluation;
    if (mode === "range") {
      const { head, mergeBase } = resolveRange(root, options.base, options.head);
      // A branch older than this check has no budget file at its head: use the checkout's copy (in
      // CI, the merge with the base), so an open PR is never failed for predating the budget.
      const headBudget = custom ? null : readAtCommit(root, head, BUDGET_FILE);
      const budget = custom
        ? loadBudget(readFile(custom), options.budgetPath)
        : headBudget === null
          ? loadBudget(readAtCommit(root, "HEAD", BUDGET_FILE), `${BUDGET_FILE} in the checkout`)
          : loadBudget(headBudget, `${BUDGET_FILE} at ${head.slice(0, 9)}`);
      const files = budget.map((entry) => entry.file);
      const headSizes = sizesAtCommit(root, head, files);
      const baseSizes = mergeBase === null ? null : sizesAtCommit(root, mergeBase, files);
      evaluation = evaluateBudget(budget, headSizes, baseSizes);
      result.scope =
        mergeBase === null
          ? `head ${head.slice(0, 9)} (new branch: no base to compare with)`
          : `head ${head.slice(0, 9)} against base ${mergeBase.slice(0, 9)}`;
    } else {
      const budget = loadBudget(readFile(custom ?? path.join(root, BUDGET_FILE)), options.budgetPath ?? BUDGET_FILE);
      const files = budget.map((entry) => entry.file);
      evaluation = evaluateBudget(budget, sizesInTree(root, files), null);
      result.scope = "the working tree";
    }
    result.results = evaluation.results;
    result.exitCode = evaluation.exitCode;
  } catch (error) {
    if (!(error instanceof BadInput)) throw error;
    result.error = error.message;
    result.exitCode = 2;
  }
  return result;
}

const FIX =
  "Fix: move detail into a docs/agents/*.md file and leave a one-line pointer (the pattern AGENTS.md already uses), " +
  `or, if the growth is deliberate, raise the ceiling in ${BUDGET_FILE} and give the reason in the PR description.`;

/** Human-readable report lines (and GitHub annotations when asked). */
export function formatBudgetReport(result, { annotate = false } = {}) {
  const out = [];
  if (result.exitCode === 2) {
    out.push(`instruction-budget: exit 2 (could not check) — ${result.error}`);
    return out;
  }
  const blocking = result.results.filter((r) => r.blocking);
  out.push(
    blocking.length === 0
      ? `instruction-budget: pass — ${result.scope}`
      : `instruction-budget: exit 1 — ${blocking.length} file(s) over budget; ${result.scope}`,
  );
  for (const r of result.results) {
    const excess = r.size - r.ceiling;
    const baseNote = r.baseSize === null ? "" : `was ${formatBytes(r.baseSize)} at the base`;
    if (r.blocking) {
      const why =
        r.grew === null
          ? ""
          : r.baseSize === null
            ? ", and this change added the file"
            : `, and this change grew it from ${formatBytes(r.baseSize)} bytes`;
      const message = `${r.file} is ${formatBytes(r.size)} bytes: ${formatBytes(excess)} over its ${formatBytes(r.ceiling)}-byte ceiling${why}.`;
      out.push(`  OVER ${message}`);
      if (annotate) out.push(`::error file=${r.file},title=Instruction size budget::${message} ${FIX}`);
    } else if (r.over) {
      out.push(
        `  warning ${r.file} is ${formatBytes(r.size)} bytes, already ${formatBytes(excess)} over its ${formatBytes(r.ceiling)}-byte ceiling; this change did not grow it${baseNote ? ` (${baseNote})` : ""}.`,
      );
    } else {
      out.push(
        `  ${r.file}: ${formatBytes(r.size)} of ${formatBytes(r.ceiling)} bytes, ${formatBytes(r.ceiling - r.size)} to spare${baseNote ? `; ${baseNote}` : ""}`,
      );
    }
  }
  if (blocking.length > 0 || result.results.some((r) => r.over)) out.push(`  ${FIX}`);
  return out;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    args = parseInstructionArgs(argv, env, { allow: ["budget"] });
  } catch (error) {
    if (!(error instanceof BadInput)) throw error;
    console.log(`instruction-budget: exit 2 (could not check) — ${error.message}`);
    return 2;
  }
  const root = args.root
    ? path.resolve(args.root)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const result = runInstructionBudgetCheck({ ...args, root, budgetPath: args.budget });
  for (const line of formatBudgetReport(result, { annotate: env.GITHUB_ACTIONS === "true" })) console.log(line);
  return result.exitCode;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`instruction-budget: checker crashed: ${error?.stack ?? error}`);
    process.exitCode = 2;
  }
}
