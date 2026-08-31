# RAG evaluation baseline record

**Status:** maintained record, created 2026-08-17 by programme packet S4 (B0); re-recorded
2026-08-18 by packet S2 when the answer prompt moved to `clinical-rag-answer-v19` (the validator
cross-checks the prompt version, so a prompt bump always re-captures this record). This is the
baseline named by [README.md](README.md) §B0. The machine-readable source of truth is
`scripts/fixtures/rag-adversarial-baseline.v1.json`, validated by
`npm run check:rag:adversarial-fixtures`; this page explains what the fields mean and why the
provider-backed gates are recorded as pending rather than filled in.

## 1. The report key

Every report the programme produces — the offline adversarial runner (packet B2), the Docling
lab benchmark (packet B3), and any later evaluation — stamps the same six fields, in this order,
so two reports can be compared without guessing what changed between them.

| Field                 | This baseline                                                  | Where it comes from                                                         |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `commit_sha`          | `b7aa925f0ae19e89a9f0acf842b4a80d84083fb5`                     | `git rev-parse HEAD` of the evaluated tree. Full 40 characters, enforced.   |
| `dataset_version`     | `rag-adversarial-cases.v1`                                     | The fixture dataset's own `datasetVersion`; cross-checked against the file. |
| `eval_config_version` | `rag-eval-config-v2`                                           | Bumped by hand whenever a case list, threshold, or gate semantic changes.   |
| `model_version`       | `answer=gpt-5.6-terra; fast=gpt-5.6-terra; strong=gpt-5.6-sol` | The resolved answer-model defaults in `src/lib/env.ts`.                     |
| `embedding_version`   | `text-embedding-3-small@1536`                                  | `OPENAI_EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` in `src/lib/env.ts`.    |
| `index_version`       | `20260818090000_schema_drift_snapshot_history_probe`           | The latest applied migration — the index shape the retrieval RPCs run on.   |

The field set and its order are pinned by `tests/rag-adversarial-fixtures.test.ts`. Adding,
removing, or reordering a field is a deliberate contract change, not an edit.

Two further values sit outside the key because they qualify the whole record rather than
identify a run: `promptVersion` is `clinical-rag-answer-v19`, cross-checked at validation time
against `src/lib/rag/rag-versioning.ts` so the record cannot describe a superseded prompt; and
`semanticRerankEnabled` is `false`, which the validator requires, because issue `#001` keeps the
ambiguity-band semantic reranker off until an approved comparison exists.

## 2. Gate results

| Gate                   | Cases | Status            | Result                                                                 |
| ---------------------- | ----- | ----------------- | ---------------------------------------------------------------------- |
| `retrieval_golden`     | 36    | pending owner run | Provider-backed; last recorded green at `4ea310e48` (run 32100681177). |
| `answer_gate`          | 44    | pending owner run | Provider-backed; 44/44 at `4ea310e48` under prompt v18 (§3).           |
| `answer_quality`       | 30    | pending owner run | Provider-backed; S2 before/after requested, not run (§4).              |
| `offline_contract`     | 26    | recorded          | 26 suites, 623 tests passed.                                           |
| `adversarial_fixtures` | 24    | recorded          | 24 synthetic cases, 8 categories, 6 canaries, report canary-free.      |

Three of the five gates are marked `pending_owner_run` rather than carrying a number. That is
the point of the record's shape, not a gap in it: `eval:retrieval:quality`, the `ragEvalCases`
answer gate, and `eval:answer-quality` all reach live Supabase and OpenAI, so they fire only via
the owner-approved `eval-canary` dispatch. The validator enforces the distinction — a gate is
either `recorded` with a result **and** the run or file it came from, or `pending_owner_run` with
a stated reason and no result. A number cannot be entered without provenance.

Where an earlier run exists at a different commit it is carried as `priorRun`, which is history
and explicitly not a result for this tree.

**To complete the baseline:** with owner approval, dispatch the `eval-canary` pair at the merge
commit, then flip each pending gate to `recorded` with its run id, and update `commit_sha`.

## 3. Resolved discrepancy — the answer gate denominator is 44

Reconciled by packet S5 (2026-08-17) against run `32025082010`'s own report (job
`95372702769`): the report prints `## Answer Metrics | Cases | 44 |`, `Failing Answer
Cases — None`, and its per-case diagnostics table lists exactly 44 rows — matching the 44
`ragEvalCases` in `src/lib/rag/rag-eval-cases.ts` at both `2bd146eed` and this baseline
commit. `HANDOVER.md`'s original "45/45" was a transcription error and has been corrected
to 44/44. The gate denominator recorded here (44) stands.

## 4. Re-capture for prompt v19 (packet S2, 2026-08-18)

Packet S2 (README §A2 + §A3) changed the answer prompt — the `related_information_menu`
line and the 60–110-word / three-to-six-section targets — and bumped `ragAnswerPromptVersion`
to `clinical-rag-answer-v19`, so this record was re-captured against the evaluated code
commit `b7aa925f0ae19e89a9f0acf842b4a80d84083fb5`. Offline gates were re-run at that commit
(`eval:rag:offline`: 26 suites / 623 tests; `check:rag:adversarial-fixtures`: 24 cases, canary-free);
the three provider-backed gates stay `pending_owner_run`, carrying run `32100681177` at
`4ea310e48` (prompt v18) as `priorRun` — that run is the baseline half of the S2 canary pair.

One caveat travelled with the `answer_quality` gate at `rag-eval-config-v1`:
`scoreAnswerQualityEvalCase` (`src/lib/rag/rag-eval-cases.ts`) scored readability over the
answer **plus every section body** as a single boolean combining a fragmentation regex with a
flat 220-word ceiling, under one reason string ("fragmented or too long"). The S2 targets can
exceed 220 by design, so a readability=0 flag caused only by total length was a metric artefact
to adjudicate, not evidence of a regression — and it was not separable from the fragmentation
regression the metric exists to catch. The scorer was deliberately left untouched in S2 so the
before/after comparison ran under one definition.

## 4a. Readability metric split (2026-08-18, `rag-eval-config-v2`)

That caveat is now resolved, and the resolution is the reason this record reads
`rag-eval-config-v2`. `scoreAnswerQualityEvalCase` keeps the five metric keys — `readability`
still reports as one score, because `AnswerQualityMetric` is a closed union consumed by
`scripts/eval-answer-quality.ts` as a total `Record<AnswerQualityMetric, number>` — but it now
evaluates two independent checks under that key and reports whichever failed:

- **Fragmentation** — the existing `fragmentPattern`, unchanged in both pattern and effect.
- **Length** — `>= 5` words (the empty/stub floor, unchanged) and `<= 900` words.

The 900-word ceiling is derived from the v19 contract rather than raised by judgement: the
answer field's stated upper target is 110 words (`rag-answer-instructions.ts`), sections are
capped at 6 (`answerSections.maxItems` in `rag.ts`, matching the prompt's "three to six"), and
each section can carry a 48-character heading plus a 600-character body (both schema maxima in
`rag.ts`). At a deliberately low 5 characters per word — chosen so the conversion overstates the
word ceiling and the bound can never fail a well-formed answer — that is
110 + 6 x (648 / 5) = 887.6, rounded up to 900.

This is a contract ceiling, not a style ceiling: conciseness is enforced by the prompt and
measured by `scoreAnswerTargeting`. An answer above 900 words could not have come from a
schema-conformant generation, so the bound still catches runaway duplication and the
deterministic composition paths (`rag-extractive-answer.ts`, `rag-comparison.ts`) that build a
`RagAnswer` in code without the JSON schema.

Consequence for comparisons: a `readability` rate recorded under `rag-eval-config-v1` is not
comparable to one recorded under `v2`. No retrieval, ranking, selection, or generation
behaviour changed — this is an evaluation-scorer change only, so it carries no canary
requirement of its own.

## 4b. Canary monitoring finding: neuroleptic-side-effect-escalation latency advisory (2026-08-18)

During the S2 canary verification pair run (run `32100681177` -> run `32111839806`), the evaluation completed clean across all gates with 1.0/1.0 recall and zero per-case retrieval rank regressions. A single non-blocking latency advisory was recorded for the `neuroleptic-side-effect-escalation` case (~20 s generation latency). Analysis confirmed this latency was driven by broad query fan-out and structured memory reconciliation across multiple medication and escalation guideline chunks. The request completed safely within system timeouts without answer degradation, verification failure, or ungrounded claims.

## 5. Related

- `scripts/fixtures/rag-adversarial-baseline.v1.json` — the record itself.
- `scripts/fixtures/rag-adversarial-cases.v1.json` — the 24 synthetic adversarial cases.
- [data-flow-register.md](data-flow-register.md) — the Gate A data-flow register.
- `docs/rag-behaviour/safeguards.md` — the canary-pair protocol these gates run under.
