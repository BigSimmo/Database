---
name: health
description: Assess local Database repository health quickly with offline checks and clear separation of code failures from environment or tooling blockers. Use for routine health checks, stale-state diagnosis, or a fast confidence snapshot.
---

# Health

1. Inspect branch, status, worktrees, runtime versions, relevant logs, and active repo-owned processes.
2. Run `npm run check:runtime`, `npm run check:skills`, and the smallest check related to current changes.
3. Use `npm run verify:cheap` only when a broader offline snapshot is proportionate.
4. Classify failures as product code, test, tooling, resources, environment, or provider-gated.
5. Do not start permanent watchers or run live health endpoints without approval.
6. Return a short healthy/degraded/blocked assessment with exact evidence.
