# Privacy Impact Assessment — Clinical KB Database

**Status:** Draft for review · **Date:** 2026-07-06 · **Branch:** `claude/privacy-tenancy-review`
**Scope:** Clinical data flows through the Clinical KB app (Next.js + Supabase + OpenAI), the live Supabase project `Clinical KB Database` (`sjrfecxgysukkwxsowpy`), and the WA private-clinical deployment context.
**Author:** Automated code-level assessment (multi-agent audit of `src/app/api/**`, `src/lib/*`, `supabase/schema.sql`, `supabase/migrations/**`), cross-checked against the live database.

> **This is not legal advice.** It is a technical privacy assessment written to be handed to a
> privacy officer / legal reviewer. Statements about the _Privacy Act 1988_ (Cth), the Australian
> Privacy Principles (APPs) and WA health-records obligations are engineering interpretations that
> must be confirmed by a qualified adviser before the app is used with real patients.

---

## 1. Executive summary

The app is a **clinical knowledge base** — it indexes clinical reference material (guidelines,
drug monographs, protocols) and answers clinician questions over that corpus with retrieval-augmented
generation. It is **not** a patient record system and, by design, does not ask for patient data.

The dominant privacy risk is therefore **incidental PHI**: a clinician will inevitably type patient
details into a free-text query ("42yo F on clozapine 400mg with rising WCC, next step?"). That query
text is (a) sent to OpenAI in the United States, and (b) written to log tables in Supabase. A secondary
risk is PHI inside **uploaded documents** if users upload anything other than published reference
material.

**What is already good:**

- **Data residency**: the Supabase project runs in **`ap-southeast-2` (AWS Sydney, Australia)** —
  clinical data at rest stays onshore. Confirmed live via the Supabase API (project region
  `ap-southeast-2`).
- **Query redaction**: raw query text is **not** persisted by default. Every log write goes through
  `queryTextForStorage()` which stores a hash placeholder unless `RAG_PERSIST_RAW_QUERY_TEXT=true`
  ([src/lib/query-privacy.ts:33](src/lib/query-privacy.ts)).
- **The M15 HMAC fix is present** ([src/lib/query-privacy.ts:17-23](src/lib/query-privacy.ts)) — the
  stored hash is a keyed HMAC-SHA256 pseudonym **when `RAG_QUERY_HASH_SECRET` is set** (see gap PIA-2).
- **Retention is automated**: nightly `pg_cron` jobs purge `rag_queries` (30d) and
  `rag_retrieval_logs` (90d). **Verified running on live** (both jobs `active = true`).
- **OpenAI response storage is off** by default (`OPENAI_STORE_RESPONSES=false`,
  [src/lib/env.ts:55-58](src/lib/env.ts)).
- Storage buckets are **private**; files are only reachable via short-lived (10 min) server-minted
  signed URLs after an ownership check.

**Top gaps (full register in §10):**

| ID    | Risk      | One-line                                                                                                                                                                        |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PIA-1 | High      | Cross-border disclosure to OpenAI (US) has no code-visible DPA/ZDR. A draft provider disclosure now ships in-product, but its wording lacks governance approval (APP 8, APP 5). |
| PIA-2 | High      | Production now fails closed without `RAG_QUERY_HASH_SECRET`; the operator must still place the secret in the deploy host.                                                       |
| PIA-3 | Mitigated | Generated answer text is omitted from `rag_queries` by default. `RAG_PERSIST_ANSWER_TEXT=true` is explicit opt-in and blocked by production readiness.                          |
| PIA-4 | Medium    | `rag_query_misses` has **no retention/purge job** (only `rag_queries` and `rag_retrieval_logs` do).                                                                             |
| PIA-5 | Medium    | Draft point-of-entry collection notices and a `/privacy` data-processing page ship, but no governance-approved final privacy policy exists (APP 1, APP 5).                      |
| PIA-6 | Low-Med   | OpenAI **prompt-cache retention is forced to 24h** for gpt-5.5 regardless of config — query + retrieved excerpts persist ≤24h at OpenAI.                                        |
| PIA-7 | Low       | `RAG_PERSIST_RAW_QUERY_TEXT=true` would store raw PHI query text with no secondary safeguard beyond the 30-day purge.                                                           |

---

## 2. System overview and data classification

| Data category                                                             | Where it lives                                                                                                                | Sensitivity                                | Notes                                                                                                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Clinical reference corpus (documents, chunks, embeddings, images, tables) | Supabase (Sydney) + storage buckets                                                                                           | Low–Medium                                 | Published guidelines are not PHI; **uploaded** docs _could_ contain PHI.                                                   |
| Free-text clinical queries                                                | Transient in request; hashed into `rag_queries` / `rag_query_misses` / `rag_retrieval_logs`; sent to OpenAI (US)              | **High (potential PHI)**                   | The primary incidental-PHI vector.                                                                                         |
| Generated answers                                                         | `rag_queries.answer` (not persisted unless `RAG_PERSIST_ANSWER_TEXT`); `rag_response_cache.payload` (read-TTL, no purge cron) | **High (derived from PHI query + corpus)** | Durable answer log dropped at rest by default (PIA-3); cache row persists until same-key overwrite (TTL gates reads only). |
| User identity                                                             | Supabase Auth (`auth.users`), `owner_id` foreign keys                                                                         | Medium (PII)                               | Email + SSO identity; managed by Supabase Auth.                                                                            |
| Audit trail                                                               | `audit_logs`                                                                                                                  | Medium                                     | Append-only, service-role-only, retained indefinitely by design.                                                           |
| Operational telemetry                                                     | `rag_retrieval_logs`, ingestion job tables                                                                                    | Low–Medium                                 | Redacted query text; per-owner.                                                                                            |

**Deployment context (from code):** the answer system prompt positions the assistant as _"an
experienced psychiatrist in Perth"_ ([src/lib/rag.ts:7053](src/lib/rag.ts)) — i.e. a **WA psychiatry**
use case. Psychiatric context raises the sensitivity ceiling: mental-health information is squarely
"sensitive information" and "health information" under the _Privacy Act 1988_ (Cth).

---

## 3. Clinical-data flow map

The end-to-end path for a single clinician query. **Bold** nodes are where PHI can land.

```
Clinician browser
   │  POST /api/answer  { query: "<free text, may contain patient details>", ... }
   ▼
[Next.js route]  src/app/api/answer/route.ts:70
   │  • auth resolved → access.ownerId (or undefined for anon/public)   :80
   │  • rate-limit bucket "answer"                                       :83
   │  • resolveSearchScope() → owner-scoped candidate document set       :93
   ▼
[RAG pipeline]  answerQuestionWithScope()  src/lib/rag.ts
   │
   ├──►(A) QUERY EMBEDDING ─────────────────────────────────────────────┐
   │      raw query text → OpenAI embeddings (text-embedding-3-small)    │
   │      src/lib/openai.ts:498 embedText → :453 input:batch            │  ►► OpenAI API
   │                                                                     │     (US region,
   ├──►(B) RETRIEVAL (Supabase RPCs, owner-filtered in SQL)             │      api.openai.com)
   │      match_document_chunks* etc. — Sydney, never leaves AU          │
   │                                                                     │
   ├──►(C) ANSWER SYNTHESIS ─────────────────────────────────────────────┤
   │      **raw query verbatim** ("Question:\n${query}", rag.ts:7144)   │
   │      + **retrieved chunk text** (buildRagSourceBlock, rag.ts:6306) │
   │      + system instructions (rag.ts:7053)                            │
   │      → OpenAI Responses API (gpt-5.5)  openai.ts:384               ─┘
   │      store:false (openai.ts:220); prompt_cache_retention:24h (:168)
   │
   ├──►(D) LOCAL LOGGING (Supabase, Sydney, owner-stamped)
   │      insertRagQuery():  rag.ts:1983
   │        • query           = **hash placeholder** (queryTextForStorage)  ← redacted
   │        • normalized_query= **hash placeholder**                        ← redacted
   │        • answer          = null unless RAG_PERSIST_ANSWER_TEXT         ← dropped at rest (PIA-3)
   │        • source_chunk_ids= real chunk UUIDs                            ← owner's own data
   │        • metadata.query_hash = HMAC/SHA-256 (query-privacy.ts:51)
   │
   └──►(E) RESPONSE CACHE (Supabase rag_response_cache, authenticated owner-scoped)
          payload = full answer, TTL ~5 min (RAG_ANSWER_CACHE_TTL_MS)
          disabled for anonymous answers; authenticated rows are keyed by owner_id
   ▼
Clinician browser  ← answer + citations
```

`/api/search` follows the same shape but writes `rag_queries` / `rag_query_misses` /
`rag_retrieval_logs` (all redacted via the same helpers —
[src/app/api/search/route.ts:450-468, 556-559, 638-643](src/app/api/search/route.ts)).

**The two egress points that carry PHI off-app are (A) and (C) — both to OpenAI in the US.**
Everything in Supabase stays in Sydney.

---

## 4. What reaches OpenAI, and under what terms

### 4.1 What is sent

| Payload         | Content                                                                                              | Reference                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Embedding input | **Raw query text**, verbatim (normalized whitespace/case only)                                       | [src/lib/openai.ts:498](src/lib/openai.ts) → `embedTexts` :423 |
| Answer input    | **Raw query verbatim** (`Question:\n${args.query}`)                                                  | [src/lib/rag.ts:7144](src/lib/rag.ts)                          |
| Answer input    | **Retrieved chunk text** (content, capped ~1800 chars, plus title/page/section/table-facts/captions) | [src/lib/rag.ts:6306-6325](src/lib/rag.ts)                     |
| Instructions    | Static system prompt ("experienced psychiatrist in Perth…")                                          | [src/lib/rag.ts:7053](src/lib/rag.ts)                          |
| Metadata        | `{ operation }` only — **no** owner id, **no** patient identifiers added by the app                  | [src/lib/openai.ts:223](src/lib/openai.ts)                     |

The app never _adds_ patient identifiers, but it does not scrub them either: **any PHI the clinician
types into the query, or that exists in an indexed excerpt, is transmitted to OpenAI.**

### 4.2 Handling controls on the OpenAI request

- **Model:** `gpt-5.5` for answers, `text-embedding-3-small` for embeddings ([src/lib/env.ts:18-27](src/lib/env.ts)).
- **`store: false`** by default — responses are not retained in OpenAI's dashboard/store
  ([src/lib/openai.ts:220](src/lib/openai.ts), [src/lib/env.ts:55-58](src/lib/env.ts)).
- **`prompt_cache_retention: "24h"`** — **forced on for gpt-5.5** regardless of the
  `OPENAI_PROMPT_CACHE_RETENTION` env value ([src/lib/openai.ts:168, 208, 221-222](src/lib/openai.ts)).
  Prompt prefixes (which include retrieved excerpts and can include the query) are cacheable at OpenAI
  for up to 24 hours. See PIA-6.
- **No `baseURL` override and no zero-data-retention (ZDR) header** are set in code — the client is a
  plain `new OpenAI({ apiKey, timeout, maxRetries })` ([src/lib/openai.ts:69-73](src/lib/openai.ts)),
  so traffic goes to `api.openai.com` (US) under whatever data-processing terms attach to the API
  **account/organisation**.

### 4.3 Data-processing terms — what code can and cannot tell us

The code shows the _technical_ posture (US endpoint, `store:false`, 24h prompt cache, no ZDR header).
It **cannot** tell us the contractual posture. The following are **operator/legal actions**, not code
facts, and must be confirmed:

- Whether a **Data Processing Addendum (DPA)** / OpenAI Business/Enterprise agreement is in place for
  the account behind `OPENAI_API_KEY`.
- Whether **Zero Data Retention (ZDR)** has been granted for the org (which would also remove the 24h
  prompt-cache window).
- OpenAI's standard API commitment (no training on API data by default; limited abuse-monitoring
  retention) — this needs to be pinned to the specific contract, not assumed.

Under **APP 8 (cross-border disclosure)**, the app operator remains accountable for OpenAI's handling
of the disclosed information unless an APP 8.2 exception applies. This is the single most important
privacy item to close before real patient use (PIA-1).

---

## 5. Logging and redaction — per-table verification

All three log tables are **owner-stamped** and **RLS-enabled** (owner-read for authenticated users;
service-role for writes). Redaction is applied centrally at every write site.

| Table                | Raw query stored?     | Redaction mechanism                                                                                                                                   | Other sensitive columns                                                                                                 | RLS                                                       |
| -------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `rag_queries`        | No (hash placeholder) | `queryTextForStorage` / `normalizedQueryTextForStorage` ([query-privacy.ts:33-39](src/lib/query-privacy.ts)); centralized write in `insertRagQuery`   | `answer` is null by default and stored only with explicit `RAG_PERSIST_ANSWER_TEXT=true`; `source_chunk_ids` (own data) | owner-read, [schema.sql:3932](supabase/schema.sql)        |
| `rag_query_misses`   | No (hash placeholder) | same helpers; writes in [search/route.ts:558-559](src/app/api/search/route.ts), [interaction/route.ts:88-89](src/app/api/search/interaction/route.ts) | `metadata.query_hash`                                                                                                   | owner-read, [schema.sql:3935](supabase/schema.sql)        |
| `rag_retrieval_logs` | No (hash placeholder) | same helpers; write at [search/route.ts:556-559](src/app/api/search/route.ts)                                                                         | retrieval telemetry only                                                                                                | owner-read, [schema.sql:3938](supabase/schema.sql)        |
| `audit_logs`         | N/A (no query text)   | action/resource metadata only; error strings pass through `redactLogValue` ([privacy.ts:5-31](src/lib/privacy.ts))                                    | `owner_id`, `action`, `resource_id`                                                                                     | service-role-only, [schema.sql:3959](supabase/schema.sql) |

### 5.1 M15 HMAC query-hash fix — verified present, enforced in production

The audit's **M15** remediation is in the code
([src/lib/query-privacy.ts:17-23](src/lib/query-privacy.ts)):

```ts
export function hashQueryText(query: string) {
  const normalized = normalizeQueryText(query);
  if (env.RAG_QUERY_HASH_SECRET) {
    return createHmac("sha256", env.RAG_QUERY_HASH_SECRET).update(normalized).digest("hex"); // keyed pseudonym
  }
  return createHash("sha256").update(normalized).digest("hex"); // legacy unsalted fallback
}
```

- **When `RAG_QUERY_HASH_SECRET` is set:** the stored hash is a keyed HMAC-SHA256 — not
  offline-reversible, not correlatable outside this deployment. ✔ This is the intended fix.
- **When it is unset:** the code **silently falls back to unsalted SHA-256**. A short, low-entropy
  clinical query ("john smith clozapine") is then **dictionary-reversible** — an attacker (or a
  curious insider) with read access to the log tables can hash candidate patient/drug strings offline
  and match rows, and can correlate the same query across rows. This defeats the redaction it is
  meant to provide.

**Status (PIA-2 — enforcement landed):** production now **fails closed** when the secret is absent.
`requireQueryHashSecret()` ([src/lib/env.ts](src/lib/env.ts)) throws at server startup
([src/instrumentation.ts](src/instrumentation.ts)) when `NODE_ENV=production` and
`RAG_QUERY_HASH_SECRET` is unset, so a misconfigured clinical server refuses to boot rather than
degrade to the unsalted digest. `npm run check:production-readiness` additionally asserts the boot
guard is wired into the startup path and that the secret is present, and
[tests/instrumentation.test.ts](tests/instrumentation.test.ts) /
[tests/env-query-hash-secret.test.ts](tests/env-query-hash-secret.test.ts) cover the fail-closed
behaviour. The schema stays `z.string().min(16).optional()` so dev/CI keep the legacy digest for
stored-row joins. **Remaining operator action:** place the secret in the deploy host's secret store —
the guard and assertion enforce its presence but cannot supply it.

### 5.2 Redaction helper coverage

`redactLogValue` / `safeErrorLogDetails` ([src/lib/privacy.ts](src/lib/privacy.ts)) strip paths,
URLs, secrets (incl. `sb_secret_` / `sb_publishable_`), and emails from error details before they are
logged, and `redactCaptionIdentifiers` strips emails/MRN/NHS-style ids/phone numbers from image
captions ([privacy.ts:59-74](src/lib/privacy.ts)). These are sound as far as they go, but they are
**pattern-based** and do not attempt to redact free-text clinical narrative (names in prose, etc.) —
which is why the query-hash approach (not raw storage) is the right primary control.

---

## 6. Retention and purge

| Data                 | Retention              | Mechanism                                                                                                          | Live status                                                       |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `rag_queries`        | 30 days                | `purge_expired_rag_queries(30)`, `pg_cron` `purge-expired-rag-queries` @ 03:30 UTC                                 | **Active** (jobid 11, verified live)                              |
| `rag_retrieval_logs` | 90 days                | `pg_cron` `purge-rag-retrieval-logs` @ 03:00 UTC                                                                   | **Active** (jobid 12, verified live)                              |
| `rag_query_misses`   | **None**               | —                                                                                                                  | **No purge job** — see PIA-4                                      |
| `rag_response_cache` | ~5 min TTL (soft)      | `expires_at` filtered on read; overwritten per query                                                               | Rows expire logically; no hard purge cron (low volume, short TTL) |
| `audit_logs`         | Indefinite (by design) | Documented in [migration 20260702120000](supabase/migrations/20260702120000_rag_retrieval_logs_retention.sql):8-12 | Intentional; "do not add purge without compliance review"         |

**Verification (live `cron.job` query, 2026-07-06):**

```
jobid 11  purge-expired-rag-queries    30 3 * * *  active=true  select public.purge_expired_rag_queries(30);
jobid 12  purge-rag-retrieval-logs      0 3 * * *  active=true  delete from public.rag_retrieval_logs where created_at < now() - interval '90 days';
```

So the answer to "_is anything scheduled?_" is **yes** — the two query-log purges are live and active.
The retention story is sound **except**:

- **PIA-4:** `rag_query_misses` (which stores the same hashed-query + metadata as `rag_queries`) has
  **no** purge job — it accumulates indefinitely. It should get a matching 30–90 day cron.
- The purge functions are installed conditionally (`if to_regnamespace('cron') is null then return`,
  [migration 20260629060603](supabase/migrations/20260629060603_rag_queries_retention.sql):27-43) —
  fine on live (pg_cron present) but **preview/branch databases silently skip scheduling**. Not a
  production risk, but worth noting for any secondary environment that retains real data.

---

## 7. Data residency

- **Supabase project region: `ap-southeast-2` (AWS Asia Pacific, Sydney).** Confirmed via the Supabase
  management API for project `sjrfecxgysukkwxsowpy`. All Postgres data (documents, chunks, embeddings,
  logs, auth) and both storage buckets are **onshore in Australia**. This is a strong position for WA
  clinical use and directly supports APP 8 / APP 11 expectations for health information.
- **OpenAI: United States.** Query text + retrieved excerpts are disclosed to `api.openai.com` (no
  regional/EU endpoint or ZDR configured in code). This is the **only** cross-border flow, and it is
  the crux of the APP 8 assessment (PIA-1).

**Net:** data _at rest_ is Australian; data _in transit for inference_ crosses to the US. A privacy
notice must disclose the OpenAI disclosure and its purpose.

---

## 8. Storage-bucket access paths

- Buckets `clinical-documents` and `clinical-images` are **private**
  ([docs/multi-user-auth-setup.md](docs/multi-user-auth-setup.md) §7).
- No direct client storage access. Files are served only via **server-minted signed URLs** with a
  **10-minute TTL** (`signedUrlTtlSeconds = 60 * 10`,
  [documents/[id]/signed-url/route.ts:14](src/app/api/documents/[id]/signed-url/route.ts),
  [images/[id]/signed-url/route.ts:15](src/app/api/images/[id]/signed-url/route.ts)).
- Every signed-URL mint is **preceded by an ownership check** on the parent document row
  (`withOwnerReadScope(...)` before `createSignedUrl`,
  [documents/[id]/signed-url/route.ts:40-51](src/app/api/documents/[id]/signed-url/route.ts)) — see the
  companion tenancy review for the adversarial verification.
- Storage objects are namespaced by owner (`${uploadOwnerId}/documents/${documentId}/...`,
  [upload/route.ts:134](src/app/api/upload/route.ts)), and the DB additionally carries owner-scoped
  storage RLS policies ([schema.sql:3967-3973](supabase/schema.sql)) as a backstop for any future
  client-direct access.

Signed-URL handling is well-scoped. The residual consideration is only that a 10-minute URL, once
minted, is bearer-usable by anyone it is shared with in that window — acceptable for this use case.

---

## 9. Assessment against Australian Privacy Act / WA health obligations

**Framework.** Private-sector health service providers are **APP entities regardless of turnover** —
the small-business exemption does **not** apply where health services are provided and health
information is handled (_Privacy Act 1988_ (Cth), s6D(4)(b)). Health/mental-health information is
**"sensitive information"** attracting the highest APP protections. WA has no equivalent of Victoria's
_Health Records Act 2001_ or NSW's _HRIP Act 2002_ for the private sector; the _Privacy Act_ + APPs are
the operative framework for a WA private clinician. (The WA _Privacy and Responsible Information Sharing
Act 2024_ targets WA **public-sector** entities and may apply to public-health deployments — confirm
with counsel if this is deployed inside a WA Health service.)

| APP                                       | Obligation                                                                         | Status in this app                                                                                                                                                                                                                                                      | Gap              |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **APP 1** — open & transparent management | Have a clear, up-to-date APP privacy policy                                        | A draft `/privacy` data-processing page ships, but it is explicitly governance-review-required and is not represented as the final approved APP privacy policy                                                                                                          | PIA-5            |
| **APP 3** — collection of sensitive info  | Collect health info only with consent + where reasonably necessary                 | App does not solicit PHI; incidental entry remains possible. “Do not enter patient-identifiable information” notices now appear beside query/upload controls, but no governance-approved consent framework is claimed                                                   | PIA-5            |
| **APP 5** — notification of collection    | Tell individuals what's collected & disclosed (incl. overseas)                     | Draft point-of-entry notices and the `/privacy` page disclose data processing and provider use; final wording and legal/governance approval remain outstanding                                                                                                          | PIA-1, PIA-5     |
| **APP 6** — use/disclosure                | Use only for the primary purpose or a permitted secondary purpose                  | Query used for answer generation (primary). Log retention = quality/eval (secondary) — defensible but should be documented                                                                                                                                              | PIA-5            |
| **APP 8** — cross-border disclosure       | Discloser stays accountable for the overseas recipient unless an exception applies | Disclosure to OpenAI (US); no code-visible DPA/ZDR; accountability unclear                                                                                                                                                                                              | **PIA-1**        |
| **APP 11** — security & destruction       | Reasonable security; destroy/de-identify when no longer needed                     | Strong: Sydney residency, RLS, private storage, query hashing, default-null answer logs, 30/90-day purge. Remaining gaps are operator secret placement, exceptional answer-persistence governance, `rag_response_cache` expiry cleanup, and PIA-4 (misses never purged) | PIA-2/4          |
| **NDB scheme** (Pt IIIC)                  | Notify OAIC + individuals of eligible breaches of health info                      | No documented breach-response runbook tied to these tables                                                                                                                                                                                                              | Recommend adding |

**Overall:** the _engineering_ controls for data-at-rest are strong and largely APP-11-aligned. The
material shortfalls are **governance/contractual** (APP 8 cross-border terms and final approval of the
draft APP 1/5 policy/notice wording) plus the
**hardening** items of operator HMAC-secret placement and query-miss/cache retention. Answer prose is omitted by default;
enabling its persistence is an exceptional, non-production mode requiring governance approval. Anonymous answer caching
is disabled. The tenancy review found **zero** confirmed cross-tenant leaks; the remaining items are compliance-posture
and PHI-minimisation gaps.

---

## 10. Gap register (ranked by risk)

### PIA-1 — Cross-border disclosure to OpenAI lacks visible DPA/ZDR + notice **(High)**

- **Risk:** Health/PHI in queries and excerpts is disclosed to OpenAI (US) with no code-visible
  contractual data-processing terms. A draft in-product provider disclosure now exists, reducing the
  point-of-entry visibility gap, but it is not governance-approved legal wording → APP 8 accountability
  exposure and a residual APP 5 governance gap.
- **Evidence:** plain client to `api.openai.com` ([openai.ts:69-73](src/lib/openai.ts)); raw query +
  excerpts sent ([rag.ts:7144, 6306](src/lib/rag.ts)); no ZDR/baseURL.
- **Fix (ranked):** (1) Execute an OpenAI DPA and, ideally, obtain **ZDR** for the org; record it in
  `docs/`. (2) Obtain governance/legal approval for the shipped draft APP-5 collection/provider
  disclosure and final privacy policy. (3) Retain the shipped on-query/upload PHI reminder.
  (4) Optionally, add a lightweight PHI-scrub / entity-strip on the outbound query as defence-in-depth.
- **Progress (2026-07-13):** fixes (2)+(3) are **live on `main`** via PR #513
  ([src/app/privacy/page.tsx](src/app/privacy/page.tsx), composer notice), as draft wording pending
  governance approval. Fix (1),
  the contractual basis, is captured decision-ready
  in **[docs/openai-cross-border-basis.md](docs/openai-cross-border-basis.md)**, which also records that
  the app's egress endpoints (`/v1/responses`, `/v1/embeddings`) are **ZDR-eligible** and that OpenAI now
  offers **Australia data residency** (storage) — an option that postdates this PIA. The remaining step
  (execute DPA / apply ZDR / counsel sign-off) is operator/legal, not code.

### PIA-2 — Query-hash HMAC silently downgrades without the secret **(High — enforcement landed)**

- **Risk:** If `RAG_QUERY_HASH_SECRET` is unset in prod, stored query hashes are unsalted SHA-256 →
  dictionary-reversible and cross-row correlatable, defeating the redaction (undoes M15).
- **Evidence:** [query-privacy.ts:17-23](src/lib/query-privacy.ts); the secret is
  `z.string().min(16).optional()` in [env.ts](src/lib/env.ts).
- **Fix (landed):** `requireQueryHashSecret()` now makes the secret **mandatory in production** — it
  fails closed at startup ([instrumentation.ts](src/instrumentation.ts)) when `NODE_ENV=production` and
  the secret is missing, mirroring the `requireServerEnv` pattern. `check:production-readiness` asserts
  the boot guard is wired in and the secret is present; covered by
  [instrumentation.test.ts](tests/instrumentation.test.ts) and
  [env-query-hash-secret.test.ts](tests/env-query-hash-secret.test.ts).
- **Remaining (operator):** place `RAG_QUERY_HASH_SECRET` in the deploy host's secret store on the live
  project (the code enforces its presence but cannot supply the value).

### PIA-3 — Generated answers stored un-redacted in `rag_queries` **(Resolved)**

- **Risk:** The `answer` column held the full generated text, which can restate patient specifics
  echoed from the query; the query itself is hashed but the answer was not. Owner-scoped (not
  cross-tenant) and purged at 30 days, but it was un-redacted PHI-derived content at rest.
- **Fix (shipped):** Answer-text persistence in the durable log is gated behind a dedicated
  `RAG_PERSIST_ANSWER_TEXT` flag (default **off**), applied centrally in `insertRagQuery` via
  `answerTextForStorage` ([query-privacy.ts](src/lib/query-privacy.ts), [rag.ts](src/lib/rag.ts)) so
  every `logRagQuery` caller is covered, and at the promoted-eval-case write in
  [eval-cases/route.ts](src/app/api/eval-cases/route.ts). With the flag off the column is written as
  `null` and each row records `metadata.answer_retained = false`. The offline eval/quality pipeline
  reads the in-memory answer (`logQuery: false`) and never reads this column back
  ([scripts/eval-rag.ts](scripts/eval-rag.ts), [scripts/eval-answer-quality.ts](scripts/eval-answer-quality.ts),
  [scripts/promote-query-misses.ts](scripts/promote-query-misses.ts)), so persistence-off does not
  affect eval — confirming the pipeline has no real dependency on stored answer text. The flag is
  additionally blocked in a production-like environment by `npm run check:production-readiness`.
- **Residual (scoped out):** The answer also lands in `rag_response_cache.payload`
  ([rag-cache.ts](src/lib/rag-cache.ts)). Its `expires_at` TTL (`RAG_ANSWER_CACHE_TTL_MS`, default
  5 min) only gates **reads** — `sharedCacheSelector` filters on `expires_at`, while
  `replaceSharedCacheRow` deletes only the _same_ cache key before inserting, and there is **no hard
  purge cron** (see the retention table in §8). So an expired row is not destroyed: a one-off query's
  answer can persist at rest until a same-key overwrite or a manual invalidation. Nulling the payload
  would defeat caching, so it is intentionally not gated by this flag; bounding it properly needs a
  scheduled purge (a PIA-4-style follow-up). This is distinct from — and not covered by — the 30-day
  durable-log fix above.
- **Historical cleanup:** a migration to null existing `rag_queries.answer` values is prepared but
  intentionally unexecuted pending deployment approval; this assessment does not claim live cleanup.

### PIA-4 — `rag_query_misses` never purged **(Medium)**

- **Risk:** Hashed-query rows accumulate indefinitely; retention policy is inconsistent with
  `rag_queries`/`rag_retrieval_logs`.
- **Evidence:** live `cron.job` has no miss-table purge; only jobids 11/12 exist.
- **Fix:** Add a `pg_cron` purge for `rag_query_misses` (30–90 days) mirroring
  [migration 20260702120000](supabase/migrations/20260702120000_rag_retrieval_logs_retention.sql).

### PIA-5 — Draft notices/page ship; final approved privacy policy remains outstanding **(Medium)**

- **Risk:** The shipped draft point-of-entry notices and `/privacy` page explain collection, retention,
  and overseas/provider processing, but they are explicitly pending governance review and do not by
  themselves establish an approved APP privacy policy.
- **Fix:** Have governance/legal owners review, amend and approve the draft wording; publish the final
  APP privacy policy and retain the point-of-entry links/notices. Broader retention and breach-response
  documentation also remains outstanding. No legal approval is claimed here.

### PIA-6 — OpenAI prompt-cache retention forced to 24h **(Low-Medium)**

- **Risk:** Query + retrieved excerpts persist at OpenAI for ≤24h via prompt caching even with
  `store:false`; not operator-tunable for gpt-5.5.
- **Evidence:** [openai.ts:168, 208, 221-222](src/lib/openai.ts).
- **Fix:** Resolve via **ZDR** (removes the window) as part of PIA-1; document the 24h window in the
  meantime. If a shorter window becomes configurable, expose it.

### PIA-7 — `RAG_PERSIST_RAW_QUERY_TEXT=true` stores raw PHI query text **(Low, config-gated)**

- **Risk:** Flipping the flag persists raw queries with only the 30-day purge as a safeguard.
- **Evidence:** [query-privacy.ts:33-47](src/lib/query-privacy.ts), [env.ts:96-99](src/lib/env.ts).
- **Fix:** Keep it **off** in production; if ever enabled, require a documented retention/consent basis
  and consider a shorter purge window for raw-text rows.

---

## 11. Recommendation

Before the app is used with real patients in a WA clinical setting, close **PIA-1** (execute the
cross-border DPA/ZDR contractual basis and approve the shipped draft APP 5 wording) and **PIA-2** (place
the mandatory HMAC secret in the deploy host's secret store; the fail-closed boot guard is now
enforced in code) as launch-blockers. **PIA-3** is closed (the durable `rag_queries.answer` log is no
longer persisted by default; gated behind `RAG_PERSIST_ANSWER_TEXT`); **PIA-4** remains as a fast
follow-up (purge `rag_query_misses`, and add a `rag_response_cache` purge cron), and complete the
**PIA-5** residual data-handling documentation. The data-at-rest security posture (Sydney residency,
RLS, private storage, query hashing, automated purge) is already strong and should be highlighted in
the privacy policy as evidence of "reasonable steps" under APP 11.

PIA-3 is mitigated by default-null answer logging. If exceptional non-production answer persistence is
ever enabled, it remains governance-gated. The historical cleanup migration is prepared but unexecuted;
this assessment does not claim live cleanup or legal approval.

See the companion **[tenancy defense-in-depth review](docs/tenancy-defense-in-depth-review.md)** for the
cross-tenant isolation analysis referenced above.
