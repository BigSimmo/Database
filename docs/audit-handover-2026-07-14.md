# Handover — repository audit findings (2026-07-14)

**Purpose:** Single handoff artifact for the multi-skill repository audit. Use this to continue
remediation without re-running discovery.

| Field            | Value                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Audit HEAD       | `570e6ba56ae60bea56a32801b9cc96c5a8dfde4f` (`main` at audit time)                            |
| Audit date       | 2026-07-14                                                                                   |
| Mode             | Pure review (no app-code fixes applied as part of the audit)                                 |
| Remediation plan | [`audit-remediation-plan-2026-07-14.md`](audit-remediation-plan-2026-07-14.md)               |
| Ledger rows      | [`branch-review-ledger.md`](branch-review-ledger.md) (multi-skill + consolidated rows)       |
| Plan PR          | [#673](https://github.com/BigSimmo/Database/pull/673) (`cursor/audit-remediation-plan-0411`) |
| Ledger-only PR   | [#652](https://github.com/BigSimmo/Database/pull/652) (`cursor/repo-wide-audit-ledger-0411`) |

---

## 1. Verdict

- **No confirmed P0/P1 cross-tenant-breach or clinical-governance-bypass defects** were found in
  application source. This scoping is deliberate: other P1-severity issues exist outside those two
  defect classes.
- **Active majors** include six items: five **operator / legal / launch-confidence** blockers (M1-M3,
  M5-M6) plus one **code P1 availability defect** (M4: anonymous catalog rate-limit bypass). The code
  P1 must not be under-prioritized relative to the operator/legal items.
- Offline structure gate was green at audit time (`verify:cheap` ~2,290 tests / 2 skipped).
- Provider-backed gates (`check:drift`, golden evals, `verify:release`, live advisors) were **not**
  run (API confirmation boundary).

**Highest residual risks if nothing else is fixed:** APP 8 overseas processing, unproven release
evals, service-role tenancy regression class, upstream OCR quality labels driving danger refusal.

---

## 2. Skills run

| Skill / pass           | Outcome summary                                                        |
| ---------------------- | ---------------------------------------------------------------------- |
| Repo auditor           | No P0/P1 structural defects; P2 env/orphan/bundle                      |
| Security review        | No confirmed IDOR P0; P1 privacy (PIA-1); P2 DTO/tenancy/auth UI       |
| Clinical governance    | No P0/P1; fail-closed answer path looks solid; P3 ranking notes        |
| RAG retrieval          | D4/D5 default-OFF confirmed safe; P3 demotion floor                    |
| Ingestion worker       | No P0/P1; P2 unreachable commit fallback, recovery crash, unwired gate |
| API review             | P1 anon catalog rate-limit bypass; P2 envelopes/limits/summarize       |
| Frontend UI / a11y     | No P0; P2 describedby / icons / Tab / live region                      |
| Release readiness      | Launch blocked on OPS/LEGAL; backlog drift vs runbooks                 |
| Testing / code quality | CI scope holes; soft critical safety assert; flake debt                |

---

## 3. Active major issues

### M1 — PIA-1 overseas processing (OPERATOR / LEGAL — P0 for real-patient use)

|                        |                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **What**               | Queries (and excerpts when synthesizing) process via Railway Singapore + OpenAI US |
| **Where**              | `docs/privacy-impact-assessment.md`, `docs/openai-cross-border-basis.md`           |
| **Risk**               | Sensitive health info overseas without closed APP 8 / contractual basis            |
| **Address**            | Remediation Wave B1 — DPA / ZDR / processor record + counsel                       |
| **Status at handover** | Open (DPA rows still `_no_`)                                                       |

### M2 — PIA-2 `RAG_QUERY_HASH_SECRET` on Railway (OPERATOR — P1)

|                        |                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **What**               | Code fails closed without secret; GitHub has it; Railway runtime still `🔎 verify` |
| **Where**              | `docs/operator-backlog.md`, `src/lib/env.ts` / instrumentation boot guard          |
| **Risk**               | Boot fail or weak query hashing in prod                                            |
| **Address**            | Remediation Wave B2 — confirm same ≥16-char value in Railway                       |
| **Status at handover** | Verify pending                                                                     |

### M3 — Release gate / evals / canary / staging incomplete (OPERATOR — P1)

|                        |                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **What**               | `verify:release`, golden retrieval 36/36, rag-only quality, staging soak, Eval Canary two greens not closed; prior OpenAI embedding quota exhaustion |
| **Where**              | `docs/operator-backlog.md`, `docs/launch-operator-runbook.md`                                                                                        |
| **Risk**               | Cannot claim clinical release confidence                                                                                                             |
| **Address**            | Remediation Waves B3–B4 + J                                                                                                                          |
| **Status at handover** | Pending                                                                                                                                              |

### M4 — Anonymous public catalogs skip rate limits (CODE — P1)

|                        |                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **What**               | No-auth catalog GETs short-circuit before rate limiting; large JSON possible                                                                                 |
| **Where**              | `src/lib/public-api-access.ts:73–76` (`shouldResolvePublicCatalogAccess`); e.g. `src/app/api/medications/route.ts:108+`; same pattern registry/differentials |
| **Risk**               | Egress/CPU DoS by omitting auth                                                                                                                              |
| **Address**            | Remediation Wave C1 — always rate-limit anon + prefer `fields=index` default                                                                                 |
| **Prove**              | Unauth GET still hits limiter; payload size capped                                                                                                           |
| **Status at handover** | Unfixed                                                                                                                                                      |

### M5 — Operator backlog vs runbook drift (PROCESS — P1 for ops error)

|                        |                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| **What**               | Backlog still `⏳` for items runbook/other docs treat as done/verify                                   |
| **Where**              | `docs/operator-backlog.md` vs `docs/launch-operator-runbook.md`, empty `supabase/drift-allowlist.json` |
| **Risk**               | Wrong re-apply or false unfinished state                                                               |
| **Address**            | Remediation Wave A1 — reconcile with live migration list / drift                                       |
| **Status at handover** | Open                                                                                                   |

### M6 — Single-layer tenancy (ARCHITECTURE — P1 regression class)

|                        |                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **What**               | APIs use service role; ownership enforced in app helpers/RPCs, not full second-layer RLS for public-overlay model |
| **Where**              | `createAdminClient()`, `withOwnerReadScope`, `retrieval_owner_matches`; `docs/tenancy-defense-in-depth-review.md` |
| **Risk**               | Future route forgetting owner scope → private corpus leak                                                         |
| **Address**            | Remediation Wave D2 — CI unscoped-query guard + live A/B                                                          |
| **Status at handover** | Mitigated in current routes; guard not yet coded                                                                  |

---

## 4. Sub-issues (P2)

### 4.1 Security / privacy / API

| ID  | Finding                                                     | Evidence                                                  | Remediation wave |
| --- | ----------------------------------------------------------- | --------------------------------------------------------- | ---------------- |
| S1  | Authed public-doc DTOs leak `storage_path` / `content_hash` | `documents/route.ts`, `documents/[id]/route.ts`           | Wave D1          |
| S2  | Auth UI trusts `getSession()`; APIs use `getUser`           | `src/lib/supabase/client.tsx`                             | Wave D3          |
| S3  | Public-upload quarantine pool high blast radius if enabled  | `upload/route.ts` + pool owner                            | Wave D4          |
| S4  | Auth 401 envelope `{ error }` only                          | `supabase/auth.ts` vs `http.ts`                           | Wave H1          |
| S5  | Many hand-rolled `{ error }` omit `code`/`message`          | upload, doc 404s, feedback, demo                          | Wave H1          |
| S6  | Auth write/admin routes lack rate limits                    | bulk, labels, table-facts, ingestion/\*, eval-cases, jobs | Wave H2          |
| S7  | Document list offset max `1_000_000`                        | `documents/route.ts`                                      | Wave H3          |
| S8  | Upload reserves max body when Content-Length absent         | `upload/route.ts`                                         | Wave H4          |
| S9  | Authed stream summarize excludes public docs                | `answer/stream` → `summarizeDocument` owner-only          | Wave H5          |
| S10 | Bulk returns raw DB `error.message`                         | `documents/bulk/route.ts`                                 | Wave D5          |
| S11 | `/api/jobs` can return demo jobs when env missing           | `jobs/route.ts`                                           | Wave H6          |

### 4.2 Ingestion / indexing

| ID  | Finding                                                        | Evidence                                              | Remediation wave |
| --- | -------------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| I1  | Unreachable commit fallback after `throw`                      | `worker/main.ts:544–547`                              | Wave E1          |
| I2  | Recovery `pending`+`failed` → two retries → unique index crash | `ingestion-recovery.ts`, `recover-ingestion-queue.ts` | Wave E2          |
| I3  | `decideReindexGate` never wired into `scripts/reindex.ts`      | grep shows no production driver                       | Wave E3          |

### 4.3 Structure / config / CI / testing

| ID         | Finding                                                       | Evidence                            | Remediation wave    |
| ---------- | ------------------------------------------------------------- | ----------------------------------- | ------------------- |
| Finding C1 | `.env.example` weak-OR flag `true` vs code default `false`    | env example vs `env.ts`             | Wave F5             |
| C2         | Bundle budget unenforced (`enforce: false`, null baseline)    | `bundle-budget.json`                | Wave F6             |
| C3         | CI `ui_changed` skips `app-modes` / `ui-copy` / route helpers | probed `ui_changed: false`          | Wave F1             |
| C4         | CI `rag_eval` skips `clinical-safety` / privacy libs          | probed `rag_eval_changed: false`    | Wave F2             |
| C5         | Known flakes in blocking suite; `@quarantine` unused          | `flake-ledger.json` (4)             | Wave F4             |
| C6         | Soft `@critical` safety UI assert                             | `ui-smoke.spec.ts` optional trigger | Wave F3             |
| C7         | `waitForTimeout` / swallowed `networkidle` in UI smoke        | `ui-smoke.spec.ts`                  | Wave F4             |
| C8         | `reindex-eval-gate.ts` production orphan (~488 lines)         | tests only                          | Wave E3 / Wave I P3 |

### 4.4 Frontend / a11y

| ID  | Finding                                               | Evidence                   | Remediation wave |
| --- | ----------------------------------------------------- | -------------------------- | ---------------- |
| U1  | `aria-describedby` → `aria-hidden` description (dead) | `mode-action-popup.tsx`    | Wave G1          |
| U2  | ~25 dynamic Lucide `<Icon>` missing `aria-hidden`     | ESLint rule gap            | Wave G2          |
| U3  | Mode menu does not close on Tab                       | `master-search-header.tsx` | Wave G3          |
| U4  | No live region for answer ready / stream complete     | answer surfaces            | Wave G4          |

---

## 5. Sub-issues (P3)

| ID       | Finding                                                                                | Notes                             |
| -------- | -------------------------------------------------------------------------------------- | --------------------------------- |
| P3-R1    | Demotion floor `Math.max(hybrid_score, boosted)` at `rag.ts:663`                       | Weakens feature D4 when activated |
| P3-R2    | Feature D4 hits corpus-wide `document_status: "unknown"` default                       | Activation needs golden eval      |
| P3-R3    | `outdatedPenalty` ON vs "no governance weighting" wording                              | Demotion-only, documented tension |
| P3-I1    | Bare `updateJob` without lease filter                                                  | Cosmetic race                     |
| P3-I2    | Cleanup RPC still uses JSONB path vs typed column                                      | Forward migrate                   |
| P3-I3    | NULL `p_worker_id` bypasses lease in RPCs                                              | Footgun                           |
| P3-S1    | Signed URL 10‑min bearer lifetime                                                      | Product threat model              |
| P3-S2    | Setup-status detail for any authed user                                                | Info disclosure                   |
| P3-S3    | Auth callback reflects provider errors into URL                                        | Minor leak/UX                     |
| P3-U1–U4 | Forced-colors glass/gloss; Sheet overlay token; reduced-motion scale; brand hex adjust | UI polish                         |
| P3-C1    | Duplicate `test:e2e` / `test:e2e:all`                                                  | Alias cleanup                     |
| P3-C2    | Spend/price env vars missing from `.env.example`                                       | Docs                              |
| P3-PERF  | Hybrid RPC latency tail                                                                | Capacity workstream               |
| P3-SIZE  | Large modules (`rag.ts`, dashboard, document viewer)                                   | Continue decomp when touching     |

Full address sketches: Remediation Wave I in the remediation plan.

---

## 6. What looks solid (do not “fix” casually)

- Fail-closed `buildGovernedAnswerClientResponse` on `/api/answer` and stream; no provisional
  clinical prose before governance
- Numeric / quote / citation verification; prompt-injection sanitization
- Owner-scope fail-closed helpers; query hash redaction defaults
- D4/D5 (#649) default-OFF and fail-safe
- Architecture-boundaries: no import cycles; server modules isolated from client graph
- July-8 ingestion batch marked live-verified in backlog (`✅`)
- Offline cheap gate green at audit HEAD

---

## 7. Checks run / not run

| Ran                                                | Not run (need confirmation)                         |
| -------------------------------------------------- | --------------------------------------------------- |
| Specialist static audits                           | Live Supabase / OpenAI / Railway                    |
| Structure `verify:cheap` (reported green)          | `check:drift`, `check:supabase-project`             |
| Focused Vitest (governance, RAG, ingestion suites) | `eval:retrieval:quality`, `eval:quality --rag-only` |
| `ci-change-scope` probes for scope holes           | `verify:release`, `verify:ui`                       |
|                                                    | `check:production-readiness` with live secrets      |
|                                                    | Security advisors / live A/B tenancy                |

---

## 8. Suggested next actions for the receiving agent

1. Read this file + [`audit-remediation-plan-2026-07-14.md`](audit-remediation-plan-2026-07-14.md).
2. **Do not** re-audit the whole repo unless HEAD changed materially — check ledger first.
3. Prefer first CODE PR: **Remediation Wave C1 + Wave D1** (catalog rate limits + public DTO redaction).
4. Parallel OPS track: Wave A reconcile backlog, then Wave B2 secret verify, then Wave B1 legal.
5. Keep PRs one theme each (see remediation plan "Suggested PR granularity").
6. After each wave: update this handover's status notes, flip backlog rows, and update the existing
   ledger row for the current branch/ref. Only append a new ledger row when the branch/ref, HEAD SHA,
   or review scope changes, or when a fresh review is explicitly requested.

### Suggested first CODE PR checklist

- [ ] Remediation Wave C1: anonymous catalog rate limits (finding M4) (+ tests)
- [ ] Remediation Wave D1: redact `storage_path` / `content_hash` for non-owner public docs (finding S1)
- [ ] `npm run verify:cheap` + focused route tests
- [ ] `npm run verify:pr-local` before handoff
- [ ] Link PR body to finding IDs (M4, S1)

---

## 9. Related references

| Doc                                                                            | Role                             |
| ------------------------------------------------------------------------------ | -------------------------------- |
| [`audit-remediation-plan-2026-07-14.md`](audit-remediation-plan-2026-07-14.md) | How to fix, sequenced            |
| [`operator-backlog.md`](operator-backlog.md)                                   | Human/provider actions index     |
| [`launch-operator-runbook.md`](launch-operator-runbook.md)                     | Sequenced launch commands        |
| [`privacy-impact-assessment.md`](privacy-impact-assessment.md)                 | PIA register                     |
| [`openai-cross-border-basis.md`](openai-cross-border-basis.md)                 | APP 8 checklist                  |
| [`tenancy-defense-in-depth-review.md`](tenancy-defense-in-depth-review.md)     | Tenancy defense notes            |
| [`process-hardening.md`](process-hardening.md)                                 | Process & known debts            |
| [`codex-review-protocol.md`](codex-review-protocol.md)                         | Review severity / mutation rules |
| [`branch-review-ledger.md`](branch-review-ledger.md)                           | Prevent repeat audits            |

---

## 10. Explicit non-actions at handover

- No application source was patched for these findings in the audit session.
- No live Supabase/OpenAI/Railway mutations were performed.
- No merge to `main`, force-push, or branch cleanup.
- Remediations require separate feature PRs per wave/theme.
