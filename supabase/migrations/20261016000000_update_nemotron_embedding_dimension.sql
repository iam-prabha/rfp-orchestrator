-- Nemotron-3-Embed-1B returns 2048-dimensional vectors. Existing embeddings
-- are cleared because they were created for the previous 1024-dimension schema
-- and must be regenerated with matching passage/query modes.
drop index if exists public.document_chunks_embedding_idx;

alter table public.document_chunks
  alter column embedding type vector(2048)
  using null;

drop function if exists public.match_document_chunks(vector(1024), uuid, uuid, double precision, integer);
drop function if exists public.match_document_chunks(vector(2048), uuid, uuid, double precision, integer);

-- pgvector HNSW indexes support at most 2000 dimensions, while
-- nemotron-3-embed-1b returns 2048 dimensions. Keep the exact vector
-- search for now; an expression index using halfvec can be introduced
-- separately once retrieval volume requires ANN optimization.

create policy "Deny direct chunk access to clients"
  on public.document_chunks
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.match_document_chunks(
  query_embedding vector(2048),
  requesting_user_id uuid,
  requested_rfp_id uuid default null,
  match_threshold float default 0.7,
  match_count integer default 10
)
returns table (
  id uuid,
  document_id uuid,
  chunk_id uuid,
  chunk_text text,
  start_offset integer,
  end_offset integer,
  metadata jsonb,
  similarity_score float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_id,
    dc.chunk_text,
    dc.start_offset,
    dc.end_offset,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity_score
  from public.document_chunks dc
  join public.rfps r on r.id = dc.document_id
  where r."userId" = requesting_user_id
    and (requested_rfp_id is null or dc.document_id = requested_rfp_id)
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding
  limit least(match_count, 100);
$$;

revoke all on function public.match_document_chunks(vector(2048), uuid, uuid, double precision, integer) from public, anon, authenticated;
grant execute on function public.match_document_chunks(vector(2048), uuid, uuid, double precision, integer) to service_role;
