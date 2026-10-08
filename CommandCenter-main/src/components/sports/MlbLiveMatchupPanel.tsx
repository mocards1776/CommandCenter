import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import MlbBaseDiamond from "@/components/sports/MlbBaseDiamond";
import MlbPitchZone from "@/components/sports/MlbPitchZone";
import PlayerHeadshot from "@/components/sports/PlayerHeadshot";
import {
  fetchMlbLiveMatchupExtras,
  type MlbBoxscore,
  type MlbLivePlayerCard,
  type MlbLiveSituation,
} from "@/lib/mlb";
import { fetchMlbLivePlay } from "@/lib/mlb-live-pitches";
import { fetchMlbBatterHeatZones, heatZoneGrid } from "@/lib/mlb-pbp";
import { mergeLivePitches } from "@/lib/mlb-statcast";
import { cn } from "@/lib/utils";

function SideCard({
  card,
  role,
  align,
}: {
  card: MlbLivePlayerCard | null;
  role: "pitcher" | "batter";
  align: "left" | "right";
}) {
  if (!card) {
    return (
      <div className={cn("min-w-0 text-[12px] text-[#8b93a7]", align === "right" && "text-right")}>
        {role === "pitcher" ? "Pitcher TBD" : "Batter TBD"}
      </div>
    );
  }
  const posBit = card.position ? `(${card.position})` : role === "pitcher" ? "(P)" : "";
  const numBit = card.number ? `#${card.number}` : "";
  const meta = [card.teamAbbrev, card.hand].filter(Boolean).join(" · ");
  const seasonLine =
    role === "pitcher"
      ? [
          card.wins != null && card.losses != null ? `${card.wins}-${card.losses}` : null,
          card.era && card.era !== "-.--" ? `${card.era} ERA` : null,
        ]
          .filter(Boolean)
          .join(" ")
      : [
          card.avg,
          card.hr != null ? `${card.hr} HR` : null,
          card.rbi != null ? `${card.rbi} RBI` : null,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <Link
      to={`/sports/mlb/player/${card.id}`}
      className={cn(
        "flex min-w-0 items-start gap-2.5 transition hover:opacity-95 sm:flex-col sm:gap-2",
        align === "right" && "flex-row-reverse text-right sm:items-end",
      )}
    >
      <PlayerHeadshot
        playerId={card.id}
        size={213}
        className="h-14 w-14 shrink-0 rounded-full ring-1 ring-white/20"
        alt=""
      />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-cream">
          {card.shortName} {posBit}
          {numBit ? ` ${numBit}` : ""}
        </p>
        {meta ? <p className="mt-0.5 text-[11px] text-[#8b93a7]">{meta}</p> : null}
        {seasonLine ? (
          <p className="numeral mt-1 text-[11px] font-medium text-white/75">
            {role === "pitcher" ? <span className="text-[#8b93a7]">SEASON </span> : null}
            {seasonLine}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** ESPN-style live pitcher / strike zone (heat + pitch dots) / batter panel. */
export default function MlbLiveMatchupPanel({
  game,
  situation,
}: {
  game: MlbBoxscore;
  situation: MlbLiveSituation;
}) {
  const pitcher = situation.pitcherCard;
  const batter = situation.batterCard;
  const extras = useQuery({
    queryKey: [
      "mlb-live-matchup-extras",
      batter?.id,
      pitcher?.id,
      pitcher?.hand,
    ],
    queryFn: () =>
      fetchMlbLiveMatchupExtras(batter!.id, pitcher!.id, pitcher?.hand ?? null),
    enabled: Boolean(batter?.id && pitcher?.id),
    staleTime: 60_000,
  });
  const zones = useQuery({
    queryKey: ["mlb-pbp-heat", batter?.id],
    queryFn: () => fetchMlbBatterHeatZones(batter!.id),
    enabled: Boolean(batter?.id),
    staleTime: 10 * 60_000,
  });
  const grid = useMemo(() => heatZoneGrid(zones.data), [zones.data]);
  // Statcast for the current PA: field-filtered poll of the same feed/live.
  const livePlay = useQuery({
    queryKey: ["mlb-live-play", game.gamePk],
    queryFn: () => fetchMlbLivePlay(game.gamePk),
    enabled: Boolean(game.gamePk),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const pitches = useMemo(
    () => mergeLivePitches(situation.pitches, livePlay.data?.pitches),
    [situation.pitches, livePlay.data?.pitches],
  );
  const pitchHand =
    livePlay.data?.pitchHand ??
    (/^L/i.test(pitcher?.hand ?? "") ? "L" : /^R/i.test(pitcher?.hand ?? "") ? "R" : null);

  const vsBits: string[] = [];
  if (extras.data?.vsPitcher && pitcher) {
    const v = extras.data.vsPitcher;
    vsBits.push(
      `vs ${pitcher.shortName}: ${v.hits}-${v.atBats} ${v.avg} AVG`,
    );
  }
  if (extras.data?.vsHandAvg && extras.data.vsHandLabel) {
    vsBits.push(`${extras.data.vsHandLabel} ${extras.data.vsHandAvg} AVG`);
  }

  return (
    <div className="relative z-10 border-t border-white/[0.08] bg-[#050b14]/80 px-3 py-3.5 sm:px-5">
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
        <SideCard card={pitcher} role="pitcher" align="left" />

        <div className="flex flex-col items-center gap-2">
          <MlbPitchZone
            batterId={batter?.id ?? null}
            cells={grid}
            pending={zones.isPending && !zones.data}
            pitches={pitches}
            pitchHand={pitchHand}
          />
          <p className="numeral text-[15px] font-semibold tracking-wide text-cream">
            {situation.balls}-{situation.strikes}
            <span className="mx-1.5 text-white/30">·</span>
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/70">
              {situation.outs} out{situation.outs === 1 ? "" : "s"}
            </span>
          </p>
          <MlbBaseDiamond
            onFirst={situation.onFirst}
            onSecond={situation.onSecond}
            onThird={situation.onThird}
          />
          {vsBits.length > 0 ? (
            <p className="max-w-[16rem] text-center text-[10px] leading-snug text-[#8b93a7]">
              {vsBits.join(" · ")}
            </p>
          ) : null}
        </div>

        <SideCard card={batter} role="batter" align="right" />
      </div>

      {(game.venue || game.when) && (
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 border-t border-white/[0.06] pt-2.5 text-center text-[10px] text-[#8b93a7]">
          {game.inning || game.status}
          {game.when ? <span>· {game.when}</span> : null}
          {game.venue ? <span>· {game.venue}</span> : null}
        </p>
      )}
    </div>
  );
}
