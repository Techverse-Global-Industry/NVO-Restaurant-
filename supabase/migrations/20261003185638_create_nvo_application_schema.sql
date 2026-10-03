create table public.migrations (version integer primary key, applied_at timestamptz not null default now());
create table public.settings (id smallint primary key check (id = 1), data jsonb not null);
create table public.entries (id text primary key, kind text not null, data jsonb not null);
create index entries_kind on public.entries(kind);
create table public.staff (id text primary key, email text not null unique, password text not null, role text not null);
create table public.sessions (token text primary key, staff_id text not null references public.staff(id) on delete cascade, expires bigint not null);
create index sessions_staff_expires on public.sessions(staff_id, expires);
create table public.orders (id text primary key, customer_id text not null, data jsonb not null, status text not null, created_at timestamptz not null, request_key text not null unique);
create index orders_created_at on public.orders(created_at desc);
create table public.reservations (id text primary key, data jsonb not null, status text not null, created_at timestamptz not null);
create index reservations_created_at on public.reservations(created_at desc);
create table public.analytics (
  id text primary key, visitor text not null, event text not null, page text not null,
  source text not null, created_at timestamptz not null, version integer not null default 1,
  session_id text, item_id text, quantity integer not null default 1
);
create index analytics_date on public.analytics(created_at);
create index analytics_visitor_date on public.analytics(visitor, created_at);
create table public.analytics_excluded_visitors (visitor text primary key, created_at timestamptz not null);
create table public.referrals (id text primary key, customer_id text not null, created_at timestamptz not null);
create table public.referral_visits (
  referral_id text not null references public.referrals(id) on delete cascade,
  customer_id text not null, opened_at timestamptz not null, primary key(referral_id, customer_id)
);
create table public.rewards (
  id text primary key, code text not null unique, customer_id text not null, campaign_id text not null,
  title text not null, status text not null, claimed_at timestamptz not null,
  active_at timestamptz not null, expires_at timestamptz not null, terms jsonb not null,
  order_id text, referral_id text, claimant_name text, network_hash text, saved_at timestamptz
);
create index rewards_customer on public.rewards(customer_id, campaign_id);
create index rewards_network on public.rewards(campaign_id, network_hash);
create table public.audit (
  id text primary key, staff_id text not null references public.staff(id), action text not null,
  entity text not null, created_at timestamptz not null
);
create index audit_created_at on public.audit(created_at desc);
create table public.rate_limits (key text primary key, count integer not null, reset bigint not null);
create table public.media (id text primary key, name text not null, url text not null, created_at timestamptz not null);
create table public.social_accounts (
  id text primary key, platform text not null, remote_id text not null, name text not null,
  token text not null, expires_at bigint, status text not null, auto_publish boolean not null default false,
  created_at timestamptz not null, updated_at timestamptz not null, unique(platform, remote_id)
);
create table public.social_oauth (
  state text primary key, cookie_hash text not null, staff_id text not null references public.staff(id) on delete cascade,
  expires_at bigint not null, consumed boolean not null default false, candidates text
);
create index social_oauth_staff_expiry on public.social_oauth(staff_id, expires_at);
create table public.social_plans (entry_id text primary key references public.entries(id) on delete cascade, data jsonb not null);
create table public.social_jobs (
  id text primary key, entry_id text not null references public.entries(id) on delete cascade,
  account_id text not null references public.social_accounts(id), revision text not null, payload jsonb not null,
  status text not null, attempts integer not null default 0, next_attempt bigint not null, lease_until bigint,
  lease_owner text, container_id text, media_url text, provider_id text, permalink text, last_error text,
  created_at timestamptz not null, updated_at timestamptz not null, unique(entry_id, account_id)
);
create index social_jobs_due on public.social_jobs(status, next_attempt);
create table public.social_attempts (
  id text primary key, job_id text not null references public.social_jobs(id) on delete cascade,
  outcome text not null, message text not null, created_at timestamptz not null
);
create index social_attempts_job_created_at on public.social_attempts(job_id, created_at desc);
create table public.social_caption_cache (id text primary key, data jsonb not null, created_at timestamptz not null);
create table public.social_media (id text primary key, file text not null, expires_at bigint not null);
create table public.social_media_cache (fingerprint text primary key, media_id text not null references public.social_media(id) on delete cascade);
create table public.social_worker (id smallint primary key check (id = 1), heartbeat bigint not null);
create table public.whatsapp_subscribers (
  phone text primary key, name text not null, status text not null, consented_at timestamptz not null,
  changed_at timestamptz not null, source text not null, last_timestamp bigint not null default 0
);
create table public.whatsapp_inbound (id text primary key, created_at timestamptz not null);
create table public.whatsapp_deliveries (
  id text primary key, job_id text not null references public.social_jobs(id) on delete cascade,
  phone text not null, status text not null, provider_id text, attempts integer not null default 0,
  next_attempt bigint not null, last_error text, updated_at timestamptz not null, unique(job_id, phone)
);
create index whatsapp_delivery_provider on public.whatsapp_deliveries(provider_id);
create table public.social_config (key text primary key, data jsonb not null);
create table public.security_config (key text primary key, value text not null);
create table public.translation_cache (id text primary key, text text not null, created_at timestamptz not null);
create table public.counter_sales (
  id text primary key, reward_id text not null unique references public.rewards(id),
  staff_id text not null references public.staff(id), data jsonb not null, created_at timestamptz not null
);

alter table public.migrations enable row level security;
alter table public.settings enable row level security;
alter table public.entries enable row level security;
alter table public.staff enable row level security;
alter table public.sessions enable row level security;
alter table public.orders enable row level security;
alter table public.reservations enable row level security;
alter table public.analytics enable row level security;
alter table public.analytics_excluded_visitors enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_visits enable row level security;
alter table public.rewards enable row level security;
alter table public.audit enable row level security;
alter table public.rate_limits enable row level security;
alter table public.media enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_oauth enable row level security;
alter table public.social_plans enable row level security;
alter table public.social_jobs enable row level security;
alter table public.social_attempts enable row level security;
alter table public.social_caption_cache enable row level security;
alter table public.social_media enable row level security;
alter table public.social_media_cache enable row level security;
alter table public.social_worker enable row level security;
alter table public.whatsapp_subscribers enable row level security;
alter table public.whatsapp_inbound enable row level security;
alter table public.whatsapp_deliveries enable row level security;
alter table public.social_config enable row level security;
alter table public.security_config enable row level security;
alter table public.translation_cache enable row level security;
alter table public.counter_sales enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
