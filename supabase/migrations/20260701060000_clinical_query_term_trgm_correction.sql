-- Item 10 (RC6): generalize typo handling beyond the hard-coded ~15-entry map. This function
-- trigram-corrects each query token against a vocabulary of known clinical terms (rag_aliases
-- aliases + canonicals, and distinct words from indexed document titles). It is meant as a FALLBACK
-- (called only when strict + OR-relaxed full-text search returns nothing — the same safe pattern as
-- the 8b OR-relaxation) so it never "corrects" a valid rare term on the happy path.
--
-- Rules: only tokens of length >= 4 are considered; a token already present verbatim in the vocab is
-- kept; otherwise the best trigram match at similarity >= min_sim replaces it — but only when the
-- match does NOT shorten the token. Real typos add or swap characters (missing/transposed letters),
-- so the fix is same-length-or-longer; a shorter match (e.g. "treated"->"treat", "symptoms"->
-- "symptom") is a morphological variant of a valid word, not a typo, and must not be "corrected".
-- Short tokens and tokens with no confident match are left unchanged. Returns the reconstructed query
-- (or the input unchanged when nothing was corrected).
create or replace function public.correct_clinical_query_terms(
  input_query text,
  min_sim real default 0.45
)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $$
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
    where d.status = 'indexed' and length(w) between 4 and 40
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
$$;

revoke execute on function public.correct_clinical_query_terms(text, real) from public, anon, authenticated;
grant execute on function public.correct_clinical_query_terms(text, real) to service_role;
