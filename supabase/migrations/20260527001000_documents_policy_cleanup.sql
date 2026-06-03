drop policy if exists "documents owner write" on public.documents;
drop policy if exists "documents owner insert" on public.documents;
drop policy if exists "documents owner update" on public.documents;
drop policy if exists "documents owner delete" on public.documents;

create policy "documents owner insert" on public.documents
  for insert to authenticated with check (owner_id = (select auth.uid()));

create policy "documents owner update" on public.documents
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "documents owner delete" on public.documents
  for delete to authenticated using (owner_id = (select auth.uid()));
