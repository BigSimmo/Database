# Clinical KB — Supabase remediation closeout notes

Short deferred list after Codex PRs. **No DDL in this note.** Exact table names for §2 arrive when Phase 3 inventory finishes.

**Projects:** prod `sjrfecxgysukkwxsowpy` · staging `ikoiolksxqxfxgiyqpnu`

## 1. File / defer (after Codex)

| Item | When / owner |
| --- | --- |
| Retire `invoke_ingestion_worker` cron/RPC | **PR1** owns |
| Harden `indexing-v3-agent` `verify_jwt` | After **PR2/PR3** |
| `FORCE RLS` on clinical tables | Later (not this wave) |
| FK / unused indexes | Only with evidence; do not batch-drop |
| Rotate / set `PROXY_AUTH_SIGNING_SECRET` | Quiet change window only |

## 2. Intentional RLS-on / no-policy (~16 public tables)

About **16** `public` tables keep **RLS enabled with no policies** on purpose: **service_role fail-closed** (anon/authenticated get nothing). Exact names TBD when Phase 3 inventory finishes — do not treat “RLS on, zero policies” as a defect for those tables.

## 3. Out of scope here

- No schema/DDL from this closeout file.
- Auth dashboard CAPTCHA/signup vs [`multi-user-auth-setup.md`](multi-user-auth-setup.md) stays operator-owned when Phase 1 Auth finishes.

*Recorded 2026-09-21 (Documentation, handoff from Supabase; replaces Issues for this note).*
