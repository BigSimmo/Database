-- Follow-up for projects where 20260711012000 was applied before the covering
-- owner index was added to the fresh-schema definition.
create index if not exists rag_answer_feedback_owner_id_idx
  on public.rag_answer_feedback (owner_id);
