---
name: workflows
description: List all Database workflow skills, summarize their purpose, and recommend the right workflow for the current change.
---

# Database Workflows

## What this skill covers

Use this skill when you need a quick index of Database-specific workflow skills and a reminder of what each one validates.

## Available workflow skills

- `database-flightplan`: Risk classification and local/offline verification planning for non-trivial changes.
- `verify-triage-fix`: Stepwise local failure triage for lint/typecheck/tests/build/playwright/offline checks.
- `clinical-change-proof`: Clinical, answer-governance, safety, privacy, and source-governance evidence planning.
- `live-design-sweep`: App-wide live route/design/accessibility verification across breakpoints and interaction states.
- `rag-change-lab`: Offline evaluation and migration-proofing for retrieval, classification, ranking, and grounding changes.
- `operator-closeout`: Conversion of pending deployment/operator/provisioning tasks into dependency-ordered execution batches.
- `session-lifecycle`: Start-to-handoff-to-cleanup orchestration with review/merge safety checks.

## Recommended usage pattern

1. Start with `database-flightplan` for non-trivial edits.
2. Use `verify-triage-fix` only when checks fail or hang.
3. Add `clinical-change-proof` for clinical retrieval, output, or source-governance risk.
4. Use `live-design-sweep` for UI/routing/interaction defects.
5. Use `rag-change-lab` for RAG behavior work.
6. Use `operator-closeout` for deferred operator or provider-work batches.
7. Use `session-lifecycle` for session-level handoff and cleanup.
