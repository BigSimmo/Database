---
name: recovery
description: Plan Database restore, rollback, queue recovery, reconciliation, backup validation, and disaster-recovery proof without modifying live systems automatically. Use for failed jobs, corrupted state, rollback planning, or continuity exercises.
---

# Recovery

1. Define the affected data, service, owner scope, last known-good point, recovery objective, and acceptable loss window.
2. Inspect local recovery scripts, migrations, queue state models, backups documentation, and reconciliation checks.
3. Prefer dry runs, fixtures, manifests, counts, and idempotent recovery steps.
4. Specify stop conditions, checkpoints, rollback, post-recovery integrity, and audit evidence.
5. Treat live restores, queue mutation, cleanup, Supabase, hosting, and production operations as approval-required.
6. Deliver an ordered recovery runbook and identify every unproven assumption.
