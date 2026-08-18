import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import TeamMark from "@/components/sports/TeamMark";
import {
  chicagoToday,
  divisionLeaders,
  fetchMlbStandings,
  fetchMlbWildCardStandings,
  fetchTeamCurrentAndNextGames,
  mlbHeadshot,
  playoffOddsFromStandings,
  teamPagePath,
  type MlbScoreGame,
  type MlbStandingRow,
  type MlbWildCardRow,
} from "@/lib/mlb";
import { fetchMlbTeamCategoryLeaders } from "@/lib/team-form";
import { DEFAULT_WEATHER_ZIP, fetchZipWeather, weatherGlyph } from "@/lib/weather";
import { cn } from "@/lib/utils";

const STL_TEAM_ID = 138;

function shortPitcher(name: string | null): string {
  if (!name) return "TBD";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function gameDateLabel(game: MlbScoreGame, fallback: string): string {
  if (game.live) return "Now";
  if (game.final) return "Latest";
  const date = game.officialDate;
  if (!date) return fallback;
  if (date === chicagoToday()) return "Today";
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return fallback;
  }
}

function GameChip({ game, label }: { game: MlbScoreGame; label: string }) {
  const stlHome = game.home.teamId === STL_TEAM_ID;
  const us = stlHome ? game.home : game.away;
  const them = stlHome ? game.away : game.home;
  const vs = stlHome ? "vs" : "@";
  const showProbables =
    !game.live && !game.final && (game.away.probablePitcher || game.home.probablePitcher);
  return (
    <Link
      to={`/sports/mlb/game/${game.id}`}
      className="border-white/[0.08] hover:border-accent/40 block rounded border bg-white/[0.02] px-3 py-2.5 transition-colors"
    >
      <div className="text-chalk-dim mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.14em]">
        <span>{label}</span>
        <span className={cn(game.live && "text-accent")}>
          {game.live ? game.inning || "Live" : game.final ? "Final" : game.whenShort || game.status}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <TeamMark teamId={them.teamId} size="xs" />
        <span className="text-cream min-w-0 flex-1 truncate text-[13px]">
          {vs} {them.abbrev || them.name}
        </span>
        {(game.live || game.final) && (
          <span className="numeral text-cream text-[14px]">
            {us.score ?? 0}–{them.score ?? 0}
          </span>
        )}
      </div>
      {showProbables ? (
        <p className="text-chalk-dim mt-1.5 truncate text-[11px]">
          {shortPitcher(game.away.probablePitcher)} vs {shortPitcher(game.home.probablePitcher)}
        </p>
      ) : null}
    </Link>
  );
}

/** Notes-column extras: games, weather, NL Central + wild card. Scrolls with the page. */
export default function DispatchNotesAside() {
  const standings = useQuery({
    queryKey: ["mlb-standings"],
    queryFn: () => fetchMlbStandings(),
    staleTime: 15 * 60_000,
  });
  const wildCardNl = useQuery({
    queryKey: ["mlb-wildcard-nl-v2"],
    queryFn: () => fetchMlbWildCardStandings(104),
    staleTime: 15 * 60_000,
  });
  const wildCardAl = useQuery({
    queryKey: ["mlb-wildcard-al-v2"],
    queryFn: () => fetchMlbWildCardStandings(103),
    staleTime: 15 * 60_000,
  });
  const games = useQuery({
    queryKey: ["mlb-stl-current-next"],
    queryFn: () => fetchTeamCurrentAndNextGames(STL_TEAM_ID),
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
  const weather = useQuery({
    queryKey: ["weather-zip", DEFAULT_WEATHER_ZIP, 10],
    queryFn: () => fetchZipWeather(DEFAULT_WEATHER_ZIP),
    staleTime: 15 * 60_000,
  });
  const leaders = useQuery({
    queryKey: ["mlb-stl-category-leaders", STL_TEAM_ID],
    queryFn: () => fetchMlbTeamCategoryLeaders(STL_TEAM_ID, "STL"),
    staleTime: 30 * 60_000,
  });

  const central = (standings.data ?? []).find((t) => t.shortName === "NL Central");
  const nlLeaders = standings.data ? divisionLeaders(standings.data, "NL") : [];
  const alLeaders = standings.data ? divisionLeaders(standings.data, "AL") : [];
  const nlWcRows = (wildCardNl.data ?? []).slice(0, 10);
  const alWcRows = (wildCardAl.data ?? []).slice(0, 10);
  const odds = standings.data ? playoffOddsFromStandings(standings.data) : [];
  const stlOdds = odds.find((r) => r.teamId === STL_TEAM_ID);
  const stlPlayoffPct = stlOdds
    ? parseFloat(String(stlOdds.playoffPercent).replace("%", ""))
    : NaN;

  return (
    <div className="hidden lg:block">
      <section className="border-white/[0.08] mt-8 border-t pt-5">
        <div className="rule-head mb-3">Cardinals</div>
        {games.isPending ? (
          <p className="label-caps font-body animate-pulse text-[11px]">Loading games</p>
        ) : games.isError || (!games.data?.current && !games.data?.next) ? (
          <p className="text-chalk font-body text-[12px]">No upcoming games found.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {games.data.current ? (
              <GameChip
                game={games.data.current}
                label={gameDateLabel(games.data.current, "Next")}
              />
            ) : null}
            {games.data.next ? (
              <GameChip game={games.data.next} label={gameDateLabel(games.data.next, "Next")} />
            ) : null}
          </div>
        )}
        {stlOdds && Number.isFinite(stlPlayoffPct) ? (
          <div className="mt-4">
            <p className="text-chalk-dim text-[10px] uppercase tracking-[0.14em]">Playoff odds</p>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <p className="numeral text-cream text-[22px] leading-none">
                {stlOdds.playoffPercent.includes("%")
                  ? stlOdds.playoffPercent
                  : `${stlOdds.playoffPercent}%`}
              </p>
              {stlOdds.wildCardPercent ? (
                <p className="text-chalk-dim text-[11px]">
                  WC{" "}
                  {stlOdds.wildCardPercent.includes("%")
                    ? stlOdds.wildCardPercent
                    : `${stlOdds.wildCardPercent}%`}
                </p>
              ) : null}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="bg-accent h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.max(0, stlPlayoffPct))}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className="border-white/[0.08] mt-6 border-t pt-5">
        <div className="rule-head mb-3">Weather · {DEFAULT_WEATHER_ZIP}</div>
        {weather.isPending ? (
          <p className="label-caps font-body animate-pulse text-[11px]">Loading weather</p>
        ) : weather.isError || !weather.data ? (
          <p className="text-chalk font-body text-[12px]">Couldn’t load weather.</p>
        ) : (
          <div>
            <div className="relative overflow-hidden rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-500/15 via-[#0c1a2e] to-amber-400/10 px-3 py-3">
              <div className="pointer-events-none absolute -right-2 -top-4 text-[64px] leading-none opacity-25">
                {weatherGlyph(weather.data.current.code)}
              </div>
              <div className="relative flex items-end gap-3">
                <span className="text-[36px] leading-none drop-shadow-sm">
                  {weatherGlyph(weather.data.current.code)}
                </span>
                <div className="min-w-0">
                  <p className="text-cream text-[15px] font-medium">
                    <span className="numeral text-[28px] leading-none">
                      {weather.data.current.tempF}°
                    </span>
                    <span className="text-chalk ml-2 text-[13px]">
                      {weather.data.current.summary}
                    </span>
                  </p>
                  <p className="text-chalk-dim mt-1 text-[11px]">
                    {weather.data.label} · Feels {weather.data.current.feelsLikeF}° · Wind{" "}
                    {weather.data.current.windMph} mph · Humidity {weather.data.current.humidity}%
                  </p>
                </div>
              </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {weather.data.daily.slice(0, 10).map((d) => {
                const day = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: weather.data.timezone,
                });
                return (
                  <li
                    key={d.date}
                    className="text-chalk flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="w-4 shrink-0 text-center text-[14px]" title={d.summary}>
                      {weatherGlyph(d.code)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{day}</span>
                    <span className="text-chalk-dim hidden shrink-0 text-[11px] sm:inline">
                      {d.summary}
                    </span>
                    <span className="numeral text-cream shrink-0 tabular-nums">
                      {d.highF}°/{d.lowF}°
                    </span>
                    <span className="text-chalk-dim w-8 shrink-0 text-right text-[11px] tabular-nums">
                      {d.precipChance}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="border-white/[0.08] mt-6 border-t pt-5">
        <div className="rule-head mb-3">Batting leaders</div>
        {leaders.isPending ? (
          <p className="label-caps font-body animate-pulse text-[11px]">Loading leaders</p>
        ) : leaders.isError || !(leaders.data?.batting.length) ? (
          <p className="text-chalk font-body text-[12px]">Couldn’t load batting leaders.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {leaders.data.batting.map((l) => (
              <li key={`bat-${l.category}-${l.playerId}`} className="py-2.5 first:pt-0">
                <Link
                  to={`/sports/mlb/player/${l.playerId}`}
                  className="flex items-center gap-3 hover:opacity-90"
                >
                  <img
                    src={mlbHeadshot(l.playerId, 213)}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full bg-[#0c1a2e] object-cover object-top ring-1 ring-white/15"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-cream truncate text-[13px] font-semibold">{l.shortName}</p>
                    <p className="mt-0.5">
                      <span className="numeral text-cream text-[18px] font-bold leading-none">
                        {l.value}
                      </span>{" "}
                      <span className="text-chalk-dim text-[11px] uppercase tracking-[0.12em]">
                        {l.abbrev}
                      </span>
                    </p>
                    <p className="text-chalk-dim mt-0.5 truncate text-[11px]">{l.line}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-white/[0.08] mt-6 border-t pt-5">
        <div className="rule-head mb-3">Pitching leaders</div>
        {leaders.isPending ? (
          <p className="label-caps font-body animate-pulse text-[11px]">Loading leaders</p>
        ) : leaders.isError || !(leaders.data?.pitching.length) ? (
          <p className="text-chalk font-body text-[12px]">Couldn’t load pitching leaders.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {leaders.data.pitching.map((l) => (
              <li key={`pit-${l.category}-${l.playerId}`} className="py-2.5 first:pt-0">
                <Link
                  to={`/sports/mlb/player/${l.playerId}`}
                  className="flex items-center gap-3 hover:opacity-90"
                >
                  <img
                    src={mlbHeadshot(l.playerId, 213)}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full bg-[#0c1a2e] object-cover object-top ring-1 ring-white/15"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-cream truncate text-[13px] font-semibold">{l.shortName}</p>
                    <p className="mt-0.5">
                      <span className="numeral text-cream text-[18px] font-bold leading-none">
                        {l.value}
                      </span>{" "}
                      <span className="text-chalk-dim text-[11px] uppercase tracking-[0.12em]">
                        {l.abbrev}
                      </span>
                    </p>
                    <p className="text-chalk-dim mt-0.5 truncate text-[11px]">{l.line}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-white/[0.08] mt-6 border-t pt-5">
        <div className="rule-head mb-3">NL Central</div>
        {standings.isPending ? (
          <p className="label-caps font-body animate-pulse text-[11px]">Loading standings</p>
        ) : standings.isError || !central ? (
          <p className="text-chalk font-body text-[12px]">Couldn’t load standings.</p>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
              <tr>
                <th className="pb-2 pr-1 font-medium">Team</th>
                <th className="numeral px-1 pb-2 font-medium">W</th>
                <th className="numeral px-1 pb-2 font-medium">L</th>
                <th className="numeral px-1 pb-2 font-medium">GB</th>
              </tr>
            </thead>
            <tbody>
              {central.rows.map((r) => {
                const isStl = r.teamId === STL_TEAM_ID;
                return (
                  <tr
                    key={r.teamId || r.team}
                    className={cn("border-t border-white/[0.05]", isStl && "bg-accent/10")}
                  >
                    <td className="py-1.5 pr-1">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="text-chalk-dim numeral w-3 shrink-0 text-[11px]">
                          {r.rank}
                        </span>
                        {r.teamId ? <TeamMark teamId={r.teamId} size="xs" /> : null}
                        <Link
                          to={teamPagePath(r.teamId)}
                          className={cn(
                            "truncate hover:underline",
                            isStl ? "text-cream font-semibold" : "text-cream/90 hover:text-accent",
                          )}
                        >
                          {r.abbrev || r.team}
                        </Link>
                      </span>
                    </td>
                    <td className="numeral text-cream px-1 py-1.5">{r.wins}</td>
                    <td className="numeral text-chalk px-1 py-1.5">{r.losses}</td>
                    <td className="numeral text-chalk px-1 py-1.5">{r.gb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <LeadersBoard title="NL Leaders" rows={nlLeaders} pending={standings.isPending} errored={standings.isError} />
      <LeadersBoard title="AL Leaders" rows={alLeaders} pending={standings.isPending} errored={standings.isError} />

      <WildCardBoard title="NL Wild Card" rows={nlWcRows} pending={wildCardNl.isPending} errored={wildCardNl.isError} />
      <WildCardBoard title="AL Wild Card" rows={alWcRows} pending={wildCardAl.isPending} errored={wildCardAl.isError} />
    </div>
  );
}

type MlbLeaderRow = MlbStandingRow & { divisionLetter: string };

/** One row per division (E/C/W) showing that division's current leader. */
function LeadersBoard({
  title,
  rows,
  pending,
  errored,
}: {
  title: string;
  rows: MlbLeaderRow[];
  pending: boolean;
  errored: boolean;
}) {
  return (
    <section className="border-white/[0.08] mt-6 border-t pt-5">
      <div className="rule-head mb-3">{title}</div>
      {pending ? (
        <p className="label-caps font-body animate-pulse text-[11px]">Loading leaders</p>
      ) : errored || !rows.length ? (
        <p className="text-chalk font-body text-[12px]">Couldn’t load leaders.</p>
      ) : (
        <table className="w-full text-left text-[12px]">
          <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
            <tr>
              <th className="pb-2 pr-1 font-medium">Team</th>
              <th className="numeral px-1 pb-2 font-medium">W</th>
              <th className="numeral px-1 pb-2 font-medium">L</th>
              <th className="numeral px-1 pb-2 font-medium">PCT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isStl = r.teamId === STL_TEAM_ID;
              return (
                <tr
                  key={`${r.teamId || r.team}-${r.divisionLetter}`}
                  className={cn("border-t border-white/[0.05]", isStl && "bg-accent/10")}
                >
                  <td className="py-1.5 pr-1">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      {r.teamId ? <TeamMark teamId={r.teamId} size="xs" /> : null}
                      <Link
                        to={teamPagePath(r.teamId)}
                        className={cn(
                          "truncate hover:underline",
                          isStl ? "text-cream font-semibold" : "text-cream/90 hover:text-accent",
                        )}
                      >
                        {r.abbrev || r.team} - {r.divisionLetter}
                      </Link>
                    </span>
                  </td>
                  <td className="numeral text-cream px-1 py-1.5">{r.wins}</td>
                  <td className="numeral text-chalk px-1 py-1.5">{r.losses}</td>
                  <td className="numeral text-chalk px-1 py-1.5">
                    {r.pct ? (r.pct.startsWith(".") ? r.pct : r.pct.replace(/^0/, "")) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function WildCardBoard({
  title,
  rows,
  pending,
  errored,
}: {
  title: string;
  rows: MlbWildCardRow[];
  pending: boolean;
  errored: boolean;
}) {
  return (
    <section className="border-white/[0.08] mt-6 border-t pt-5">
      <div className="rule-head mb-3">{title}</div>
      {pending ? (
        <p className="label-caps font-body animate-pulse text-[11px]">Loading wild card</p>
      ) : errored || !rows.length ? (
        <p className="text-chalk font-body text-[12px]">Couldn’t load wild card.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[11px]">
            <thead className="text-chalk-dim text-[9px] uppercase tracking-[0.12em]">
              <tr>
                <th className="pb-2 pr-1 font-medium">Team</th>
                <th className="numeral px-1 pb-2 font-medium">W</th>
                <th className="numeral px-1 pb-2 font-medium">L</th>
                <th className="numeral px-1 pb-2 font-medium">PCT</th>
                <th className="numeral px-1 pb-2 font-medium">WCGB</th>
                <th className="numeral px-1 pb-2 font-medium">L10</th>
                <th className="numeral px-1 pb-2 font-medium">STRK</th>
                <th className="numeral px-1 pb-2 font-medium">DIFF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isStl = r.teamId === STL_TEAM_ID;
                const clinchedSpot = Number(r.rank) <= 3;
                const showCut = i === 3;
                return (
                  <Fragment key={r.teamId || r.team}>
                    {showCut ? (
                      <tr aria-hidden>
                        <td colSpan={8} className="py-1">
                          <div className="border-t border-dashed border-white/25" />
                        </td>
                      </tr>
                    ) : null}
                    <tr
                      className={cn(
                        "border-t border-white/[0.05]",
                        isStl && "bg-accent/10",
                        i % 2 === 1 && !isStl && "bg-white/[0.02]",
                      )}
                    >
                      <td className="py-1.5 pr-1">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <span
                            className={cn(
                              "numeral w-3 shrink-0 text-[10px]",
                              clinchedSpot ? "text-turf" : "text-chalk-dim",
                            )}
                          >
                            {r.rank}
                          </span>
                          {r.teamId ? <TeamMark teamId={r.teamId} size="xs" /> : null}
                          <Link
                            to={teamPagePath(r.teamId)}
                            className={cn(
                              "truncate hover:underline",
                              isStl ? "text-cream font-semibold" : "text-cream/90 hover:text-accent",
                            )}
                          >
                            {r.abbrev || r.team}
                          </Link>
                        </span>
                      </td>
                      <td className="numeral text-cream px-1 py-1.5">{r.wins}</td>
                      <td className="numeral text-chalk px-1 py-1.5">{r.losses}</td>
                      <td className="numeral text-chalk px-1 py-1.5">
                        {r.pct ? (r.pct.startsWith(".") ? r.pct : r.pct.replace(/^0/, "")) : "—"}
                      </td>
                      <td className="numeral text-chalk px-1 py-1.5">{r.wcgb}</td>
                      <td className="numeral text-chalk px-1 py-1.5">{r.l10}</td>
                      <td className="numeral text-chalk px-1 py-1.5">{r.streak}</td>
                      <td
                        className={cn(
                          "numeral px-1 py-1.5",
                          r.runDiff > 0
                            ? "text-emerald-400"
                            : r.runDiff < 0
                              ? "text-alert"
                              : "text-chalk",
                        )}
                      >
                        {r.runDiff > 0 ? `+${r.runDiff}` : r.runDiff}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
