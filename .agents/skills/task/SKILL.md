---
name: task
description: Manage Database task lifecycle transitions safely, including start, status, handoff, landed proof, and cleanup planning. Use when beginning work, checking task state, preparing handoff, proving integration, or closing a session.
---

# Task

1. Use the required task-start script before repository changes.
2. Run `npm run workflow:lifecycle -- --phase <status|start|handoff|landed|cleanup> --write-evidence`.
3. Inspect branch, upstream, worktrees, status, and operation markers for the selected phase.
4. Preserve dirty, ambiguous, active, or unmerged work.
5. Keep fetch, push, PR, merge, and provider checks approval-gated.
6. Report the exact state transition proved and any action still requiring confirmation.
