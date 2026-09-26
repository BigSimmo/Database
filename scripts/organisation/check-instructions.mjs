#!/usr/bin/env node
// One entry point for the instruction-file checks (`npm run check:instructions`):
//   - retired rules: no live instruction file states a rule the owner has dropped
//     (scripts/organisation/check-retired-rules.mjs, docs/organisation/retired-rules.json)
//   - size budget: AGENTS.md and CLAUDE.md stay under their byte ceilings
//     (scripts/organisation/check-instruction-budget.mjs, docs/organisation/instruction-budget.json)
//
// Modes (shared by both checks):
//   (no arguments)              the working tree (local use)
//   --base <sha> --head <sha>   what the change did: added lines, and growth past a ceiling
//   INSTRUCTIONS_CHECK_MODE=ci  the same, reading BASE_SHA and HEAD_SHA from the environment; both
//                               must be set, except that an all-zero BASE_SHA (first push of a new
//                               branch) checks HEAD's in-scope files in full
//   --paths <file|folder...>    retired rules only, over any files (the budget does not apply)
// Option: --root <repo>.
// Exit: the worst of the two checks — 0 pass, 1 a real problem, 2 could not check.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatBudgetReport, runInstructionBudgetCheck } from "./check-instruction-budget.mjs";
import { defaultRoot, formatRetiredRulesReport, runRetiredRulesCheck } from "./check-retired-rules.mjs";
import { BadInput, parseInstructionArgs } from "./instruction-checks-shared.mjs";

export function main(argv = process.argv.slice(2), env = process.env) {
  let args;
  try {
    args = parseInstructionArgs(argv, env, { allow: ["paths"] });
  } catch (error) {
    if (!(error instanceof BadInput)) throw error;
    console.log(`instructions: exit 2 (could not check) — ${error.message}`);
    return 2;
  }
  const root = args.root ? path.resolve(args.root) : defaultRoot();
  const annotate = env.GITHUB_ACTIONS === "true" && args.mode !== "paths";

  const retired = runRetiredRulesCheck({ ...args, root });
  for (const line of formatRetiredRulesReport(retired, { annotate })) console.log(line);

  let budgetCode = 0;
  if (args.mode === "paths") console.log("instruction-budget: skipped (--paths checks retired rules only)");
  else {
    const budget = runInstructionBudgetCheck({ ...args, root });
    for (const line of formatBudgetReport(budget, { annotate })) console.log(line);
    budgetCode = budget.exitCode;
  }
  return Math.max(retired.exitCode, budgetCode);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`instructions: checker crashed: ${error?.stack ?? error}`);
    process.exitCode = 2;
  }
}
