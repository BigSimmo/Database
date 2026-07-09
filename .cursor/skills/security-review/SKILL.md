---
name: security-review
description: Reviews credentials, token handling, JWT claims, service-role confinement, public error envelopes, Row-Level Security (RLS) policies, and private bucket access. Use during database, authentication, or network boundary edits.
---

# Security Review Skill

Use this skill when reviewing code that touches authentication, database schemas, environment variables, storage, or external API gateways.

## Review Checklist

### 1. Key Confinement & Environment Safety

- **Service Role Key:** Ensure the Supabase `service_role` key is never exposed to public clients. Never prefix variables containing secret keys with `NEXT_PUBLIC_`.
- **Credential Storage:** Verify that credentials are not committed or hardcoded. Look for placeholder usage in `.env.example`.

### 2. Database & Storage Safety

- **Row-Level Security (RLS):** Ensure RLS is active on all public/exposed tables. Avoid deprecated checkers like `auth.role()` and prefer strict role predicates (`TO authenticated`).
- **Owner Scope Verification:** Verify that API endpoints filter queries by the authenticated user's ID (`user_id`) to prevent unauthorized cross-tenant data access.
- **Storage Buckets:** Verify that files uploaded to private buckets (`clinical-documents`, `clinical-images`) require validated user signatures for retrieval.
- **Views:** Ensure Postgres views are created with security invokers (`WITH (security_invoker = true)`) so they respect RLS.
