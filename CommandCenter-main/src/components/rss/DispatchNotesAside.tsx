import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import TeamMark from "@/components/sports/TeamMark";
import {
  fetchMlbStandings,
  fetchMlbWildCardStandings,
  fetchTeamCurrentAndNextGames,
  teamPagePath,
  type MlbScoreGame,
} from "@/lib/mlb";
import { DEFAULT_WEATHER_ZIP, fetchZipWeather } from "@/lib/weather";
import { cn } from "@/lib/utils";

const STL_TEAM_ID = 138;

function GameChip({ game, label }: { game: MlbScoreGame; label: string }) {
  const stlHome = game.home.teamId === STL_TEAM_ID;
  const us = stlHome ? game.home : game.away;
  const them = stlHome ? game.away : game.home;
  const vs = stlHome ? "vs" : "@";
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
  const wildCard = useQuery({
    queryKey: ["mlb-wildcard-nl"],
    queryFn: () => fetchMlbWildCardStandings(104),
    staleTime: 15 * 60_000,
  });
  const games = useQuery({
    queryKey: ["mlb-stl-current-next"],
    queryFn: () => fetchTeamCurrentAndNextGames(STL_TEAM_ID),
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
  const weather = useQuery({
    queryKey: ["weather-zip", DEFAULT_WEATHER_ZIP],
    queryFn: () => fetchZipWeather(DEFAULT_WEATHER_ZIP),
    staleTime: 15 * 60_000,
  });

  const central = (standings.data ?? []).find((t) => t.shortName === "NL Central");
  const wcRows = (wildCard.data ?? []).slice(0, 8);

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
                label={
                  games.data.current.live
                    ? "Now"
                    : games.data.current.final
                      ? "Latest"
                      : "Today"
                }
              />
            ) : null}
            {games.data.next ? <GameChip game={games.data.next} label="Next" /> : null}
          </div>
        )}
      </section>

      <section className="border-white/[0.08] mt-6 border-t pt-5">
        <div className="rule-head mb-3">Weather · {DEFAULT_WEATHER_ZIP}</div>
        {weather.isPending ? (
          <p className="label-caps font-body animate-pulse text-[11px]">Loading weather</p>
        ) : weather.isError || !weather.data ? (
          <p className="text-chalk font-body text-[12px]">Couldn’t load weather.</p>
        ) : (
          <div>
            <p className="text-cream text-[15px] font-medium">
              <span className="numeral text-[22px]">{weather.data.current.tempF}°</span>
              <span className="text-chalk ml-2 text-[13px]">{weather.data.current.summary}</span>
            </p>
            <p className="text-chalk-dim mt-1 text-[11px]">
              {weather.data.label} · Feels {weather.data.current.feelsLikeF}° · Wind{" "}
              {weather.data.current.windMph} mph · Humidity {weather.data.current.humidity}%
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {weather.data.daily.slice(0, 3).map((d) => {
                const day = new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: weather.data.timezone,
                });
                return (
                  <li
                    key={d.date}
                    className="text-chalk flex items-baseline justify-between gap-2 text-[12px]"
                  >
                    <span className="text-cream/90">{day}</span>
                    <span className="text-chalk-dim truncate">{d.summary}</span>
                    <span className="numeral text-cream shrink-0">
                      {d.highF}°/{d.lowF}°
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
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

      <section className="border-white/[0.08] mt-6 border-t pt-5">
        <div className="rule-head mb-3">NL Wild Card</div>
        {wildCard.isPending ? (
          <p className="label-caps font-body animate-pulse text-[11px]">Loading wild card</p>
        ) : wildCard.isError || !wcRows.length ? (
          <p className="text-chalk font-body text-[12px]">Couldn’t load wild card.</p>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
              <tr>
                <th className="pb-2 pr-1 font-medium">Team</th>
                <th className="numeral px-1 pb-2 font-medium">W</th>
                <th className="numeral px-1 pb-2 font-medium">L</th>
                <th className="numeral px-1 pb-2 font-medium">WCGB</th>
              </tr>
            </thead>
            <tbody>
              {wcRows.map((r) => {
                const isStl = r.teamId === STL_TEAM_ID;
                const clinchedSpot = Number(r.rank) <= 3;
                return (
                  <tr
                    key={r.teamId || r.team}
                    className={cn("border-t border-white/[0.05]", isStl && "bg-accent/10")}
                  >
                    <td className="py-1.5 pr-1">
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "numeral w-3 shrink-0 text-[11px]",
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
                    <td className="numeral text-chalk px-1 py-1.5">{r.wcgb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
