---
name: migrate
description: Review and prepare Database schema migrations for safety, reversibility, privileges, RLS, locking, data preservation, and schema consistency. Use for new or changed Supabase migrations, functions, grants, policies, or schema changes.
---

# Migrate

1. Inspect migration order, current schema snapshots, generated types, dependent queries, and rollback expectations.
2. Review destructive operations, locks, defaults, nullability, backfills, function security, grants, and RLS.
3. Prefer additive, idempotent, staged changes with explicit validation and rollback.
4. Run static migration, grant, owner-scope, type, and focused unit checks offline.
5. Do not apply, reset, repair, link, or compare against live Supabase without explicit approval.
6. Report forward plan, rollback, data risk, compatibility window, and gated live proof.
