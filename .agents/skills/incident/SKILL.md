---
name: incident
description: Triage recurring Database canary, CI, runtime, scheduled-task, and provider failures into reproducible causes, impact, containment, and next actions. Use for regressions, outages, flaky jobs, alerts, or repeated nightly or weekly failures.
---

# Incident

1. Build a timeline from local logs, saved artifacts, workflow definitions, and known-good comparisons.
2. Classify the failure as deterministic code, fixture/data drift, schedule, concurrency, environment, quota, provider, or observability.
3. Reproduce offline with the smallest fixture, parser test, or triage artifact before editing.
4. Implement only safe local containment or correction and verify the exact failure path.
5. Do not query GitHub, hosted CI, Supabase, OpenAI, production logs, or providers without approval.
6. Report impact, cause confidence, fix, proof, remaining uncertainty, and gated live confirmation.
