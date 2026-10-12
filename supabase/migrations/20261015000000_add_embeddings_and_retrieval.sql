alter table public.rfps
  add column if not exists "embeddingCount" integer not null default 0,
  add column if not exists "embeddingError" text,
  add column if not exists "embeddedAt" timestamptz;

create index if not exists document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create or replace function public.match_document_chunks(
  query_embedding vector(1024),
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

revoke all on function public.match_document_chunks(vector(1024), uuid, uuid, float, integer) from public, anon, authenticated;
grant execute on function public.match_document_chunks(vector(1024), uuid, uuid, float, integer) to service_role;
