# Latency Audit — Clinical KB Database

**Date:** 2026-07-28
**Branch:** `claude/latency-audit-f1cbcd` (worktree `prompt-skill-improvements-7d5f80`), base 1 commit behind `origin/main` (`ea6d2d954`, mockups-only — no latency surface)
**Method:** Three read-only reconnaissance sweeps (server request path / client-browser path / database + prior-work), then line-level verification of every load-bearing claim by the primary author. Four planned remediations were **retired during verification** because the evidence did not support them — recorded under "Retired during verification" rather than silently dropped.
**Scope:** Latency only. Full server request path, client first-paint path, database/RPC surface, and the ingestion/worker path where it bounds a user-visible wait. Excludes correctness, security, and clinical-governance findings except where they _gate_ a latency fix.
**Guardrail posture:** Obeys (1) the `src/lib/rag/**` FLAG + `RAG impact:` rule and its live-canary requirement for behaviour change; (2) ledger `#017`, which gates client payload work behind measured Web-Vitals evidence; (3) `docs/capacity-review.md:123-125` explicit non-actions; (4) the provider-confirmation boundary — no OpenAI/Supabase/hosted-CI call was made.

---

## Status on `main` (added 2026-07-29)

This audit was first proposed as **PR #1312**, which was **closed unmerged** on 2026-07-28 with
the note: _"The unsafe additive-index migration lacked synchronized schema/drift proof;
compatible latency work is already on main."_ The first clause was correct. The second was not —
verification on `6021f6d` found that **none** of the six "Applied in this pass" changes had
reached `main`, and this document was not on `main` either, so its follow-ups were untracked.

The 2026-07-29 pass re-lands the free- and flag-gated work with tests and files the remainder in
`docs/outstanding-issues.md` as `#098`–`#105`. Two deliberate departures from the original pass:

- **No migration ships.** L2-3's bare-column trigram indexes and L2-5's composite are authored
  as reviewed operator SQL in [`operator-apply-performance-latency-remediation.md`](../operator-apply-performance-latency-remediation.md)
  instead of `supabase/migrations/*.sql`. `supabase/**` is untouched, so no drift manifest needs
  regenerating and the objection that closed PR #1312 cannot recur. Tracked as `#102`.
  **Caveat added 2026-07-29 (review):** deferring the migration is not the same as not needing
  one. `migrations/` is the source of truth and `schema.sql` only a mirror, so hand-run operator
  SQL reaches the live database and nothing else — staging, disaster-recovery replay and
  `supabase db reset` all stay without the indexes. Authoring the migration is therefore a
  required part of `#102`, not an optional extra.
- **L4-2 is retracted.** See the correction in the L4 section below — it is not an open finding.

Ledger IDs in the body below are the 2026-07-29 numbers. The original draft used `#085`–`#092`;
those IDs were taken by unrelated items before this landed.

---

## Result summary

|                                     | Count                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------- |
| **Open findings**                   | **24** (25 as first written; L4-2 retracted)                           |
| By tier                             | L0 **1** · L1 **5** · L2 **9** · L3 **8** · L4 **1**                   |
| Already fixed — recorded, not filed | **16** (tier L5)                                                       |
| Deliberate design, not defects      | **5** (tier L6, including the retracted L4-2)                          |
| By gate                             | free **5** · flag **2** · `#017` **7** · canary **6** · operator **4** |
| Applied (2026-07-29 pass)           | **7** ("Applied")                                                      |
| Retired during verification         | **4** ("Retired during verification")                                  |

The dominant theme is **not inefficiency — it is delivery architecture**. The single largest
contributor to perceived answer latency is that a fully-verified answer is delivered in one frame
at the end of generation, so time-to-first-content equals total latency. Every other finding in
this report, summed, is roughly one order of magnitude smaller than the window that one design
choice creates. The second theme is that the repo's own telemetry could not see the preamble: the
route the UI actually calls emitted no `Server-Timing` at all.

---

## How to read this report

Severity is computed from three axes. **Gate cost is deliberately excluded from severity** — it
sets action order only. Keeping them separate is the point: the failure mode this repo is prone
to is letting "what am I allowed to touch" quietly reorder "what hurts the clinician".

| Axis                 | Values                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **A · Wait class**   | `P` clinician blocked watching a spinner · `S` secondary interactive path · `C` cold-start/build/ingestion                                   |
| **B · Evidence**     | `measured` (telemetry or hosted numbers exist) · `arithmetic` (round-trip count × a measured RT distribution) · `inferred` (code shape only) |
| **C · Cost shape**   | `fixed` every request pays · `multiplicative` scales with corpus/results · `once` per process                                                |
| **D · Gate** (order) | `free` · `flag` (`src/lib/rag/**` glob → FLAG + `RAG impact:` line) · `#017` · `canary` (provider $, approval) · `operator`                  |

`B` exists because this repo has already spent effort on inferred latency claims that hosted
profiling refuted — ledger `#069` closed with warm p90 175–243 ms and the conclusion _"plans are
not the multi-second tail."_ Every finding below carries its grade so that cannot recur.

Tiers: **L0** structural · **L1** fixed per-request answer-path overhead · **L2** scale-dependent
answer-path overhead · **L3** client first-paint · **L4** cold-start/ingestion · **L5**
measured-and-cleared · **L6** deliberate.

---

## L0 — Structural (1)

### L0-1 · Buffered generation delivered in a single frame: time-to-first-content == total latency

`src/lib/openai.ts:465-481`, `src/app/api/answer/stream/route.ts:231-260` · `A=P B=measured C=fixed` · gate=**canary + clinical governance**

- **Evidence.** `src/lib/openai.ts:465` states it outright: _"Buffered (non-streaming) request — the baseline behaviour."_ Only `client.responses.create` / `.parse` are ever called — never `.stream`, never `stream: true`. `stream/route.ts` awaits the entire answer and emits it in **one** `final` SSE frame. The SSE transport exists and carries `progress` events, but no answer text flows until generation completes.
- **Cost model.** Route budgets are extractive 12 s / fast 25 s / strong 35 s (`src/lib/rag/rag-route-budget.ts:3-8`); SLOs are fast ≤ 10 s / strong ≤ 25 s (`docs/observability-slos.md:37-38`); recent answer canaries recorded p95 **17,003 ms** and a final-gate p95 of **7,494 ms**. Because there is exactly one content frame, a strong answer that is _perfectly inside SLO_ still shows the clinician a blank panel for up to 25 s. **The SLO can be met while the experience is a blank panel** — the metric and the wait have been allowed to diverge.
- **The repo has already conceded this in code.** `src/lib/sse-heartbeat.ts` sends a comment frame every **15 s** because generation _"legitimately goes silent for stretches."_ A 15 s keepalive is only necessary if the silent window routinely exceeds 15 s. The heartbeat is not a fix; it is instrumentation of the defect.
- **Why the obvious fix is refused.** `src/lib/answer-stream-contract.ts:18-21` deliberately excludes the legacy `token` and `revising` events: _"A new client can be routed to an older server during a rolling deployment, so accepting those events would re-expose unvalidated clinical prose."_ Token streaming **existed here and was removed as a clinical-safety control.** It is corroborated by the post-generation pipeline every answer must clear — `sanitizeCitations`, `sanitizeAnswerText`/`sanitizeStructuredText`, `applyNumericVerification`/`unboldUnverifiedNumbers`, `sanitizeQuoteCards`, `assessAndEnforceClaimSupport` — over a `responses.parse` structured object. Forwarding raw tokens would bypass the numeric-faithfulness gate the 2026-07-01 audit filed as H1.
- **Only admissible shape.** Progressive disclosure of _already-verified units_: emit retrieval-complete evidence and sources first, then each answer section after **that section** clears verification, over the existing whitelisted `progress` event — never a reintroduced `token`. Needs a clinical-governance decision plus a canary pair.
- **Risk if wrong.** Re-landing token streaming would reintroduce a hazard this repo removed on purpose. Filed as ledger `#100` with the refutation recorded so a future agent cannot rediscover the "obvious" fix.

---

## L1 — Fixed per-request overhead on the answer/search path (5)

### L1-1 · Cache-hit paths pay an uncached `documents` round trip before responding

`src/lib/rag/rag.ts:3234`, `src/lib/rag/rag-cache.ts:189,334` · `A=P B=arithmetic C=fixed` · gate=**flag** · **APPLIED (narrowed)**

- **Evidence.** `setCachedAnswer` and `setCachedSearch` both call `await cacheIndexingVersion(args, { forceRefresh: true })`, deliberately bypassing their own 5 s stamp cache (`cacheIndexingVersionTtlMs = 5000`). At `rag.ts:3234` a **shared-cache hit** — the fastest path in the system — awaited `setCachedAnswer` _before responding_, so serving a cached answer required a fresh `documents` query first. Eight `setCachedSearch` awaits do the same on terminal retrieval branches (`rag.ts:2379,2421,2489,2538,2664,2692,2891,2984`).
- **`forceRefresh` is load-bearing — do not remove it.** `rag-cache.ts:190` compares the fresh stamp against `indexingVersionAtRetrievalStart` and **drops the write** if the corpus moved mid-request. That is a staleness guard, not sloppiness. The only admissible transform is deferral.
- **Applied.** `rag.ts:3234` only. The deferral is provably safe there: `annotateSearchResults` is pure (`evidence-relevance.ts:302-307` maps to new objects), the response payload is spread into a new object, `cloneAnswer` is `structuredClone`, and nothing else holds a reference to `sharedCachedAnswer` — so the deferred clone captures exactly what an awaited call would have. The constraint is now documented on `setCachedAnswer` itself.
- **Not applied — the 8 `setCachedSearch` sites.** Two blockers: `setCachedSearch` calls `throwIfAborted(args.signal)` twice, so deferring changes abort semantics; and it clones `results` **after** an `await`, so deferring widens an existing mutation window on arrays that stay live downstream. Discharging that across 8 branches needs tracing this repo's own record says offline review cannot settle. Filed as `#099`.

### L1-2 · Sequential, unbudgeted preamble before any deadline exists

`src/app/api/answer/route.ts` · `A=P B=arithmetic C=fixed` · gate=**free** · **APPLIED (`/api/answer`)**

- **Evidence.** `publicAccessContext` (auth round trip) → `consumeSubjectApiRateLimit` (Supabase RPC) → `resolveSearchScope` (0–N Supabase round trips) ran strictly sequentially, and all three completed **before** `createAnswerRouteDeadline` existed — bounded only by client abort. `resolveSearchScope` was called without `signal`, so its queries never received `.abortSignal(...)` despite `search-scope.ts:200,327` supporting it.
- **Applied — the missing abort signal only.** `resolveSearchScope` is now called with `signal: request.signal`, so a client disconnect cancels its paginated queries. `search-scope.ts:200,328` had always supported `.abortSignal(...)`; this route simply never passed one. The `scope` stage is also now reported in `Server-Timing`.
- **REFUTED — the overlap itself (corrected 2026-07-29, PR #1377 review).** The concurrent version was written and shipped for review, then removed. It started `resolveSearchScope` alongside the rate-limit RPC and aborted it on deny, on the claim that "the limiter can still deny for free". **That claim is false.** Whenever the caller sends filters or explicit document ids, scope passes its zero-query early returns (`search-scope.ts:242,253`) and enters the paginated `documents` loop at `:269` plus the nested label loop. An `AbortSignal` cancels the client request; it does not un-execute a statement Postgres has already begun. So a throttled caller kept spending database capacity while collecting 429s — and `filters` is caller-controlled, so this is reachable deliberately, not only by accident. That is the opposite of what admission control exists for, and the wrong direction against `capacity-review.md:106-113`, which names Postgres CPU under concurrency the **first soft failure** — the very reason this audit argues round-trip reduction has capacity value. Scope now sits behind admission again, pinned by `tests/answer-route-preamble.test.ts`, which fails against the overlapping shape.
- **What would make the overlap admissible.** A non-database admission gate ahead of the durable limiter, so a denied request is rejected before any Supabase work is dispatched. That is new state with its own correctness questions and is not a latency-pass change — carried in `#099`.
- **Irreducible.** Auth → rate-limit is a genuine data dependency (`consumeSubjectApiRateLimit` needs `access.rateLimitSubject`), and scope must now follow admission, so the preamble is fully sequential by design.
- **Not applied — the stream route.** There, scope already runs _inside_ the stream after `sendProgress({stage:"scoping"})`, so it is not blocking the first byte in the same way; auth and rate-limit remain pre-stream by necessity.
- **Report-only — extending deadline coverage over the preamble.** That changes _which_ requests get cancelled, converting some slow-but-successful answers into timeouts. Answer-path behaviour; do not change budget numbers in a latency pass.

### L1-3 · Two independent identity resolutions per authenticated request

`src/proxy.ts:125`; `src/lib/public-api-access.ts:135` → `src/lib/supabase/auth.ts:187-204` · `A=P B=inferred C=fixed` · gate=**free but not actionable in-process**

- **Evidence.** `proxy.ts:125` awaits `supabase.auth.getClaims()` on every matched request — the matcher excludes only static assets, so **every `/api/*` call** is included. Each public API route then independently resolves identity via `getOptionalAuthenticatedUser`, and `auth.ts:161` constructs a **fresh `createServerClient` per request**, with no caching of the resolved user.
- **Correction to the first-pass finding.** `proxy.ts:102-105` short-circuits when no `sb-` cookie is present, so **anonymous traffic pays nothing here**, and `getClaims()` may be local JWKS verification rather than a network call depending on the project's JWT signing algorithm. The accurate claim is _two independent identity resolutions per authenticated request, at least one of which (`getUser`) always contacts the Auth server_ — not "always two network round trips".
- **Why no memo was added.** Verified: every route resolves identity **exactly once per HTTP method handler** — the multi-call files have one call per `GET`/`POST`/`PATCH`/`DELETE`, never two per request. The real duplication spans the proxy and the route handler, which are separate invocations holding **different `Request` objects**, so no in-process memo can bridge them. A memo would dedupe nothing.
- **Capacity relevance.** `docs/capacity-review.md:106-113` names the Auth tier's ~10 absolute DB connections the **first hard failure**. Halving per-request auth resolutions is a capacity lever, not only a latency one — which is why `#099` cross-references `#011`.
- **Fix shape (report-only).** Have the proxy forward its already-verified claims to the route handler through a request header it controls, so the route trusts the proxy's resolution instead of repeating it. Requires care: the header must be proxy-set and unspoofable from outside.

### L1-4 · Anonymous `answer`/`document_upload` consume two sequential rate-limit RPCs

`src/lib/api-rate-limit.ts:276-282` · `A=P B=arithmetic C=fixed` · gate=**operator (needs a migration first)**

- **Evidence.** `consumeAnonymousLimit(subjectKey)` then, if not limited, `consumeAnonymousLimit('anon:<bucket>:global')` — two serial Supabase RPCs before an anonymous answer request starts work.
- **`Promise.all` is the wrong fix.** It would consume the global bucket even when the subject bucket already denied, corrupting the counters.
- **The correct fix already has a precedent in this repo.** `consume_summary_rate_limits_atomic` (`supabase/migrations/20260717172000_atomic_summary_rate_limits.sql`) exists for exactly this reason — `api-rate-limit.ts:297-302` documents it as locking _"every participating bucket in a stable order, avoiding the partial accounting and lock-order risk of two serial RPC calls."_
- **Why not applied.** No generic subject+global atomic RPC exists (only `consume_api_rate_limit`, `consume_api_subject_rate_limit`, and the summary special case). Adding one means new locking SQL, and the app cannot call it until the operator applies the migration — switching the call site first would break production. Untested hand-authored locking SQL is also the exact category this repo marks do-not-hand-author. Filed as `#099`.

### L1-5 · `/api/search/universal` has no server-side coalescing

`src/app/api/search/universal/route.ts:129-186` vs `src/app/api/search/route.ts` · `A=S B=arithmetic C=fixed` · gate=**flag**

- **Evidence.** Every keystroke reaching the server costs an auth round trip + a rate-limit RPC + an 11-domain fan-out. `/api/search` coalesces identical concurrent requests in-process (`scopedSearchInflight`, keyed on the request body); the typeahead route does not. The rate limiter is the only throttle (registry bucket: 120/60 s authenticated, 60/60 s anonymous).
- **Mitigating context.** Typeahead correctly skips the per-keystroke embedding (`universal-search.ts:474-484`, `lexicalOnly: true`) and owner catalogues sit behind a 5 s TTL with in-flight sharing, so a typing burst issues one catalogue fetch per window.
- **Gated on evidence.** Resolved `#083` shows this exact surface is timeout-sensitive, and a coalescer changes what a keystroke returns under race. Needs the round-trip harness plus fake-timer tests first. Filed as `#101`.

---

## L2 — Scale-dependent overhead on the answer/search path (9)

### L2-1 · Sequential hydration triples, repeated on four retrieval branches

`src/lib/rag/rag.ts:2460,2493,2521` (and `2596/2605/2630`, `2847/2850/2868`, `2935/2943/2961`) · `A=P B=arithmetic C=multiplicative` · gate=**canary**

Metadata → memory → visual hydration run as three sequential Supabase stages, on up to four distinct branches within one request. `withMemoryBoostedCandidates` (`rag-candidate-sources.ts:1205,1208`) is itself 2 sequential round trips. Parallelising changes candidate assembly under partial failure and timeout — retrieval behaviour, so canary-gated. Note the contrast: `rag.ts:2751-2804` already parallelises three RPCs in one `Promise.all` (comment "A1"), so the pattern is established and the omission here is inconsistency rather than intent.

### L2-2 · Nested `await`-in-loop on the scope critical path

`src/lib/search-scope.ts:202,328` · `A=P B=arithmetic C=multiplicative` · gate=**canary** (loop) / **operator** (index)

`:202` awaits a label query inside a **doubly nested** loop (200-document batches × 1,000-row pages, cap 100 pages/batch). `:328` awaits a document query in a pagination loop up to `maxResolvedDocuments = 5000` — up to 5 sequential round trips before retrieval starts. Batching changes set assembly and truncation at the page cap; resolved `#075` proves this code has already produced a recall defect once, so it is canary-gated rather than free.

### L2-3 · Bare-column `ILIKE` cannot use the only trigram index

`src/app/api/documents/route.ts:193`; `src/lib/rag/rag-candidate-sources.ts:477` · `A=P|S B=inferred C=multiplicative` · gate=**operator** · **SQL AUTHORED, NOT APPLIED**

`documents_title_trgm_idx` (`schema.sql:687`) indexes the **concatenated expression** `lower(coalesce(title,'') || ' ' || coalesce(file_name,''))`. Both call sites filter the bare columns (`title.ilike.%q%,file_name.ilike.%q%`), which that expression index cannot serve, so both fall back to scanning `documents`. The RAG-path site is bounded by `.limit(12)`, but a non-matching query still scans. Two bare-column GIN trigram indexes serve those predicates directly.

**CORRECTED 2026-07-29 (PR #1377 review) — the "recall is byte-identical" claim was wrong, and it was load-bearing.** The original text argued the indexes are "additive and semantics-neutral, so no query text changes and recall is byte-identical", and used that to keep L2-3 out of canary territory. The premise does not hold on the RAG path: `fetchDocumentTitleAliasRows` (`rag-candidate-sources.ts:482`) applies `.limit(12)` with **no `ORDER BY`**, so _which_ twelve documents come back is plan-dependent. Adding an index changes the plan, so it can change the title-alias set fed into candidate assembly — a retrieval input, not just a speed-up. "No query text changes" is true; "recall is byte-identical" does not follow from it.

**Revised gating.** The `api/documents/route.ts:193` site is a user-facing document list and carries no retrieval consequence. The `rag-candidate-sources.ts:477` site does. Treat the RAG-path index as **canary-gated**, or make the ordering deterministic first — adding a stable `ORDER BY` to that `.limit(12)` would restore the semantics-neutral argument and is the cheaper route, since an unordered `LIMIT` is a latent nondeterminism regardless of this index. Tracked in `#102`; do not apply the RAG-path index on the strength of the retracted claim.

**Deliberately no migration file.** The reviewed statements live in
[`operator-apply-performance-latency-remediation.md`](../operator-apply-performance-latency-remediation.md).
A migration that adds indexes without a synchronized `schema.sql` mirror and regenerated
`drift-manifest.json` is what closed PR #1312; and the mirror cannot be written first, because
`required_indexes` inside `search_schema_health()` (`schema.sql:3178`) runs against the live
database and would fail until the indexes exist. Apply → mirror → regenerate → register, in that
order, in one operator change. Tracked as `#102`.

### L2-4 · Up to three sequential OpenAI generation calls, 60 s cumulative budget

`src/lib/rag/rag.ts:4226,4260,4349,4397`; budget `:4043` · `A=P B=measured C=multiplicative` · gate=**canary**, overlaps `#021`

Initial → truncation/quality retry to strong → strong quality-repair, with `OPENAI_GENERATION_MAX_RETRIES = 0` and a cumulative budget of `OPENAI_ANSWER_TIMEOUT_MS × 2` = 60 s — against route budgets of 25/35 s. Already parked as `#021` ("weakest cost/benefit on the queue") by explicit decision; recorded here for completeness, not reopened.

### L2-5 · `.eq("status","indexed").order("id")` paged to 5,000 with no `(status,id)` composite

`src/lib/search-scope.ts:271-277` · `A=P B=inferred C=multiplicative` · gate=**operator**

`documents_status_idx` (`schema.sql:678`) is single-column, so the `ORDER BY id` requires a sort per page. Compounds L2-2. Authored alongside L2-3 in the operator runbook; same window, same ordering constraint.

### L2-6 · `select("*")` pulled a generated tsvector over the wire

`src/app/api/documents/[id]/table-facts/route.ts` · `A=S B=inferred C=multiplicative` · gate=**free** · **APPLIED**

Three `select("*")` calls on `document_table_facts` transferred the generated `search_tsv` tsvector and `normalized_terms` array, while `src/lib/document-detail.ts` already had a narrow projection for the same table. All three now use explicit projections. The PATCH response is unchanged: `tableFactDetailProjection` matches the `TableFactRow` DTO (`src/components/document-viewer/types.ts:42-53`) field for field, and `DocumentViewer.tsx:1058` replaces client state with that object. Narrowing also stops `owner_id` leaving on the PATCH response.

### L2-7 · Unbounded per-owner `differential_records` fetch

`src/app/api/differentials/[slug]/route.ts:166-175` · `A=S B=inferred C=multiplicative` · gate=**report-only**

`select("*").eq("owner_id", …)` with **no `.limit()`**, returning every owner row including `payload`/`source` jsonb. **Two first-pass claims were wrong and are corrected here:** (1) the JS-side `kind` filter is _not_ waste — `kind` is constrained to exactly `('presentation','diagnosis')` (`schema.sql:6074`) and the code uses **both** partitions, so a push-down would be a no-op; (2) the projection cannot be narrowed, because `payload`/`source` _are_ the rendered data. The only real issue is the missing bound, and a silent `.limit()` would truncate `getDifferentialDetailContext` — changing what a clinician sees. Any cap needs a truncation signal, not a silent limit. Deliberately **not** fixed.

### L2-8 · Typeahead results are never cached

`src/lib/rag/rag.ts:2698-2711` · `A=S B=inferred C=fixed` · gate=**canary**

The `lexicalOnly`/source-only branch returns before `setCachedSearch`, so no typeahead result is ever cached. Adding caching changes what the _next_ keystroke returns. Filed as `#101`.

### L2-9 · `/api/medications` rebuilds the whole catalogue per anonymous request

`src/app/api/medications/route.ts`; `src/lib/medication-snapshot.ts:1` · `A=S B=inferred C=fixed` · gate=**free** · **APPLIED**

Anonymous callers got `defaultMedicationRecords()` plus a `governance` object built with `Object.fromEntries` over every record, per request, backed by a statically imported 3.52 MB JSON snapshot. `defaultMedicationRecords()` was already memoised via `loadMedicationSnapshot`, so the per-request cost was the governance map (every request) and the `fields=index` projection (mapping every record again). Both are query-independent and are now built once at module scope; ranking still runs per query. Responses already carried `PUBLIC_FIXTURE_CACHE_CONTROL` (`public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`), so repeat traffic was partly absorbed upstream — this removes the origin cost for the misses.

---

## L3 — Client first-paint and interaction (8)

> **Tier gate.** Ledger `#017` requires reproducible live Lighthouse/Web-Vitals evidence **before** payload work, and it gates `#012`/`#013`/`#016`. Everything below is report-only **except** L3-4 and L3-5, which are `#017`-exempt on a principled reading: `#017` gates _payload_ decisions (`#012`/`#013`/`#016` are all byte-count items). A loading fallback ships zero bytes and a resource hint ships ~60; neither can be justified or refuted by a Lighthouse number.

### L3-1 · Route-group layout makes 71.6 KB of single-feature CSS render-blocking everywhere

`src/app/(search-app)/layout.tsx:4` · gate=`#017`

`import "@/components/therapy-compass/therapy-compass.css"` sits in the **route-group** layout, so 3,427 lines / 71.6 KB of Therapy-Compass-only CSS is render-blocking on `/`, `/documents`, `/forms`, `/dsm` and every mode home. `globals.css` is a further 2,911 lines / 90.6 KB.

### L3-2 · Shared shell statically imports the Therapy Compass barrel

`src/components/clinical-dashboard/shared-search-app-shell.tsx:8` · gate=`#017`

A static `@/components/therapy-compass` barrel import pulls `workspace.tsx` → `bindings.tsx` (524 lines) + `nav.tsx` into **every** `(search-app)` route, not just `/therapy-compass/*`. Note this is the only barrel in `src/`; there are no `from "@/components"` / `from "@/lib"` imports anywhere, so the cost is the transitive graph, not barrel breadth.

### L3-3 · 3.16 MB of catalogue JSON fetched client-side on mount

`src/components/therapy-compass/bindings.tsx:207-211` → `data/use-therapy-data.ts:28,34-40` · gate=`#017`

`therapies.json` is 2,470 KB and `therapies-index.json` 690.6 KB, fetched on mount with nothing server-rendered. **Correcting `#016`'s framing:** the filenames are unversioned and Next serves `/public` with an ETag, so repeat visits pay ~4 revalidation round trips, **not 3.16 MB**. First visit pays the bytes. The fix is therefore content-hashed filenames + `immutable` (touching `scripts/build-therapies-index.mjs` and `check:therapy-data-index`), **not** a bare `Cache-Control` line — which is what `#016` currently implies. `next.config.ts:100-125` sets cache headers only for `/sw.js`, `/offline.html`, and `/manifest.webmanifest`; nothing for `/public/*`.

### L3-4 · Ten `ssr: false` surfaces rendered nothing between HTML arrival and chunk execution

`src/components/clinical-dashboard/clinical-dashboard-lazy.tsx`; `src/components/clinical-dashboard/dashboard-nav.tsx` · gate=**`#017`-exempt** · **APPLIED**

11 dashboard surfaces are `ssr: false`; only `StagedAnswerResultSurface` had a `loading` fallback. The other 10 — including the `/tools` hub and the four entries that all resolve to the same 852-line `DocumentManagerPanel` module — rendered literally nothing while their chunk was in flight, which reads to a user (and to a screen reader) as nothing happening. All 10 now use the existing shared `LoadingPanel` primitive (`ui-primitives.tsx:455`), which carries `role="status"` + an accessible label. The two sidebar dialogs are intentionally excluded: they mount on open, so a fallback would render into a closed dialog.

### L3-5 · No connection warm-up for the Supabase origin

`src/app/layout.tsx`; `src/lib/supabase/client.tsx:194` · gate=**`#017`-exempt** · **APPLIED**

Root-layout `AuthProvider` awaits `Promise.all([auth.getUser(), auth.getSession()])` on mount — a cross-origin request that every auth-gated client fetch queues behind — and there was **no `preconnect`, `dns-prefetch`, `preload`, or `ReactDOM.preconnect` anywhere in `src/`**. Added `preconnect` (with `crossOrigin`, required for the connection to be reused by supabase-js's CORS fetches) + `dns-prefetch`, guarded so demo mode without public env emits nothing.

### L3-6 · Three client waterfalls

`src/components/clinical-dashboard/use-app-preferences.ts:156-182`; `src/components/ClinicalDashboard.tsx:977-1069`; `src/components/clinical-dashboard/signed-image.tsx:60-84` + `use-signed-image-url.ts:39` · gate=`#017`

Three sequential hops each: (a) `getUser()` → `GET /api/account/preferences` → conditional `PUT` bootstrap awaited inside the GET's `.then`; (b) local identity → `setup-status` → a parallel fan-out of 4 (only the fan-out is parallel; the two preceding hops are strictly serial); (c) per evidence image, mount → IntersectionObserver → signed-URL fetch → first image byte, i.e. 2 sequential round trips before any image data. Worth noting the good news: **zero** route files are client components — all ~120 `src/app/**` pages are Server Components.

### L3-7 · Paint and motion cost in `globals.css`

`src/app/globals.css` · gate=`#017`

`.edge-glass-header-backdrop` (`:709-748`) stacks **three** `backdrop-filter` blur passes (14/20/26 px, each with its own mask) on one always-mounted element that translates on every scroll-hide. `.answer-footer-search-pill` (`:677-684`) puts `box-shadow` — non-composited — in its `transition` list alongside a `backdrop-filter`. `@keyframes shimmer` (`:2289-2296`) animates `background-position` (paint, not composited) on the shared `Skeleton` primitive, so every skeleton repaints continuously; the opacity-only `.animate-skeleton-shimmer` (`:2484-2489`) is the well-behaved variant already used in `answer-status.tsx`. Four `will-change: padding-bottom` + `transition: padding-bottom 240ms` rules (`:2851-2869`) animate a layout property, though phone-scoped and gated on a transient marker. `html.theme-transitioning *` (`:2884-2891`) transitions 6 properties on **every element** for 200 ms. Ten `backdrop-filter` declarations total. Counterweight: the other 9 keyframes animate only `opacity`/`transform`, and reduced-motion/forced-colors escapes are thorough.

### L3-8 · Nonce CSP forces every route dynamic

`src/app/layout.tsx` · gate=`#017` · already `#016(a)`

Reading `headers()` for the per-request nonce opts the entire app into dynamic rendering — acknowledged in-code as _"inherent to nonce-based CSP."_ There is no `unstable_cache`, `revalidate`, `fetchCache`, or `"use cache"` anywhere in `src/`, so the static clinical catalogues (DSM/differentials/therapy/specifiers/formulation) get no static generation at all.

---

## L4 — Cold-start, build, ingestion (1)

### L4-1 · 5.6 MB of snapshot JSON statically ESM-imported

`src/lib/medication-snapshot.ts:1`; `src/lib/differential-fixtures.ts:1`; `src/lib/service-catalog.ts:1` · `A=C C=once` · gate=`#017`-adjacent

`medications-snapshot.json` 3.52 MB + `differentials-snapshot.json` 1.19 MB + `services-snapshot.json` 915 KB (plus specifiers 659 KB, search-index 245 KB, forms 170 KB) parsed at module evaluation. Cold-start cost, not per-request. Partially covered by `#013`.

### ~~L4-2 · `worker/main.ts` reads each image up to 3× per ingestion~~ — RETRACTED 2026-07-29

The first pass carried this forward from the 2026-07-01 audit as finding `L11` and called it
"CONFIRMED with no fix evidence". **That was wrong on the second half.** The 2026-07-01 audit's own
disposition table records it as _"a deliberate peak-memory trade-off … documented at the site"_,
and the documentation is present at `worker/main.ts:866-869`:

> _"…each stage (hash here, caption on cache miss, upload) instead of being cached, because
> holding every extracted image Buffer for a large document (hundreds of multi-MB page images)
> would multiply the worker's peak memory. Disk I/O is the cheaper resource for this background
> pipeline."_

The three reads are real (`worker/main.ts:872`, `:1034`, `:1129`) but they are the accepted side of
a decided trade-off, on ingestion throughput rather than clinician latency. Re-filing it as open
work would re-litigate a settled decision. Moved to **L6** as deliberate design; the correction is
recorded in ledger `#104` so a third audit does not resurrect it.

---

## L5 — Measured and cleared, or dormant (16) — do not re-report

Recorded so the next audit cannot re-file these.

1. **Table-facts RPC latency** — ledger `#069`, closed 2026-07-27 with hosted profiling: warm client median/p90 167–189 / 174–243 ms, first-unprimed 278–663 ms. Conclusion: _"Plans are not the multi-second tail."_
2. `match_document_chunks_text` OR-across-relations → split into two GIN probes, `20260713100000`.
3. Per-row `document_index_quality` correlated subquery → now a `left join` (`schema.sql:6574,6589`).
4. N+1 label/summary per retrieved chunk → batch CTEs (`schema.sql:3888,3917`) + `20260702170000`.
5. `match_documents_for_query` unbounded `similarity()` over documents×labels×summaries → removed; effective definition is tsvector-only.
6. Legacy ivfflat/dead vector indexes → dropped, **~4.4 GB reclaimed**, DB 13 → 8.6 GB (`20260702014803`); guarded by `detect_legacy_ivfflat_indexes()`.
7. `LIMIT NULL` on versioned retrieval entry points → clamped 1..96 / 1..100 (`20260717162000`).
8. `work_mem` on 8 hybrid/lexical RPCs → 64 MB (`20260724000000`).
9. Duplicate/redundant FK and dead indexes → dropped across four migrations.
10. `buildEvidenceRelevance`/`buildVisualEvidence` recomputation (audit `L10`) → computed once and shared (`search/route.ts:836-838`).
11. Latency SLOs, per-phase telemetry, `Server-Timing`, `/api/health?deep=1` counters → shipped (the `Server-Timing` coverage gap on the stream/search routes is closed by this pass).
12. Documents-only universal-search timeout → `#083` resolved.
13. Bundle-size budget → enforced (`bundle-budget.json`, `enforce: true`, 1,309,274 gzip bytes ±10%).
14. **`hnsw.ef_search` not attachable to the two `language sql` RPCs** → known hosted-platform blocker; `20260627000000` is an explicit no-op recording `ERROR: permission denied to set parameter "hnsw.ef_search" (42501)`. Not a defect.
15. Wide vs narrow `document_table_facts` trigram index mismatch → verified moot; the effective RPC expression (`schema.sql:6726`) matches the narrow index (`:6425`).
16. Versioned-RPC fallback chains (`rag-candidate-sources.ts:100-118`, `deep-memory.ts:920,941,950`) → **dormant** while the `_v2`/`_v3` functions exist. A resilience note (3× sequential round trips if they ever go missing), not live latency debt.

---

## L6 — Deliberate design, not defects (5)

1. **Mode-home and dashboard prefetch** (`master-search-header.tsx:858-957`, `ClinicalDashboard.tsx:846-849`) — this is PR #1275 / `551f3f666 perf(ui): prefetch mode homes for seamless switching`, reviewed and intentional. The unconditional 250 ms mount timer prefetching `/tools` + `/favourites` + `/differentials` does compete with the dashboard's own `setup-status` → `documents` chain, and a pointer sweep across the mode menu prefetches every mode traversed (deduped per session). Recorded as **a measured trade-off to watch**, not a defect.
2. **Anonymous answers are never cached or coalesced** (`rag-cache.ts:141-143`) — a PHI invariant.
3. **`SignedImage` `unoptimized`** (`signed-image.tsx:142-161`) — deliberate; bearer URLs must not enter the unauthenticated `/_next/image` cache. Resolved `#014`. CLS is already handled by a fixed aspect frame.
4. **`minimumCacheTTL` left at 60 s** (`next.config.ts:53-54`) — deliberate; a day-long floor could retain optimizer output past signed-URL lifetimes.
5. **Worker re-reads each ingestion image per stage** (`worker/main.ts:866-869`) — deliberate peak-memory trade-off, documented at the site. See the L4-2 retraction above.

---

## Guardrail disposition

| Gate         | Findings                                            | What it requires                                               |
| ------------ | --------------------------------------------------- | -------------------------------------------------------------- |
| **free**     | L2-6, L2-9, L3-4, L3-5 applied; L1-2 partly         | Ordinary review — L1-2's overlap was refuted on review         |
| **flag**     | L1-1 (applied), L1-5                                | FLAG + `RAG impact:` line; no canary when no behaviour changes |
| **canary**   | L0-1, L2-1, L2-2, L2-4, L2-8, L1-5 (if behavioural) | Provider-backed eval pair, ~$1–2, explicit approval            |
| **`#017`**   | L3-1, L3-2, L3-3, L3-6, L3-7, L3-8, L4-1            | Live Lighthouse/Web-Vitals evidence first                      |
| **operator** | L1-4, L2-3, L2-5, + `#011` connection allocation    | Hosted apply / dashboard change                                |

**Explicit non-actions**, per `docs/capacity-review.md:123-125`: no read replicas, no horizontal app scaling, **no retrieval concurrency semaphore** until soak data shows queueing. Its verdict — _Postgres CPU under hybrid-RPC concurrency is the first soft failure; "answer p95 inflates well before errors appear"_ — is precisely why L1/L2 round-trip reduction has capacity value beyond latency, and why a semaphore remains the wrong lever.

---

## Measurement plan (provider-free)

Every L1 finding is a **round-trip count**, and round-trip counts can be pinned offline and priced
with numbers this repo already owns (`#069`: warm p90 175–243 ms; first-unprimed 278–663 ms). No
provider call is needed to size the top of the ranking.

1. **`Server-Timing` first (done).** It existed but was emitted only by `/api/answer` and `/api/search/universal` — **not by `/api/answer/stream`, the route the UI actually uses.** That was the largest measurement gap in the repo. Now: `/api/answer` emits `auth`/`ratelimit`/`scope` alongside its existing entries; `/api/search` emits `auth`/`ratelimit`/`search`/`total`; `/api/answer/stream` emits `auth`/`ratelimit`. **Documented limitation:** on a streaming response, headers flush before the first frame, so in-stream stage durations cannot reach a response header — and routing them through the SSE contract would put instrumentation inside a governed clinical payload (`answer-stream-contract.ts:21` whitelists only `progress`/`final`/`error`). `/api/answer` covers those stages over the same `resolveSearchScope` + RAG path.
2. **Offline round-trip budget harness.** `tests/answer-route-preamble.test.ts` pins the answer-route preamble as an **admission-cost** contract, not an overlap one: scope resolution starts only **after** the limiter admits, a denied request dispatches **zero** scope queries, and the client abort signal is threaded. Any generalisation of this harness must enforce that direction — asserting the reverse would reintroduce the database work for throttled requests that L1-2's refutation removed. Broadening it to a general counting-proxy over the offline fixtures (`scripts/eval-rag-offline.mjs`, `test-cache-path.mjs`, `check-rag-fixtures.mjs`) is the enabler for L1-5 and remains open as `#098`. Zero providers, zero DB.
3. **Provider-free wall-clock hot path.** The typeahead route is useful because `lexicalOnly: true` skips the per-keystroke embedding, so it times a real request with no OpenAI call. **Corrected 2026-07-29 — do not pair it with demo mode, and do not claim it covers scope.** `src/app/api/search/universal/route.ts:137` returns on `isDemoMode() || isLocalNoAuthMode()` _before_ `createAdminClient` (`:150`), `publicAccessContext` (`:151`) and `consumeSubjectApiRateLimit` (`:153`), so a demo-mode run measures local fixture search and skips the auth and limiter stages entirely; and `resolveSearchScope` is never called from that route at all. Timing it in demo mode would therefore appear to clear an L1 finding it never exercised. Run it **non-demo** against a local Supabase or a mocked client to cover auth + rate-limit + RPC, and time the **scope** stage separately via `/api/answer`, which is the route that actually resolves it.
4. **Disposable local Postgres + `EXPLAIN (ANALYZE, BUFFERS)`** for L2-3/L2-5/L2-6. **Caveat to carry:** `hnsw.ef_search` _is_ settable locally, so no local vector plan may be generalised to hosted.
5. **Local client evidence that does not claim to be `#017`.** `build:analyze`, the enforced bundle budget, the `next build` route table (`ƒ Dynamic` vs `○ Static`), and a Playwright run on the existing local harness reading `PerformanceObserver` LCP/CLS/long-tasks plus `performance.getEntriesByType("resource")` on a cold profile. This **ranks** L3 items against each other; it does **not** discharge `#017`, which requires live-site evidence.

**Excluded without explicit approval:** `profile:retrieval` (hosted), `check:supabase-project`, `verify:release`, `scripts/soak-test.ts`, any live eval canary, live Lighthouse.

---

## Applied (7)

| Finding     | Change                                                                                               | Files                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Measurement | `Server-Timing` on `/api/answer/stream` + `/api/search`; `auth`/`ratelimit`/`scope` on `/api/answer` | `src/lib/server-timing.ts`, `src/app/api/answer/route.ts`, `src/app/api/answer/stream/route.ts`, `src/app/api/search/route.ts` |
| L1-1        | Shared-cache-hit promotion deferred off the response path, staleness guard intact and documented     | `src/lib/rag/rag.ts:3234`, `src/lib/rag/rag-cache.ts`                                                                          |
| L1-2        | Client abort signal threaded into scope (overlap written, then **refuted** on review — see L1-2)     | `src/app/api/answer/route.ts`, `tests/answer-route-preamble.test.ts`                                                           |
| L2-6        | Three `select("*")` narrowed to explicit projections                                                 | `src/app/api/documents/[id]/table-facts/route.ts`, `src/lib/document-detail.ts`                                                |
| L2-9        | Governance map and index projection built once instead of per anonymous request                      | `src/app/api/medications/route.ts`                                                                                             |
| L2-3 / L2-5 | Bare-column trigram + `(status,id)` composite **authored as operator SQL, not applied**              | `docs/operator-apply-performance-latency-remediation.md`                                                                       |
| L3-4 / L3-5 | 10 `loading` fallbacks; Supabase `preconnect`/`dns-prefetch`                                         | `clinical-dashboard-lazy.tsx`, `dashboard-nav.tsx`, `src/app/layout.tsx`                                                       |

**RAG impact: no retrieval behaviour change** — the only `src/lib/rag/**` edits defer a process-local cache write off the response path and add a doc comment; no scoring, ordering, selection, alias, or citation logic is touched, and the mid-request staleness guard is preserved.

## Retired during verification (4)

Recorded because a plan that survives contact unchanged usually means the verification was too shallow.

1. **Per-request identity memo** — would dedupe nothing; identity resolves once per method handler, and the real duplication spans two invocations with different `Request` objects (L1-3).
2. **Batched anonymous rate limit** — requires new locking SQL the app cannot call before the operator applies it (L1-4).
3. **`differential_records` `kind` push-down + narrowed projection** — push-down is a no-op against the schema's `kind` check constraint; `payload`/`source` _are_ the data; a silent `.limit()` would truncate clinical context (L2-7).
4. **Deferring the 8 `setCachedSearch` awaits** — changes abort semantics and widens a real mutation window on live arrays (L1-1).

---

## Method, coverage, limitations

- **Verified vs inferred.** Every L0/L1 finding and every "already fixed" claim was read at the cited line by the primary author. L2/L3 findings carry their evidence grade inline. No wall-clock measurement was taken.
- **`schema.sql` duplicate-definition trap.** `supabase/schema.sql` contains **duplicate definitions of 12 functions**, replayed top to bottom, so **the later definition wins**. Reviewing only the first occurrence produces false findings. Affected retrieval RPCs and their effective line numbers: `match_document_chunks` **:6522**, `match_document_chunks_hybrid` **:6559**, `match_documents_for_query` **:6783**, `match_document_table_facts_text` **:6645**, `match_document_embedding_fields_text` **:6621**. This is a deliberate artefact of `20260701140631_codify_live_retrieval_rpcs` capturing live-only fixes; see `docs/process-hardening.md:151`.
- **Environment variance.** `docs/process-hardening.md:356-357` records this cloud environment's Supabase p95 at ≈ 49 s. Large local eval latencies are known variance, **not** regressions.
- **Schema divergence found.** `supabase/migrations/20260714190000_document_table_facts_trgm_idx.sql` creates a wide 5-column trigram index that is **absent from `supabase/schema.sql`**. Different owner and verification path (`check:drift`, drift manifest) than the index work above — filed separately as `#103`.
- **Out of scope.** Correctness, security, and clinical-governance findings; the `#017`-gated client payload decisions; hosted application of any index.
