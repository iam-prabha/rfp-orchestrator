alter table public.document_chunks enable row level security;

drop policy if exists "Deny direct chunk access to clients" on public.document_chunks;

create policy "Deny direct chunk access to clients"
  on public.document_chunks
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
