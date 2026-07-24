# Privacy Impact Assessment — Clinical KB Database

**Status:** Draft for review · **Date:** 2026-07-06 · **Revised:** 2026-07-14
**Scope:** Clinical data flows through the Clinical KB app (Next.js on Railway Singapore + Supabase Sydney + OpenAI), the live Supabase project `Clinical KB Database` (`sjrfecxgysukkwxsowpy`), and the WA private-clinical deployment context.
**Author:** Automated code-level assessment (multi-agent audit of `src/app/api/**`, `src/lib/*`, `supabase/schema.sql`, `supabase/migrations/**`), cross-checked against the live database.

> **This is not legal advice.** It is a technical privacy assessment written to be handed to a
> privacy officer / legal reviewer. Statements about the _Privacy Act 1988_ (Cth), the Australian
> Privacy Principles (APPs) and WA health-records obligations are engineering interpretations that
> must be confirmed by a qualified adviser before the app is used with real patients.

---

## 1. Executive summary

The app is a **clinical knowledge base** — it indexes clinical reference material (guidelines,
drug monographs, protocols) and answers clinician questions over that corpus with retrieval-augmented
generation. It is **not** a patient record system. Provider-backed features do not ask for patient
identifiers. The Safety Plan Generator accepts sensitive identifier-free working content and support
contacts, but keeps them in the current browser tab rather than transmitting or persisting them.

The dominant privacy risk is therefore **incidental PHI**: a clinician will inevitably type patient
details into a free-text query ("42yo F on clozapine 400mg with rising WCC, next step?"). That query
is processed by the Railway application tier in Singapore and can be sent to OpenAI in the United
States for retrieval embedding even when the final answer is source-only. When model-backed answer
synthesis is used, the query and selected excerpts are sent again. The query is hash-redacted before
it is written to log tables in Supabase. A secondary
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

| ID    | Risk      | One-line                                                                                                                                                                                    |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PIA-1 | High      | Overseas processing occurs in Railway Singapore and OpenAI US; the applicable processor/APP 8 basis and final notice wording require governance approval.                                   |
| PIA-2 | High      | Production now fails closed without `RAG_QUERY_HASH_SECRET`; the operator must still place the secret in the deploy host.                                                                   |
| PIA-3 | Mitigated | Generated answer text is omitted from `rag_queries` by default. `RAG_PERSIST_ANSWER_TEXT=true` is explicit opt-in and blocked by production readiness.                                      |
| PIA-4 | Mitigated | Query-miss and bounded response-cache purges were verified active live on 2026-07-14; the duplicate unbounded cache job was removed.                                                        |
| PIA-5 | Medium    | Draft point-of-entry collection notices and a `/privacy` data-processing page ship, but no governance-approved final privacy policy exists (APP 1, APP 5).                                  |
| PIA-6 | Low-Med   | GPT-5.6-and-later models use `prompt_cache_options.ttl="30m"` by default; gpt-5.5 forces the legacy 24h field. Provider controls may retain cached data longer than the configured minimum. |
| PIA-7 | Low       | `RAG_PERSIST_RAW_QUERY_TEXT=true` would store raw PHI query text with no secondary safeguard beyond the 30-day purge.                                                                       |

---

## 2. System overview and data classification

| Data category                                                             | Where it lives                                                                                                                                         | Sensitivity                                | Notes                                                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Clinical reference corpus (documents, chunks, embeddings, images, tables) | Supabase (Sydney) + storage buckets                                                                                                                    | Low–Medium                                 | Published guidelines are not PHI; **uploaded** docs _could_ contain PHI.                                                           |
| Free-text clinical queries                                                | Processed by Railway (Singapore); hashed into Supabase logs (Sydney); sent to OpenAI (US) for retrieval embedding and, when selected, answer synthesis | **High (potential PHI)**                   | The primary incidental-PHI vector; embedding egress can occur even when the final answer is source-only.                           |
| Generated answers                                                         | `rag_queries.answer` (not persisted unless `RAG_PERSIST_ANSWER_TEXT`); short-lived `rag_response_cache.payload`                                        | **High (derived from PHI query + corpus)** | Durable answer log dropped at rest by default (PIA-3); expired cache rows have a bounded hourly purge when `pg_cron` is available. |
| Safety-plan working content                                               | React memory in the current browser tab; user-directed clipboard, print, or PDF output                                                                 | **High (sensitive health information)**    | No patient-identifier field; not sent to the application service or stored by Clinical KB. Exported copies leave this boundary.    |
| User identity                                                             | Supabase Auth (`auth.users`), `owner_id` foreign keys                                                                                                  | Medium (PII)                               | Email + SSO identity; managed by Supabase Auth.                                                                                    |
| Audit trail                                                               | `audit_logs`                                                                                                                                           | Medium                                     | Append-only, service-role-only, retained indefinitely by design.                                                                   |
| Operational telemetry                                                     | `rag_retrieval_logs`, ingestion job tables                                                                                                             | Low–Medium                                 | Redacted query text; per-owner.                                                                                                    |

**Deployment context (from code):** the answer system prompt positions the assistant as _"an
experienced psychiatrist in Perth"_ ([src/lib/rag/rag.ts:7053](src/lib/rag/rag.ts)) — i.e. a **WA psychiatry**
use case. Psychiatric context raises the sensitivity ceiling: mental-health information is squarely
"sensitive information" and "health information" under the _Privacy Act 1988_ (Cth).

---

## 3. Clinical-data flow map

The end-to-end path for a single clinician query. **Bold** nodes are where PHI can land.

```
Clinician browser
   │  POST /api/answer  { query: "<free text, may contain patient details>", ... }
   ▼
[Next.js route — Railway Singapore]  src/app/api/answer/route.ts:70
   │  • auth resolved → access.ownerId (or undefined for anon/public)   :80
   │  • rate-limit bucket "answer"                                       :83
   │  • resolveSearchScope() → owner-scoped candidate document set       :93
   ▼
[RAG pipeline]  answerQuestionWithScope()  src/lib/rag/rag.ts
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
   │      → OpenAI Responses API (Terra fast / Sol strong)              ─┘
   │      store:false; GPT-5.6 prompt_cache_options.ttl:30m
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

The browser request, answer pipeline, and ingestion worker are processed by Railway in Singapore. The
model egress points (A) and (C) then carry query/evidence content to OpenAI in the US. Durable Supabase
data remains in Sydney. Governance must assess both overseas processing paths rather than treating
OpenAI as the only cross-border flow.

The `/safety-plan` route has a separate local-only flow: form inputs update React state in the current
browser tab, with no API request or browser-storage write. Clearing the plan, unmounting the component,
or closing the tab discards that working state. Copy, print, and save-as-PDF are explicit user-directed
exports; the exported copy is outside Clinical KB and must be handled under the organisation's approved
clinical-record process. The tool provides no patient name, date-of-birth, or record-number field and
warns against putting patient identifiers into free text; any patient identifier must be added after
export if local policy permits it. Support-contact names and phone details are accepted as sensitive
working content within the same local-only boundary.

---

## 4. What reaches OpenAI, and under what terms

### 4.1 What is sent

| Payload         | Content                                                                                                                                       | Reference                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Embedding input | **Raw query text**, verbatim (normalized whitespace/case only)                                                                                | [src/lib/openai.ts:498](src/lib/openai.ts) → `embedTexts` :423 |
| Answer input    | **Raw query verbatim** (`Question:\n${args.query}`)                                                                                           | [src/lib/rag/rag.ts:7144](src/lib/rag/rag.ts)                  |
| Answer input    | **Retrieved chunk text** (content, capped ~1800 chars, plus title/page/section/table-facts/captions)                                          | [src/lib/rag/rag.ts:6306-6325](src/lib/rag/rag.ts)             |
| Instructions    | Static system prompt ("experienced psychiatrist in Perth…")                                                                                   | [src/lib/rag/rag.ts:7053](src/lib/rag/rag.ts)                  |
| Metadata        | `{ operation }`; when configured, `safety_identifier` is an HMAC-SHA256 pseudonym of the authenticated owner. The raw owner id is never sent. | [src/lib/openai.ts](src/lib/openai.ts)                         |

The app never _adds_ patient identifiers, but it does not scrub them either: **any PHI the clinician
types into the query, or that exists in an indexed excerpt, is transmitted to OpenAI.**

### 4.2 Handling controls on the OpenAI request

- **Models:** `gpt-5.6-terra` for fast synthesis, summaries, indexing, and vision;
  `gpt-5.6-sol` for strong synthesis; `gpt-5.6-luna` is the documented query-classifier
  rollout target; `text-embedding-3-small` remains the embedding model
  ([src/lib/env.ts](src/lib/env.ts), [.env.example](../.env.example)). Existing deployments
  with explicit model variables remain pinned until their configuration is changed.
- **`store: false`** by default — responses are not retained in OpenAI's dashboard/store
  ([src/lib/openai.ts:220](src/lib/openai.ts), [src/lib/env.ts:55-58](src/lib/env.ts)).
- **GPT-5.6 prompt caching:** the app sends `prompt_cache_options: { ttl: "30m" }`
  unless `OPENAI_PROMPT_CACHE_TTL=off`; it never sends the deprecated
  `prompt_cache_retention` field to GPT-5.6. Explicit pre-5.6 deployments retain the legacy
  `OPENAI_PROMPT_CACHE_RETENTION` behavior ([src/lib/openai.ts](src/lib/openai.ts)). The 30-minute
  value is a minimum cache lifetime, not a guaranteed deletion deadline. See PIA-6.
- **Safety identifier:** when `OPENAI_SAFETY_IDENTIFIER_SECRET` is configured, authenticated
  Responses requests carry a stable HMAC-SHA256 pseudonym. Anonymous and background requests omit
  it, and raw owner identifiers are never sent. Production readiness warns when the secret is absent.
- **No `baseURL` override and no zero-data-retention (ZDR) header** are set in code — the client is a
  plain `new OpenAI({ apiKey, timeout, maxRetries })` ([src/lib/openai.ts:69-73](src/lib/openai.ts)),
  so traffic goes to `api.openai.com` (US) under whatever data-processing terms attach to the API
  **account/organisation**.

### 4.3 Data-processing terms — what code can and cannot tell us

The code shows the _technical_ posture (US endpoint, `store:false`, model-aware prompt-cache
configuration, optional HMAC safety identifier, no ZDR header).
It **cannot** tell us the contractual posture. The following are **operator/legal actions**, not code
facts, and must be confirmed:

- Whether a **Data Processing Addendum (DPA)** / OpenAI Business/Enterprise agreement is in place for
  the account behind `OPENAI_API_KEY`.
- Whether **Zero Data Retention (ZDR)** has been granted for the org and how it applies to the
  configured prompt-cache lifetime.
- OpenAI's standard API commitment (no training on API data by default; limited abuse-monitoring
  retention) — this needs to be pinned to the specific contract, not assumed.

Under **APP 8 (cross-border disclosure)**, the app operator remains accountable for OpenAI's handling
of the disclosed information unless an APP 8.2 exception applies. The corresponding processor/legal
assessment for Railway Singapore must also be recorded. Closing these overseas-processing terms is one
of the most important privacy items before real patient use (PIA-1).

---

## 5. Logging and redaction — per-table verification

All three log tables are **owner-stamped** and **RLS-enabled** (owner-read for authenticated users;
service-role for writes). Redaction is applied centrally at every write site.

| Table                | Raw query stored?     | Redaction mechanism                                                                                                                                                                                                                                 | Other sensitive columns                                                                                                 | RLS                                                       |
| -------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `rag_queries`        | No (hash placeholder) | `queryTextForStorage` / `normalizedQueryTextForStorage` ([query-privacy.ts:33-39](src/lib/query-privacy.ts)); centralized write in `insertRagQuery`                                                                                                 | `answer` is null by default and stored only with explicit `RAG_PERSIST_ANSWER_TEXT=true`; `source_chunk_ids` (own data) | owner-read, [schema.sql:3932](supabase/schema.sql)        |
| `rag_query_misses`   | No (hash placeholder) | same helpers; writes in [search/route.ts:558-559](src/app/api/search/route.ts), [interaction/route.ts:88-89](src/app/api/search/interaction/route.ts)                                                                                               | `metadata.query_hash`                                                                                                   | owner-read, [schema.sql:3935](supabase/schema.sql)        |
| `rag_retrieval_logs` | No (hash placeholder) | same helpers; write at [search/route.ts:556-559](src/app/api/search/route.ts)                                                                                                                                                                       | retrieval telemetry only                                                                                                | owner-read, [schema.sql:3938](supabase/schema.sql)        |
| `audit_logs`         | N/A (no query text)   | action/resource metadata only; the write boundary allowlists operational metadata and excludes user-controlled filenames/titles/content hashes ([audit.ts](../src/lib/audit.ts)). Migration `20260717163000` minimizes existing rows on deployment. | `owner_id`, `action`, `resource_id`                                                                                     | service-role-only, [schema.sql:3959](supabase/schema.sql) |

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

| Data                 | Retention              | Mechanism                                                                                                            | Live status                                                                     |
| -------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `rag_queries`        | 30 days                | `purge_expired_rag_queries(30)`, `pg_cron` `purge-expired-rag-queries` @ 03:30 UTC                                   | **Active** (jobid 11, verified live)                                            |
| `rag_retrieval_logs` | 90 days                | `pg_cron` `purge-rag-retrieval-logs` @ 03:00 UTC                                                                     | **Active** (jobid 12, verified live)                                            |
| `rag_query_misses`   | 90 days                | `purge_expired_rag_query_misses(90)`, `pg_cron` `purge-rag-query-misses` @ 03:45 UTC                                 | **Active** (jobid 13, verified live 2026-07-14)                                 |
| `rag_response_cache` | ~5 min read TTL        | `expires_at` filtered on read; `purge_expired_rag_response_cache(1000)`, hourly `pg_cron` `purge-rag-response-cache` | **Active** (jobid 16, verified live 2026-07-14); obsolete unbounded job removed |
| `audit_logs`         | Indefinite (by design) | Documented in [migration 20260702120000](supabase/migrations/20260702120000_rag_retrieval_logs_retention.sql):8-12   | Intentional; "do not add purge without compliance review"                       |

**Verification (live `cron.job` query, 2026-07-06):**

```
jobid 11  purge-expired-rag-queries    30 3 * * *  active=true  select public.purge_expired_rag_queries(30);
jobid 12  purge-rag-retrieval-logs      0 3 * * *  active=true  delete from public.rag_retrieval_logs where created_at < now() - interval '90 days';
```

So the answer to "_is anything scheduled?_" is **yes** for the two jobs verified on 2026-07-06. Since
that verification, migration `20260708120000_rag_query_misses_retention.sql` added a 90-day query-miss
purge, and migration `20260713201542_consolidate_rag_response_cache_retention.sql` consolidated two
cache purge jobs onto the existing bounded hourly purge. The remaining retention work is:

- **PIA-4 verification:** production was verified on 2026-07-14: migration `20260708120000` runs
  `purge-rag-query-misses` as job 13, and migration `20260713201542` runs the bounded
  `purge-rag-response-cache` as job 16. The obsolete `purge-expired-rag-response-cache` job is absent.
  Repeat this check for any secondary environment that retains real data.
- The purge functions are installed conditionally (`if to_regnamespace('cron') is null then return`,
  [migration 20260629060603](supabase/migrations/20260629060603_rag_queries_retention.sql):27-43) —
  fine on live (pg_cron present) but **preview/branch databases silently skip scheduling**. Not a
  production risk, but worth noting for any secondary environment that retains real data.

---

## 7. Data residency

- **Supabase project region: `ap-southeast-2` (AWS Asia Pacific, Sydney).** Confirmed via the Supabase
  management API for project `sjrfecxgysukkwxsowpy`. All Postgres data (documents, chunks, embeddings,
  logs, auth) and both storage buckets are **onshore in Australia**. This is a strong position for WA
  clinical use and directly supports APP 11 expectations for health information.
- **Railway application and worker: Singapore.** Browser questions, retrieved evidence, generated
  answers, and ingestion material are processed by the Railway services before reads/writes reach
  Supabase Sydney. The operator must record the applicable processor, contract, and APP 8 assessment;
  this technical PIA does not decide the legal classification.
- **OpenAI: United States.** Query text + retrieved excerpts are disclosed to `api.openai.com` (no
  regional endpoint or ZDR configured in code). This is the second overseas processing path and remains
  a central part of the APP 8 assessment (PIA-1).

**Net:** durable Supabase data is Australian; application/worker processing occurs in Singapore; and
OpenAI retrieval embedding plus model-backed inference occur in the US. Embedding egress can happen
even when the final answer is source-only. The approved privacy notice and contractual record must
cover both overseas paths and their purposes.

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

| APP                                       | Obligation                                                                         | Status in this app                                                                                                                                                                                                                                                         | Gap              |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **APP 1** — open & transparent management | Have a clear, up-to-date APP privacy policy                                        | A draft `/privacy` data-processing page ships, but it is explicitly governance-review-required and is not represented as the final approved APP privacy policy                                                                                                             | PIA-5            |
| **APP 3** — collection of sensitive info  | Collect health info only with consent + where reasonably necessary                 | App does not solicit PHI; incidental entry remains possible. “Do not enter patient-identifiable information” notices now appear beside query/upload controls, but no governance-approved consent framework is claimed                                                      | PIA-5            |
| **APP 5** — notification of collection    | Tell individuals what's collected & disclosed (incl. overseas)                     | Draft point-of-entry notices and the `/privacy` page disclose Singapore application processing and model-provider use; final wording and legal/governance approval remain outstanding                                                                                      | PIA-1, PIA-5     |
| **APP 6** — use/disclosure                | Use only for the primary purpose or a permitted secondary purpose                  | Query used for answer generation (primary). Log retention = quality/eval (secondary) — defensible but should be documented                                                                                                                                                 | PIA-5            |
| **APP 8** — cross-border disclosure       | Discloser stays accountable for the overseas recipient unless an exception applies | Railway processing in Singapore and OpenAI processing in the US require documented contractual/legal assessment; OpenAI has no code-visible DPA/ZDR                                                                                                                        | **PIA-1**        |
| **APP 11** — security & destruction       | Reasonable security; destroy/de-identify when no longer needed                     | Strong: Sydney data residency, RLS, private storage, query hashing, default-null answer logs, and live-verified query/log/cache purges. Remaining gaps are operator secret placement, secondary-environment schedule parity, and exceptional answer-persistence governance | PIA-2/4          |
| **NDB scheme** (Pt IIIC)                  | Notify OAIC + individuals of eligible breaches of health info                      | No documented breach-response runbook tied to these tables                                                                                                                                                                                                                 | Recommend adding |

**Overall:** the _engineering_ controls for data-at-rest are strong and largely APP-11-aligned. The
material shortfalls are **governance/contractual** (APP 8 cross-border terms and final approval of the
draft APP 1/5 policy/notice wording) plus the **hardening** items of operator HMAC-secret placement and
retention-schedule parity in any secondary environment that stores real data. Answer prose is omitted by
default; enabling its persistence is an exceptional, non-production mode requiring governance approval.
Anonymous answer caching is disabled. The tenancy review found **zero** confirmed cross-tenant leaks; the
remaining items are compliance-posture and PHI-minimisation gaps.

---

## 10. Gap register (ranked by risk)

### PIA-1 — Overseas Railway/OpenAI processing needs an approved contractual basis and notice **(High)**

- **Risk:** Health/PHI in requests, queries, excerpts, and ingestion material is processed by Railway
  in Singapore. Query text can reach OpenAI in the US for retrieval embedding even when the final
  answer is source-only; model-backed synthesis additionally sends the query and selected excerpts.
  OpenAI has no code-visible contractual data-processing terms. A draft in-product provider disclosure now exists, reducing the
  point-of-entry visibility gap, but it is not governance-approved legal wording → APP 8 accountability
  exposure and a residual APP 5 governance gap.
- **Evidence:** the live app and worker are recorded in Railway Singapore
  ([deployment-architecture.md](deployment-architecture.md)); the OpenAI client uses
  `api.openai.com` ([openai.ts](src/lib/openai.ts)); raw query + excerpts are sent by the RAG pipeline.
- **Fix (ranked):** (1) Record Railway's processor/contractual basis and obtain the applicable APP 8
  determination; execute an OpenAI DPA and, ideally, obtain **ZDR** for the org. (2) Obtain
  governance/legal approval for the shipped draft APP-5 collection/provider
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

### PIA-3 — Generated answers stored un-redacted in `rag_queries` **(Mitigated)**

- **Risk:** The `answer` column held the full generated text, which can restate patient specifics
  echoed from the query; the query itself is hashed but the answer was not. Owner-scoped (not
  cross-tenant) and purged at 30 days, but it was un-redacted PHI-derived content at rest.
- **Fix (shipped):** Answer-text persistence in the durable log is gated behind a dedicated
  `RAG_PERSIST_ANSWER_TEXT` flag (default **off**), applied centrally in `insertRagQuery` via
  `answerTextForStorage` ([query-privacy.ts](src/lib/query-privacy.ts), [rag.ts](src/lib/rag/rag.ts)) so
  every `logRagQuery` caller is covered, and at the promoted-eval-case write in
  [eval-cases/route.ts](src/app/api/eval-cases/route.ts). With the flag off the column is written as
  `null` and each row records `metadata.answer_retained = false`. The offline eval/quality pipeline
  reads the in-memory answer (`logQuery: false`) and never reads this column back
  ([scripts/eval-rag.ts](scripts/eval-rag.ts), [scripts/eval-answer-quality.ts](scripts/eval-answer-quality.ts),
  [scripts/promote-query-misses.ts](scripts/promote-query-misses.ts)), so persistence-off does not
  affect eval — confirming the pipeline has no real dependency on stored answer text. The flag is
  additionally blocked in a production-like environment by `npm run check:production-readiness`.
- **Residual cache copy:** The answer also lands in `rag_response_cache.payload`
  ([rag-cache.ts](src/lib/rag/rag-cache.ts)). Its `expires_at` TTL (`RAG_ANSWER_CACHE_TTL_MS`, default
  5 min) only gates **reads** — `sharedCacheSelector` filters on `expires_at`, while
  `replaceSharedCacheRow` deletes only the _same_ cache key before inserting. Migration
  `20260713201542_consolidate_rag_response_cache_retention.sql` unschedules the duplicate unbounded
  job and keeps one hourly purge capped at 1,000 expired rows per invocation. This keeps
  delete transactions bounded while providing hard cleanup when `pg_cron` is available. Production
  was verified live on 2026-07-14: bounded job 16 is active and the obsolete unbounded job is absent.
- **Historical cleanup:** a migration to null existing `rag_queries.answer` values is prepared but
  intentionally unexecuted pending deployment approval; this assessment does not claim live cleanup.

### PIA-4 — Query-miss and response-cache purges active **(Mitigated)**

- **Risk:** A secondary environment without the retention migrations or `pg_cron` can still accumulate
  hash-redacted misses and expired response-cache payloads.
- **Evidence:** the original 2026-07-06 live check showed only jobids 11/12. The repository now includes
  [migration 20260708120000](supabase/migrations/20260708120000_rag_query_misses_retention.sql), which
  installs a 90-day purge, and
  [migration 20260713201542](supabase/migrations/20260713201542_consolidate_rag_response_cache_retention.sql),
  which installs one bounded hourly response-cache purge when `pg_cron` is available. Production was
  queried live on 2026-07-14: jobids 13 and 16 are active and the obsolete duplicate is absent.
- **Fix:** Repeat the canonical job check for each secondary environment that retains real data.

### PIA-5 — Draft notices/page ship; final approved privacy policy remains outstanding **(Medium)**

- **Risk:** The shipped draft point-of-entry notices and `/privacy` page explain collection, retention,
  and overseas/provider processing, but they are explicitly pending governance review and do not by
  themselves establish an approved APP privacy policy.
- **Fix:** Have governance/legal owners review, amend and approve the draft wording; publish the final
  APP privacy policy and retain the point-of-entry links/notices. Broader retention and breach-response
  documentation also remains outstanding. No legal approval is claimed here.

### PIA-6 — OpenAI prompt-cache lifetime requires contractual confirmation **(Low-Medium)**

- **Risk:** Query + retrieved excerpts can enter OpenAI prompt caches even with `store:false`.
  GPT-5.6 requests a 30-minute TTL by default, but that value is a minimum and is not a contractual
  deletion deadline. Explicit pre-5.6 models can still request the legacy 24-hour retention mode.
- **Evidence:** [openai.ts](src/lib/openai.ts), [.env.example](../.env.example).
- **Fix:** Confirm the effective cache/deletion behavior under the production project's **ZDR** and
  data-residency terms. Keep `OPENAI_PROMPT_CACHE_TTL=off` available when governance requires the app
  to omit the extended GPT-5.6 TTL option; document that provider-default caching policy still applies.

### PIA-7 — `RAG_PERSIST_RAW_QUERY_TEXT=true` stores raw PHI query text **(Low, config-gated)**

- **Risk:** Flipping the flag persists raw queries with only the 30-day purge as a safeguard.
- **Evidence:** [query-privacy.ts:33-47](src/lib/query-privacy.ts), [env.ts:96-99](src/lib/env.ts).
- **Fix:** Keep it **off** in production; if ever enabled, require a documented retention/consent basis
  and consider a shorter purge window for raw-text rows.

---

## 11. Recommendation

Before the app is used with real patients in a WA clinical setting, close **PIA-1** (record the Railway
Singapore processor/APP 8 basis, execute the OpenAI DPA/ZDR basis, and approve the shipped draft APP 5
wording) and **PIA-2** (place
the mandatory HMAC secret in the deploy host's secret store; the fail-closed boot guard is now
enforced in code) as launch-blockers. **PIA-3** is mitigated (the durable `rag_queries.answer` log is no
longer persisted by default; gated behind `RAG_PERSIST_ANSWER_TEXT`); **PIA-4** is mitigated by the
committed query-miss and bounded response-cache purges, verified live on 2026-07-14. Complete the
**PIA-5** residual data-handling documentation. The data-at-rest security posture (Sydney residency,
RLS, private storage, query hashing, automated purge) is already strong and should be highlighted in
the privacy policy as evidence of "reasonable steps" under APP 11.

PIA-3 is mitigated by default-null answer logging. If exceptional non-production answer persistence is
ever enabled, it remains governance-gated. The historical cleanup migration is prepared but unexecuted;
this assessment does not claim live cleanup or legal approval.

See the companion **[tenancy defense-in-depth review](docs/tenancy-defense-in-depth-review.md)** for the
cross-tenant isolation analysis referenced above.
