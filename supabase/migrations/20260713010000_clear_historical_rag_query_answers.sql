-- Privacy remediation only: remove historically retained generated answer text.
-- Apply through the normal reviewed migration workflow; this file is not run locally.
update public.rag_queries
set answer = null
where answer is not null;
