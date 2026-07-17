---
name: operator-closeout
description: Convert pending Database operator, deployment, migration, secret, live-service, and governance debt into a current, deduplicated, dependency-ordered, approval-gated execution batch with pre-state, post-state, rollback, and evidence requirements. Use when closing operator backlog items, preparing launch actions, or reconciling confirmation-required follow-ups.
---

# Operator Closeout

1. Inventory candidates with:
   `npm run workflow:operator-closeout -- --write-evidence`
2. Treat the output as discovery, not truth. Verify each candidate against its linked runbook and current local state; remove completed, superseded, duplicate, or stale items.
3. Group remaining actions by provider and blast radius. Order prerequisites, read-only probes, reversible writes, irreversible writes, and post-verification.
4. For every action record:
   - exact target and environment;
   - external effect and credentials required;
   - pre-state query or evidence;
   - exact command or dashboard action;
   - success condition and post-state proof;
   - rollback or recovery path;
   - expected cost or downtime.
5. Ask for explicit approval for the concrete batch. Approval for one provider or command does not authorize another.
6. Execute approved actions one at a time, stop on unexpected state, and update durable operator documentation only with observed evidence.

The planner is intentionally plan-only. Never add automatic provider execution to it.
