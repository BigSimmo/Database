# Multi-user auth — Supabase configuration checklist (you apply)

The **code** for multi-user (persistent cookie sessions, magic link + password +
SSO, per-user isolation) lands via the `claude/multiuser-auth` branch. The
**live Supabase configuration** below is done by you in the dashboard / provider
consoles — Claude does not change the live Auth config. Target project:
`Clinical KB Database` (`sjrfecxgysukkwxsowpy`).

> **Order matters:** do **not** enable open signup on live until the fail-closed
> owner-scoping hardening on this branch has merged (the DB owner-RLS + private
> storage backstop is already in place — see §7). Validate the whole flow in a
> **staging** project first.

## 1. Auth → Providers

- **Email**: enable **Confirm email** (verifies ownership; blocks throwaway
  signups). Enable **Email OTP** (magic link — already used) **and** **Password**.
- **Google**: create an OAuth client in Google Cloud Console → add the Supabase
  callback `https://sjrfecxgysukkwxsowpy.supabase.co/auth/v1/callback` as an
  authorized redirect URI → paste client ID/secret into Supabase → enable.
- **Azure (Microsoft)**: register an app in Azure AD (Entra ID) with the same
  Supabase callback as a redirect URI → paste client ID/secret + tenant →
  enable the **Azure** provider.

## 2. Auth → Sign in / Providers → "Allow new users to sign up"

- Turn **ON** (open public signup, per decision). Each new account starts as an
  empty private silo — a new user cannot see anyone else's data.

## 3. Auth → URL Configuration

- **Site URL**: the production origin (e.g. `https://app.example.com`).
- **Redirect URLs** (allowlist): add the app's callback for every environment:
  - `https://app.example.com/auth/callback`
  - `http://localhost:<port>/auth/callback` (local dev)
  - the app routes magic link, OAuth, and confirmation returns through
    `/auth/callback` (see `src/app/auth/callback/route.ts`).

## 4. Auth → SMTP (production email)

- Configure **custom SMTP** (Resend / SendGrid / SES / Postmark). The built-in
  Supabase email is dev-only (~a few/hour) and will bottleneck magic-link +
  confirmation mail for real users.

## 5. Auth → Attack protection (recommended for open signup)

- Enable **CAPTCHA** (hCaptcha or Cloudflare Turnstile) to stop bot signups.
- Keep the default Auth **rate limits**.
- **Cost note:** every signed-in user can drive OpenAI / RAG spend — budget for
  it and consider per-owner rate limits (the app already has `consumeApiRateLimit`
  buckets keyed by owner).

## 6. App environment variables

Already used by the app; ensure they are set per environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon/publishable — safe in the browser)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never exposed to the client)

OAuth client secrets live in **Supabase**, not in app env.

## 7. Database RLS + storage — already in place (verified against live 2026-07-03)

The DB-level per-user backstop the plan anticipated **already exists on the live
project**, so no broad RLS migration is required:

- Every owner-scoped **user-data** table (documents + children, `rag_queries`,
  `rag_query_misses`, `rag_retrieval_logs`, `import_batches`, `rag_aliases`,
  `storage_cleanup_jobs`, `document_*`) has RLS enabled **and** an `authenticated`
  owner-read policy: `owner_id = (select auth.uid())`.
- Registry tables (`clinical_registry_records`, `_sources`) and internal tables
  (`api_rate_limits`, `audit_logs`, `rag_response_cache`) are RLS-enabled and
  **service-role-only** (fully server-mediated — intentional).
- Both storage buckets (`clinical-documents`, `clinical-images`) are **private**;
  file access is via server-minted signed URLs after an owner check. No direct
  client storage access is enabled (so no per-user folder policy is needed unless
  client-direct storage reads are ever added).

Combined with the app-layer **fail-closed owner scoping** shipped on this branch,
per-user isolation is enforced at both layers.

**Two residual, low-priority items (out of scope for multi-user, no action needed
to launch):**

- `rag_visual_eval_cases` (an internal eval table) has RLS **disabled**, but it
  has **no anon/authenticated grant** so it is effectively service-role-only. It
  is also **not in `supabase/schema.sql`** (untracked live-only drift) — fixing it
  properly means codifying the table first, a separate schema-hygiene task.
- Registry tables are service-role-only by design; add `authenticated` owner-read
  policies only if you later introduce client-side registry reads.

## Verification (staging, after the above)

1. Sign up with **email + password** → receive + click the confirmation link →
   land signed in.
2. **Magic link** → email link → signed in.
3. **Google** and **Microsoft** SSO → signed in.
4. **Hard-refresh** the page → still signed in (persistent cookie session).
5. **Isolation:** sign in as user A, upload a document, sign out; sign in as
   user B → B sees none of A's documents, registry, or search results.
