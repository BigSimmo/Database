---
name: database-flightplan
description: Plan safe, risk-scoped work in the Database repository by inspecting the current diff, selecting the smallest local verification ladder, and separating provider-backed checks into explicit approval gates. Use before non-trivial source, config, test, UI, database, retrieval, clinical, dependency, CI, or deployment changes, or when the user asks what checks a change needs.
---

# Database Flightplan

1. Run the repository task-start preflight if it has not run for the current task. Inspect branch and full Git status; preserve unrelated work.
2. Generate the plan:
   `npm run workflow:flightplan -- --write-evidence`
   Use `--files pathA,pathB` when planning proposed paths before editing.
3. Confirm the risk classes match the actual behavior, not only filenames. Add a focused check when the change crosses an unclassified boundary.
4. Execute the narrowest relevant check first. Use `--run` only when running the full printed local/offline sequence is proportionate.
5. Never execute anything listed under `approvalRequired` without explicit user confirmation. Treat indirect provider calls the same way.
6. After fixes, run `npm run verify:pr-local` when the change is ready for handoff. Add UI or domain gates only when the plan selects them.
7. Report changed files, checks and results, checks not run, approval gates, branch state, and residual risk.

Keep the planner authoritative for deterministic selection. Do not reproduce its path tables in the skill.
