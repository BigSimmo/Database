---
name: plan
description: Plan safe risk-scoped Database work by inspecting the current change, selecting the smallest local verification ladder, and separating provider-backed checks into explicit approval gates. Use before non-trivial changes or when asked what checks are needed.
---

# Plan

1. Complete the task-start preflight and preserve unrelated work.
2. Run `npm run workflow:flightplan -- --write-evidence`; add `--files pathA,pathB` for proposed paths.
3. Confirm the detected risk classes match behavior, not only filenames.
4. Start with the narrowest local check and widen only when warranted.
5. Never execute anything under `approvalRequired` without explicit confirmation.
6. Report the planned checks, approval gates, evidence path, and residual risk.
