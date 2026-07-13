set lock_timeout = '5s';

alter table public.rag_visual_eval_cases
  drop constraint if exists rag_visual_eval_cases_document_id_fkey,
  add constraint rag_visual_eval_cases_document_id_fkey
    foreign key (document_id) references public.documents(id) on delete set null;

alter table public.rag_visual_eval_runs
  drop constraint if exists rag_visual_eval_runs_document_id_fkey,
  add constraint rag_visual_eval_runs_document_id_fkey
    foreign key (document_id) references public.documents(id) on delete set null;
