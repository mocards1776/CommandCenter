import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import WeightChart from "@/components/health/WeightChart";
import {
  addFoodLog,
  addSavedFood,
  addWeight,
  deleteFoodLog,
  deleteSavedFood,
  fetchExerciseLog,
  fetchFoodLog,
  fetchSavedFoods,
  fetchWeights,
  type HealthSavedFood,
} from "@/lib/health";
import {
  KCAL_TARGET_HIGH,
  KCAL_TARGET_LOW,
  PROTEIN_TARGET_G,
  calorieBudget,
  clockLabel,
  exerciseKcal,
  foodTotals,
  goalWeightLb,
  netCalories,
  proteinLeft,
  round1,
  workoutGroups,
} from "@/lib/health-math";
import { fmtTime, shiftDay, todayStr } from "@/lib/utils";

const keys = {
  food: (day: string) => ["health", "food", day] as const,
  exercise: (day: string) => ["health", "exercise", day] as const,
  saved: ["health", "saved"] as const,
  weights: ["health", "weights"] as const,
};

function nowChicagoTime(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((p) => p.type === "hour")?.value ?? "12";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function parseAmount(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export default function HealthPage() {
  const today = todayStr();
  const [day, setDay] = useState(today);
  const qc = useQueryClient();

  const food = useQuery({ queryKey: keys.food(day), queryFn: () => fetchFoodLog(day) });
  const exercise = useQuery({ queryKey: keys.exercise(day), queryFn: () => fetchExerciseLog(day) });
  const saved = useQuery({ queryKey: keys.saved, queryFn: fetchSavedFoods });
  const weights = useQuery({ queryKey: keys.weights, queryFn: fetchWeights });

  const [time, setTime] = useState(nowChicagoTime);
  const [item, setItem] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [keepFood, setKeepFood] = useState(false);

  const [weighDay, setWeighDay] = useState(today);
  const [pounds, setPounds] = useState("");

  const totals = useMemo(() => foodTotals(food.data ?? []), [food.data]);
  const budget = calorieBudget(totals.kcal);
  const workouts = useMemo(() => workoutGroups(exercise.data ?? []), [exercise.data]);
  const burned = useMemo(() => exerciseKcal(exercise.data ?? []), [exercise.data]);
  const setCount = workouts.reduce((sum, group) => sum + group.sets, 0);
  const net = netCalories(totals.kcal, burned);
  const firstSet = exercise.data?.at(0);
  const lastSet = exercise.data?.at(-1);
  const proteinRemaining = proteinLeft(totals.protein);
  const samples = useMemo(
    () => (weights.data ?? []).map((row) => ({ day: row.weighed_on, lb: row.weight_lb })),
    [weights.data],
  );
  const latest = weights.data?.at(-1) ?? null;
  const goalToday = goalWeightLb(today);

  const invalidateFood = async () => {
    await qc.invalidateQueries({ queryKey: keys.food(day) });
  };

  const logFood = useMutation({
    mutationFn: addFoodLog,
    onSuccess: invalidateFood,
  });
  const removeFood = useMutation({
    mutationFn: deleteFoodLog,
    onSuccess: invalidateFood,
  });
  const saveFood = useMutation({
    mutationFn: addSavedFood,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.saved });
    },
  });
  const removeSaved = useMutation({
    mutationFn: deleteSavedFood,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.saved });
    },
  });
  const saveWeight = useMutation({
    mutationFn: addWeight,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.weights });
    },
  });

  async function onLog(e: FormEvent) {
    e.preventDefault();
    const name = item.trim();
    const kcalN = parseAmount(kcal);
    const proteinN = parseAmount(protein);
    if (!name || kcalN == null || proteinN == null) {
      toast.error("Need an item, calories, and protein");
      return;
    }
    try {
      await logFood.mutateAsync({ day, time, item: name, kcal: kcalN, protein_g: proteinN });
      if (keepFood) {
        await saveFood.mutateAsync({ name, kcal: kcalN, protein_g: proteinN });
      }
      setItem("");
      setKcal("");
      setProtein("");
      setKeepFood(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log food");
    }
  }

  async function logSaved(foodRow: HealthSavedFood) {
    try {
      await logFood.mutateAsync({
        day,
        time: day === today ? nowChicagoTime() : time,
        item: foodRow.name,
        kcal: foodRow.kcal,
        protein_g: foodRow.protein_g,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log food");
    }
  }

  async function onWeigh(e: FormEvent) {
    e.preventDefault();
    const lb = parseAmount(pounds);
    if (lb == null || lb <= 0) {
      toast.error("Enter a weight in pounds");
      return;
    }
    try {
      await saveWeight.mutateAsync({ weighed_on: weighDay, weight_lb: lb });
      setPounds("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save weigh-in");
    }
  }

  const loadError = food.error ?? exercise.error ?? saved.error ?? weights.error;

  return (
    <div className="health-app min-h-full bg-[#10182a] text-[#eef2f7]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-8 md:py-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8b97ad]">
              Daily log
            </p>
            <h2
              className="mt-1 text-[34px] leading-none font-bold tracking-tight text-white md:text-[42px]"
              style={{ fontFamily: '"Barlow Condensed", Oswald, sans-serif' }}
            >
              HEALTH
            </h2>
          </div>
          <a
            href="/health.html"
            className="shrink-0 border border-white/15 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-[#c5cedd]"
          >
            Home Screen
          </a>
        </header>

        <div className="flex items-center justify-between gap-2 border border-white/10 bg-[#161f33] px-2 py-2">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setDay((d) => shiftDay(d, -1))}
            className="grid h-11 w-11 place-items-center text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p
              className="text-[26px] leading-none font-bold tracking-tight"
              style={{ fontFamily: '"Barlow Condensed", Oswald, sans-serif' }}
            >
              {dayLabel(day)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8b97ad]">
              America/Chicago
              {day === today ? " · Today" : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Next day"
            disabled={day >= today}
            onClick={() => setDay((d) => (d >= today ? d : shiftDay(d, 1)))}
            className="grid h-11 w-11 place-items-center text-white disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {loadError ? (
          <p className="border border-[#ff5c67]/50 bg-[#2a1520] px-4 py-3 text-sm text-[#ffd0d4]">
            Could not load health data:{" "}
            {loadError instanceof Error ? loadError.message : String(loadError)}
          </p>
        ) : null}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat
            kicker="Calories left"
            value={budget.overHigh > 0 ? budget.overHigh : budget.leftToHigh}
            unit={budget.overHigh > 0 ? "over" : "kcal"}
            tone={budget.overHigh > 0 ? "hot" : budget.inBand ? "good" : "open"}
            detail={`${round1(totals.kcal)} eaten · ${KCAL_TARGET_LOW.toLocaleString()}–${KCAL_TARGET_HIGH.toLocaleString()}`}
          />
          <Stat
            kicker="Protein left"
            value={proteinRemaining < 0 ? Math.abs(proteinRemaining) : proteinRemaining}
            unit={proteinRemaining < 0 ? "over" : "g"}
            tone={proteinRemaining <= 0 ? "good" : "open"}
            detail={`${round1(totals.protein)} g eaten · ${PROTEIN_TARGET_G} g`}
          />
          <div className="col-span-2 md:col-span-1">
            <Stat
              kicker="Net calories"
              value={net}
              unit="kcal"
              signed
              tone="open"
              detail={
                burned > 0
                  ? `${round1(totals.kcal)} eaten − ${round1(burned / 2)} (half of ${round1(burned)} burned)`
                  : `${round1(totals.kcal)} eaten · no burn logged`
              }
            />
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col gap-3">
            <div className="border border-white/10 bg-[#161f33]">
              <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b97ad]">
                  Food log
                </h3>
                <p
                  className="text-[22px] leading-none font-bold"
                  style={{ fontFamily: '"Barlow Condensed", Oswald, sans-serif' }}
                >
                  {round1(totals.kcal)}
                  <span className="ml-1 text-[12px] font-medium tracking-[0.14em] text-[#8b97ad]">
                    KCAL
                  </span>
                </p>
              </div>
              <ul className="divide-y divide-white/10">
                {(food.data ?? []).length === 0 && !food.isLoading ? (
                  <li className="px-4 py-6 text-sm text-[#8b97ad]">Nothing logged this day.</li>
                ) : null}
                {(food.data ?? []).map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-white">{row.item}</p>
                      <p className="font-mono text-[11px] text-[#8b97ad]">{fmtTime(row.logged_at)}</p>
                    </div>
                    <p className="text-right">
                      <span
                        className="block text-[22px] leading-none font-bold"
                        style={{ fontFamily: '"Barlow Condensed", Oswald, sans-serif' }}
                      >
                        {round1(row.kcal)}
                      </span>
                      <span className="font-mono text-[10px] text-[#8b97ad]">
                        {round1(row.protein_g)}g
                      </span>
                    </p>
                    <button
                      type="button"
                      aria-label={`Delete ${row.item}`}
                      onClick={() => {
                        void removeFood.mutateAsync(row.id).catch((err: unknown) => {
                          toast.error(err instanceof Error ? err.message : "Could not delete");
                        });
                      }}
                      className="grid h-11 w-11 shrink-0 place-items-center text-[#8b97ad]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b97ad]">
                Saved · tap to log
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(saved.data ?? []).map((row) => (
                  <div key={row.id} className="flex shrink-0 items-stretch border border-white/15 bg-[#121a2c]">
                    <button
                      type="button"
                      onClick={() => void logSaved(row)}
                      className="px-3 py-2 text-left"
                    >
                      <span className="block max-w-[11rem] truncate text-[13px] font-semibold text-white">
                        {row.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#e7c45a]">
                        {round1(row.kcal)} kcal · {round1(row.protein_g)}g
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove saved ${row.name}`}
                      onClick={() => {
                        void removeSaved.mutateAsync(row.id).catch((err: unknown) => {
                          toast.error(err instanceof Error ? err.message : "Could not remove");
                        });
                      }}
                      className="grid w-9 place-items-center border-l border-white/10 text-[#8b97ad]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={onLog} className="grid grid-cols-2 gap-2 border border-white/10 bg-[#161f33] p-3">
              <label className="col-span-1 flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b97ad]">Time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="h-11 bg-[#0d1424] px-3 font-mono text-sm text-white outline-none"
                />
              </label>
              <label className="col-span-1 flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b97ad]">Item</span>
                <input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="What you ate"
                  className="h-11 bg-[#0d1424] px-3 text-sm text-white outline-none placeholder:text-[#5d6b82]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b97ad]">Kcal</span>
                <input
                  inputMode="decimal"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value)}
                  placeholder="0"
                  className="h-11 bg-[#0d1424] px-3 font-mono text-sm text-white outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b97ad]">
                  Protein g
                </span>
                <input
                  inputMode="decimal"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  placeholder="0"
                  className="h-11 bg-[#0d1424] px-3 font-mono text-sm text-white outline-none"
                />
              </label>
              <label className="col-span-2 flex items-center gap-2 text-[12px] text-[#c5cedd]">
                <input
                  type="checkbox"
                  checked={keepFood}
                  onChange={(e) => setKeepFood(e.target.checked)}
                  className="h-4 w-4"
                />
                Save for one-tap re-log
              </label>
              <button
                type="submit"
                disabled={logFood.isPending}
                className="col-span-2 flex h-12 items-center justify-center gap-2 bg-[#ff5c67] text-[12px] font-bold uppercase tracking-[0.18em] text-[#1a0b0e] disabled:opacity-50"
              >
                <Plus size={16} />
                Log food
              </button>
            </form>
          </section>

          <section className="flex flex-col gap-3">
            <div className="border border-white/10 bg-[#161f33]">
              <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b97ad]">
                  Workout
                </h3>
                <p
                  className="text-[22px] leading-none font-bold"
                  style={{ fontFamily: '"Barlow Condensed", Oswald, sans-serif' }}
                >
                  {burned > 0 ? round1(burned) : setCount}
                  <span className="ml-1 text-[12px] font-medium tracking-[0.14em] text-[#8b97ad]">
                    {burned > 0 ? "KCAL BURNED" : setCount === 1 ? "SET" : "SETS"}
                  </span>
                </p>
              </div>
              <ul className="divide-y divide-white/10">
                {workouts.length === 0 && !exercise.isLoading ? (
                  <li className="px-4 py-6 text-sm text-[#8b97ad]">No workout logged this day.</li>
                ) : null}
                {workouts.map((group) => (
                  <li key={group.exercise} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[15px] font-medium text-white">{group.exercise}</p>
                      <p className="shrink-0 font-mono text-[11px] text-[#8b97ad]">
                        {group.sets} {group.sets === 1 ? "set" : "sets"}
                        {group.kcal != null ? ` · ${round1(group.kcal)} kcal` : ""}
                      </p>
                    </div>
                    <p className="mt-1 font-mono text-[11px] leading-relaxed text-[#e7c45a]">
                      {group.lines.join("  ·  ")}
                    </p>
                  </li>
                ))}
              </ul>
              {firstSet ? (
                <p className="border-t border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b97ad]">
                  {clockLabel(firstSet.time)}
                  {lastSet && lastSet !== firstSet ? ` – ${clockLabel(lastSet.time)}` : ""}
                </p>
              ) : null}
            </div>

            <div className="border border-white/10 bg-[#161f33]">
              <div className="flex items-end justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b97ad]">
                    Weight
                  </h3>
                  <p
                    className="mt-1 text-[40px] leading-none font-bold"
                    style={{ fontFamily: '"Barlow Condensed", Oswald, sans-serif' }}
                  >
                    {latest ? latest.weight_lb.toFixed(1) : "—"}
                    <span className="ml-1 text-[14px] tracking-[0.12em] text-[#8b97ad]">LB</span>
                  </p>
                </div>
                <div className="text-right font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[#8b97ad]">
                  <p>Goal {goalToday.toFixed(1)} today</p>
                  <p className="text-[#ff8b93]">1 lb / week from 175</p>
                  <p className="text-[#e7c45a]">smoothed trend</p>
                </div>
              </div>
              <div className="px-2 pt-2">
                <WeightChart samples={samples} today={today} />
              </div>
              {latest && (latest.fat != null || latest.muscle != null) ? (
                <p className="border-t border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b97ad]">
                  Latest composition
                  {latest.fat != null ? ` · fat ${latest.fat}` : ""}
                  {latest.bone != null ? ` · bone ${latest.bone}` : ""}
                  {latest.muscle != null ? ` · muscle ${latest.muscle}` : ""}
                  {latest.hydration != null ? ` · hydration ${latest.hydration}` : ""}
                </p>
              ) : null}
            </div>

            <form onSubmit={onWeigh} className="grid grid-cols-2 gap-2 border border-white/10 bg-[#161f33] p-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b97ad]">Date</span>
                <input
                  type="date"
                  value={weighDay}
                  max={today}
                  onChange={(e) => setWeighDay(e.target.value)}
                  required
                  className="h-11 bg-[#0d1424] px-3 font-mono text-sm text-white outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b97ad]">
                  Weight lb
                </span>
                <input
                  inputMode="decimal"
                  value={pounds}
                  onChange={(e) => setPounds(e.target.value)}
                  placeholder="175.0"
                  className="h-11 bg-[#0d1424] px-3 font-mono text-sm text-white outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={saveWeight.isPending}
                className="col-span-2 flex h-12 items-center justify-center gap-2 bg-white text-[12px] font-bold uppercase tracking-[0.18em] text-[#10182a] disabled:opacity-50"
              >
                Add weigh-in
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  kicker,
  value,
  unit,
  detail,
  tone,
  signed = false,
}: {
  kicker: string;
  value: number;
  unit: string;
  detail: string;
  tone: "open" | "good" | "hot";
  signed?: boolean;
}) {
  const color = tone === "hot" ? "#ff5c67" : tone === "good" ? "#7dcea0" : "#f4f7fb";
  return (
    <article className="relative overflow-hidden border border-white/12 bg-gradient-to-br from-[#1a2438] to-[#121a2c] px-4 py-4">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-[#ff5c67]" />
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b97ad]">{kicker}</p>
      <p
        className="mt-2 text-[52px] leading-none font-bold tracking-tight md:text-[64px]"
        style={{ fontFamily: '"Barlow Condensed", Oswald, sans-serif', color }}
      >
        {signed ? round1(value) : round1(Math.abs(value))}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color }}>
        {unit}
      </p>
      <p className="mt-2 text-[11px] text-[#c5cedd]">{detail}</p>
    </article>
  );
}
