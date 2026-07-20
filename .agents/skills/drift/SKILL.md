---
name: drift
description: Detect Database schema, migration, type, environment, and generated-artifact drift offline, while keeping live Supabase comparison approval-gated. Use when schema sources disagree or deployment drift is suspected.
---

# Drift

1. Compare repository migrations, `supabase/schema.sql`, generated database types, manifests, and migration references.
2. Run static drift and consistency checks that do not contact a provider.
3. Distinguish committed schema drift, stale generated output, missing migration history, and environment-only mismatch.
4. Add a deterministic manifest or test when the mismatch can recur silently.
5. Ask before `npm run check:supabase-project`, live schema inspection, CLI linking, pulling, or diffing.
6. Report exact sources of truth, mismatch, remediation order, and remaining live comparison.
