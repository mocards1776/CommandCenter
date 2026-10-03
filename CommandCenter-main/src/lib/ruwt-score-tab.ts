import { ruwtItemHref, type UnifiedRuwtItem } from "@/hooks/useRuwtSlate";
import { cfbTeamLogo } from "@/lib/cfb";
import { nflTeamLogo } from "@/lib/nfl";
import { nhlTeamLogo } from "@/lib/nhl";
import { soccerTeamLogo } from "@/lib/soccer";

export type TabSide = { abbrev: string; name: string; logo: string; score: string | null };

export type ScoreTab = {
  key: string;
  href: string;
  away: TabSide;
  home: TabSide;
  status: [string, string | null];
  live: boolean;
  final: boolean;
};

export const RUWT_SPORT_LABEL: Record<UnifiedRuwtItem["sport"], string> = {
  mlb: "MLB",
  nfl: "NFL",
  nhl: "NHL",
  cfb: "CFB",
  soccer: "Soccer",
};

function scoreText(n: number | string | null | undefined): string | null {
  return n == null || n === "" ? null : String(n);
}

export function kickoffLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "12:20 - 2nd" → ["12:20", "2nd"]; ESPN-style two-line clock. */
function splitStatus(label: string): [string, string | null] {
  const parts = label.split(/\s+-\s+/);
  if (parts.length >= 2) return [parts[0]!, parts.slice(1).join(" ")];
  return [label, null];
}

export function ruwtStartIso(item: UnifiedRuwtItem): string | null {
  return item.sport === "mlb" ? item.game.gameDate : (item.game.startIso ?? null);
}

export function toTab(item: UnifiedRuwtItem): ScoreTab {
  const base = { key: item.id, href: ruwtItemHref(item), live: item.game.live, final: item.game.final };
  const pregame = !item.game.live && !item.game.final;

  if (item.sport === "mlb") {
    const g = item.game;
    const logo = (id: number) => `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg`;
    const label = g.live ? g.inning || "Live" : g.final ? "Final" : g.whenShort || "Today";
    return {
      ...base,
      away: { abbrev: g.away.abbrev, name: g.away.name, logo: logo(g.away.teamId), score: scoreText(g.away.score) },
      home: { abbrev: g.home.abbrev, name: g.home.name, logo: logo(g.home.teamId), score: scoreText(g.home.score) },
      status: splitStatus(label),
    };
  }

  const g = item.game;
  const logoFor = (side: typeof g.away): string => {
    if (side.logo) return side.logo;
    switch (item.sport) {
      case "nfl":
        return nflTeamLogo(side.abbrev);
      case "nhl":
        return nhlTeamLogo(side.abbrev);
      case "cfb":
        return cfbTeamLogo(side.teamId);
      default:
        return soccerTeamLogo(side.teamId);
    }
  };
  const when = "whenShort" in g ? g.whenShort : null;
  const label = pregame
    ? (when || kickoffLabel(g.startIso) || g.shortDetail || "Today").replace(/\s+[A-Z]{2,4}T$/, "")
    : g.final
      ? g.shortDetail || "Final"
      : g.shortDetail || g.status || "Live";
  return {
    ...base,
    away: { abbrev: g.away.abbrev, name: g.away.name, logo: logoFor(g.away), score: scoreText(g.away.score) },
    home: { abbrev: g.home.abbrev, name: g.home.name, logo: logoFor(g.home), score: scoreText(g.home.score) },
    status: splitStatus(label),
  };
}
