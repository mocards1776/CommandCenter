import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Tags } from "lucide-react";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import {
  displayPlayerTag,
  fetchPlayersWithTag,
  normalizeTag,
} from "@/lib/sports-player-tags";
import { fetchMlbPeopleByIds, teamPagePath } from "@/lib/mlb";
import { useAuth } from "@/lib/auth-context";

export default function TagPlayersPage() {
  const { tag: rawTag } = useParams<{ tag: string }>();
  const tag = normalizeTag(decodeURIComponent(rawTag ?? ""));
  const { user } = useAuth();

  const tagged = useQuery({
    queryKey: ["sports-player-tags-by-tag", user?.id, tag],
    queryFn: () => fetchPlayersWithTag(tag),
    enabled: Boolean(user?.id && tag),
    staleTime: 60_000,
  });

  const people = useQuery({
    queryKey: ["mlb-people-by-ids", (tagged.data ?? []).map((t) => t.playerId).join(",")],
    queryFn: () => fetchMlbPeopleByIds((tagged.data ?? []).map((t) => t.playerId)),
    enabled: Boolean(tagged.data?.length),
    staleTime: 300_000,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-7">
      <div>
        <Link
          to="/sports/mlb/prospects"
          className="text-chalk hover:text-cream mb-3 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Prospects
        </Link>
        <h1 className="font-display text-cream flex items-center gap-2 text-[28px] leading-tight">
          <Tags size={24} className="text-accent" />
          {displayPlayerTag(tag) || "Tag"}
        </h1>
        <p className="text-chalk mt-2 text-[14px]">Players you’ve labeled with this tag.</p>
      </div>

      {!user ? (
        <p className="text-chalk text-[13px]">Sign in to view tagged players.</p>
      ) : tagged.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : (tagged.data?.length ?? 0) === 0 ? (
        <p className="text-chalk text-[13px]">No players with this tag yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tagged.data?.map((t) => {
            const id = Number(t.playerId);
            const person = people.data?.get(id);
            return (
              <li key={t.id}>
                <div className="bg-panel flex items-center gap-3 rounded-xl border border-white/[0.08] p-3">
                  <PlayerHeadshot
                    playerId={t.playerId}
                    className="h-12 w-12 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/sports/mlb/player/${t.playerId}`}
                      className="text-cream hover:text-accent truncate text-[15px] font-medium"
                    >
                      {person?.name ?? `Player #${t.playerId}`}
                    </Link>
                    <p className="text-chalk-dim text-[11px] uppercase tracking-[0.12em]">
                      {[person?.position, person?.number ? `#${person.number}` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                      {person?.teamId ? (
                        <>
                          {" · "}
                          <Link
                            to={teamPagePath(person.teamId)}
                            className="text-accent hover:underline"
                          >
                            {person.teamName ?? "Team"}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
