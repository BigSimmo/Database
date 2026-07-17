# Audit remediation plan — 2026-07-14

Plan derived from the multi-skill repository audit of `main` @ `570e6ba` (ledger rows in
[`branch-review-ledger.md`](branch-review-ledger.md)). This document is the sequenced address plan for
every finding: major blockers first, then P2 sub-issues, then P3 cleanup.

**Findings handover (inventory + status):** [`audit-handover-2026-07-14.md`](audit-handover-2026-07-14.md).

**Reconciliation — 2026-07-17 (`claude/memory-tasks-review-glmntq`):** a read-only cross-check of
every finding against current `main` found the code side largely landed since this plan was written.

- **DONE in code:** C1 (anon catalog rate-limit), D1 (public-doc DTO redaction), D5 (bulk error
  redaction), E1 (unreachable commit fallback), E2 (recovery dedup), F4 (flake ledger emptied),
  G1–G4 (full frontend a11y wave), H6 (`/api/jobs` auth-first + 503), F5 (`.env.example` weak-OR
  default corrected to `false` to match the `src/lib/env.ts` default — this pass). The a11y wave
  (G) and the ingestion recovery/commit wave (E1/E2) are fully closed.
- **Superseded:** F2 (CI RAG-eval scope) — the offline RAG-eval gate now runs unconditionally.
- **Still open — OWNER:CODE:** D2 (tenancy CI guard `check-owner-scope-api.mjs` still absent), D3
  (`getSession()`→`getUser()` in `client.tsx`), E3 (wire `decideReindexGate` into `scripts/reindex.ts`),
  F1 (CI UI-scope patterns miss `app-modes`/`ui-copy`), F3 (`@critical` safety assert still
  conditional), F6 (bundle-budget `enforce:false`),
  H1–H5 (API-contract hygiene: error envelopes, admin-route rate limits, list-offset cap,
  upload Content-Length reserve, authed-summarize public scope). Biggest remaining cluster is H1–H5.
- **In flight (do not restart):** draft PRs **#708** (frontend a11y/layout P2s) and **#710**
  (storage-bucket migration drift — "closes the audit's open P2 list").
- **Operator-pending (⏸):** Waves A/B/J and D4 (all live/legal/ops). Wave I (P3) untouched.

**Rules for executing this plan**

- Prefer the smallest safe change per finding; do not bundle unrelated domains in one PR.
- Code fixes use `npm run verify:cheap` first, then the smallest domain check, then
  `npm run verify:pr-local` before handoff.
- Provider/live actions are **operator-gated** (`⏸`). Do not run them without explicit confirmation.
- Reconcile [`operator-backlog.md`](operator-backlog.md) against
  [`launch-operator-runbook.md`](launch-operator-runbook.md) before repeating any historical apply.

**Legend**

| Tag             | Meaning                                               |
| --------------- | ----------------------------------------------------- |
| **OWNER:CODE**  | Implementable in-repo                                 |
| **OWNER:OPS**   | Railway / Supabase / GitHub / OpenAI dashboard or CLI |
| **OWNER:LEGAL** | Privacy officer / counsel                             |
| **⏸**           | Provider or legal confirmation required               |
| **Prove**       | Smallest acceptance check                             |

---

## 0. Recommended delivery waves

Work top-down. Later waves assume earlier majors are either done or consciously deferred.

```text
Wave A  Confirm live/ops truth (doc sync)           OWNER:OPS   ⏸
Wave B  Launch / privacy blockers                   OWNER:LEGAL+OPS  ⏸
Wave C  Code P1 availability (catalog rate limits)  OWNER:CODE
Wave D  Security & tenancy P2                       OWNER:CODE (+OPS for live A/B)
Wave E  Ingestion / recovery P2                     OWNER:CODE
Wave F  CI / testing / config P2                    OWNER:CODE
Wave G  Frontend a11y P2                            OWNER:CODE
Wave H  API contract hygiene P2                     OWNER:CODE
Wave I  P3 backlog + structure debt                 OWNER:CODE/OPS
Wave J  Release confidence close-out                OWNER:OPS  ⏸
```

Suggested PR granularity (one theme per PR):

1. Catalog rate-limit + public DTO redaction
2. Ingestion recovery + commit fallback
3. CI scope + critical safety assert + flake hygiene
4. A11y (describedby / icons / Tab / live region)
5. JSON error taxonomy + admin rate limits
6. Env example / bundle budget / summarize public scope
7. Operator backlog status reconciliation (docs-only)

---

## Wave A — Confirm live truth before acting

### A1. Reconcile operator backlog vs launch runbook

|             |                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | M5 — backlog still `⏳` for drift-codify / prod deploy / worker while runbook says more is already live                                                                                                           |
| **Owner**   | OWNER:OPS (+ docs edit)                                                                                                                                                                                           |
| **Address** | Diff each backlog row against `launch-operator-runbook.md`, July-8 apply notes, empty `supabase/drift-allowlist.json`, and linked migration list. Flip rows to `✅` / `🔎 verify` / keep `⏳` with evidence date. |
| **Files**   | `docs/operator-backlog.md`, optionally a short note in `docs/launch-operator-runbook.md`                                                                                                                          |
| **Prove**   | `⏸ npx supabase migration list --linked`; `⏸ npm run check:drift`; human sign-off that backlog matches live                                                                                                       |

### A2. Confirm July-13 scrub / lexical migration posture

|             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Process-hardening still lists July-13 PHI-scrub / lexical items as remaining in places                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Owner**   | OWNER:OPS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Address** | Confirm whether `20260713103000_scrub_legacy_rag_query_text` (and related) are applied; if not, schedule under Wave B; if yes, mark docs done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Prove**   | `⏸` all four process-hardening scrub checks expect `0` (unless `RAG_PERSIST_RAW_QUERY_TEXT` is deliberately enabled): `select count(*) from rag_queries where query not like 'redacted-query:%';`; `select count(*) from rag_query_misses where query not like 'redacted-query:%' or normalized_query not like 'redacted-query:%';`; `select count(*) from rag_retrieval_logs where query not like 'redacted-query:%' or (normalized_query is not null and normalized_query not like 'redacted-query:%');`; `select count(*) from rag_response_cache where normalized_query not like 'redacted-cache:%';`; plus lexical probe from process-hardening |

---

## Wave B — Launch / privacy majors (block real-patient use)

### B1. Close PIA-1 APP 8 / overseas processing basis

|             |                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | M1 — Railway Singapore + OpenAI US process incidental PHI queries                                                                                                                                                                                 |
| **Owner**   | OWNER:LEGAL + OWNER:OPS                                                                                                                                                                                                                           |
| **Address** | Execute checklist in [`openai-cross-border-basis.md`](openai-cross-border-basis.md): OpenAI DPA, ZDR eligibility enablement where chosen, Railway DPA/processor record, update PIA status tables and `/privacy` copy only after counsel approval. |
| **Prove**   | Status record rows move from `_no_` to dated `_yes_` / approved alternative; PIA-1 no longer High-open                                                                                                                                            |

### B2. Verify Railway `RAG_QUERY_HASH_SECRET` (PIA-2)

|             |                                                                                                                                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | M2 — secret verified in GitHub CI, Railway runtime still `🔎 verify`                                                                                                                                                                                                                                            |
| **Owner**   | OWNER:OPS                                                                                                                                                                                                                                                                                                       |
| **Address** | Set/confirm a ≥16-char value in Railway **production** that matches the GitHub Actions secret used for CI smoke. For staging, set a **separate** staging-only `RAG_QUERY_HASH_SECRET` per [`staging-setup.md`](staging-setup.md) — do not reuse the production HMAC key. Confirm boot smoke and deep readiness. |
| **Prove**   | `⏸ npm run check:deployment-readiness` / production health boot; backlog → `✅`                                                                                                                                                                                                                                 |

### B3. Restore OpenAI quota and run release gates

|             |                                                                                                                                                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | M3 — release gate + golden evals incomplete; prior quota exhaustion                                                                                                                                                                                                                                            |
| **Owner**   | OWNER:OPS                                                                                                                                                                                                                                                                                                      |
| **Address** | Complete the runbook §0 identity preflight with `npm run check:supabase-project`, then restore embedding/completions quota → run `npm run eval:retrieval:quality` (36/36) → `npm run eval:quality -- --rag-only` → `npm run verify:release` per [`launch-operator-runbook.md`](launch-operator-runbook.md) §2. |
| **Prove**   | Paste summaries into release notes / backlog; canary path in B4                                                                                                                                                                                                                                                |

### B4. Eval Canary trust + staging soak

|             |                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | M3 leftovers — canary not yet “two greens”; staging soak pending                                                                                                                              |
| **Owner**   | OWNER:OPS                                                                                                                                                                                     |
| **Address** | Provision staging if absent ([`staging-setup.md`](staging-setup.md)); soak (`scripts/soak-test.ts --confirm-staging`, answer p95 ≤ 25 s); run two consecutive Eval Canary greens from `main`. |
| **Prove**   | Soak log + two green workflow runs recorded in backlog                                                                                                                                        |

### B5. Worker image / secret / seed post-deploy confirm

|             |                                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Worker redeploy, registry seed, `HEALTH_DEEP_PROBE_SECRET`, auth connection cap                                                                                                                                                                |
| **Owner**   | OWNER:OPS                                                                                                                                                                                                                                      |
| **Address** | Follow runbook §6 after B3: `reindex:health`, seed registry/differentials, wire ops-digest secrets if desired, flip auth connection allocation **before** vertical scale ([`auth-connection-cap-runbook.md`](auth-connection-cap-runbook.md)). |
| **Prove**   | Non-empty Services/Forms; reindex health clear; optional ops-digest cron enabled                                                                                                                                                               |

---

## Wave C — Code P1: anonymous catalog availability

### Wave C1. Rate-limit anonymous public catalogs (finding M4)

|             |                                                                                                                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Catalog routes short-circuit before rate limits when no auth signal                                                                                                                                                                                 |
| **Owner**   | OWNER:CODE                                                                                                                                                                                                                                          |
| **Address** | Always resolve a rate-limit subject (anonymous IP/fingerprint) for medications/registry/differentials catalog GETs; or force lightweight `fields=index` as default for anon and hard-cap full payloads. Prefer both: limiter + default index shape. |
| **Files**   | `src/lib/public-api-access.ts`, `src/app/api/medications/route.ts`, `src/app/api/registry/**`, `src/app/api/differentials/**`, rate-limit tests                                                                                                     |
| **Prove**   | Unit/route tests: unauth GET still calls limiter; optional size cap; `npm run verify:cheap`                                                                                                                                                         |

---

## Wave D — Security & tenancy P2

### Wave D1. Redact internal fields on authenticated public-document DTOs (findings S1 / S10 detail)

|             |                                                                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Authed viewers of `owner_id IS NULL` docs receive `storage_path`, `content_hash`, etc.                                                                                                                                           |
| **Owner**   | OWNER:CODE                                                                                                                                                                                                                       |
| **Address** | Apply the same omit-list used for anonymous responses whenever `document.owner_id !== access.ownerId` (or whenever public overlay rows are returned). Keep full fields for the owning user / operators only if product requires. |
| **Files**   | `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/route.ts`, focused API tests                                                                                                                                       |
| **Prove**   | Authed non-owner GET public doc omits `storage_path` / `content_hash` / `import_batch_id`                                                                                                                                        |

### D2. Defense-in-depth tenancy CI guard (M6)

|             |                                                                                                                                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Service-role single layer; forgotten owner filter is a full leak class                                                                                                                                                                                                                                          |
| **Owner**   | OWNER:CODE (+ OWNER:OPS for live A/B)                                                                                                                                                                                                                                                                           |
| **Address** | Add static CI guard grepping `src/app/api/**` for admin queries on owner-scoped tables without known helpers (`withOwnerReadScope`, `requireOwnerScope`, `.eq("owner_id"` patterns allowlisted). Document remaining intentional exceptions. Schedule `⏸` user A vs B smoke on documents + signed URLs + search. |
| **Files**   | new `scripts/check-owner-scope-api.mjs` (or extend existing), `package.json` / `verify:cheap`, tests; update `docs/tenancy-defense-in-depth-review.md`                                                                                                                                                          |
| **Prove**   | Guard fails on a synthetic unscope fixture; live A/B green                                                                                                                                                                                                                                                      |

### D3. Auth UI: prefer validated user for privilege display (S2)

|             |                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Browser `getSession()` can show signed-in until API 401                                                                                                     |
| **Owner**   | OWNER:CODE                                                                                                                                                  |
| **Address** | Initialize `AuthProvider` via `getUser()` (or revalidate session with `getUser` before elevating UI), keep optimistic cache only for non-privileged chrome. |
| **Files**   | `src/lib/supabase/client.tsx`, auth UI tests                                                                                                                |
| **Prove**   | Tampered/stale local session → UI not elevated / recovers to signed-out                                                                                     |

### D4. Public-upload pool principal hygiene (S3)

|             |                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Finding** | Shared quarantine owner is high blast radius when uploads enabled                                                                                                                          |
| **Owner**   | OWNER:OPS (+ CODE docs)                                                                                                                                                                    |
| **Address** | Ensure pool UUID has no human password/OAuth sessions; document as non-interactive principal; keep `NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED` off in prod unless moderation workflow is staffed. |
| **Prove**   | Auth user list check + prod env flag audit                                                                                                                                                 |

### D5. Bulk / internal error redaction (S10)

|             |                                                               |
| ----------- | ------------------------------------------------------------- |
| **Finding** | Bulk edit returns raw PostgREST/`error.message`               |
| **Owner**   | OWNER:CODE                                                    |
| **Address** | Map to `PublicApiError` / stable codes; log server-side only. |
| **Files**   | `src/app/api/documents/bulk/route.ts`                         |
| **Prove**   | Injected update failure → no raw Postgres text in JSON        |

---

## Wave E — Ingestion / recovery P2

### E1. Fix unreachable commit fallback (I1)

|             |                                                                                                                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | `throw` before `upsertIndexQuality` / `deleteStaleIndexGenerationRows`                                                                                                                                                                                                                        |
| **Owner**   | OWNER:CODE                                                                                                                                                                                                                                                                                    |
| **Address** | Restructure `commitDocumentIndexGeneration`: on RPC error, if error is not `lease_lost`, run the documented client fallback then rethrow or return structured failure; never leave unreachable statements. Enable unreachable-code lint/`allowUnreachableCode: false` for worker if feasible. |
| **Files**   | `worker/main.ts`, worker/unit tests if present                                                                                                                                                                                                                                                |
| **Prove**   | Simulated commit RPC failure invokes cleanup once; typecheck/lint clean                                                                                                                                                                                                                       |

### E2. Deduplicate recovery retries per document (I2)

|             |                                                                                                                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | `pending` + `failed` → two retry actions → unique index violation                                                                                                                                           |
| **Owner**   | OWNER:CODE                                                                                                                                                                                                  |
| **Address** | In `buildIngestionRecoveryPlan`, emit at most one retry per `document_id` (prefer existing `pending`, else promote one `failed`). Align `recover-ingestion-queue.ts` with `reindex.ts` status query policy. |
| **Files**   | `src/lib/ingestion-recovery.ts`, `scripts/recover-ingestion-queue.ts`, `tests/ingestion-recovery.test.ts`                                                                                                   |
| **Prove**   | New unit test: pending+failed → `retryCount === 1`; script dry-run does not throw `23505`                                                                                                                   |

### E3. Wire reindex eval gate (I3)

|             |                                                                                                                                                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | `decideReindexGate` unused by `scripts/reindex.ts`                                                                                                                                                                                                                                      |
| **Owner**   | OWNER:CODE                                                                                                                                                                                                                                                                              |
| **Address** | After worker settles each generation (or at script end), load eval summary JSON and call `decideReindexGate`; exit non-zero on `NO_GO`. Keep opt-out flag for emergency ops (`--skip-eval-gate`) documented and logged. Optionally relocate module next to the driver under `scripts/`. |
| **Files**   | `scripts/reindex.ts`, `src/lib/reindex-eval-gate.ts`, docs in reindex runbook                                                                                                                                                                                                           |
| **Prove**   | Fixture NO_GO summary → non-zero exit; GO passes                                                                                                                                                                                                                                        |

---

## Wave F — CI / testing / config P2

### F1. Expand CI UI scope patterns (C3)

|             |                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | `src/lib/app-modes.ts`, `ui-copy.ts`, document-flow / search-navigation helpers do not set `ui_changed`                                         |
| **Owner**   | OWNER:CODE                                                                                                                                      |
| **Address** | Extend `uiPatterns` in `scripts/ci-change-scope.mjs` to include those libs (and any other shell-imported copy/routing modules). Add self-tests. |
| **Prove**   | `node scripts/ci-change-scope.mjs --json --files src/lib/app-modes.ts` → `ui_changed: true`                                                     |

### F2. Expand CI RAG-eval scope patterns (C4)

|             |                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | `clinical-safety.ts`, `privacy.ts`, `public-api-access.ts`, `private-search-scope.ts` miss `rag_eval`                                                            |
| **Owner**   | OWNER:CODE                                                                                                                                                       |
| **Address** | Add those modules to `ragEvalPatterns`; keep test pattern coverage; add self-tests. Fix stale “advisory regression” sentence in `docs/process-hardening.md` L11. |
| **Prove**   | Classify `src/lib/clinical-safety.ts` → `rag_eval_changed: true`                                                                                                 |

### F3. Harden `@critical` safety UI assertion (C6)

|             |                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Finding** | Clozapine demo smoke treats safety findings as optional                                                 |
| **Owner**   | OWNER:CODE                                                                                              |
| **Address** | For that fixture, require `answer-safety-findings-trigger` and ≥1 `safety-finding-row` unconditionally. |
| **Files**   | `tests/ui-smoke.spec.ts`                                                                                |
| **Prove**   | Focused Chromium critical title; intentional findings removal fails the test                            |

### F4. Flake ledger → quarantine or fix (C5 / C7)

|             |                                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Four known flakes in blocking suite; `@quarantine` unused; sleeps/`networkidle` swallows                                                                                                           |
| **Owner**   | OWNER:CODE                                                                                                                                                                                         |
| **Address** | For each `flake-ledger.json` entry: fix root cause **or** tag `@quarantine` with owner/date. Replace `waitForTimeout` with condition waits; stop relying on swallowed `networkidle` for readiness. |
| **Prove**   | Either ledger empty or every ledger title tagged/fixed; critical/regression green                                                                                                                  |

### F5. Align `.env.example` with safe defaults (Finding C1)

|             |                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Example enables `RAG_TEXT_WEAK_OR_RELAXATION=true`                                                                                                      |
| **Owner**   | OWNER:CODE                                                                                                                                              |
| **Address** | Set example to `false` or comment as opt-in experiment requiring golden eval. Document spend/price env vars (P3) in the same pass if touching the file. |
| **Prove**   | Example matches `env.ts` defaults for risky flags                                                                                                       |

### F6. Capture and enforce bundle budget (C2)

|             |                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| **Finding** | `enforce: false`, no baseline                                                                             |
| **Owner**   | OWNER:CODE                                                                                                |
| **Address** | On a known-good `npm run build`, run `npm run check:bundle-budget -- --update`, then set `enforce: true`. |
| **Prove**   | CI fails on synthetic budget break; passes on baseline                                                    |

---

## Wave G — Frontend a11y P2

### G1. Fix dead `aria-describedby` (U1)

|             |                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Description span is `aria-hidden="true"` while referenced by `aria-describedby`                                        |
| **Owner**   | OWNER:CODE                                                                                                             |
| **Address** | Remove `aria-hidden` from description span in `mode-action-popup.tsx` (keep description out of the accessible _name_). |
| **Prove**   | Chromium a11y check / axe on action menu; unit DOM assertion                                                           |

### G2. Dynamic Lucide icons `aria-hidden` (U2)

|             |                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | ~25 variable `<Icon>` sites; ESLint rule gap                                                                                                                   |
| **Owner**   | OWNER:CODE                                                                                                                                                     |
| **Address** | Add `aria-hidden="true"` at all decorative dynamic icon sites; extend `eslint-rules/require-lucide-icon-aria.mjs` to track LucideIcon variables when feasible. |
| **Prove**   | Lint clean; spot-check mode menu / send button                                                                                                                 |

### G3. Close mode menu on Tab (U3)

|             |                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------- |
| **Finding** | Tab leaves `role="menu"` open                                                                |
| **Owner**   | OWNER:CODE                                                                                   |
| **Address** | In `handleModeOptionKeyDown`, on Tab: `setModeMenuOpen(false)` and allow default focus move. |
| **Files**   | `master-search-header.tsx`                                                                   |
| **Prove**   | Keyboard Playwright: open menu → Tab → menu gone                                             |

### G4. Announce answer readiness (U4)

|             |                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | No live region for streaming answer completion                                                                                                                   |
| **Owner**   | OWNER:CODE                                                                                                                                                       |
| **Address** | Keep/extend `role="status" aria-live="polite"` through loading → complete; announce start once and “Answer ready” (or equivalent) on completion — not per token. |
| **Files**   | `answer-status.tsx` / `ClinicalDashboard.tsx` / `answer-content.tsx`                                                                                             |
| **Prove**   | Accessibility test asserts status text transitions                                                                                                               |

---

## Wave H — API contract hygiene P2

### H1. Unify JSON error envelopes (S4 / S5)

|             |                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Auth and many routes return `{ error }` without `code`/`message`                                                                                                 |
| **Owner**   | OWNER:CODE                                                                                                                                                       |
| **Address** | Route all failures through `jsonError` / `PublicApiError`. Update auth helper first, then upload/document/feedback/demo paths in follow-up commits if too large. |
| **Prove**   | Contract tests for 401/400/404 sample paths                                                                                                                      |

### H2. Rate-limit authenticated write/admin routes (S6)

|             |                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| **Finding** | bulk / labels / table-facts / ingestion quality / eval-cases / jobs lack buckets                                |
| **Owner**   | OWNER:CODE                                                                                                      |
| **Address** | Assign buckets (reuse `document_read` or add `document_admin` / `ingestion_admin`); return 429 + `Retry-After`. |
| **Prove**   | Mocked exhaustion → 429                                                                                         |

### H3. Cap document list offset (S7)

|             |                                                                 |
| ----------- | --------------------------------------------------------------- |
| **Finding** | Offset max 1_000_000                                            |
| **Owner**   | OWNER:CODE                                                      |
| **Address** | Cap to e.g. 10_000 (match jobs) or introduce cursor pagination. |
| **Prove**   | Schema rejects high offset                                      |

### H4. Upload Content-Length admission (S8)

|             |                                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| **Finding** | Missing length reserves max body bytes                                         |
| **Owner**   | OWNER:CODE                                                                     |
| **Address** | Require Content-Length (411/400) or reserve after bounded read of actual size. |
| **Prove**   | Length-less small uploads do not exhaust global budget                         |

### H5. Authed summarize includes public docs (S9)

|             |                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------- |
| **Finding** | Stream summarize uses owner-only equality, excluding public corpus                          |
| **Owner**   | OWNER:CODE                                                                                  |
| **Address** | Use `withOwnerReadScope` / public-OR semantics in `summarizeDocument` when ownerId present. |
| **Files**   | `src/lib/rag.ts`, `src/app/api/answer/stream/route.ts`, summarize route                     |
| **Prove**   | Authed summary of public UUID succeeds                                                      |

### H6. Harden `/api/jobs` misconfig path (S11)

|             |                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------ |
| **Finding** | Missing server env returns demo jobs without auth                                          |
| **Owner**   | OWNER:CODE                                                                                 |
| **Address** | Authenticate first; on missing env return 503/`internal_error` outside explicit demo mode. |
| **Prove**   | Unauthed + broken env → non-200 without demo payload                                       |

---

## Wave I — P3 backlog (schedule, don’t block launch)

Address when touching the same files, or as a cleanup epic after Waves C–H.

| ID         | Issue                                                                                                       | Address sketch                                                                                                                                       | Prove                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| P3-R1      | Demotion floor `Math.max(hybrid_score, boosted)`                                                            | Clamp below hybrid only for explicit demotion delta; or subtract after floor; golden-eval gate any change                                            | `npm run eval:retrieval:quality` 36/36                                                                 |
| P3-R2      | D4 unknown blast radius                                                                                     | Docs + activation runbook: require governance enrichment % + golden eval before enabling                                                             | Operator checklist                                                                                     |
| P3-R3      | Governance-weighting principle wording                                                                      | Reconcile process-hardening / ranking docs with demotion-only policy                                                                                 | Doc consistency review                                                                                 |
| P3-I1      | Bare `updateJob` without lease                                                                              | Route stage updates through leased helper                                                                                                            | Worker unit/integration                                                                                |
| P3-I2      | Cleanup RPC JSONB vs typed column                                                                           | Forward migration to typed compare                                                                                                                   | Schema tests + drift                                                                                   |
| P3-I3      | NULL `p_worker_id` lease bypass                                                                             | Fail closed when worker id null for service callers; allowlist migrations                                                                            | SQL test                                                                                               |
| P3-S1      | 10-min signed URLs                                                                                          | Product decision: shorten TTL or bind                                                                                                                | Threat-model note                                                                                      |
| P3-S2      | Setup-status detail breadth                                                                                 | Gate on deep probe / admin role                                                                                                                      | Authed vs deep response shape                                                                          |
| P3-S3      | Auth callback error reflection                                                                              | Generic client message; server log detail                                                                                                            | Callback harness                                                                                       |
| P3-U1      | Forced-colors glass/gloss tokens                                                                            | Map to `Canvas` in `globals.css`                                                                                                                     | `verify:ui` a11y media                                                                                 |
| P3-U2      | Sheet `bg-black/45`                                                                                         | Use `--overlay-backdrop`                                                                                                                             | Visual parity                                                                                          |
| P3-U3      | `active:scale` without `motion-safe`                                                                        | Prefix `motion-safe:`                                                                                                                                | Reduced-motion check                                                                                   |
| P3-U4      | Brand squares forced-color-adjust                                                                           | `forced-color-adjust: none` on brand spans                                                                                                           | Forced-colors screenshot                                                                               |
| P3-C1      | Duplicate `test:e2e` aliases                                                                                | Keep one; alias documented or remove                                                                                                                 | `package.json`                                                                                         |
| P3-C2      | Spend/price env missing from example                                                                        | Document with defaults                                                                                                                               | Env parity script                                                                                      |
| P3-C3      | Orphan `reindex-eval-gate` location                                                                         | Move beside driver after E3                                                                                                                          | Import graph                                                                                           |
| P3-STRUCT1 | `client-env.ts` duplicates `isLocalNoAuthMode` / `publicUploadsEnabled` from `env.ts` via raw `process.env` | Keep intentional client/server split but share one normalized helper or document the allowed divergence; add a parity regression if values can drift | `npm run check:env-parity`; focused env unit that fails if client/server helpers disagree              |
| P3-STRUCT2 | `mockup`-named component files retained under `src/components/`                                             | Keep while gated by `mockupsEnabled()`, or rename/remove once production call sites no longer need the mockup path; record disposition in ledger     | Import/grep shows every production import goes through `mockupsEnabled()` or files are renamed/removed |
| P3-PERF    | Hybrid RPC latency tail                                                                                     | Capacity/RPC workstream (existing RAG findings #25) — not a drive-by                                                                                 | p90 metrics                                                                                            |
| P3-SIZE    | Large modules                                                                                               | Continue extractive decomp when editing `rag.ts` / dashboard                                                                                         | LOC ratchet optional                                                                                   |

---

## Wave J — Release confidence close-out

After Waves B–H land (or are deferred with dated waiver):

1. `⏸ npm run check:supabase-project`
2. `⏸ npm run check:drift` (allowlist empty → any surprise is a stop)
3. `⏸ npm run check:production-readiness` (configured prod context)
4. `⏸ npm run eval:retrieval:quality` + `npm run eval:quality -- --rag-only`
5. `⏸ npm run verify:release`
6. Update PIA / backlog / this plan’s status column (add a “Status” column locally as work completes)
7. Record outcomes in [`branch-review-ledger.md`](branch-review-ledger.md)

---

## Priority matrix (quick view)

| Priority                                | IDs                  | Launch impact                 |
| --------------------------------------- | -------------------- | ----------------------------- |
| Block real patients                     | B1, B2               | Legal + secret placement      |
| Block next release claim                | B3, B4, J            | Evidence missing              |
| Fix before wide anon traffic            | Wave C1              | DoS / cost                    |
| Fix before multi-tenant trust expansion | Waves D1, D2, D5     | Disclosure / regression class |
| Fix before next reindex / recovery      | E1–E3                | Index correctness             |
| Fix before next UI merge wave           | F1–F4, G1–G4         | Silent CI holes / a11y        |
| Hygiene                                 | H1–H6, F5–F6, Wave I | Contracts & debt              |

---

## Out of scope for this plan

- Broad product redesign or RAG Phase-N architecture beyond the listed P3 ranking floor
- Forced dependency upgrades (`dependency` shortcut)
- Destructive branch cleanup
- Live mutations without explicit operator confirmation

---

## Tracking

Append progress to the review ledger when a wave completes, and flip matching rows in
[`operator-backlog.md`](operator-backlog.md). Prefer linking PRs back to issue IDs in this document
(`Wave C1`, `Wave E2`, …) in the PR body.
