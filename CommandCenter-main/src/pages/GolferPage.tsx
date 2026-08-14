import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Cake,
  Calendar,
  ChartNoAxesColumn,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Flag,
  Loader2,
  Medal,
  Play,
  Ruler,
  Star,
  Trophy,
} from "lucide-react";
import toast from "react-hot-toast";
import PlayerTagsPanel from "@/components/sports/PlayerTagsPanel";
import SportsNotesPanel from "@/components/sports/SportsNotesPanel";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useAuth } from "@/lib/auth-context";
import {
  addFavoritePlayer,
  isFavoritePlayer,
  removeFavoritePlayer,
} from "@/lib/favorite-players";
import {
  fetchGolferProfile,
  fetchGolferScorecard,
  scoreTypeColor,
  type GolfHoleScore,
  type GolfRoundScorecard,
} from "@/lib/sports";
import { cn } from "@/lib/utils";

type GolferTab = "overview" | "scorecard" | "news" | "bio" | "results";

const TABS: { id: GolferTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "scorecard", label: "Scorecard" },
  { id: "news", label: "News & Video" },
  { id: "bio", label: "Bio" },
  { id: "results", label: "Results" },
];

const GOLF_TAG_SUGGESTIONS = [
  "Watch",
  "Favorite",
  "Contender",
  "Long shot",
  "Cut watch",
] as const;

function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; Icon?: typeof Trophy }[];
}) {
  return (
    <section className="rounded-xl border border-white/[0.1] bg-[#12151c] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        <ChevronRight size={16} className="text-white/35" />
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={`${title}-${r.label}`} className="flex items-center gap-2.5 text-[13px]">
            {r.Icon ? <r.Icon size={15} className="shrink-0 text-white/55" /> : null}
            <span className="text-white/90">
              <span className="font-semibold text-white">{r.value}</span>
              {r.label ? <span className="text-white/55"> {r.label}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MediaRow({
  item,
}: {
  item: {
    headline: string;
    description: string;
    image: string | null;
    href: string | null;
    type: "news" | "video";
  };
}) {
  const body = (
    <div className="flex items-start gap-3 border-b border-white/[0.08] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-white">{item.headline}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/45">
          {item.type === "video" ? "Highlights" : item.description?.slice(0, 48) || "News"}
        </p>
      </div>
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-[#1a2030]">
        {item.image ? (
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        ) : null}
        {item.type === "video" ? (
          <span className="absolute inset-0 grid place-items-center bg-black/35">
            <Play size={18} className="fill-white text-white" />
          </span>
        ) : null}
      </div>
    </div>
  );
  return item.href ? (
    <a href={item.href} target="_blank" rel="noreferrer" className="block hover:opacity-90">
      {body}
    </a>
  ) : (
    body
  );
}

function MediaSection({
  title,
  items,
}: {
  title: string;
  items: {
    headline: string;
    description: string;
    image: string | null;
    href: string | null;
    type: "news" | "video";
  }[];
}) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2">
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">View all</span>
      </div>
      <div>
        {items.map((n) => (
          <MediaRow key={`${n.type}-${n.headline}`} item={n} />
        ))}
      </div>
    </section>
  );
}

function HoleMap({
  holes,
  currentHole,
}: {
  holes: GolfHoleScore[];
  currentHole: number | null;
}) {
  const byHole = new Map(holes.map((h) => [h.hole, h]));
  const playedCount = holes.filter((x) => x.strokes != null).length;
  return (
    <div className="grid grid-cols-9 gap-1.5 sm:gap-2">
      {Array.from({ length: 18 }, (_, i) => {
        const hole = i + 1;
        const h = byHole.get(hole);
        const played = h?.strokes != null;
        const active =
          currentHole === hole ||
          (!played && currentHole == null && hole === playedCount + 1 && playedCount < 18);
        return (
          <div
            key={hole}
            className={cn(
              "relative flex aspect-square flex-col items-center justify-center rounded-md border text-center",
              played ? "border-white/15 bg-[#0f1520]" : "border-dashed border-white/10 bg-transparent",
              active && "ring-1 ring-[#4ea1ff]/70",
            )}
            title={
              h
                ? `Hole ${hole}${h.par != null ? ` · Par ${h.par}` : ""}${h.strokes != null ? ` · ${h.strokes}` : ""}${h.scoreType ? ` · ${h.scoreType}` : ""}`
                : `Hole ${hole}`
            }
          >
            <span className="text-[9px] uppercase tracking-[0.08em] text-white/40">{hole}</span>
            <span
              className="numeral text-[14px] font-semibold leading-none"
              style={{
                color: played ? scoreTypeColor(h?.scoreType ?? null, h?.toPar ?? null) : "#64748b",
              }}
            >
              {played ? h!.strokes : h?.par != null ? h.par : "·"}
            </span>
            {h?.par != null ? (
              <span className="mt-0.5 text-[8px] text-white/35">p{h.par}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RoundScorecard({
  round,
  currentHole,
}: {
  round: GolfRoundScorecard;
  currentHole: number | null;
}) {
  const front = round.holes.filter((h) => h.hole <= 9);
  const back = round.holes.filter((h) => h.hole > 9);
  return (
    <section className="rounded-xl border border-white/[0.1] bg-[#12151c] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-white">Round {round.round}</h3>
        <p className="numeral text-[13px] text-white/70">
          {round.toPar ?? "—"}
          {round.outScore != null || round.inScore != null ? (
            <span className="ml-2 text-[11px] text-white/40">
              {round.outScore != null ? `Out ${round.outScore}` : ""}
              {round.outScore != null && round.inScore != null ? " · " : ""}
              {round.inScore != null ? `In ${round.inScore}` : ""}
            </span>
          ) : null}
        </p>
      </div>
      <HoleMap holes={round.holes} currentHole={currentHole} />
      {(front.length > 0 || back.length > 0) && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-center text-[11px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                <th className="px-1 py-1 text-left font-medium">Hole</th>
                {Array.from({ length: 9 }, (_, i) => (
                  <th key={`h${i + 1}`} className="px-1 py-1 font-medium">
                    {i + 1}
                  </th>
                ))}
                <th className="px-1 py-1 font-medium">Out</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/[0.06] text-white/50">
                <td className="px-1 py-1.5 text-left">Par</td>
                {Array.from({ length: 9 }, (_, i) => (
                  <td key={`p${i + 1}`} className="numeral px-1 py-1.5">
                    {front.find((h) => h.hole === i + 1)?.par ?? "—"}
                  </td>
                ))}
                <td className="numeral px-1 py-1.5">
                  {front.reduce((s, h) => s + (h.par ?? 0), 0) || "—"}
                </td>
              </tr>
              <tr className="border-t border-white/[0.06] text-white">
                <td className="px-1 py-1.5 text-left">Score</td>
                {Array.from({ length: 9 }, (_, i) => {
                  const h = front.find((x) => x.hole === i + 1);
                  return (
                    <td
                      key={`s${i + 1}`}
                      className="numeral px-1 py-1.5 font-semibold"
                      style={{ color: scoreTypeColor(h?.scoreType ?? null, h?.toPar ?? null) }}
                    >
                      {h?.strokes ?? "—"}
                    </td>
                  );
                })}
                <td className="numeral px-1 py-1.5 font-semibold">
                  {round.outScore ??
                    (front.every((h) => h.strokes != null)
                      ? front.reduce((s, h) => s + (h.strokes ?? 0), 0)
                      : "—")}
                </td>
              </tr>
              <tr className="border-t border-white/[0.06] text-[10px] uppercase tracking-[0.12em] text-white/40">
                <th className="px-1 py-1 text-left font-medium">Hole</th>
                {Array.from({ length: 9 }, (_, i) => (
                  <th key={`hb${i + 10}`} className="px-1 py-1 font-medium">
                    {i + 10}
                  </th>
                ))}
                <th className="px-1 py-1 font-medium">In</th>
              </tr>
              <tr className="border-t border-white/[0.06] text-white/50">
                <td className="px-1 py-1.5 text-left">Par</td>
                {Array.from({ length: 9 }, (_, i) => (
                  <td key={`pb${i + 10}`} className="numeral px-1 py-1.5">
                    {back.find((h) => h.hole === i + 10)?.par ?? "—"}
                  </td>
                ))}
                <td className="numeral px-1 py-1.5">
                  {back.reduce((s, h) => s + (h.par ?? 0), 0) || "—"}
                </td>
              </tr>
              <tr className="border-t border-white/[0.06] text-white">
                <td className="px-1 py-1.5 text-left">Score</td>
                {Array.from({ length: 9 }, (_, i) => {
                  const h = back.find((x) => x.hole === i + 10);
                  return (
                    <td
                      key={`sb${i + 10}`}
                      className="numeral px-1 py-1.5 font-semibold"
                      style={{ color: scoreTypeColor(h?.scoreType ?? null, h?.toPar ?? null) }}
                    >
                      {h?.strokes ?? "—"}
                    </td>
                  );
                })}
                <td className="numeral px-1 py-1.5 font-semibold">
                  {round.inScore ??
                    (back.every((h) => h.strokes != null)
                      ? back.reduce((s, h) => s + (h.strokes ?? 0), 0)
                      : "—")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function GolferPage() {
  const { golferId } = useParams<{ golferId: string }>();
  const navigate = useNavigate();
  const swipeRef = useSwipeBack(() => navigate(-1));
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<GolferTab>("overview");

  const profile = useQuery({
    queryKey: ["golfer-profile", golferId],
    queryFn: () => fetchGolferProfile(golferId!),
    enabled: Boolean(golferId),
    staleTime: 120_000,
  });

  const scorecard = useQuery({
    queryKey: ["golfer-scorecard", golferId],
    queryFn: () => fetchGolferScorecard(golferId!),
    enabled: Boolean(golferId),
    staleTime: 45_000,
    refetchInterval: tab === "scorecard" ? 60_000 : false,
  });

  const fav = useQuery({
    queryKey: ["favorite-player", user?.id, golferId],
    queryFn: () => isFavoritePlayer(user!.id, golferId!),
    enabled: Boolean(user?.id && golferId),
  });

  const toggleFav = async () => {
    if (!user?.id || !golferId || !profile.data) return;
    try {
      if (fav.data) {
        await removeFavoritePlayer(user.id, golferId);
        toast.success("Removed favorite golfer");
      } else {
        await addFavoritePlayer({
          userId: user.id,
          playerId: golferId,
          playerName: profile.data.name,
          sport: "golf",
          league: "PGA Tour",
          position: "G",
        });
        toast.success("Favorited golfer");
      }
      await qc.invalidateQueries({ queryKey: ["favorite-player", user.id, golferId] });
      await qc.invalidateQueries({ queryKey: ["favorite-players", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  if (!golferId) {
    return <p className="text-alert p-6 text-[13px]">Missing golfer id</p>;
  }

  const p = profile.data;
  const videos = (p?.recentNews ?? []).filter((n) => n.type === "video");
  const news = (p?.recentNews ?? []).filter((n) => n.type !== "video");

  return (
    <div ref={swipeRef} className="mx-auto max-w-4xl space-y-5 p-4 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-chalk hover:text-cream flex items-center gap-2 text-[11px] uppercase tracking-[0.14em]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Link
          to="/sports?solo=1&golf=1"
          className="text-chalk-dim hover:text-cream text-[11px] uppercase tracking-[0.14em]"
        >
          Favorites
        </Link>
      </div>

      {profile.isPending ? (
        <p className="text-chalk flex items-center gap-2 text-[13px]">
          <Loader2 size={14} className="animate-spin" /> Loading golfer…
        </p>
      ) : profile.isError || !p ? (
        <p className="text-alert text-[13px]">Couldn’t load this golfer.</p>
      ) : (
        <>
          <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#070b12]">
            <div className="pointer-events-none absolute inset-0">
              {p.headshot ? (
                <img
                  src={p.headshot}
                  alt=""
                  className="h-full w-full scale-105 object-cover object-[center_18%] opacity-55"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-r from-[#070b12] via-[#070b12]/75 to-[#070b12]/25" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-transparent to-[#070b12]/40" />
              <div className="absolute -left-10 top-8 h-40 w-40 rounded-full bg-[#024731]/35 blur-3xl" />
              <div className="absolute right-0 bottom-0 h-48 w-48 rounded-full bg-[#4ea1ff]/20 blur-3xl" />
            </div>
            <div className="relative z-10 grid gap-5 px-5 py-7 sm:grid-cols-[auto_1fr] sm:items-end sm:px-8 sm:py-9">
              <div className="relative mx-auto h-36 w-36 overflow-hidden rounded-2xl border border-white/20 bg-[#101822] shadow-[0_20px_50px_rgba(0,0,0,0.45)] sm:mx-0 sm:h-44 sm:w-44">
                {p.headshot ? (
                  <img
                    src={p.headshot}
                    alt=""
                    className="h-full w-full object-cover object-[center_15%]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-white/30">
                    <Flag size={28} />
                  </div>
                )}
              </div>
              <div className="text-center sm:pb-1 sm:text-left">
                <div className="mb-3 flex justify-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void toggleFav()}
                    className={cn(
                      "rounded-full border p-2 transition",
                      fav.data
                        ? "border-[#4ea1ff]/50 bg-[#4ea1ff]/15 text-[#4ea1ff]"
                        : "border-white/20 text-white/70 hover:text-white",
                    )}
                    aria-label={fav.data ? "Unfavorite" : "Favorite"}
                  >
                    <Star size={16} className={fav.data ? "fill-[#4ea1ff]" : ""} />
                  </button>
                </div>
                <h1 className="font-display text-[36px] leading-tight text-white sm:text-[48px]">
                  {p.name}
                </h1>
                <p className="mt-2 inline-flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 sm:justify-start">
                  {p.flagUrl && <img src={p.flagUrl} alt="" className="h-3.5 w-5 object-cover" />}
                  {p.citizenship ?? "PGA Tour"}
                </p>
                <PlayerTagsPanel
                  playerId={golferId!}
                  playerName={p.name}
                  variant="hero"
                  isFavorite={Boolean(fav.data)}
                  linkTags={false}
                  suggestions={GOLF_TAG_SUGGESTIONS}
                />
              </div>
            </div>
          </article>

          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 text-[12px] font-semibold tracking-[0.04em] transition",
                  tab === t.id
                    ? "border-white text-white"
                    : "border-transparent text-white/45 hover:text-white/75",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-5">
              {p.rankings.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {p.rankings.map((r) => (
                    <div
                      key={r.label}
                      className="min-w-[7.5rem] flex-1 rounded-xl border border-white/[0.1] bg-[#12151c] px-3 py-3"
                    >
                      <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-white/45">
                        <Trophy size={11} /> {r.label}
                      </p>
                      <p className="numeral mt-1 text-[28px] leading-none text-white">{r.rank}</p>
                      {r.detail && (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/45">
                          {r.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard
                  title="Career (PGA TOUR)"
                  rows={[
                    { label: "Wins", value: p.career[0]?.value ?? "—", Icon: Trophy },
                    { label: "Earnings", value: p.career[1]?.value ?? "—", Icon: DollarSign },
                    { label: "Cuts Made", value: p.career[2]?.value ?? "—", Icon: CheckCircle2 },
                  ]}
                />
                <InfoCard
                  title={`Season (${new Date().getFullYear()})`}
                  rows={[
                    { label: "Wins", value: p.season[0]?.value ?? "—", Icon: Trophy },
                    { label: "Top 10", value: p.season[1]?.value ?? "—", Icon: Medal },
                    { label: "Cuts Made", value: p.season[2]?.value ?? "—", Icon: CheckCircle2 },
                  ]}
                />
                <InfoCard
                  title="Stats"
                  rows={p.performance.map((s) => ({
                    label: s.label,
                    value: s.value,
                    Icon: /putt/i.test(s.label)
                      ? Flag
                      : /tee|driv/i.test(s.label)
                        ? Flag
                        : ChartNoAxesColumn,
                  }))}
                />
              </div>

              {p.seasonStats.length > 0 && (
                <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
                  <div className="border-b border-white/[0.06] px-4 py-2.5">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                      Season overview
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
                    {p.seasonStats.map((s) => (
                      <div
                        key={s.label}
                        className="border-b border-r border-white/[0.05] px-3 py-4 text-center"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b93a7]">
                          {s.label}
                        </p>
                        <p className="numeral mt-1 text-[20px] text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {p.lastWin && (
                <section className="rounded-xl border border-white/[0.08] bg-[#12151c] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                    Last win
                  </p>
                  <p className="mt-1 text-[15px] text-white">
                    {p.lastWin.event}{" "}
                    <span className="text-white/45">· {p.lastWin.year}</span>
                    {p.lastWin.score ? (
                      <span className="numeral text-[#ff6b6b]"> · {p.lastWin.score}</span>
                    ) : null}
                  </p>
                </section>
              )}

              {scorecard.data?.rounds?.length ? (
                <button
                  type="button"
                  onClick={() => setTab("scorecard")}
                  className="flex w-full items-center justify-between rounded-xl border border-white/[0.1] bg-[#12151c] px-4 py-3 text-left transition hover:border-white/20"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                      This week
                    </p>
                    <p className="mt-1 text-[14px] text-white">
                      {scorecard.data.eventName ?? "Tournament scorecard"}
                      {scorecard.data.totalToPar ? (
                        <span className="numeral text-[#4ade80]"> · {scorecard.data.totalToPar}</span>
                      ) : null}
                      {scorecard.data.currentHole != null ? (
                        <span className="text-white/45"> · thru {scorecard.data.currentHole}</span>
                      ) : null}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-white/40" />
                </button>
              ) : null}

              <PlayerTagsPanel
                playerId={golferId!}
                playerName={p.name}
                isFavorite={Boolean(fav.data)}
                linkTags={false}
                suggestions={GOLF_TAG_SUGGESTIONS}
              />
              <SportsNotesPanel entityType="player" entityId={golferId!} entityName={p.name} />
            </div>
          )}

          {tab === "scorecard" && (
            <div className="space-y-4">
              {scorecard.isPending ? (
                <p className="text-chalk flex items-center gap-2 text-[13px]">
                  <Loader2 size={14} className="animate-spin" /> Loading scorecard…
                </p>
              ) : scorecard.isError || !scorecard.data?.rounds?.length ? (
                <p className="text-chalk-dim text-[13px]">
                  No live scorecard for this golfer in the current event.
                </p>
              ) : (
                <>
                  <div className="rounded-xl border border-white/[0.1] bg-[#0b1220] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                      Hole map · play-by-play
                    </p>
                    <p className="mt-1 text-[15px] text-white">
                      {scorecard.data.eventName ?? "Current tournament"}
                    </p>
                    <p className="mt-1 text-[12px] text-white/55">
                      {scorecard.data.position ? `Pos ${scorecard.data.position}` : "In field"}
                      {scorecard.data.totalToPar ? ` · ${scorecard.data.totalToPar}` : ""}
                      {scorecard.data.currentHole != null
                        ? ` · playing hole ${scorecard.data.currentHole}`
                        : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] text-white/45">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> Eagle+
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#4ade80]" /> Birdie
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#e8e4d9]" /> Par
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#fbbf24]" /> Bogey
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#f87171]" /> Double+
                      </span>
                    </div>
                  </div>
                  {[...scorecard.data.rounds]
                    .sort((a, b) => b.round - a.round)
                    .map((r) => (
                      <RoundScorecard
                        key={r.round}
                        round={r}
                        currentHole={
                          r.round === Math.max(...scorecard.data!.rounds.map((x) => x.round))
                            ? scorecard.data!.currentHole
                            : null
                        }
                      />
                    ))}
                </>
              )}
            </div>
          )}

          {tab === "news" && (
            <div className="space-y-6">
              {videos.length === 0 && news.length === 0 ? (
                <p className="text-chalk-dim text-[13px]">No recent news or video.</p>
              ) : (
                <>
                  <MediaSection title="Video" items={videos} />
                  <MediaSection title="News" items={news} />
                </>
              )}
            </div>
          )}

          {tab === "bio" && (
            <div className="space-y-4">
              <InfoCard
                title="Bio"
                rows={[
                  ...p.bioFacts.map((f) => ({
                    label: f.label === "Height" ? "" : f.label,
                    value: f.value,
                    Icon: f.label === "Height" ? Ruler : f.label === "Age" ? Cake : Calendar,
                  })),
                  ...(p.birthPlace
                    ? [{ label: "Birthplace", value: p.birthPlace, Icon: Flag }]
                    : []),
                  ...(p.college ? [{ label: "College", value: p.college, Icon: Medal }] : []),
                  ...(p.turnedPro != null
                    ? [{ label: "Turned Pro", value: String(p.turnedPro), Icon: Calendar }]
                    : []),
                ]}
              />
              {p.bio ? (
                <section className="rounded-xl border border-white/[0.08] bg-[#12151c] p-4">
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                    About
                  </h2>
                  <p className="text-[14px] leading-relaxed text-white/80">{p.bio}</p>
                </section>
              ) : null}
            </div>
          )}

          {tab === "results" && (
            <div className="space-y-4">
              {p.seasonResults.length === 0 ? (
                <p className="text-chalk-dim text-[13px]">No season results yet.</p>
              ) : (
                <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#12151c]">
                  <div className="border-b border-white/[0.06] px-4 py-2.5">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
                      Season results ({p.seasonResults.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[320px] text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.12em] text-[#8b93a7]">
                          <th className="px-4 py-2 font-medium">Tournament</th>
                          <th className="px-2 py-2 font-medium">Pos</th>
                          <th className="px-4 py-2 text-right font-medium">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.seasonResults.map((r) => (
                          <tr key={`${r.event}-${r.date}`} className="border-b border-white/[0.05]">
                            <td className="px-4 py-2.5">
                              <p className="text-[13px] text-white">{r.event}</p>
                              {r.date && (
                                <p className="text-[10px] text-white/40">{r.date}</p>
                              )}
                            </td>
                            <td className="numeral px-2 py-2.5 text-white/80">{r.position}</td>
                            <td className="numeral px-4 py-2.5 text-right text-[#ff6b6b]">
                              {r.score ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
