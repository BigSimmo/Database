# RAG evaluation baseline record

**Status:** maintained record, created 2026-08-17 by programme packet S4 (B0). This is the
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
| `commit_sha`          | `92f7618c0ccac336ef6c245b89f37b046f4eac32`                     | `git rev-parse HEAD` of the evaluated tree. Full 40 characters, enforced.   |
| `dataset_version`     | `rag-adversarial-cases.v1`                                     | The fixture dataset's own `datasetVersion`; cross-checked against the file. |
| `eval_config_version` | `rag-eval-config-v1`                                           | Bumped by hand whenever a case list, threshold, or gate semantic changes.   |
| `model_version`       | `answer=gpt-5.6-terra; fast=gpt-5.6-terra; strong=gpt-5.6-sol` | The resolved answer-model defaults in `src/lib/env.ts`.                     |
| `embedding_version`   | `text-embedding-3-small@1536`                                  | `OPENAI_EMBEDDING_MODEL` and `EMBEDDING_DIMENSIONS` in `src/lib/env.ts`.    |
| `index_version`       | `20260814151000_validate_therapy_favourites_content_type`      | The latest applied migration — the index shape the retrieval RPCs run on.   |

The field set and its order are pinned by `tests/rag-adversarial-fixtures.test.ts`. Adding,
removing, or reordering a field is a deliberate contract change, not an edit.

Two further values sit outside the key because they qualify the whole record rather than
identify a run: `promptVersion` is `clinical-rag-answer-v18`, cross-checked at validation time
against `src/lib/rag/rag-versioning.ts` so the record cannot describe a superseded prompt; and
`semanticRerankEnabled` is `false`, which the validator requires, because issue `#001` keeps the
ambiguity-band semantic reranker off until an approved comparison exists.

## 2. Gate results

| Gate                   | Cases | Status            | Result                                                            |
| ---------------------- | ----- | ----------------- | ----------------------------------------------------------------- |
| `retrieval_golden`     | 36    | pending owner run | Provider-backed; last recorded green at `2bd146eed`.              |
| `answer_gate`          | 44    | pending owner run | Provider-backed; the recorded denominator is unreconciled (§3).   |
| `answer_quality`       | 30    | pending owner run | Provider-backed; no comparison recorded at this commit.           |
| `offline_contract`     | 25    | recorded          | 25 suites, 603 tests passed.                                      |
| `adversarial_fixtures` | 24    | recorded          | 24 synthetic cases, 8 categories, 6 canaries, report canary-free. |

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

## 4. Related

- `scripts/fixtures/rag-adversarial-baseline.v1.json` — the record itself.
- `scripts/fixtures/rag-adversarial-cases.v1.json` — the 24 synthetic adversarial cases.
- [data-flow-register.md](data-flow-register.md) — the Gate A data-flow register.
- `docs/rag-behaviour/safeguards.md` — the canary-pair protocol these gates run under.
