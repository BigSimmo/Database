-- ============================================================================
-- Operator diagnostic: why the clozapine threshold answers are rejected
-- Eval canary cases quality-clozapine-red-result-action,
-- quality-clozapine-fbc-monitoring, clozapine-anc-withhold-threshold,
-- clozapine-fbc-acronym-threshold
-- ============================================================================
--
-- PURPOSE:
-- Settle, with data rather than inference, why an answer IS generated for the
-- clozapine blood-monitoring questions (~17 s of generation on the ANC case) and
-- is then discarded by verification. Two theories were tested offline against the
-- repository's own code and BOTH WERE DISPROVED. They are recorded here so this
-- file is not used to re-test them:
--
--   DISPROVED (1) "the monitoring table is split across chunk boundaries, so the
--   threshold figure and the withhold action land in different chunks and
--   adjacentLabelledNumericBandConflicts fires." Running the real guard over a
--   realistic clozapine monitoring table (green/amber/red bands plus a withhold
--   instruction), both intact and split across two adjacent chunks, produced
--   0 conflicts in BOTH arrangements. The guard is not what rejects these answers.
--
--   DISPROVED (2) "extractiveAnswerCarriesIntentFigure rejects correctly worded
--   answers." Six realistic phrasings were run through the real predicate. Four
--   passed, including the plain form "If the absolute neutrophil count falls below
--   1.5 x10^9/L, clozapine must be withheld". The two that failed were genuinely
--   incomplete answers, which is the predicate working as designed.
--
-- REMAINING HYPOTHESIS, which is what this file measures:
-- The corpus holds several overlapping clozapine guidelines (CAMHS, Fiona Stanley,
-- AKG, MHSP). If the passages that rank highest come from the guidelines that do
-- NOT state a numeric threshold and its action together, then generation is working
-- from evidence that cannot support a threshold claim, verification correctly
-- refuses it, and the defect is in what is retrieved rather than in any guard. That
-- makes this a corpus and ranking question, and it is answerable only against the
-- live index.
--
-- EXECUTION:
-- Read-only. Every statement is a SELECT. Nothing writes, locks, or creates
-- anything. Run in an approved operator window (Supabase SQL Editor or psql)
-- against project `Clinical KB Database` (sjrfecxgysukkwxsowpy).
--
-- RUN IT IN THE SQL EDITOR, NOT FROM A CLIENT. Execute on
-- match_document_chunks_text_v3 is revoked from public, anon, authenticated and
-- service_role and granted to service_role only, so Steps 4 and 5 will raise a
-- permission error from an ordinary PostgREST session. The SQL Editor connects as
-- the table/function owner, which is where these are meant to run. Steps 1 to 3
-- read base tables directly and are subject to RLS for any non-owner role.
--
-- EVERY STEP IS BOUNDED. Steps 4 and 5 call a retrieval function against the live
-- clinical index, which is the same work a user query does. Each step runs in its
-- own transaction with `set local statement_timeout`, following the `set local`
-- convention the guard migrations use (AGENTS.md § Supabase project safety).
-- `set local` reverts at commit, so the session and the database are unchanged.
--
-- WHAT THIS CAN AND CANNOT SHOW:
-- Step 4 calls match_document_chunks_text_v3, which is the LEXICAL half of the
-- hybrid retriever. It needs no embedding, so it can be run from a SQL console,
-- but it is an approximation: it will not reproduce the exact production ordering,
-- which blends vector similarity. Read it as evidence about which DOCUMENTS are
-- plausible top candidates, not as the production rank. Steps 1 to 3 need no such
-- caveat, because they are statements about the stored corpus itself.
--
-- AN EMPTY STEP 4 OR 5 IS NOT A FINDING UNTIL STEP 1 IS READ. The governed
-- candidate function returns nothing at all unless `corpus_scopes` is non-null,
-- and its only document branch admits `australian_public` and
-- `international_supplementary`. A document scoped `uploaded_local` cannot be
-- produced by it however well it matches. Step 1 reports that scope, and Steps 4
-- and 5 pass the scope array explicitly, so neither trap can fire silently.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: What clozapine guidelines are in the corpus, and can they be retrieved?
--
-- Establishes the duplicate set AND whether each document can enter retrieval at
-- all. The four canary cases pin CG.MHSP.ClozapinePresAdminMonitor.pdf, so the
-- governance columns below are not background detail: production retrieval admits
-- a document only when every one of them holds (see the `document_candidates` CTE
-- of match_governed_candidate_chunks_v3), and `retrievable_corpus_scope` is the
-- one that most often fails.
--
-- READ `corpus_scope` FIRST, BECAUSE IT MAY END THE INVESTIGATION HERE.
-- match_governed_candidate_chunks_v3 has exactly two candidate branches: documents
-- scoped `australian_public` or `international_supplementary`, and site-content
-- records scoped `clinical_kb_site`. There is NO branch for `uploaded_local`. That
-- value passes the argument validator and then matches nothing, and it is
-- deliberate: migration 20260901120100_fail_closed_unactivated_uploaded_local_retrieval.sql
-- switched uploaded-local retrieval off, "until P16 supplies generation-bound
-- activation".
--
-- So a plausible and cheap explanation of all four canary failures is simply that
-- the expected clozapine guideline is scoped `uploaded_local` and is therefore
-- currently unretrievable BY DESIGN — no chunking defect, no ranking defect, and
-- nothing wrong with the verification guards. If this row shows that, Steps 4 and
-- 5 will be empty by construction, their emptiness says nothing about ranking, and
-- the real question becomes whether that fail-closed state is still intended while
-- these cases sit red in the weekly canary.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '30s';

select
  d.file_name,
  d.title,
  d.status,
  d.chunk_count,
  d.page_count,
  d.owner_id is null as ownerless,
  d.metadata->>'corpus_scope' as corpus_scope,
  d.metadata->>'corpus_scope' in ('australian_public', 'international_supplementary')
    as retrievable_corpus_scope,
  d.metadata->'public_corpus' = 'true'::jsonb as public_corpus,
  d.metadata->>'source_kind' as source_kind,
  d.metadata->>'content_mode' as content_mode,
  d.metadata->>'document_status' as document_status,
  d.metadata->>'change_state' as change_state,
  d.metadata->>'licence_policy' as licence_policy,
  nullif(d.metadata->>'source_catalogue_key', '') is not null as has_catalogue_key,
  nullif(d.metadata->>'source_policy_version', '') is not null as has_policy_version,
  nullif(d.metadata->>'publication_approval_id', '') is not null as has_publication_approval,
  nullif(d.metadata->>'publication_manifest_digest', '') is not null as has_manifest_digest,
  d.index_generation_id,
  d.metadata->>'review_status' as review_status,
  d.created_at
from public.documents d
where d.file_name ilike '%clozapine%'
   or d.title ilike '%clozapine%'
order by d.file_name;

commit;

-- ----------------------------------------------------------------------------
-- Step 2: Does ANY single stored chunk bind a blood-count figure to the action?
--
-- THIS IS THE DECISIVE QUERY. A grounded threshold answer requires one passage
-- that states both a neutrophil/WCC figure and the instruction to withhold or
-- cease. If this returns zero rows for CG.MHSP.ClozapinePresAdminMonitor.pdf, then
-- no amount of ranking work can produce a verifiable answer from the expected
-- document, and the fix is in ingestion or in the source document, not in
-- retrieval. If it returns rows, retrieval is failing to surface them and Step 4
-- says which documents are displacing them.
--
-- `production_admissible` IS PART OF THE ANSWER, NOT DECORATION. This query
-- deliberately does not filter to admissible rows, because a stale chunk from a
-- superseded index generation, or a duplicate on an unindexed document, is
-- exactly the kind of thing worth seeing. But such a row cannot enter retrieval,
-- so it is NOT evidence that the evidence exists and is being outranked. Treat
-- only rows where `production_admissible` is true as support for the ranking
-- branch of the result table at the end of this file.
--
-- The figure pattern matches the forms these guidelines use: a decimal count with
-- or without units (1.5, 1.5 x10^9/L, 0.5 x 10 9 /L), and the bare integer
-- thresholds used for WCC (3.0, 3500).
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '30s';

select
  d.file_name,
  c.page_number,
  c.chunk_index,
  c.section_heading,
  length(c.content) as content_chars,
  (
    d.owner_id is null
    and d.status = 'indexed'
    and public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    and d.metadata->>'corpus_scope' in ('australian_public', 'international_supplementary')
    and d.metadata->>'source_kind' = 'document'
    and d.metadata->'public_corpus' = 'true'::jsonb
    and d.metadata->>'content_mode' = 'indexed_content'
    and d.metadata->>'document_status' = 'current'
    and coalesce(d.metadata->>'change_state', '') in ('changed', 'unchanged')
    and d.metadata->>'licence_policy' = 'public_index_permitted'
    and nullif(d.metadata->>'source_catalogue_key', '') is not null
    and nullif(d.metadata->>'source_policy_version', '') is not null
    and nullif(d.metadata->>'publication_approval_id', '') is not null
    and nullif(d.metadata->>'publication_manifest_digest', '') is not null
  ) as production_admissible,
  public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)
    as committed_generation,
  c.index_generation_id as chunk_generation_id,
  d.index_generation_id as document_generation_id,
  c.content ~* '(anc|absolute neutrophil|neutrophil|wcc|white cell)' as mentions_count_name,
  c.content ~* '[0-9]+\.[0-9]+\s*(x\s*10)?' as carries_decimal_figure,
  c.content ~* '(withhold|cease|stop|do not (give|administer|dispense)|suspend)' as carries_stop_action,
  left(regexp_replace(c.content, '\s+', ' ', 'g'), 400) as excerpt
from public.document_chunks c
join public.documents d on d.id = c.document_id
where (d.file_name ilike '%clozapine%' or d.title ilike '%clozapine%')
  and c.content ~* '(anc|absolute neutrophil|neutrophil|wcc|white cell)'
  and c.content ~* '[0-9]+\.[0-9]+'
  and c.content ~* '(withhold|cease|stop|do not (give|administer|dispense)|suspend)'
order by production_admissible desc, d.file_name, c.page_number nulls last, c.chunk_index;

commit;

-- ----------------------------------------------------------------------------
-- Step 3: If Step 2 is empty, is the binding split across ADJACENT chunks?
--
-- Theory (1) above was disproved as a guard-firing explanation, but the weaker
-- form of it is still live and is a different claim: the guard does not fire, yet
-- the two halves may still be in separate chunks, in which case no single passage
-- is citable and verification refuses for want of support rather than because of
-- a conflict. This lists, per document, chunks carrying the figure but no action
-- alongside the chunk that immediately follows.
--
-- Read Step 3 ONLY if Step 2 returned nothing for the expected document. If Step 2
-- returned rows, the binding exists and Step 3 is not the explanation.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '30s';

with clozapine_chunks as (
  select
    d.file_name,
    c.document_id,
    c.chunk_index,
    c.page_number,
    c.section_heading,
    c.content,
    lead(c.content) over (partition by c.document_id order by c.chunk_index) as next_content,
    lead(c.chunk_index) over (partition by c.document_id order by c.chunk_index) as next_chunk_index
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.file_name ilike '%clozapine%' or d.title ilike '%clozapine%'
)
select
  file_name,
  page_number,
  chunk_index,
  next_chunk_index,
  section_heading,
  left(regexp_replace(content, '\s+', ' ', 'g'), 220) as figure_chunk_excerpt,
  left(regexp_replace(coalesce(next_content, ''), '\s+', ' ', 'g'), 220) as next_chunk_excerpt
from clozapine_chunks
where content ~* '(anc|absolute neutrophil|neutrophil|wcc|white cell)'
  and content ~* '[0-9]+\.[0-9]+'
  and content !~* '(withhold|cease|stop|do not (give|administer|dispense)|suspend)'
  and coalesce(next_content, '') ~* '(withhold|cease|stop|do not (give|administer|dispense)|suspend)'
order by file_name, chunk_index;

commit;

-- ----------------------------------------------------------------------------
-- Step 4: Which clozapine document wins retrieval for the canary questions?
--
-- The four canary questions, run through the repository's own governed lexical
-- retrieval function. `expected_rank` is what matters: if
-- CG.MHSP.ClozapinePresAdminMonitor.pdf does not appear near the top, the
-- duplicates are displacing it and the remaining hypothesis holds.
--
-- `corpus_scopes` IS NOT OPTIONAL, despite defaulting to NULL. The callee's
-- `admitted` CTE requires `corpus_scopes is not null` with cardinality 1..4, and
-- every candidate branch cross-joins `admitted` — so a call that stops at
-- `include_public` returns ZERO ROWS ALWAYS, whatever is in the index. An operator
-- reading that emptiness as "not retrievable" would be sent to ingestion or source
-- work over a document that is in fact perfectly retrievable. The array below is
-- therefore passed explicitly, and holds the two scopes the document branch can
-- match.
--
-- This is a narrower question than production asks. The application's primary
-- phase is `uploaded_local` plus, conditionally, `clinical_kb_site` and
-- `australian_public`, with `international_supplementary` as a second phase
-- (retrievalCorpusScopes in src/lib/rag/rag-candidate-sources.ts). The scopes here
-- cover the PDF corpus only, deliberately, so the site-release machinery is not
-- dragged into a question about a PDF. `corpus_scope` is selected per row so it is
-- visible which branch each hit came from.
--
-- Remaining arguments are the function defaults made explicit: match_count 12, no
-- document filter, the all-zero owner sentinel, include_public true. This reads the
-- same governed candidate path the application reads. It is provider-side work
-- against the live index, which is why it belongs in an approved window.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '60s';

with questions(case_id, question) as (
  values
    ('quality-clozapine-red-result-action', 'What should I do with a red clozapine ANC result?'),
    ('quality-clozapine-fbc-monitoring', 'What FBC monitoring schedule applies for clozapine?'),
    ('clozapine-anc-withhold-threshold', 'What ANC or FBC threshold should withhold clozapine?'),
    ('clozapine-fbc-acronym-threshold', 'What FBC threshold should withhold clozapine?')
)
select
  q.case_id,
  row_number() over (partition by q.case_id order by m.text_rank desc) as rank,
  m.file_name,
  m.corpus_scope,
  m.page_number,
  m.chunk_index,
  m.section_heading,
  round(m.text_rank::numeric, 5) as text_rank,
  m.content ~* '(withhold|cease|stop|do not (give|administer|dispense)|suspend)'
    and m.content ~* '[0-9]+\.[0-9]+' as chunk_binds_figure_to_action,
  left(regexp_replace(m.content, '\s+', ' ', 'g'), 240) as excerpt
from questions q
cross join lateral public.match_document_chunks_text_v3(
  q.question,
  12,
  null,
  '00000000-0000-0000-0000-000000000000'::uuid,
  true,
  array['australian_public', 'international_supplementary']::text[]
) m
order by q.case_id, text_rank desc;

commit;

-- ----------------------------------------------------------------------------
-- Step 5: Is the expected document retrievable at all for these terms?
--
-- A narrower control for Step 4. Restricting the candidate set to the expected
-- document separates "it is outranked" from "it is not retrievable". If this
-- returns the threshold passage and Step 4 does not, the defect is ranking. If
-- this returns nothing useful either, the defect is upstream in ingestion, which
-- is consistent with a Step 2 that came back empty.
--
-- One prior condition, from Step 1: if the expected document is not scoped
-- `australian_public` or `international_supplementary`, this returns zero rows
-- whatever its content, because no candidate branch of the callee can produce it.
-- Check `corpus_scope` in Step 1 before reading an empty result here as a finding.
-- ----------------------------------------------------------------------------
begin;
set local statement_timeout = '60s';

with expected_document as (
  select array_agg(id) as ids
  from public.documents
  where file_name = 'CG.MHSP.ClozapinePresAdminMonitor.pdf'
)
select
  m.corpus_scope,
  m.chunk_index,
  m.page_number,
  m.section_heading,
  round(m.text_rank::numeric, 5) as text_rank,
  left(regexp_replace(m.content, '\s+', ' ', 'g'), 400) as excerpt
from expected_document e
cross join lateral public.match_document_chunks_text_v3(
  'What ANC or FBC threshold should withhold clozapine?',
  12,
  e.ids,
  '00000000-0000-0000-0000-000000000000'::uuid,
  true,
  array['australian_public', 'international_supplementary']::text[]
) m
order by m.text_rank desc;

commit;

-- ============================================================================
-- HOW TO READ THE RESULT
--
--   Step 1 shows the expected document is scoped `uploaded_local`
--       -> NOT A DEFECT IN THIS PIPELINE. Uploaded-local retrieval is switched off
--          on purpose by 20260901120100_fail_closed_unactivated_uploaded_local_retrieval.sql
--          pending generation-bound activation, so the document cannot enter the
--          governed candidate path and Steps 4 and 5 are empty by construction.
--          Read no further. The decision this raises is a product one for the
--          owner: keep the fail-closed state and accept these canary cases stay
--          red, or prioritise the activation work. Do not attempt to route around
--          it in retrieval code.
--
--   Step 1 shows any OTHER governance column false, at a retrievable scope
--       -> ADMISSION defect. The document is meant to be retrievable but its
--          publication metadata does not satisfy the candidate branch. Fix the
--          metadata rather than the retrieval code, and read no further down this
--          file until it is fixed.
--
--   Step 2 returns PRODUCTION-ADMISSIBLE rows for
--   CG.MHSP.ClozapinePresAdminMonitor.pdf AND Step 4 ranks that document below
--   the duplicates
--       -> RANKING defect. The evidence exists and is not being selected.
--
--   Step 2 returns rows but none with `production_admissible` true
--       -> GENERATION or PUBLICATION defect. The passage exists in storage but
--          belongs to a superseded index generation or an unpublished document,
--          so retrieval cannot reach it. Compare `chunk_generation_id` against
--          `document_generation_id` and check the publication metadata in Step 1.
--
--   Step 2 empty for that document, Step 3 shows a figure/action split
--       -> INGESTION defect. Chunk the monitoring table so one passage carries
--          the band and its action. Note this is a protected-surface change:
--          flag it before editing and follow AGENTS.md § RAG ranking protection.
--
--   Step 2 empty and Step 3 empty
--       -> SOURCE defect. The expected PDF does not state the threshold and the
--          action together in extractable text, which may mean the table is an
--          image and OCR did not recover it. Check document_images and the OCR
--          text for those pages before touching any retrieval code.
--
-- In every branch: do NOT relax the canary case, the verification predicate, or
-- adjacentLabelledNumericBandConflicts to make these pass. A red case here is the
-- system correctly refusing to state a clozapine withhold threshold it cannot
-- support from a source, which is the conservative behaviour the canary exists to
-- protect.
-- ============================================================================
