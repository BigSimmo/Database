# Tenancy Defense-in-Depth Review — Clinical KB Database

**Status:** Review complete · **Date:** 2026-07-06 (fail-closed RPC landed **2026-07-08**, PR #409) · **Branch:** `claude/privacy-tenancy-review`
**Scope:** Every API route family under `src/app/api/**`, the Supabase RPCs they call, signed-URL
issuance, the response cache, and the demo/no-auth code paths — audited adversarially for a missed or
bypassable `owner_id` filter.
**Method:** One auditor agent per route family (7 families, all 33 route files), each required to trace
every `supabase.rpc(...)` into `supabase/schema.sql` / `supabase/migrations/**` and confirm the SQL
body itself owner-filters. Every claimed gap was then independently re-verified against the source and
the live database. Verdicts: **verified-scoped** / **gap** / **needs-deeper-look**.

---

## 1. Executive summary

**Result: 0 confirmed cross-tenant leaks across all 33 API routes.** Every route that reads or mutates
owner-scoped clinical data applies an owner filter, and every retrieval RPC re-applies owner scoping in
its own SQL body. The single deliberately-service-role architecture (RLS bypassed in the app tier,
ownership enforced in application code) is, as implemented today, **correctly and consistently
enforced**.

That said, this is a **single-layer** design with one structural weakness that **was closed on
2026-07-08** (PR #409):

> **The database had no independent tenancy floor for NULL `owner_filter`.** Before #409, the shared
> `retrieval_owner_matches` helper returned _every_ row when `owner_filter IS NULL` (fail-open). PR
> #409 (`20260708160001_retrieval_owner_matches_fail_closed.sql`) makes `NULL` match **no rows**; the
> app routes demo/test/local-no-auth through the public sentinel (`00000000-…`) instead of `NULL`
> ([owner-scope.ts](src/lib/owner-scope.ts)). Production paths that lack an owner still throw before
> any RPC is called.

**Historical note (pre-#409):** the review below describes the fail-open edge that existed at audit
time. Items 1 (fail-closed RPC) and 2 (CI owner-scope guard) in §6 are **DONE**; items 3–4 remain the
recommended follow-ups.

**The one non-clean finding** is a **low-severity information disclosure**, not a tenancy leak:
`setup-status` interpolates a raw Postgres RPC error string into its response
([setup-status/route.ts:165](src/app/api/setup-status/route.ts)) — schema-shape only, behind the
local-origin gate (TEN-N1).

---

## 2. The tenancy architecture

### 2.1 How ownership is resolved

```
request ─► publicAccessContext()  src/lib/public-api-access.ts:65-80
             │   getOptionalAuthenticatedUser() validates bearer/cookie JWT via supabase.auth.getUser()
             ├─ authenticated → { authenticated:true,  ownerId: user.id }
             └─ anonymous     → { authenticated:false, ownerId: undefined }
```

Mutating routes instead call `requireAuthenticatedUser()` which **throws** (401) with no session
([auth.ts:136-140](src/lib/supabase/auth.ts)). `owner_id` is **never** taken from the request body/query
— it is always the cryptographically-validated `auth.uid()` or a server-configured value. This closes
the "forge an owner_id" class of attack across every route.

### 2.2 The two scoping primitives

- **Reads (public-overlay model):** `withOwnerReadScope(query, ownerId)`
  ([public-api-access.ts:60-63](src/lib/public-api-access.ts)):
  - authenticated → `.or('owner_id.eq.<id>,owner_id.is.null')` → **own rows + shared public (null-owner) rows**
  - anonymous → `.is('owner_id', null)` → **public rows only**
- **Retrieval (RPC filter):** `retrievalOwnerFilter({ownerId, documentIds, allowGlobalSearch})`
  ([owner-scope.ts:15-30](src/lib/owner-scope.ts)):
  - `ownerId` → that owner (exact)
  - demo / local-no-auth / test → `undefined`
  - else if `allowGlobalSearch || documentIds` → **`PUBLIC_OWNER_FILTER_SENTINEL` `00000000-…0000`** (public-only)
  - else → **throws** (fail-closed)

**Threat-model note:** null-owner rows are a _deliberately shared public corpus_ (see
[migration 20260705220000](supabase/migrations/20260705220000_promote_locally_reviewed_documents_public.sql)
promoting reviewed documents to public). An authenticated user seeing null-owner rows is **not** a
leak. The leak this review hunts is: **authed user A seeing user B's non-null `owner_id` rows**, an
**anonymous** caller seeing any non-null rows, or any caller **mutating** another owner's rows.

### 2.3 The SQL-level owner helper (fail-closed since #409)

Every retrieval RPC gates rows through `retrieval_owner_matches`. **As of PR #409** the helper is
fail-closed on `NULL`:

```sql
-- migration 20260708160001_retrieval_owner_matches_fail_closed.sql
create function public.retrieval_owner_matches(owner_filter uuid, row_owner_id uuid) returns boolean as $$
  select case
    when owner_filter is null then false                                  -- fail-closed (was fail-open pre-#409)
    when owner_filter = '00000000-0000-0000-0000-000000000000' then row_owner_id is null  -- public only
    else row_owner_id = owner_filter                                      -- exact owner (excludes null)
  end;
$$;
```

Legitimate public/demo paths pass the sentinel, not `NULL`. Verify live with
`npm run check:july8-live-batch` after applying the July 8 batch
([operator runbook](operator-apply-july8-batch.md)).

---

## 3. Route-by-route verdict

All 33 route files, every exported method. Full per-method reasoning with line cites lives in the audit
transcripts; this is the consolidated verdict.

### Answer family (OpenAI RAG path)

| Route · method            | Verdict            | Owner mechanism                                                                                                                                                                     |
| ------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/answer`        | ✅ verified-scoped | `access.ownerId` + `allowGlobalSearch:!ownerId` → RPC `retrieval_owner_matches`; `resolveSearchScope` pre-filters documents ([route.ts:80,93,125-126](src/app/api/answer/route.ts)) |
| `POST /api/answer/stream` | ✅ verified-scoped | Same resolution threaded through `streamAnswer(...ownerId,publicOnly)` ([stream/route.ts:241-252](src/app/api/answer/stream/route.ts))                                              |

### Documents read + sub-resources

| Route · method                                 | Verdict            | Owner mechanism                                                                                                                                                                               |
| ---------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/documents`                           | ✅ verified-scoped | `withOwnerReadScope(...access.ownerId)` ([documents/route.ts:173](src/app/api/documents/route.ts)); children fetched by owner-scoped documentIds                                              |
| `GET /api/documents/[id]`                      | ✅ verified-scoped | `withOwnerReadScope(...).eq('id',id)`; 404 before child fetch ([[id]/route.ts:289-295](src/app/api/documents/[id]/route.ts))                                                                  |
| `PATCH /api/documents/[id]`                    | ✅ verified-scoped | `requireAuthenticatedUser` + `.eq('id',id).eq('owner_id',user.id)`; update re-asserts owner ([[id]/route.ts:434-462](src/app/api/documents/[id]/route.ts))                                    |
| `DELETE /api/documents/[id]`                   | ✅ verified-scoped | owner-scoped parent fetch + delete re-asserts owner; storage cleanup from owner-verified rows ([[id]/route.ts:493-583](src/app/api/documents/[id]/route.ts))                                  |
| `POST/PATCH/DELETE /api/documents/[id]/labels` | ✅ verified-scoped | `requireOwnedDocument` + every write triple-scoped `id`+`document_id`+`owner_id` ([labels/route.ts:77-288](src/app/api/documents/[id]/labels/route.ts))                                       |
| `POST /api/documents/[id]/summarize`           | ✅ verified-scoped | `requireAuthenticatedUser`; `summarizeDocument(id,user.id)` filters `owner_id` ([summarize/route.ts:30-34](src/app/api/documents/[id]/summarize/route.ts)); latent note TEN-N2                |
| `GET/PATCH /api/documents/[id]/table-facts`    | ✅ verified-scoped | `loadOwnedDocument` (`.eq('owner_id')`); fact writes re-scoped ([table-facts/route.ts:27-116](src/app/api/documents/[id]/table-facts/route.ts))                                               |
| `GET /api/documents/[id]/search`               | ✅ verified-scoped | route owner-scopes parent AND `search_document_chunks` SQL owner-filters ([search/route.ts:190-204](src/app/api/documents/[id]/search/route.ts); [schema.sql:2928-2931](supabase/schema.sql)) |

### Mutations · signed URLs · upload (highest blast radius)

| Route · method                       | Verdict            | Owner mechanism                                                                                                                                                                          |
| ------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/documents/[id]/signed-url` | ✅ verified-scoped | `withOwnerReadScope` on doc **before** `createSignedUrl`; `storage_path` from owner-verified row ([signed-url/route.ts:40-51](src/app/api/documents/[id]/signed-url/route.ts))           |
| `GET /api/images/[id]/signed-url`    | ✅ verified-scoped | image has no `owner_id`; tenancy via parent-document `withOwnerReadScope` ([images/[id]/signed-url/route.ts:49-55](src/app/api/images/[id]/signed-url/route.ts))                         |
| `POST /api/documents/[id]/reindex`   | ✅ verified-scoped | `requireAuthenticatedUser` + `.eq('owner_id',user.id)`; every state write re-scoped ([reindex/route.ts:110-255](src/app/api/documents/[id]/reindex/route.ts))                            |
| `POST /api/documents/bulk`           | ✅ verified-scoped | pre-scoping select `.eq('owner_id',user.id).in('id',ids)`; body ids intersected with ownership ([bulk/route.ts:127-204](src/app/api/documents/bulk/route.ts))                            |
| `POST /api/documents/bulk/reindex`   | ✅ verified-scoped | pre-scoping select `.eq('owner_id',user.id)`; per-doc writes re-scoped ([bulk/reindex/route.ts:101-247](src/app/api/documents/bulk/reindex/route.ts))                                    |
| `POST /api/upload`                   | ✅ verified-scoped | `owner_id` = session id, or configured `PUBLIC_WORKSPACE_OWNER_ID` only if public uploads enabled, else 503 ([upload/route.ts:94-97](src/app/api/upload/route.ts)); operator note TEN-N3 |

### Search

| Route · method                 | Verdict            | Owner mechanism                                                                                                                                                                                                               |
| ------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/search`             | ✅ verified-scoped | `searchChunksWithTelemetry({ownerId,allowGlobalSearch:!ownerId})`; RPCs owner-filter; `assertGlobalSearchAllowed` throws in prod ([search/route.ts:726-728](src/app/api/search/route.ts); [rag.ts:2151-2164](src/lib/rag.ts)) |
| `GET /api/search/universal`    | ✅ verified-scoped | live branch only when `access.ownerId` truthy; each domain owner-seeded; static catalogs intended-public ([universal/route.ts:70-82](src/app/api/search/universal/route.ts))                                                  |
| `POST /api/search/interaction` | ✅ verified-scoped | writes hard-pinned to `owner_id:user.id`; clicked doc/chunk validated owner-owned or nulled ([interaction/route.ts:44-84](src/app/api/search/interaction/route.ts))                                                           |

### Ingestion · jobs

| Route · method                        | Verdict            | Owner mechanism                                                                                                                                                                 |
| ------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/ingestion/batches`          | ✅ verified-scoped | `.eq('owner_id',user.id)` on `import_batches` ([batches/route.ts:62-67](src/app/api/ingestion/batches/route.ts))                                                                |
| `GET /api/ingestion/jobs`             | ✅ verified-scoped | `documents!inner` + `.eq('documents.owner_id',user.id)` (jobs have no owner col) ([jobs/route.ts:64-69](src/app/api/ingestion/jobs/route.ts))                                   |
| `POST /api/ingestion/jobs/[id]/retry` | ✅ verified-scoped | job gated via `documents!inner(owner_id)`+`.eq('id',id)`; requeue re-asserts `.eq('owner_id',user.id)` ([retry/route.ts:23-95](src/app/api/ingestion/jobs/[id]/retry/route.ts)) |
| `GET /api/ingestion/quality`          | ✅ verified-scoped | root `documents` `.eq('owner_id',user.id)`; all aggregates `.in('document_id',ownedIds)` ([quality/route.ts:318-361](src/app/api/ingestion/quality/route.ts))                   |
| `GET /api/jobs`                       | ✅ verified-scoped | `documents!inner` + `.eq('documents.owner_id',user.id)` ([jobs/route.ts:67-71](src/app/api/jobs/route.ts))                                                                      |

### Catalogs · eval (owner-scoped private tables with in-memory public fixtures)

| Route · method                                                  | Verdict            | Owner mechanism                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/registry/records` (+ `/[slug]`)                       | ✅ verified-scoped | authed branch `.eq('owner_id',ownerId)`; anon branch = in-memory fixtures, no DB rows ([registry-seed.ts:65](src/lib/registry-seed.ts); [records/route.ts:79-106](src/app/api/registry/records/route.ts))              |
| `GET /api/medications` (+ `/[slug]`)                            | ✅ verified-scoped | `.eq('owner_id',ownerId)` ([medication-seed.ts:37](src/lib/medication-seed.ts); [[slug]/route.ts:98](src/app/api/medications/[slug]/route.ts))                                                                         |
| `GET /api/differentials` (+ `/[slug]`, `/presentations/[slug]`) | ✅ verified-scoped | `.eq('owner_id',access.ownerId)` on every DB read ([differentials/route.ts:106](src/app/api/differentials/route.ts); [presentations/[slug]/route.ts:113,144](src/app/api/differentials/presentations/[slug]/route.ts)) |
| `POST /api/eval-cases`                                          | ✅ verified-scoped | `requireAuthenticatedUser`; `owner_id:user.id`; referenced doc/chunk validated owner-owned or nulled ([eval-cases/route.ts:124-149](src/app/api/eval-cases/route.ts))                                                  |

> Catalog correction: the audit brief speculated these tables might be owner-less shared catalogs.
> **False** — `clinical_registry_records`, `medication_records`, `differential_records`,
> `rag_query_misses` all declare `owner_id NOT NULL` with a `unique(owner_id, …)` constraint
> ([migration 20260703020000:10](supabase/migrations/20260703020000_clinical_registry_records.sql),
> [20260705010000:7](supabase/migrations/20260705010000_medication_records.sql),
> [20260705120000:5](supabase/migrations/20260705120000_differential_records.sql)). They are
> owner-scoped private tables; the "public catalog" served to anonymous callers comes from **in-memory
> curated fixtures**, never DB rows. No route exposes a write path to a shared catalog (catalog
> poisoning is not reachable).

### Infra / misc (info-disclosure, not owner rows)

| Route · method              | Verdict                   | Notes                                                                                                                                                                   |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`           | ✅ verified-safe          | Only presence booleans + coarse status; deep probe behind `HEALTH_DEEP_PROBE_SECRET` with `timingSafeEqual` ([health/route.ts:8-17,29-49](src/app/api/health/route.ts)) |
| `GET /api/setup-status`     | ⚠ needs-deeper-look (low) | **TEN-N1** — raw RPC `error.message` in `detail` ([setup-status/route.ts:165](src/app/api/setup-status/route.ts)); schema-shape only, behind local-origin gate          |
| `GET /api/local-project-id` | ✅ verified-safe          | Returns constants + one-way SHA-256 of cwd path; no secrets, no owner data ([local-server-utils.mjs:20-22](src/lib/local-server-utils.mjs))                             |

**No request-controlled path can flip the app into demo/no-auth mode.** `isDemoMode()` /
`isLocalNoAuthMode()` read only server env + `NODE_ENV`, and both hard-return `false` in production
([env.ts:185-206](src/lib/env.ts)). No auth-bypass surface found.

---

## 4. RPC SQL-body owner enforcement

Every retrieval RPC reachable from a user route was traced into `supabase/schema.sql` /
`supabase/migrations/**` and confirmed to apply `retrieval_owner_matches(owner_filter, <table>.owner_id)`
(or the inline equivalent) in its `WHERE`. All are `language sql` **SECURITY INVOKER**.

| RPC                                       | Owner-filters in SQL?                    | Ref                                                                                                                 |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `match_document_chunks` (vector)          | ✅                                       | [migration 20260705210000:65](supabase/migrations/20260705210000_retrieval_owner_filter_sentinel.sql), :120         |
| `match_document_chunks_hybrid`            | ✅                                       | :188, :229                                                                                                          |
| `match_document_chunks_text`              | ✅                                       | :591                                                                                                                |
| `match_document_lookup_chunks_text`       | ✅                                       | :723                                                                                                                |
| `match_documents_for_query`               | ✅ (`requireOwnerScope`, throws on null) | :511                                                                                                                |
| `match_document_table_facts_text`         | ✅                                       | :862                                                                                                                |
| `match_document_embedding_fields_hybrid`  | ✅                                       | :917, :931                                                                                                          |
| `match_document_index_units_hybrid`       | ✅                                       | :1013                                                                                                               |
| `match_document_memory_cards_hybrid(_v2)` | ✅                                       | [schema.sql:2228,2248,2330-2337](supabase/schema.sql)                                                               |
| `get_related_document_metadata`           | ✅                                       | :765, :775, :781                                                                                                    |
| `search_document_chunks` (single-doc)     | ✅ (fail-closed)                         | [migration 20260705133000:51-52](supabase/migrations/20260705133000_tighten_search_document_chunks_owner_scope.sql) |

**Ingestion state RPCs** (`claim_ingestion_jobs`, `complete_ingestion_job`,
`fail_or_retry_ingestion_job`, `refresh_import_batch_status`) mutate **by id with no owner predicate**
and are SECURITY INVOKER — but they are **not a route gap**: they are invoked **only from the trusted
worker** (`worker/main.ts`), are **revoked from `anon`/`authenticated`** and granted `service_role`
only ([schema.sql:3772,3805](supabase/schema.sql)), and the user-facing retry route deliberately uses a
direct owner-scoped `UPDATE` instead. No user session can reach them.

**All execute grants on retrieval RPCs are revoked from `anon`/`authenticated` and granted only to
`service_role`** ([schema.sql:2950-2951](supabase/schema.sql)) — consistent with the "service-role +
app-layer filter" design.

---

## 5. Response-cache cross-tenant analysis

The memory-flagged concern ("shared null-owner `rag_response_cache` bucket") was checked directly and
does **not** yield a cross-tenant leak:

- **In-memory answer/search caches:** the cache **key** includes `ownerId` as an explicit component —
  `scopedAnswerCacheKey = [depVersion, ownerId ?? "anonymous", scopeKey, modeKey, query]`
  ([rag.ts:1453-1459](src/lib/rag.ts)) and `scopedSearchCacheKey`
  ([rag.ts:1553-1559](src/lib/rag.ts)). User A's UUID-prefixed key cannot collide with B's.
- **Persisted `rag_response_cache`:** owner enforced as a **column predicate** on both read and write —
  `sharedCacheSelector` adds `.eq('owner_id', args.ownerId)` (authed) or `.is('owner_id', null)` (anon)
  ([rag.ts:1667](src/lib/rag.ts)); writes stamp `owner_id: args.ownerId ?? null` after a same-owner
  delete ([rag.ts:1870-1873](src/lib/rag.ts)). A reads only `owner_id = A` rows — never B's, never the
  null bucket.
- The `owner_id IS NULL` cache partition is shared **among anonymous callers only**, and only ever
  holds answers built from **public null-owner documents** — the intended public corpus, not private
  data. No cross-tenant serve.

---

## 6. Recommendation: does production warrant owner-scoped RLS as a second layer?

**Short answer: not a full RLS refactor first — but yes to a cheaper, higher-leverage second layer.**
The honest cost/benefit:

### What RLS would and wouldn't buy today

The RLS policies in `schema.sql` (owner-read for `authenticated`) are currently **latent**: the API
routes all use the **service-role** client, which bypasses RLS, so those policies protect **nothing on
the current request paths**. They would only bite a _different_ access pattern (client-direct Supabase
access, or an edge function running as the user) — which the app doesn't use. So "RLS exists" is true
but does not currently constitute a second enforcement layer for these routes.

### The real cost of making RLS bite

To make RLS an actual second layer, every route would need to stop using the service-role client and
instead run as the user (anon key + user JWT, or a per-request `SET LOCAL` owner GUC). That refactor is
**substantial and risky** because:

1. **The public-overlay model breaks under naïve RLS.** Current policies grant `owner_id = auth.uid()`
   only — **not** null-owner rows. The app's whole "own rows + shared public corpus" read model
   ([withOwnerReadScope](src/lib/public-api-access.ts)) would return no public documents unless every
   policy is rewritten to `owner_id = auth.uid() OR owner_id IS NULL`.
2. **Anonymous public-catalog reads have no JWT** to present, so an anon-key + RLS path returns nothing
   for the intended public/unauthenticated experience unless carefully policy-modelled.
3. **The retrieval RPCs are SECURITY INVOKER but called as service-role**; re-scoping them to run as the
   user (or flipping SECURITY DEFINER) is a performance- and correctness-sensitive change.
4. **The worker legitimately needs service-role** and must stay bypassing RLS.

That is real, multi-week work with its own regression surface — disproportionate while the app serves a
small, largely-cooperative user set with a public shared corpus.

### The pragmatic second layer (recommended, in priority order)

1. **Make the retrieval RPCs fail-_closed_ on a null owner filter — DONE (2026-07-08, PR #409).**
   `retrieval_owner_matches` now returns no rows when `owner_filter IS NULL`; the app uses the public
   sentinel for legitimate unauthenticated paths. Verify: `npm run check:july8-live-batch`.
2. **Add a CI guard against un-scoped owner tables (cheap, high value) — DONE (2026-07-17).**
   [`scripts/check-owner-scope-api.mjs`](../scripts/check-owner-scope-api.mjs) fails when a
   `src/app/api/**` handler queries an owner-scoped table (any table with an `owner_id` column in
   `supabase/schema.sql`) without a recognised scoping construct in the enclosing handler —
   `.eq('owner_id'`, `withOwnerReadScope`, `requireOwnerScope`, `requireOwnedDocument`/`loadOwnedDocument`,
   a `documents!inner`+`documents.owner_id` join, or an `owner_id:` write payload. Confirmed-safe
   indirect-scope cases live in a documented `OWNER_SCOPE_ALLOWLIST` (today only the two local-origin
   `setup-status` existence probes, §3 / TEN-N1). Wired into `npm run check:owner-scope`,
   `npm run verify:cheap`, and the CI `static-pr` job; regression-locked by
   [`tests/owner-scope-guard.test.ts`](../tests/owner-scope-guard.test.ts). This directly guards the
   regression class the single-layer model is exposed to — a future PR dropping the filter.
3. **Add a live cross-tenant integration test (medium value).** Fixtures for user A + user B; for each
   route family assert B cannot read/mutate A's non-null rows and gets 404/empty. This is the
   regression harness for the exact property the whole model depends on, and it is what would have
   caught any of the (hypothetical) gaps this manual audit looked for.
4. **Full owner-scoped RLS via a per-request user client (larger, do before scaling to many
   mutually-distrusting tenants).** This is the textbook defense-in-depth answer and worth doing before
   the app hosts many independent clinics on shared infrastructure — but it must preserve the
   public-null-owner overlay (policy `OR owner_id IS NULL`), the anonymous public-catalog path, and the
   worker's service-role needs. Sequence it **after** 1–3, which deliver most of the safety at a
   fraction of the cost and risk.

**Bottom line:** the current single-layer enforcement is correct today (0/33 gaps). Item 1 (fail-closed
RPC) is live in the repo (#409); **apply to production** per
[`docs/operator-apply-july8-batch.md`](operator-apply-july8-batch.md). Item 2 (CI owner-scope guard) is
now landed and blocks the regression class in CI. Item 3 (live cross-tenant integration test) closes the
remaining app-layer regression exposure; full RLS (item 4) is justified before multi-tenant scale.

---

## 7. Non-blocking findings

- **TEN-N1 (low):** `setup-status` interpolates a raw Postgres RPC `error.message` into its response
  detail ([setup-status/route.ts:165](src/app/api/setup-status/route.ts)). Worst case is schema-shape
  disclosure (a function/relation name), only to a caller past the local-origin gate. Fix: return a
  generic message; log the raw error server-side.
- **TEN-N2 (latent):** `summarizeDocument(documentId, ownerId?)` has an **optional** `ownerId`
  ([rag.ts:7792](src/lib/rag.ts)) and would skip the owner filter if ever called with `undefined`. The
  only caller passes `user.id` ([summarize/route.ts:34](src/app/api/documents/[id]/summarize/route.ts)),
  so no live exploit — but make the parameter required (or fail closed) so a future caller can't
  reintroduce a gap.
- **TEN-N3 (operator note, intended):** with `NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED=true`, all anonymous
  uploads are pooled under the single configured `PUBLIC_WORKSPACE_OWNER_ID`
  ([upload/route.ts:94](src/app/api/upload/route.ts)) — anonymous X's upload is visible to anonymous Y
  and the workspace owner. This is the documented public-workspace model, not a private-row A→B leak,
  but operators enabling public uploads should understand it.

---

## 8. Method & coverage note

7 auditor agents (one per route family) covered all 33 `src/app/api/**/route.ts` files and their
methods; each traced its RPCs into the SQL. Every load-bearing claim — the `retrieval_owner_matches`
semantics, one representative RPC body, the cache owner-predicate, the purge crons, and the two soft
findings — was **independently re-verified** against source and the live database (project
`sjrfecxgysukkwxsowpy`, region `ap-southeast-2`) before inclusion here. See the companion
**[privacy impact assessment](docs/privacy-impact-assessment.md)** for the data-flow / PHI / cross-border
analysis.
