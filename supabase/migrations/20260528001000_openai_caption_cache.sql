create table if not exists public.image_caption_cache (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  image_hash text not null,
  model text not null,
  mime_type text,
  caption text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, image_hash, model)
);

create index if not exists image_caption_cache_owner_hash_idx
  on public.image_caption_cache(owner_id, image_hash, model);

drop trigger if exists image_caption_cache_updated_at on public.image_caption_cache;
create trigger image_caption_cache_updated_at
before update on public.image_caption_cache
for each row execute function public.set_updated_at();

grant select, insert, update on table public.image_caption_cache to service_role;

alter table public.image_caption_cache enable row level security;
