-- P3 hygiene from the 2026-07-24 Database↔Supabase interface audit:
-- base match RPCs historically relied on roles.sql / default-privilege churn for
-- EXECUTE lockdown. Reassert service_role-only grants next to the live signatures
-- so fresh replay and hosted apply stay explicit and idempotent.
--
-- No retrieval behaviour change — grants only.

do $$
begin
  if to_regprocedure('public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)') is not null then
    revoke execute on function public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)
      from public, anon, authenticated;
    grant execute on function public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)
      to service_role;
  end if;

  if to_regprocedure('public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
      from public, anon, authenticated;
    grant execute on function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
      to service_role;
  end if;

  if to_regprocedure('public.match_document_chunks_text(text, integer, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_chunks_text(text, integer, uuid[], uuid)
      from public, anon, authenticated;
    grant execute on function public.match_document_chunks_text(text, integer, uuid[], uuid)
      to service_role;
  end if;

  if to_regprocedure('public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)') is not null then
    revoke execute on function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
      from public, anon, authenticated;
    grant execute on function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
      to service_role;
  end if;

  if to_regprocedure('public.match_documents_for_query(text, integer, uuid)') is not null then
    revoke execute on function public.match_documents_for_query(text, integer, uuid)
      from public, anon, authenticated;
    grant execute on function public.match_documents_for_query(text, integer, uuid)
      to service_role;
  end if;
end
$$;
