import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, User, Users, Shield, X } from "lucide-react";
import { fetchCfbCoaches } from "@/lib/cfb";
import { fetchMlbManagers } from "@/lib/mlb";
import { fetchNflCoaches } from "@/lib/nfl";
import {
  groupSportsSearchHits,
  searchLocalSports,
  searchRemoteSports,
  type SportsSearchHit,
  type SportsSearchManagerRef,
} from "@/lib/sports-search";
import { cn } from "@/lib/utils";

function HitRow({
  hit,
  onPick,
}: {
  hit: SportsSearchHit;
  onPick: (hit: SportsSearchHit) => void;
}) {
  const Icon = hit.kind === "team" ? Shield : hit.kind === "manager" ? Users : User;
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onPick(hit);
      }}
      className="hover:bg-accent/[0.08] flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
    >
      <Icon size={14} className="text-chalk-dim shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="text-cream block truncate text-[13px]">{hit.name}</span>
        {hit.subtitle ? (
          <span className="text-chalk-dim block truncate text-[11px]">{hit.subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}

function HitSection({
  label,
  hits,
  onPick,
}: {
  label: string;
  hits: SportsSearchHit[];
  onPick: (hit: SportsSearchHit) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div>
      <p className="text-chalk-dim px-3 pt-2.5 pb-1 text-[9.5px] uppercase tracking-[0.16em]">
        {label}
      </p>
      {hits.map((hit) => (
        <HitRow key={`${hit.kind}:${hit.path}`} hit={hit} onPick={onPick} />
      ))}
    </div>
  );
}

export default function SportsSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const managersQuery = useQuery({
    queryKey: ["sports-search-managers"],
    queryFn: async (): Promise<SportsSearchManagerRef[]> => {
      const [mlb, nfl, cfb] = await Promise.all([
        fetchMlbManagers(),
        fetchNflCoaches(),
        fetchCfbCoaches(),
      ]);
      return [
        ...mlb.map((m) => ({
          id: m.id,
          name: m.name,
          teamName: m.teamName,
          league: "MLB" as const,
          path: `/sports/mlb/managers/${m.id}`,
        })),
        ...nfl.map((c) => ({
          id: c.id,
          name: c.name,
          teamName: c.teamName,
          league: "NFL" as const,
          path: `/sports/nfl/coach/${c.id}`,
        })),
        ...cfb.map((c) => ({
          id: c.id,
          name: c.name,
          teamName: c.teamName,
          league: "CFB" as const,
          path: `/sports/cfb/coach/${c.id}`,
        })),
      ];
    },
    staleTime: 180_000,
  });

  const localHits = useMemo(
    () => searchLocalSports(q, managersQuery.data ?? []),
    [q, managersQuery.data],
  );

  const remote = useQuery({
    queryKey: ["sports-search-remote", debounced],
    queryFn: ({ signal }) => searchRemoteSports(debounced, signal),
    enabled: debounced.length >= 2 && focused,
    staleTime: 60_000,
  });

  const merged = useMemo(() => {
    const seen = new Set(localHits.map((h) => `${h.kind}:${h.path}`));
    const extra = (remote.data ?? []).filter((h) => !seen.has(`${h.kind}:${h.path}`));
    return [...localHits, ...extra].sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  }, [localHits, remote.data]);

  const grouped = useMemo(() => groupSportsSearchHits(merged), [merged]);

  const show = focused && q.trim().length >= 2;
  const loading = remote.isFetching && debounced.length >= 2;
  const empty =
    !loading &&
    merged.length === 0 &&
    !remote.isError &&
    debounced.length >= 2 &&
    remote.isFetched;

  const pick = (hit: SportsSearchHit) => {
    setQ("");
    setFocused(false);
    navigate(hit.path);
  };

  return (
    <div className={cn("relative w-full", className)}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const first = merged[0];
          if (first) pick(first);
        }}
      >
        <div className="bg-panel/90 flex items-center gap-2 rounded-sm border border-white/10 px-3 focus-within:border-accent/50">
          <Search size={14} className="text-chalk-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 180)}
            placeholder="Search player, manager, team"
            aria-label="Search sports"
            className="placeholder:text-chalk-dim text-cream min-w-0 flex-1 bg-transparent py-2 text-[12.5px] outline-none"
          />
          {loading ? <Loader2 size={13} className="text-chalk-dim shrink-0 animate-spin" /> : null}
          {q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              className="text-chalk-dim hover:text-cream shrink-0"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </form>

      {show ? (
        <div className="bg-panel absolute z-50 mt-1 max-h-[70vh] w-full overflow-y-auto rounded border border-accent/30 shadow-2xl">
          <HitSection label="Players" hits={grouped.players.slice(0, 6)} onPick={pick} />
          <HitSection label="Managers" hits={grouped.managers.slice(0, 6)} onPick={pick} />
          <HitSection label="Teams" hits={grouped.teams.slice(0, 6)} onPick={pick} />
          {empty ? (
            <p className="text-chalk-dim px-3 py-4 text-center text-[12px]">No matches</p>
          ) : null}
          {remote.isError ? (
            <p className="text-chalk-dim px-3 py-2 text-[11px]">Remote search unavailable</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
