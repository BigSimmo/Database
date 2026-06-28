<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

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

<!-- BEGIN:local-server-safety -->

# Local server safety

- If the user says `run`, execute `npm run ensure` and return the printed URL.
- If the user asks for UI/frontend changes, browser QA, screenshots, mobile checks, or a local app link, run `npm run ensure` before opening or testing the app, even if the user did not say `run`.
- Never assume `localhost:3000`, `localhost:3001`, or `localhost:3002`.
- Never attach to a local server unless `/api/local-project-id` confirms it is this project.
- Do not kill or modify other projects' local servers. If the stable project port is busy, let `npm run ensure` choose the next safe project URL.
- Do not run a permanent watcher. Only start or verify the server when the current chat task needs the app or the user asks to run it.

<!-- END:local-server-safety -->

<!-- BEGIN:process-hardening -->

# Process hardening phases

- For non-trivial source/config/test changes, prefer `npm run verify:cheap` as the first broad gate.
- For UI, frontend, browser, routing, styling, reduced-motion, or forced-colors changes, run `npm run ensure` before browser work and use `npm run verify:ui` as the Chromium UI gate.
- For release or handoff confidence, use `npm run verify:release`; this includes the full Playwright project set.
- For clinical ingestion, answer generation, source governance, privacy, production-readiness, or environment changes, run the smallest relevant domain check plus `npm run check:production-readiness`.
- For pull requests that touch ingestion, answer generation, search/ranking, source rendering, document access, privacy, production env, or clinical output, complete the clinical governance preflight in `.github/pull_request_template.md`.
- Track known verification debts and staged process improvements in `docs/process-hardening.md` instead of relying on chat-only memory.

<!-- END:process-hardening -->

<!-- BEGIN:supabase-project-safety -->

# Supabase project safety

- This repo targets the live Supabase project `Clinical KB Database`.
- Expected project ref: `sjrfecxgysukkwxsowpy`.
- Older unused project ref `qjgitjyhxrwxsrydablr` belongs to `Database`; treat it as stale and do not use it.
- Run `npm run check:supabase-project` after changing Supabase env values.

<!-- END:supabase-project-safety -->

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

If stale, inappropriate, merged, or unnecessary branches are detected, list cleanup candidates but do not delete or rename branches automatically.

Before recommending deletion or rename, audit accessible references including `.github/workflows/*`, CI/CD config, deployment config, scripts, package scripts, docs, release notes or release scripts, safe environment/config files, branch-specific config, open PR metadata if accessible, and GitHub branch protection/default branch metadata if safely accessible.

Update repo-tracked references to a renamed or replacement branch only when the old branch reference is clearly found, the replacement is obvious, the change is low-risk, and the user has approved the branch rename or deletion. If the replacement is unclear, report the reference and ask what it should point to.

## Syncing and verification

Do not rebase, merge, or resolve remote divergence automatically. Fast-forward pulls are allowed only when clearly safe. Push only the current non-protected feature branch when clearly safe.

Run the smallest relevant checks that are available and appropriate, such as tests, lint, type check, or build checks. Do not claim checks passed unless they were actually run. If checks cannot be run, explain why and state the command that would normally be used.

## Final report

After completing `upload`, summarize the current branch and worktree state, whether the worktree is clean, what changed, files committed, commit hash and message if created, whether anything was pushed, remote branch and likely PR target, checks run and results, checks not run and why, branch cleanup candidates, branch references found or updated, risky actions skipped, and exact confirmation needed for any recommended follow-up.

<!-- END:upload-shortcut -->

<!-- BEGIN:codex-productivity-defaults -->

## Codex productivity defaults

- Treat terse prompts as workflow shortcuts when the intent is clear. If the user says `run`, execute `npm run ensure`, verify the project identity through that helper, and return the printed local URL without a long log dump.
- For non-trivial changes, start from concrete repo state: branch, `git status`, relevant package scripts, recent failures, and local logs such as `dev-server.log` when runtime behavior is involved.
- For UI, browser, styling, routing, accessibility, or screenshot work, run `npm run ensure` before opening the app, then use browser QA and the smallest relevant UI proof before broader gates.
- Prefer the smallest failing check first. For this repo, use focused Vitest or Playwright targets before widening to `npm run verify:cheap`, `npm run verify:ui`, or `npm run verify:release`.
- When the user says `safely`, preserve unrelated staged, unstaged, and untracked work; stop only clearly repo-owned transient processes; and verify the result instead of doing broad cleanup.
- After auth, Supabase, ingestion, answer generation, search/ranking, clinical output, or source-governance changes, run the smallest domain check plus `npm run check:production-readiness`. Run `npm run check:supabase-project` after Supabase env/config changes.
- For handoff, archive-safety, or upload-style requests, inspect branch/upstream/status first, run the appropriate verification gate, and only commit or push when the request explicitly asks for that workflow.
- For codebase appraisal exports, stage outside the repo, include `EXPORT_MANIFEST.md`, exclude secrets/dependencies/build outputs/local state, and verify the archive can be opened before handoff.
- When a repeated repo-specific workflow is discovered, update this file or ask the user whether it should be remembered.

<!-- END:codex-productivity-defaults -->
