import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { EspnPlayerHero, type HeroStatBox } from "@/components/sports/EspnPlayerHero";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useAuth } from "@/lib/auth-context";
import {
  addFavoritePlayer,
  isFavoritePlayer,
  removeFavoritePlayer,
} from "@/lib/favorite-players";
import { fetchNhlPlayerProfile, nhlHeadshot, type NhlPlayerProfile } from "@/lib/nhl";
import { cn, formatSportsDate } from "@/lib/utils";

export default function NhlPlayerPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));
  const { user } = useAuth();
  const qc = useQueryClient();
  const [seasonIdx, setSeasonIdx] = useState(0);

  const profile = useQuery({
    queryKey: ["nhl-player", playerId],
    queryFn: () => fetchNhlPlayerProfile(playerId!),
    enabled: Boolean(playerId),
    staleTime: 120_000,
  });

  const fav = useQuery({
    queryKey: ["favorite-player", user?.id, playerId],
    queryFn: () => isFavoritePlayer(user!.id, playerId!),
    enabled: Boolean(user?.id && playerId),
  });

  const toggleFav = async () => {
    if (!user?.id || !playerId || !profile.data) return;
    try {
      if (fav.data) {
        await removeFavoritePlayer(user.id, playerId);
        toast.success("Removed favorite");
      } else {
        await addFavoritePlayer({
          userId: user.id,
          playerId,
          playerName: profile.data.name,
          teamName: profile.data.teamName,
          teamId: profile.data.teamId,
          position: profile.data.position,
          sport: "hockey",
          league: "NHL",
        });
        toast.success("Favorited NHL player");
      }
      await qc.invalidateQueries({ queryKey: ["favorite-player", user.id, playerId] });
      await qc.invalidateQueries({ queryKey: ["favorite-players", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  if (!playerId) return <p className="text-alert p-6 text-[13px]">Missing player id</p>;

  const p = profile.data;
  const accent = `#${(p?.teamColor ?? "002f87").replace(/^#/, "")}`;
  const splits = p?.seasonSplits ?? [];
  const activeSplit = splits[Math.min(seasonIdx, Math.max(0, splits.length - 1))];

  return (
    <div ref={swipeRef} className="mx-auto max-w-6xl space-y-6 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports/nhl?solo=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          NHL hub
        </Link>
      </div>

      {profile.isPending ? (
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading player…
        </div>
      ) : profile.isError || !p ? (
        <p className="text-alert text-[13px]">Couldn’t load this player.</p>
      ) : (
        <>
          <PlayerHero player={p} accent={accent} isFavorite={Boolean(fav.data)} onToggleFav={toggleFav} />

          {p.teamHistory.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
              <h3 className="rule-head mb-3">Team history</h3>
              <ul className="space-y-2.5">
                {p.teamHistory.map((stop) => (
                  <li key={`${stop.teamId ?? stop.teamName}-${stop.seasons ?? ""}`} className="flex items-center gap-3">
                    {stop.teamLogo ? (
                      <img src={stop.teamLogo} alt="" className="h-8 w-8 object-contain" />
                    ) : (
                      <span className="bg-white/10 h-8 w-8 rounded-full" />
                    )}
                    <div className="min-w-0">
                      {stop.teamId ? (
                        <Link
                          to={`/sports/nhl/team/${stop.teamId}`}
                          className="text-cream hover:text-accent text-[14px] font-semibold"
                        >
                          {stop.teamName}
                        </Link>
                      ) : (
                        <p className="text-cream text-[14px] font-semibold">{stop.teamName}</p>
                      )}
                      <p className="text-[12px] text-[#8b93a7]">{stop.seasons ?? "—"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.seasonStats.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
                  {p.seasonLabel ? `${p.seasonLabel} key stats` : "Season key stats"}
                </h2>
              </div>
              <div className="grid grid-cols-2 divide-x divide-white/[0.06] sm:grid-cols-4">
                {p.seasonStats.slice(0, 8).map((s) => (
                  <div key={s.label} className="border-b border-white/[0.05] px-3 py-4 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                      {s.label}
                    </p>
                    <p className="numeral text-cream mt-1 text-[26px] leading-none sm:text-[28px]">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {splits.length > 0 && (activeSplit?.categories?.length ?? 0) > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b93a7]">
                  Stats
                </h2>
                {splits.length > 1 ? (
                  <div className="flex max-w-full flex-wrap gap-1">
                    {splits.map((split, idx) => (
                      <button
                        key={split.season}
                        type="button"
                        onClick={() => setSeasonIdx(idx)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                          idx === seasonIdx ? "bg-white/10 text-cream" : "text-chalk hover:text-cream",
                        )}
                      >
                        {split.season}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {(activeSplit?.categories ?? []).map((cat) => (
                <div key={cat.name} className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-center text-[12px]">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                        {cat.stats.map((s) => (
                          <th key={s.label} className="px-2 py-2 font-medium">
                            {s.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-white/[0.05]">
                        {cat.stats.map((s) => (
                          <td key={s.label} className="numeral text-cream px-2 py-2.5 text-[15px]">
                            {s.value}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          {p.careerRows.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                  Career
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                      <th className="px-3 py-2 text-left font-medium">Season</th>
                      <th className="px-2 py-2 text-left font-medium">Team</th>
                      {p.careerLabels.map((label) => (
                        <th key={label} className="px-2 py-2 text-center font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.careerRows.map((row) => (
                      <tr key={`${row.season}-${row.teamId}`} className="border-t border-white/[0.05]">
                        <td className="text-cream whitespace-nowrap px-3 py-2 text-left font-medium">
                          {row.season}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-left">
                          {row.teamId ? (
                            <Link to={`/sports/nhl/team/${row.teamId}`} className="text-cream hover:underline">
                              {row.teamName ?? "Team"}
                            </Link>
                          ) : (
                            <span className="text-chalk">{row.teamName ?? "—"}</span>
                          )}
                        </td>
                        {row.stats.map((s) => (
                          <td key={s.label} className="numeral text-cream px-2 py-2 text-center">
                            {s.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {p.gameLog.length > 0 && (
            <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
              <div className="border-b border-white/[0.06] px-4 py-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
                  Game log
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-2 py-2 text-left font-medium">Opp</th>
                      <th className="px-2 py-2 text-center font-medium">Result</th>
                      {p.gameLogLabels.map((label) => (
                        <th key={label} className="px-2 py-2 text-center font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.gameLog.map((row) => (
                      <tr
                        key={`${row.eventId ?? row.date}-${row.opponent}`}
                        className="border-t border-white/[0.05]"
                      >
                        <td className="text-chalk whitespace-nowrap px-3 py-2 text-left">
                          {row.eventId ? (
                            <Link to={`/sports/nhl/game/${row.eventId}`} className="hover:text-cream hover:underline">
                              {formatLogDate(row.date)}
                            </Link>
                          ) : (
                            formatLogDate(row.date)
                          )}
                        </td>
                        <td className="text-cream whitespace-nowrap px-2 py-2 text-left font-medium">
                          {row.atVs ? `${row.atVs} ` : ""}
                          {row.opponent}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span
                            className={cn(
                              "numeral rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                              row.result.startsWith("W")
                                ? "bg-emerald-500/15 text-emerald-300"
                                : row.result.startsWith("L")
                                  ? "bg-red-500/15 text-red-300"
                                  : "bg-white/10 text-[#c8cdd8]",
                            )}
                          >
                            {row.result}
                          </span>
                        </td>
                        {row.stats.map((s) => (
                          <td key={s.label} className="numeral text-cream px-2 py-2 text-center">
                            {s.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {p.news.length > 0 && (
            <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
              <h3 className="rule-head mb-3">News</h3>
              <ul className="space-y-3">
                {p.news.map((n) => (
                  <li key={n.headline} className="flex gap-3">
                    {n.image && (
                      <img src={n.image} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />
                    )}
                    <div className="min-w-0">
                      {n.href ? (
                        <a
                          href={n.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cream hover:text-accent inline-flex items-start gap-1 text-[13.5px] font-medium leading-snug"
                        >
                          {n.headline}
                          <ExternalLink size={11} className="mt-1 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <p className="text-cream text-[13.5px] font-medium leading-snug">{n.headline}</p>
                      )}
                      {n.description && (
                        <p className="text-chalk mt-1 line-clamp-2 text-[12px] leading-relaxed">
                          {n.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-panel rounded-xl border border-white/[0.08] p-4">
            <h3 className="rule-head mb-3">Bio</h3>
            <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
              <BioItem label="Height" value={p.height ?? "—"} />
              <BioItem label="Weight" value={p.weight ?? "—"} />
              <BioItem label="Age" value={p.age != null ? String(p.age) : "—"} />
              <BioItem
                label="Born"
                value={p.birthDate ? formatSportsDate(p.birthDate) : (p.dob ?? "—")}
              />
              <BioItem label="Birthplace" value={p.birthPlace ?? "—"} />
              <BioItem label={p.position === "G" ? "Catches" : "Shoots"} value={p.shoots ?? "—"} />
              <BioItem label="Draft" value={p.draft ?? "—"} />
              <BioItem label="Experience" value={p.experience ?? "—"} />
              <BioItem label="Status" value={p.status ?? "—"} />
            </dl>
            <a
              href={`https://www.espn.com/nhl/player/_/id/${p.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent mt-4 inline-flex items-center gap-1 text-[12px]"
            >
              ESPN player page <ExternalLink size={12} />
            </a>
          </section>
        </>
      )}
    </div>
  );
}

function formatLogDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BioItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">{label}</dt>
      <dd className="text-cream mt-0.5 text-[14px]">{value}</dd>
    </div>
  );
}

const HERO_STAT_PRIORITY = ["PTS", "SV%", "W", "GAA", "GP"];

function heroStatBox(player: NhlPlayerProfile): HeroStatBox | null {
  const byLabel = new Map(player.seasonStats.map((s) => [s.label.toUpperCase(), s.value]));
  const label = HERO_STAT_PRIORITY.find((l) => {
    const v = byLabel.get(l);
    return v != null && v !== "" && v !== "—";
  });
  if (!label) return null;
  const gp = byLabel.get("GP");
  const seasonYear = player.seasonLabel?.match(/\d{4}-\d{2}/)?.[0] ?? null;
  return {
    label,
    value: byLabel.get(label)!,
    sub: label !== "GP" && gp ? `${gp} GP` : seasonYear,
  };
}

function PlayerHero({
  player,
  accent,
  isFavorite,
  onToggleFav,
}: {
  player: NhlPlayerProfile;
  accent: string;
  isFavorite: boolean;
  onToggleFav: () => void;
}) {
  const htWt = [player.height, player.weight].filter(Boolean).join(" · ");
  const statBoxes: HeroStatBox[] = [];
  if (player.age != null) statBoxes.push({ label: "Age", value: String(player.age) });
  const stat = heroStatBox(player);
  if (stat) statBoxes.push(stat);

  return (
    <EspnPlayerHero
      name={player.name}
      league="NHL"
      teamName={player.teamName}
      teamHref={player.teamId ? `/sports/nhl/team/${player.teamId}` : null}
      teamLogo={player.teamLogo}
      headshot={player.headshot ?? nhlHeadshot(player.id)}
      headshotFallback={nhlHeadshot(player.id)}
      accent={accent}
      number={player.number}
      position={player.position}
      statBoxes={statBoxes}
      isFavorite={isFavorite}
      onToggleFav={onToggleFav}
      bio={[
        { label: "HT / WT", value: htWt || "—" },
        { label: "Position", value: player.positionName ?? player.position ?? "—" },
        { label: player.position === "G" ? "Catches" : "Shoots", value: player.shoots ?? "—" },
        {
          label: "Birthdate",
          value: player.birthDate
            ? `${formatSportsDate(player.birthDate)}${player.age != null ? ` (${player.age})` : ""}`
            : (player.dob ?? "—"),
        },
        { label: "Born", value: player.birthPlace ?? "—" },
        { label: "Draft", value: player.draft ?? "Undrafted" },
        { label: "Experience", value: player.experience ?? "—" },
        { label: "Status", value: player.status ?? "Active" },
      ]}
    />
  );
}
