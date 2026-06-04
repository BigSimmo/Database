drop policy if exists "document sections owner all" on public.document_sections;
create policy "document sections owner all" on public.document_sections
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "document memory cards owner all" on public.document_memory_cards;
create policy "document memory cards owner all" on public.document_memory_cards
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "image caption cache owner all" on public.image_caption_cache;
create policy "image caption cache owner all" on public.image_caption_cache
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create index if not exists document_sections_owner_idx
  on public.document_sections(owner_id);
create index if not exists document_memory_cards_owner_idx
  on public.document_memory_cards(owner_id);
create index if not exists document_memory_cards_section_idx
  on public.document_memory_cards(section_id);
