---
name: session-lifecycle
description: Manage Database repository work safely from task start through verification, handoff, merge proof, and conservative worktree or branch cleanup. Use when starting a task, checking session state, preparing completed work for handoff, confirming a squash merge landed, or cleaning up only proven-redundant task state.
---

# Session Lifecycle

1. Select the phase and generate its plan:
   `npm run workflow:lifecycle -- --phase <status|start|handoff|landed|cleanup>`
2. At task start, run the mandatory `start-codex-task.ps1` preflight, read applicable `AGENTS.md`, and preserve all existing work. Do not use the shared stash across worktrees.
3. During work, recheck branch and status before edits and before handoff. Use `database-flightplan` for non-trivial change verification.
4. At handoff, stage explicit coherent paths only, verify locally, and inspect the staged diff. Commit, push, PR creation, hosted CI, and merge remain authorization-bound.
5. After a squash merge, verify the reviewed content against fetched `origin/main`; do not rely on ancestry alone. Check for late orphaned commits before cleanup.
6. Remove a worktree or branch only after exact path/ref resolution, clean-state proof, and content-equivalence evidence. Preserve dirty, active, ambiguous, open-PR, or patch-unique work.
7. Record the outcome in `docs/branch-review-ledger.md` when the repo review protocol requires it.

The older `.claude/skills/newtask`, `handoff`, and `prlanded` remain compatibility surfaces. Use this skill as the agent-neutral orchestration contract.
