# Codex Dependency Shortcut

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

- Verify root `AGENTS.md` contains exactly one `## Dependency shortcut` section (or pointer).
- Show the final diff for `AGENTS.md`.
- Summarize what changed.
- Confirm no dependency update, install, test, build, audit, commit, or push was performed.

<!-- END:dependency-shortcut -->
