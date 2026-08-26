import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Link2,
  Plus,
  X,
  CreditCard,
  PiggyBank,
  BarChart3,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  ArrowLeftRight,
  Tag,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import StarField from "@/components/StarField";
import {
  fetchAccounts,
  fetchCategories,
  fetchAllTransactions,
  fetchBudgets,
  computeNetWorth,
  periodStats,
  spendingByDay,
  spendingByCategory,
  budgetProgress,
  fmtMoney,
  isExpense,
  periodBounds,
  plaid,
  plaidSyncedAt,
  seedDemoData,
  hasFinanceData,
  saveBudget,
  updateTransactionCategory,
  topSpendingDays,
  fetchIncomeSources,
  fetchIncomeRules,
  incomeBySource,
  ensureDefaultIncomeSources,
  applyIncomeRules,
  saveIncomeSource,
  saveIncomeRule,
  deleteIncomeRule,
  deleteIncomeSource,
  addTransactionTag,
  removeTransactionTag,
  fetchUserFinanceTagNames,
  updateTransactionTransfer,
  updateTransactionIncomeSource,
  linkTransferPair,
  normalizeFinanceTag,
} from "@/lib/finance";
import { cn, todayStr, fmtLongDate, shiftDay } from "@/lib/utils";
import type { FinanceTransaction, FinanceAccount, FinanceIncomeSource } from "@/types";

declare global {
  interface Window {
    Plaid?: {
      create: (opts: {
        token: string;
        onSuccess: (publicToken: string) => void;
        onExit: (err: unknown) => void;
      }) => { open: () => void };
    };
  }
}

type Tab = "overview" | "transactions" | "budgets" | "accounts" | "income";

function loadPlaidScript(): Promise<void> {
  if (window.Plaid) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Plaid Link"));
    document.head.appendChild(s);
  });
}

function SpendingCalendar({ txns }: { txns: FinanceTransaction[] }) {
  const { weeks, max, total } = useMemo(() => {
    const end = todayStr();
    const start = shiftDay(end, -26 * 7);
    const days = spendingByDay(txns, start, end);
    const byDay = new Map(days.map((d) => [d.date, d.spent]));

    const endD = new Date(`${end}T12:00:00`);
    const startD = new Date(`${start}T12:00:00`);
    startD.setDate(startD.getDate() - startD.getDay());

    const cols: { date: string; spent: number }[][] = [];
    let col: { date: string; spent: number }[] = [];
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      col.push({ date: iso, spent: byDay.get(iso) ?? 0 });
      if (col.length === 7) {
        cols.push(col);
        col = [];
      }
    }
    if (col.length) cols.push(col);

    return {
      weeks: cols,
      max: Math.max(1, ...byDay.values()),
      total: [...byDay.values()].reduce((a, b) => a + b, 0),
    };
  }, [txns]);

  return (
    <div>
      <h2 className="rule-head mb-3">Spending by day</h2>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {w.map((d) => {
              const step = d.spent === 0 ? 0 : Math.ceil((d.spent / max) * 4);
              return (
                <div
                  key={d.date}
                  title={`${fmtLongDate(d.date)}: ${fmtMoney(d.spent)}`}
                  className="h-[9px] w-[9px] rounded-[2px]"
                  style={{
                    background:
                      step === 0
                        ? "rgba(237,239,245,0.06)"
                        : `color-mix(in srgb, var(--color-accent) ${step * 25}%, transparent)`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-chalk-dim mt-2 text-[10.5px] tracking-[0.10em]">
        {fmtMoney(total)} spent in the last 26 weeks
      </p>
    </div>
  );
}

function AccountIcon({ type }: { type: string }) {
  if (type === "credit") return <CreditCard size={16} className="text-accent" />;
  if (type === "depository") return <PiggyBank size={16} className="text-turf" />;
  return <Wallet size={16} className="text-chalk" />;
}

function StatCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="bg-panel border-accent/10 rounded-sm border p-4">
      <p className="label-caps text-chalk-dim mb-1">{label}</p>
      <p className="font-display text-cream text-2xl tracking-wide">{value}</p>
      {sub && (
        <p className={cn("mt-1 flex items-center gap-1 text-[11px]", trend === "down" ? "text-turf" : trend === "up" ? "text-accent" : "text-chalk-dim")}>
          {trend === "down" && <TrendingDown size={12} />}
          {trend === "up" && <TrendingUp size={12} />}
          {sub}
        </p>
      )}
    </div>
  );
}

function BudgetBar({
  name,
  color,
  budget,
  spent,
  pct,
  onEdit,
}: {
  name: string;
  color: string;
  budget: number;
  spent: number;
  pct: number;
  onEdit: () => void;
}) {
  const over = spent > budget;
  return (
    <button
      type="button"
      onClick={onEdit}
      className="bg-panel/60 hover:bg-panel w-full rounded-sm p-3 text-left transition-colors"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px]">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {name}
        </span>
        <span className={cn("text-[12px]", over ? "text-accent" : "text-chalk-dim")}>
          {fmtMoney(spent)} / {fmtMoney(budget)}
        </span>
      </div>
      <div className="bg-ink h-1.5 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: over ? "var(--color-accent)" : color,
          }}
        />
      </div>
      {over && (
        <p className="text-accent mt-1 flex items-center gap-1 text-[10px]">
          <AlertTriangle size={10} />
          {fmtMoney(spent - budget)} over budget
        </p>
      )}
    </button>
  );
}

function CategoryDonut({
  categories,
}: {
  categories: { name: string; color: string; spent: number }[];
}) {
  const total = categories.reduce((s, c) => s + c.spent, 0);
  if (total === 0) return null;

  let offset = 0;
  const segments = categories.slice(0, 8).map((c) => {
    const pct = (c.spent / total) * 100;
    const seg = { ...c, pct, offset };
    offset += pct;
    return seg;
  });

  const gradient = segments
    .map((s) => `${s.color} ${s.offset}% ${s.offset + s.pct}%`)
    .join(", ");

  return (
    <div className="flex items-center gap-6">
      <div
        className="h-28 w-28 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        {segments.map((c) => (
          <div key={c.name} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </span>
            <span className="text-chalk-dim shrink-0">{Math.round(c.pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TxnRow({
  t,
  onClick,
}: {
  t: FinanceTransaction;
  onClick: () => void;
}) {
  const expense = isExpense(t);
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-panel/80 flex w-full items-center gap-3 border-b border-accent/8 px-4 py-3 text-left transition-colors"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `color-mix(in srgb, ${t.finance_categories?.color ?? "#888"} 25%, transparent)`,
        }}
      >
        {t.is_transfer ? (
          <ArrowLeftRight size={14} className="text-chalk-dim" />
        ) : (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: t.finance_categories?.color ?? "#888" }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-cream truncate text-[13.5px]">{t.merchant_name ?? t.name}</p>
        <p className="text-chalk-dim truncate text-[11px]">
          {fmtLongDate(t.transaction_date)}
          {t.finance_accounts?.name ? ` · ${t.finance_accounts.name}` : ""}
          {t.finance_income_sources?.name ? ` · ${t.finance_income_sources.name}` : ""}
          {t.pending ? " · Pending" : ""}
          {t.is_transfer ? " · Transfer" : ""}
        </p>
        {t.tags && t.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {t.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="bg-ink/60 text-chalk-dim rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={cn("shrink-0 text-[14px] font-medium", expense ? "text-cream" : "text-turf")}>
        {expense ? "−" : "+"}
        {fmtMoney(Math.abs(t.amount))}
      </span>
    </button>
  );
}

export default function FinancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedTxn, setSelectedTxn] = useState<FinanceTransaction | null>(null);
  const [budgetEdit, setBudgetEdit] = useState<{ categoryId: string; name: string; amount: number } | null>(null);
  const [txnFilter, setTxnFilter] = useState<{
    categoryId?: string;
    accountId?: string;
    tag?: string;
    hideTransfers?: boolean;
  }>({});
  const [linkTransferMode, setLinkTransferMode] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleSourceId, setNewRuleSourceId] = useState("");
  const [newSourceName, setNewSourceName] = useState("");

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["finance", "accounts"],
    queryFn: fetchAccounts,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["finance", "categories"],
    queryFn: fetchCategories,
  });

  const { data: txns = [], isLoading: loadingTxns } = useQuery({
    queryKey: ["finance", "transactions"],
    queryFn: fetchAllTransactions,
  });

  const { monthKey, monthStart } = periodBounds();

  const { data: budgets = [] } = useQuery({
    queryKey: ["finance", "budgets", monthKey],
    queryFn: () => fetchBudgets(monthKey),
  });

  const { data: plaidStatus } = useQuery({
    queryKey: ["finance", "plaid-status"],
    queryFn: () => plaid.status(),
  });

  const { data: lastSync } = useQuery({
    queryKey: ["finance", "plaid-synced"],
    queryFn: plaidSyncedAt,
  });

  const { data: incomeSources = [] } = useQuery({
    queryKey: ["finance", "income-sources"],
    queryFn: fetchIncomeSources,
  });

  const { data: incomeRules = [] } = useQuery({
    queryKey: ["finance", "income-rules"],
    queryFn: fetchIncomeRules,
  });

  const { data: userTags = [] } = useQuery({
    queryKey: ["finance", "user-tags"],
    queryFn: fetchUserFinanceTagNames,
  });

  useEffect(() => {
    void ensureDefaultIncomeSources().then(() => {
      void qc.invalidateQueries({ queryKey: ["finance", "income-sources"] });
      void qc.invalidateQueries({ queryKey: ["finance", "income-rules"] });
      void applyIncomeRules().then((n) => {
        if (n > 0) void qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      });
    });
  }, [qc]);

  const netWorth = useMemo(() => computeNetWorth(accounts), [accounts]);
  const stats = useMemo(() => periodStats(txns), [txns]);
  const catSpend = useMemo(
    () => spendingByCategory(txns, categories, monthStart, todayStr()),
    [txns, categories, monthStart],
  );
  const budgetsWithProgress = useMemo(
    () => budgetProgress(budgets, catSpend),
    [budgets, catSpend],
  );
  const topDays = useMemo(() => topSpendingDays(txns, 5), [txns]);
  const incomeBreakdown = useMemo(
    () => incomeBySource(txns, incomeSources, monthStart, todayStr()),
    [txns, incomeSources, monthStart],
  );

  const filteredTxns = useMemo(() => {
    let list = txns;
    if (txnFilter.categoryId) list = list.filter((t) => t.category_id === txnFilter.categoryId);
    if (txnFilter.accountId) list = list.filter((t) => t.account_id === txnFilter.accountId);
    if (txnFilter.tag) list = list.filter((t) => t.tags?.includes(txnFilter.tag!));
    if (txnFilter.hideTransfers) list = list.filter((t) => !t.is_transfer);
    return list.slice(0, 200);
  }, [txns, txnFilter]);

  const syncMut = useMutation({
    mutationFn: () => plaid.sync(),
    onSuccess: (r) => {
      toast.success(`Synced: ${r.added} new, ${r.modified} updated`);
      void qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const seedMut = useMutation({
    mutationFn: seedDemoData,
    onSuccess: (r) => {
      toast.success(`Loaded ${r.transactions} transactions across ${r.accounts} accounts`);
      void qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const budgetMut = useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: string; amount: number }) =>
      saveBudget(categoryId, monthKey, amount),
    onSuccess: () => {
      toast.success("Budget saved");
      setBudgetEdit(null);
      void qc.invalidateQueries({ queryKey: ["finance", "budgets"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const categoryMut = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string | null }) =>
      updateTransactionCategory(id, categoryId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      setSelectedTxn(null);
    },
    onError: (e) => toast.error(String(e)),
  });

  const transferMut = useMutation({
    mutationFn: ({ id, isTransfer }: { id: string; isTransfer: boolean }) =>
      updateTransactionTransfer(id, isTransfer),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const linkTransferMut = useMutation({
    mutationFn: ({ a, b }: { a: string; b: string }) => linkTransferPair(a, b),
    onSuccess: () => {
      toast.success("Transfer linked");
      setLinkTransferMode(false);
      setSelectedTxn(null);
      void qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const tagMut = useMutation({
    mutationFn: ({ txnId, tag, action }: { txnId: string; tag: string; action: "add" | "remove" }) =>
      action === "add" ? addTransactionTag(txnId, tag) : removeTransactionTag(txnId, tag),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance"] });
      setNewTagInput("");
    },
    onError: (e) => toast.error(String(e)),
  });

  const incomeSourceMut = useMutation({
    mutationFn: ({ id, sourceId }: { id: string; sourceId: string | null }) =>
      updateTransactionIncomeSource(id, sourceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const saveSourceMut = useMutation({
    mutationFn: (name: string) => saveIncomeSource(name, "#96ceb4"),
    onSuccess: () => {
      toast.success("Income source added");
      setNewSourceName("");
      void qc.invalidateQueries({ queryKey: ["finance", "income-sources"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const saveRuleMut = useMutation({
    mutationFn: ({ sourceId, pattern }: { sourceId: string; pattern: string }) =>
      saveIncomeRule(sourceId, pattern),
    onSuccess: () => {
      toast.success("Rule saved — applying to transactions");
      setNewRulePattern("");
      void qc.invalidateQueries({ queryKey: ["finance", "income-rules"] });
      void applyIncomeRules().then(() => {
        void qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      });
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteRuleMut = useMutation({
    mutationFn: deleteIncomeRule,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance", "income-rules"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const deleteSourceMut = useMutation({
    mutationFn: deleteIncomeSource,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const openPlaidLink = useCallback(async () => {
    try {
      await loadPlaidScript();
      const { link_token } = await plaid.linkToken();
      if (!window.Plaid) throw new Error("Plaid Link not available");

      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (publicToken) => {
          try {
            const r = await plaid.exchange(publicToken);
            toast.success(`Connected ${r.institution_name ?? "bank"} — ${r.added} transactions imported`);
            void qc.invalidateQueries({ queryKey: ["finance"] });
          } catch (e) {
            toast.error(String(e));
          }
        },
        onExit: (err) => {
          if (err) toast.error("Plaid Link closed with an error");
        },
      });
      handler.open();
    } catch (e) {
      toast.error(String(e));
    }
  }, [qc]);

  const { data: hasData } = useQuery({
    queryKey: ["finance", "has-data"],
    queryFn: hasFinanceData,
  });

  const empty = !loadingAccounts && !loadingTxns && !hasData;

  const TABS: { key: Tab; label: string; Icon: typeof Wallet }[] = [
    { key: "overview", label: "Overview", Icon: BarChart3 },
    { key: "transactions", label: "Transactions", Icon: Wallet },
    { key: "budgets", label: "Budgets", Icon: PiggyBank },
    { key: "income", label: "Income", Icon: User },
    { key: "accounts", label: "Accounts", Icon: CreditCard },
  ];

  return (
    <div className="relative min-h-full">
      <StarField count={18} seed={7} />

      <div className="relative mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-caps text-chalk-dim mb-1">Personal Finance</p>
            <h1 className="font-display text-cream text-[28px] tracking-wide md:text-[36px]">
              {fmtMoney(netWorth.net)}
            </h1>
            <p className="text-chalk-dim mt-1 text-[12px]">
              Net worth · {accounts.length} account{accounts.length === 1 ? "" : "s"}
              {lastSync ? ` · Last sync ${new Date(lastSync).toLocaleString()}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {plaidStatus?.configured && (
              <button
                type="button"
                onClick={() => void openPlaidLink()}
                className="bg-accent-deep hover:bg-accent text-cream flex items-center gap-2 rounded-sm px-4 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors"
              >
                <Link2 size={14} />
                Connect bank
              </button>
            )}
            {plaidStatus?.itemCount ? (
              <button
                type="button"
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending}
                className="border-accent/30 text-chalk hover:text-cream flex items-center gap-2 rounded-sm border px-4 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors"
              >
                <RefreshCw size={14} className={syncMut.isPending ? "animate-spin" : ""} />
                Sync
              </button>
            ) : null}
            {empty && (
              <button
                type="button"
                onClick={() => seedMut.mutate()}
                disabled={seedMut.isPending}
                className="border-accent/30 text-chalk hover:text-cream flex items-center gap-2 rounded-sm border px-4 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors"
              >
                <Sparkles size={14} />
                Load demo data
              </button>
            )}
          </div>
        </div>

        {empty && (
          <div className="bg-hero border-accent/15 mb-8 rounded-sm border p-8 text-center">
            <Wallet size={40} className="text-accent mx-auto mb-4 opacity-60" />
            <h2 className="font-display text-cream mb-2 text-xl">Get started</h2>
            <p className="text-chalk-dim mx-auto mb-6 max-w-md text-[14px]">
              Connect your bank with Plaid to import accounts and transactions automatically,
              or load demo data to explore budgeting and spending analytics.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {plaidStatus?.configured ? (
                <button
                  type="button"
                  onClick={() => void openPlaidLink()}
                  className="bg-accent-deep hover:bg-accent text-cream rounded-sm px-6 py-2.5 text-[11px] uppercase tracking-[0.14em]"
                >
                  Connect with Plaid
                </button>
              ) : (
                <p className="text-chalk-dim text-[12px]">
                  Plaid not configured — add PLAID_CLIENT_ID and PLAID_SECRET to Edge Function secrets
                </p>
              )}
              <button
                type="button"
                onClick={() => seedMut.mutate()}
                disabled={seedMut.isPending}
                className="border-accent/30 text-chalk hover:text-cream rounded-sm border px-6 py-2.5 text-[11px] uppercase tracking-[0.14em]"
              >
                Load 6 months of demo data
              </button>
            </div>
          </div>
        )}

        {/* Period stats */}
        {!empty && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Spent this week" value={fmtMoney(stats.spentWeek)} trend="up" />
            <StatCard label="Spent this month" value={fmtMoney(stats.spentMonth)} />
            <StatCard label="Income this month" value={fmtMoney(stats.incomeMonth)} trend="down" sub="deposits" />
            <StatCard
              label="Transactions"
              value={String(stats.txnCountMonth)}
              sub={`${fmtMoney(netWorth.assets)} assets`}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-accent/15 pb-px">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-2 px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors",
                tab === key
                  ? "border-accent text-cream border-b-2"
                  : "text-chalk-dim hover:text-chalk",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && !empty && (
          <div className="space-y-8">
            <SpendingCalendar txns={txns} />

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h2 className="rule-head mb-4">Spending by category</h2>
                <CategoryDonut categories={catSpend} />
              </div>
              <div>
                <h2 className="rule-head mb-4">Top spending days</h2>
                <div className="space-y-2">
                  {topDays.map((d) => (
                    <div
                      key={d.date}
                      className="bg-panel/60 flex items-center justify-between rounded-sm px-4 py-2.5"
                    >
                      <span className="text-[13px]">{fmtLongDate(d.date)}</span>
                      <span className="text-accent text-[14px] font-medium">{fmtMoney(d.spent)}</span>
                    </div>
                  ))}
                  {topDays.length === 0 && (
                    <p className="text-chalk-dim text-[13px]">No spending this month yet.</p>
                  )}
                </div>
              </div>
            </div>

            {budgetsWithProgress.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="rule-head">Budget progress</h2>
                  <button
                    type="button"
                    onClick={() => setTab("budgets")}
                    className="text-accent flex items-center gap-1 text-[11px] uppercase tracking-[0.12em]"
                  >
                    View all <ChevronRight size={12} />
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {budgetsWithProgress.slice(0, 4).map((b) => (
                    <BudgetBar
                      key={b.categoryId}
                      {...b}
                      onEdit={() =>
                        setBudgetEdit({ categoryId: b.categoryId, name: b.name, amount: b.budget })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {incomeBreakdown.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="rule-head">Income by person</h2>
                  <button
                    type="button"
                    onClick={() => setTab("income")}
                    className="text-accent flex items-center gap-1 text-[11px] uppercase tracking-[0.12em]"
                  >
                    Manage <ChevronRight size={12} />
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {incomeBreakdown.map((s) => (
                    <div
                      key={s.sourceId}
                      className="bg-panel/60 flex items-center justify-between rounded-sm px-4 py-3"
                    >
                      <span className="flex items-center gap-2 text-[13px]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                        {s.name}
                        <span className="text-chalk-dim text-[11px]">({s.count})</span>
                      </span>
                      <span className="text-turf text-[14px] font-medium">{fmtMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "transactions" && !empty && (
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                value={txnFilter.categoryId ?? ""}
                onChange={(e) =>
                  setTxnFilter((f) => ({ ...f, categoryId: e.target.value || undefined }))
                }
                className="bg-panel border-accent/20 text-chalk rounded-sm border px-3 py-1.5 text-[12px]"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={txnFilter.accountId ?? ""}
                onChange={(e) =>
                  setTxnFilter((f) => ({ ...f, accountId: e.target.value || undefined }))
                }
                className="bg-panel border-accent/20 text-chalk rounded-sm border px-3 py-1.5 text-[12px]"
              >
                <option value="">All accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={txnFilter.tag ?? ""}
                onChange={(e) =>
                  setTxnFilter((f) => ({ ...f, tag: e.target.value || undefined }))
                }
                className="bg-panel border-accent/20 text-chalk rounded-sm border px-3 py-1.5 text-[12px]"
              >
                <option value="">All tags</option>
                {userTags.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
              <label className="text-chalk-dim flex items-center gap-2 self-center text-[11px]">
                <input
                  type="checkbox"
                  checked={txnFilter.hideTransfers ?? false}
                  onChange={(e) =>
                    setTxnFilter((f) => ({ ...f, hideTransfers: e.target.checked || undefined }))
                  }
                  className="accent-accent"
                />
                Hide transfers
              </label>
              <span className="text-chalk-dim self-center text-[11px]">
                Showing {filteredTxns.length} of {txns.length}
              </span>
            </div>
            <div className="bg-panel border-accent/10 overflow-hidden rounded-sm border">
              {filteredTxns.map((t) => (
                <TxnRow key={t.id} t={t} onClick={() => setSelectedTxn(t)} />
              ))}
            </div>
          </div>
        )}

        {tab === "budgets" && !empty && (
          <div className="space-y-6">
            <p className="text-chalk-dim text-[13px]">
              Monthly budgets for {new Date(`${monthKey}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            {budgetsWithProgress.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {budgetsWithProgress.map((b) => (
                  <BudgetBar
                    key={b.categoryId}
                    {...b}
                    onEdit={() =>
                      setBudgetEdit({ categoryId: b.categoryId, name: b.name, amount: b.budget })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-chalk-dim text-[13px]">
                No budgets set. Load demo data or add budgets from category spending.
              </p>
            )}
            <div>
              <h3 className="label-caps text-chalk-dim mb-3">Add budget</h3>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter((c) => !c.is_income)
                  .filter((c) => !budgets.some((b) => b.category_id === c.id))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setBudgetEdit({ categoryId: c.id, name: c.name, amount: 500 })}
                      className="border-accent/20 text-chalk hover:text-cream flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[12px] transition-colors"
                    >
                      <Plus size={12} />
                      {c.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {tab === "accounts" && !empty && (
          <div className="grid gap-3 md:grid-cols-2">
            {accounts.map((a: FinanceAccount) => (
              <div key={a.id} className="bg-panel border-accent/10 rounded-sm border p-5">
                <div className="mb-3 flex items-center gap-3">
                  <AccountIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-cream truncate text-[15px]">{a.name}</p>
                    <p className="text-chalk-dim text-[11px] capitalize">
                      {a.subtype ?? a.type}
                      {a.mask ? ` ·•••${a.mask}` : ""}
                    </p>
                  </div>
                </div>
                <p className="font-display text-cream text-2xl">
                  {fmtMoney(Number(a.current_balance))}
                </p>
                {a.available_balance != null && a.type === "credit" && (
                  <p className="text-chalk-dim mt-1 text-[11px]">
                    {fmtMoney(Number(a.credit_limit ?? 0) - Number(a.current_balance))} available
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "income" && !empty && (
          <div className="space-y-8">
            <div>
              <h2 className="rule-head mb-4">Income this month</h2>
              {incomeBreakdown.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {incomeBreakdown.map((s) => (
                    <div
                      key={s.sourceId}
                      className="bg-panel border-accent/10 flex items-center justify-between rounded-sm border px-4 py-3"
                    >
                      <span className="flex items-center gap-2 text-[14px]">
                        <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className="text-turf text-lg font-medium">{fmtMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-chalk-dim text-[13px]">
                  No income matched to sources yet. Add rules below to identify payees like Thompson Communications or Happen Bank.
                </p>
              )}
            </div>

            <div>
              <h2 className="rule-head mb-4">Income sources</h2>
              <div className="mb-4 space-y-2">
                {incomeSources.map((s: FinanceIncomeSource) => (
                  <div
                    key={s.id}
                    className="bg-panel/60 flex items-center justify-between rounded-sm px-4 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSourceMut.mutate(s.id)}
                      className="text-chalk-dim hover:text-accent text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New source name (e.g. Josh)"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="bg-panel border-accent/20 text-chalk flex-1 rounded-sm border px-3 py-2 text-[12px]"
                />
                <button
                  type="button"
                  onClick={() => newSourceName.trim() && saveSourceMut.mutate(newSourceName.trim())}
                  disabled={!newSourceName.trim() || saveSourceMut.isPending}
                  className="bg-accent-deep hover:bg-accent text-cream rounded-sm px-4 py-2 text-[11px] uppercase tracking-[0.12em]"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <h2 className="rule-head mb-2">Matching rules</h2>
              <p className="text-chalk-dim mb-4 text-[12px]">
                Match payee names in transactions. Thompson Communications → Josh. Happen Bank / Mercy → Alexandra.
              </p>
              <div className="mb-4 space-y-2">
                {incomeRules.map((r) => (
                  <div
                    key={r.id}
                    className="bg-panel/60 flex items-center justify-between rounded-sm px-4 py-2.5 text-[13px]"
                  >
                    <span>
                      <span className="text-chalk-dim">"{r.pattern}"</span>
                      {" → "}
                      <span style={{ color: r.finance_income_sources?.color }}>
                        {r.finance_income_sources?.name ?? "?"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteRuleMut.mutate(r.id)}
                      className="text-chalk-dim hover:text-accent text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Payee pattern (e.g. Thompson Communications)"
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  className="bg-panel border-accent/20 text-chalk min-w-[200px] flex-1 rounded-sm border px-3 py-2 text-[12px]"
                />
                <select
                  value={newRuleSourceId}
                  onChange={(e) => setNewRuleSourceId(e.target.value)}
                  className="bg-panel border-accent/20 text-chalk rounded-sm border px-3 py-2 text-[12px]"
                >
                  <option value="">Select person</option>
                  {incomeSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (newRulePattern.trim() && newRuleSourceId) {
                      saveRuleMut.mutate({ sourceId: newRuleSourceId, pattern: newRulePattern.trim() });
                    }
                  }}
                  disabled={!newRulePattern.trim() || !newRuleSourceId || saveRuleMut.isPending}
                  className="bg-accent-deep hover:bg-accent text-cream rounded-sm px-4 py-2 text-[11px] uppercase tracking-[0.12em]"
                >
                  Add rule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction drawer */}
      {selectedTxn && (
        <div className="bg-ink/80 fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="flex-1"
            aria-label="Close"
            onClick={() => setSelectedTxn(null)}
          />
          <div className="bg-panel border-accent/15 h-full w-full max-w-md overflow-y-auto border-l p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="label-caps text-chalk-dim mb-1">Transaction</p>
                <h2 className="font-display text-cream text-xl">
                  {selectedTxn.merchant_name ?? selectedTxn.name}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedTxn(null)} className="text-chalk-dim hover:text-cream">
                <X size={20} />
              </button>
            </div>
            <p className={cn("mb-6 text-3xl font-medium", isExpense(selectedTxn) ? "text-cream" : "text-turf")}>
              {isExpense(selectedTxn) ? "−" : "+"}
              {fmtMoney(Math.abs(selectedTxn.amount))}
            </p>
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="label-caps text-chalk-dim">Date</dt>
                <dd>{fmtLongDate(selectedTxn.transaction_date)}</dd>
              </div>
              <div>
                <dt className="label-caps text-chalk-dim">Account</dt>
                <dd>{selectedTxn.finance_accounts?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="label-caps text-chalk-dim mb-1">Category</dt>
                <dd>
                  <select
                    value={selectedTxn.category_id ?? ""}
                    onChange={(e) =>
                      categoryMut.mutate({
                        id: selectedTxn.id,
                        categoryId: e.target.value || null,
                      })
                    }
                    className="bg-ink border-accent/20 text-chalk w-full rounded-sm border px-3 py-2"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              {selectedTxn.payment_channel && (
                <div>
                  <dt className="label-caps text-chalk-dim">Channel</dt>
                  <dd className="capitalize">{selectedTxn.payment_channel}</dd>
                </div>
              )}
              <div>
                <dt className="label-caps text-chalk-dim mb-1">Transfer</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <label className="text-chalk flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={selectedTxn.is_transfer}
                      onChange={(e) =>
                        transferMut.mutate({ id: selectedTxn.id, isTransfer: e.target.checked })
                      }
                      className="accent-accent"
                    />
                    Mark as transfer
                  </label>
                  {!selectedTxn.is_transfer && (
                    <button
                      type="button"
                      onClick={() => setLinkTransferMode(true)}
                      className="text-accent flex items-center gap-1 text-[11px] uppercase tracking-[0.1em]"
                    >
                      <ArrowLeftRight size={12} />
                      Link to another
                    </button>
                  )}
                </dd>
              </div>
              {!isExpense(selectedTxn) && (
                <div>
                  <dt className="label-caps text-chalk-dim mb-1">Income source</dt>
                  <dd>
                    <select
                      value={selectedTxn.income_source_id ?? ""}
                      onChange={(e) =>
                        incomeSourceMut.mutate({
                          id: selectedTxn.id,
                          sourceId: e.target.value || null,
                        })
                      }
                      className="bg-ink border-accent/20 text-chalk w-full rounded-sm border px-3 py-2"
                    >
                      <option value="">Unassigned</option>
                      {incomeSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
              )}
              <div>
                <dt className="label-caps text-chalk-dim mb-1 flex items-center gap-1">
                  <Tag size={11} />
                  Tags
                </dt>
                <dd>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(selectedTxn.tags ?? []).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          tagMut.mutate({ txnId: selectedTxn.id, tag, action: "remove" })
                        }
                        className="bg-ink border-accent/20 text-chalk hover:border-accent flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px]"
                      >
                        #{tag}
                        <X size={10} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add tag"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && normalizeFinanceTag(newTagInput)) {
                          tagMut.mutate({
                            txnId: selectedTxn.id,
                            tag: newTagInput,
                            action: "add",
                          });
                        }
                      }}
                      className="bg-ink border-accent/20 text-chalk flex-1 rounded-sm border px-3 py-2 text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (normalizeFinanceTag(newTagInput)) {
                          tagMut.mutate({
                            txnId: selectedTxn.id,
                            tag: newTagInput,
                            action: "add",
                          });
                        }
                      }}
                      className="bg-accent-deep hover:bg-accent text-cream rounded-sm px-3 py-2 text-[11px]"
                    >
                      Add
                    </button>
                  </div>
                  {userTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {userTags
                        .filter((t) => !(selectedTxn.tags ?? []).includes(t))
                        .slice(0, 8)
                        .map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              tagMut.mutate({ txnId: selectedTxn.id, tag, action: "add" })
                            }
                            className="text-chalk-dim hover:text-chalk text-[10px]"
                          >
                            #{tag}
                          </button>
                        ))}
                    </div>
                  )}
                </dd>
              </div>
            </dl>

            {linkTransferMode && (
              <div className="border-accent/15 mt-6 border-t pt-4">
                <p className="label-caps text-chalk-dim mb-3">Link transfer to</p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {txns
                    .filter((t) => t.id !== selectedTxn.id && !t.transfer_group_id)
                    .slice(0, 30)
                    .map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => linkTransferMut.mutate({ a: selectedTxn.id, b: t.id })}
                        className="hover:bg-ink flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-[12px]"
                      >
                        <span className="truncate">
                          {t.merchant_name ?? t.name}
                          <span className="text-chalk-dim"> · {fmtLongDate(t.transaction_date)}</span>
                        </span>
                        <span className="text-chalk-dim shrink-0">{fmtMoney(Math.abs(t.amount))}</span>
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => setLinkTransferMode(false)}
                  className="text-chalk-dim hover:text-cream mt-2 text-[11px]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget edit modal */}
      {budgetEdit && (
        <div className="bg-ink/80 fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-panel border-accent/15 w-full max-w-sm rounded-sm border p-6">
            <h3 className="font-display text-cream mb-4 text-lg">Budget: {budgetEdit.name}</h3>
            <label className="label-caps text-chalk-dim mb-2 block">Monthly amount</label>
            <input
              type="number"
              min={0}
              step={50}
              defaultValue={budgetEdit.amount}
              id="budget-amount"
              className="bg-ink border-accent/20 text-cream mb-6 w-full rounded-sm border px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBudgetEdit(null)}
                className="text-chalk-dim hover:text-cream flex-1 py-2 text-[11px] uppercase tracking-[0.12em]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("budget-amount") as HTMLInputElement;
                  budgetMut.mutate({
                    categoryId: budgetEdit.categoryId,
                    amount: Number(el.value),
                  });
                }}
                className="bg-accent-deep hover:bg-accent text-cream flex-1 rounded-sm py-2 text-[11px] uppercase tracking-[0.12em]"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
