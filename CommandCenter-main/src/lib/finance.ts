import { supabase, requireUserId } from "./supabase";
import { todayStr, shiftDay } from "./utils";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceBudget,
} from "@/types";
import type { Tables } from "@/types/database";

const PAGE = 1000;

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function fetchAccounts(): Promise<FinanceAccount[]> {
  const { data, error } = await supabase
    .from("finance_accounts")
    .select("*")
    .eq("is_hidden", false)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchCategories(): Promise<FinanceCategory[]> {
  const { data, error } = await supabase
    .from("finance_categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchTransactions(opts: {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  limit?: number;
} = {}): Promise<FinanceTransaction[]> {
  const [accounts, categories, raw] = await Promise.all([
    fetchAccounts(),
    fetchCategories(),
    fetchTransactionRows(opts),
  ]);
  return enrichTransactions(raw, accounts, categories);
}

async function fetchTransactionRows(opts: {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  limit?: number;
} = {}) {
  let q = supabase
    .from("finance_transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts.from) q = q.gte("transaction_date", opts.from);
  if (opts.to) q = q.lte("transaction_date", opts.to);
  if (opts.accountId) q = q.eq("account_id", opts.accountId);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

function enrichTransactions(
  rows: Tables<"finance_transactions">[],
  accounts: FinanceAccount[],
  categories: FinanceCategory[],
): FinanceTransaction[] {
  const acctById = new Map(accounts.map((a) => [a.id, a]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  return rows.map((t) => ({
    ...t,
    finance_accounts: acctById.get(t.account_id) ?? null,
    finance_categories: t.category_id ? catById.get(t.category_id) ?? null : null,
  }));
}

export async function fetchAllTransactions(): Promise<FinanceTransaction[]> {
  const [accounts, categories] = await Promise.all([fetchAccounts(), fetchCategories()]);
  const out: Tables<"finance_transactions">[] = [];
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .select("*")
      .order("transaction_date", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return enrichTransactions(out, accounts, categories);
}

export async function fetchBudgets(month: string): Promise<FinanceBudget[]> {
  const [budgetRows, categories] = await Promise.all([
    supabase.from("finance_budgets").select("*").eq("month", month).then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    }),
    fetchCategories(),
  ]);
  const catById = new Map(categories.map((c) => [c.id, c]));
  return budgetRows.map((b) => ({
    ...b,
    finance_categories: catById.get(b.category_id) ?? null,
  }));
}

export async function plaidSyncedAt(): Promise<string | null> {
  const { data } = await supabase
    .from("integration_sync")
    .select("synced_at")
    .eq("service", "plaid")
    .maybeSingle();
  return data?.synced_at ?? null;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function saveBudget(
  categoryId: string,
  month: string,
  amount: number,
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("finance_budgets").upsert(
    { user_id: userId, category_id: categoryId, month, amount },
    { onConflict: "user_id,category_id,month" },
  );
  if (error) throw error;
}

export async function updateTransactionCategory(
  id: string,
  categoryId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("finance_transactions")
    .update({ category_id: categoryId })
    .eq("id", id);
  if (error) throw error;
}

export async function updateTransactionNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("finance_transactions")
    .update({ notes })
    .eq("id", id);
  if (error) throw error;
}

// ─── Plaid edge function client ──────────────────────────────────────────────

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plaid`;

async function plaidCall<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");

  const res = await fetch(`${FN_BASE}/${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const plaid = {
  status: () =>
    plaidCall<{
      configured: boolean;
      itemCount: number;
      items: { institution_name: string | null; last_synced_at: string | null }[];
    }>("status"),
  linkToken: (accessToken?: string) =>
    plaidCall<{ link_token: string }>("link-token", {
      method: "POST",
      body: accessToken ? { access_token: accessToken } : {},
    }),
  exchange: (publicToken: string) =>
    plaidCall<{ added: number; institution_name: string | null }>("exchange", {
      method: "POST",
      body: { public_token: publicToken },
    }),
  sync: () =>
    plaidCall<{ added: number; modified: number; removed: number }>("sync", { method: "POST" }),
};

// ─── Stats helpers ───────────────────────────────────────────────────────────

export function periodBounds(today = todayStr()) {
  const d = new Date(`${today}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  return {
    today,
    weekStart: shiftDay(today, -dow),
    monthStart: `${today.slice(0, 7)}-01`,
    monthKey: today.slice(0, 7),
  };
}

export function fmtMoney(n: number, compact = false): string {
  const abs = Math.abs(n);
  if (compact && abs >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Plaid amounts: positive = money out, negative = money in. */
export function isExpense(t: { amount: number }): boolean {
  return t.amount > 0;
}

export function spendingAmount(t: { amount: number }): number {
  return isExpense(t) ? t.amount : 0;
}

export function incomeAmount(t: { amount: number }): number {
  return !isExpense(t) ? Math.abs(t.amount) : 0;
}

export type NetWorth = {
  assets: number;
  liabilities: number;
  net: number;
};

export function computeNetWorth(accounts: FinanceAccount[]): NetWorth {
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    const bal = Number(a.current_balance);
    if (a.type === "credit" || a.type === "loan") {
      liabilities += Math.abs(bal);
    } else {
      assets += bal;
    }
  }
  return { assets, liabilities, net: assets - liabilities };
}

export type SpendingByDay = { date: string; spent: number; income: number };

export function spendingByDay(
  txns: FinanceTransaction[],
  from: string,
  to: string,
): SpendingByDay[] {
  const byDay = new Map<string, { spent: number; income: number }>();
  for (const t of txns) {
    if (t.transaction_date < from || t.transaction_date > to) continue;
    if (t.pending || t.is_transfer) continue;
    const cur = byDay.get(t.transaction_date) ?? { spent: 0, income: 0 };
    if (isExpense(t)) cur.spent += t.amount;
    else cur.income += Math.abs(t.amount);
    byDay.set(t.transaction_date, cur);
  }
  return [...byDay.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type CategorySpend = {
  categoryId: string | null;
  name: string;
  color: string;
  slug: string;
  spent: number;
  count: number;
};

export function spendingByCategory(
  txns: FinanceTransaction[],
  categories: FinanceCategory[],
  from: string,
  to: string,
): CategorySpend[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const agg = new Map<string, { spent: number; count: number }>();

  for (const t of txns) {
    if (t.transaction_date < from || t.transaction_date > to) continue;
    if (t.pending || t.is_transfer || !isExpense(t)) continue;
    const key = t.category_id ?? "__none__";
    const cur = agg.get(key) ?? { spent: 0, count: 0 };
    cur.spent += t.amount;
    cur.count += 1;
    agg.set(key, cur);
  }

  return [...agg.entries()]
    .map(([key, v]) => {
      const cat = key === "__none__" ? null : byId.get(key);
      return {
        categoryId: cat?.id ?? null,
        name: cat?.name ?? "Uncategorized",
        color: cat?.color ?? "#888",
        slug: cat?.slug ?? "uncategorized",
        spent: v.spent,
        count: v.count,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export type BudgetProgress = {
  categoryId: string;
  name: string;
  color: string;
  budget: number;
  spent: number;
  remaining: number;
  pct: number;
};

export function budgetProgress(
  budgets: FinanceBudget[],
  categorySpend: CategorySpend[],
): BudgetProgress[] {
  const spentByCat = new Map(categorySpend.map((c) => [c.categoryId, c.spent]));
  return budgets
    .map((b) => {
      const cat = b.finance_categories;
      const spent = spentByCat.get(b.category_id) ?? 0;
      const budget = Number(b.amount);
      return {
        categoryId: b.category_id,
        name: cat?.name ?? "Unknown",
        color: cat?.color ?? "#888",
        budget,
        spent,
        remaining: budget - spent,
        pct: budget > 0 ? Math.min(100, (spent / budget) * 100) : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

export type PeriodStats = {
  spentWeek: number;
  spentMonth: number;
  incomeMonth: number;
  txnCountMonth: number;
};

export function periodStats(txns: FinanceTransaction[]): PeriodStats {
  const { weekStart, monthStart } = periodBounds();
  let spentWeek = 0;
  let spentMonth = 0;
  let incomeMonth = 0;
  let txnCountMonth = 0;

  for (const t of txns) {
    if (t.pending || t.is_transfer) continue;
    if (t.transaction_date >= monthStart) {
      txnCountMonth++;
      if (isExpense(t)) spentMonth += t.amount;
      else incomeMonth += Math.abs(t.amount);
    }
    if (t.transaction_date >= weekStart && isExpense(t)) {
      spentWeek += t.amount;
    }
  }

  return { spentWeek, spentMonth, incomeMonth, txnCountMonth };
}

export type TopSpendingDay = { date: string; spent: number; rank: number };

export function topSpendingDays(txns: FinanceTransaction[], limit = 10): TopSpendingDay[] {
  const { monthStart } = periodBounds();
  const byDay = spendingByDay(txns, monthStart, todayStr());
  const sorted = [...byDay].sort((a, b) => b.spent - a.spent);
  const values = sorted.map((d) => d.spent);
  return sorted.slice(0, limit).map((d, i) => ({
    date: d.date,
    spent: d.spent,
    rank: values.filter((v) => v > d.spent).length + 1,
  }));
}

// ─── Demo data seeder ────────────────────────────────────────────────────────

const DEMO_CATEGORIES = [
  { slug: "groceries", name: "Groceries", color: "#3d9b6e" },
  { slug: "dining", name: "Dining", color: "#d9515c" },
  { slug: "transportation", name: "Transportation", color: "#5b8def" },
  { slug: "housing", name: "Housing", color: "#9b6fd4" },
  { slug: "utilities", name: "Utilities", color: "#e8a838" },
  { slug: "entertainment", name: "Entertainment", color: "#4ecdc4" },
  { slug: "shopping", name: "Shopping", color: "#ff6b6b" },
  { slug: "healthcare", name: "Healthcare", color: "#45b7d1" },
  { slug: "income", name: "Income", color: "#96ceb4", is_income: true },
];

const DEMO_MERCHANTS = [
  { name: "Whole Foods Market", cat: "groceries", range: [40, 180] },
  { name: "Trader Joe's", cat: "groceries", range: [25, 95] },
  { name: "Chipotle", cat: "dining", range: [12, 28] },
  { name: "Starbucks", cat: "dining", range: [5, 12] },
  { name: "Shell Gas Station", cat: "transportation", range: [35, 65] },
  { name: "Uber", cat: "transportation", range: [8, 35] },
  { name: "Netflix", cat: "entertainment", range: [15, 23] },
  { name: "Spotify", cat: "entertainment", range: [10, 12] },
  { name: "Amazon", cat: "shopping", range: [15, 250] },
  { name: "Target", cat: "shopping", range: [20, 120] },
  { name: "CVS Pharmacy", cat: "healthcare", range: [8, 45] },
  { name: "Electric Company", cat: "utilities", range: [80, 180] },
  { name: "Internet Provider", cat: "utilities", range: [65, 85] },
];

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function seedDemoData(): Promise<{ accounts: number; transactions: number }> {
  const userId = await requireUserId();
  const today = todayStr();

  const catRows = DEMO_CATEGORIES.map((c, i) => ({
    user_id: userId,
    slug: c.slug,
    name: c.name,
    color: c.color,
    is_income: "is_income" in c ? c.is_income : false,
    sort_order: i,
  }));

  const { data: cats, error: catErr } = await supabase
    .from("finance_categories")
    .upsert(catRows, { onConflict: "user_id,slug" })
    .select("id, slug");
  if (catErr) throw catErr;

  const catBySlug = new Map((cats ?? []).map((c) => [c.slug, c.id]));

  const accounts = [
    { name: "Chase Checking", type: "depository", subtype: "checking", mask: "4521", balance: 8420.55 },
    { name: "Chase Savings", type: "depository", subtype: "savings", mask: "8832", balance: 15200 },
    { name: "Amex Gold", type: "credit", subtype: "credit card", mask: "1004", balance: 2340.18 },
    { name: "Discover", type: "credit", subtype: "credit card", mask: "7721", balance: 890.42 },
  ];

  const acctRows = accounts.map((a) => ({
    user_id: userId,
    name: a.name,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    current_balance: a.balance,
    available_balance: a.type === "credit" ? 10000 - a.balance : a.balance,
    credit_limit: a.type === "credit" ? 10000 : null,
  }));

  const { data: accts, error: acctErr } = await supabase
    .from("finance_accounts")
    .insert(acctRows)
    .select("id, type");
  if (acctErr) throw acctErr;

  const checkingId = accts?.find((_, i) => accounts[i].type === "depository" && accounts[i].subtype === "checking")?.id;
  const creditIds = accts?.filter((_, i) => accounts[i].type === "credit").map((a) => a.id) ?? [];

  const txns: {
    user_id: string;
    account_id: string;
    category_id: string | undefined;
    amount: number;
    name: string;
    merchant_name: string;
    pending: boolean;
    transaction_date: string;
    payment_channel: string;
    is_transfer: boolean;
  }[] = [];

  // 6 months of transactions
  for (let day = -180; day <= 0; day++) {
    const date = shiftDate(today, day);
    const dow = new Date(`${date}T12:00:00`).getDay();

    // Biweekly paycheck
    if (day % 14 === 0 && checkingId) {
      txns.push({
        user_id: userId,
        account_id: checkingId,
        category_id: catBySlug.get("income"),
        amount: -3250,
        name: "Direct Deposit — Employer",
        merchant_name: "Employer Inc",
        pending: false,
        transaction_date: date,
        payment_channel: "other",
        is_transfer: false,
      });
    }

    // Rent on 1st
    if (date.endsWith("-01") && checkingId) {
      txns.push({
        user_id: userId,
        account_id: checkingId,
        category_id: catBySlug.get("housing"),
        amount: 1850,
        name: "Rent Payment",
        merchant_name: "Property Management",
        pending: false,
        transaction_date: date,
        payment_channel: "other",
        is_transfer: false,
      });
    }

    // Weekday spending
    if (dow >= 1 && dow <= 5) {
      const dailyCount = rand(1, 4);
      for (let i = 0; i < dailyCount; i++) {
        const m = DEMO_MERCHANTS[Math.floor(Math.random() * DEMO_MERCHANTS.length)];
        const acctId = Math.random() > 0.4 && creditIds.length
          ? creditIds[Math.floor(Math.random() * creditIds.length)]
          : checkingId;
        if (!acctId) continue;

        txns.push({
          user_id: userId,
          account_id: acctId,
          category_id: catBySlug.get(m.cat),
          amount: rand(m.range[0], m.range[1]),
          name: m.name,
          merchant_name: m.name,
          pending: day === 0 && Math.random() > 0.7,
          transaction_date: date,
          payment_channel: Math.random() > 0.5 ? "in store" : "online",
          is_transfer: false,
        });
      }
    }

    // Weekend entertainment
    if (dow === 0 || dow === 6) {
      const m = DEMO_MERCHANTS[Math.floor(Math.random() * 4) + 6];
      const acctId = creditIds[0] ?? checkingId;
      if (acctId) {
        txns.push({
          user_id: userId,
          account_id: acctId,
          category_id: catBySlug.get(m.cat),
          amount: rand(m.range[0], m.range[1]),
          name: m.name,
          merchant_name: m.name,
          pending: false,
          transaction_date: date,
          payment_channel: "in store",
          is_transfer: false,
        });
      }
    }
  }

  const chunk = 500;
  for (let i = 0; i < txns.length; i += chunk) {
    const { error } = await supabase.from("finance_transactions").insert(txns.slice(i, i + chunk));
    if (error) throw error;
  }

  // Default budgets for current month
  const month = today.slice(0, 7);
  const budgetAmounts: Record<string, number> = {
    groceries: 600,
    dining: 400,
    transportation: 300,
    entertainment: 200,
    shopping: 350,
    utilities: 250,
    healthcare: 150,
  };

  const budgetRows = Object.entries(budgetAmounts)
    .filter(([slug]) => catBySlug.has(slug))
    .map(([slug, amount]) => ({
      user_id: userId,
      category_id: catBySlug.get(slug)!,
      month,
      amount,
    }));

  await supabase.from("finance_budgets").upsert(budgetRows, {
    onConflict: "user_id,category_id,month",
  });

  return { accounts: accts?.length ?? 0, transactions: txns.length };
}

export async function hasFinanceData(): Promise<boolean> {
  const { count } = await supabase
    .from("finance_accounts")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}
