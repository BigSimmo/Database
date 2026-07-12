-- Forward-codify the live retrieval RPC bodies so committed migrations reproduce
-- production. Drift backlog item from 20260705210000_retrieval_owner_filter_sentinel.sql.
--
-- VERIFIED LIVE STATE (project sjrfecxgysukkwxsowpy "Clinical KB Database",
-- read-only pg_get_functiondef inspection, 2026-07-12)
-- ------------------------------------------------------------------------------
-- ALL EIGHT primary retrieval RPCs on live ALREADY gate ownership with the
-- fail-closed + sentinel-aware helper retrieval_owner_matches(owner_filter,
-- d.owner_id) — none carry the legacy fail-open inline predicate:
--     match_document_chunks_hybrid(vector,text,integer,double precision,uuid[],uuid)
--     match_document_chunks_text(text,integer,uuid[],uuid)
--     match_document_lookup_chunks_text(text,uuid[],integer,uuid)
--     match_document_table_facts_text(text,integer,uuid[],uuid)
--     match_document_embedding_fields_hybrid(vector,text,integer,double precision,uuid[],uuid)
--     match_document_index_units_hybrid(vector,text,integer,double precision,uuid[],uuid)
--     match_documents_for_query(text,integer,uuid)
--     match_document_chunks(vector,integer,double precision,uuid,uuid)
-- So there is NO live tenancy hole. The gap is reproducibility only: the
-- COMMITTED migration bodies are stale (fail-open + sentinel-blind), so any
-- environment rebuilt from source — Supabase preview branch, `db reset`, DR
-- restore, a new region, or the golden retrieval eval against a fresh DB — gets
-- empty public retrieval plus a fail-open NULL branch that live does not have.
--
-- TWO NON-PRIMARY functions still carry a fail-open-shaped inline predicate on
-- live (assess separately — NOT part of the primary-retrieval codification):
--   * match_document_embedding_fields_text(text,integer,double precision,uuid[],uuid)
--       — sole gate is `(owner_filter is null or d.owner_id = owner_filter)`:
--         genuine latent fail-open on NULL + sentinel-blind. Confirm whether the
--         app calls this text-only variant (the app uses the _hybrid variant);
--         if live, route it through retrieval_owner_matches too.
--   * get_related_document_metadata(uuid[],uuid)
--       — the primary `documents d` join is fail-closed via
--         retrieval_owner_matches, but the label (l) and summary (s) joins keep
--         `(owner_filter is null or …)`. Backstopped by the fail-closed d gate
--         (NULL → no d rows → no l/s rows), so not a live escape, but tidy up
--         for consistency.
--
-- WHY THIS FILE IS NOT HAND-FILLED WITH THE RPC BODIES
-- ------------------------------------------------------------------------------
-- The live bodies total ~26 KB across 8 functions and have diverged FORWARD from
-- committed source (hnsw.ef_search wrapper on match_document_chunks; richer
-- multi-strategy _text/_table_facts_text bodies; left-join quality_score on the
-- hybrid path — see 20260705210000). They must be codified BYTE-FOR-BYTE from
-- live: a transcription error or a stale-source rebuild would REGRESS retrieval,
-- the exact trap 20260705210000 was neutralized to prevent. That requires a
-- direct DB dump (the environment running this review has no Postgres connection
-- string — only PostgREST keys — so it cannot produce a byte-perfect dump). This
-- is owner-driven, matching the documented `supabase migration repair` drift
-- workflow.
--
-- OWNER COMPLETION (byte-perfect, no hand transcription; each step confirmed):
-- ------------------------------------------------------------------------------
--  1. With the linked project + DB connection string ($SUPABASE_DB_URL), append
--     the EXACT live bodies to this file:
--
--       psql "$SUPABASE_DB_URL" -X -q -At -o /tmp/rpc_bodies.sql -c "
--         select string_agg(pg_get_functiondef(p.oid) || E';\n', E'\n' order by p.proname, p.oid)
--         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--         where n.nspname = 'public' and p.proname in (
--           'match_document_chunks_hybrid','match_document_chunks_text',
--           'match_document_lookup_chunks_text','match_document_table_facts_text',
--           'match_document_embedding_fields_hybrid','match_document_index_units_hybrid',
--           'match_documents_for_query','match_document_chunks');"
--       cat /tmp/rpc_bodies.sql >> supabase/migrations/20260712000000_forward_codify_retrieval_owner_matches.sql
--
--     (`create or replace function` is idempotent; applying on live is a no-op
--     because the bodies already match. On fresh rebuilds it installs them.)
--  2. Apply on a Supabase PREVIEW BRANCH. The DO $verify$ guard below must pass,
--     then run:  npm run eval:retrieval:quality -- --fail-on-threshold   (36/36)
--     to prove the rebuilt retrieval matches live before this reaches main.
--  3. Only after a green preview + golden eval, land + apply.

set search_path = public, extensions, pg_temp;

-- Safe, idempotent guard: re-assert the fail-closed + sentinel-aware truth table
-- for retrieval_owner_matches so a bad redefinition (or an environment where the
-- helper drifted back to fail-open) fails this migration loudly instead of
-- silently shipping a tenancy regression. Mirrors 20260708160001.
do $verify$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  sentinel uuid := '00000000-0000-0000-0000-000000000000';
begin
  if public.retrieval_owner_matches(null, a) is not false then
    raise exception 'retrieval_owner_matches(NULL, uuid) must be FALSE (fail-closed)';
  end if;
  if public.retrieval_owner_matches(null, null) is not false then
    raise exception 'retrieval_owner_matches(NULL, NULL) must be FALSE (fail-closed)';
  end if;
  if public.retrieval_owner_matches(sentinel, null) is not true then
    raise exception 'retrieval_owner_matches(sentinel, NULL) must be TRUE (public row)';
  end if;
  if public.retrieval_owner_matches(sentinel, a) is not false then
    raise exception 'retrieval_owner_matches(sentinel, owned) must be FALSE (public-only)';
  end if;
  if public.retrieval_owner_matches(a, a) is not true then
    raise exception 'retrieval_owner_matches(owner, same owner) must be TRUE';
  end if;
  if public.retrieval_owner_matches(a, b) is not false then
    raise exception 'retrieval_owner_matches(owner, other owner) must be FALSE';
  end if;
end
$verify$;

-- >>> OWNER: append the byte-perfect live RPC bodies below this line (step 1). <<<
