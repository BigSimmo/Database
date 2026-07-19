---
name: access
description: Verify Database authentication, authorization, ownership, tenancy, grants, RLS, administrative boundaries, and conservative denial behavior. Use for auth changes, private routes, owner scope, cross-tenant risk, or permissions.
---

# Access

1. Map actor, credential, resource owner, tenancy boundary, route guard, database policy, and service-role use.
2. Test unauthenticated, wrong-owner, non-admin, stale-session, missing-record, and cross-tenant paths.
3. Inspect RLS, grants, security-definer functions, public API keys, and server/client trust boundaries.
4. Run focused local access-model, owner-scope, and private-route tests.
5. Keep staging cross-tenant tests and live Supabase checks approval-gated.
6. Report the authorization decision matrix, denial proof, bypass risk, and unverified live boundary.
