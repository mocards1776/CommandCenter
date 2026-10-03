import LogoPlate from "@/components/sports/LogoPlate";
import type { CfbGameDetail, CfbPlay, CfbScoreSide } from "@/lib/cfb";
import { cn } from "@/lib/utils";

const TAG_CLASS: Record<string, string> = {
  TD: "bg-accent/20 text-accent",
  FG: "bg-accent/20 text-accent",
  SAF: "bg-accent/20 text-accent",
  INT: "bg-orange-400/15 text-orange-200",
  FUM: "bg-orange-400/15 text-orange-200",
  PEN: "bg-amber-400/15 text-amber-200",
  SACK: "bg-sky-400/15 text-sky-200",
  "1ST": "bg-emerald-400/15 text-emerald-200",
  PUNT: "bg-white/[0.08] text-[#c5cce0]",
  MISS: "bg-white/[0.08] text-[#c5cce0]",
  BLK: "bg-amber-400/15 text-amber-200",
};

function periodLabel(period: number | null): string {
  if (period == null) return "";
  if (period >= 1 && period <= 4) return `Q${period}`;
  if (period === 5) return "OT";
  return `${period - 4}OT`;
}

function sideFor(g: CfbGameDetail, teamId: string | null): CfbScoreSide | null {
  if (!teamId) return null;
  if (String(g.away.teamId) === teamId) return g.away;
  if (String(g.home.teamId) === teamId) return g.home;
  return null;
}

/** Lift near-black school colors enough to read on the navy panel. */
function readableColor(hex: string | null | undefined): string {
  const raw = (hex ?? "").replace(/^#/, "");
  const n = Number.parseInt(raw, 16);
  if (!Number.isFinite(n) || raw.length !== 6) return "#d9515c";
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.299 * ch[0]! + 0.587 * ch[1]! + 0.114 * ch[2]!) / 255;
  if (lum > 0.32) return `#${raw}`;
  return `rgb(${ch.map((c) => Math.round(c + (255 - c) * 0.45)).join(",")})`;
}

function toneAccent(play: CfbPlay, scoring: CfbScoreSide | null, possession: CfbScoreSide | null): string | null {
  if (play.tone === "score") return readableColor((scoring ?? possession)?.color);
  if (play.tone === "penalty") return "#e7c27a";
  if (play.tone === "turnover") return "#ff8a93";
  if (play.tone === "sack") return "#9eb6e6";
  return null;
}

function PlayMeta({ play }: { play: CfbPlay }) {
  const when = [periodLabel(play.period), play.clock].filter(Boolean).join(" · ");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {when ? (
        <span className="numeral rounded-sm bg-white/[0.08] px-1.5 py-0.5 text-[10.5px] text-[#c5cce0]">
          {when}
        </span>
      ) : null}
      {play.shortDownDistanceText ? (
        <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[#d5dbe8]">
          {play.shortDownDistanceText}
        </span>
      ) : null}
      {play.spot ? <span className="numeral text-[10px] tracking-wide text-[#8b93a7]">{play.spot}</span> : null}
      {play.tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em]",
            TAG_CLASS[tag] ?? "bg-white/[0.08] text-[#c5cce0]",
          )}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function ScoreChip({
  g,
  play,
  scoring,
}: {
  g: CfbGameDetail;
  play: CfbPlay;
  scoring: "away" | "home" | null;
}) {
  if (play.awayScore == null || play.homeScore == null) return null;
  const tint = (side: "away" | "home") =>
    scoring === side ? readableColor(side === "away" ? g.away.color : g.home.color) : undefined;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-white/[0.1] bg-black/25 px-2 py-1">
      <span
        className="numeral text-[15px] font-semibold leading-none"
        style={{ color: tint("away") ?? "rgba(255,255,255,0.55)" }}
      >
        {play.awayScore}
      </span>
      <span className="text-[11px] text-white/35">–</span>
      <span
        className="numeral text-[15px] font-semibold leading-none"
        style={{ color: tint("home") ?? "rgba(255,255,255,0.55)" }}
      >
        {play.homeScore}
      </span>
    </span>
  );
}

function scoringSide(g: CfbGameDetail, play: CfbPlay): "away" | "home" | null {
  if (!play.scoringTeamId) return null;
  if (String(g.away.teamId) === play.scoringTeamId) return "away";
  if (String(g.home.teamId) === play.scoringTeamId) return "home";
  return null;
}

export default function CfbRecentPlays({ g }: { g: CfbGameDetail }) {
  const plays = g.recentPlays.filter((p) => p.text);
  const featuredIndex = plays.findIndex((p) => p.tone !== "period");
  const featured = featuredIndex >= 0 ? plays[featuredIndex] : null;
  if (!featured) return null;
  const leadIn = plays.slice(0, featuredIndex);
  const rest = plays.slice(featuredIndex + 1, featuredIndex + 12);

  return (
    <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e8e4d9]">
          {g.live ? "Latest" : "Recent plays"}
        </h2>
        {g.live ? (
          <span className="text-alert inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
            <span className="bg-alert h-1.5 w-1.5 animate-pulse rounded-full" /> Live
          </span>
        ) : null}
      </div>
      {leadIn.map((p) => (
        <PeriodRow key={p.id} play={p} />
      ))}
      <FeaturedPlay g={g} play={featured} />
      {rest.length > 0 ? (
        <ul className="max-h-[28rem] divide-y divide-white/[0.05] overflow-y-auto border-t border-white/[0.06]">
          {rest.map((p) =>
            p.tone === "period" ? (
              <PeriodRow key={p.id} play={p} as="li" />
            ) : (
              <PlayRow key={p.id} g={g} play={p} />
            ),
          )}
        </ul>
      ) : null}
    </section>
  );
}

function PeriodRow({ play, as: Tag = "div" }: { play: CfbPlay; as?: "div" | "li" }) {
  return (
    <Tag className="flex items-center gap-3 bg-white/[0.025] px-4 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">{play.text}</span>
      <span className="h-px flex-1 bg-white/[0.06]" />
    </Tag>
  );
}

function FeaturedPlay({ g, play }: { g: CfbGameDetail; play: CfbPlay }) {
  const possession = sideFor(g, play.possessionTeamId);
  const scorer = sideFor(g, play.scoringTeamId) ?? (play.tone === "score" ? possession : null);
  const accent = toneAccent(play, scorer, possession);
  const logo = (play.tone === "score" ? scorer : possession)?.logo ?? possession?.logo;
  const emphasis = play.tone === "score" || play.tone === "penalty" || play.tone === "turnover";
  return (
    <div
      className="relative flex items-start gap-3 px-4 py-3.5"
      style={
        accent
          ? { background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 16%, transparent), transparent 62%)` }
          : undefined
      }
    >
      {accent ? <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} /> : null}
      {logo ? (
        <LogoPlate src={logo} className="mt-0.5 h-10 w-10" />
      ) : (
        <span className="w-10 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <PlayMeta play={play} />
        <p className={cn("mt-1.5 text-[15px] leading-snug", emphasis ? "font-semibold text-cream" : "text-cream")}>
          {play.text}
        </p>
        {play.detail ? <p className="mt-1 text-[12.5px] leading-snug text-[#b7c0d4]">{play.detail}</p> : null}
      </div>
      {play.scoringPlay ? <ScoreChip g={g} play={play} scoring={scoringSide(g, play)} /> : null}
    </div>
  );
}

function PlayRow({ g, play }: { g: CfbGameDetail; play: CfbPlay }) {
  const possession = sideFor(g, play.possessionTeamId);
  const scorer = sideFor(g, play.scoringTeamId) ?? (play.tone === "score" ? possession : null);
  const accent = toneAccent(play, scorer, possession);
  const logo = (play.tone === "score" ? scorer : possession)?.logo ?? possession?.logo;
  const emphasis = play.tone === "score" || play.tone === "penalty" || play.tone === "turnover";
  const quiet = play.tone === "timeout";
  return (
    <li
      className="relative flex items-start gap-2.5 px-4 py-2.5"
      style={
        accent
          ? { background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 12%, transparent), transparent 58%)` }
          : undefined
      }
    >
      {accent ? <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} /> : null}
      {logo ? <LogoPlate src={logo} className="mt-0.5 h-6 w-6" /> : <span className="w-6 shrink-0" />}
      <div className="min-w-0 flex-1">
        <PlayMeta play={play} />
        <p
          className={cn(
            "mt-1 text-[13px] leading-snug",
            quiet ? "text-[#a8b0c2]" : emphasis ? "font-semibold text-cream" : "text-[#c8cdd8]",
          )}
        >
          {play.text}
        </p>
        {play.detail ? <p className="mt-0.5 text-[12px] leading-snug text-[#b7c0d4]">{play.detail}</p> : null}
      </div>
      {play.scoringPlay && play.awayScore != null && play.homeScore != null ? (
        <span className="numeral text-chalk shrink-0 pt-0.5 text-[12px]">
          {play.awayScore}–{play.homeScore}
        </span>
      ) : null}
    </li>
  );
}
