# Repository Skills and Outstanding-Work Memory

<!-- BEGIN:repository-skills-and-issues -->

## Repository productivity skills

Automatically apply repo-local skills under `.agents/skills/` when their descriptions match the user's request. Run `npm run skills` for the validated catalog of 35 canonical skills. `npm run check:skills` verifies those skills, their compatibility aliases, and the Claude, Cursor, and PsychSift plugin skill surfaces. The older long names remain compatibility aliases and must not be counted as unique skills.

The foundational orchestration skills are:

- `plan`: plan risk-scoped verification before non-trivial changes.
- `fix`: diagnose and repair local verification failures with the smallest reproducer.
- `clinical`: assemble clinical, privacy, source, and rollback evidence.
- `ui`: inspect the running app across routes, breakpoints, and accessibility modes.
- `rag`: validate retrieval and answer changes offline first, then prepare live-eval approval gates.
- `operations`: turn pending operator debt into a deduplicated, approval-gated batch.
- `task`: manage safe start, handoff, merge proof, and cleanup transitions.

Run the matching planner command in `docs/productivity-workflows.md` without side effects by default. Add `-- --run` only to execute its local/offline checks. The workflow engine must never execute commands listed under `approvalRequired`.

## Outstanding-work memory (`/issues`)

`docs/outstanding-issues.md` is the universal durable cross-session ledger for tasks, recommendations, and issues. Update it when work completes, is dropped, or is materially re-scoped. Never restore completed, duplicate, speculative, or rejected work to the recommended queue.

- When the user types `/issues`, invoke the `issues` skill (`.claude/skills/issues/SKILL.md`): run `npm run issues:report -- --json` to read the cached `origin/main` ledger (read-only; mutates and commits nothing).
- `/issues add|done|update|queue …` queue immutable request files under `docs/outstanding-issues-inbox/`. Ordinary branches never edit the canonical ledger. One deliberately serialized fresh-base branch runs `npm run issues:reconcile` after PRs land.
- Proactively offer to capture unresolved follow-ups, deferrals, and known risks into the ledger before session context is lost.
- Before acting on a queued item, check open PRs for overlapping routes or components to avoid duplicate concurrent work (`#292`).
- The `SessionStart` hook (`.claude/hooks/issues-surface.sh`, wired in `.claude/settings.json`) auto-surfaces the recommended queue plus open-item counts at session start (read-only).

<!-- END:repository-skills-and-issues -->
