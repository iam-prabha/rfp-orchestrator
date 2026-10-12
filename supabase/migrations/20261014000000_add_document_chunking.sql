create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rfps(id) on delete cascade,
  chunk_id uuid not null unique,
  chunk_text text not null,
  start_offset integer not null,
  end_offset integer not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1024),
  created_at timestamptz not null default timezone('utc', now()),
  constraint document_chunks_offsets check (start_offset >= 0 and end_offset >= start_offset)
);

create index if not exists document_chunks_document_id_idx on public.document_chunks(document_id);
create index if not exists document_chunks_text_search_idx
  on public.document_chunks using gin (to_tsvector('english', chunk_text));

alter table public.document_chunks enable row level security;

-- Chunk writes are performed only by the service-role API after it has verified ownership.
revoke all on public.document_chunks from anon, authenticated;

alter table public.rfps
  add column if not exists "chunkCount" integer not null default 0,
  add column if not exists "chunkingError" text,
  add column if not exists "chunkedAt" timestamptz;

alter table public.rfps drop constraint if exists rfps_status;
alter table public.rfps
  add constraint rfps_status check (status in ('uploaded', 'processing', 'processed', 'ready', 'reviewing', 'completed', 'failed'));
