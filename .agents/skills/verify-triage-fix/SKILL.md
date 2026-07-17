---
name: verify-triage-fix
description: Diagnose and fix local Database repository verification failures using the smallest reproducible target, failure classification, known-flake evidence, and narrow reruns before broader gates. Use when lint, typecheck, Vitest, Playwright, build, offline RAG, workflow tooling, or another local check fails or appears hung.
---

# Verify Triage Fix

1. Capture the exact failed command, exit code, complete actionable error, and relevant artifact path. Do not combine more checks until the failure is understood.
2. Classify a saved log with:
   `npm run workflow:triage -- --log <path>`
   Without `--log`, the planner uses `.local/workflow-last-failure.json` when present.
3. Verify the classification:
   - regression: reproduce the smallest test, typecheck target, or build surface;
   - environment: inspect runtime, paths, dependencies, process ownership, and timeouts;
   - provider/configuration: stop and request approval or missing configuration;
   - known flake: prove the signature matches `tests/flake-ledger.json` before treating it as such.
4. Change only the smallest confirmed cause. Do not hide failures by weakening assertions, increasing timeouts blindly, or broad refactoring.
5. Rerun the smallest failing target after each fix. Widen to `verify:cheap`, `verify:ui`, or `verify:pr-local` only after it passes.
6. Distinguish code defects, pre-existing failures, environment blockers, and provider gates in the final report.

Never use provider access to diagnose a local failure without explicit confirmation.
