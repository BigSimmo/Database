create table if not exists public.rag_aliases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  alias text not null,
  canonical text not null,
  alias_type text not null
    check (alias_type in ('medication', 'document_title', 'acronym', 'service', 'workflow', 'typo', 'clinical_term', 'custom')),
  weight real not null default 1.0,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rag_aliases_alias_nonempty check (btrim(alias) <> ''),
  constraint rag_aliases_canonical_nonempty check (btrim(canonical) <> '')
);

create index if not exists rag_aliases_owner_enabled_idx
  on public.rag_aliases(owner_id, enabled);

create index if not exists rag_aliases_type_enabled_idx
  on public.rag_aliases(alias_type, enabled);

create index if not exists rag_aliases_alias_trgm_idx
  on public.rag_aliases using gin ((lower(alias)) gin_trgm_ops);

drop trigger if exists rag_aliases_updated_at on public.rag_aliases;
create trigger rag_aliases_updated_at
before update on public.rag_aliases
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.rag_aliases to service_role;
grant select on table public.rag_aliases to authenticated;

alter table public.rag_aliases enable row level security;

drop policy if exists "rag aliases owner read" on public.rag_aliases;
create policy "rag aliases owner read" on public.rag_aliases
  for select to authenticated using (owner_id is null or owner_id = (select auth.uid()));
