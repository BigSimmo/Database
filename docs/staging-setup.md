# Staging Environment Setup

Turnkey runbook for standing up a staging environment. Companion to
`docs/deployment-architecture.md` §5 (why staging is a dedicated project, not a
prod branch) and `docs/capacity-review.md` §4 (the soak test that validates it).

Staging is two independent tiers: a **staging Supabase project** (data) and a
**staging app host** (compute). Do the data tier first — the app needs it.

The identity guard is already staging-aware (`src/lib/supabase/project.ts`): it
accepts a second project **only** when you explicitly declare it via
`SUPABASE_STAGING_PROJECT_REF` + `SUPABASE_STAGING_PROJECT_NAME`, and it refuses
a staging ref that collides with the production or stale ref. So no code change
is needed to activate staging — just env. Production behavior is unchanged when
those vars are unset.

## A. Staging Supabase project (data tier)

1. **Create the project.** Same org (`BigSimmo's Org`), region
   **ap-southeast-2 (Sydney)** — a _separate project_, not a branch of
   production. Name it e.g. `Clinical KB Staging`. (Can be done via the
   Supabase MCP `create_project` after a `confirm_cost` step — a new project is
   ~$10/month — or from the dashboard.) Record the new project ref
   (`<staging-ref>`) and generate a DB password.

2. **Apply the schema.** From a checkout linked to the staging project:

   ```bash
   supabase link --project-ref <staging-ref>
   supabase db push          # applies supabase/migrations/* → matches schema.sql
   ```

   Then confirm health: `npm run check:indexing` (runs `search_schema_health()`
   over the hybrid RPCs) should report ok.

3. **Seed a small corpus (~50 docs).** Use synthetic/public content only — do
   **not** copy clinical production documents into staging.

   ```bash
   npm run samples                 # generate synthetic sample documents
   npm run import:docs             # queue them for ingestion
   # (run the worker — section B4 — to process the queue)
   npm run registry:seed -- --owner-id <owner> --write --confirm
   npm run differentials:seed
   npm run medications:seed
   ```

4. **Capture the keys** for the staging project (dashboard → API): the
   publishable key (`sb_publishable_…`) and the service-role secret
   (`sb_secret_…`).

## B. Staging app host (compute tier)

Recommended host: any OCI-image host. Production runs on **Railway**; Google
Cloud Run `australia-southeast2` is a Sydney-region alternative if lower
answer latency matters. No MCP is available here, so this is an operator step.

1. **Build the image** from the committed `Dockerfile`, passing the _staging_
   publishable key (it inlines into the client bundle):

   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co \
     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<staging sb_publishable_…> \
     -t clinical-kb-app:staging .
   ```

   Note: local Docker Desktop can OOM on the 8 GiB Next build heap; prefer the
   CI image-build workflow (builds on GitHub runners) if the local build wedges.

2. **Runtime secrets** (injected at deploy, never baked into the image) — all
   with **staging** values, distinct from production:

   | Var                             | Value                             |
   | ------------------------------- | --------------------------------- |
   | `SUPABASE_SERVICE_ROLE_KEY`     | staging `sb_secret_…`             |
   | `OPENAI_API_KEY`                | an OpenAI key (staging or shared) |
   | `SUPABASE_PROJECT_REF`          | `<staging-ref>`                   |
   | `SUPABASE_PROJECT_NAME`         | `Clinical KB Staging`             |
   | `SUPABASE_STAGING_PROJECT_REF`  | `<staging-ref>`                   |
   | `SUPABASE_STAGING_PROJECT_NAME` | `Clinical KB Staging`             |
   | `RAG_QUERY_HASH_SECRET`         | a staging secret                  |
   | `RAG_PROVIDER_MODE`             | `auto`                            |

   The two `SUPABASE_STAGING_PROJECT_*` vars are what make the identity guard
   accept the staging project. Setting `NEXT_PUBLIC_SUPABASE_URL` +
   `SUPABASE_PROJECT_REF` to the staging ref **without** them will (correctly)
   fail `check:supabase-project` — that's the deliberate speed bump.

3. **Host config:** bind `0.0.0.0:$PORT` (the Dockerfile already does),
   health check `/api/health`, `min_machines_running=1`, no scale-to-zero.

4. **Worker (optional, for ingestion in staging):** build `Dockerfile.worker`
   and run one instance with the same staging secrets. Required to process the
   seed queue from A3.

## C. Validate staging

1. Boot check: `GET /api/health` → `{"status":"ok"}` with the staging project.
2. Load check — the soak test is hard-guarded against production:

   ```bash
   npx tsx scripts/soak-test.ts --target https://<staging-host> \
     --confirm-staging --users 30 --duration-s 600 --ramp-s 120
   ```

   Success targets are in `docs/capacity-review.md` §4 (search p95 ≤ 3 s,
   answer p95 ≤ 25 s, non-429 error rate < 1 %).

## What is operator-only (cannot be scripted here)

- Creating the Supabase project (billable) and its DB password.
- Opening the host account (e.g. Railway) and setting the runtime secrets.
- Any change to the **production** project's settings (e.g. auth
  percentage-based connection allocation — see `docs/capacity-review.md` §3).
