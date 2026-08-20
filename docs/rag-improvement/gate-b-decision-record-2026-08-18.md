# Gate B decision record — Docling extraction benchmark (owner run, 2026-08-18)

**Status: PASS.** This is the owner's filled copy of
`docs/rag-improvement/gate-b-decision-record.md` for packet **S6b** (the Gate B run the
S6 harness deliberately shipped without). Per the template's §3 rule, the thresholds below
were agreed in the S6b session and **committed before any benchmark dispatch** (branch
commit `6d05c07`); the gate results are filled from the recorded evidence run's
`docling-lab-report-32176604314` artifact. Machine-readable twin:
`docs/rag-improvement/gate-b-decision-record-2026-08-18.json`, validated with
`node eval/docling/report/build-report.mjs --validate-record docs/rag-improvement/gate-b-decision-record-2026-08-18.json --final`.

Gate B (README §Gates A–F): **non-inferior on all safety/exactness measures, improved on
the pre-agreed table-heavy metric, no budget breach.** This pass authorises _designing_
packet B4 (worker shadow mode) only; the worker remains untouched.

## 1. Provenance discipline

As `baseline-record.md`: a gate result is either `recorded` with a result **and** the run
or artifact it came from, or `pending_owner_run` with a stated reason and no result. A
number cannot be entered without provenance.

## 2. Report key

Copied verbatim from the run artifact's stamped key.

| Field                 | This run                                                       |
| --------------------- | -------------------------------------------------------------- |
| `commit_sha`          | `8a923787c81e4256d4e22e45eed65ccb26f5fba8`                     |
| `dataset_version`     | `docling-lab-fixtures.v1`                                      |
| `eval_config_version` | `docling-lab-config-v1`                                        |
| `model_version`       | `answer=gpt-5.6-terra; fast=gpt-5.6-terra; strong=gpt-5.6-sol` |
| `embedding_version`   | `text-embedding-3-small@1536`                                  |
| `index_version`       | `20260818113000_forward_codify_hybrid_owner_matches_bodies`    |

`model_version`, `embedding_version`, and `index_version` are programme-wide
comparability qualifiers not exercised by this extraction benchmark — no model, embedding,
or database call occurs inside the sandbox. Outside the key: `extractorVersions.legacy`
(pymupdf==1.28.0 path) and `extractorVersions.docling` (docling==2.120.2) from
`eval/docling/report/lab-config.json`; evidence run
<https://github.com/BigSimmo/Database/actions/runs/32176604314>, artifact
`docling-lab-report-32176604314`; docling phase environment `TORCHDYNAMO_DISABLE=1`
(eager mode — the sandbox image ships no C++ toolchain for torch.compile).

## 3. Pre-agreed thresholds — agreed and committed BEFORE the dispatch

| Threshold                                                     | Agreed value                                                                           | Rationale (owner)                                                                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parse-success non-inferiority margin (pp, per stratum)        | **0**                                                                                  | Zero-tolerance posture: docling must parse no fewer clean fixtures than legacy in any stratum.                                                                                                                        |
| Numeric/unit/comparator exactness non-inferiority margin (pp) | **0**                                                                                  | Any dose, unit, or comparator string legacy preserves that docling loses is clinically meaningful; per stratum, `assertionCoverageDeltaPp >= 0`.                                                                      |
| Table-heavy improvement target (pp cell F1 on `table_heavy`)  | **0**                                                                                  | Owner decision 2026-08-18: the v1 corpus's cleanly ruled tables put legacy at cell F1 1.0 (S6 smoke), leaving no headroom; parity at ceiling satisfies the leg, and a fixtures.v2 table-hardness follow-up is queued. |
| Resource ceilings                                             | `eval/docling/report/lab-config.json` (sandbox + outputCaps) at the run's `commit_sha` | Fixed by the lab.                                                                                                                                                                                                     |

Hostile-corpus treatment (hard safety gate, not a threshold to tune):
`canaryEchoTotal` must be 0, `crashArtifactTotal` must be 0, `containedDeltaCount >= 0`.

## 4. Gate results

Evidence for every row: run <https://github.com/BigSimmo/Database/actions/runs/32176604314>,
artifact `docling-lab-report-32176604314`.

| Gate                     | Cases | Status     | Result                                                                                                                                                                                        |
| ------------------------ | ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parse_success`          | 36    | `recorded` | **PASS** — docling 36/36, legacy 36/36; `parseSuccessDeltaPp` = 0 in all six strata (rule ≥ 0)                                                                                                |
| `resource_bounds`        | 46    | `recorded` | **PASS** — no timeout/signal/output-cap breach either engine; docling max wall P95 12,558 ms (cap 120 s; hostile 60 s), max peak RSS 1,504,313,344 B (~1.40 GiB, cap 6 GiB), report 1,285 B   |
| `table_precision_recall` | 12    | `recorded` | **PASS** — cell F1 1.0 both engines on `table_simple` and `table_heavy`; deltas 0 (rule ≥ 0); improvement leg met at the pre-agreed 0 pp parity-at-ceiling target                             |
| `numeric_exactness`      | 36    | `recorded` | **PASS** — docling 162/162, legacy 162/162 assertions; `assertionCoverageDeltaPp` = 0 in all six strata (rule ≥ 0); scored escape-neutrally (`html.unescape`) so comparators compare by value |
| `hostile_containment`    | 10    | `recorded` | **PASS** — contained 10/10 both engines; `containedDeltaCount` 0, `crashArtifactTotal` 0, `canaryEchoTotal` 0; every hostile failure a clean bounded error                                    |

### Run history (the dispatch chain behind the evidence run)

| Run                                                                          | Commit    | Outcome                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [32164356999](https://github.com/BigSimmo/Database/actions/runs/32164356999) | `0216f18` | Infra failure — hashed lock omitted setuptools (`pip-compile` without `--allow-unsafe`); torch requires it at runtime. Fixed by `779af80`.                              |
| [32165911181](https://github.com/BigSimmo/Database/actions/runs/32165911181) | `779af80` | Infra failure — model prefetch: rapidocr imports cv2, slim base lacked `libGL.so.1`/glib. Fixed by `958a70d`.                                                           |
| [32166445937](https://github.com/BigSimmo/Database/actions/runs/32166445937) | `958a70d` | Workflow green but **not a valid docling measurement** — all 46 docling docs errored uniformly; cause invisible in aggregate output. Diagnostic surface: `c66faf8`.     |
| [32171549648](https://github.com/BigSimmo/Database/actions/runs/32171549648) | `c66faf8` | Diagnostic — named the failure: `InvalidCxxCompiler` (torch.compile needs a C++ compiler the sandbox deliberately lacks). Fixed by `6c6e80e` (`TORCHDYNAMO_DISABLE=1`). |
| [32174653778](https://github.com/BigSimmo/Database/actions/runs/32174653778) | `6c6e80e` | First valid docling pass — exactness scored −25…−62.5 pp purely on HTML-entity encoding (`>=` exported as `&gt;=`); values verified intact locally. Fixed by `8a92378`. |
| [32176604314](https://github.com/BigSimmo/Database/actions/runs/32176604314) | `8a92378` | **Recorded evidence run — all five gates pass.**                                                                                                                        |

## 5. Decision

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome        | **`pass`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Owner sign-off | Thresholds, every dispatch (six approvals), and the parity-at-ceiling table target were explicitly owner-approved in the S6b session on 2026-08-18; final countersign is the owner's review/merge of the packet S6b pull request.                                                                                                                                                                                                                                                                          |
| Date           | 2026-08-18                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Consequence    | Packet **B4 (shadow mode) may be designed**: `WORKER_DOCUMENT_EXTRACTOR_MODE=legacy\|shadow`, default `legacy`; `ingestion-worker-reviewer` reviews that PR. Two caveats travel with the pass: (1) the table-heavy leg passed at parity-on-ceiling, not by a demonstrated gain — the queued `docling-lab-fixtures.v2` hardness corpus precedes any promotion argument built on table quality; (2) docling ran eager at ~9–19 s/doc on 2 CPUs vs legacy's ~1 s — shadow-cohort sizing must budget for that. |

## 6. Related

- `docs/rag-improvement/gate-b-decision-record.md` (the committed template this copies)
- `docs/rag-improvement/README.md` §B3, §B4, §Gates A–F
- `docs/rag-improvement/HANDOVER.md` packets S6 / S6b
- `eval/docling/README.md` (harness, sandbox contract, known v1 table-ceiling limitation)
