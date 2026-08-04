---
name: fix
description: Diagnose and repair a local Database verification failure using the smallest reproducer and safest scoped change. Use when lint, typecheck, tests, builds, browser checks, or offline evaluations fail or hang.
---

# Fix

1. Capture the exact failing command, output, duration, and environment context.
2. Run `npm run workflow:triage -- --log <path> --write-evidence` when a saved failure log exists.
3. Classify the cause as code, test, tooling, resource, race, or provider/configuration.
4. Reproduce with the narrowest deterministic check before editing.
5. Make the smallest safe fix, rerun that check, then widen proportionally.
6. Do not run provider-backed remediation without explicit approval.
