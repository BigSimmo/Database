# Verification Gates and the Gate Arbiter

<!-- BEGIN:verification-gates -->

## Gate selection

- **Verification principle:** run the smallest check capable of detecting a plausible regression introduced by the current diff. Before starting a check, identify the failure class it covers, whether a successful check already covered that class, whether a cheaper focused check offers comparable detection, and whether the incremental confidence justifies the runtime, resource use, and repository-lock contention. If there is no plausible changed failure path, do not run the check.

| Tier                    | Use when                                                                                                                            | Default evidence                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 0 — No test command     | Explanation, planning, prompt writing, read-only inspection, or no repository change                                                | No test, build, server, or baseline command                                                                          |
| 1 — Static/focused      | Documentation, comments, metadata, or narrow non-behavioural configuration                                                          | Relevant format, docs, syntax, generated-file, or diff check only                                                    |
| 2 — Focused behavioural | A localized helper, component, contract, or test change                                                                             | Directly affected unit/DOM/contract test; add typecheck only when the edit can affect compilation or a type contract |
| 3 — Domain gate         | Shared UI/routing, dependencies, security, privacy, RAG, clinical output, production configuration, or another cross-cutting domain | The smallest applicable repository/domain selector, focused journey, or contract gate                                |
| 4 — Broad handoff       | The diff crosses multiple subsystems, cannot be bounded reliably, or the task explicitly requires PR/release confidence             | One appropriate broad gate, selected rather than stacked by default                                                  |

- Do not run a broad baseline routinely before localized work, and do not select `verify:cheap` merely because a change is described as “non-trivial.” Use `npm run verify:cheap` once when cross-module risk warrants a broad offline gate. Use `npm run verify:pr-local` when a change is ready for PR handoff: it now classifies the changed paths, runs focused documentation/workflow contracts for recognised low-risk scopes, and fails closed to lint, typecheck, the full unit suite, RAG fixture validation, and relevant build/domain gates for executable or unknown scope. If the diff has not changed, do not run `verify:cheap` first merely to repeat the same coverage.
- Do not stack focused tests, full tests, typecheck, lint, build, and browser checks unless each catches a distinct plausible regression. Do not rerun an unchanged successful gate. Since 2026-08-21 that last rule is enforced rather than remembered: `scripts/gate-receipts.mjs` memoises `lint`, `typecheck` and non-coverage Vitest runs against a content signature, so an identical re-run on unchanged content exits 0 immediately instead of repeating the work. A reused receipt must be reported as "reused receipt from <time>", never as a fresh run; use `GATE_RECEIPTS=refresh` when fresh evidence is the point, `GATE_RECEIPTS=off` to disable, and `npm run receipts` to inspect the store. Receipts are local-only and never reach CI — `CI` being set disables reuse outright, because GitHub remains the authoritative merge gate. Do not memoise `build` or `test:coverage`; their artefacts are read by later gates. Contract: `docs/process-hardening.md` and `tests/gate-receipts.test.ts`. A deliberately skipped low-yield broad gate is not automatically verification debt; report the skipped check and its risk-based reason concisely.
- A fast-fail subset may precede a broader required gate only when the later gate excludes that subset for the same event; retain a fail-safe full path whenever the subset is skipped. Likewise, do not pre-run a build, install, or server setup that the selected wrapper performs itself. Guard these disjoint/fallback rules with workflow contract tests so a later edit cannot silently restore duplicate work or create a coverage hole.
- Use dry-run selectors before expensive gates when scope is uncertain. `npm run verify:pr-local -- --dry-run --files <comma-separated paths>` inspects PR-local selection without running commands. The broader `--extended` plan is dry-run only unless explicit approval is reflected by `ALLOW_EXTENDED_PR_LOCAL=true`.
- CI uses the same fail-closed scope model: recognised docs and workflow/policy-only changes run focused contracts; executable product/test/config, dependency, database, container, RAG, security-sensitive, mixed, or unknown paths retain the applicable heavy jobs. Do not broaden a path trigger or restore an always-on heavy job without evidence that the focused route misses a realistic failure class. Scheduled drift/release checks and the always-reporting `PR required` aggregate remain safety backstops.
- Let the repository run coordinator control cross-worktree verification. It permits at most two focused Vitest/read-only typecheck leases from different worktrees; full Vitest, coverage, lint, build, Playwright, and live-provider tests remain exclusive. Do not install while a repository test, build, lint, typecheck, or server command is active. Avoid aggressive short-interval polling, and do not repeat an unchanged full gate after it passes.
- **Running several Claude Code sessions at once is safe only when each session works from its own worktree (`newtask`) and no two sessions target the same branch or pull request.** Inside that boundary the coordinator above already lets safe work overlap — two sessions can hold a focused-test/typecheck lease together, and heavier gates (lint, build, full tests, Playwright) simply queue behind each other rather than colliding. Never work around a busy/queued coordinator message by forcing or deleting lock state; wait, or narrow the gate. The single biggest thing that makes other sessions wait is one session holding a broader gate than the change needs, so keep to the narrowest tier in the verification pyramid above.
- For UI, frontend, browser, routing, styling, reduced-motion, or forced-colors behaviour changes, run `npm run ensure` before browser work and prove the changed owner or journey first. Use `npm run verify:ui` when shared UI foundations changed or PR/handoff policy requires the complete Chromium gate, not as an automatic addition after focused proof. For phone-chrome changes, run `npm run verify:phone-chrome` first: it checks installed-lock parity, selects the affected browser/PWA owners and exact journeys, and adds `verify:ui` last only when shared chrome foundations make the broad gate necessary. Inspect uncertain scope with `-- --dry-run`. Chromium evidence does not close physical Safari or installed-PWA acceptance gaps.

- For explicit release confidence, use `npm run verify:release` once; this includes the full Playwright project set and retains all provider-approval requirements. Ordinary local completion or PR handoff does not by itself authorize or require this release gate.
- For clinical ingestion, answer generation, source governance, privacy, production-readiness, or environment changes, run the smallest relevant domain check plus `npm run check:production-readiness`.
- For pull requests that touch ingestion, answer generation, search/ranking, source rendering, document access, privacy, production env, or clinical output, complete the clinical governance preflight in `.github/pull_request_template.md`.
- Track known verification debts and staged process improvements in `docs/process-hardening.md` instead of relying on chat-only memory.

## Do not pay twice for the verdict GitHub is about to reach

`check:gate-manifest` enforces a one-way invariant: CI never runs LESS of the local
`verify:cheap` static set than the local chain does. Read that the other way and it says
something uncomfortable — **every local run of a gate in that chain is work GitHub is
about to repeat.** `gate-receipts.mjs` removed the local-versus-local duplication (the
same gate twice on unchanged content); it explicitly cannot touch this one, because CI
must never reuse a receipt.

That does not make the local run waste. It is a **bet**: a local run that fails saves a CI
round trip, and a red or superseded push is expensive here (~40% of PR CI runs measured
2026-07-30 were cancellations). A local run that passes bought nothing the CI run would not
have established. So the question is never "local or CI" in the abstract, it is:

> **Is this gate, on this kind of change, still catching anything?**

**The rule: run an expensive local gate only while it is still earning its runtime, and
never re-derive a verdict that already exists.** Before running `lint`, `typecheck`,
`test`, `verify:cheap`, or `verify:pr-local`, consult the arbiter and quote its verdict:

```bash
npm run arbiter -- <gate>      # RUN / DEFER / PROVEN, with its evidence
npm run arbiter:status         # the yield ledger and the duplication bill so far
```

It weighs three inputs, none of them hard-coded, so the answer moves as the repo moves:

1. **CI coverage**, derived live from `package.json` + `.github/workflows/ci.yml`, and
   evaluated **for this change** — the step's own `if:` and its job's `if:` are checked
   against the current change scope, because a step's presence in the YAML is not
   coverage. `lint` and `typecheck` are step-conditional on `static_heavy_changed` and
   `test:coverage` is job-conditional on `coverage_changed`, so a docs-only change is
   covered by none of them. A gate CI does not re-run is never deferrable — local is the
   only gate there is. Delete the CI job and the arbiter stops deferring to it the same day.
2. **Observed yield**, a rolling per-gate, per-change-class window of local outcomes that
   the gate wrappers record automatically. A gate that has caught nothing across a full
   clean window on this class of change has stopped earning its runtime. The **first catch
   resets the window** and the gate runs locally again, so the loop re-arms itself instead
   of decaying toward "never check anything".
3. **Content identity** — a verdict GitHub already reached on exactly this content
   (recorded with `npm run arbiter -- record-ci <sha> <gates…>` when a session observes CI
   go green) is not re-derived locally. This is the common repetition: CI goes green on a
   branch head, and a later session runs the whole suite again on that same head. Name the
   gates CI actually ran — the command refuses a bare invocation rather than turning one
   observed job into proof for every gate.

The window is per change class because the classes are not the same bet: docs-only clears
in 3 clean runs, source in 12, and **db, RAG, dependency, container, workflow, UI and
unrecognised scope never defer at all**, however clean the history — the same fail-closed
routing CI itself uses, not a second risk model.

Non-negotiable boundaries, all of them the conservative direction:

- **Fail open.** Missing data, unreadable CI, an unknown change class, a git failure — every
  one of them runs the gate. A bug in the arbiter costs a redundant run, never a skipped one.
- **CI is never advised by it.** `CI` being set disables the arbiter outright. GitHub stays
  the authoritative merge gate and nothing computed locally may influence what it runs.
- **Advisory by default.** A `DEFER` or `PROVEN` verdict is a recommendation printed with
  its evidence; the wrappers act on it only under `GATE_ARBITER=enforce`. Silently skipping
  a gate a human typed is exactly the failure the evidence rules exist to prevent.
- **A focused run is not full-suite evidence.** A narrowed Vitest invocation records under
  its own identity, so a clean run of single-file tests can never let the whole suite defer.
- **A deferred gate is not a passed gate.** Report it as "deferred to CI — <gate> has caught
  nothing in N consecutive <class> runs", never as green, and never alongside a claim that
  the gate ran. The same applies to `PROVEN`: say "reused receipt" or "CI-proven at `<sha>`".

This does not license skipping verification. It licenses not buying the _same_ verdict
twice. The smallest-correct-gate rule above still decides which gate is right; the arbiter
only decides whether that gate has anything left to tell you before you push.

<!-- END:verification-gates -->
