import { Link, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Sprout } from "lucide-react";
import TeamMark from "@/components/sports/TeamMark";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import {
  fetchCardinalsFarmAffiliates,
  fetchCardinalsProspectWatch,
  fetchFarmRoster,
  fetchFavoritePlayersYesterday,
  fetchMlbPeopleByIds,
  fetchMlbTop100Prospects,
  mlbClubSlug,
  mlbHeadshot,
  teamPagePath,
} from "@/lib/mlb";
import {
  displayPlayerTag,
  fetchPlayersWithTag,
  fetchUserTagNames,
} from "@/lib/sports-player-tags";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function AffiliateRoster({ teamId }: { teamId: number }) {
  const roster = useQuery({
    queryKey: ["farm-roster", teamId],
    queryFn: () => fetchFarmRoster(teamId),
    staleTime: 300_000,
  });
  if (roster.isPending) {
    return (
      <p className="text-chalk-dim flex items-center gap-2 text-[12px]">
        <Loader2 size={12} className="animate-spin" /> Loading roster…
      </p>
    );
  }
  if (!roster.data?.length) {
    return <p className="text-chalk-dim text-[12px]">No active roster listed.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {roster.data.map((p) => (
        <li key={p.id}>
          <Link
            to={`/sports/mlb/player/${p.id}`}
            className="hover:bg-white/[0.04] flex items-center gap-2 rounded-sm px-2 py-1.5"
          >
            <PlayerHeadshot playerId={p.id} className="h-8 w-8 rounded-full" />
            <span className="text-cream min-w-0 flex-1 truncate text-[13px]">{p.name}</span>
            <span className="text-chalk-dim text-[11px] tabular-nums">
              {p.position ?? "—"}
              {p.number ? ` · #${p.number}` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CardinalsProspectsPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const focusTag = params.get("tag") || "Prospect";

  const watch = useQuery({
    queryKey: ["cardinals-prospect-watch-v3"],
    queryFn: fetchCardinalsProspectWatch,
    staleTime: 600_000,
  });
  const top100 = useQuery({
    queryKey: ["mlb-top100-prospects"],
    queryFn: () => fetchMlbTop100Prospects(100),
    staleTime: 600_000,
  });
  const affiliates = useQuery({
    queryKey: ["cardinals-farm-affiliates"],
    queryFn: fetchCardinalsFarmAffiliates,
    staleTime: 600_000,
  });
  const tagged = useQuery({
    queryKey: ["sports-player-tags-by-tag", user?.id, focusTag],
    queryFn: () => fetchPlayersWithTag(focusTag),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const tagNames = useQuery({
    queryKey: ["sports-player-tags-names", user?.id],
    queryFn: fetchUserTagNames,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const people = useQuery({
    queryKey: ["mlb-people-by-ids", (tagged.data ?? []).map((t) => t.playerId).join(",")],
    queryFn: () => fetchMlbPeopleByIds((tagged.data ?? []).map((t) => t.playerId)),
    enabled: Boolean(tagged.data?.length),
    staleTime: 300_000,
  });

  const yesterdayInputs = useMemo(() => {
    return (tagged.data ?? []).map((t) => {
      const id = Number(t.playerId);
      const person = people.data?.get(id);
      return {
        playerId: String(t.playerId),
        playerName: person?.name ?? `Player #${t.playerId}`,
        teamName: person?.teamName ?? null,
        position: person?.position ?? null,
      };
    });
  }, [tagged.data, people.data]);

  const yesterday = useQuery({
    queryKey: [
      "prospect-players-yesterday",
      user?.id,
      yesterdayInputs.map((p) => p.playerId).join(","),
    ],
    queryFn: () => fetchFavoritePlayersYesterday(yesterdayInputs),
    enabled: yesterdayInputs.length > 0 && Boolean(people.data),
    staleTime: 120_000,
  });

  const pipelineUrl = `https://www.mlb.com/${mlbClubSlug(138) ?? "cardinals"}/prospects`;
  const otherTags = useMemo(
    () => (tagNames.data ?? []).filter((t) => t.toLowerCase() !== focusTag.toLowerCase()),
    [tagNames.data, focusTag],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-7">
      <header>
        <div className="mb-2 flex items-center gap-2">
          <TeamMark teamId={138} size="sm" />
          <p className="label-caps text-accent">St. Louis Cardinals</p>
        </div>
        <h1 className="font-display text-cream flex items-center gap-2 text-[28px] leading-tight md:text-[34px]">
          <Sprout size={28} className="text-accent" />
          Prospects
        </h1>
        <p className="text-chalk mt-2 max-w-xl text-[14px] leading-relaxed">
          Follow the Cardinals org Pipeline, the MLB Top 100, your tagged players, and live MiLB
          affiliate rosters. Open{" "}
          <a
            href={pipelineUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent inline-flex items-center gap-1 hover:underline"
          >
            MLB Pipeline <ExternalLink size={11} />
          </a>{" "}
          for full scouting grades.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="rule-head">Cardinals org rankings</h2>
          <p className="text-[11px] text-[#8b93a7]">Org # · Top 100 when listed</p>
        </div>
        {watch.isPending ? (
          <p className="text-chalk flex items-center gap-2 text-[13px]">
            <Loader2 size={14} className="animate-spin" /> Loading prospects…
          </p>
        ) : watch.isError ? (
          <p className="text-alert text-[13px]">
            {watch.error instanceof Error ? watch.error.message : "Couldn't load watch list"}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {watch.data?.map((p) => (
              <li key={`${p.rank}-${p.name}`}>
                <div
                  className={
                    "bg-panel flex items-center gap-3 rounded-xl border border-white/[0.08] p-3" +
                    (!p.playerId ? " opacity-70" : "")
                  }
                >
                  <span className="numeral text-accent w-7 text-center text-[18px]">{p.rank}</span>
                  {p.playerId ? (
                    <PlayerHeadshot
                      playerId={p.playerId}
                      className="h-12 w-12 rounded-full"
                    />
                  ) : (
                    <div className="bg-hero text-chalk-dim grid h-12 w-12 place-items-center rounded-full text-[10px]">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {p.playerId ? (
                      <Link
                        to={`/sports/mlb/player/${p.playerId}`}
                        className="text-cream hover:text-accent text-[16px] font-medium"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      <p className="text-cream text-[16px] font-medium">{p.name}</p>
                    )}
                    <p className="text-chalk-dim text-[11px] uppercase tracking-[0.12em]">
                      {p.position}
                      {p.teamId && p.teamName ? (
                        <>
                          {" · "}
                          <Link
                            to={teamPagePath(p.teamId)}
                            className="text-accent hover:underline"
                          >
                            {p.teamName}
                          </Link>
                        </>
                      ) : p.teamName ? (
                        <>
                          {" · "}
                          <span className="text-accent">{p.teamName}</span>
                        </>
                      ) : null}
                      {p.pipelineNote ? ` · ${p.pipelineNote}` : ""}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="rule-head">MLB Top Prospects</h2>
          <a
            href="https://www.mlb.com/prospects/top100"
            target="_blank"
            rel="noreferrer"
            className="text-accent inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] hover:underline"
          >
            Pipeline Top 100 <ExternalLink size={11} />
          </a>
        </div>
        {top100.isPending ? (
          <p className="text-chalk flex items-center gap-2 text-[13px]">
            <Loader2 size={14} className="animate-spin" /> Loading Top 100…
          </p>
        ) : top100.isError ? (
          <p className="text-alert text-[13px]">
            {top100.error instanceof Error ? top100.error.message : "Couldn't load Top 100"}
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {top100.data?.map((p) => (
              <li key={`top100-${p.rank}-${p.playerId ?? p.name}`}>
                <div className="bg-panel flex items-center gap-3 rounded-xl border border-white/[0.08] p-3">
                  <span className="numeral text-accent w-7 text-center text-[18px]">{p.rank}</span>
                  {p.playerId ? (
                    <PlayerHeadshot playerId={p.playerId} className="h-12 w-12 rounded-full" />
                  ) : (
                    <div className="bg-hero text-chalk-dim grid h-12 w-12 place-items-center rounded-full text-[10px]">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {p.playerId ? (
                      <Link
                        to={`/sports/mlb/player/${p.playerId}`}
                        className="text-cream hover:text-accent text-[16px] font-medium"
                      >
                        {p.name}
                      </Link>
                    ) : (
                      <p className="text-cream text-[16px] font-medium">{p.name}</p>
                    )}
                    <p className="text-chalk-dim text-[11px] uppercase tracking-[0.12em]">
                      {p.position}
                      {p.teamId && p.teamName ? (
                        <>
                          {" · "}
                          <Link
                            to={teamPagePath(p.teamId)}
                            className="text-accent hover:underline"
                          >
                            {p.teamName}
                          </Link>
                        </>
                      ) : p.teamName ? (
                        <>
                          {" · "}
                          <span className="text-accent">{p.teamName}</span>
                        </>
                      ) : null}
                      {p.level ? ` · ${p.level}` : ""}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {user ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="rule-head">Your {displayPlayerTag(focusTag)} tags</h2>
            {otherTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {otherTags.slice(0, 6).map((t) => (
                  <Link
                    key={t}
                    to={`/sports/mlb/tags/${encodeURIComponent(t)}`}
                    className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 hover:text-white"
                  >
                    {displayPlayerTag(t)}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {tagged.isPending ? (
            <p className="text-chalk-dim text-[12px]">Loading…</p>
          ) : (tagged.data?.length ?? 0) === 0 ? (
            <p className="text-chalk text-[13px]">
              Tag players with {displayPlayerTag(focusTag)} on their player page to build a personal
              follow list.
            </p>
          ) : (
            <>
              {yesterday.data && yesterday.data.lines.length > 0 ? (
                <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                      Yesterday
                    </h3>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                      {yesterday.data.date}
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {yesterday.data.lines.map((line) => (
                      <li key={line.playerId}>
                        <Link
                          to={`/sports/mlb/player/${line.playerId}`}
                          className="flex items-start gap-3 rounded-lg border border-white/[0.05] px-2 py-2 transition hover:bg-white/[0.03]"
                        >
                          <img
                            src={mlbHeadshot(line.playerId, 213)}
                            alt=""
                            className="h-12 w-10 shrink-0 rounded-md bg-[#dfe6f2] object-cover object-[center_15%]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <p className="text-cream text-[14px] font-semibold">
                                {line.playerName}
                              </p>
                              {line.played && line.isWin != null && (
                                <span
                                  className={cn(
                                    "text-[10px] font-bold uppercase tracking-[0.12em]",
                                    line.isWin ? "text-emerald-300" : "text-alert",
                                  )}
                                >
                                  {line.isWin ? "W" : "L"}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[12px] text-[#a8b0c2]">
                              {line.played
                                ? `${line.isHome ? "vs" : "@"} ${line.opponent}`
                                : "No game / DNP"}
                            </p>
                            <p className="numeral text-cream mt-1 text-[13px] leading-snug">
                              {line.played ? line.summary || "—" : "Did not play"}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex gap-3 overflow-x-auto pb-1">
                {tagged.data?.map((t) => {
                  const id = Number(t.playerId);
                  const person = people.data?.get(id);
                  const name = person?.name ?? `Player #${t.playerId}`;
                  const last = name.split(" ").slice(-1)[0] ?? name;
                  return (
                    <Link
                      key={t.id}
                      to={`/sports/mlb/player/${t.playerId}`}
                      className="bg-panel group relative w-[148px] shrink-0 overflow-hidden rounded-lg border border-white/[0.08] transition hover:border-accent/40"
                    >
                      <div className="from-accent-dark/80 absolute inset-0 bg-gradient-to-t to-transparent opacity-80" />
                      <PlayerHeadshot
                        playerId={t.playerId}
                        size={213}
                        className="aspect-[3/4] w-full object-cover object-top"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-2.5">
                        <p className="font-display text-cream text-[15px] leading-tight drop-shadow">
                          {last}
                        </p>
                        <p className="text-chalk-dim mt-0.5 text-[10px] uppercase tracking-[0.12em]">
                          {[person?.position, person?.number ? `#${person.number}` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                          {person?.teamName ? ` · ${person.teamName}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="rule-head">Farm system</h2>
        {affiliates.isPending ? (
          <p className="text-chalk flex items-center gap-2 text-[13px]">
            <Loader2 size={14} className="animate-spin" /> Loading affiliates…
          </p>
        ) : (
          affiliates.data?.map((a) => (
            <div
              key={a.teamId}
              className="bg-panel rounded-xl border border-white/[0.08] p-4"
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {a.level}
                  </p>
                  <Link
                    to={teamPagePath(a.teamId)}
                    className="text-cream hover:text-accent text-[18px] font-semibold hover:underline"
                  >
                    {a.name}
                  </Link>
                </div>
                <Link to={teamPagePath(a.teamId)} aria-label={`Open ${a.name}`}>
                  <TeamMark teamId={138} size="xs" />
                </Link>
              </div>
              <AffiliateRoster teamId={a.teamId} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
