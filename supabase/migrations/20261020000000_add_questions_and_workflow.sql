-- Add questions, answers, and agent_events tables

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  rfp_id uuid not null references public.rfps(id) on delete cascade,
  question_text text not null,
  section text not null default 'General',
  question_order integer not null default 0,
  question_type text not null default 'general',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint questions_type_check check (question_type in ('technical', 'commercial', 'security', 'legal', 'general'))
);

create index if not exists questions_rfp_id_idx on public.questions(rfp_id);
create index if not exists questions_order_idx on public.questions(rfp_id, question_order);

alter table public.questions enable row level security;

create policy "Users can read questions of their RFPs"
  on public.questions for select
  using (
    exists (
      select 1 from public.rfps r
      where r.id = questions.rfp_id
        and r."userId" = auth.uid()
    )
  );

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  "rfpId" uuid references public.rfps(id) on delete cascade,
  "questionId" text not null,
  "questionText" text not null,
  "generatedAnswer" text not null,
  "finalAnswer" text,
  "confidenceScore" integer not null default 0,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'generated',
  "reviewedBy" uuid references auth.users(id) on delete set null,
  "reviewedAt" timestamptz,
  "reviewNotes" text,
  "createdAt" timestamptz not null default timezone('utc', now()),
  "updatedAt" timestamptz not null default timezone('utc', now()),
  constraint answers_status check (status in ('generated', 'reviewing', 'approved', 'rejected'))
);

create index if not exists answers_rfp_id_idx on public.answers("rfpId");
create index if not exists answers_question_id_idx on public.answers("questionId");

alter table public.answers enable row level security;

create policy "Users can read answers of their RFPs"
  on public.answers for select
  using (
    exists (
      select 1 from public.rfps r
      where r.id = answers."rfpId"
        and r."userId" = auth.uid()
    )
  );

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  "agentId" text not null,
  "rfpId" text not null,
  payload jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default timezone('utc', now())
);

create index if not exists agent_events_rfp_id_idx on public.agent_events("rfpId");

alter table public.agent_events enable row level security;

-- Grant service role full access for internal pipeline
grant all on public.rfps to service_role;
grant all on public.profiles to service_role;
grant all on public.questions to service_role;
grant all on public.answers to service_role;
grant all on public.agent_events to service_role;

