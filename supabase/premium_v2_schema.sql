create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  lead_id text,
  report_id text,
  status text not null default 'queued',
  stage text not null default 'facts',
  current_page integer not null default 0,
  retry_count integer not null default 0,
  input_json jsonb not null default '{}'::jsonb,
  fact_ledger jsonb,
  master_interpretation jsonb,
  page_content jsonb,
  layout_plan jsonb,
  content_qa jsonb,
  geometry_qa jsonb,
  visual_qa_summary jsonb,
  final_pdf_path text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_runs_status_idx on public.report_runs(status);
create index if not exists report_runs_stage_idx on public.report_runs(stage);
create index if not exists report_runs_created_at_idx on public.report_runs(created_at desc);

create table if not exists public.report_pages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.report_runs(id) on delete cascade,
  page_number integer not null check (page_number between 1 and 14),
  status text not null default 'pending',
  retry_count integer not null default 0,
  content_json jsonb not null default '{}'::jsonb,
  layout_json jsonb not null default '{}'::jsonb,
  svg_text text,
  geometry_qa jsonb,
  visual_qa jsonb,
  preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, page_number)
);

create index if not exists report_pages_run_idx on public.report_pages(run_id, page_number);
create index if not exists report_pages_status_idx on public.report_pages(status);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.report_runs(id) on delete cascade,
  channel text not null,
  recipient text not null,
  status text not null default 'scheduled',
  scheduled_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  provider_response jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliveries_run_idx on public.deliveries(run_id);
create index if not exists deliveries_status_idx on public.deliveries(status, scheduled_at);

alter table public.report_runs enable row level security;
alter table public.report_pages enable row level security;
alter table public.deliveries enable row level security;

insert into storage.buckets (id, name, public)
values ('premium-reports', 'premium-reports', false)
on conflict (id) do nothing;
