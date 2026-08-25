-- Personal finance: accounts, transactions, categories, budgets, Plaid items.

-- ─── Categories ───────────────────────────────────────────────────────────
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null,
  color text not null default '#d9515c',
  icon text,
  is_income boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists finance_categories_user_idx on public.finance_categories (user_id);

-- ─── Accounts ───────────────────────────────────────────────────────────────
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id uuid,
  plaid_account_id text,
  name text not null,
  official_name text,
  type text not null default 'depository',
  subtype text,
  mask text,
  current_balance numeric(14, 2) not null default 0,
  available_balance numeric(14, 2),
  credit_limit numeric(14, 2),
  currency text not null default 'USD',
  is_hidden boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_account_id)
);

create index if not exists finance_accounts_user_idx on public.finance_accounts (user_id);

-- ─── Plaid items (server-managed tokens) ────────────────────────────────────
create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  access_token text not null,
  institution_id text,
  institution_name text,
  cursor text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists plaid_items_user_idx on public.plaid_items (user_id);

alter table public.finance_accounts
  add constraint finance_accounts_plaid_item_fkey
  foreign key (plaid_item_id) references public.plaid_items (id) on delete set null;

-- ─── Transactions ───────────────────────────────────────────────────────────
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.finance_accounts (id) on delete cascade,
  category_id uuid references public.finance_categories (id) on delete set null,
  plaid_transaction_id text,
  amount numeric(14, 2) not null,
  name text not null,
  merchant_name text,
  pending boolean not null default false,
  transaction_date date not null,
  authorized_date date,
  payment_channel text,
  plaid_category text[],
  notes text,
  is_transfer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plaid_transaction_id)
);

create index if not exists finance_transactions_user_date_idx
  on public.finance_transactions (user_id, transaction_date desc);
create index if not exists finance_transactions_account_idx
  on public.finance_transactions (account_id);
create index if not exists finance_transactions_category_idx
  on public.finance_transactions (category_id);

-- ─── Monthly budgets per category ─────────────────────────────────────────────
create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.finance_categories (id) on delete cascade,
  month text not null,
  amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create index if not exists finance_budgets_user_month_idx
  on public.finance_budgets (user_id, month);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.plaid_items enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_budgets enable row level security;

create policy finance_categories_owner on public.finance_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy finance_accounts_owner on public.finance_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Plaid tokens: no client access — edge functions use service role.
create policy plaid_items_deny on public.plaid_items
  for all using (false);

create policy finance_transactions_owner on public.finance_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy finance_budgets_owner on public.finance_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── updated_at triggers ────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_categories_touch on public.finance_categories;
create trigger finance_categories_touch
  before update on public.finance_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists finance_accounts_touch on public.finance_accounts;
create trigger finance_accounts_touch
  before update on public.finance_accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists plaid_items_touch on public.plaid_items;
create trigger plaid_items_touch
  before update on public.plaid_items
  for each row execute function public.touch_updated_at();

drop trigger if exists finance_transactions_touch on public.finance_transactions;
create trigger finance_transactions_touch
  before update on public.finance_transactions
  for each row execute function public.touch_updated_at();

drop trigger if exists finance_budgets_touch on public.finance_budgets;
create trigger finance_budgets_touch
  before update on public.finance_budgets
  for each row execute function public.touch_updated_at();
