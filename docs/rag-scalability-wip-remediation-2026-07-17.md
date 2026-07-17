# RAG-scalability WIP review — remediation report (2026-07-17)

**Status:** F11 shipped and merged; all correctness findings verified moot on this
branch; scalability build recorded and deferred pending go-ahead.
**Responds to:** the "Handover — RAG scalability WIP review findings (2026-07-15)"
remediation plan (findings F1–F16).
**Branch:** `claude/audit-findings-review-phgz92` → merged to `main` via **PR #676**.
**Author:** remediation pass, 2026-07-17. No production mutations, no Supabase apply,
no OpenAI/provider calls.

---

## 1. Executive summary

The handover was written against an **unmerged WIP snapshot** — detached HEAD
`570e6ba` plus _uncommitted_ working-tree changes. By the time this remediation
pass ran, `main` had advanced **28 commits** past that base (to `e75fad9`) and
**none of the reviewed WIP had been carried forward**. Because the WIP was never
committed, it is also not recoverable.

Consequence: **the P1/P2 correctness findings had no code to patch.** They describe
bugs _inside_ WIP that does not exist on this branch. Every finding was verified
against the actual tree before any action:

- **1 finding was already in its recommended end-state** (F1).
- **1 finding was live and actionable** (F11) — fixed and merged.
- **9 findings target absent WIP code** (F2–F9, F12, F16) — moot.
- **4 findings are pre-existing product/architecture items, not WIP defects**
  (F10, F13, F14, F15).

There was **no active bug, data-loss risk, or clinical-harm risk** on this branch
at any point during the pass.

---

## 2. Verdict table

| ID      | Finding (as written in handover)                         | Target on this branch                                                                                                               | Disposition                                                                |
| ------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **F1**  | `registryCorpusDetailHref` typing breaks callers         | `src/lib/registry-corpus-links.ts` already uses loose `unknown` params + `typeof` guards                                            | **Moot** — already the recommended state; `src`/`supabase` typecheck clean |
| **F2**  | `ChunkLoadCache` negative-caches failures                | No `ChunkLoadCache` anywhere; only pre-existing uncached `loadChunksForSignalMatches`                                               | **Moot** — cache does not exist                                            |
| **F3**  | Registry cleanup trigger: `::uuid` cast aborts deletes   | `cleanup_registry_corpus_document` absent from `schema.sql` + migrations                                                            | **Moot** — trigger does not exist                                          |
| **F4**  | Corrector "scalability" table/index unused               | No `document_title_words`, no corrector rewrite; live `correct_clinical_query_terms` is the pre-existing, `revoke`-hardened version | **Moot** — WIP rewrite not present                                         |
| **F5**  | New table-facts trgm index mismatches `trgm_matches`     | Wide `document_table_facts_text_trgm_idx` absent; correct narrow `…title_row_param_trgm_idx` present and matches the RPC            | **Moot** — wide index never added                                          |
| **F6**  | Cache not keyed by access scope (latent authz)           | Depends on F2 cache                                                                                                                 | **Moot** — no cache                                                        |
| **F7**  | Concurrent overlapping-miss race                         | Depends on F2 cache                                                                                                                 | **Moot** — no cache                                                        |
| **F8**  | Schema / migration / test drift                          | WIP migrations `…180000` / `…190000` absent                                                                                         | **Moot** — no WIP migrations                                               |
| **F9**  | New `SECURITY DEFINER` helpers miss revokes              | Those helpers do not exist                                                                                                          | **Moot** — helpers absent                                                  |
| **F10** | Title vocab is global under `SECURITY DEFINER` (tenancy) | Pre-existing corrector shape; product decision                                                                                      | **Deferred** — product decision (see §5)                                   |
| **F11** | Favourites set accent gradient bars (design)             | `src/components/clinical-dashboard/favourites-library-nav.tsx`                                                                      | **✅ Fixed & merged** (see §3)                                             |
| **F12** | Accidental `pnpm-lock.yaml`                              | Not present in repo                                                                                                                 | **Moot** — file absent                                                     |
| **F13** | Mockup hardcoded hex / focus colours                     | `src/components/favourites-page-mockups/*` (mockup routes)                                                                          | **Deferred/optional** — mockup-only; handover says leave unless long-lived |
| **F14** | Pill / glow density                                      | Existing product chrome                                                                                                             | **Non-goal** — explicitly not a defect                                     |
| **F15** | `rag.ts` facade size (~4.8k lines)                       | Architectural residual                                                                                                              | **Out of scope** — not a defect; large refactor                            |
| **F16** | Cross-table shared cleanup key                           | Depends on F3 trigger                                                                                                               | **Moot** — trigger absent                                                  |

---

## 3. What was fixed — F11 (favourites accent bars)

**File:** `src/components/clinical-dashboard/favourites-library-nav.tsx`
**Commit:** `de0294b` · **Merged:** PR #676 → `main`.

### Problem

The mobile "saved sets" carousel painted each `SetBrowseCard`'s top accent bar with
one of four decorative two-hue gradients selected by `index % 4`, including a
`--tone-purple → --tone-rose` marketing sweep and a bar built on the **semantic
`--warning` colour**. Design review flagged the multi-hue gradients as off-tone for
the clinical "dense, calm, scan-fast" UI, and decorative use of `--warning` risks
reading as a caution signal.

### Change

Replaced the four-gradient array + `getSetAccentBar(index)` helper with a single
solid `--clinical-accent` bar, matching the card's own selected/hover/icon accent:

```diff
-const setAccentBars = [
-  "bg-gradient-to-r from-[color:var(--clinical-accent)] to-[color:var(--tone-indigo)]",
-  "bg-gradient-to-r from-[color:var(--info)] to-[color:var(--tone-indigo)]",
-  "bg-gradient-to-r from-[color:var(--tone-purple)] to-[color:var(--tone-rose)]",
-  "bg-gradient-to-r from-[color:var(--warning)] to-[color:var(--tone-rose)]",
-];
-
-function getSetAccentBar(index: number) {
-  return setAccentBars[index % setAccentBars.length];
-}
+// Calm, single clinical accent for saved-set cards. Avoids decorative multi-hue
+// gradients (and semantic colours like --warning) so the carousel stays quiet and
+// scan-first, consistent with the card's own --clinical-accent selected/hover states.
+const setAccentBar = "bg-[color:var(--clinical-accent)]";
```

Notes:

- The bar remains `aria-hidden`; **selected / hover / `focus-visible` states are
  untouched.**
- Colour was assigned by **carousel position** (`index % 4`), not set identity, so
  **no semantic distinction is lost.**
- Net diff: **+6 / −12** lines, one file.

### Verification (local, offline)

- `npm run typecheck` — **no `src/` or `supabase/` errors.** (The only failures are
  pre-existing `tests/` errors from missing optional dev deps —
  `@testing-library/react`, `@axe-core/playwright` — absent in this container and
  unrelated to the change.)
- `npx eslint` on the changed file — **clean.**
- `git diff --check` — **clean.**
- Not run: `verify:ui` (needs Chromium/`ensure` server in this container). Change is
  a single design-token swap on a decorative element with no layout/behaviour change.

### CI / review outcome on #676

All required checks green (Build, Unit coverage, Critical UI smoke, Safety/config,
Semgrep, Gitleaks, GitGuardian, Change scope; advisory UI jobs passed). Migration
replay and Supabase Preview correctly **skipped** (no `supabase/` changes).
CodeRabbit: **no actionable comments** (rated "Trivial"). PR merged.

---

## 4. What was deliberately NOT done

- **The scalability WIP was not reconstructed.** Re-creating buggy WIP just to patch
  it is nonsensical; delivering the feature correctly is a separate build (see §5).
- **No live Supabase apply, no OpenAI eval, no provider calls** — per the AGENTS.md
  confirmation boundary.
- **F13/F14/F15** left as-is: mockup-only hygiene, explicit non-goal, and a large
  architectural refactor respectively — none are defects on this branch.

---

## 5. Scalability build — recorded decision, honest impact, and status

The remaining findings can only be "resolved" by **building the scalability feature
correctly from scratch.** The following was captured for that build:

**Scope decision:** build the full Track A.
**Product decisions resolved:**

- **F4/F10 — corrector title-vocab tenancy:** **public titles only**
  (`owner_id IS NULL`). Safest: no private-title side-channel or cross-tenant bias;
  matches conservative clinical/privacy defaults.
- **F5 — table-facts trgm index:** **drop the wide index, keep the narrow one.**
  Least write-amplification; keeps the index matched to `trgm_matches`.

### Honest impact assessment

At the current **~2,000-document corpus and current load, the near-term
user-visible difference is small.** None of this fixes an active bug.

| Component                                  | What it buys                                                                                                                                                                                               | Matters now?                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Request-scoped chunk-load cache (F2/F6/F7) | Small per-query retrieval-latency win from de-duping overlapping chunk hydration. The careful build avoids _dropping real sources_ on transient DB errors and avoids _cross-access-scope reuse_ (privacy). | Safety value only exists because we'd be adding the cache; skipping it introduces no regression. |
| Registry cascade-cleanup (F3/F9/F16)       | Auto-removes orphaned corpus docs when a registry/medication/differential record is deleted. Safe version avoids a malformed-metadata row aborting the delete transaction.                                 | Only if registry records are actually deleted in practice.                                       |
| Corrector title-words index (F4)           | Query-correction latency scales with candidates, not corpus size.                                                                                                                                          | Future-proofing; full-scan likely fine at ~2k docs. Pays off at 10k–20k+.                        |
| Drop wide trgm index (F5)                  | Avoids redundant index write-cost.                                                                                                                                                                         | Effectively a no-op for the running app.                                                         |
| Schema lifecycle + stronger tests (F8)     | Safe migration re-apply; CI catches contract drift.                                                                                                                                                        | Ops reliability, invisible to users.                                                             |

**Genuine value = scale headroom + data hygiene, not an urgent fix.**

### Status: **deferred pending explicit go-ahead**

The build is a Supabase-migration + RAG-hydration change (both clinical-critical),
warranting its own branch/PR with the offline RAG eval attached. It was **not**
started because the payoff is future-facing and the owner was weighing whether it is
worth the effort now.

### Packaging note

PR #676 (F11) was set to auto-merge and has merged. A high-risk migration should
**not** ride an auto-merging PR — the scalability build belongs on a fresh branch
(restarted from latest `main`, since this branch's PR is now merged).

---

## 6. Recommendation & next steps

1. **F11 is done and merged — no further action.**
2. **Scalability build:** recommend **defer** for now (nothing broken; payoff is at
   larger scale), **or** build just the **highest-value slice** (chunk-cache safety +
   registry orphan cleanup) if registry deletions are known to occur. Full build is
   warranted when deliberately provisioning for a 10k–20k+ document corpus.
3. If the build proceeds: restart `claude/audit-findings-review-phgz92` from latest
   `origin/main`, implement with the §5 decisions, TDD the `ChunkLoadCache`,
   strengthen `tests/supabase-schema.test.ts`, run `typecheck` + focused Vitest +
   `verify:cheap` offline, and **ask before any live Supabase apply or OpenAI eval.**

---

## 7. Verification ledger for this pass

| Check                                                                                                                                              | Result                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Full-tree grep for WIP identifiers (`ChunkLoadCache`, `cleanup_registry_corpus_document`, `document_title_words`, wide trgm index, WIP migrations) | **No remnants**                                                       |
| `git` ancestry: `570e6ba` vs `HEAD`                                                                                                                | ancestor, 28 commits behind; WIP not carried forward                  |
| `npm run typecheck`                                                                                                                                | No `src`/`supabase` errors (only unrelated `tests/` dev-dep failures) |
| `npx eslint` on changed file                                                                                                                       | Clean                                                                 |
| `git diff --check`                                                                                                                                 | Clean                                                                 |
| PR #676 required CI                                                                                                                                | All green; merged                                                     |
| Live Supabase apply / OpenAI eval / `verify:ui`                                                                                                    | Not run (out of scope / provider boundary)                            |
