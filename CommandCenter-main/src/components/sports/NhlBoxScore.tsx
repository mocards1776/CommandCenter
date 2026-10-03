import { Fragment } from "react";
import { Link } from "react-router-dom";
import LogoPlate from "@/components/sports/LogoPlate";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  nhlAccentColor,
  nhlHeadshot,
  type NhlBoxRow,
  type NhlGameDetail,
  type NhlScoreSide,
} from "@/lib/nhl";
import { groupNhlSkaters, type NhlShiftLines, type NhlSkaterUnit } from "@/lib/nhl-lines";

function stat(row: NhlBoxRow, label: string): string | null {
  const v = row.stats.find((s) => s.label === label)?.value;
  return v && v !== "—" ? v : null;
}

function num(row: NhlBoxRow, label: string): number {
  const n = Number(stat(row, label));
  return Number.isFinite(n) ? n : 0;
}

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

function teamColor(side: NhlScoreSide): string {
  return nhlAccentColor(side);
}

function unitSummary(unit: NhlSkaterUnit): string {
  const goals = unit.rows.reduce((s, r) => s + num(r, "G"), 0);
  const assists = unit.rows.reduce((s, r) => s + num(r, "A"), 0);
  const avg = unit.rows.length ? unit.rows.reduce((s, r) => s + r.toiSec, 0) / unit.rows.length : 0;
  return [goals || assists ? `${goals} G · ${assists} A` : null, avg > 0 ? `${clock(avg)} avg TOI` : null]
    .filter(Boolean)
    .join(" · ");
}

function SkaterTable({
  side,
  forwards,
  defense,
  shiftLines,
  shiftsPending,
}: {
  side: NhlScoreSide;
  forwards: NhlBoxRow[];
  defense: NhlBoxRow[];
  shiftLines: NhlShiftLines | null | undefined;
  shiftsPending: boolean;
}) {
  const { units, source } = groupNhlSkaters(forwards, defense, shiftLines);
  const columns = (forwards[0] ?? defense[0])?.stats.map((s) => s.label) ?? [];
  const color = teamColor(side);
  if (!units.length) return null;
  return (
    <div data-box="skaters" className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="h-[3px]" style={{ background: color }} />
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          {side.logo ? <LogoPlate src={side.logo} className="h-5 w-5" /> : null}
          {side.abbrev} · Skaters
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] px-2 py-0.5 text-[9.5px] uppercase tracking-[0.12em] text-[#8b93a7]"
          title={
            source === "shifts"
              ? "Lines and pairs are the most-used 5v5 combinations in the NHL shift chart"
              : "No shift chart yet — grouped by time on ice"
          }
        >
          {shiftsPending ? <Loader2 size={10} className="animate-spin" /> : null}
          {source === "shifts" ? "Est. lines · 5v5 shifts" : "Est. lines · by TOI"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-4 py-2 font-medium">Player</th>
              {columns.map((label) => (
                <th key={label} className="numeral px-2 py-2 text-right font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((unit, ui) => (
              <Fragment key={unit.key}>
                {unit.kind === "defense" && units[ui - 1]?.kind === "forwards" ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="h-2 bg-black/20" />
                  </tr>
                ) : null}
                <tr className="border-t border-white/[0.06]">
                  <td colSpan={columns.length + 1} className="px-4 pb-1 pt-2.5">
                    <div className="sticky left-4 flex w-max items-center gap-2">
                      <span
                        className="rounded-sm px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#07101d]"
                        style={{ background: unit.kind === "extras" ? "#8b93a7" : color }}
                      >
                        {unit.label}
                      </span>
                      <span className="numeral text-[10.5px] text-[#8b93a7]">{unitSummary(unit)}</span>
                    </div>
                  </td>
                </tr>
                {unit.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-1.5 pl-4 pr-2">
                      <Link
                        to={`/sports/nhl/player/${row.id}`}
                        className="text-cream inline-flex items-center gap-2 font-medium hover:underline"
                      >
                        <span className="w-[1.4rem] shrink-0 text-center text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#8b93a7]">
                          {row.position ?? ""}
                        </span>
                        <img
                          src={nhlHeadshot(row.id)}
                          alt=""
                          className="h-7 w-7 rounded-full bg-[#dfe6f2] object-cover object-top"
                          loading="lazy"
                        />
                        <span className="whitespace-nowrap">{row.name}</span>
                        {row.jersey ? (
                          <span className="numeral text-[10.5px] font-normal text-white/35">#{row.jersey}</span>
                        ) : null}
                      </Link>
                    </td>
                    {row.stats.map((s) => (
                      <td
                        key={s.label}
                        className={
                          (s.label === "G" || s.label === "A") && Number(s.value) > 0
                            ? "numeral text-cream px-2 py-1.5 text-right font-semibold"
                            : "numeral px-2 py-1.5 text-right text-white/80"
                        }
                      >
                        {s.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GoalieCard({
  side,
  row,
  role,
  final,
}: {
  side: NhlScoreSide;
  row: NhlBoxRow;
  role: "Starter" | "Relief" | null;
  final: boolean;
}) {
  const color = teamColor(side);
  const saves = num(row, "SV");
  const shots = num(row, "SA") || saves + num(row, "GA");
  const ga = num(row, "GA");
  const pct = stat(row, "SV%");
  const savePct = shots > 0 ? (saves / shots) * 100 : 0;
  const shutout = final && shots > 0 && ga === 0 && row.toiSec >= 3600;
  const splits = [
    ["EV", stat(row, "ESSV")],
    ["PP", stat(row, "PPSV")],
    ["SH", stat(row, "SHSV")],
  ].filter((s): s is [string, string] => s[1] != null);
  return (
    <Link
      to={`/sports/nhl/player/${row.id}`}
      className="group relative block overflow-hidden rounded-xl border border-white/[0.1] bg-[#08111f] shadow-[0_14px_40px_rgba(0,0,0,0.3)]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${color} 60%, transparent) 0%, color-mix(in srgb, ${color} 18%, transparent) 38%, transparent 70%)`,
        }}
      />
      {side.logo ? (
        <img
          src={side.logo}
          alt=""
          className="pointer-events-none absolute -bottom-8 -right-8 h-44 w-44 object-contain opacity-[0.1]"
        />
      ) : null}
      <div className="relative flex items-start gap-4 p-4">
        <img
          src={nhlHeadshot(row.id)}
          alt=""
          className="h-24 w-24 shrink-0 rounded-full bg-[#dfe6f2] object-cover object-top sm:h-28 sm:w-28"
          style={{ boxShadow: `0 0 0 3px ${color}, 0 10px 30px rgba(0,0,0,0.45)` }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/60">
            {side.logo ? <LogoPlate src={side.logo} className="h-4 w-4" /> : null}
            {side.abbrev}
            {row.jersey ? <span className="numeral">#{row.jersey}</span> : null}
            {role ? <span className="text-white/40">· {role}</span> : null}
          </p>
          <p className="text-cream mt-1 text-[18px] font-semibold leading-tight group-hover:underline">{row.name}</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-display text-cream text-[40px] leading-none tabular-nums">{pct ?? "—"}</span>
            <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
              SV%
            </span>
            {shutout ? (
              <span className="mb-1 ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                <ShieldCheck size={11} /> Shutout
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="relative px-4">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <span className="rounded-l-full" style={{ width: `${savePct}%`, background: color }} />
          {ga > 0 ? <span className="bg-alert/80 flex-1" /> : null}
        </div>
      </div>
      <div className="relative grid grid-cols-4 gap-2 px-4 pb-3 pt-3 text-center">
        {(
          [
            ["Saves", `${saves}/${shots}`],
            ["GA", String(ga)],
            ["Shots", String(shots)],
            ["TOI", stat(row, "TOI") ?? "—"],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md bg-black/25 px-1 py-1.5">
            <p className="numeral text-cream text-[15px] font-semibold leading-none">{value}</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#8b93a7]">{label}</p>
          </div>
        ))}
      </div>
      {splits.length ? (
        <div className="relative flex items-center gap-3 border-t border-white/[0.07] px-4 py-2 text-[10.5px] text-[#a8b0c2]">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">Saves by strength</span>
          {splits.map(([label, value]) => (
            <span key={label} className="numeral">
              <span className="text-white/45">{label}</span> <span className="text-cream font-semibold">{value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export default function NhlBoxScore({
  g,
  shiftLines,
  shiftsPending,
}: {
  g: NhlGameDetail;
  shiftLines: Record<string, NhlShiftLines> | null | undefined;
  shiftsPending: boolean;
}) {
  const groupFor = (side: NhlScoreSide, name: string) =>
    g.boxGroups.find((b) => b.teamAbbrev === side.abbrev && b.name === name)?.rows ?? [];
  const goalies = [g.away, g.home].flatMap((side) => {
    const rows = groupFor(side, "Goalies");
    const played = rows.some((r) => r.toiSec > 0) ? rows.filter((r) => r.toiSec > 0) : rows;
    const starterId = [...played].sort((a, b) => b.toiSec - a.toiSec)[0]?.id;
    return played.map((row) => ({
      side,
      row,
      role: played.length > 1 ? (row.id === starterId ? ("Starter" as const) : ("Relief" as const)) : null,
    }));
  });

  return (
    <section className="space-y-4">
      <h2 className="rule-head">Box score</h2>
      {goalies.length > 0 ? (
        <div data-box="goalies" className="space-y-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Goaltending</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {goalies.map(({ side, row, role }) => (
              <GoalieCard key={row.id} side={side} row={row} role={role} final={g.final} />
            ))}
          </div>
        </div>
      ) : null}
      {[g.away, g.home].map((side) => (
        <SkaterTable
          key={side.teamId}
          side={side}
          forwards={groupFor(side, "Forwards")}
          defense={groupFor(side, "Defense")}
          shiftLines={shiftLines?.[side.abbrev]}
          shiftsPending={shiftsPending}
        />
      ))}
    </section>
  );
}
