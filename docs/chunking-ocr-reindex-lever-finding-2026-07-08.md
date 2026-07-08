# Chunking / OCR-repair re-index lever — measured finding (2026-07-08)

**Verdict: negligible / neutral. Do NOT build config-gated chunking and do NOT re-index for
this. Revisit only on a NEW, real golden miss that traces to a flattened dual-column table
AND a config-gated chunking change that lifts `content_mrr@10` above baseline in eval.**

This records a Phase-A offline measurement so the "last high-value retrieval lever"
(table/heading-aware chunking + OCR repair, then a controlled re-index) is not re-litigated.
It is the same call, on the same evidence standard, as the wrapped-dose-unit issue
(measured 0.03%, correctly not re-indexed — see `npm run measure:wrapped-dose-units`).

All figures below are from read-only queries against the live `Clinical KB Database`
project (`sjrfecxgysukkwxsowpy`) on 2026-07-08. No worker, no re-index, no spend.

## Why the re-index was gated

- Enrichment coverage is already ~100%: **2065 docs / 69,334 chunks (all embedded) /
  111,991 index units / 2065 `document_index_quality` rows**. Re-embedding the same text
  buys nothing (see `docs/reindex-runbook.md`); a re-index only pays off if chunk
  boundaries change (heading/table-aware) or the text changes (OCR repair).
- Retrieval is already strong: `content_mrr@10 ≈ 0.90`, `document_recall@5 =
  content_recall@5 = 1.0` on the 24-case golden set — recall headroom is zero.
- A full re-index re-embeds ~69k chunks against OpenAI = real spend, and needs explicit
  owner go.

## Finding 1 — `noisy_unit_rate` is a red herring (visual coverage, not corruption)

`document_index_quality` was read as flagging ~495 docs for "dropped-letter OCR corruption"
via `noisy_unit_rate > 0.2`. That is a misread of the column.

- It is computed as `noisy_unit_rate = max(0, 1 - typed_unit_coverage)` where
  `typed_unit_coverage = visual_units / total_units`
  (`supabase/functions/indexing-v3-agent/index.ts`). It measures the fraction of a doc's
  index units that are **not** visual-model units — a visual-coverage metric, unrelated to
  text corruption.
- On live it is **saturated at 1.0 for all 1,779 docs** that carry the signal, purely
  because `visual_units = 0` corpus-wide (the visual-unit path was not populated on these
  rows). The identity `noisy_unit_rate = 1 - visual_units/total_units` holds exactly
  (0 violations).
- Gotcha for future queries: `document_index_quality.metrics` is a JSON **array**, and the
  `indexing_v3_agent` payload is a *stringified* JSON element inside it. Extract with
  `jsonb_array_elements_text(metrics)` filtered to elements `like '%indexing_v3_agent%'`,
  then cast to `jsonb`.

## Finding 2 — OCR corruption in index units is negligible (measured directly)

Measured directly on all 111,991 rows of `document_index_units` (the layer the concern
named; raw `document_chunks` answer context is clean):

| Signal | Count | % of 111,991 units |
| --- | --- | --- |
| Exact cited signature (`p ycho`, ` ocial`) | **0** | 0% |
| Interior single-consonant proxy ` [b-hj-z] ` | 4,398 | 3.9% |
| — of which bullet-"o" glyph (`○`/`•` → "o", words intact; cosmetic) | 3,633 | 82.6% of proxy |
| — non-"o", excluding dose/dimension tokens (upper bound) | **84** | **0.075%** |

The 84 residual units are almost all legitimate clinical/measurement tokens
(`2 g IV`, `x 109/L`, `type b (Hib)`, `10cm x 15cm`). The only genuine artifacts are a
couple of letter-spaced decorative banners (`A u s t r a l i a's S a f e s t...`) and a few
truncated table cells — all in non-clinical text.

The index-unit build path does not introduce corruption: `buildUnit` →
`clinicalVocabularySearchText` only **appends** vocabulary terms and `compact` only
truncates — neither drops or spaces out letters (`src/lib/document-index-units.ts`,
`src/lib/clinical-vocabulary.ts`).

## Finding 3 — table/heading-aware chunking is already implemented

`src/lib/chunking.ts` already provides the mechanisms the lever proposed to add:

- `detectHeading`, `extractSectionHeadings`, `headingLevel` (heading-aware).
- `isTableBlock` / `chunkTableBlock` (table-aware; pipe-delimited blocks chunked
  separately rather than flattened into prose).

Live confirms it is working:

- `section_path` is populated on **100%** of 69,334 chunks; `section_heading` on 42%.
- Chunks are well-bounded — p50 996, p90 1,239, max 2,700 chars; only 435 chunks (0.6%)
  exceed 2,400 chars. There is **no run-on flattening** at the chunk-size level.
- 4,608 chunks (6.6%) already carry markdown table rows.
- The dual-column "inpatient / community" concern matches only 219 chunks on the near
  pattern, mostly ordinary prose. The genuinely scrambled cases are **flowcharts**
  (boxes + arrows) that text chunking cannot linearize — those belong to the visual/image
  extraction path, not `chunking.ts`.

## Bottom line

Neither lever clears the bar. OCR repair addresses ~0.075% of units (mostly non-clinical
decoration); table/heading-aware chunking already exists and chunks are healthy; retrieval
recall is already maxed. A re-index would spend real OpenAI budget on ~69k chunks for ~0
expected retrieval gain. **Stop.**
