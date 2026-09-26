# Decision: Point-in-time recovery stays off; a recovery point of about 24 hours is accepted

- **Status:** decided 2026-08-22
- **Source:** `docs/database-remediation-plan.md`, find "Recovery point — owner decision, 2026-08-22"

The owner decided to leave Supabase point-in-time recovery off and accept losing up to about 24 hours of data in the worst case (#1K6T35). The only restore point is the most recent daily backup, and the remediation plan's rule was rewritten to say so.

If this summary and the source ever differ, the source wins.
