---
name: test
description: Choose and run the smallest relevant local Database test, reproduce failures deterministically, and widen verification only when needed. Use for test requests, behavioral proofs, or focused regression coverage.
---

# Test

1. Inspect the touched behavior and existing nearby tests before selecting a command.
2. Prefer a single Vitest or Playwright target; use `npm run test:focused -- --files <paths>` only for safe source-only changes.
3. Add the smallest deterministic regression proof when behavior is unprotected.
4. Run one heavy command at a time and rerun the smallest failing check after each fix.
5. Keep live/provider-backed tests approval-gated.
6. Report exact commands, exit codes, coverage limits, and tests not run.
