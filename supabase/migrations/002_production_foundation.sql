-- Divya Bajaj production foundation
-- Additive migration. Existing legacy tables remain intact for reconciliation.

alter table public.leads add column if not exists environment text not null default 'test';
alter table public.leads add column if not exists normalized_phone text not null default '';
alter table public.leads add column if not exists normalized_email text not null default '';
alter table public.leads add column if not exists gender text not null default '';
alter table public.leads add column if not exists birth_time_accuracy text not null default '';
alter table public.leads add column if not exists latitude numeric;
alter table public.leads add column if not exists longitude numeric;
alter table public.leads add column if not exists timezone numeric;
alter table public.leads add column if not exists timezone_id text not null default '';
alter table public.leads add column if not exists country_code text not null default '';
alter table public.leads add column if not exists email_consent boolean not null default false;
alter table public.leads add column if not exists whatsapp_consent boolean not null default false;
alter table public.leads add column if not exists consent_recorded_at timestamptz;
alter table public.leads add column if not exists last_activity_at timestamptz;

create index if not exists leads_environment_idx on public.leads(environment);
create index if not exists leads_normalized_phone_idx on public.leads(normalized_phone);
create index if not exists leads_normalized_email_idx on public.leads(normalized_email);

alter table public.reports add column if not exists environment text not null default 'test';
alter table public.reports add column if not exists report_contract_version text not null default 'legacy';
alter table public.reports add column if not exists calculation_contract_version text not null default 'legacy';
alter table public.reports add column if not exists prompt_version text not null default 'legacy';
alter table public.reports add column if not exists knowledge_version text not null default 'legacy';
alter table public.reports add column if not exists pdf_template_version text not null default 'legacy';
alter table public.reports add column if not exists report_json jsonb;
alter table public.reports add column if not exists failure_code text not null default '';
alter table public.reports add column if not exists failure_message text not null default '';
alter table public.reports add column if not exists completed_at timestamptz;

create index if not exists reports_environment_idx on public.reports(environment);
create index if not exists reports_contract_version_idx on public.reports(report_contract_version);

create table if not exists public.visitor_sessions (
  id text primary key,
  anonymous_id text not null,
  environment text not null default 'test',
  lead_id text references public.leads(id) on delete set null,
  landing_path text not null default '',
  referrer text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  utm_term text not null default '',
  device_class text not null default '',
  user_agent text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists visitor_sessions_anonymous_idx on public.visitor_sessions(anonymous_id);
create index if not exists visitor_sessions_lead_idx on public.visitor_sessions(lead_id);

create table if not exists public.attribution_touchpoints (
  id text primary key,
  session_id text references public.visitor_sessions(id) on delete cascade,
  lead_id text references public.leads(id) on delete set null,
  touch_type text not null,
  path text not null default '',
  referrer text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists attribution_session_idx on public.attribution_touchpoints(session_id);
create index if not exists attribution_lead_idx on public.attribution_touchpoints(lead_id);

create table if not exists public.report_versions (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  report_contract_version text not null,
  calculation_contract_version text not null,
  prompt_version text not null,
  knowledge_version text not null,
  model text not null default '',
  provider_versions jsonb not null default '{}'::jsonb,
  input_snapshot jsonb not null default '{}'::jsonb,
  raw_source_snapshot jsonb not null default '{}'::jsonb,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  report_document jsonb not null default '{}'::jsonb,
  report_text text not null default '',
  failure_code text not null default '',
  failure_message text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(report_id, version_number)
);

create index if not exists report_versions_report_idx on public.report_versions(report_id, version_number desc);

create table if not exists public.generated_documents (
  id text primary key,
  report_id text not null references public.reports(id) on delete cascade,
  report_version_id text references public.report_versions(id) on delete set null,
  document_type text not null default 'pdf',
  template_version text not null,
  storage_bucket text not null default '',
  storage_path text not null default '',
  checksum_sha256 text not null default '',
  byte_size bigint not null default 0,
  status text not null default 'created',
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index if not exists generated_documents_report_idx on public.generated_documents(report_id, created_at desc);

create table if not exists public.orders (
  id text primary key,
  environment text not null default 'test',
  lead_id text references public.leads(id) on delete set null,
  product_code text not null,
  amount numeric not null,
  currency text not null default 'INR',
  status text not null default 'draft',
  gateway text not null default '',
  gateway_order_id text not null default '',
  idempotency_key text not null,
  attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(environment, idempotency_key)
);

create index if not exists orders_lead_idx on public.orders(lead_id);
create index if not exists orders_gateway_order_idx on public.orders(gateway_order_id);

create table if not exists public.payment_attempts (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  gateway text not null,
  gateway_payment_id text not null default '',
  status text not null default 'created',
  method text not null default '',
  error_code text not null default '',
  error_message text not null default '',
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_attempts_order_idx on public.payment_attempts(order_id);
create unique index if not exists payment_attempts_gateway_payment_unique on public.payment_attempts(gateway, gateway_payment_id) where gateway_payment_id <> '';

create table if not exists public.payment_webhook_events (
  id text primary key,
  gateway text not null,
  gateway_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  processing_error text not null default '',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(gateway, gateway_event_id)
);

create table if not exists public.availability_rules (
  id text primary key,
  environment text not null default 'test',
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone_id text not null default 'Asia/Kolkata',
  slot_duration_minutes integer not null default 60,
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  max_bookings integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_dates (
  id text primary key,
  environment text not null default 'test',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.slot_holds (
  id text primary key,
  environment text not null default 'test',
  lead_id text references public.leads(id) on delete set null,
  slot_key text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  order_id text references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists active_slot_hold_unique on public.slot_holds(environment, slot_key) where status = 'active';
create index if not exists slot_holds_expiry_idx on public.slot_holds(expires_at);

create table if not exists public.appointments (
  id text primary key,
  environment text not null default 'test',
  lead_id text not null references public.leads(id) on delete restrict,
  order_id text references public.orders(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone_id text not null default 'Asia/Kolkata',
  mode text not null default 'video_call',
  status text not null default 'pending_payment',
  calendar_provider text not null default '',
  calendar_id text not null default '',
  calendar_event_id text not null default '',
  meeting_url text not null default '',
  customer_question text not null default '',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointments_lead_idx on public.appointments(lead_id);
create index if not exists appointments_start_idx on public.appointments(starts_at);
create unique index if not exists active_appointment_slot_unique on public.appointments(environment, starts_at, ends_at) where status in ('pending_payment','confirmed');

create table if not exists public.appointment_status_history (
  id text primary key,
  appointment_id text not null references public.appointments(id) on delete cascade,
  from_status text not null default '',
  to_status text not null,
  reason text not null default '',
  changed_by text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_sync_events (
  id text primary key,
  appointment_id text references public.appointments(id) on delete cascade,
  provider text not null,
  operation text not null,
  status text not null default 'pending',
  provider_event_id text not null default '',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.message_templates (
  id text primary key,
  channel text not null,
  template_key text not null,
  provider_template_id text not null default '',
  language text not null default 'en',
  version integer not null default 1,
  subject text not null default '',
  body_template text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel, template_key, language, version)
);

create table if not exists public.communication_messages (
  id text primary key,
  environment text not null default 'test',
  lead_id text references public.leads(id) on delete set null,
  report_id text references public.reports(id) on delete set null,
  appointment_id text references public.appointments(id) on delete set null,
  channel text not null,
  direction text not null default 'outbound',
  template_key text not null default '',
  provider text not null default '',
  provider_message_id text not null default '',
  recipient text not null,
  status text not null default 'queued',
  subject text not null default '',
  payload jsonb not null default '{}'::jsonb,
  error_code text not null default '',
  error_message text not null default '',
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz
);

create index if not exists communication_lead_idx on public.communication_messages(lead_id, queued_at desc);
create unique index if not exists communication_provider_message_unique on public.communication_messages(provider, provider_message_id) where provider_message_id <> '';

create table if not exists public.background_jobs (
  id text primary key,
  environment text not null default 'test',
  job_type text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  idempotency_key text not null,
  status text not null default 'queued',
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text not null default '',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(environment, idempotency_key)
);

create index if not exists background_jobs_queue_idx on public.background_jobs(status, run_after, priority);

create table if not exists public.webhook_events (
  id text primary key,
  environment text not null default 'test',
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  error_message text not null default '',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(environment, provider, provider_event_id)
);

create table if not exists public.knowledge_documents (
  id text primary key,
  title text not null,
  category text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_versions (
  id text primary key,
  knowledge_document_id text not null references public.knowledge_documents(id) on delete cascade,
  version integer not null,
  content jsonb not null default '{}'::jsonb,
  change_summary text not null default '',
  status text not null default 'draft',
  approved_by text not null default '',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(knowledge_document_id, version)
);

create table if not exists public.prompt_versions (
  id text primary key,
  prompt_key text not null,
  version integer not null,
  template text not null,
  variables jsonb not null default '[]'::jsonb,
  model_settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(prompt_key, version)
);

create table if not exists public.analytics_events (
  id text primary key,
  environment text not null default 'test',
  session_id text references public.visitor_sessions(id) on delete set null,
  lead_id text references public.leads(id) on delete set null,
  event_name text not null,
  route text not null default '',
  cta_id text not null default '',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_time_idx on public.analytics_events(event_name, created_at desc);
create index if not exists analytics_events_lead_idx on public.analytics_events(lead_id);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_secret boolean not null default false,
  updated_by text not null default 'system',
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  actor_type text not null default 'system',
  actor_id text not null default '',
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  before_data jsonb,
  after_data jsonb,
  ip_address text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

alter table public.visitor_sessions enable row level security;
alter table public.attribution_touchpoints enable row level security;
alter table public.report_versions enable row level security;
alter table public.generated_documents enable row level security;
alter table public.orders enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.slot_holds enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.calendar_sync_events enable row level security;
alter table public.message_templates enable row level security;
alter table public.communication_messages enable row level security;
alter table public.background_jobs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_versions enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

-- No public policies are created in this migration.
-- Server-side access must use protected credentials. Admin-facing access will use scoped authenticated policies in a later migration.
