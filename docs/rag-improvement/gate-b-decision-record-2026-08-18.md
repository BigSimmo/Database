# Gate B decision record — Docling extraction benchmark (owner run, 2026-08-18)

**Status: thresholds agreed, run pending.** This is the owner's filled copy of
`docs/rag-improvement/gate-b-decision-record.md` for packet **S6b** (the Gate B run the
S6 harness deliberately shipped without). Per the template's §3 rule, the thresholds below
were agreed in the S6b session and **committed before the benchmark dispatch**; the gate
results are filled from the dispatched run's `docling-lab-report-<run id>` artifact.
Machine-readable twin: `docs/rag-improvement/gate-b-decision-record-2026-08-18.json`,
validated with
`node eval/docling/report/build-report.mjs --validate-record docs/rag-improvement/gate-b-decision-record-2026-08-18.json --final`.

Gate B (README §Gates A–F): **non-inferior on all safety/exactness measures, improved on
the pre-agreed table-heavy metric, no budget breach.** A pass authorises _designing_
packet B4 (worker shadow mode) only; a fail or deferral leaves the worker untouched and
the lab in place.

## 1. Provenance discipline

As `baseline-record.md`: a gate result is either `recorded` with a result **and** the run
or artifact it came from, or `pending_owner_run` with a stated reason and no result. A
number cannot be entered without provenance.

## 2. Report key

_Pre-dispatch expected values (origin/main tip at threshold-agreement time); confirmed or
corrected verbatim from the run artifact's stamped key after the run._

| Field                 | This run                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| `commit_sha`          | `0216f18e97c224ce9bf50799ba8c4837909e781f` (expected; pending run confirmation) |
| `dataset_version`     | `docling-lab-fixtures.v1`                                                       |
| `eval_config_version` | `docling-lab-config-v1`                                                         |
| `model_version`       | `answer=gpt-5.6-terra; fast=gpt-5.6-terra; strong=gpt-5.6-sol`                  |
| `embedding_version`   | `text-embedding-3-small@1536`                                                   |
| `index_version`       | `20260818113000_forward_codify_hybrid_owner_matches_bodies`                     |

`model_version`, `embedding_version`, and `index_version` are programme-wide
comparability qualifiers not exercised by this extraction benchmark — no model, embedding,
or database call occurs inside the sandbox. Outside the key: `extractorVersions.legacy`
(pymupdf==1.28.0 path) and `extractorVersions.docling` (docling==2.120.2) from
`eval/docling/report/lab-config.json`, plus the workflow run URL and artifact name
(pending run).

## 3. Pre-agreed thresholds — agreed and committed BEFORE the dispatch

| Threshold                                                     | Agreed value                                                                           | Rationale (owner)                                                                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parse-success non-inferiority margin (pp, per stratum)        | **0**                                                                                  | Zero-tolerance posture: docling must parse no fewer clean fixtures than legacy in any stratum.                                                                                                                        |
| Numeric/unit/comparator exactness non-inferiority margin (pp) | **0**                                                                                  | Any dose, unit, or comparator string legacy preserves that docling loses is clinically meaningful; per stratum, `assertionCoverageDeltaPp >= 0`.                                                                      |
| Table-heavy improvement target (pp cell F1 on `table_heavy`)  | **0**                                                                                  | Owner decision 2026-08-18: the v1 corpus's cleanly ruled tables put legacy at cell F1 1.0 (S6 smoke), leaving no headroom; parity at ceiling satisfies the leg, and a fixtures.v2 table-hardness follow-up is queued. |
| Resource ceilings                                             | `eval/docling/report/lab-config.json` (sandbox + outputCaps) at the run's `commit_sha` | Fixed by the lab.                                                                                                                                                                                                     |

Hostile-corpus treatment (hard safety gate, not a threshold to tune):
`canaryEchoTotal` must be 0, `crashArtifactTotal` must be 0, `containedDeltaCount >= 0`.
A legacy-side hostile finding is recorded as a lab finding and queued in the issues inbox,
but the docling verdict is judged on docling's own containment.

## 4. Gate results

| Gate                     | Cases | Status              | Result | Evidence | blockedReason                                                                    |
| ------------------------ | ----- | ------------------- | ------ | -------- | -------------------------------------------------------------------------------- |
| `parse_success`          | 36    | `pending_owner_run` | —      | —        | Thresholds committed ahead of the owner-approved dispatch; run not yet completed |
| `resource_bounds`        | 46    | `pending_owner_run` | —      | —        | as above                                                                         |
| `table_precision_recall` | 12    | `pending_owner_run` | —      | —        | as above                                                                         |
| `numeric_exactness`      | 36    | `pending_owner_run` | —      | —        | as above                                                                         |
| `hostile_containment`    | 10    | `pending_owner_run` | —      | —        | as above                                                                         |

## 5. Decision

| Field          | Value                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outcome        | `pending_owner_run`                                                                                                                                                      |
| Owner sign-off | _pending_                                                                                                                                                                |
| Date           | _pending_                                                                                                                                                                |
| Consequence    | Pass → packet B4 (shadow mode) may be designed with the v1 table-ceiling caveat explicit; `ingestion-worker-reviewer` reviews that PR. Fail/deferred → worker untouched. |

## 6. Related

- `docs/rag-improvement/gate-b-decision-record.md` (the committed template this copies)
- `docs/rag-improvement/README.md` §B3, §B4, §Gates A–F
- `docs/rag-improvement/HANDOVER.md` packets S6 / S6b
- `eval/docling/README.md` (harness, sandbox contract, known v1 table-ceiling limitation)
