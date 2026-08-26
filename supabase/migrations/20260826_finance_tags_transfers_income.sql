-- Finance: transaction tags, transfer grouping, income source tracking.

-- ─── Transfer grouping ───────────────────────────────────────────────────────
-- Pairs legs of a transfer (e.g. checking payment + credit card payment received).
alter table public.finance_transactions
  add column if not exists transfer_group_id uuid;

create index if not exists finance_transactions_transfer_group_idx
  on public.finance_transactions (user_id, transfer_group_id)
  where transfer_group_id is not null;

-- ─── Income sources ──────────────────────────────────────────────────────────
create table if not exists public.finance_income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#96ceb4',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  constraint finance_income_sources_name_len check (char_length(name) between 1 and 40)
);

create index if not exists finance_income_sources_user_idx
  on public.finance_income_sources (user_id);

-- Pattern rules: match merchant_name or transaction name (case-insensitive contains).
create table if not exists public.finance_income_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  income_source_id uuid not null references public.finance_income_sources (id) on delete cascade,
  pattern text not null,
  created_at timestamptz not null default now(),
  unique (user_id, pattern),
  constraint finance_income_rules_pattern_len check (char_length(pattern) between 1 and 80)
);

create index if not exists finance_income_rules_user_idx
  on public.finance_income_rules (user_id);
create index if not exists finance_income_rules_source_idx
  on public.finance_income_rules (income_source_id);

alter table public.finance_transactions
  add column if not exists income_source_id uuid references public.finance_income_sources (id) on delete set null;

create index if not exists finance_transactions_income_source_idx
  on public.finance_transactions (income_source_id)
  where income_source_id is not null;

-- ─── Transaction tags ────────────────────────────────────────────────────────
create table if not exists public.finance_transaction_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.finance_transactions (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (user_id, transaction_id, tag),
  constraint finance_transaction_tags_tag_len check (char_length(tag) between 1 and 40)
);

create index if not exists finance_transaction_tags_user_txn_idx
  on public.finance_transaction_tags (user_id, transaction_id);
create index if not exists finance_transaction_tags_user_tag_idx
  on public.finance_transaction_tags (user_id, tag);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.finance_income_sources enable row level security;
alter table public.finance_income_rules enable row level security;
alter table public.finance_transaction_tags enable row level security;

create policy finance_income_sources_owner on public.finance_income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy finance_income_rules_owner on public.finance_income_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy finance_transaction_tags_owner on public.finance_transaction_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
drop trigger if exists finance_income_sources_touch on public.finance_income_sources;
create trigger finance_income_sources_touch
  before update on public.finance_income_sources
  for each row execute function public.touch_updated_at();
