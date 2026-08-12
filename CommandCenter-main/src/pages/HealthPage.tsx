import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  Apple,
  Link2,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
  Unplug,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  completeWithingsOAuth,
  disconnectAppleHealth,
  disconnectWithings,
  healthKeys,
  importAppleHealth,
  parseAppleHealthJson,
  parseAppleHealthXml,
  startWithingsOAuth,
  syncWithings,
  useAddCalorieEntry,
  useAppleHealthStatus,
  useCalorieEntries,
  useDeleteCalorieEntry,
  useHealthMetrics,
  useHealthSettings,
  useUpdateCalorieGoal,
  useWithingsStatus,
} from "@/lib/health";
import { todayStr } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { MealType } from "@/types";

const MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
];

function metricValue(metrics: { metric_type: string; value: number }[] | undefined, type: string) {
  const row = metrics?.find((m) => m.metric_type === type);
  return row?.value;
}

export default function HealthPage() {
  const day = todayStr();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const { data: settings } = useHealthSettings();
  const { data: entries, isLoading: loadingEntries, error: entriesError } = useCalorieEntries(day);
  const { data: metrics } = useHealthMetrics(day);
  const { data: withings, isLoading: loadingWithings } = useWithingsStatus();
  const { data: apple, isLoading: loadingApple } = useAppleHealthStatus();

  const addEntry = useAddCalorieEntry();
  const removeEntry = useDeleteCalorieEntry();
  const updateGoal = useUpdateCalorieGoal();

  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [mealType, setMealType] = useState<MealType>("snack");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [oauthBusy, setOauthBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    if (settings?.daily_calorie_goal) {
      setGoalDraft(String(settings.daily_calorie_goal));
    }
  }, [settings?.daily_calorie_goal]);

  // Withings OAuth redirect lands on /health?code=&state=
  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return;

    let cancelled = false;
    (async () => {
      setOauthBusy(true);
      try {
        await completeWithingsOAuth(code, state);
        if (cancelled) return;
        toast.success("Withings connected");
        await syncWithings().catch(() => null);
        void qc.invalidateQueries({ queryKey: healthKeys.withings });
        void qc.invalidateQueries({ queryKey: healthKeys.metrics(day) });
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Withings connect failed");
        }
      } finally {
        if (!cancelled) {
          setOauthBusy(false);
          const next = new URLSearchParams(params);
          next.delete("code");
          next.delete("state");
          setParams(next, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, setParams, qc, day]);

  const eaten = useMemo(
    () => (entries ?? []).reduce((sum, e) => sum + e.calories, 0),
    [entries],
  );
  const goal = settings?.daily_calorie_goal ?? 2000;
  const remaining = goal - eaten;
  const pct = Math.min(100, Math.round((eaten / Math.max(goal, 1)) * 100));
  const burned = metricValue(metrics, "active_calories");
  const steps = metricValue(metrics, "steps");
  const weight = metricValue(metrics, "weight_kg");

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const cal = Math.round(Number(calories));
    if (!trimmed || !Number.isFinite(cal) || cal < 0) return;
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    try {
      await addEntry.mutateAsync({
        logged_date: day,
        name: trimmed,
        calories: cal,
        meal_type: mealType,
        protein_g: protein ? Number(protein) : null,
        carbs_g: carbs ? Number(carbs) : null,
        fat_g: fat ? Number(fat) : null,
      });
    } catch (err) {
      setName(trimmed);
      setCalories(String(cal));
      toast.error(err instanceof Error ? err.message : "Could not log food");
    }
  }

  async function onSaveGoal(e: FormEvent) {
    e.preventDefault();
    const g = Math.round(Number(goalDraft));
    if (!Number.isFinite(g) || g < 1) {
      toast.error("Enter a calorie goal above 0");
      return;
    }
    try {
      await updateGoal.mutateAsync(g);
      toast.success("Goal updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save goal");
    }
  }

  async function onConnectWithings() {
    setOauthBusy(true);
    try {
      const url = await startWithingsOAuth();
      window.location.assign(url);
    } catch (err) {
      setOauthBusy(false);
      toast.error(err instanceof Error ? err.message : "Could not start Withings OAuth");
    }
  }

  async function onSyncWithings() {
    try {
      const res = await syncWithings();
      toast.success(`Synced ${res.metrics_upserted} Withings metrics`);
      void qc.invalidateQueries({ queryKey: healthKeys.withings });
      void qc.invalidateQueries({ queryKey: healthKeys.metrics(day) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withings sync failed");
    }
  }

  async function onImportFile(file: File) {
    setImportBusy(true);
    try {
      const text = await file.text();
      const payload =
        file.name.toLowerCase().endsWith(".xml") || text.trimStart().startsWith("<")
          ? parseAppleHealthXml(text)
          : parseAppleHealthJson(text);
      const res = await importAppleHealth(payload);
      toast.success(
        `Imported ${res.metrics_upserted} metrics, ${res.calories_upserted} food rows`,
      );
      void qc.invalidateQueries({ queryKey: healthKeys.apple });
      void qc.invalidateQueries({ queryKey: healthKeys.metrics(day) });
      void qc.invalidateQueries({ queryKey: healthKeys.calories(day) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  if (entriesError) {
    return (
      <div className="p-7">
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not load health data:{" "}
          {entriesError instanceof Error ? entriesError.message : String(entriesError)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6 p-6 md:p-7">
      <div>
        <h2 className="rule-head">Health</h2>
        <p className="text-chalk mt-2 text-sm">
          Log food, watch the daily budget, and pull metrics from Withings or an Apple Health
          export.
        </p>
      </div>

      {/* Daily calorie budget */}
      <section className="bg-panel rounded border border-white/[0.07] p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps">Today</p>
            <p className="font-display text-cream mt-1 text-3xl tracking-wide">
              <span className="numeral text-accent">{eaten}</span>
              <span className="text-chalk-dim text-lg"> / {goal} kcal</span>
            </p>
            <p
              className={cn(
                "mt-1 text-[12px] uppercase tracking-[0.14em]",
                remaining >= 0 ? "text-turf" : "text-alert",
              )}
            >
              {remaining >= 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over`}
            </p>
          </div>
          <form onSubmit={onSaveGoal} className="flex items-center gap-2">
            <label className="label-caps" htmlFor="calorie-goal">
              Goal
            </label>
            <input
              id="calorie-goal"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              inputMode="numeric"
              className="bg-field text-cream w-24 rounded-sm border border-white/10 px-3 py-2 text-[13px] outline-none focus:border-accent/50"
            />
            <button
              type="submit"
              disabled={updateGoal.isPending}
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] hover:brightness-110 disabled:opacity-40"
            >
              Save
            </button>
          </form>
        </div>
        <div className="bg-field mt-4 h-2 overflow-hidden rounded-sm">
          <div
            className={cn(
              "h-full transition-[width] duration-500",
              pct >= 100 ? "bg-alert" : "bg-accent",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <MetricChip
            label="Steps"
            value={steps != null ? Math.round(steps).toLocaleString() : "—"}
            Icon={Activity}
          />
          <MetricChip
            label="Burned"
            value={burned != null ? `${Math.round(burned)}` : "—"}
            Icon={RefreshCw}
          />
          <MetricChip
            label="Weight"
            value={weight != null ? `${weight.toFixed(1)} kg` : "—"}
            Icon={Scale}
          />
        </div>
      </section>

      {/* Log food */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-cream text-xl tracking-wide">Calorie log</h3>
        <form onSubmit={onAdd} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="bg-panel flex flex-1 items-center gap-2.5 rounded-sm border border-white/10 px-4 focus-within:border-accent/50">
              <Plus size={15} className="text-chalk-dim shrink-0" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Food or drink"
                className="placeholder:text-chalk-dim flex-1 bg-transparent py-3 text-[13px] outline-none"
              />
            </div>
            <input
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="kcal"
              inputMode="numeric"
              className="bg-panel text-cream w-full rounded-sm border border-white/10 px-3 py-3 text-[13px] outline-none focus:border-accent/50 sm:w-24"
            />
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              className="bg-panel text-cream rounded-sm border border-white/10 px-3 py-3 text-[13px] outline-none focus:border-accent/50"
            >
              {MEALS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addEntry.isPending || !name.trim() || !calories}
              className="from-accent-deep to-accent-dark text-cream rounded-sm bg-gradient-to-b px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.20em] transition hover:brightness-110 disabled:opacity-40"
            >
              Log
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <MacroInput label="P" value={protein} onChange={setProtein} />
            <MacroInput label="C" value={carbs} onChange={setCarbs} />
            <MacroInput label="F" value={fat} onChange={setFat} />
          </div>
        </form>

        <div className="bg-panel rounded border border-white/[0.07]">
          {loadingEntries ? (
            <p className="label-caps animate-pulse py-10 text-center">Loading</p>
          ) : (entries ?? []).length === 0 ? (
            <p className="text-chalk py-10 text-center text-sm">
              Nothing logged today. Add a meal above.
            </p>
          ) : (
            <ul>
              {(entries ?? []).map((entry) => (
                <li
                  key={entry.id}
                  className="group flex items-center gap-4 border-b border-white/[0.055] px-5 py-3.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px]">{entry.name}</p>
                    <p className="text-chalk-dim text-[10.5px] uppercase tracking-[0.10em]">
                      {MEALS.find((m) => m.value === entry.meal_type)?.label ?? entry.meal_type}
                      {entry.source !== "manual" && ` · ${entry.source.replace("_", " ")}`}
                      {(entry.protein_g || entry.carbs_g || entry.fat_g) &&
                        ` · P${entry.protein_g ?? "—"} C${entry.carbs_g ?? "—"} F${entry.fat_g ?? "—"}`}
                    </p>
                  </div>
                  <p className="numeral text-accent shrink-0 text-[18px] leading-none">
                    {entry.calories}
                  </p>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${entry.name}"?`)) {
                        removeEntry.mutate({ id: entry.id, day });
                      }
                    }}
                    aria-label={`Delete ${entry.name}`}
                    className="text-chalk-dim hover:text-alert shrink-0 opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Connections */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-cream text-xl tracking-wide">Connections</h3>

        <div className="bg-panel rounded border border-white/[0.07] p-5">
          <div className="flex items-start gap-3">
            <Scale size={18} className="text-accent mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px]">Withings</p>
              <p className="text-chalk mt-1 text-[12.5px] leading-relaxed">
                OAuth against the Withings Partner API for weight, steps, and activity calories.
                {loadingWithings
                  ? " Checking…"
                  : withings?.configured === false
                    ? " Server secrets are not set yet."
                    : withings?.connected
                      ? ` Connected${withings.synced_at ? ` · last sync ${new Date(withings.synced_at).toLocaleString()}` : ""}.`
                      : " Not connected."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {withings?.connected ? (
                  <>
                    <ActionButton onClick={() => void onSyncWithings()} Icon={RefreshCw}>
                      Sync
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        void disconnectWithings()
                          .then(() => {
                            toast.success("Withings disconnected");
                            void qc.invalidateQueries({ queryKey: healthKeys.withings });
                          })
                          .catch((err) =>
                            toast.error(err instanceof Error ? err.message : "Disconnect failed"),
                          )
                      }
                      Icon={Unplug}
                      muted
                    >
                      Disconnect
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton
                    onClick={() => void onConnectWithings()}
                    Icon={Link2}
                    disabled={oauthBusy || withings?.configured === false}
                  >
                    {oauthBusy ? "Connecting…" : "Connect"}
                  </ActionButton>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-panel rounded border border-white/[0.07] p-5">
          <div className="flex items-start gap-3">
            <Apple size={18} className="text-accent mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px]">Apple Health</p>
              <p className="text-chalk mt-1 text-[12.5px] leading-relaxed">
                Apple does not expose a public HealthKit web API. Import a Health Auto Export JSON
                file, or a modest <code className="text-cream">export.xml</code> from the Health
                app (Profile → Export All Health Data → unzip). Large multi-GB exports should use
                JSON.
                {loadingApple
                  ? ""
                  : apple?.connected
                    ? ` Last import ${apple.synced_at ? new Date(apple.synced_at).toLocaleString() : "recorded"}.`
                    : ""}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label
                  className={cn(
                    "from-accent-deep to-accent-dark text-cream inline-flex cursor-pointer items-center gap-2 rounded-sm bg-gradient-to-b px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] hover:brightness-110",
                    importBusy && "opacity-40 pointer-events-none",
                  )}
                >
                  <Upload size={13} />
                  {importBusy ? "Importing…" : "Import file"}
                  <input
                    type="file"
                    accept=".json,.xml,application/json,text/xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void onImportFile(file);
                    }}
                  />
                </label>
                {apple?.connected && (
                  <ActionButton
                    onClick={() =>
                      void disconnectAppleHealth()
                        .then(() => {
                          toast.success("Apple Health import cleared");
                          void qc.invalidateQueries({ queryKey: healthKeys.apple });
                        })
                        .catch((err) =>
                          toast.error(err instanceof Error ? err.message : "Disconnect failed"),
                        )
                    }
                    Icon={Unplug}
                    muted
                  >
                    Clear
                  </ActionButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricChip({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: typeof Activity;
}) {
  return (
    <div className="bg-field rounded-sm border border-white/[0.06] px-3 py-3">
      <div className="text-chalk-dim flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
        <Icon size={11} />
        {label}
      </div>
      <p className="numeral text-cream mt-1 text-[17px] leading-none">{value}</p>
    </div>
  );
}

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-panel flex items-center gap-2 rounded-sm border border-white/10 px-3 py-2">
      <span className="label-caps text-[9px]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="g"
        inputMode="decimal"
        className="placeholder:text-chalk-dim w-14 bg-transparent text-[12px] outline-none"
      />
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  Icon,
  muted,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  Icon: typeof Link2;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] transition disabled:opacity-40",
        muted
          ? "border border-white/15 text-chalk hover:text-cream"
          : "from-accent-deep to-accent-dark text-cream bg-gradient-to-b hover:brightness-110",
      )}
    >
      <Icon size={13} />
      {children}
    </button>
  );
}
