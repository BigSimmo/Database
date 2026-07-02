# Source Governance Review Priorities - 2026-07-02

Source report: `output/evals/retrieval-quality-2026-07-02T06-55-32-323Z.json`

## Current Gate

- Retrieval recall: `top_k_hit_rate=1`, `document_recall_at_5=1`, `content_recall_at_5=1`.
- Primary source governance: `stale_rate=0`, `review_required_rate=0.1739`.
- Supporting top-5 source governance: `supporting_top5_review_required_rate=0.2655`.
- Explicit non-local unverified primary sources: `6`. These stay labelled as unverified but are not missing local-validation metadata debt.

## Primary Release-Gated Debt

Review these first because they appear as rank-1 primary results and drive the release governance rate.

| Priority | Document | Status | Validation | Eval queries |
| --- | --- | --- | --- | --- |
| 1 | `Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal (FSH).pdf` | `review_due` | `locally_reviewed` | `alcohol-ciwa-scoring`, `alcohol-ciwa-threshold` |
| 2 | `Alcohol withdrawal.pdf` | `review_due` | `unverified`, explicit non-local BMJ source | `alcohol-withdrawal-management` |
| 3 | `Schizoaffective disorder.pdf` | `review_due` | `unverified`, explicit non-local BMJ source | `bipolar-vs-schizoaffective` |

## Supporting Top-5 Debt

Review these next, ordered by repeated top-5 appearances.

| Priority | Document | Count | Status | Validation | Eval queries |
| --- | --- | ---: | --- | --- | --- |
| 1 | `Clozapine Management by GP (NMHS).pdf` | 8 | `review_due` | `locally_reviewed` | `show-source-table-image`, `monitoring-threshold-from-chart` |
| 2 | `Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal (FSH).pdf` | 5 | `review_due` | `locally_reviewed` | `alcohol-ciwa-scoring`, `alcohol-ciwa-threshold` |
| 3 | `Alcohol withdrawal.pdf` | 5 | `review_due` | explicit non-local BMJ source | `alcohol-withdrawal-management`, `alcohol-ciwa-threshold` |
| 4 | `Arousal and Agitation Drug Management (CAMHS).pdf` | 2 | `review_due` | `locally_reviewed` | `agitation-im-po-options`, `medication-chart-dose-route` |
| 5 | `Schizoaffective disorder.pdf` | 2 | `review_due` | explicit non-local BMJ source | `bipolar-vs-schizoaffective` |

## Policy Notes

- Do not mark review-due documents as current unless the source text or source owner confirms a current review/expiry date.
- Do not mark BMJ/non-local sources as locally reviewed. Keep the unverified/non-local label visible to users.
- Governance should not boost ranking. It should only apply small stale or poor-extraction safety penalties, while release gating and review prioritization happen in backend eval/audit routines.
