import { Link } from "react-router-dom";
import LogoPlate from "@/components/sports/LogoPlate";
import {
  nhlAccentColor,
  nhlHeadshot,
  type NhlBoxRow,
  type NhlGameDetail,
  type NhlGameLeader,
  type NhlScoreSide,
} from "@/lib/nhl";

const CATEGORY_SHORT: Record<string, string> = { goals: "G", assists: "A", points: "PTS", saves: "SV" };
const CATEGORY_ORDER: Record<string, number> = { goals: 0, assists: 1, points: 2, saves: 3 };

type MergedLeader = {
  id: string;
  name: string;
  stats: { key: string; short: string; value: string }[];
  row: NhlBoxRow | null;
};

function categoryKey(category: string): string {
  return category.trim().toLowerCase();
}

function mergeLeaders(leaders: NhlGameLeader[], rows: Map<string, NhlBoxRow>): MergedLeader[] {
  const byId = new Map<string, MergedLeader>();
  for (const l of leaders) {
    const key = categoryKey(l.category);
    const entry = byId.get(l.id) ?? { id: l.id, name: l.name, stats: [], row: rows.get(l.id) ?? null };
    if (!entry.stats.some((s) => s.key === key)) {
      entry.stats.push({ key, short: CATEGORY_SHORT[key] ?? l.category.slice(0, 3).toUpperCase(), value: l.value });
    }
    byId.set(l.id, entry);
  }
  const order = (s: { key: string }) => CATEGORY_ORDER[s.key] ?? 9;
  const list = [...byId.values()];
  for (const m of list) m.stats.sort((a, b) => order(a) - order(b));
  const weight = (m: MergedLeader) =>
    m.stats.length * 100 + Number(m.stats.find((s) => s.key === "points")?.value ?? 0);
  return list.sort((a, b) => weight(b) - weight(a));
}

function rowStat(row: NhlBoxRow | null, label: string): string | null {
  const v = row?.stats.find((s) => s.label === label)?.value;
  return v && v !== "—" ? v : null;
}

function subline(row: NhlBoxRow | null): string {
  if (!row) return "";
  const pm = rowStat(row, "+/-");
  const shots = rowStat(row, "S");
  return [
    row.position,
    rowStat(row, "TOI") ? `${rowStat(row, "TOI")} TOI` : null,
    shots ? `${shots} ${shots === "1" ? "shot" : "shots"}` : null,
    pm ? (Number(pm) > 0 ? `+${pm}` : Number(pm) === 0 ? "E" : pm) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function TeamColumn({ side, leaders }: { side: NhlScoreSide; leaders: MergedLeader[] }) {
  const color = nhlAccentColor(side);
  const [hero, ...rest] = leaders;
  if (!hero) return null;
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/[0.07] bg-[#0a1424]">
      <div className="h-1 w-full" style={{ background: color }} />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60"
        style={{ background: `radial-gradient(ellipse at 15% 0%, color-mix(in srgb, ${color} 40%, transparent), transparent 70%)` }}
      />
      <div className="relative flex items-center gap-2 px-3 pt-2.5">
        {side.logo ? <LogoPlate src={side.logo} className="h-6 w-6" /> : null}
        <span className="text-cream text-[12px] font-semibold uppercase tracking-[0.14em]">{side.abbrev}</span>
      </div>

      <Link
        to={`/sports/nhl/player/${hero.id}`}
        className="relative flex items-center gap-3.5 px-3 pb-3 pt-2.5 hover:bg-white/[0.02]"
      >
        <img
          src={nhlHeadshot(hero.id)}
          alt=""
          className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full bg-[#dfe6f2] object-cover object-top"
          style={{ boxShadow: `0 0 0 3px ${color}` }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-cream truncate text-[17px] font-semibold leading-tight">{hero.name}</p>
          {subline(hero.row) ? (
            <p className="text-chalk-dim numeral mt-0.5 truncate text-[11px]">{subline(hero.row)}</p>
          ) : null}
          <div className="mt-2 flex gap-4">
            {hero.stats.map((s) => (
              <div key={s.key} className="leading-none">
                <span className="font-display text-cream block text-[26px] tabular-nums">{s.value}</span>
                <span className="mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
                  {s.short}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Link>

      {rest.length > 0 ? (
        <ul className="relative divide-y divide-white/[0.05] border-t border-white/[0.06]">
          {rest.map((m) => (
            <li key={m.id}>
              <Link
                to={`/sports/nhl/player/${m.id}`}
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03]"
              >
                <img
                  src={nhlHeadshot(m.id)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full bg-[#dfe6f2] object-cover object-top"
                  style={{ boxShadow: `0 0 0 2px ${color}` }}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-cream block truncate text-[13.5px] font-semibold">{m.name}</span>
                  {subline(m.row) ? (
                    <span className="text-chalk-dim numeral block truncate text-[10.5px]">{subline(m.row)}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 gap-1">
                  {m.stats.map((s) => (
                    <StatChip key={s.key} value={s.value} label={s.short} color={color} />
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatChip({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span className="numeral text-cream text-[13px] font-semibold">{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color }}>
        {label}
      </span>
    </span>
  );
}

export default function NhlGameLeaders({ g }: { g: NhlGameDetail }) {
  const rows = new Map<string, NhlBoxRow>();
  for (const group of g.boxGroups) for (const r of group.rows) rows.set(r.id, r);
  const sides = [g.away, g.home]
    .map((side) => ({
      side,
      leaders: mergeLeaders(
        g.leaders.filter((l) => l.teamAbbrev === side.abbrev),
        rows,
      ),
    }))
    .filter((s) => s.leaders.length > 0);
  if (!sides.length) return null;
  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-3 sm:p-4">
      <h3 className="rule-head mb-3">Game leaders</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map(({ side, leaders }) => (
          <TeamColumn key={side.teamId} side={side} leaders={leaders} />
        ))}
      </div>
    </section>
  );
}
