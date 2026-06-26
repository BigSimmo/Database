# Retrieval Quality Runbook

Use this runbook when retrieval, ranking, RAG answer generation, source governance, or ingestion/indexing changes could affect clinical answer quality.

## Safe preflight

1. Confirm the live Supabase target before env-sensitive work:

```bash
npm run check:supabase-project
```

2. Confirm Supabase is healthy and the ingestion queue is not in recovery:

```bash
npm run supabase:recovery-status
```

Do not run retrieval or RAG evals when this reports `supabase_unavailable`, read errors, or a partially recovered indexing queue. Follow `docs/reindex-runbook.md` first.

## Main command

Run the combined quality gate:

```bash
npm run eval:quality
```

Useful variants:

```bash
npm run eval:quality -- --limit 5
npm run eval:quality -- --retrieval-only
npm run eval:quality -- --rag-only
npm run eval:quality -- --query clozapine
npm run eval:quality -- --question "What ANC or FBC threshold should withhold clozapine?"
npm run eval:quality -- --fail-on-threshold
```

The command writes ignored local artifacts under `output/evals/`:

- `retrieval-quality-<timestamp>.json`
- `retrieval-quality-<timestamp>.md`

## Required environment

The command requires the same live-eval environment as the existing RAG eval scripts:

- Supabase server env values for `Clinical KB Database`
- `OPENAI_API_KEY`
- `RAG_EVAL_OWNER_ID`, `LOCAL_NO_AUTH_OWNER_ID`, or `RAG_EVAL_OWNER_EMAIL`

Optional cost fields:

- `RAG_EVAL_INPUT_USD_PER_MILLION`
- `RAG_EVAL_CACHED_INPUT_USD_PER_MILLION`
- `RAG_EVAL_OUTPUT_USD_PER_MILLION`

## Metrics reported

Retrieval:

- case count
- hit@K
- document recall@5
- content recall@5
- MRR@10
- median latency
- retrieval strategy counts
- failed cases grouped by failure category

Source governance:

- outdated top-result count
- review-due top-result count
- unknown-status top-result count
- unverified top-result count
- poor-extraction top-result count
- combined stale/review/unknown top-result rate

Answer quality:

- grounded supported rate
- unsupported correct rate
- expected source hit rate
- citation failure rate
- numeric grounding failure rate
- source governance warning count
- p95 latency
- estimated cost when cost env vars are set

## Threshold defaults

`npm run eval:quality -- --fail-on-threshold` fails when:

- retrieval hit@K is below `0.8`
- document recall@5 is below `0.8`
- content recall@5 is below `0.8`
- stale/review/unknown top-result rate is above `0.25`
- grounded supported answer rate is below `0.9`
- unsupported-answer correctness is below `1.0`
- citation failure rate is above `0`
- numeric grounding failure rate is above `0`
- RAG p95 latency is above `25000ms`

These thresholds are intended as a quality tripwire, not a substitute for clinical review.

## Promoting misses

Use the in-app answer feedback flow or `/api/eval-cases` to capture answer misses. Promoted rows in `rag_query_misses` are automatically included by `npm run eval:quality`.

For durable fixture coverage, add stable cases to `scripts/fixtures/rag-retrieval-golden.json` when the expected document/source terms are clear and not tied to transient local data.

## When to run

Run retrieval-only evals after:

- search/ranking changes
- schema or RPC changes that affect retrieval
- ingestion/index-unit changes
- source metadata or document status changes

Run full quality evals after:

- answer generation changes
- source governance changes
- citation/source rendering changes
- clinical output changes
- release or handoff confidence checks
