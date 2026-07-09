create table if not exists public.leads (
  id text primary key,
  name text not null,
  phone text not null,
  email text not null default '',
  dob text not null,
  tob text not null default '',
  pob text not null default '',
  question text not null default '',
  source text not null default 'website',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  status text not null default 'new',
  tier text not null default 'free_awareness',
  total_spent numeric not null default 0,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_phone_idx on public.leads(phone);
create index if not exists leads_email_idx on public.leads(email);
create index if not exists leads_created_at_idx on public.leads(created_at desc);

create table if not exists public.reports (
  id text primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  type text not null default 'free_awareness',
  status text not null default 'created',
  input_data jsonb not null default '{}'::jsonb,
  horosoft_data jsonb,
  astrology_data jsonb,
  ai_report text not null default '',
  ai_insights jsonb,
  generated_by text not null default '',
  pdf_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_lead_id_idx on public.reports(lead_id);
create index if not exists reports_created_at_idx on public.reports(created_at desc);

create table if not exists public.payments (
  id text primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  report_id text not null default '',
  amount numeric not null default 0,
  currency text not null default 'INR',
  tier text not null default '',
  status text not null default 'created',
  razorpay_order_id text not null default '',
  razorpay_payment_id text not null default '',
  razorpay_signature text not null default '',
  method text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_lead_id_idx on public.payments(lead_id);
create index if not exists payments_created_at_idx on public.payments(created_at desc);

create table if not exists public.bookings (
  id text primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  date text not null,
  time_slot text not null,
  mode text not null default 'online',
  payment_id text not null default '',
  notes text not null default '',
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_lead_id_idx on public.bookings(lead_id);
create index if not exists bookings_created_at_idx on public.bookings(created_at desc);

create table if not exists public.events (
  id text primary key,
  type text not null,
  entity text not null,
  entity_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_created_at_idx on public.events(created_at desc);

alter table public.leads enable row level security;
alter table public.reports enable row level security;
alter table public.payments enable row level security;
alter table public.bookings enable row level security;
alter table public.events enable row level security;

-- No public policies are created.
-- The Vercel backend uses the Supabase service-role or server secret key.
