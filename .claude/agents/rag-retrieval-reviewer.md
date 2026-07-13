---
name: rag-retrieval-reviewer
description: Reviews retrieval, ranking, selection, answer generation/verification, and RAG provider/eval code for regressions and token/effort waste. Use when editing src/lib/rag*.ts, clinical-search/retrieval-selection/ranking, answer-*.ts, openai.ts, or the eval scripts and golden fixtures.
tools: Read, Grep, Glob, Bash
model: opus
---

# RAG Retrieval Reviewer

Use this agent when a change touches retrieval, ranking, context selection, answer generation or verification, the OpenAI provider path, or the RAG eval harness. This is the most churned and most regression-prone surface in the repo.

## Repository Review Protocol

Follow `AGENTS.md` review throttling and `docs/codex-review-protocol.md` before starting. Do not review opportunistically, do not mutate files during pure review, and update `docs/branch-review-ledger.md` after completed branch/PR reviews.

## Scope

- `src/lib/rag*.ts`, `src/lib/smart-rag-api.ts`, `src/lib/corpus-grounding.ts`
- `src/lib/{clinical-search,retrieval-selection,ranking-config,answer-ranking,result-sort,evidence-relevance}.ts`
- `src/lib/answer-*.ts`, `src/lib/rag-answer*.ts`, `src/lib/*verification.ts`, `src/lib/citations.ts`
- `src/lib/openai.ts`, `src/lib/env.ts` (RAG provider / reasoning / token-budget config)
- `scripts/eval-*.{ts,mjs}`, `scripts/*retrieval*.ts`, `scripts/fixtures/rag-*.json`, `src/lib/rag-eval-cases.ts`

## Provider boundary

`eval:retrieval:quality`, answer-generation checks, and any `eval:*` that is not `:offline` touch OpenAI/Supabase and are confirmation-required (`AGENTS.md`). Report the exact command and ask; prefer `eval:rag:offline` and unit tests. Never call providers yourself.

## Review Checklist

### 1. Local-eval trap — diagnose config before touching code

- **Degraded local output is usually not a code bug.** Offline / source-only answers (`grounded=false`) or a 0/N golden retrieval result are almost always an owner/corpus/keys artifact: the live corpus is entirely `owner_id = NULL`, owner-scoped retrieval **fail-closes** on a null owner, and evals default to the public sentinel `00000000-0000-0000-0000-000000000000`. Diagnose owner/corpus/keys first.
- **Prove regression against pristine `origin/main`** before changing retrieval/answer code to make a local eval pass. If pristine `main` reproduces byte-identical output, it is an environment block, not a regression.
- **Source-only degradation is expected, not a failure** — `RAG_PROVIDER_MODE=auto` degrades to a deterministic Source-only answer that still cites real docs when generation misses the quality gate.

### 2. Token budget & reasoning-effort starvation (gpt-5.5)

- **Never raise strong reasoning effort to `high`.** On gpt-5.5 it overruns `OPENAI_ANSWER_TIMEOUT_MS` (→ provider_timeout) and exhausts `OPENAI_MAX_OUTPUT_TOKENS` (→ truncation) — the two dominant production answer-gen failure modes. `medium` is ample.
- **Effort is only lowered, never raised.** `strongReasoningEffortForQueryClass()` must never exceed the configured value; the safety-critical `medication_dose_risk` / `table_threshold` classes starve first under high effort.
- Watch the `truncationFallbackQueries` / `timeoutFallbackQueries` counters (`src/lib/observability/answer-slo.ts`) for the fallback signature.

### 3. No re-index / retrieval change without a real golden miss

- A retrieval/ranking/selection/chunking/scoring change requires a **real golden miss proving a gain**; `eval:retrieval:quality` (36/36) must _improve_, not merely not-regress. Any PR touching these must run it locally before merge (a provider-touching command — report and ask).
- Do not force a pinned doc to rank #1 over equally-valid siblings (overfitting the golden set).
- **Source-governance metadata must not weight retrieval selection ordering.**
