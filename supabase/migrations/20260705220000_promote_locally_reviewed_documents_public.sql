-- Promote locally reviewed indexed documents to the public corpus (owner_id IS NULL)
-- so anonymous callers can list, preview, search, and use them in RAG.

begin;

create temporary table promoted_public_documents on commit drop as
with promoted as (
  update public.documents d
  set
    owner_id = null,
    metadata = jsonb_set(
      coalesce(d.metadata, '{}'::jsonb),
      '{public_corpus}',
      'true'::jsonb,
      true
    ),
    updated_at = now()
  where d.status = 'indexed'
    and d.owner_id is not null
    and coalesce(d.metadata->>'clinical_validation_status', 'unverified') in ('locally_reviewed', 'approved')
  returning d.id, d.owner_id as previous_owner_id
)
select id, previous_owner_id from promoted;

update public.document_labels dl
set owner_id = null, updated_at = now()
from promoted_public_documents pd
where dl.document_id = pd.id;

update public.document_summaries ds
set owner_id = null, updated_at = now()
from promoted_public_documents pd
where ds.document_id = pd.id;

update public.document_sections ds
set owner_id = null, updated_at = now()
from promoted_public_documents pd
where ds.document_id = pd.id;

update public.document_memory_cards dmc
set owner_id = null, updated_at = now()
from promoted_public_documents pd
where dmc.document_id = pd.id;

update public.document_table_facts dtf
set owner_id = null
from promoted_public_documents pd
where dtf.document_id = pd.id;

update public.document_embedding_fields def
set owner_id = null
from promoted_public_documents pd
where def.document_id = pd.id;

update public.document_index_quality diq
set owner_id = null, updated_at = now()
from promoted_public_documents pd
where diq.document_id = pd.id;

update public.document_index_units diu
set owner_id = null, updated_at = now()
from promoted_public_documents pd
where diu.document_id = pd.id;

commit;
