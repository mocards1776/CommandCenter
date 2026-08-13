import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Sprout } from "lucide-react";
import TeamMark from "@/components/sports/TeamMark";
import {
  fetchCardinalsFarmAffiliates,
  fetchCardinalsProspectWatch,
  fetchFarmRoster,
  mlbClubSlug,
  mlbHeadshot,
} from "@/lib/mlb";
import { fetchPlayersWithTag } from "@/lib/sports-player-tags";
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
            <img
              src={mlbHeadshot(p.id, 213)}
              alt=""
              className="h-8 w-8 rounded-full bg-black/30 object-cover"
              loading="lazy"
            />
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
  const watch = useQuery({
    queryKey: ["cardinals-prospect-watch-v1"],
    queryFn: fetchCardinalsProspectWatch,
    staleTime: 600_000,
  });
  const affiliates = useQuery({
    queryKey: ["cardinals-farm-affiliates"],
    queryFn: fetchCardinalsFarmAffiliates,
    staleTime: 600_000,
  });
  const tagged = useQuery({
    queryKey: ["sports-player-tags-by-tag", user?.id, "Prospect"],
    queryFn: () => fetchPlayersWithTag("Prospect"),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const pipelineUrl = `https://www.mlb.com/${mlbClubSlug(138) ?? "cardinals"}/prospects`;

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
          Follow the top of the Cardinals farm with a Pipeline-oriented watch list, your tagged
          #Prospect players, and live MiLB affiliate rosters. Rankings update as names resolve from
          the Stats API — open{" "}
          <a
            href={pipelineUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent inline-flex items-center gap-1 hover:underline"
          >
            MLB Pipeline <ExternalLink size={11} />
          </a>{" "}
          for scouting reports.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="rule-head">Watch list</h2>
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
                  className={cn(
                    "bg-panel flex items-center gap-3 rounded-xl border border-white/[0.08] p-3",
                    !p.playerId && "opacity-70",
                  )}
                >
                  <span className="numeral text-accent w-7 text-center text-[18px]">{p.rank}</span>
                  {p.playerId ? (
                    <img
                      src={mlbHeadshot(p.playerId, 213)}
                      alt=""
                      className="h-12 w-12 rounded-full bg-black/30 object-cover"
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
                      {p.level ? ` · ${p.level}` : ""}
                      {p.teamName ? ` · ${p.teamName}` : ""}
                      {p.pipelineNote ? ` · ${p.pipelineNote}` : ""}
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
          <h2 className="rule-head">Your #Prospect tags</h2>
          {tagged.isPending ? (
            <p className="text-chalk-dim text-[12px]">Loading…</p>
          ) : (tagged.data?.length ?? 0) === 0 ? (
            <p className="text-chalk text-[13px]">
              Tag players with #Prospect on their player page to build a personal follow list.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tagged.data?.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/sports/mlb/player/${t.playerId}`}
                    className="bg-panel hover:border-accent/40 flex items-center gap-3 rounded-xl border border-white/[0.08] p-3"
                  >
                    <img
                      src={mlbHeadshot(t.playerId, 213)}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <span className="text-cream text-[14px]">Player #{t.playerId}</span>
                    <span className="text-accent ml-auto text-[12px]">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
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
                  <h3 className="text-cream text-[18px] font-semibold">{a.name}</h3>
                </div>
                <TeamMark teamId={138} size="xs" />
              </div>
              <AffiliateRoster teamId={a.teamId} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
