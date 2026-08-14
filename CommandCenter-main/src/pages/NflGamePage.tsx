import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import NflFieldMap from "@/components/sports/NflFieldMap";
import { NflTeamFormPair } from "@/components/sports/TeamFormPair";
import { fetchNflGameDetail } from "@/lib/nfl";
import { cn } from "@/lib/utils";

export function NflGameDetailView({ eventId }: { eventId: string }) {
  const detail = useQuery({
    queryKey: ["nfl-game", eventId],
    queryFn: () => fetchNflGameDetail(eventId),
    enabled: Boolean(eventId),
    refetchInterval: (q) => (q.state.data?.live ? 12_000 : false),
    staleTime: 8_000,
  });

  const g = detail.data;

  const homeYardLine = useMemo(() => {
    if (!g) return null;
    if (g.situation?.yardLine != null) return g.situation.yardLine;
    const play = g.recentPlays[0];
    if (play?.yardLine != null) return play.yardLine;
    return null;
  }, [g]);

  const teamStatLabels = useMemo(() => {
    const labels: string[] = [];
    const seen = new Set<string>();
    for (const s of g?.teamStats ?? []) {
      if (seen.has(s.label)) continue;
      seen.add(s.label);
      labels.push(s.label);
    }
    return labels.slice(0, 16);
  }, [g?.teamStats]);

  if (detail.isPending) {
    return (
      <p className="text-chalk flex items-center gap-2 text-[13px]">
        <Loader2 size={14} className="animate-spin" /> Loading game…
      </p>
    );
  }
  if (detail.isError || !g) {
    return <p className="text-alert text-[13px]">Couldn’t load this NFL game.</p>;
  }

  const recapUrl = `https://www.espn.com/nfl/recap/_/gameId/${eventId}`;
  const boxUrl = `https://www.espn.com/nfl/boxscore/_/gameId/${eventId}`;

  return (
    <div className="space-y-5">
      <header className="bg-panel overflow-hidden rounded-2xl border border-white/[0.1]">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.16em]",
              g.live ? "text-alert" : "text-chalk-dim",
            )}
          >
            {g.live ? "Live" : g.final ? "Final" : "Scheduled"} · {g.shortDetail}
          </p>
          {g.venue && <p className="text-chalk-dim truncate text-[11px]">{g.venue}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4 p-5">
          {[g.away, g.home].map((side) => (
            <Link
              key={side.teamId}
              to={`/sports/nfl/team/${side.teamId}`}
              className="flex items-center gap-3 hover:opacity-90"
            >
              {side.logo && <img src={side.logo} alt="" className="h-12 w-12 object-contain" />}
              <div className="min-w-0">
                <p className="text-cream truncate text-[16px] font-semibold">{side.name}</p>
                <p className="text-chalk-dim text-[11px]">{side.record ?? side.abbrev}</p>
              </div>
              <span className="numeral text-cream ml-auto text-[36px] leading-none">
                {side.score ?? "—"}
              </span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-white/[0.06] px-4 py-2.5">
          <a
            href={recapUrl}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]"
          >
            ESPN recap <ExternalLink size={11} />
          </a>
          <a
            href={boxUrl}
            target="_blank"
            rel="noreferrer"
            className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em]"
          >
            ESPN boxscore <ExternalLink size={11} />
          </a>
        </div>
      </header>

      <NflTeamFormPair
        awayId={g.away.teamId}
        homeId={g.home.teamId}
        awayAbbrev={g.away.abbrev}
        homeAbbrev={g.home.abbrev}
      />

      {g.article?.storyHtml || g.article?.description ? (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08] font-rss">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              {g.final ? "Game wrap" : "Preview"}
            </p>
            <h2 className="font-rss mt-1 text-[20px] font-semibold leading-snug text-cream">
              {g.article.headline}
            </h2>
            {g.article.description ? (
              <p className="text-chalk mt-2 text-[13px] leading-relaxed">
                {g.article.description.replace(/^—\s*/, "")}
              </p>
            ) : null}
          </div>
          {g.article.storyHtml ? (
            <SelectableHighlightRegion
              articleUrl={recapUrl}
              articleTitle={g.article.headline}
              feedUrl="synthetic:nfl-wraps"
              html={g.article.storyHtml}
              className="rss-reader px-4 py-4 text-[15px] leading-[1.75] text-[#d5dae6] [&_a]:font-medium [&_a]:text-[#9ec1ff] [&_p]:my-3.5 [&_mark.rss-hl]:bg-accent/35 [&_mark.rss-hl]:text-cream"
            />
          ) : null}
        </section>
      ) : null}

      {(g.live || g.situation || homeYardLine != null) && (
        <NflFieldMap
          game={g}
          homeYardLine={homeYardLine}
          possessionTeamId={g.situation?.possessionTeamId ?? null}
          downDistanceText={g.situation?.downDistanceText}
        />
      )}

      {teamStatLabels.length > 0 && (
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              Team stats
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                  <th className="px-3 py-2 font-medium">Stat</th>
                  <th className="numeral px-2 py-2 text-right font-medium">{g.away.abbrev}</th>
                  <th className="numeral px-3 py-2 text-right font-medium">{g.home.abbrev}</th>
                </tr>
              </thead>
              <tbody>
                {teamStatLabels.map((label) => {
                  const away =
                    g.teamStats.find(
                      (s) => s.label === label && s.teamAbbrev === g.away.abbrev,
                    )?.value ?? "—";
                  const home =
                    g.teamStats.find(
                      (s) => s.label === label && s.teamAbbrev === g.home.abbrev,
                    )?.value ?? "—";
                  return (
                    <tr key={label} className="border-t border-white/[0.05]">
                      <td className="px-3 py-1.5 text-[#c8cdd8]">{label}</td>
                      <td className="numeral px-2 py-1.5 text-right text-white">{away}</td>
                      <td className="numeral px-3 py-1.5 text-right text-white">{home}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {g.boxGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Box score
          </h2>
          {g.boxGroups.map((group) => (
            <div
              key={`${group.teamAbbrev}-${group.name}`}
              className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]"
            >
              <div className="border-b border-white/[0.06] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  {group.teamAbbrev} · {group.name}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                      <th className="px-3 py-2 font-medium">Player</th>
                      {group.labels.map((lab) => (
                        <th key={lab} className="numeral px-1.5 py-2 font-medium">
                          {lab}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.athletes.map((a, i) => (
                      <tr
                        key={`${group.name}-${a.id}`}
                        className={cn(
                          "border-t border-white/[0.05]",
                          i % 2 === 1 && "bg-white/[0.02]",
                        )}
                      >
                        <td className="px-3 py-1.5">
                          <Link
                            to={`/sports/nfl/player/${a.id}`}
                            className="text-cream hover:text-accent hover:underline"
                          >
                            {a.name}
                          </Link>
                        </td>
                        {group.labels.map((_, idx) => (
                          <td key={`${a.id}-${idx}`} className="numeral px-1.5 py-1.5 text-white/85">
                            {a.stats[idx] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      {g.scoringPlays.length > 0 && (
        <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
            Scoring
          </h2>
          <ul className="space-y-2">
            {g.scoringPlays.map((s) => (
              <li key={s.id} className="text-[12.5px] leading-snug">
                <span className="text-chalk-dim mr-2 text-[10px] uppercase">
                  {s.teamAbbrev}
                  {s.clock ? ` · ${s.clock}` : ""}
                </span>
                <span className="text-cream">{s.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {g.recentPlays.length > 0 && (
        <section className="bg-panel rounded-xl border border-white/[0.08]">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
              Play-by-play
            </h2>
          </div>
          <ul className="max-h-[28rem] divide-y divide-white/[0.05] overflow-y-auto">
            {g.recentPlays.map((p) => (
              <li key={p.id} className={cn("px-4 py-2.5", p.scoringPlay && "bg-accent/10")}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {p.period != null && (
                    <span className="text-chalk-dim text-[10px] uppercase tracking-[0.12em]">
                      Q{p.period}
                      {p.clock ? ` ${p.clock}` : ""}
                    </span>
                  )}
                  {p.shortDownDistanceText && (
                    <span className="text-[10px] text-emerald-200/70">{p.shortDownDistanceText}</span>
                  )}
                </div>
                <p className="text-cream mt-0.5 text-[13px] leading-snug">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function NflGamePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  if (!eventId) {
    return <p className="text-alert p-6 text-[13px]">Missing game id</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast.success("Game updated")}
            className="text-chalk hover:text-cream rounded-sm border border-white/10 p-2"
            aria-label="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <Link
            to="/sports/nfl?solo=1"
            className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
          >
            Scoreboard
          </Link>
        </div>
      </div>
      <NflGameDetailView eventId={eventId} />
    </div>
  );
}
