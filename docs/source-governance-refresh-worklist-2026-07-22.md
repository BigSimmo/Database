# Source-governance refresh worklist — 2026-07-22

Successor to [`source-review-priority-2026-07-02.md`](source-review-priority-2026-07-02.md), regenerated
from live canary artifacts. Ledger item: **#022**. Produced read-only at **$0** — no provider calls, no
live queries; everything below is derived from the Eval Canary artifacts for runs **#61** and **#57**.

## What the two governance numbers actually mean

They are different denominators and are often conflated:

| Number               | Source                                                                           | Denominator                                                       | Meaning                                                     |
| -------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| **0.8409**           | run #61 `answer-quality.log` → Answer Metrics → "Source governance warning rate" | **44 answer-quality cases**                                       | ~37 of 44 cases raised at least one governance warning      |
| **0.5976** (404/676) | runs #61 + #57 `golden-retrieval.json` → `topResults`                            | **676 individual top-result slots** (36 retrieval cases × 2 runs) | 60% of surfaced result slots carry review-required metadata |

Policy (verbatim from the canary log): _"unknown, unverified, review_due, outdated, unknown extraction,
and poor extraction metadata are treated as review-required; do not silently default them to current or
approved."_

> **Reporting gap worth noting:** run #61's own `## Source Governance` table reports `Top results | 0` and
> all-zero rates, even though the underlying `topResults` records carry full governance metadata. The
> operator-facing table in the log is therefore **not** populated — this worklist had to be derived from
> the raw JSON. Worth fixing so the canary log surfaces this directly.

## The reframing: this is not 59 document reviews

**59 of the 124 distinct documents** appearing in top results are review-required. But they fall into two
very different classes:

| Class                                 | Docs                                                           | Flag                                     | What it actually needs                                                                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BMJ published reference tier**      | **38 (64%)**                                                   | `clinical_validation_status: unverified` | **One policy decision**, not 38 clinical reviews — decide how third-party BMJ Best Practice content is attested (bulk attestation via an explicit, auditable metadata update / a dedicated "third-party published" validation state). Do **not** silently default ingestion metadata to `current` or `approved`; preserve the third-party/unverified distinction until the approved policy is applied. |
| **Local WA health-service documents** | **21** (FSH 7, NMHS 4, CAMHS 3, AKG 2, KEMH 2, RPBG 2, RKPG 1) | mostly `document_status: review_due`     | **Genuine periodic review** — real attestation work, but a tractable ~21 documents                                                                                                                                    |

By flag combination: `val:unverified` 30 · `doc:review_due` 19 · both 8 · `doc:unknown` 1 ·
`val:unverified + doc:unknown` 1.

## Burn-down math

Ranked by number of review-required top-result slots (both runs combined; 404 flagged slots total):

| Top N documents | Slots cleared | Share of all flagged slots |
| --------------- | ------------- | -------------------------- |
| 5               | 110 / 404     | **27%**                    |
| 10              | 176 / 404     | **44%**                    |
| 15              | 226 / 404     | **56%**                    |
| 20              | 266 / 404     | **66%**                    |
| 30              | 332 / 404     | **82%**                    |

Because the BMJ tier dominates, resolving the BMJ attestation policy alone would clear the large majority
of these slots in one action.

## Prioritized worklist (top 25 by surfaced slots)

`Slots` = review-required top-result appearances across runs #61 + #57. `Best` = highest rank achieved
(rank 1 = most user-visible). `Cum.` = cumulative share of all 404 flagged slots.

|   # | Document                                                               | Slots | Best | Publisher | Needs                                                 | Cum. |
| --: | ---------------------------------------------------------------------- | ----: | ---: | --------- | ----------------------------------------------------- | ---: |
|   1 | Bipolar disorder in adults.pdf                                         |    32 |    1 | BMJ       | validation (unverified)                               |   8% |
|   2 | Clozapine Management by GP (NMHS).pdf                                  |    22 |    1 | NMHS      | document status (review_due)                          |  13% |
|   3 | Alcohol withdrawal.pdf                                                 |    22 |    1 | BMJ       | document status (review_due); validation (unverified) |  19% |
|   4 | Opioid use disorder.pdf                                                |    18 |    1 | BMJ       | validation (unverified)                               |  23% |
|   5 | Postnatal depression.pdf                                               |    16 |    1 | BMJ       | validation (unverified)                               |  27% |
|   6 | Anorexia nervosa.pdf                                                   |    16 |    1 | BMJ       | validation (unverified)                               |  31% |
|   7 | Generalised anxiety disorder.pdf                                       |    14 |    2 | BMJ       | validation (unverified)                               |  35% |
|   8 | Alcohol and Other Drugs - Addiction, Toxicity and Withdrawal (FSH).pdf |    12 |    1 | FSH       | document status (review_due)                          |  38% |
|   9 | Attention deficit hyperactivity disorder in adults.pdf                 |    12 |    1 | BMJ       | validation (unverified)                               |  41% |
|  10 | Alcohol use disorder.pdf                                               |    12 |    5 | BMJ       | validation (unverified)                               |  44% |
|  11 | Insomnia.pdf                                                           |    10 |    1 | BMJ       | validation (unverified)                               |  46% |
|  12 | Schizophrenia.pdf                                                      |    10 |    1 | BMJ       | validation (unverified)                               |  49% |
|  13 | Panic disorders.pdf                                                    |    10 |    1 | BMJ       | validation (unverified)                               |  51% |
|  14 | Depression in adults.pdf                                               |    10 |    2 | BMJ       | validation (unverified)                               |  53% |
|  15 | Attention deficit hyperactivity disorder in children.pdf               |    10 |    4 | BMJ       | validation (unverified)                               |  56% |
|  16 | Clozapine Coordinator and Clozapine Clinic (NMHS).pdf                  |     8 |    1 | NMHS      | document status (review_due)                          |  58% |
|  17 | Suicide risk mitigation.pdf                                            |     8 |    1 | BMJ       | validation (unverified)                               |  60% |
|  18 | Post-traumatic stress disorder.pdf                                     |     8 |    1 | BMJ       | validation (unverified)                               |  62% |
|  19 | Obsessive-compulsive disorder.pdf                                      |     8 |    1 | BMJ       | validation (unverified)                               |  64% |
|  20 | Tourette's syndrome.pdf                                                |     8 |    1 | BMJ       | document status (review_due); validation (unverified) |  66% |
|  21 | Functional neurological and somatic symptom disorders.pdf              |     8 |    3 | BMJ       | validation (unverified)                               |  68% |
|  22 | MHATT Assessment and Treatment Process (AKG).pdf                       |     8 |    4 | AKG       | document status (review_due)                          |  70% |
|  23 | Social anxiety disorder.pdf                                            |     8 |    5 | BMJ       | validation (unverified)                               |  72% |
|  24 | Personality disorders.pdf                                              |     8 |    6 | BMJ       | validation (unverified)                               |  74% |
|  25 | Depression in children.pdf                                             |     6 |    1 | BMJ       | validation (unverified)                               |  75% |

## Suggested order of work

1. **Decide the BMJ attestation policy** (clears ~64% of review-required documents in one action) — any chosen option must be an explicit, auditable metadata update that never silently defaults to `current`/`approved` and preserves the third-party/unverified distinction; this remains open debt (ledger #022) until the approved policy is implemented, not merely decided.
2. **Attest the local documents by visibility** — start with `Clozapine Management by GP (NMHS)` (22 slots,
   rank 1), then the FSH addiction/withdrawal document, then the remaining NMHS/AKG/CAMHS/KEMH items.
3. **Re-read the warning rate** on the next canary to confirm the burn-down.

## Scope and limits

- This is **operator work** (document review-status attestation in the app), not a code defect. No code
  change is proposed here.
- The list reflects **only documents that surfaced in golden-case top results**, so it is a
  visibility-weighted worklist, not a full corpus audit. The 2026-07-02 predecessor notes the live corpus
  is far larger (~2,065 indexed documents at that time).
- Counts combine two runs (#61, #57); a document appearing in both runs counts twice, which is intentional
  — it weights persistently-surfaced documents higher.
