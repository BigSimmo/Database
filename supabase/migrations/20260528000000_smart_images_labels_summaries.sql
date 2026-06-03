alter table public.document_images
  add column if not exists image_type text not null default 'unclear'
    check (image_type in (
      'clinical_table',
      'flowchart_algorithm',
      'form_checklist',
      'risk_matrix',
      'medication_chart',
      'graph',
      'screenshot_ui',
      'photo',
      'logo_decorative',
      'unclear'
    )),
  add column if not exists searchable boolean not null default true,
  add column if not exists clinical_relevance_score real not null default 0,
  add column if not exists skip_reason text,
  add column if not exists source_kind text not null default 'embedded',
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists image_hash text,
  add column if not exists perceptual_hash text,
  add column if not exists labels text[] not null default '{}';

create index if not exists document_images_searchable_idx
  on public.document_images(document_id, searchable, image_type, page_number);
create index if not exists document_images_hash_idx
  on public.document_images(document_id, image_hash)
  where image_hash is not null;
create index if not exists document_images_labels_idx
  on public.document_images using gin(labels);

create table if not exists public.document_labels (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  label text not null,
  label_type text not null
    check (label_type in (
      'topic',
      'document_type',
      'medication',
      'risk',
      'setting',
      'workflow',
      'population',
      'service',
      'custom'
    )),
  source text not null default 'generated'
    check (source in ('generated', 'manual')),
  confidence real not null default 0.5 check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, label_type, label, source)
);

create table if not exists public.document_summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  summary text not null,
  clinical_specifics jsonb not null default '{}'::jsonb,
  source_chunk_ids uuid[] not null default '{}',
  source_image_ids uuid[] not null default '{}',
  model text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_labels_owner_label_idx
  on public.document_labels(owner_id, label_type, label);
create index if not exists document_labels_document_idx
  on public.document_labels(document_id);
create index if not exists document_summaries_owner_idx
  on public.document_summaries(owner_id, generated_at desc);

grant select, insert, update, delete on table public.document_labels to service_role;
grant select, insert, update, delete on table public.document_summaries to service_role;
grant select on table public.document_labels, public.document_summaries to authenticated;
grant insert, update, delete on table public.document_labels to authenticated;

alter table public.document_labels enable row level security;
alter table public.document_summaries enable row level security;

drop policy if exists "labels owner read" on public.document_labels;
create policy "labels owner read" on public.document_labels
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "labels owner manual insert" on public.document_labels;
create policy "labels owner manual insert" on public.document_labels
  for insert to authenticated
  with check ((select auth.uid()) = owner_id and source = 'manual');

drop policy if exists "labels owner manual update" on public.document_labels;
create policy "labels owner manual update" on public.document_labels
  for update to authenticated
  using ((select auth.uid()) = owner_id and source = 'manual')
  with check ((select auth.uid()) = owner_id and source = 'manual');

drop policy if exists "labels owner manual delete" on public.document_labels;
create policy "labels owner manual delete" on public.document_labels
  for delete to authenticated
  using ((select auth.uid()) = owner_id and source = 'manual');

drop policy if exists "summaries owner read" on public.document_summaries;
create policy "summaries owner read" on public.document_summaries
  for select to authenticated
  using ((select auth.uid()) = owner_id);
