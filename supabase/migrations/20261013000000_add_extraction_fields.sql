alter table public.rfps
  add column if not exists "extractedText" text,
  add column if not exists "extractionMetadata" jsonb not null default '{}'::jsonb,
  add column if not exists "extractionError" text,
  add column if not exists "processedAt" timestamptz;

alter table public.rfps drop constraint if exists rfps_status;

alter table public.rfps
  add constraint rfps_status check (status in ('uploaded', 'processing', 'processed', 'reviewing', 'completed', 'failed'));
