# Database skills catalog

This repository has the following Database-specific skills.

## Workflow and repo orchestration skills

- `database-flightplan` — create a risk-scoped verification plan before non-trivial work.
- `verify-triage-fix` — diagnose and fix local verification failures with minimal repros.
- `clinical-change-proof` — assemble clinical/medical safety and production-readiness evidence.
- `live-design-sweep` — inspect the running app across routes, breakpoints, accessibility modes, and interactions.
- `rag-change-lab` — validate retrieval/ranking/grounding changes with focused offline checks.
- `operator-closeout` — turn operator/provisioning/debt tasks into an ordered, approval-gated execution plan.
- `session-lifecycle` — manage safe task start/handoff/cleanup and merge-proof transitions.
- `workflows` — this new skill: indexed reference describing each Database workflow skill and when to use it.

## Notes

- These are the skills currently present in `.agents/skills` for this Database worktree.
- Use these skills as lightweight orchestration and evidence-first planning helpers.
- The first step for most non-trivial tasks remains `start-codex-task.ps1` (as required by AGENTS instructions).
