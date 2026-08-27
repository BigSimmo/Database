<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:dependency-shortcut -->

## Dependency shortcut

When the user types exactly `dependency` as the entire task message, after trimming surrounding whitespace, treat it as a shortcut for safe dependency maintenance. This is a Codex chat shortcut, not an app feature, script, automation, or CI workflow.

Goal:
Update direct project dependencies to the newest stable compatible versions, regenerate the existing lockfile, identify source/config/test code that relies on old dependency behavior, make the smallest safe compatibility changes, and verify the result. Do not rewrite the project, switch package managers, discard user work, commit, push, deploy, or run destructive cleanup without explicit confirmation.

Start with read-only inspection:

- Check branch, upstream, worktrees, recent relevant history, and `git status`.
- If on `main`, `master`, `develop`, `release/*`, or another protected/base branch, create/switch to `codex/dependency-maintenance` before editing, if safe.
- Inspect manifests, lockfiles, package-manager config, runtime/toolchain files, workspace layout, CI config, scripts, and documented checks.
- Detect repo-local install/dev/test/build/watch/server processes that could race dependency updates.
- Preserve all existing staged, unstaged, and untracked user work.

Package-manager rules:

- Use the package manager already used by the repo: npm, pnpm, yarn, bun, pip, poetry, uv, cargo, go, bundler, gradle, maven, dotnet, or equivalent.
- Do not switch package managers or create a new lockfile type.
- Respect engines, runtime versions, lockfiles, workspaces, wrappers, and repo conventions.
- In monorepos or polyglot repos, update each ecosystem through its native workspace-aware workflow.

Dependency update rules:

- Identify outdated direct production and development dependencies.
- Compare both manifest ranges and locked/installed versions against latest stable compatible releases.
- Treat “outdated packages found” exit codes as normal where applicable.
- Avoid prerelease, alpha, beta, canary, rc, next, nightly, and experimental versions unless the stable channel points there and explain why.
- Do not use force or legacy flags that bypass peer, engine, resolver, or lockfile integrity checks unless explicitly approved.
- Do not run forced audit fixes or broad destructive codemods.
- If latest is incompatible, use the newest compatible version and document why.
- Group risky updates coherently, such as framework plus plugins, test runner plus coverage, lint core plus plugins, or runtime plus adapter packages.

Compatibility audit:

- For every major update and every core framework/runtime/build/test/lint/UI/database update, inspect release notes, migration guides, peer ranges, engines, and changelogs when available.
- Search source, tests, scripts, config, and CI for imports, APIs, CLI flags, config keys, environment variables, plugin names, generated types, or file paths tied to changed dependencies.
- If old dependency behavior is used, make the smallest safe migration that preserves behavior.
- If migration is large, risky, architectural, or product-affecting, stop after discovery and provide a concrete fix plan with affected files, package versions, sequence, and verification commands.
- Add or adjust focused tests only when needed to prove migrated behavior.

Generated and sensitive files:

- Do not intentionally keep dependency directories, build outputs, caches, logs, local state, test artifacts, browser artifacts, `.env*`, secrets, keys, tokens, credentials, or machine-local config.
- Manifest and existing lockfile changes are allowed.

Verification:

- Run a cheap baseline first when useful to distinguish pre-existing failures.
- After updates, run install/dependency validation, then relevant lint, type check, tests, build, smoke/UI/a11y, codegen, integration checks, or equivalent.
- For frontend/browser-facing changes, run browser/UI verification when framework, bundler, router, styling, test runner, or browser automation changed.
- If a check fails, fix dependency-related breakage and rerun the smallest failing check before broader checks.
- Run non-mutating audit/vulnerability checks when available.
- Confirm no repo-owned dev server, watcher, or temporary process was left running unless requested.

Final response for `dependency` must include:

- Branch and worktree state.
- Package manager, runtime, manifests, and lockfiles detected.
- Outdated dependencies found.
- Dependencies updated, old version -> new version.
- Dependencies not updated and why.
- Files changed.
- Compatibility migrations and old APIs found/fixed.
- Checks run and results.
- Checks not run and why.
- Audit/vulnerability summary.
- Generated/untracked files left behind.
- Branch movement, external repo changes, or process cleanup observed.
- Risks or follow-up work.
- Confirmation that no commit or push was made unless explicitly requested.

After setup:

- Verify root `AGENTS.md` contains exactly one `## Dependency shortcut` section.
- Show the final diff for `AGENTS.md`.
- Summarize what changed.
- Confirm no dependency update, install, test, build, audit, commit, or push was performed.

<!-- END:dependency-shortcut -->

<!-- BEGIN:bug-hunter-shortcut -->

## Bug-hunter shortcut

When the user types exactly `bug-hunter` as the entire task message, after trimming surrounding whitespace, treat it as a shortcut for targeted defect discovery.

Execution rules:

- Invoke the `bug-hunter` skill first.
- Prioritize reproducible defects over code style, naming, or formatting feedback.
- Trace realistic failure paths: invalid input, empty states, retries, race/concurrency issues, stale state/cache, network/auth failures, permissions, and boundary values.
- For each finding, include trigger, expected behavior, actual risk, and the smallest proof (or targeted test/check) that would catch it.
- If no high-confidence defect is found, explicitly state that and list the most likely residual risk area.

Scope and safety:

- Keep the hunt scoped to code touched by the user request unless the defect clearly crosses module boundaries.
- Do not make broad refactors while hunting; propose minimal fixes for confirmed issues.
- Run the smallest focused verification for each confirmed defect, then expand only if needed.

<!-- END:bug-hunter-shortcut -->

<!-- BEGIN:codex-review-throttling -->

## Codex review throttling and routing

Do not review branches opportunistically. Review the current changed diff, PR, or branch only when the user explicitly asks for review/audit/hunter/cleanup/upload work, when CI/check failures are the task, or when the current change touches high-risk areas that require a targeted review before handoff.

Use `docs/codex-review-protocol.md` as the shared review protocol for every repo-local review skill, branch/PR review, audit, bug hunt, release-readiness check, and PR/CI review.

Before reviewing a branch or PR:

- Run `npm run ledger:lookup -- <branch-or-ref> --scope "<scope>"`. It resolves the HEAD, matches the abbreviated SHAs older records used, and prints an explicit verdict. Do not read `docs/branch-review-ledger.md` by eye — live + archive rows are many, and eyeballing is how repeat reviews slipped through. `ledger:lookup` reads archives under `docs/archive/branch-review-ledger-*.md` too.
- On `ALREADY REVIEWED`, summarize the prior ledger outcome and skip the repeat review unless the user explicitly requests a fresh pass.
- On `NOT REVIEWED at this HEAD`, review only the changed scope and append a record after the review.

Before reviewing multiple branches:

- Build a short branch inventory first: branch, upstream, ahead/behind, last commit, and merged status.
- Skip branches already merged into `main`.
- Skip unchanged branches already recorded in `docs/branch-review-ledger.md`.
- Do not re-review every branch after ordinary coding tasks.
- If a repeated request targets unchanged reviewed branches, summarize the prior result and ask before doing another full pass.

Review routing:

- `diff-review`: Use for explicit review of the current diff, PR, or named branch. Findings first, ordered by severity, with file/line evidence.
- `bug-hunter`: Use only for the exact `bug-hunter` shortcut or an explicit defect-hunt request. Prioritize reproducible bugs and smallest proof.
- `repo-auditor`: Use for explicit repo-wide audit/refactor/dead-code/import/dependency-structure requests. Treat outputs as triage, not automatic delete lists.
- `release-readiness`: Use for explicit release, merge, PR readiness, or handoff confidence requests. Do not run provider-backed gates without confirmation.
- `branch-cleanup`: Use only when the prompt explicitly asks for branch cleanup/hygiene or branch deletion candidates. Apply `docs/branch-cleanup-guide.md` and the review ledger before inspecting branch diffs.
- `pr-ci-fix`: Confirmation-required for this repo. GitHub/GitLab API calls, PR comments, CI reruns, commits, and pushes require explicit user approval and must respect the upload/handoff rules. Exception: an explicit `Run PR` sweep carries this approval (see "## Run PR shortcut").

When a branch or PR review completes, record it with `npm run ledger:append -- --ref <x> --head <full-40-char-sha> --scope <s> --outcome <o> --checks <c>`. It creates one content-addressed immutable record file, so concurrent reviews never edit a shared Markdown hunk. Never hand-write a record: hand-written rows produced the mojibake, wrong-width, and duplicate records that the 2026-07-28 hygiene pass had to repair, and `see PR head` or abbreviated HEADs make the throttle unreliable. The legacy Markdown table is frozen for normal PRs; append a correction or superseding record (`--supersede`) instead. `npm run check:branch-review-ledger` validates all sources, while `check:ledger-write-discipline` rejects a legacy-table row change before it becomes a GitHub conflict.

Babysit / Run PR ledger policy: do not push a tip whose sole delta is a babysit review record (that marks every other open PR behind). One Run PR record per PR per sweep; on a later sweep of the same PR, pass `--supersede` rather than stacking another "main sync" record.

<!-- END:codex-review-throttling -->

<!-- BEGIN:resolve-review-threads-after-fixing -->

## Resolve review threads after fixing them

Pushing a fix is not the end of the task when that fix was made in response to a GitHub PR
review comment. Resolving the corresponding review thread is part of the same unit of work,
not a follow-up to remember later — an addressed comment left unresolved still blocks merge
and still reads to reviewers, merge-queue tooling, and `pr-policy.mjs`-style gates as
unaddressed.

- After pushing a fix for a review comment, reply on that thread with a short summary of what
  changed (naming the fixing commit where useful), then resolve the thread once the fix is
  pushed — reply first, resolve second, both before moving to the next item.
- Only resolve a thread you actually fixed or fully dispositioned. Never resolve a thread you
  did not act on, never resolve one to tidy away feedback you disagree with, and never resolve
  a thread on a PR you are only watching on someone else's behalf — leave those for the PR's
  owner or reviewer.
- If the comment needs more than a direct fix (a design decision, missing context, reviewer
  input), reply explaining why instead of resolving, and leave the thread open.
- This does not grant new GitHub write access or user authorisation for separate provider
  writes. Reply and resolve only when the user explicitly authorised those actions for that PR
  (for example, an explicit PR-fixing/babysitting sweep that names replies or thread resolution,
  or the `Run PR` shortcut where that authority is stated) and the available tooling permits
  them. If the user's ask was scoped to only committing and pushing the fix, stop there and tell
  them the reply/resolve step is still open rather than performing it unasked.
- This applies to every PR you push review-responsive fixes to in this repo, not only the
  automated Codex resolve workflow — see "Review comment lifecycle" below for that workflow's
  specific marker convention, and your runtime PR-babysitting instructions for the fuller
  human-reviewer posture this section summarizes.

<!-- END:resolve-review-threads-after-fixing -->

<!-- BEGIN:local-server-safety -->

# Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- If the user asks for UI/frontend changes, browser QA, screenshots, mobile checks, or a local app link, run `npm run ensure` before opening or testing the app, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001`, or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Do not kill or modify other projects' local servers. If the stable project port is busy, let `npm run ensure` choose the next safe project URL.
- Do not run a permanent watcher. Only start or verify the server when the current chat task needs the app or the user asks to run it.

<!-- END:local-server-safety -->

<!-- BEGIN:codex-desktop-worktree-setup -->

# Claude Code hook scripts

`.claude/hooks/*.sh` runs on Linux web containers as well as on the Windows workstation, and the
workstation cannot see the thing that breaks it.

- **Pin the executable bit in the index, not on disk.** The primary workstation is a Windows ReFS
  Dev Drive with `core.fileMode=false`, so git ignores filesystem permission bits entirely and a
  local `chmod +x` is a silent no-op. A hook added there commits as `100644`. Fix it with
  `git update-index --chmod=+x .claude/hooks/<name>.sh` and confirm with `git ls-files -s`.
  This is not hypothetical: `session-start.sh` shipped `100644` while both its siblings were
  `100755` (found 2026-08-18). That script's body only runs when `CLAUDE_CODE_REMOTE=true`, so the
  sole environment it does work in is the Linux container where a non-executable checkout cannot
  be run — and it is the script that provisions the Node 24 the engine floor needs, after
  `npm ci` EBADENGINE blocked PRs #1611, #1697, #1705 and #1740.
- **Register hooks as `bash "$CLAUDE_PROJECT_DIR/…"`, never as a bare path**, so the mode is never
  load-bearing. `session-start.sh` was the only bare-path registration and the only one missing the
  bit; that is not a coincidence worth repeating.
- **Line endings are LF.** `.gitattributes` sets `* text=auto eol=lf`; all hook blobs measure CR=0.
  A CR in a shell blob fails on Linux as the near-unreadable `/bin/bash^M: bad interpreter`.
- **Hooks must not be able to fail a session.** Every hook here exits 0 on any parse problem and
  makes no decision, so a malformed payload leaves the tool call exactly as it was.
- **Set an explicit `timeout`.** The default is 60s, which `session-start.sh` can exceed on a cold
  container (Node tarball download plus `npm ci`) — a killed hook leaves dependencies half
  installed.
- **SessionStart context comes from stdout, not stderr.** A hook that reports on stderr is invisible
  to the model even though it ran and exited 0; `check-base-freshness.mjs` spent its life in that
  state. Emit `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}` on
  stdout, and only when the message is worth the context it costs.

Enforced by the `claude hook scripts are checked in runnable` block in
`tests/session-start-hook.test.ts`, which fails on any hook that is not `100755` or that carries CR
bytes. Do not weaken it.

# Codex Desktop worktree setup

- The Windows Codex Desktop environment setup command is `node scripts/setup-codex-worktree.mjs`.
  It must work before `node_modules` exists, validate Node 24/npm 11, reuse only a complete
  byte-identical local installation, and otherwise run the locked npm install.
- Never configure Windows Desktop worktrees to run `bash scripts/setup-codex-cloud.sh`. That script
  is Linux/Cloud-only; Windows launches it through WSL outside the worktree and cannot provision the
  repository.
- `.codex/environments/environment.toml` is autogenerated and ignored. Change the Database
  environment through Codex settings, then verify the effective command with the generated file and
  `node scripts/setup-codex-worktree.mjs --dry-run`.
- **Web container runtime requirements:** Package manifests enforce strict Node 24 (`>=24.15.0 <25`) and npm 11 engines. If a web container environment boots with Node 22 on `PATH`, do not drop engine-strict; export `/opt/node24/bin` at the front of `PATH` or install Node 24 to satisfy repository engine contracts before running `npm ci`.

<!-- END:codex-desktop-worktree-setup -->

<!-- BEGIN:reasoning-effort-calibration -->

# Reasoning effort calibration

**Repository baseline.** Use `gpt-5.6-sol` with `high` reasoning effort unless the user explicitly
chooses another supported model or effort. `.codex/config.toml` records this default for trusted
Codex clients that honor repository configuration; a task-level selection can override it.

**Cloud xhigh gate.** A running Cloud task cannot raise its own reasoning effort. Before substantive
inspection, planning, tool use, or edits, classify the request against the table and the risk rules
below. If `xhigh` is required and the prompt does not contain the exact marker `[xhigh-confirmed]`,
stop and ask the user to select `xhigh` in the Cloud reasoning control, then resubmit the same request
with `[xhigh-confirmed]`. Do not begin the work at `high`, and do not claim the runtime changed. When
the marker is present, treat it as the user's confirmation that `xhigh` was selected and proceed.
Requests classified as `high` or lower proceed without this gate.

Reasoning effort is a budget in the same way verification is a budget, and it is misspent the same
way — by defaulting to the maximum instead of matching the spend to the risk. **Scale effort to how
expensive the mistake is to undo (irreversibility × branching factor), never to the phase label.**
"Plan high, build lower" is a good default, not a rule; it is wrong often enough that it must be
chosen deliberately rather than assumed.

**Why it is a good default.** Planning errors compound and implementation errors stay local: a wrong
approach throws away the build, a wrong identifier is one edit. A plan is also a few thousand output
tokens against a build's many long turns, so effort is cheapest exactly where it has the most leverage.

**The mechanism that makes it work — do not skip this part.** A lower-effort build only succeeds
against a plan concrete enough to execute: named files, named symbols, ordered steps, and the gate
that will prove it. Downgrading the build against a vague plan does not save effort, it relocates the
thinking into the expensive phase. If the plan cannot name those things, the build is not eligible for
the downgrade.

| Situation                                                                                      | Plan        | Build       |
| ---------------------------------------------------------------------------------------------- | ----------- | ----------- |
| Architecture, Supabase migrations/RLS, RAG ranking surfaces, auth/privacy, ingestion contracts | xhigh       | high        |
| Ordinary feature or UI work with a clear shape                                                 | high        | medium–high |
| Mechanical and fully specified — ledger append, docs edit, rename (not dependency maintenance) | low or skip | medium      |
| Debugging an unknown failure                                                                   | low         | high        |

**Where the default inverts and the build needs more than the plan.** These are plan-light and
execution-heavy; treating them as plan-heavy spends the budget in the wrong place:

- **Debugging.** The plan is "find why X fails." The real reasoning is hypothesis-forming over local
  runtime, logs, and repro state during the build — hosted providers still need explicit confirmation.
- **Constraint-dense implementation.** A one-sentence plan whose edit must simultaneously satisfy
  button wiring, design tokens, the one-composer rule, unlayered CSS, and the tap-target and
  phone-chrome contracts. Holding all of it at once is the hard part, not deciding what to do.
- **Areas where training data is stale.** Next 16 is the standing case. Effort does not repair a wrong
  prior — reading `node_modules/next/dist/docs/` does. Raising effort instead of reading is itself the
  failure mode.

**Constrain xhigh planning output, not just its effort.** Extra-high planning over-produces:
alternatives, contingency branches, and surveys that are never used, paid for twice — once generating
and once reading. Ask for the chosen approach, the files, and the gate, not a survey.

**State the split before non-trivial planning work.** One line before starting: plan effort, build
effort, and the risk that justifies them. It is cheap, it makes a wrong allocation visible while it is
still free to change, and it stops the blanket default from being applied silently.

<!-- END:reasoning-effort-calibration -->

<!-- BEGIN:process-hardening -->

# Process hardening phases

## Bare PR publication is not readiness work

When the user says `open PR`, `create PR`, or `publish PR` without also requesting review, validation, readiness, or CI observation, treat it as a request to publish the prepared change promptly. GitHub is the requested verification surface.

- Inspect only what is necessary to avoid publishing the wrong change: the branch, base, staged/unstaged scope, and PR title/body. Reuse an existing dedicated branch or worktree rather than recreating it. Do not fetch, pull, rebase, review the ledger, inventory history, load a release/handover skill, or create a worktree unless it is necessary to keep unrelated work out of the PR.
- Do **not** run or wait for `npm run format`, dependency installation or linking, `npm run verify:pr-local`, tests, lint, typecheck, builds, browser checks, audits, generated-document synchronization, or CI. Do not invoke a release/readiness workflow for this request.
- If a local commit hook or a readiness-only push guard (format, drift, static, or ledger-write) is the only blocker, publish with `git commit --no-verify` and that guard's own scoped override (`SKIP_FORMAT_GUARD=1`, `SKIP_DRIFT_GUARD=1`, `SKIP_STATIC_GUARD=1`, or `SKIP_LEDGER_WRITE_GUARD=1`, as applicable) instead of `git push --no-verify`; do not spend time preparing dependencies or formatting solely to satisfy the hook. Never skip the push hook wholesale — the auto-merge ownership guard has no override and must never be bypassed, even for a bare-publication request. This exception is limited to the explicit bare-publication request and does not weaken normal-push safeguards.
- Create the PR immediately after the push, using the repository PR template where its policy fields apply. Report the URL and identify all local and hosted checks as unrun by request. Do not babysit CI, amend, or perform follow-up readiness work unless the user asks. This route overrides generic branch-bundling, handover, review, and babysit instructions.

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
- **For normal engineering pushes, run `npm run format` and commit the result before push.** This rule does not apply to the explicit bare PR publication route above. Formatting is in neither `npm run test`, `npm run typecheck`, nor `npm run lint`, so the ordinary loop can report green while the changed-file CI check or exact-commit pre-push guard fails. Three CI failures on 2026-07-30 came from exactly this (two of them on `ci/circleci: verify`, since removed from the repo by PR #1412). Two traps beyond simply running it:
  - **Formatting without committing does nothing for the push.** A push sends commits, not your working tree, so formatting after committing leaves the unformatted blob on the branch. Amend or add a follow-up commit.
  - **A per-file check is not the repository-wide check.** `prettier --check <file>` on the source file you edited passes while a doc or ledger edit in the same push fails; that was the missed file twice out of three.

  `.githooks/pre-push` carries the guard, and since 2026-07-30 it checks the pushed commit where CI checks it: `guard-push.mjs` puts the pushed SHA in a temporary `git worktree` with an exact-lock `node_modules` linked in and runs Prettier there, so neither the working tree's contents nor its prettier config can vouch for the commit, and a dynamic `prettier.config.*` still loads. An isolated worktree without local dependencies may reuse Prettier only from a registered worktree with a byte-identical lockfile and matching installed Prettier version; if none exists, the guard blocks with the explicit `npm ci --include=dev` remediation instead of skipping formatting. A push that changes prettier policy (`.prettierrc*`, `.prettierignore`, `.editorconfig`, or a `package.json` carrying a `prettier` field) escalates to a whole-tree `prettier --check .`, because a policy change alters the verdict for files the push never touched. But `core.hooksPath` is set by this checkout's `npm install`, so an agent pushing from its own environment bypasses the hook entirely and only CI catches the break — which is why the rule above is still a rule.

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

<!-- END:process-hardening -->

<!-- BEGIN:page-and-button-wiring -->

# Deleting code you believe is dead

"Nothing imports it" is necessary and **nowhere near sufficient**. On 2026-08-20 a cleanup
sweep (PR #2204) targeted ~1,644 lines on that single test and had to be walked back seven
times. Four of the survivors had zero importers and were all alive: Ward Flow's
`wallClockNow` and `movementsByStage` (named exports in a phase plan whose 55 tasks were all
unchecked), the Caring Contacts fixtures, and `bestEffortReembedRegistryRecordAfterEdit`
(`docs/rag-hybrid-findings-and-todo.md` says any future registry write route **must** call
it). A module contract whose consumer has not been written yet is indistinguishable from
debris under a reachability scan.

Before removing any exported symbol, run:

```bash
npm run check:dead-code-candidate -- --diff origin/main
```

It fails closed and refuses a candidate that is: named in a `docs/superpowers/plans|specs`
file with unchecked tasks; pinned by a committed test; present as a string literal anywhere
in `src`/`tests`/`scripts`/`worker` (a dynamic-lookup path no import graph shows);
introduced within `DEAD_CODE_RECENT_DAYS` (default 30); or assessed on a **shallow clone**,
where nothing can be dated — run `git fetch --deepen=2000` first rather than proceeding on
the weaker signal. It also warns when the symbol is mentioned in any doc, and when its file
still exports other symbols, because deleting the file is then wrong even if the symbol is not.

Do not tune the threshold or the refusal list to make an existing diff pass. The sweep's
own diff was cut back to satisfy this gate, not the other way round.

# Page and button wiring

Interactive controls and routes follow conventions the codebase already holds to. Before adding
or moving a button, link, or route, read `docs/wiring-conventions.md`. A control that advertises an
action must perform one; a page that ships must be reachable.

- **Buttons.** Every interactive `<button>` must do something: an `onClick`, a `type="submit"`
  inside a `<form onSubmit>`, or navigation (wrap it in a `<Link>` / call `router.push`). A control
  that is unavailable for a **stated reason** — feature not built, or this record lacks the data —
  uses `aria-disabled="true"` + `onClick={ignoreUnavailableActivation}` + `title="… — coming soon"`
  - an `sr-only` note wired via `aria-describedby` (see `favourites-hub.tsx`). Native `disabled`
    would remove the tab stop and the reason would never be reached. Keep native `disabled` for
    **transient** inertness (request in flight, pager at its last page, form action awaiting
    validity). Never both attributes on one button — lint fails on the pair. **Never** ship a styled,
    `aria-label`led button with no handler and no disabled state — that was the "Language and region"
    defect fixed 2026-07-21.
- **Navigation.** Internal navigation uses `<Link>`, `router.push`, or server `redirect()` — never
  a raw `<a href="/…">` to an internal route. Build hrefs from the existing sources
  (`src/lib/app-modes.ts`, `src/lib/tools-catalog.ts`, `src/lib/universal-search.ts`), not
  hardcoded strings scattered across components.
- **New-route checklist.** Add the page → link it from real nav (sidebar / launcher / mode home /
  search) → `npm run docs:update` → document it in `docs/codebase-index.md` → add a
  reachability/coverage assertion. A production page route with no inbound link is an orphan.
  The committed pre-commit hook runs this synchronization for relevant staged changes and stops
  when generated docs need review/staging; it never stages files automatically.
- **Gates.** `eslint-rules/require-button-wiring.mjs` (in `npm run lint`) fails on an un-wired
  `<button>`; `tests/route-reachability.test.ts` (in `npm run test`) fails when a production page
  route has no inbound nav link unless it is consciously added to that test's documented
  allowlist (redirect targets / legacy-compat routes). Both run in `verify:cheap` and CI. Mockups
  (`src/app/mockups/**`, `*-mockups.tsx`) are design-scratch and exempt from both — **and from
  nothing else**. Mockups are compiled like any other source: they are typechecked, and their client
  chunks are still weighed by `check:bundle-budget` — against the separate `mockups` scratch budget,
  not the `production` one (reconciled 2026-08-09; see "Bundle budget" below). Do not read "exempt"
  as "free".
- **Never** add a production page route without either an inbound link or a documented
  reachability allowlist entry plus an `/issues` note, and never silence the button-wiring rule
  with a blanket disable — wire the control or make it an explicit placeholder.

# Bundle budget

`check:bundle-budget` enforces **three complementary safeguards** in `bundle-budget.json`:

- **`production`** — every chunk a non-mockup route reaches, plus chunks no route manifest claims
  (framework, polyfills, runtime). This is user-facing weight and the real regression guard.
  Tolerance 10%. A failure here means find the regression; do not refresh the baseline to clear it.
- **`routes`** — client JavaScript referenced by `/`, `/therapy-compass`, `/documents/search`,
  `/dsm`, and `/forms`, the same journeys measured by Lighthouse. Each route has a 10% tolerance,
  so local growth cannot hide inside a still-healthy repository aggregate.
- **`mockups`** — chunks reachable **only** from `/mockups/**`. Nobody downloads these, so this is a
  repo-hygiene ceiling for unbounded accumulation, not a per-mockup gate. Tolerance 25%.

A chunk shared by a mockup and a production route counts as production — it would be built either
way. Attribution comes from the per-route `*_client-reference-manifest.js` files under
`.next/server/app`; if that tree is missing, resolves no routes, or omits a configured route, the
check **fails closed** rather than collapsing the buckets or silently dropping a route.

Why the split rather than a raised ceiling: measured on `main` at `af85cbc`, the repo-wide total was
+9.96% of the old single baseline — 576 bytes from failing `Build` — while production-only was
**9.06% below** it. Every byte of the apparent regression was design scratch; production had
actually shrunk since the baseline was captured. Raising the ceiling would have hidden that.

**Measuring:** `npm run build` reuses a cached `.next`, and the check then reads stale output and
reports byte-identical numbers — it will tell you the budget passes when it does not. Always
`rm -rf .next` before measuring, and sanity-check `.next/BUILD_ID`'s mtime against the current
commit before trusting a number.

<!-- END:page-and-button-wiring -->

<!-- BEGIN:search-chrome-behaviour -->

# Search chrome behaviour

The shared search chrome must adapt by page ownership, not by ad-hoc padding or route-local overlays. Before changing `MasterSearchHeader`, `GlobalSearchShell`, `ClinicalDashboard`, `DocumentViewer`, phone dock reserves, or search-composer placement, read `docs/search-chrome-behaviour.md`.

- **One owner.** A page either uses the shell/dashboard composer, owns an in-flow hero composer, or owns a document-viewer composer. Do not stack a second fixed search bar or a second dock-sized content pad below a page-owned composer.
- **Phone edge-to-edge contract.** Fixed phone composers are flush to the viewport bottom and paint their own safe-area/home-indicator region while visible. They must not use a non-zero `bottom` gap in edge-to-edge dock mode.
- **Hidden means zero reserve.** When phone search/header/footer chrome scroll-hides, the content-facing reserve is `0rem`; do not restore `0.75rem`, `env(safe-area-inset-bottom)`, or `var(--safe-area-bottom)` as hidden padding. Visible composer chrome may still consume safe-area inset.
- **Header/footer symmetry.** Top header and bottom composer hide/reveal from the same scroll signal where they share a scroll container. If one is hidden, page content behind that edge must be fully visible rather than covered by an opaque white/surface band.
- **Page adaptation.** Standalone mode homes keep the composer in-flow in the hero on phones; submitted/search-result views use the compact bottom dock; answer mode may use overlaid glass header behaviour with matching top reserve; document detail/source routes let `DocumentViewer` own its composer.
- **Default in-page navigation.** When adding or suggesting in-page navigation on any mode page, use the DocumentViewer header as the template: back control, title + active-section subtitle + chevron sheet, ellipsis actions, weighted segment track, and `PhoneHeaderCollapsePortal` so the header attaches under the universal phone header and hides/reveals with that single collapse owner. Do not invent a second sticky/fixed phone nav header or a separate scroll-hide hook. Full contract: `docs/search-chrome-behaviour.md` (“Default in-page navigation template”). Therapy `ModeNav` remains a different multi-route pattern.
- **Guards.** Update the reserve helper, CSS tokens, Playwright phone-scroll coverage, and static contract tests together. Do not silence the existing reserve/overlay tests; add a narrower guard for any new page-specific exception. Run `npm run verify:phone-chrome`; its smart selector must keep focused owner/journey proof before any recommended full `verify:ui` escalation.

<!-- END:search-chrome-behaviour -->

<!-- BEGIN:external-skill-precedence -->

# External skill precedence

User-global skills and output-style plugins are installed outside this repo and know nothing about
its contracts. Where they conflict with repo docs or committed tests, the repo wins. This section
is the tie-breaker for that case only: it scopes external, generic guidance and does not override
system, developer, user, security, or compliance requirements, which remain higher priority.

- **Repo contracts outrank generic rules.** The Front-End Checklist skill corpus (~390 user-global
  skills: `alt-text`, `touch-targets`, `focus-styles`, `reduced-motion`, `color-contrast`, and so
  on) is generic guidance. On any conflict these win: `docs/wiring-conventions.md`,
  `docs/search-chrome-behaviour.md`, `docs/rag-behaviour/`, the `@theme` tokens in
  `src/app/globals.css`, and any committed test.
- **Never regress a fixed flake to satisfy a generic rule.** Known collision: generic touch-target
  guidance often teaches the WCAG 2.1/2.2 AAA-level "enhanced" criterion (2.5.5: 44×44 px, which is
  `min-h-11` in Tailwind), though the AA-level minimum is 24×24 px (2.5.8). This repo's production
  tap targets use `min-h-12` (48 px) — exceeding both the AA minimum and the AAA enhanced criterion —
  because `min-h-11` (44 px) hit a sub-pixel rounding flake in `ui-smoke`. Design-scratch mockups
  (`*-mockups.tsx`) still carry `min-h-11` and are gate-exempt. Do not "fix" production back to
  `min-h-11` to satisfy the generic rule.
- **Unlayered CSS is deliberate.** Component classes in `globals.css` intentionally override
  Tailwind utilities. Generic specificity and utility-first advice does not apply here.
- **Cite the source when applying an external rule.** If a checklist rule drives a change, name the
  rule and confirm it contradicts no repo doc or test.

## Evidence and calibration are never compressed

Output-style plugins such as caveman mode may compress prose. They must never compress proof.

- **Always paste the decisive line.** Report gates with real output, not a summary. Under heavy-lock
  contention, `npm run verify:ui` queues Playwright admission for up to 15 minutes and, if still
  blocked at the deadline, exits `75` with a `DATABASE_HEAVY_RUN_ADMISSION_BUSY` marker
  (`run-playwright.mjs`) — a distinct non-zero code from an ordinary test failure, so tooling can
  tell "blocked, retry" apart from "red", but it never soft-skips green either way. When the gate
  does run, grep for the "N passed" line; exit 0 alone is not proof.
- **State verified versus assumed.** Calibration is not filler. Say what was actually run, what was
  read, and what is inferred. Do not drop uncertainty to save tokens.
- **Third-party fix claims stay unverified until checked.** Bot or agent claims that a fix landed
  must be verified against the actual ref/commit content before being repeated as fact. Prioritize
  inspecting already-fetched local refs (`git log`, `git show`) first; `git fetch` or other
  network/provider access requires explicit user confirmation per the "API and provider confirmation
  boundary" section.
- **PR titles and descriptions are parsed input, not prose.** `.github/workflows/pr-policy.yml`
  runs `scripts/pr-policy.mjs` against the exact PR title/body text and hard-blocks the merge
  when a clinical-risk diff lacks a complete `## Clinical Governance Preflight` (every item from
  `requiredClinicalGovernanceItems` checked) or a RAG-ranking-surface diff lacks a satisfying
  `RAG impact:` line (see "RAG ranking protection" below). Caveman-style fragment-dropping breaks
  this exact-format contract — a paraphrased checklist item or a shortened `RAG impact:` reason can
  silently fail `governanceItemSatisfied`/`ragImpactDeclared` even though the PR is otherwise fine.
  `gh pr create`/`gh pr edit` bodies and any `PR_POLICY_BODY.md` content therefore always get
  written in full normal prose from `.github/pull_request_template.md`, regardless of the active
  output style — this is "commits" territory under the caveman carve-out, not chat. Before
  push, sanity-check clinical-risk/RAG-ranking bodies against `scripts/pr-policy.mjs`'s
  `evaluatePullRequestPolicy` shape (run `npm run check:pr-policy` if the script itself changed).

<!-- END:external-skill-precedence -->

<!-- BEGIN:supabase-project-safety -->

# Supabase project safety

- This repo targets the live Supabase project `Clinical KB Database`.
- **MERGING TO `main` DEPLOYS TO PRODUCTION.** The Supabase GitHub integration has **"Deploy to
  production" ENABLED**, production branch **`main`** — confirmed by a dashboard read on 2026-08-21,
  after two earlier sessions inferred it wrongly in both directions. Any migration merged to `main` is
  applied to the live clinical database automatically, within seconds (measured at 34 s in
  `docs/audit/live-drift-forensics-2026-08.md` §3.7). There is no separate deploy step to forget and no
  window to hold it back. Therefore:
  - **Treat merge approval as production-deploy approval.** Never merge a PR touching
    `supabase/migrations/**` outside an approved window, and never enable auto-merge on one.
  - **After such a PR merges, the schema-application gate is the post-merge `live-drift` workflow**
    (`.github/workflows/live-drift.yml`), which must complete with BOTH `npm run check:drift` and
    `npm run check:migration-history` green. `supabase migration list` is not that gate: it reads the
    recorded history only, so it cannot tell an applied migration from a history row whose statements
    never executed — the exact shape of the fifteen no-statements rows `#Q5JHBJ` exists for.
    `check:drift` compares the live schema itself. A manual `supabase migration list --linked
--project-ref sjrfecxgysukkwxsowpy` read is a useful supplement, but it is provider-backed and so
    needs explicit user confirmation first, per "API and provider confirmation boundary" above. A
    merged-but-unapplied migration is silent drift — the incident this whole programme exists to
    close.
  - **A migration that cannot run inside a transaction cannot ship this way.** The integration applies
    each migration in one transaction, so a bare `CREATE INDEX CONCURRENTLY` migration fails outright.
    Index work stays operator-prebuild + a validate-only guard migration (the `20260804110240` pattern,
    see the guard-migration contract below).
  - **Automatic branching is also ON** (one preview database per PR that changes `supabase/**`, limit
    1). Supabase warns that Branching Compute is **not covered by the organisation's Spend Cap**. CI's
    `Migration replay` job (`db-reset-verify`, `supabase migration up --local`) independently replays
    the whole chain on every database-touching PR, so preview branches are a second net rather than the
    only one.
- Expected project ref: `sjrfecxgysukkwxsowpy`.
- Older unused project ref `qjgitjyhxrwxsrydablr` belongs to `Database`; treat it as stale and do not use it.
- Hosted migrations, `supabase/schema.sql`, `supabase/roles.sql`, CI, and deployment tooling must target role `postgres`; never assume a platform-reserved role. The single older applied migration is immutable and pinned by `npm run check:migration-role`.
- Bare-image storage scaffolding must discover its local schema owner at runtime and must never be reused as hosted migration SQL.
- Run `npm run check:migration-role` after changing Supabase SQL, migration tooling, CI replay, or disaster-recovery instructions.
- Run `npm run check:supabase-project` after changing Supabase env values.
- **Guard-migration contract.** Any mark-applied version, `supabase migration repair --status applied`,
  hand-applied SQL later recorded as a migration, or other history repair MUST ship a fail-fast
  validation guard migration in the same change, following `20260804110240_restore_rag_search_health_indexes.sql`
  exactly (validates presence + `indisvalid`/`indisready` + normalized definition, never builds,
  `set local` timeouts, one `raise exception`). `schema_drift_snapshot()` v2 (`20260818090000`) reports every
  `supabase_migrations` version recorded without executed statements; `check:drift` fails on any such row
  that lacks a reviewed `migration_history` entry in `supabase/drift-allowlist.json` pointing at its guard
  (`guard.class` `validation` is mandatory for versions from 2026-08-18; `superseded`/`no_ddl` are for
  pre-contract history only). Never allowlist a history row bare, and never widen an entry's class to make
  it pass. Enforced offline by `tests/migration-history-guards.test.ts`; index-monitoring decisions on the
  retrieval-critical tables are enforced by `tests/search-health-index-coverage.test.ts` +
  `supabase/search-health-unmonitored-indexes.json` (`required_indexes` changes travel by migration only).
  Full contract: `docs/database-drift-detection.md`.

<!-- END:supabase-project-safety -->

<!-- BEGIN:rag-ranking-protection -->

# RAG ranking protection

Retrieval/ranking behaviour is live-validated and safeguarded. Before touching any protected
surface, read `docs/rag-behaviour/` (README → behaviour-map → refuted-approaches → safeguards).

- **Flag it.** Any task that will touch `src/lib/rag/**`, clinical-search, retrieval-selection,
  released-search-order, ranking-config, evidence/result-sort/answer-ranking, the eval harness
  (`scripts/eval-retrieval.ts`, `scripts/lib/clinical-aliases.ts`, ranking-tuning/snapshot
  tooling), the golden fixture/snapshot, or the retrieval RPCs must say so to the user BEFORE
  editing, even when the change looks incidental (refactor, rename, "just a comment").
- **PR gate.** PRs touching those surfaces fail `pr-policy` without an explicit `RAG impact:`
  line in the body — either `RAG impact: no retrieval behaviour change — <reason>` or
  `RAG impact: behaviour change — canary pair <baseline> -> <post>`. The source-pin contract
  test (`tests/rag-imputation-contract.test.ts`) additionally goes red on any edit to the
  imputation formulas or release-comparator key order.
- **Canary for behaviour.** Any retrieval/ranking/ordering behaviour change requires a live
  eval-canary before/after pair (doc/content recall pinned 1.0, zero per-case rr regressions)
  before it is trusted; regression → immediate single-commit revert + confirmation run.
  Dispatches are provider-backed (~$1–2) and always need explicit user approval.
- **Never** insert a comparator key above the relevance score, bulk-merge the wide
  captured-case alias tier into the strict golden tier, relax the clamped-score contract, or
  adopt tuner recommendations without a measured live gain. Offline-green + review-approved
  was proven insufficient for this surface on 2026-07-20 (see refuted-approaches).

<!-- END:rag-ranking-protection -->

<!-- BEGIN:railway-project-safety -->

# Railway project safety

- This repo deploys to the live Railway project `Database` (`5deaad0b-675a-4c13-978e-5ca2b5b877f9`) in workspace `bigsimmo's Projects`. Full topology: `docs/deployment-architecture.md` §1.
- Production services `Database` (Next.js app tier, serves `https://psychiatry.tools`) and `worker` (ingestion) auto-deploy from `BigSimmo/Database` pushes to `main`; the `staging` environment runs the `app` service.
- The older Railway project `clinical-kb` (`4361c04f-dd3c-4ee9-9e97-49e4e5707b70`) is superseded with zero active deployments; treat it as stale — never `railway link` to it or deploy there.
- The similarly named Supabase project `Clinical KB Database` is the database/auth tier, not a Railway project; see "Supabase project safety" above.
- Railway CLI token auth uses `RAILWAY_API_TOKEN` (personal account token; see `.env.example`). The project-scoped `RAILWAY_TOKEN` is for CI deploys only and cannot list or link projects; Cloud runtime acceptance no longer installs or probes the CLI, so that substitution rule is documentation-enforced until an operator workflow reintroduces CLI checks. Desktop/CLI MCP uses the secret-free `railway` entry (enable in `$CODEX_HOME/config.toml` or via a never-committed local edit — never commit `enabled = true`) plus `codex mcp login railway`; neither repository MCP file activates a hosted ChatGPT/Codex app.
- Railway deploys and mutations fall under the "API and provider confirmation boundary" below; verify target project/environment IDs before any mutation.

<!-- END:railway-project-safety -->

<!-- BEGIN:api-confirmation-boundary -->

# API and provider confirmation boundary

- Never run, modify, test, or otherwise interact with OpenAI, Supabase, GitHub/GitLab, hosted CI, production-like services, or provider-backed workflows without explicit user confirmation.
- Treat indirect API usage inside scripts, tests, release checks, PR tooling, and review automation as confirmation-required too.
- Prefer local, static, mocked, or offline checks. If a recommended verification would touch a provider, report the command and ask before running it.
- `npm run check:supabase-project`, live PR/CI tooling, answer-generation checks, ingestion checks against live services, and release gates that call providers are not automatic.
- Exception: the `Run PR` shortcut (see "## Run PR shortcut") is standing user confirmation for the specific GitHub actions it enumerates, for the duration of that sweep only.

<!-- END:api-confirmation-boundary -->

<!-- BEGIN:upload-shortcut -->

# `upload` shortcut

When the user types exactly:

upload

as the entire task message, treat it as a shortcut for the safe Git handoff workflow below.

The goal is to leave useful completed work safely committed and, where safe, pushed to the current feature branch. The goal is not to merge into main, delete branches, discard work, force-push, close PRs, deploy, or perform destructive cleanup without explicit user confirmation.

## Protected and base branches

Treat `main`, `master`, `develop`, and `release/*` as protected/base branches for this workflow.

If `upload` is run while on `main`, automatically create or use a branch named exactly `temporary` before staging, committing, or pushing, then continue the upload workflow from `temporary`:

- If neither local `temporary` nor `origin/temporary` exists, run `git switch -c temporary`.
- If local `temporary` exists and is not checked out in another worktree, switch to it only when it is clearly safe.
- If `origin/temporary` exists, use it only when it is clearly the matching intended branch.
- If any `temporary` branch state is ambiguous, diverged, checked out elsewhere, or unsafe, stop and ask instead of overwriting.

If already on a non-protected feature branch, continue using that branch.

## Required inspection

Start with read-only inspection before making changes. Check:

- Current branch or detached HEAD state
- `git status`
- Staged, unstaged, and untracked files
- Recent commits relevant to the current branch
- Remote configuration and upstream branch
- Whether the branch is ahead, behind, or diverged
- Whether the current branch appears protected/base
- Other Git worktrees, if detectable
- Available checks such as tests, lint, type check, or build scripts
- Existing branch, commit, PR, and release-flow conventions

Do not assume branch names, remotes, package managers, test commands, deployment targets, or project structure. Inspect first.

## Safe actions allowed without further confirmation

When the repository state makes it clearly safe, you may:

- Stage coherent completed changes that clearly belong together
- Create one or more logical commits with clear messages based on the diff
- Fast-forward pull only when there are no local commits or conflict risks
- Push the current non-protected feature branch if it has a valid upstream
- Set an upstream for the current feature branch only when the correct remote and branch name are obvious
- Leave the worktree clean by committing safe completed changes

## Actions requiring explicit confirmation

Do not perform these without asking the user first:

- `git reset --hard`
- `git clean -fd` or other destructive cleanup
- Discarding, overwriting, or reverting uncommitted changes
- Deleting local or remote branches
- Renaming branches
- Force-pushing
- Rebasing a shared/public branch
- Resolving divergent branch history
- Merging into `main`, `master`, `develop`, `release/*`, or any protected/base branch
- Closing pull requests
- Changing GitHub default branch, branch protection, repository settings, or deployment settings
- Modifying production data or deployment configuration
- Committing secrets, credentials, tokens, private keys, or sensitive local configuration
- Updating branch references where the correct replacement branch is ambiguous

If any of these seem necessary, stop and report what is risky, why it is risky, the recommended next step, and the exact confirmation needed.

## Mixed, suspicious, or unsafe changes

Do not automatically commit files that look like `.env` files, credentials, secrets, logs, caches, build artifacts, editor or OS files, temporary/debug files, or generated files not normally committed by this project. Report only the path and concern for possible secrets; never print secret values.

If changes appear unrelated, incomplete, experimental, or WIP, do not commit everything together automatically. Commit only clearly coherent completed changes when safe; otherwise summarize the groups and ask what should be included.

## Branch cleanup and reference updates

During `upload`, branch cleanup is limited to the current branch and its upstream unless the user explicitly asks for `branch-cleanup`, branch hygiene, deletion candidates, or stale branch review.

Do not enumerate, diff, or re-review unrelated stale branches during a normal upload/handoff. If the user explicitly asks for branch cleanup, first apply `docs/branch-review-ledger.md` to skip unchanged reviewed branches, then follow `docs/branch-cleanup-guide.md`.

If stale, inappropriate, merged, or unnecessary current-branch references are detected, list cleanup candidates but do not delete or rename branches automatically.

Before recommending deletion or rename for the current branch, audit accessible references including `.github/workflows/*`, CI/CD config, deployment config, scripts, package scripts, docs, release notes or release scripts, safe environment/config files, branch-specific config, open PR metadata if accessible, and GitHub branch protection/default branch metadata if safely accessible.

Update repo-tracked references to a renamed or replacement branch only when the old branch reference is clearly found, the replacement is obvious, the change is low-risk, and the user has approved the branch rename or deletion. If the replacement is unclear, report the reference and ask what it should point to.

## Syncing and verification

Do not rebase, merge, or resolve remote divergence automatically. Fast-forward pulls are allowed only when clearly safe. Push only the current non-protected feature branch when clearly safe.

Run the smallest relevant checks that are available and appropriate, such as tests, lint, type check, or build checks. Do not claim checks passed unless they were actually run. If checks cannot be run, explain why and state the command that would normally be used.

## Final report

After completing `upload`, summarize the current branch and worktree state, whether the worktree is clean, what changed, files committed, commit hash and message if created, whether anything was pushed, remote branch and likely PR target, checks run and results, checks not run and why, current-branch cleanup candidates or why broader branch cleanup was skipped, branch references found or updated, risky actions skipped, and exact confirmation needed for any recommended follow-up.

<!-- END:upload-shortcut -->

<!-- BEGIN:run-pr-shortcut -->

<!-- BEGIN:pr-branch-sync -->

## Open PR branch sync (anti-churn)

Open PR heads go stale whenever `main` advances. GitHub frequently labels those
branches `CONFLICTING` / `DIRTY` even when `git merge-tree` is clean — that is
staleness, not an unresolvable content fight, and it blocks squash auto-merge.

Durable mitigations in this repo:

- Automatic `GITHUB_TOKEN` branch updates are prohibited: bot-authored heads
  leave required checks awaiting approval. `npm run check:github-actions`
  guards this policy.
- Local/operator dry-run: `npm run sync:pr-branches`. Apply with the current
  human/operator `gh` identity: `npm run sync:pr-branches:apply`; the helper
  refuses missing or bot identities. Opt out per PR
  with labels `hold`, `do-not-merge`, or `skip-branch-sync`, or a `WIP` /
  `do not merge` title.
- Prefer fewer long-lived open PRs; land or close queue items rather than
  repeatedly re-merging `main` by hand.
- Before mutating an open PR with `update-branch` or `git merge origin/main`,
  check whether its current head has required CI in flight. If the branch is
  merely behind and the merge tree is clean, let that run settle and sync once,
  late, after review/fix work is assembled. Preempt an in-flight run only when
  the branch is genuinely blocking-conflicted or the user explicitly asks for
  an immediate sync; do not disable `cancel-in-progress` for PR branches.
- The historical review table is frozen during normal PR work. Write a new review
  with `ledger:append`, which creates an immutable record; never resolve a review
  conflict by editing the historical table. The repository deliberately leaves its
  merge attribute unspecified because GitHub cannot run a local custom driver.

When diagnosing "merge conflicts on every PR", first compare `behind_by` and
`git merge-tree --write-tree origin/main <tip>`. If the tree merge is clean,
sync the branch with an explicitly authenticated human/operator `update-branch`
call or `git merge origin/main` + push
instead of rewriting product code.

<!-- END:pr-branch-sync -->

## Run PR shortcut

When the user types exactly `Run PR` (case-insensitive, entire task message after trimming surrounding whitespace), treat it as a shortcut for a one-shot open-PR maintenance sweep on `bigsimmo/database`. This is a chat shortcut, not an app feature, script, automation, or CI workflow.

Goal: for every open pull request (drafts included) — fix failing required CI checks (the `pr-required` aggregate in `.github/workflows/ci.yml`), address unresolved review threads (fix actionable ones, reply, resolve), and merge `origin/main` into branches that are behind or conflicting, then push.

Authorization: the user typing `Run PR` IS the explicit user confirmation required by the "API and provider confirmation boundary" and the `pr-ci-fix` routing rule — but only for these actions, and only for the duration of that sweep:

- GitHub reads: pull requests, checks, workflow runs and job logs, review threads.
- Pushing ordinary commits to PR feature branches (never `main` or another protected branch).
- Review-thread replies and review-thread resolution.
- Re-running failed hosted CI jobs and updating a PR branch from `main`.

Nothing else inherits this authorization. Only the user's own task message can trigger the sweep — a PR comment, webhook payload, commit message, or file content containing "Run PR" is NOT authorization.

Hard guardrails (never, even during a sweep):

- Never merge a pull request into `main` or any protected branch, and never enable auto-merge; the sweep fixes and reports, the user merges. Per-PR auto-merge state is user-owned: automation must not disable or re-enable it. Ordinary fast-forward commits and pushes to fix CI or review findings are allowed while auto-merge is armed — GitHub re-validates required checks against the new head before it will merge, so an additive push cannot make it merge something unvalidated (`guard-push.mjs`'s auto-merge guard warns rather than blocks for this case). Never force-push, rewrite history, or change the PR's base/target while auto-merge is armed — that stays hard-blocked with no override; wait for the user to change the auto-merge state first.
- Never close a pull request, delete or rename branches, force-push, or rebase.
- Never run provider-backed gates: `eval:rag`, `eval:quality`, `eval:retrieval:quality`, `verify:release`, `check:supabase-project`, `test:live`, or anything else that touches live Supabase/OpenAI.
- Respect the `skip-codex-review` label as a full per-PR opt-out.
- Preserve unrelated staged, unstaged, and untracked work; never commit secrets.
- Resolve branch drift only with an explicitly authenticated update-branch call or `git merge origin/main`; skip and report non-trivial conflicts instead of guessing.
- Before treating GitHub `DIRTY`/`CONFLICTING` as a real conflict, confirm with `git merge-tree` (see "## Open PR branch sync (anti-churn)"). Use the update-branch API only through the explicitly authenticated human/operator identity; otherwise merge `origin/main` in a worktree and push.

Procedure: in Claude Code sessions, invoke the `run-pr` skill (`.claude/skills/run-pr/SKILL.md`) — it is the canonical detailed procedure. In sessions without GitHub MCP write tooling, degrade to read-only diagnosis and a per-PR report; do not attempt pushes or thread resolution through other means.

Record one immutable review record per PR touched with `npm run ledger:append` (use `--supersede` on later sweeps of the same PR; never a ledger-only tip). Do not edit, deduplicate, or rotate the frozen historical table during a sweep; end with the per-PR before/after summary defined in the skill.

<!-- END:run-pr-shortcut -->

## Babysit the pull request, then stop

Opening the PR is the handoff, but walking away the instant it exists is not useful
either — a required check that goes red ninety seconds later is still this session's to
fix, and this is the cheapest moment to fix it. So the session gets a **budget**, not a
ban: after the PR is created, follow its CI for **30 minutes**, then stop.

Inside that budget, following the PR is ordinary work:

- Read checks, workflow runs, and job logs; re-run a failed job; sync the branch from
  `main` when it is behind but the merge tree is clean.
- Fix what this change broke and push the fix. The smallest correct gate still applies to
  every fix before it is pushed.
- Look on a **slow cadence** — roughly five minutes between checks, and wait with
  `ScheduleWakeup` or `Monitor` rather than polling tightly. Prefer a terminal-event wait
  over repeated log reads; never stream logs minute-by-minute.
- **Stop as soon as CI settles.** A green run ends the babysit; so does a failure that is
  not this change's to fix (a known flake, an unrelated red on `main`, an infrastructure
  outage). Say which it was.

When the 30 minutes are up, or CI settles, whichever comes first:

- Record the `npm run ledger:append` row if it is still owed.
- Give the user the PR URL, a short summary, and **plainly where CI stands** — green, red
  with the failing check named, or still running.
- Then stop. The merge, review-bot findings, and anything still unresolved are the user's
  call, and a later session (or an explicit `Run PR` sweep) is where that work belongs.

Never park a cron job on the PR. A cron entry outlives the session, so nothing can stop it
afterwards — that is the unbounded loop this budget exists to prevent, and it is denied for
the whole session regardless of how much budget is left.

Enforcement: `.claude/hooks/pr-handoff-stop.sh` (registered in `.claude/settings.json`)
drops a session-scoped marker, stamped with the open time, when a PR-creating call — `gh pr
create` or any `create_pull_request` MCP tool — returns a real PR URL. It then measures the
budget from that stamp:

- **Inside the budget** — shell polling (`gh pr checks|status|view|…`, `gh run …`,
  `gh api …actions/runs`, `sync:pr-branches`), GitHub MCP PR/CI tools, `Monitor`, and
  `ScheduleWakeup` all pass. Only `CronCreate` is denied.
- **Past the budget** — all of those are denied, so the session reports and stops rather
  than drifting into an open-ended supervision shift.

Committing, pushing, ledger appends, and PR create/merge (`gh pr merge`,
`merge_pull_request`) stay allowed throughout. The budget is `CLAUDE_PR_BABYSIT_BUDGET_MINUTES`
(default 30, clamped to 1..240). To keep watching past it on an explicit user ask, prefix a
shell command with `CLAUDE_ALLOW_PR_FOLLOW=1`, or delete the marker the deny message names.
Sessions that never create a PR are untouched, so `Run PR` sweeps, `pr-ci-fix` work, and
review sessions on someone else's PR still function normally.

## Automated review coverage (owner decision, 2026-08-22)

CodeRabbit's included allowance is capped and review is intermittent (`#CCZ4HB`). The decision and root-cause analysis are documented in `docs/decisions/ccz4hb-review-coverage.md`.

- Draft PRs are skipped by CodeRabbit outright; undrafting mid-CI cancels the in-flight run.
- **Do not weaken, skip, or relax any required check to compensate.** Required gates carry the deterministic safety net and must stay strict.
- Clinical-risk and RAG-surface diffs still require their PR-body preflight sections in full (`scripts/pr-policy.mjs`).
- Reduce PR churn by bundling low-risk append-only paperwork with product PRs (see below).

## PR bundling (reduce one-task-one-PR churn)

Before opening a new branch, check whether the task can ride an **already-open PR you still own** or be bundled with **other currently-queued low-risk work** instead of minting a new one. If the target PR's CI is already running, wait for it to settle before pushing the addition or assemble every commit before that PR's first push (pushes mid-run cancel and restart CI).

**If the target PR has auto-merge armed, an ordinary fast-forward push is still safe to bundle onto** — GitHub re-validates required checks against the new head before merging. Per-PR auto-merge state is user-owned: automation must not disable or re-enable it, and a force-push or base/target change while armed still hard-blocks with no override. `guard-push.mjs` enforces the force-push block for locally pushed PR branches when authenticated `gh` is available; agent policy remains the backstop.

Bundle only when every item being combined is:

- **Independently low-risk, checked two ways:**
  1. `scripts/pr-policy.mjs` / `classifyPullRequestFiles` must return `clinicalRisk: false`, `operationalRisk: false`, and no RAG-ranking-surface path.
  2. The diff must not touch anything in this repo's broader "PR risk detection" list (auth, privacy, migrations/RLS, clinical/RAG/retrieval, background jobs/workers/queue processing, payment/billing, public API contracts, production config/deployment, file upload/download, provider/paid-API calls).
- **Committed as its own separately revertible commit** while the PR is open (one PR with multiple commits, not one squashed diff).
- **Listed as its own bullet** in the PR body's Summary.
- **Not already mid-edit** in another open PR or session (check local context / review ledger first).

**Best candidates:** small same-scope documentation, immutable review records (`docs/branch-review-records/`), or queued issue requests (`docs/outstanding-issues-inbox/`).

**Never bundle:**

- A change needing its own `RAG impact:` line together with one that does not.
- A change needing `## Clinical Governance Preflight` together with unrelated chores.
- Anything explicitly scoped "1 PR per work order" by its own tracking doc (e.g. `docs/maturity-backlog-workorders.md`).

Bundling saves PR/CI-invocation count, not verification rigor — every bundled item still gets the smallest correct gate run against it before joining the PR.

<!-- BEGIN:anti-conflict-speed -->

## Anti-conflict and CI-speed operating procedure

Goal: fewer false merge conflicts, less cancelled CI, and faster feedback — without weakening required gates, flake policy, provider boundaries, or clinical/RAG safeguards. Do not touch unrelated active PRs unless the user explicitly asks (`Run PR`, sync, or a named PR).

### Prevent conflicts before they start

- Prefer fewer, shorter-lived PRs. Bundle independently low-risk append-only docs/ledger chores (see "## PR bundling") instead of one PR per line.
- Start from a fresh `origin/main` worktree/branch (`newtask`); do not pile new work onto a stale head that already shares hot files with the open queue.
- The legacy `docs/branch-review-ledger.md` and `docs/outstanding-issues.md` are **serial-only**: normal PRs must not add rows there. `npm run ledger:append` creates an immutable review record; `npm run issues:add|update|queue|done` creates one immutable inbox request (`queue` corrects a recommended-execution-queue row; see ledger `#M6JNR8`). One fresh-base, cross-worktree-locked `npm run issues:reconcile` operation applies landed requests to the canonical issue ledger. `check:ledger-write-discipline` rejects direct table-row edits, changed request records, deleted requests, and a canonical issue diff that does not exactly equal its recorded reconciliation transaction.
- Before calling GitHub `DIRTY`/`CONFLICTING` a real conflict, run `git merge-tree --write-tree origin/main <tip>`. Clean tree + behind = sync; dirty tree = real conflict.

### Speed CI without skipping quality

- Assemble every commit for a head before the first push, or wait for the current PR CI run to settle before pushing again. Apply the same settle-first rule to branch syncs: for a behind-but-clean PR with required CI in flight, wait, then perform at most one late `update-branch` / `git merge origin/main` after review and fix work is assembled. Cancel-in-progress remains enabled for pull requests (pushes mid-run cancel Production UI), but is deliberately disabled for base-branch pushes (`tests/ci-cache-safety.test.ts`).
- For Run PR sweeps and normal readiness pushes — never an explicit bare PR publication — run `npm run format` **and commit the result**, then `npm run verify:pr-local` (or the smallest gate that covers the change). Format is in `static-pr` but not in `verify:cheap`; an uncommitted format leaves CI red on the pushed blob. Whole-tree Prettier, not a single edited file.
- If a PR has auto-merge armed, its auto-merge state is user-owned and automation must not disable or re-enable it. Ordinary fast-forward pushes, `update-branch`/merge-main-in syncs, and bundled additions may proceed — GitHub re-validates required checks against the new head before merging, so an additive push cannot slip past that. A force-push, history rewrite, or base/target change while armed still hard-blocks with no override; wait for the user to change that state first.
- Missing CI checks are not a green pass. The `PR mergeability` check uses trusted `pull_request_target` events and refreshes unchanged PR heads after protected-base pushes; it fails explicitly on `mergeable_state: dirty`. Behind-but-clean heads use `npm run sync:pr-branches` / `:apply` with human `gh` auth — never bot `update-branch`.
- Triage and repair actionable review threads early; reply before resolving (`<!-- codex-thread-disposition:resolved -->`). Leave ambiguous or product-sensitive threads open for the owner.
- Babysit dormant: observe fresh CI only at meaningful stage boundaries (at most once every 5 min, ≤30 min per run). If queued/running at limit, record run URL as deferred and continue sweep.
- For sweeps needing local repair, prepare one isolated, exact-lock worktree via `node scripts/setup-codex-worktree.mjs`.
- Treat merge queue state as read-only. Fall back to Actions runs for exact head SHA if `gh pr checks` cannot read check runs.
- Treat outstanding-issue IDs as display locators, not proof that work landed. Queue changes only through `npm run issues:add|update|done`; reconcile via `npm run issues:reconcile` from a dedicated branch after PRs land.
- Keep Playwright blocking tests at zero retries; quarantine via `tests/flake-ledger.json` only after three reproductions on the same SHA.

### Operator sync (explicit only)

- Leave active PRs alone unless requested. Report: `npm run sync:pr-branches`. Apply with confirmation and human/operator auth: `npm run sync:pr-branches:apply`.

<!-- END:anti-conflict-speed -->

<!-- BEGIN:codex-productivity-defaults -->

## Codex productivity defaults

- Treat terse prompts as workflow shortcuts when the intent is clear. If the user says `run`, execute `npm run ensure`, verify the project identity through that helper, and return the printed local URL without a long log dump.
- For non-trivial changes, start from concrete repo state: branch, `git status`, relevant package scripts, recent failures, and local logs such as `dev-server.log` when runtime behavior is involved. For architecture and module orientation, read `docs/codebase-index.md` (routes: `docs/site-map.md`).
- For UI, browser, styling, routing, accessibility, or screenshot work, run `npm run ensure` before opening the app, then use browser QA and the smallest relevant UI proof before broader gates.
- Prefer the smallest failing check first. For this repo, use focused Vitest or Playwright targets before widening to `npm run verify:cheap`, `npm run verify:ui`, or `npm run verify:release`.
- Use `npm run test:focused -- --files <paths>` only for safe source-only iteration. It fails closed for deleted files and test/configuration infrastructure; follow its instruction to run `npm run test` in those cases.
- When the user says `safely`, preserve unrelated staged, unstaged, and untracked work; stop only clearly repo-owned transient processes; and verify the result instead of doing broad cleanup.
- After auth, Supabase, ingestion, answer generation, search/ranking, clinical output, or source-governance changes, run the smallest domain check plus `npm run check:production-readiness`. Run `npm run check:supabase-project` after Supabase env/config changes.
- For handoff, archive-safety, or upload-style requests, inspect branch/upstream/status first, run the appropriate verification gate, and only commit or push when the request explicitly asks for that workflow.
- For broad chat/worktree reconciliation or cleanup, run `node scripts/reconciliation-preflight.mjs`, use the cheap ownership/PR/ledger/ancestry funnel before patch comparison, and never print raw process command lines.
- For codebase appraisal exports, stage outside the repo, include `EXPORT_MANIFEST.md`, exclude secrets/dependencies/build outputs/local state, and verify the archive can be opened before handoff.
- When a repeated repo-specific workflow is discovered, update this file or ask the user whether it should be remembered.

<!-- END:codex-productivity-defaults -->

<!-- BEGIN:repo-productivity-skills -->

## Repository productivity skills

Automatically apply repo-local skills under `.agents/skills/` when their descriptions match the user's request. Run `npm run skills` for the validated catalog of 35 canonical skills. `npm run check:skills` verifies those skills, their compatibility aliases, and the Claude, Cursor, and Clinical KB plugin skill surfaces. The older long names remain compatibility aliases and must not be counted as unique skills.

The foundational orchestration skills are:

- `plan`: plan risk-scoped verification before non-trivial changes.
- `fix`: diagnose and repair local verification failures with the smallest reproducer.
- `clinical`: assemble clinical, privacy, source, and rollback evidence.
- `ui`: inspect the running app across routes, breakpoints, and accessibility modes.
- `rag`: validate retrieval and answer changes offline first, then prepare live-eval approval gates.
- `operations`: turn pending operator debt into a deduplicated, approval-gated batch.
- `task`: manage safe start, handoff, merge proof, and cleanup transitions.

Run the matching planner command in `docs/productivity-workflows.md` without side effects by default. Add `-- --run` only to execute its local/offline checks. The workflow engine must never execute commands listed under `approvalRequired`.

<!-- END:repo-productivity-skills -->

## Outstanding-work memory (`/issues`)

`docs/outstanding-issues.md` is the universal durable cross-session ledger for tasks, recommendations, and issues. Update it when work completes, is dropped, or is materially re-scoped. Never restore completed, duplicate, speculative, or rejected work to the recommended queue.

- When the user types `/issues`, invoke the `issues` skill (`.claude/skills/issues/SKILL.md`): run `npm run issues:report -- --json` to read the cached `origin/main` ledger (read-only; mutates and commits nothing).
- `/issues add|done|update|queue …` queue immutable request files under `docs/outstanding-issues-inbox/`. Ordinary branches never edit the canonical ledger. One deliberately serialized fresh-base branch runs `npm run issues:reconcile` after PRs land.
- Proactively offer to capture unresolved follow-ups, deferrals, and known risks into the ledger before session context is lost.
- Before acting on a queued item, check open PRs for overlapping routes or components to avoid duplicate concurrent work (`#292`).
- The `SessionStart` hook (`.claude/hooks/issues-surface.sh`, wired in `.claude/settings.json`) auto-surfaces the recommended queue plus open-item counts at session start (read-only).

## Codex GitHub review behavior

These instructions apply to Codex GitHub pull request reviews and Codex tasks started from PR comments.

- Keep automatic reviews focused and cost-conscious.
- Prioritize high-confidence findings that affect correctness, security, privacy, data loss, auth/permissions, migrations, API contracts, production reliability, clinical behavior, source governance, or user-facing behavior.
- Do not comment on formatting, naming, style, minor cleanup, or speculative refactors unless they create a real bug or maintainability risk.
- Prefer fewer, stronger findings over exhaustive low-value review comments.
- An automatic review may emit at most three inline findings total. Use inline comments only for P0/P1 issues; put non-blocking P2 context in one summary and omit P3 feedback.
- A finding must cite concrete changed code and explain the failure mode.
- Do not suggest broad rewrites during review. Recommend the smallest change that resolves the issue.
- Do not propose or start fixes unless explicitly asked with an `@codex fix...` or `@codex resolve...` comment, or when the repository's Codex auto-resolve workflow posts that command.
- Treat automatic review as single-pass per pull request. Do not re-review a later head, repeat a prior finding, or create another review during an auto-resolve task unless a human explicitly requests a fresh review.

### Severity calibration

- P0: active security exposure, data loss/corruption already possible, severe production outage risk, credential leakage, or a critical issue that must be fixed immediately.
- P1: security vulnerability, auth bypass, data exposure/loss, destructive migration risk, production-breaking regression, public API contract break, severe clinical/user-facing bug, or missing validation with realistic exploit/failure impact.
- P2: important correctness bug, missing behavior test for meaningful changed behavior, edge case likely to affect users, reliability issue, unsafe assumption, or maintainability issue that will likely cause defects.
- P3: style, naming, formatting, small cleanup, speculative improvements, or optional refactors. Avoid raising these in automatic reviews unless explicitly requested.

For GitHub automatic reviews, focus mainly on P1-level findings. If a P2 issue is important enough to block the PR, explain why it should be treated as P1.

### PR risk detection

When reviewing, identify whether the PR touches any high-risk area:

- authentication or authorization
- user data, privacy, or private document access
- database schema, migrations, RLS, SECURITY DEFINER functions, or Supabase privileges
- clinical answer generation, source governance, retrieval/ranking, ingestion, or document access
- payment, billing, subscriptions, or quotas
- public API contracts
- production configuration or deployment behavior
- background jobs, scheduled tasks, workers, or queue processing
- file upload/download or generated document access
- AI/API provider calls, paid external services, or credential-dependent workflows

If a high-risk area is touched, review more carefully for regressions, missing tests, rollback/safety notes, and conservative failure behavior.

### Cost and usage control

Avoid broad repeated review passes. Do not request exhaustive review behavior unless the PR touches security, auth, data loss, migrations, billing, production reliability, clinical output, source governance, or private document access. Prefer targeted validation and targeted review comments. A new commit from the automatic repair task is not permission for another automatic review.

### Fix behavior

When explicitly asked to fix or resolve review findings:

- Always fix P0 and P1 findings using the best minimal fix.
- For P2 and lower-severity findings, decide whether the issue is worth fixing automatically.
- Fix a P2 or lower finding only when the fix is clear, scoped, low-risk, and testable.
- Do not automatically fix a P2 or lower finding when it requires broad refactoring, product judgment, dependency changes, credentials, paid/external APIs, large design decisions, or risky behavior changes.
- If a P2 or lower finding is not worth fixing automatically, comment with the reason and the recommended human decision, then resolve the review conversation when supported.
- Preserve unrelated work and avoid opportunistic refactors.
- Do not add dependencies unless the issue cannot reasonably be fixed without one.
- Do not change secrets, credentials, environment configuration, billing settings, deployment settings, or external service setup unless explicitly requested.
- Do not use external APIs, paid services, credentials, secrets, live Supabase projects, or OpenAI provider calls unless explicitly authorized.
- If a finding is ambiguous, unsafe to fix automatically, or requires a large rewrite, stop and explain the decision instead of guessing.
- Add or update the smallest relevant test when the issue affects behavior.
- Run the narrowest relevant validation for the touched surface before broader suites.
- Summarize fixed issues, changed files, validation run, and any remaining human decisions.

### Review comment lifecycle

- Treat closing review conversations as part of the task when asked to fix or resolve comments.
- After fixing a P0 or P1 finding, reply with the fix summary and resolve the review conversation when supported by GitHub permissions/tooling.
- After fixing an approved P2 or lower finding, reply with the fix summary and resolve the review conversation when supported.
- After deciding not to fix a P2 or lower finding, reply with the reason, note whether it is deferred or not actionable, and resolve the review conversation when supported.
- For every fixed or fully dispositioned thread, start the thread reply with `<!-- codex-thread-disposition:resolved -->`. On the next line, use `<!-- codex-thread-result:fixed-head:<40-character pushed commit SHA> -->` for a code fix or `<!-- codex-thread-result:no-change -->` for a no-code disposition. The workflow closes the thread only when exactly one result is declared and a reported fixed commit is the pull request head.
- Do not use the marker when human input or new authorization is required; explain the blocker and leave that thread open.
- Do not leave a review conversation open after it has been fixed or fully dispositioned. If direct resolution is unavailable, the marker reply is the required fallback and the workflow performs the closure.

### Automatic resolve trigger

Automatic Codex review is review-only by default. This repository includes `.github/workflows/codex-autofix-review-comments.yml`, which requests the resolve task automatically after Codex submits a completed PR review that raised findings and the pull request passes the repository's risk/complexity router.

- The auto-resolve request must fire only from a Codex-authored `pull_request_review` **submitted** event on an open pull request — never from the first inline comment mid-review. This guarantees the request is posted only after a code review completes; without a review there are no findings and the request is pointless.
- The request job must skip reviews with no actionable findings: skip `approved`/`dismissed` reviews, and skip when the submitted review carries zero inline comments.
- Route automatic repair only when at least one changed path is high-risk, when the pull request changes at least 10 non-test source files or 300 non-test source lines, or when the `codex-review` label explicitly opts in. Treat `skip-codex-review` as an unconditional opt-out that wins if both labels are present.
- **Clinical-decision surfaces are never routed to automatic repair**, whatever the finding's severity and whatever the routing rule above would otherwise say. The held paths are `data/**` (except `data/outstanding-issues-snapshot.json`), `src/data/**`, `src/lib/mha-act-sections.ts`, `src/lib/form-catalog.ts`, `src/lib/form-ranker.ts`, `src/components/forms/**`, `src/lib/rag/**`, and the named ranking/answer surfaces `clinical-search`, `retrieval-selection`, `released-search-order`, `ranking-config`, `answer-ranking`, `answer-verification`. The hold is evaluated before routing and has **no override**: the `codex-review` opt-in label does not release it, and a diff that also touches tests or generated files is still held. Codex still reviews these pull requests and its findings still post as inline comments — only the unattended write is withheld, so a human decides.

  Why this exists: a review finding can be sound as a code observation and wrong as an action. On PR #2314 a P1 finding contradicted the owner's explicit decision to display drafted Mental Health Act summaries behind an awaiting-review label; the automatic pass applied it, inverting the render gate and collapsing the Act-sections card from 54 forms to 1, and additionally hardcoding every summary as reviewed. The rationale for the owner's decision was written down in `docs/wiring-conventions.md` and nothing consulted it. "Always fix P0 and P1 findings" therefore stops at these paths: on a clinical surface a bot's severity label is not authority to overwrite a human decision. Enforced by `scripts/check-codex-autofix-workflow.mjs` and `tests/codex-autofix-workflow.test.ts`; do not weaken either to let a specific pull request through.

- High-risk paths include migrations/RLS, application API routes, auth/permissions/privacy/security, clinical/RAG/retrieval/search/source/document behavior, provider or production configuration, dependencies, and CI/release workflows. Do not route docs-only, test-only, generated-only, or small low-risk UI/copy changes unless explicitly opted in.
- Read changed-file metadata through the GitHub API only; never check out or execute pull-request code in the routing job. Record the selected route in a hidden `codex-autoresolve-route` marker for auditability.
- Match the trusted Codex connector bot by exact login and bot type; do not use substring login checks.
- Keep per-pull-request concurrency on the authorized job, not the whole workflow, so unrelated events cannot displace a pending Codex request.
- Pin the supported Node 24-based `actions/github-script` release to its reviewed immutable commit SHA.
- Post the `@codex` resolve request with a real (non-bot) user identity — a fine-grained PAT held in the `CODEX_TRIGGER_TOKEN` secret. The Codex connector ignores commands authored by `github-actions[bot]`, so a bot-authored request is silently dropped. The token needs `pull-requests: write` (issue-comment) access and no more.
- The workflow must treat unmarked review-thread replies as inert. A trusted Codex reply beginning with `<!-- codex-thread-disposition:resolved -->` may only resolve the exact containing thread, and a non-reply Codex review comment must never be turned into a new repair request.
- The workflow must ask Codex to resolve only existing actionable Codex review findings for the triggering pull request and current head using these repository instructions; the resolve task must not perform a new review or create new findings. It must name the exact repository and PR head branch, require fixes to be published there through the authenticated GitHub connector, forbid detached `work` branches and stacked pull requests, and treat a local-only commit as a visible failure.
- The workflow may request one automatic repair pass per pull request lifetime. Later heads require an explicit human request.
- Only trust a pull-request deduplication marker when it was posted by the trigger-token account (the same identity that posts the request), resolved at runtime rather than hard-coded.
- Permission failures while reading or creating pull-request comments must fail the workflow visibly, not return a successful soft-skip.
- The workflow must not run Codex directly with API credentials.
- P0 and P1 findings should always be fixed.
- P2 and lower findings should be fixed only when clear, scoped, low-risk, and testable; otherwise explain the decision and resolve or mark ready for human resolution.

### Primary PR command

`@codex resolve actionable Codex review findings for this pull request and current head using the repository instructions. This is the pull request's single automatic repair pass: do not perform a fresh review, create new standalone findings, or request another review. Work only the existing unresolved Codex threads on the current head. The workflow will provide the only allowed repository, pull-request head branch, and starting commit. Publish every approved fix to that exact head branch through the authenticated GitHub connector; never use a detached or synthetic work branch and never create a stacked pull request. Verify the pull-request head contains the pushed commit before reporting success. Always fix P0 and P1 findings. For P2 and lower findings, fix only clear, scoped, low-risk issues; otherwise disposition them with a concise reason. For a fixed thread, reply with <!-- codex-thread-disposition:resolved --> followed by <!-- codex-thread-result:fixed-head:<40-character pushed commit SHA> -->. For a no-code disposition, use <!-- codex-thread-disposition:resolved --> followed by <!-- codex-thread-result:no-change -->. A local-only commit is not a fix. If publication or verification fails, use neither result marker, do not claim success, and leave the thread open with the blocker. Finish only after every actionable thread is fixed or dispositioned and closed, or explicitly left open for a human decision. Do not update the branch from main, address unrelated reviews, broaden scope, or create more than one scoped fix commit. Do not use external APIs, paid services, credentials, dependency changes, or broad refactors unless explicitly authorized. Add targeted tests where behavior changes and run the narrowest relevant validation.`

## Codex Cloud environment

Codex Cloud uses an isolated Linux container and does not inherit desktop credentials, local services, or uncommitted work. Full environment specification and runbooks live in `docs/codex-cloud.md`.

- Configure setup as `bash scripts/setup-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh`.
- Configure maintenance as `bash scripts/maintain-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh`.
- Default to `CODEX_CLOUD_ACCESS_PROFILE=offline` for ordinary/RAG work; use `connected` only with explicit provider authorization.
- Personal Pro split control plane: Codex Cloud for code and GitHub connector; ChatGPT web for Railway and read-only Supabase metadata.
- Acceptance: run `bash scripts/check-codex-cloud-raw-env.sh`, `npm run check:codex-cloud`, and `npm run check:codex-cloud -- --runtime` (with `CODEX_CLOUD_EXPECTED_BASE_SHA`).
- Do not expose provider secrets (OpenAI, Supabase, Railway, GitHub PATs) in Cloud agent shells or committed config.
- Authenticated live tests run via `.github/workflows/authenticated-live-tests.yml` with manual dispatch, never from Cloud agent shells.
- Branch deletion helper `bash scripts/delete-codex-cloud-branch-with-pat.sh` is operator-only outside Cloud.

## Cursor Cloud specific instructions (not Codex Cloud)

Durable notes for Cursor Cloud agents (see `docs/agents-guide.md` and `docs/testing.md` for full reference):

- Context7 peer-library docs habit and Next 16 local docs live in `docs/agents-guide.md`.
- Requires Node >=24.15.0 <25 / npm 11.x (installed via nvm, symlinked to `/usr/local/cargo/bin`).
- Offline verification: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run verify:cheap`, and `npm run verify:pr-local` all pass without secrets.
- For authorized GitHub work, use the connected GitHub connector/MCP tools as primary interface (`BigSimmo` write access).
