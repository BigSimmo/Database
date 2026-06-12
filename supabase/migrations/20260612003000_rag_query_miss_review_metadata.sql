alter table public.rag_query_misses
  add column if not exists review_status text not null default 'new',
  add column if not exists expected_document_id uuid references public.documents(id) on delete set null,
  add column if not exists expected_chunk_id uuid references public.document_chunks(id) on delete set null,
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists promoted_eval_case boolean not null default false;

alter table public.rag_query_misses
  drop constraint if exists rag_query_misses_review_status_check;

alter table public.rag_query_misses
  add constraint rag_query_misses_review_status_check
  check (review_status in ('new', 'fixed', 'not_in_corpus', 'ambiguous', 'ignored'));

create index if not exists rag_query_misses_owner_review_status_created_idx
  on public.rag_query_misses(owner_id, review_status, created_at desc);
