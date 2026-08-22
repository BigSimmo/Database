# Gate B decision record — Docling extraction benchmark (template)

**Status: template — no verdict.** This file ships with the packet S6 harness and
records no result. The benchmark verdict is a separate, owner-reviewed run: copy
this template (do not edit it in place), agree §3 **before** dispatching the run,
fill §2 and §4 from that run's artifact, and sign §5. The machine-readable twin is
`eval/docling/report/gate-b-decision-record.template.json`; validate a filled copy
with `node eval/docling/report/build-report.mjs --validate-record <copy> --final`.

Gate B (README §Gates A–F): **non-inferior on all safety/exactness measures,
improved on the pre-agreed table-heavy metric, no budget breach.** A pass
authorises _designing_ packet B4 (worker shadow mode) only; a fail or deferral
leaves the worker untouched and the lab in place. Rollback consequence: none —
the lab is isolated by construction.

## 1. Provenance discipline

Same rules as `baseline-record.md`: a gate result is either `recorded` with a
result **and** the run or artifact it came from, or `pending_owner_run` with a
stated reason and no result. A number cannot be entered without provenance. A
prior run at another commit may be carried as `priorRun`, which is history and
explicitly not a result for this tree.

## 2. Report key

Both compared engines run in one dispatch at one commit, so one key covers the
run (`docs/rag-improvement/baseline-record.md` §1 defines each field's
derivation; `eval/docling/report/build-report.mjs` stamps it automatically).

| Field                 | This run            | Where it comes from                                        |
| --------------------- | ------------------- | ---------------------------------------------------------- |
| `commit_sha`          | `pending_owner_run` | `git rev-parse HEAD` of the benchmarked tree               |
| `dataset_version`     | `pending_owner_run` | `eval/docling/fixtures/manifest.v1.json` `datasetVersion`  |
| `eval_config_version` | `pending_owner_run` | `eval/docling/report/lab-config.json`                      |
| `model_version`       | `pending_owner_run` | Answer-model defaults (programme-wide comparability field) |
| `embedding_version`   | `pending_owner_run` | `OPENAI_EMBEDDING_MODEL` + dimensions                      |
| `index_version`       | `pending_owner_run` | Latest applied migration                                   |

Outside the key, as qualifiers of the whole record (S4's `promptVersion`
pattern): `extractorVersions.legacy` and `extractorVersions.docling` from
`lab-config.json`, plus the workflow run URL and artifact name.

## 3. Pre-agreed thresholds — complete and commit BEFORE dispatching the run

Filling these after seeing results would make the gate a rationalisation. The
committed template holds `agreedBeforeRun: false` and null margins; the owner's
copy must set them first.

| Threshold                                                     | Agreed value                                                                           | Rationale (owner) |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------- |
| Parse-success non-inferiority margin (pp, per stratum)        | _pending_                                                                              | _pending_         |
| Numeric/unit/comparator exactness non-inferiority margin (pp) | _pending_                                                                              | _pending_         |
| Table-heavy improvement target (pp cell F1 on `table_heavy`)  | _pending_                                                                              | _pending_         |
| Resource ceilings                                             | `eval/docling/report/lab-config.json` (sandbox + outputCaps) at the run's `commit_sha` | fixed by the lab  |

## 4. Gate results

One row per measure; `caseCount` fixed by the shipped manifest (36 fixtures, 12
table-bearing, 10 hostile). Evidence = workflow run URL + artifact name
(`docling-lab-report-<run id>`).

| Gate                     | Cases | Status              | Result | Evidence | blockedReason / priorRun                                                            |
| ------------------------ | ----- | ------------------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `parse_success`          | 36    | `pending_owner_run` | —      | —        | No owner-dispatched benchmark run recorded (S6 ships the harness without a verdict) |
| `resource_bounds`        | 46    | `pending_owner_run` | —      | —        | as above                                                                            |
| `table_precision_recall` | 12    | `pending_owner_run` | —      | —        | as above                                                                            |
| `numeric_exactness`      | 36    | `pending_owner_run` | —      | —        | as above                                                                            |
| `hostile_containment`    | 10    | `pending_owner_run` | —      | —        | as above                                                                            |

Measure definitions live with their arithmetic in
`eval/docling/harness/score.py`; the non-inferiority comparisons read the
`comparison.perStratum` deltas in the aggregate report.

## 5. Decision

| Field          | Value                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome        | `pending_owner_run` (pass / fail / deferred)                                                                                                                                      |
| Owner sign-off | _pending_                                                                                                                                                                         |
| Date           | _pending_                                                                                                                                                                         |
| Consequence    | Pass → packet B4 (shadow mode) may be designed, `ingestion-worker-reviewer` reviews that PR. Fail/deferred → worker untouched; record what the lab should change before a re-run. |

## 6. Related

- `docs/rag-improvement/README.md` §B3 (lab), §B4 (shadow), §Gates A–F (Gate B)
- `docs/rag-improvement/HANDOVER.md` packet S6
- `docs/rag-improvement/baseline-record.md` (report key + provenance discipline)
- `eval/docling/README.md` (harness, sandbox contract, how to run)
- `scripts/fixtures/rag-adversarial-baseline.v1.json` (the S4 record this mirrors)
