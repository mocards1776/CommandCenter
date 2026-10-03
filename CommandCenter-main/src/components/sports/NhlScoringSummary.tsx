import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import LogoPlate from "@/components/sports/LogoPlate";
import { Play } from "lucide-react";
import {
  nhlAccentColor,
  nhlClockKey,
  nhlHeadshot,
  type NhlGameDetail,
  type NhlGoalClip,
  type NhlScoreSide,
  type NhlScoringPlay,
} from "@/lib/nhl";

const STRENGTH_TAG: [RegExp, string][] = [
  [/power/i, "PPG"],
  [/short/i, "SHG"],
  [/empty/i, "EN"],
  [/penalty shot/i, "PS"],
];

function strengthTag(strength: string | null): string | null {
  if (!strength) return null;
  return STRENGTH_TAG.find(([re]) => re.test(strength))?.[1] ?? strength;
}

type ParsedGoal = {
  scorer: { id: string | null; name: string; count: string | null };
  shot: string | null;
  assists: { id: string | null; name: string; count: string | null }[];
};

/** "Leo Carlsson Goal (1) Snap Shot, assists: A.J. Greer (1), Cutter Gauthier (1)" */
function parseGoal(play: NhlScoringPlay): ParsedGoal | null {
  const m = /^(.+?)\s+Goal\s*(?:\((\d+)\))?\s*([^,]*?)\s*(?:,\s*assists?:\s*(.+?))?\s*$/i.exec(play.text);
  if (!m) return null;
  const scorers = play.athletes.filter((a) => /scorer/i.test(a.role));
  const assisters = play.athletes.filter((a) => /assist/i.test(a.role));
  const idFor = (name: string, pool: typeof play.athletes, idx: number) =>
    pool.find((a) => a.name === name)?.id ?? pool[idx]?.id ?? null;
  const assists = [...(m[4] ?? "").matchAll(/([^,]+?)\s*\((\d+)\)/g)].map((a, i) => ({
    id: idFor(a[1]!.trim(), assisters, i),
    name: a[1]!.trim(),
    count: a[2] ?? null,
  }));
  const shot = m[3]?.trim() || null;
  return {
    scorer: { id: idFor(m[1]!.trim(), scorers, 0), name: m[1]!.trim(), count: m[2] ?? null },
    shot: shot && !/unassisted/i.test(shot) ? shot : null,
    assists,
  };
}

function PlayerName({ id, children, className }: { id: string | null; children: ReactNode; className?: string }) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link to={`/sports/nhl/player/${id}`} className={`${className ?? ""} hover:text-accent`}>
      {children}
    </Link>
  );
}

function ScoringText({ play }: { play: NhlScoringPlay }) {
  if (!play.athletes.length) return <>{play.text}</>;
  const pieces: { key: string; node: ReactNode }[] = [];
  let rest = play.text;
  play.athletes.forEach((a, idx) => {
    const at = rest.indexOf(a.name);
    if (at < 0) return;
    if (at > 0) pieces.push({ key: `t-${idx}`, node: rest.slice(0, at) });
    pieces.push({
      key: a.id + idx,
      node: (
        <PlayerName id={a.id} className="font-semibold">
          {a.name}
        </PlayerName>
      ),
    });
    rest = rest.slice(at + a.name.length);
  });
  if (rest) pieces.push({ key: "end", node: rest });
  return (
    <>
      {pieces.map((p) => (
        <span key={p.key}>{p.node}</span>
      ))}
    </>
  );
}

function periodTitle(play: NhlScoringPlay): string {
  const n = play.periodNumber;
  if (n == null) return play.period ?? "—";
  if (n <= 3) return `${["1st", "2nd", "3rd"][n - 1]} Period`;
  if (n === 4) return "Overtime";
  return play.period ?? `${n - 3}OT`;
}

function ScoreChip({ play, scoring, away, home }: {
  play: NhlScoringPlay;
  scoring: "away" | "home" | null;
  away: NhlScoreSide;
  home: NhlScoreSide;
}) {
  const tint = (side: "away" | "home") =>
    scoring === side ? nhlAccentColor(side === "away" ? away : home) : undefined;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-black/25 px-2 py-1">
      <span
        className="numeral text-[15px] font-semibold"
        style={{ color: tint("away") ?? "rgba(255,255,255,0.55)" }}
      >
        {play.awayScore ?? 0}
      </span>
      <span className="text-[11px] text-white/35">–</span>
      <span
        className="numeral text-[15px] font-semibold"
        style={{ color: tint("home") ?? "rgba(255,255,255,0.55)" }}
      >
        {play.homeScore ?? 0}
      </span>
    </span>
  );
}

export default function NhlScoringSummary({
  g,
  goalByClock,
  onWatch,
}: {
  g: NhlGameDetail;
  goalByClock: Map<string, NhlGoalClip>;
  onWatch: (clipId: string) => void;
}) {
  if (!g.scoringPlays.length) return null;
  const periods: { title: string; plays: NhlScoringPlay[] }[] = [];
  for (const p of g.scoringPlays) {
    const title = periodTitle(p);
    const last = periods[periods.length - 1];
    if (last?.title === title) last.plays.push(p);
    else periods.push({ title, plays: [p] });
  }
  const sideOf = (p: NhlScoringPlay): "away" | "home" | null =>
    p.teamId === String(g.away.teamId) ? "away" : p.teamId === String(g.home.teamId) ? "home" : null;

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">Scoring</h3>
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
          {[g.away, g.home].map((side) => (
            <span key={side.teamId} className="inline-flex items-center gap-1">
              {side.logo ? <LogoPlate src={side.logo} className="h-4 w-4" /> : null}
              <span className="numeral text-cream">
                {g.scoringPlays.filter((p) => p.teamId === String(side.teamId)).length}
              </span>
            </span>
          ))}
        </span>
      </div>
      {periods.map((period) => (
        <Fragment key={period.title}>
          <div className="flex items-center gap-3 bg-white/[0.025] px-4 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              {period.title}
            </span>
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {period.plays.map((p) => {
              const sideKey = sideOf(p);
              const side = sideKey === "away" ? g.away : sideKey === "home" ? g.home : null;
              const color = side ? nhlAccentColor(side) : "rgba(255,255,255,0.2)";
              const parsed = parseGoal(p);
              const clip = goalByClock.get(nhlClockKey(p.periodNumber, p.clock) ?? "");
              const tag = strengthTag(p.strength);
              return (
                <li
                  key={p.id}
                  className="relative flex gap-3 py-3 pl-4 pr-3"
                  style={{
                    background: `linear-gradient(90deg, color-mix(in srgb, ${color} 14%, transparent), transparent 55%)`,
                  }}
                >
                  <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color }} />
                  <div className="relative h-12 w-12 shrink-0">
                    {parsed?.scorer.id ? (
                      <img
                        src={nhlHeadshot(parsed.scorer.id)}
                        alt=""
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (side?.logo && img.src !== side.logo) {
                            img.src = side.logo;
                            Object.assign(img.style, { objectFit: "contain", padding: "7px", background: "#0b1526" });
                          } else {
                            img.style.visibility = "hidden";
                          }
                        }}
                        className="h-12 w-12 rounded-full bg-[#dfe6f2] object-cover object-top"
                        style={{ boxShadow: `0 0 0 2px ${color}` }}
                      />
                    ) : null}
                    {side?.logo ? (
                      <LogoPlate src={side.logo} className="absolute -bottom-1 -right-1 h-6 w-6" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    {parsed ? (
                      <>
                        <p className="text-cream text-[15px] font-semibold leading-tight">
                          <PlayerName id={parsed.scorer.id}>{parsed.scorer.name}</PlayerName>
                          {parsed.scorer.count ? (
                            <span className="numeral ml-1 text-[12px] font-normal text-white/45">
                              ({parsed.scorer.count})
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                          <span className="numeral rounded-sm bg-white/[0.08] px-1.5 py-0.5 text-[#c5cce0]">
                            {p.clock ?? ""}
                          </span>
                          {parsed.shot ? <span className="text-chalk">{parsed.shot}</span> : null}
                          {tag ? (
                            <span className="bg-accent/20 text-accent rounded-sm px-1.5 py-0.5 font-bold tracking-[0.08em]">
                              {tag}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-chalk-dim mt-1.5 text-[12px] leading-snug">
                          {parsed.assists.length ? (
                            <>
                              <span className="mr-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/35">
                                Ast
                              </span>
                              {parsed.assists.map((a, i) => (
                                <Fragment key={`${a.name}-${i}`}>
                                  {i > 0 ? ", " : null}
                                  <span className="whitespace-nowrap">
                                    <PlayerName id={a.id} className="text-[#c8cdd8]">
                                      {a.name}
                                    </PlayerName>
                                    {a.count ? <span className="numeral text-white/35"> ({a.count})</span> : null}
                                  </span>
                                </Fragment>
                              ))}
                            </>
                          ) : (
                            <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/35">
                              Unassisted
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="numeral text-chalk text-[11px]">{p.clock ?? ""}</p>
                        <p className="text-cream mt-0.5 text-[13px] leading-snug">
                          <ScoringText play={p} />
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <ScoreChip play={p} scoring={sideKey} away={g.away} home={g.home} />
                    {clip ? (
                      <button
                        type="button"
                        onClick={() => onWatch(clip.id)}
                        className="bg-accent/15 text-accent hover:bg-accent/25 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                      >
                        <Play size={10} className="fill-current" /> Watch
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Fragment>
      ))}
    </section>
  );
}
