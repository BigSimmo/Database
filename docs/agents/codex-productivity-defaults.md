# Codex Productivity Defaults

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
