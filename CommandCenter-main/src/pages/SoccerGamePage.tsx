import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import {
  fetchSoccerGameDetail,
  type SoccerGameDetail,
  type SoccerGameLeader,
  type SoccerGameOdds,
  type SoccerGameSide,
} from "@/lib/soccer-game";
import { soccerTeamLogo } from "@/lib/soccer";
import { cn } from "@/lib/utils";

export function SoccerGameDetailView({
  eventId,
  leagueHint,
  title,
  espnUrl,
}: {
  eventId: string;
  leagueHint?: string | null;
  title?: string;
  espnUrl?: string;
}) {
  const detail = useQuery({
    queryKey: ["soccer-game-detail", eventId, leagueHint ?? null],
    queryFn: () => fetchSoccerGameDetail(eventId, leagueHint),
    enabled: Boolean(eventId),
    staleTime: 30_000,
    refetchInterval: (q) => (q.state.data?.state === "in" ? 20_000 : false),
  });

  if (detail.isPending) {
    return (
      <p className="text-chalk flex items-center gap-2 text-[13px]">
        <Loader2 size={14} className="animate-spin" /> Loading soccer match…
      </p>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <p className="text-alert text-[13px]">
        {detail.error instanceof Error ? detail.error.message : "Couldn’t load this soccer match."}
      </p>
    );
  }

  const g = detail.data;
  const link = espnUrl || g.espnUrl;

  return (
    <div className="space-y-5">
      <SoccerMatchupHeader g={g} title={title} />
      <PreviewSection html={g.previewHtml} storyHtml={g.storyHtml} />
      {g.odds ? <GameOddsTable odds={g.odds} away={g.away} home={g.home} /> : null}
      <LeaderPair
        title="Top scorers"
        away={g.topScorers.away}
        home={g.topScorers.home}
        awayAbbrev={g.away.abbrev}
        homeAbbrev={g.home.abbrev}
      />
      <LeaderPair
        title="Most assists"
        away={g.mostAssists.away}
        home={g.mostAssists.home}
        awayAbbrev={g.away.abbrev}
        homeAbbrev={g.home.abbrev}
      />
      {g.teamStats.length > 0 ? (
        <TeamStatsBars stats={g.teamStats} away={g.away} home={g.home} />
      ) : null}
      {g.standings.length > 0 ? <StandingsTable rows={g.standings} /> : null}
      {g.headToHead.length > 0 ? <HeadToHead rows={g.headToHead} /> : null}
      <div className="px-0.5">
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
        >
          ESPN match page <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

export default function SoccerGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const leagueHint = params.get("league");

  if (!eventId) {
    return (
      <div className="p-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-alert text-[13px]">Match not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          Sports
        </Link>
      </div>
      <SoccerGameDetailView eventId={eventId} leagueHint={leagueHint} />
    </div>
  );
}

function SoccerMatchupHeader({
  g,
  title,
}: {
  g: SoccerGameDetail;
  title?: string;
}) {
  const awayWins =
    g.state === "post" &&
    g.away.score != null &&
    g.home.score != null &&
    Number(g.away.score) > Number(g.home.score);
  const homeWins =
    g.state === "post" &&
    g.away.score != null &&
    g.home.score != null &&
    Number(g.home.score) > Number(g.away.score);
  const pregame = g.state === "pre";

  return (
    <header className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <p
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.16em]",
            g.state === "post" ? "text-cream" : g.state === "in" ? "text-alert" : "text-[#a8b0c2]",
          )}
        >
          {g.status}
        </p>
        <p className="truncate text-[11px] text-[#8b93a7]">
          {[g.leagueName, g.venue].filter(Boolean).join(" · ")}
        </p>
      </div>

      {title ? (
        <p className="border-b border-white/[0.06] px-4 py-2 text-[13px] leading-snug text-[#c8cdd8]">
          {title}
        </p>
      ) : null}

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-6 sm:gap-4 sm:px-6">
        <MatchupSide side={g.away} align="left" winner={awayWins} loser={homeWins} />
        <div className="px-1 text-center">
          {pregame ? (
            <>
              <p className="font-display text-[22px] leading-snug tracking-tight text-white sm:text-[26px]">
                {g.when?.split(" · ").pop() || "TBD"}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                Kickoff
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-[48px] leading-none tabular-nums text-white sm:text-[56px]">
                <span className={awayWins ? "text-white" : "text-white/50"}>
                  {g.away.score ?? "–"}
                </span>
                <span className="mx-2 text-[22px] text-white/25 sm:mx-3">-</span>
                <span className={homeWins ? "text-white" : "text-white/50"}>
                  {g.home.score ?? "–"}
                </span>
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                {g.state === "post" ? "Full time" : g.status}
              </p>
            </>
          )}
        </div>
        <MatchupSide side={g.home} align="right" winner={homeWins} loser={awayWins} />
      </div>

      {(g.away.record || g.home.record || g.when) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-[#8b93a7]">
          <span className="numeral">
            {g.away.abbrev} {g.away.record || "—"}
            {g.away.form ? ` · ${g.away.form}` : ""}
          </span>
          {g.when ? <span className="text-center">{g.when}</span> : <span />}
          <span className="numeral text-right">
            {g.home.abbrev} {g.home.record || "—"}
            {g.home.form ? ` · ${g.home.form}` : ""}
          </span>
        </div>
      )}
    </header>
  );
}

function MatchupSide({
  side,
  align,
  winner,
  loser,
}: {
  side: SoccerGameSide;
  align: "left" | "right";
  winner?: boolean;
  loser?: boolean;
}) {
  const logo = side.logo || (side.id ? soccerTeamLogo(side.id) : null);
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2",
        align === "left" ? "sm:items-start" : "sm:items-end",
        loser && "opacity-55",
      )}
    >
      {logo ? (
        <img src={logo} alt="" className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
      ) : (
        <div className="bg-white/5 h-14 w-14 rounded-full sm:h-16 sm:w-16" />
      )}
      <div className={cn("min-w-0 text-center", align === "left" ? "sm:text-left" : "sm:text-right")}>
        <p
          className={cn(
            "truncate text-[15px] font-bold leading-tight sm:text-[17px]",
            winner ? "text-cream" : "text-white",
          )}
        >
          {side.shortName || side.name}
        </p>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[#8b93a7]">
          {side.abbrev}
        </p>
      </div>
    </div>
  );
}

function PreviewSection({
  html,
  storyHtml,
}: {
  html: string;
  storyHtml: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424] font-rss">
      <div className="border-b border-white/[0.07] px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
          Match preview
        </p>
      </div>
      <div
        className="rss-reader px-4 py-4 text-[15px] leading-[1.75] text-[#d5dae6] [&_p]:my-3.5 [&_strong]:text-cream"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {storyHtml ? (
        <div
          className="rss-reader border-t border-white/[0.06] px-4 py-4 text-[15px] leading-[1.75] text-[#d5dae6] [&_a]:font-semibold [&_a]:text-accent [&_a]:hover:underline [&_p]:my-3.5"
          dangerouslySetInnerHTML={{ __html: storyHtml }}
        />
      ) : null}
    </section>
  );
}

function GameOddsTable({
  odds,
  away,
  home,
}: {
  odds: SoccerGameOdds;
  away: SoccerGameSide;
  home: SoccerGameSide;
}) {
  const rows: { label: string; open: string; ml: string; total: string; spread: string }[] = [
    {
      label: away.abbrev,
      open: odds.awayOpen || "—",
      ml: odds.awayMl || "—",
      total: odds.totalLine ? `o${odds.totalLine}` : "—",
      spread: [odds.awaySpread, odds.awaySpreadOdds].filter(Boolean).join(" ") || "—",
    },
    {
      label: "Draw",
      open: odds.drawOpen || "—",
      ml: odds.drawMl || "—",
      total: odds.totalLine && odds.totalOverOdds ? odds.totalOverOdds : "—",
      spread: "—",
    },
    {
      label: home.abbrev,
      open: odds.homeOpen || "—",
      ml: odds.homeMl || "—",
      total: odds.totalLine ? `u${odds.totalLine}` : "—",
      spread: [odds.homeSpread, odds.homeSpreadOdds].filter(Boolean).join(" ") || "—",
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
          Game odds
        </p>
        <p className="text-[11px] text-[#8b93a7]">{odds.provider}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <thead>
            <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">Side</th>
              <th className="numeral px-2 py-2 text-right font-medium">Open</th>
              <th className="numeral px-2 py-2 text-right font-medium">ML</th>
              <th className="numeral px-2 py-2 text-right font-medium">Total</th>
              <th className="numeral px-3 py-2 text-right font-medium">Spread</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-white/[0.05]">
                <td className="px-3 py-2 font-medium text-cream">{r.label}</td>
                <td className="numeral px-2 py-2 text-right text-white/85">{r.open}</td>
                <td className="numeral px-2 py-2 text-right text-white">{r.ml}</td>
                <td className="numeral px-2 py-2 text-right text-white/85">{r.total}</td>
                <td className="numeral px-3 py-2 text-right text-white/85">{r.spread}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(odds.totalOverOdds || odds.totalUnderOdds) && odds.totalLine ? (
        <p className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-[#8b93a7]">
          O/U {odds.totalLine}
          {odds.totalOverOdds ? ` · Over ${odds.totalOverOdds}` : ""}
          {odds.totalUnderOdds ? ` · Under ${odds.totalUnderOdds}` : ""}
        </p>
      ) : null}
    </section>
  );
}

function LeaderPair({
  title,
  away,
  home,
  awayAbbrev,
  homeAbbrev,
}: {
  title: string;
  away: SoccerGameLeader | null;
  home: SoccerGameLeader | null;
  awayAbbrev: string;
  homeAbbrev: string;
}) {
  if (!away && !home) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <p className="border-b border-white/[0.07] px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
        {title}
      </p>
      <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
        <LeaderCell abbrev={awayAbbrev} leader={away} align="left" />
        <LeaderCell abbrev={homeAbbrev} leader={home} align="right" />
      </div>
    </section>
  );
}

function LeaderCell({
  abbrev,
  leader,
  align,
}: {
  abbrev: string;
  leader: SoccerGameLeader | null;
  align: "left" | "right";
}) {
  return (
    <div className={cn("px-4 py-4", align === "right" && "text-right")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
        {abbrev}
      </p>
      {leader ? (
        <>
          <p className="text-cream mt-2 text-[14px] font-semibold leading-snug">{leader.name}</p>
          <p className="numeral mt-1 text-[18px] font-bold text-white">{leader.value}</p>
          {leader.detail ? (
            <p className="mt-1 text-[11px] leading-snug text-[#8b93a7]">{leader.detail}</p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-[13px] text-[#8b93a7]">—</p>
      )}
    </div>
  );
}

function parseNumeric(raw: string): number | null {
  const cleaned = raw.replace(/%/g, "").replace(/,/g, "").trim();
  if (!cleaned || cleaned === "—") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function TeamStatsBars({
  stats,
  away,
  home,
}: {
  stats: { label: string; away: string; home: string }[];
  away: SoccerGameSide;
  home: SoccerGameSide;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
          Team stats
        </p>
        <p className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
          {away.abbrev} · {home.abbrev}
        </p>
      </div>
      <ul className="divide-y divide-white/[0.05] px-4">
        {stats.map((s) => {
          const a = parseNumeric(s.away);
          const h = parseNumeric(s.home);
          const numeric = a != null && h != null && (a > 0 || h > 0);
          const total = numeric ? Math.abs(a!) + Math.abs(h!) : 0;
          const aPct = numeric && total > 0 ? (Math.abs(a!) / total) * 100 : 50;
          const hPct = numeric && total > 0 ? (Math.abs(h!) / total) * 100 : 50;
          return (
            <li key={s.label} className="py-3">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
                <span className="numeral font-medium text-white">{s.away}</span>
                <span className="text-[11px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  {s.label}
                </span>
                <span className="numeral font-medium text-white">{s.home}</span>
              </div>
              {numeric ? (
                <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="bg-accent/80 h-full" style={{ width: `${aPct}%` }} />
                  <div className="h-full bg-white/35" style={{ width: `${hPct}%` }} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StandingsTable({ rows }: { rows: SoccerGameDetail["standings"] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <p className="border-b border-white/[0.07] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
        Standings
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[12px]">
          <thead>
            <tr className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Club</th>
              <th className="numeral px-1.5 py-2 text-right font-medium">GP</th>
              <th className="numeral px-1.5 py-2 text-right font-medium">W</th>
              <th className="numeral px-1.5 py-2 text-right font-medium">D</th>
              <th className="numeral px-1.5 py-2 text-right font-medium">L</th>
              <th className="numeral px-1.5 py-2 text-right font-medium">GD</th>
              <th className="numeral px-3 py-2 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.teamId || r.abbrev}
                className={cn(
                  "border-t border-white/[0.05]",
                  r.highlight && "bg-accent/10",
                )}
              >
                <td className="numeral px-3 py-1.5 text-[#8b93a7]">{r.rank}</td>
                <td className={cn("px-2 py-1.5", r.highlight ? "font-semibold text-cream" : "text-white")}>
                  {r.abbrev}
                </td>
                <td className="numeral px-1.5 py-1.5 text-right text-white/85">{r.gp}</td>
                <td className="numeral px-1.5 py-1.5 text-right text-white/85">{r.w}</td>
                <td className="numeral px-1.5 py-1.5 text-right text-white/85">{r.d}</td>
                <td className="numeral px-1.5 py-1.5 text-right text-white/85">{r.l}</td>
                <td className="numeral px-1.5 py-1.5 text-right text-white/85">{r.gd}</td>
                <td className="numeral px-3 py-1.5 text-right font-semibold text-white">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeadToHead({ rows }: { rows: SoccerGameDetail["headToHead"] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.1] bg-[#0a1424]">
      <p className="border-b border-white/[0.07] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
        Head-to-head
      </p>
      <ul className="divide-y divide-white/[0.06]">
        {rows.map((r, i) => (
          <li key={`${r.date}-${r.label}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] text-cream">
                {r.label}{" "}
                <span className="numeral font-semibold text-white">{r.score}</span>
              </p>
              {r.competition ? (
                <p className="mt-0.5 truncate text-[11px] text-[#8b93a7]">{r.competition}</p>
              ) : null}
            </div>
            <p className="text-[11px] text-[#8b93a7]">{r.date}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
