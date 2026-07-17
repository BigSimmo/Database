-- Scope the clinical query-term corrector's title vocabulary to the public corpus.
--
-- correct_clinical_query_terms() is SECURITY DEFINER and therefore bypasses RLS.
-- It previously built its spell-correction vocabulary from EVERY indexed document
-- title regardless of owner, while the rest of retrieval is strictly owner-scoped
-- and fail-closed (see docs/tenancy-defense-in-depth-review.md and
-- retrieval_owner_matches). That let a private tenant's title tokens bias — and,
-- via observable query rewriting, leak the existence of — another tenant's private
-- titles: a cross-tenant side-channel.
--
-- Fix: restrict the title union to the shared public corpus (owner_id is null). RAG
-- aliases are curated/global and remain unchanged. Signature is unchanged, so callers
-- and generated types need no update. Idempotent CREATE OR REPLACE.
--
-- NOTE ON SEQUENCING: this migration is the forward change. supabase/schema.sql (the
-- canonical replay reference) and supabase/drift-manifest.json must be updated to
-- match when this migration is applied to the live project — both require the Docker
-- replay (`npm run drift:manifest`) that is unavailable in the CI/agent sandbox. Apply
-- this migration + the schema.sql mirror + the manifest regen together as one operator
-- step (live apply is confirmation-gated). Until applied, live == schema.sql == manifest
-- (all the pre-scope version), so no drift is introduced by merging this file alone.

CREATE OR REPLACE FUNCTION public.correct_clinical_query_terms(input_query text, min_sim real DEFAULT 0.45)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  vocab text[];
  tokens text[];
  tok text;
  best text;
  best_sim real;
  corrected text[] := array[]::text[];
  changed boolean := false;
begin
  if input_query is null or length(trim(input_query)) = 0 then
    return input_query;
  end if;

  -- Build the known-term vocabulary once per call.
  select array_agg(distinct term) into vocab
  from (
    select lower(alias) as term from public.rag_aliases where enabled and length(alias) between 4 and 40
    union
    select lower(canonical) from public.rag_aliases where enabled and length(canonical) between 4 and 40
    union
    select w from public.documents d, lateral unnest(regexp_split_to_array(lower(d.title), '[^a-z]+')) as w
    -- Public (null-owner) titles only: keep the correction vocabulary tenant-safe.
    where d.status = 'indexed' and d.owner_id is null and length(w) between 4 and 40
  ) t;

  tokens := regexp_split_to_array(lower(input_query), '\s+');
  foreach tok in array tokens loop
    if length(tok) < 4 or tok = any(vocab) then
      corrected := corrected || tok;
      continue;
    end if;
    best := null;
    best_sim := 0;
    select v, similarity(v, tok) into best, best_sim
    from unnest(vocab) as v
    order by similarity(v, tok) desc
    limit 1;
    if best is not null and best_sim >= min_sim and best <> tok and length(best) >= length(tok) then
      corrected := corrected || best;
      changed := true;
    else
      corrected := corrected || tok;
    end if;
  end loop;

  if not changed then
    return input_query;
  end if;
  return array_to_string(corrected, ' ');
end;
$function$;

revoke execute on function public.correct_clinical_query_terms(text, real) from public, anon, authenticated;
grant execute on function public.correct_clinical_query_terms(text, real) to service_role;
