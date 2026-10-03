import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import {
  matchStarToBoxRow,
  nhlAccentColor,
  nhlHeadshot,
  type NhlBoxGroup,
  type NhlBoxRow,
  type NhlScoreSide,
  type NhlThreeStar,
} from "@/lib/nhl";
import { cn } from "@/lib/utils";

const MEDAL: Record<1 | 2 | 3, { label: string; color: string; glow: string }> = {
  1: { label: "1st Star", color: "#f5c84c", glow: "rgba(245,200,76,0.35)" },
  2: { label: "2nd Star", color: "#d4dae6", glow: "rgba(212,218,230,0.25)" },
  3: { label: "3rd Star", color: "#d9925a", glow: "rgba(217,146,90,0.25)" },
};

function rowStat(row: NhlBoxRow | null, label: string): string | null {
  const v = row?.stats.find((s) => s.label === label)?.value;
  return v && v !== "—" ? v : null;
}

function statLine(star: NhlThreeStar, row: NhlBoxRow | null): { value: string; label: string }[] {
  if (star.position === "G") {
    const saves = rowStat(row, "SV");
    const shots = rowStat(row, "SA");
    const pct = star.savePctg != null ? star.savePctg.toFixed(3).replace(/^0/, "") : rowStat(row, "SV%");
    return [
      saves && shots ? { value: `${saves}/${shots}`, label: "SV" } : null,
      pct ? { value: pct, label: "SV%" } : null,
      !saves && star.goalsAgainstAverage != null
        ? { value: star.goalsAgainstAverage.toFixed(2), label: "GAA" }
        : null,
    ].filter((s): s is { value: string; label: string } => Boolean(s));
  }
  const sog = rowStat(row, "SOG") ?? rowStat(row, "S");
  return [
    { value: String(star.goals ?? rowStat(row, "G") ?? 0), label: "G" },
    { value: String(star.assists ?? rowStat(row, "A") ?? 0), label: "A" },
    sog ? { value: sog, label: "SOG" } : null,
  ].filter((s): s is { value: string; label: string } => Boolean(s));
}

function StarCard({
  star,
  row,
  side,
}: {
  star: NhlThreeStar;
  row: NhlBoxRow | null;
  side: NhlScoreSide | null;
}) {
  const medal = MEDAL[star.star];
  const first = star.star === 1;
  const color = side ? nhlAccentColor(side) : medal.color;
  const stats = statLine(star, row);
  const name = row?.name ?? star.name;
  const body = (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${medal.glow}, transparent 70%)` }}
      />
      <div className="relative flex items-center justify-center gap-1 pt-2.5">
        {Array.from({ length: 4 - star.star }, (_, i) => (
          <Star key={i} size={first ? 13 : 11} style={{ color: medal.color }} className="fill-current" />
        ))}
      </div>
      <p
        className="relative mt-1 text-center text-[9.5px] font-bold uppercase tracking-[0.2em]"
        style={{ color: medal.color }}
      >
        {medal.label}
      </p>
      <div className="relative mx-auto mt-2.5 w-fit">
        <img
          src={star.headshot ?? (row ? nhlHeadshot(row.id) : "")}
          alt=""
          className={cn(
            "rounded-full bg-[#dfe6f2] object-cover object-top",
            first ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20",
          )}
          style={{ boxShadow: `0 0 0 3px ${medal.color}, 0 10px 30px rgba(0,0,0,0.45)` }}
          onError={(e) => {
            const el = e.currentTarget;
            if (row && !el.dataset.fallback) {
              el.dataset.fallback = "1";
              el.src = nhlHeadshot(row.id);
            }
          }}
        />
        {side?.logo ? (
          <img
            src={side.logo}
            alt=""
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#0a1424] object-contain p-0.5 ring-1 ring-white/15"
          />
        ) : null}
      </div>
      <div className="relative px-2 pb-3 pt-2.5 text-center">
        <p
          className={cn(
            "text-cream truncate font-semibold leading-tight",
            first ? "text-[15px] sm:text-[17px]" : "text-[13px] sm:text-[15px]",
          )}
        >
          {name}
        </p>
        <p className="text-chalk-dim numeral mt-0.5 truncate text-[10.5px] uppercase tracking-[0.1em]">
          {[star.teamAbbrev, star.sweaterNo ? `#${star.sweaterNo}` : null, star.position]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {stats.length ? (
          <div className="mt-2.5 flex justify-center gap-3 sm:gap-4">
            {stats.map((s) => (
              <div key={s.label} className="leading-none">
                <span
                  className={cn(
                    "font-display text-cream block tabular-nums",
                    first ? "text-[24px] sm:text-[28px]" : "text-[20px] sm:text-[24px]",
                  )}
                >
                  {s.value}
                </span>
                <span
                  className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
  const shell = cn(
    "relative block overflow-hidden rounded-lg border bg-[#0a1424] transition",
    first ? "" : "mt-4 sm:mt-5",
  );
  const style = { borderColor: `color-mix(in srgb, ${medal.color} 45%, transparent)` };
  return row ? (
    <Link to={`/sports/nhl/player/${row.id}`} className={cn(shell, "hover:bg-[#0d1a2e]")} style={style}>
      {body}
    </Link>
  ) : (
    <div className={shell} style={style}>
      {body}
    </div>
  );
}

/**
 * Official NHL Three Stars of the Game, laid out as a podium (2nd · 1st · 3rd).
 * Renders nothing until the NHL posts them.
 */
export default function NhlThreeStars({
  stars,
  away,
  home,
  boxGroups,
  compact = false,
}: {
  stars: NhlThreeStar[];
  away: NhlScoreSide;
  home: NhlScoreSide;
  boxGroups: NhlBoxGroup[];
  compact?: boolean;
}) {
  if (!stars.length) return null;
  const sideFor = (abbrev: string) =>
    abbrev === away.abbrev ? away : abbrev === home.abbrev ? home : null;
  const podium = [2, 1, 3]
    .map((n) => stars.find((s) => s.star === n))
    .filter((s): s is NhlThreeStar => Boolean(s));
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.08]",
        compact ? "bg-transparent" : "bg-panel p-3 sm:p-4",
      )}
    >
      {!compact ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="rule-head">Three Stars</h3>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[#6f778a]">
            NHL official
          </span>
        </div>
      ) : null}
      <div className="grid grid-cols-3 items-start gap-2 sm:gap-3">
        {podium.map((star) => (
          <StarCard
            key={star.star}
            star={star}
            row={matchStarToBoxRow(star, boxGroups)}
            side={sideFor(star.teamAbbrev)}
          />
        ))}
      </div>
    </section>
  );
}
