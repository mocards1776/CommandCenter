import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import LogoPlate from "@/components/sports/LogoPlate";
import {
  fetchFootballHistory,
  fetchGameMoreInfo,
  fetchTeamSeasonStats,
  seasonStatRows,
  type GameMoreInfo as MoreInfo,
  type MoreInfoForm,
  type MoreInfoInjuries,
  type MoreInfoSeries,
  type MoreInfoSport,
  type MoreInfoStatRow,
  type MoreInfoTeam,
} from "@/lib/game-more-info";
import { teamAccentColor } from "@/lib/team-logo-glow";
import { cn } from "@/lib/utils";

export type MoreInfoSection =
  | "glance"
  | "odds"
  | "predictor"
  | "leaders"
  | "stats"
  | "form"
  | "series"
  | "injuries"
  | "standings"
  | "venue";

export type MoreInfoRanking = { label: string; away: number | null; home: number | null };

type Links = {
  teamHref?: (teamId: string) => string | null;
  playerHref?: (athleteId: string) => string | null;
};

function accentHex(team: MoreInfoTeam): string {
  return `#${teamAccentColor(team.color, team.alternateColor)}`;
}

function Card({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-panel overflow-hidden rounded-xl border border-white/[0.08]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">{title}</h3>
        {aside ? (
          <span className="min-w-0 truncate text-right text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">
            {aside}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Pair({ children }: { children: (ReactNode | null)[] }) {
  const items = children.filter(Boolean);
  if (!items.length) return null;
  return <div className={cn("grid items-start gap-3", items.length > 1 && "md:grid-cols-2")}>{items}</div>;
}

function TeamTag({ team, align = "left", href }: { team: MoreInfoTeam; align?: "left" | "right"; href?: string | null }) {
  const body = (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-[12px] font-bold leading-5 tracking-wide text-white",
        align === "right" && "flex-row-reverse",
      )}
    >
      {team.logo ? <LogoPlate src={team.logo} className="h-5 w-5" /> : null}
      <span className="truncate">{team.abbrev}</span>
    </span>
  );
  return href ? (
    <Link to={href} className="flex min-w-0 hover:opacity-85">
      {body}
    </Link>
  ) : (
    body
  );
}

function TeamPairHead({ away, home, links }: { away: MoreInfoTeam; home: MoreInfoTeam; links: Links }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
      <TeamTag team={away} href={links.teamHref?.(away.id)} />
      <TeamTag team={home} align="right" href={links.teamHref?.(home.id)} />
    </div>
  );
}

function CompareRow({ label, away, home }: { label: string; away: ReactNode; home: ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-2">
      <span className="numeral text-left text-[14px] text-white">{away}</span>
      <span className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[#8b93a7]">{label}</span>
      <span className="numeral text-right text-[14px] text-white">{home}</span>
    </li>
  );
}

const RECORD_ROWS: { type: string; label: string }[] = [
  { type: "total", label: "Record" },
  { type: "vsconf", label: "Conference" },
];

function glanceRows(info: MoreInfo, rankings: MoreInfoRanking[]): { label: string; away: string; home: string }[] {
  const { away, home } = info;
  const rec = (team: MoreInfoTeam, type: string) => team.records.find((r) => r.type === type)?.summary ?? null;
  const rows: { label: string; away: string; home: string }[] = [];
  for (const r of RECORD_ROWS) {
    const a = rec(away, r.type);
    const h = rec(home, r.type);
    if (a || h) rows.push({ label: r.label, away: a ?? "—", home: h ?? "—" });
  }
  const road = rec(away, "road");
  const homeRec = rec(home, "home");
  if (road || homeRec) rows.push({ label: "Road / home", away: road ?? "—", home: homeRec ?? "—" });
  const ranks = rankings.length
    ? rankings
    : away.rank || home.rank
      ? [{ label: "AP rank", away: away.rank, home: home.rank }]
      : [];
  for (const r of ranks) {
    if (r.away == null && r.home == null) continue;
    rows.push({ label: r.label, away: r.away != null ? `#${r.away}` : "NR", home: r.home != null ? `#${r.home}` : "NR" });
  }
  const atsFor = (team: MoreInfoTeam) => info.ats.find((a) => a.teamId === team.id)?.records[0]?.summary ?? null;
  if (atsFor(away) || atsFor(home)) rows.push({ label: "ATS", away: atsFor(away) ?? "—", home: atsFor(home) ?? "—" });
  return rows;
}

function GlanceCard({
  info,
  rows,
  links,
}: {
  info: MoreInfo;
  rows: { label: string; away: string; home: string }[];
  links: Links;
}) {
  const { away, home } = info;
  if (!rows.length) return null;
  return (
    <Card title="At a glance">
      <TeamPairHead away={away} home={home} links={links} />
      <ul className="divide-y divide-white/[0.05] pb-1">
        {rows.map((r) => (
          <CompareRow key={r.label} label={r.label} away={r.away} home={r.home} />
        ))}
      </ul>
    </Card>
  );
}

function signedLine(n: number | null): string {
  if (n == null) return "—";
  if (n === 0) return "PK";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function OddsCard({ info, links, showPredictor }: { info: MoreInfo; links: Links; showPredictor: boolean }) {
  const { odds, away, home } = info;
  const predictor = showPredictor ? info.predictor : null;
  if (!odds && !predictor) return null;
  const awayLine = odds?.homeLine != null ? -odds.homeLine : null;
  const opened =
    odds && (odds.homeLineOpen != null || odds.totalOpen != null)
      ? [
          odds.homeLineOpen != null && odds.homeLineOpen !== odds.homeLine
            ? odds.homeLineOpen === 0
              ? "PK"
              : `${odds.homeLineOpen < 0 ? home.abbrev : away.abbrev} ${signedLine(-Math.abs(odds.homeLineOpen))}`
            : null,
          odds.totalOpen != null && odds.totalOpen !== odds.overUnder ? `O/U ${odds.totalOpen}` : null,
        ].filter(Boolean)
      : [];
  return (
    <Card title={odds ? "Odds & line" : "Matchup predictor"} aside={odds?.provider}>
      {odds ? (
        <>
          {odds.details ? (
            <p className="px-4 pt-3 text-[20px] font-semibold leading-tight text-white">
              {odds.details.replace(/-(\d)/, "−$1")}
              {odds.overUnder != null ? (
                <span className="ml-2 text-[13px] font-medium text-white/60">O/U {odds.overUnder}</span>
              ) : null}
            </p>
          ) : null}
          <TeamPairHead away={away} home={home} links={links} />
          <ul className="divide-y divide-white/[0.05]">
            {odds.homeLine != null ? (
              <CompareRow label={odds.lineLabel} away={signedLine(awayLine)} home={signedLine(odds.homeLine)} />
            ) : null}
            {odds.awayMoneyline || odds.homeMoneyline ? (
              <CompareRow label="Moneyline" away={odds.awayMoneyline ?? "—"} home={odds.homeMoneyline ?? "—"} />
            ) : null}
          </ul>
          {opened.length ? (
            <p className="border-t border-white/[0.05] px-4 py-2 text-[11px] text-[#8b93a7]">
              Opened {opened.join(" · ")}
            </p>
          ) : null}
          {odds.ats || odds.total ? (
            <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-3">
              {odds.ats ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-100">
                  {odds.ats.coverId ? <Check size={12} aria-hidden /> : null}
                  {odds.ats.coverId ? (
                    <LogoPlate
                      src={(odds.ats.coverId === away.id ? away.logo : home.logo) ?? ""}
                      className="h-4 w-4"
                    />
                  ) : null}
                  {odds.ats.text}
                </span>
              ) : null}
              {odds.total ? (
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[12px] font-semibold text-white/90">
                  {odds.total.text}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      {predictor ? (
        <div className={cn("px-4 pb-3.5", odds ? "border-t border-white/[0.06] pt-3" : "pt-3")}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
            ESPN matchup predictor
          </p>
          <div className="flex items-center justify-between text-[13px] font-semibold text-white">
            <span className="numeral">
              {away.abbrev} {predictor.awayPct.toFixed(1)}%
            </span>
            <span className="numeral">
              {predictor.homePct.toFixed(1)}% {home.abbrev}
            </span>
          </div>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <span style={{ width: `${predictor.awayPct}%`, background: accentHex(away) }} />
            <span className="flex-1" style={{ background: accentHex(home) }} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function LeaderCell({
  leader,
  align,
  links,
}: {
  leader: MoreInfo["leaders"]["pairs"][number]["away"];
  align: "left" | "right";
  links: Links;
}) {
  if (!leader) return <span className="text-[12px] text-white/30">—</span>;
  const href = links.playerHref?.(leader.id) ?? null;
  const name = (
    <span className="block truncate text-[13px] font-semibold text-white">
      {leader.shortName}
      {leader.position ? <span className="ml-1 text-[10px] font-medium text-[#8b93a7]">{leader.position}</span> : null}
    </span>
  );
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      {leader.headshot ? (
        <img
          src={leader.headshot}
          alt=""
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-full bg-white/[0.08] object-cover object-top"
        />
      ) : null}
      <div className="min-w-0">
        {href ? (
          <Link to={href} className="hover:underline">
            {name}
          </Link>
        ) : (
          name
        )}
        <span className="numeral block truncate text-[11px] text-white/70">{leader.value}</span>
      </div>
    </div>
  );
}

function LeadersCard({ info, links }: { info: MoreInfo; links: Links }) {
  const pairs = info.leaders.pairs;
  if (!pairs.length) return null;
  return (
    <Card title={info.leaders.title}>
      <TeamPairHead away={info.away} home={info.home} links={links} />
      <ul className="divide-y divide-white/[0.05]">
        {pairs.map((p) => (
          <li key={p.key} className="px-4 py-2.5">
            <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[#8b93a7]">
              {p.label}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <LeaderCell leader={p.away} align="left" links={links} />
              <LeaderCell leader={p.home} align="right" links={links} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StatsCard({
  rows,
  away,
  home,
  links,
}: {
  rows: MoreInfoStatRow[];
  away: MoreInfoTeam;
  home: MoreInfoTeam;
  links: Links;
}) {
  if (!rows.length) return null;
  const awayColor = accentHex(away);
  const homeColor = accentHex(home);
  return (
    <Card title="Season stats" aside="Per game unless noted">
      <TeamPairHead away={away} home={home} links={links} />
      <ul className="divide-y divide-white/[0.05] pb-1">
        {rows.map((r) => {
          const a = r.awayNum ?? 0;
          const h = r.homeNum ?? 0;
          const awayLeads = a !== h && (r.lowerIsBetter ? a < h : a > h);
          const homeLeads = a !== h && !awayLeads;
          const total = Math.abs(a) + Math.abs(h);
          const share = total > 0 ? (Math.abs(a) / total) * 100 : 50;
          return (
            <li key={r.label} className="px-4 py-2">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <span className={cn("numeral text-[14px]", awayLeads ? "font-semibold text-white" : "text-white/70")}>
                  {r.away}
                </span>
                <span className="text-center text-[10px] font-medium uppercase tracking-[0.12em] text-[#8b93a7]">
                  {r.label}
                </span>
                <span
                  className={cn("numeral text-right text-[14px]", homeLeads ? "font-semibold text-white" : "text-white/70")}
                >
                  {r.home}
                </span>
              </div>
              {total > 0 ? (
                <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  <span
                    className="rounded-l-full"
                    style={{ width: `${share}%`, background: awayColor, opacity: awayLeads ? 0.95 : 0.4 }}
                  />
                  <span
                    className="flex-1 rounded-r-full"
                    style={{ background: homeColor, opacity: homeLeads ? 0.95 : 0.4 }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function resultTone(result: string | null): string {
  if (!result) return "bg-white/10 text-white/70";
  if (/^W/i.test(result)) return "bg-emerald-400/20 text-emerald-200";
  if (/^L|^OTL/i.test(result)) return "bg-red-400/15 text-red-200";
  return "bg-white/10 text-white/80";
}

function FormCard({
  form,
  away,
  home,
  links,
}: {
  form: MoreInfoForm[];
  away: MoreInfoTeam;
  home: MoreInfoTeam;
  links: Links;
}) {
  const ordered = [away, home]
    .map((team) => ({ team, block: form.find((f) => f.teamId === team.id) }))
    .filter((x): x is { team: MoreInfoTeam; block: MoreInfoForm } => Boolean(x.block?.games.length));
  if (!ordered.length) return null;
  return (
    <Card title="Last 5 games">
      <div className={cn("grid divide-white/[0.06]", ordered.length > 1 && "sm:grid-cols-2 sm:divide-x")}>
        {ordered.map(({ team, block }) => {
          const wins = block.games.filter((g) => /^W/i.test(g.result ?? "")).length;
          const losses = block.games.filter((g) => /^L|^OTL/i.test(g.result ?? "")).length;
          return (
            <div key={team.id} className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <TeamTag team={team} href={links.teamHref?.(team.id)} />
                <span className="numeral text-[11px] text-[#8b93a7]">
                  {wins}-{losses}
                </span>
              </div>
              <div className="mb-2.5 flex gap-1">
                {[...block.games].reverse().map((g) => (
                  <span
                    key={`chip-${g.id}`}
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded px-1 text-[10px] font-bold",
                      resultTone(g.result),
                    )}
                  >
                    {(g.result ?? "–").slice(0, 3)}
                  </span>
                ))}
              </div>
              <ul className="space-y-1.5">
                {block.games.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-2 text-[12px]"
                    title={g.date ? new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 text-[#c8cdd8]">
                      <span className="w-4 shrink-0 text-[10px] text-[#8b93a7]">{g.atVs}</span>
                      {g.opponentLogo ? <LogoPlate src={g.opponentLogo} className="h-4 w-4" /> : null}
                      <span className="whitespace-nowrap font-semibold text-white">{g.opponentAbbrev}</span>
                    </span>
                    <span className="numeral shrink-0 font-semibold text-white">
                      <span
                        className={cn(
                          "mr-1.5",
                          /^W/i.test(g.result ?? "") ? "text-emerald-300" : /^L|^OTL/i.test(g.result ?? "") ? "text-red-300" : "text-white/70",
                        )}
                      >
                        {g.result ?? ""}
                      </span>
                      {g.score ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SeriesCard({
  series,
  away,
  home,
  football,
}: {
  series: MoreInfoSeries;
  away: MoreInfoTeam;
  home: MoreInfoTeam;
  football: boolean;
}) {
  const total = series.awayWins + series.homeWins + series.ties;
  const aside = football
    ? series.sinceSeason
      ? `Since ${series.sinceSeason} · reg. season`
      : "Regular season"
    : series.title;
  const logoFor = (id: string) => (id === away.id ? away.logo : id === home.id ? home.logo : null);
  return (
    <Card title={football ? "Series history" : "Season series"} aside={aside}>
      <div className="px-4 pt-3">
        {series.summary ? <p className="text-[18px] font-semibold leading-tight text-white">{series.summary}</p> : null}
        {total > 0 ? (
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[12px] font-semibold text-white">
              <span className="inline-flex items-center gap-1.5">
                {away.logo ? <LogoPlate src={away.logo} className="h-4 w-4" /> : null}
                {away.abbrev} <span className="numeral">{series.awayWins}</span>
              </span>
              {series.ties ? <span className="numeral text-white/60">{series.ties} T</span> : null}
              <span className="inline-flex items-center gap-1.5">
                <span className="numeral">{series.homeWins}</span> {home.abbrev}
                {home.logo ? <LogoPlate src={home.logo} className="h-4 w-4" /> : null}
              </span>
            </div>
            <div className="mt-1.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/[0.05]">
              {series.awayWins ? (
                <span style={{ width: `${(series.awayWins / total) * 100}%`, background: accentHex(away) }} />
              ) : null}
              {series.ties ? <span className="bg-white/30" style={{ width: `${(series.ties / total) * 100}%` }} /> : null}
              {series.homeWins ? <span className="flex-1" style={{ background: accentHex(home) }} /> : null}
            </div>
          </div>
        ) : null}
      </div>
      {series.meetings.length ? (
        <>
          <p className="px-4 pb-1 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
            {football ? "Last meetings" : "Meetings"}
          </p>
          <ul className="divide-y divide-white/[0.05] pb-1">
            {series.meetings.slice(0, 6).map((m) => {
              const awayWon = m.winnerId === m.awayId;
              const homeWon = m.winnerId === m.homeId;
              const year = m.season ?? (m.date ? new Date(m.date).getFullYear() : null);
              const day = m.date
                ? new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : null;
              return (
                <li key={m.id} className="px-4 py-2">
                  <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2">
                    <span className="numeral text-[11px] leading-tight text-[#8b93a7]">
                      {football && year ? year : day}
                      {football && day ? <span className="block text-[10px] text-[#6f778a]">{day}</span> : null}
                    </span>
                    <div className="flex min-w-0 items-center justify-end gap-2 text-[13px] sm:justify-start">
                      <span className={cn("inline-flex items-center gap-1.5", awayWon ? "text-white" : "text-white/55")}>
                        {logoFor(m.awayId) ? <LogoPlate src={logoFor(m.awayId)!} className="h-4 w-4" /> : null}
                        <span className="font-semibold">{m.awayAbbrev}</span>
                        <span className={cn("numeral", awayWon && "font-bold")}>{m.awayScore ?? "–"}</span>
                      </span>
                      <span className="text-white/30">{m.neutral ? "vs" : "@"}</span>
                      <span className={cn("inline-flex items-center gap-1.5", homeWon ? "text-white" : "text-white/55")}>
                        <span className={cn("numeral", homeWon && "font-bold")}>{m.homeScore ?? "–"}</span>
                        <span className="font-semibold">{m.homeAbbrev}</span>
                        {logoFor(m.homeId) ? <LogoPlate src={logoFor(m.homeId)!} className="h-4 w-4" /> : null}
                      </span>
                    </div>
                  </div>
                  {m.note || (m.neutral && m.venue) ? (
                    <p className="mt-0.5 truncate pl-[3.75rem] text-[10.5px] text-[#6f778a]">
                      {[m.note, m.neutral ? m.venue : null].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </Card>
  );
}

function statusTone(status: string): string {
  if (/^out|injured reserve|^ir\b|suspend/i.test(status)) return "bg-red-400/15 text-red-200";
  if (/doubtful/i.test(status)) return "bg-orange-400/15 text-orange-200";
  if (/questionable|day-to-day|game-time/i.test(status)) return "bg-amber-300/15 text-amber-100";
  return "bg-white/10 text-white/75";
}

const INJURY_LIMIT = 8;

const STATUS_SHORT: [RegExp, string][] = [
  [/^injured reserve/i, "IR"],
  [/^day-to-day/i, "DTD"],
  [/^questionable/i, "Quest."],
  [/^doubtful/i, "Doubt."],
  [/^probable/i, "Prob."],
  [/^suspen/i, "Susp."],
  [/^physically unable/i, "PUP"],
];

function shortStatus(status: string): string {
  return STATUS_SHORT.find(([re]) => re.test(status))?.[1] ?? status;
}

function InjuriesCard({
  injuries,
  away,
  home,
  links,
}: {
  injuries: MoreInfoInjuries[];
  away: MoreInfoTeam;
  home: MoreInfoTeam;
  links: Links;
}) {
  const ordered = [away, home]
    .map((team) => ({ team, block: injuries.find((b) => b.teamId === team.id) }))
    .filter((x): x is { team: MoreInfoTeam; block: MoreInfoInjuries } => Boolean(x.block?.players.length));
  if (!ordered.length) return null;
  return (
    <Card title="Injuries">
      <div className={cn("grid divide-white/[0.06]", ordered.length > 1 && "sm:grid-cols-2 sm:divide-x")}>
        {ordered.map(({ team, block }) => (
          <div key={team.id} className="px-4 py-3">
            <div className="mb-2">
              <TeamTag team={team} href={links.teamHref?.(team.id)} />
            </div>
            <ul className="space-y-2">
              {block.players.slice(0, INJURY_LIMIT).map((p) => {
                const href = links.playerHref?.(p.id) ?? null;
                return (
                  <li key={p.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug text-white">
                        {href ? (
                          <Link to={href} className="hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                        {p.position ? (
                          <span className="ml-1 text-[10px] font-medium text-[#8b93a7]">{p.position}</span>
                        ) : null}
                      </p>
                      {p.detail ? <p className="text-[11px] leading-snug text-[#8b93a7]">{p.detail}</p> : null}
                    </div>
                    <span
                      title={p.status}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                        statusTone(p.status),
                      )}
                    >
                      {shortStatus(p.status)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {block.players.length > INJURY_LIMIT ? (
              <p className="mt-2 text-[11px] text-[#8b93a7]">+{block.players.length - INJURY_LIMIT} more</p>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function StandingsCard({ info, links }: { info: MoreInfo; links: Links }) {
  if (!info.standings.length) return null;
  return (
    <Card title="Standings">
      {info.standings.map((group, gi) => (
        <div key={`${group.title}-${gi}`} className={cn(gi > 0 && "border-t border-white/[0.08]")}>
          <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
            {group.title}
          </p>
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-[#6f778a]">
                <th className="px-4 py-1.5 font-medium">Team</th>
                {group.columns.map((c) => (
                  <th key={c} className="numeral px-2 py-1.5 text-right font-medium last:pr-4">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => {
                const href = links.teamHref?.(r.teamId) ?? null;
                const name = (
                  <span className="inline-flex min-w-0 items-center gap-2">
                    {r.logo ? <LogoPlate src={r.logo} className="h-4 w-4" /> : null}
                    <span className="truncate">{r.name}</span>
                  </span>
                );
                return (
                  <tr
                    key={r.teamId || r.name}
                    className={cn(
                      "border-t border-white/[0.04]",
                      r.highlight ? "bg-white/[0.07] font-semibold text-white" : "text-white/75",
                    )}
                  >
                    <td className="max-w-0 px-4 py-1.5">
                      {href ? (
                        <Link to={href} className="hover:underline">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </td>
                    {r.values.map((v, i) => (
                      <td key={`${r.teamId}-${i}`} className="numeral whitespace-nowrap px-2 py-1.5 text-right last:pr-4">
                        {v}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </Card>
  );
}

function VenueCard({ info }: { info: MoreInfo }) {
  const gi = info.gameInfo;
  if (!gi) return null;
  const rows: { label: string; value: string }[] = [];
  if (gi.attendance) rows.push({ label: "Attendance", value: gi.attendance.toLocaleString("en-US") });
  if (gi.weather) rows.push({ label: "Weather", value: gi.weather });
  if (gi.surface) rows.push({ label: "Surface", value: gi.surface });
  if (gi.neutral) rows.push({ label: "Site", value: "Neutral" });
  const referee = gi.officials.find((o) => /^referee$/i.test(o.role ?? ""));
  const others = gi.officials.filter((o) => o !== referee);
  return (
    <Card title="Game info">
      {gi.venue ? (
        <div className="relative">
          {gi.image ? (
            <img src={gi.image} alt="" loading="lazy" className="aspect-[16/7] w-full object-cover" />
          ) : null}
          <div
            className={cn(
              "px-4 py-3",
              gi.image && "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-10",
            )}
          >
            <p className="text-[16px] font-semibold leading-tight text-white">{gi.venue}</p>
            {gi.place ? <p className="text-[12px] text-white/75">{gi.place}</p> : null}
          </div>
        </div>
      ) : null}
      {rows.length ? (
        <dl className="divide-y divide-white/[0.05] border-t border-white/[0.05]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 px-4 py-2">
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8b93a7]">{r.label}</dt>
              <dd className="numeral text-right text-[13px] text-white">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {gi.officials.length ? (
        <div className="border-t border-white/[0.05] px-4 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8b93a7]">Officials</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#c8cdd8]">
            {referee ? (
              <span className="font-semibold text-white">
                {referee.name} <span className="font-normal text-[#8b93a7]">(Referee)</span>
                {others.length ? " · " : ""}
              </span>
            ) : null}
            {others.map((o) => o.name).join(" · ")}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * Everything around the game after the box score, ESPN gamecast / CBS
 * matchup style: glance, odds and the ATS result, leaders, season stats,
 * last five, series history, injuries, standings, venue. Sections without
 * data do not render; the whole block hides when ESPN has nothing.
 */
export default function GameMoreInfo({
  sport,
  eventId,
  live = false,
  exclude = [],
  rankings = [],
  teamHref,
  playerHref,
  title = "More info",
}: {
  sport: MoreInfoSport;
  eventId: string | null | undefined;
  live?: boolean;
  exclude?: MoreInfoSection[];
  rankings?: MoreInfoRanking[];
  teamHref?: (teamId: string) => string | null;
  playerHref?: (athleteId: string) => string | null;
  title?: string;
}) {
  const wants = (s: MoreInfoSection) => !exclude.includes(s);
  const football = sport === "cfb" || sport === "nfl";
  const links: Links = { teamHref, playerHref };

  const summary = useQuery({
    queryKey: ["game-more-info", sport, eventId],
    queryFn: () => fetchGameMoreInfo(sport, eventId!),
    enabled: Boolean(eventId),
    staleTime: 30_000,
    refetchInterval: live ? 60_000 : false,
  });
  const info = summary.data ?? null;

  const needsHistory =
    football && Boolean(info?.season) && (wants("series") || wants("form") || wants("stats"));
  const history = useQuery({
    queryKey: ["football-history", sport, eventId, info?.away.id, info?.home.id, info?.season],
    queryFn: () =>
      fetchFootballHistory({
        sport: sport as "cfb" | "nfl",
        eventId: eventId!,
        season: info!.season!,
        date: info!.date,
        away: { id: info!.away.id, abbrev: info!.away.abbrev },
        home: { id: info!.home.id, abbrev: info!.home.abbrev },
      }),
    enabled: needsHistory && Boolean(info?.away.id && info?.home.id),
    staleTime: 6 * 60 * 60_000,
    gcTime: 12 * 60 * 60_000,
  });

  const statsSport = football || sport === "nhl";
  const seasonStats = useQuery({
    queryKey: ["team-season-stats", sport, info?.away.id, info?.home.id],
    queryFn: async () => {
      const [a, h] = await Promise.all([
        fetchTeamSeasonStats(sport, info!.away.id),
        fetchTeamSeasonStats(sport, info!.home.id),
      ]);
      return { away: a, home: h };
    },
    enabled: statsSport && wants("stats") && Boolean(info?.away.id && info?.home.id),
    staleTime: 10 * 60_000,
  });

  const statRows = useMemo(() => {
    if (!info || !seasonStats.data?.away || !seasonStats.data?.home) return [];
    const sAway = history.data?.scoring[info.away.id] ?? undefined;
    const sHome = history.data?.scoring[info.home.id] ?? undefined;
    return seasonStatRows(sport, seasonStats.data.away, seasonStats.data.home, sAway ?? {}, sHome ?? {});
  }, [info, seasonStats.data, history.data, sport]);

  if (!info) return null;

  const form = info.form.length >= 2 ? info.form : history.data?.form.length ? history.data.form : info.form;
  const series = info.series ?? history.data?.series ?? null;

  const rowsForGlance = glanceRows(info, rankings);
  const glance =
    wants("glance") && rowsForGlance.length ? (
      <GlanceCard key="glance" info={info} rows={rowsForGlance} links={links} />
    ) : null;
  const odds =
    wants("odds") && (info.odds || (wants("predictor") && info.predictor)) ? (
      <OddsCard key="odds" info={info} links={links} showPredictor={wants("predictor")} />
    ) : null;
  const leaders = wants("leaders") && info.leaders.pairs.length ? <LeadersCard info={info} links={links} /> : null;
  const stats =
    wants("stats") && statRows.length ? (
      <StatsCard key="stats" rows={statRows} away={info.away} home={info.home} links={links} />
    ) : null;
  const formCard =
    wants("form") && form.some((f) => f.teamId === info.away.id || f.teamId === info.home.id) ? (
      <FormCard key="form" form={form} away={info.away} home={info.home} links={links} />
    ) : null;
  const seriesCard =
    wants("series") && series ? (
      <SeriesCard key="series" series={series} away={info.away} home={info.home} football={football && !info.series} />
    ) : null;
  const injuries =
    wants("injuries") && info.injuries.some((b) => b.teamId === info.away.id || b.teamId === info.home.id) ? (
      <InjuriesCard key="injuries" injuries={info.injuries} away={info.away} home={info.home} links={links} />
    ) : null;
  const standings =
    wants("standings") && info.standings.length ? <StandingsCard key="standings" info={info} links={links} /> : null;
  const venue = wants("venue") && info.gameInfo ? <VenueCard key="venue" info={info} /> : null;

  if (![glance, odds, leaders, stats, formCard, seriesCard, injuries, standings, venue].some(Boolean)) return null;

  return (
    <section className="space-y-3" data-more-info={sport}>
      <h2 className="rule-head">{title}</h2>
      <Pair>{[glance, odds]}</Pair>
      {leaders}
      <Pair>{[stats, formCard]}</Pair>
      <Pair>{[seriesCard, injuries]}</Pair>
      <Pair>{[standings, venue]}</Pair>
    </section>
  );
}
