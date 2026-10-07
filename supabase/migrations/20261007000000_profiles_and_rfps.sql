create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(trim(new.raw_user_meta_data ->> 'username')),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.rfps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  "clientName" text not null default 'Unknown Client',
  "clientIndustry" text,
  status text not null default 'uploaded',
  "fileName" text not null,
  "fileSize" bigint not null,
  "fileType" text not null,
  "storagePath" text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz not null default timezone('utc', now()),
  "completedAt" timestamptz,
  constraint rfps_status check (status in ('uploaded', 'processing', 'reviewing', 'completed', 'failed')),
  constraint rfps_file_type check ("fileType" in ('pdf', 'xlsx', 'docx', 'txt', 'md')),
  constraint rfps_file_size check ("fileSize" > 0 and "fileSize" <= 10485760)
);

alter table public.rfps enable row level security;

create policy "Users can read their own RFPs"
  on public.rfps for select
  using (auth.uid() = "userId");

create policy "Users can create their own RFPs"
  on public.rfps for insert
  with check (auth.uid() = "userId");

create policy "Users can update their own RFPs"
  on public.rfps for update
  using (auth.uid() = "userId")
  with check (auth.uid() = "userId");

create policy "Users can delete their own RFPs"
  on public.rfps for delete
  using (auth.uid() = "userId");

insert into storage.buckets (id, name, public)
values ('rfp-files', 'rfp-files', false)
on conflict (id) do update set public = false;

create policy "Users can read their own RFP files"
  on storage.objects for select
  using (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own RFP files"
  on storage.objects for insert
  with check (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own RFP files"
  on storage.objects for update
  using (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own RFP files"
  on storage.objects for delete
  using (
    bucket_id = 'rfp-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
