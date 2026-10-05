import { isBreakStatus } from "./clock.ts";
import type { HeatAlertCard, HeatSport } from "./types.ts";

export function leagueLabel(sport: HeatSport): string {
  switch (sport) {
    case "nfl":
      return "NFL";
    case "cfb":
      return "CFB";
    case "nhl":
      return "NHL";
    case "mlb":
      return "MLB";
    case "soccer":
      return "SOCCER";
  }
}

export function phaseLabel(card: HeatAlertCard): string {
  if (card.live) return "LIVE";
  if (card.final) return "FINAL";
  return "PREVIEW";
}

function possessionAbbrev(card: HeatAlertCard): string | null {
  const id = card.football?.possessionTeamId;
  if (id == null) return null;
  if (String(id) === String(card.away.id)) return card.away.abbrev;
  if (String(id) === String(card.home.id)) return card.home.abbrev;
  return null;
}

/** Down-and-distance line drawn inside the graphic. Heat copy stays in the caption. */
export function situationLine(card: HeatAlertCard): string {
  const football = card.football;
  const down = football?.downDistanceText?.replace(/\s+/g, " ").trim() || "";
  const poss = possessionAbbrev(card);
  if (down && !isBreakStatus(down)) {
    return poss ? `${down}  ·  ${poss} ball` : down;
  }
  if (poss && card.live && !isBreakStatus(card.detail)) return `${poss} ball`;
  if (isBreakStatus(card.detail) || isBreakStatus(down)) {
    return (isBreakStatus(card.detail) ? card.detail : down).replace(/\s+/g, " ").trim();
  }
  if (card.diamond && card.live) {
    const inning = (card.detail || "").replace(/\s+/g, " ").trim();
    if (inning) return inning;
    const spot = card.diamond;
    const outs = `${spot.outs} out${spot.outs === 1 ? "" : "s"}`;
    return `${spot.balls}-${spot.strikes}  ·  ${outs}`;
  }
  if (card.final) return card.detail && !/^final$/i.test(card.detail) ? card.detail : "Final";
  if (card.live) return card.detail || "Live";
  const kick =
    card.sport === "nhl" ? "Puck drop" : card.sport === "mlb" ? "First pitch" : "Kickoff";
  return card.when ? `${kick}  ·  ${card.when} CT` : kick;
}

const CHICAGO = "America/Chicago";

/** Same CT stamp as the finals graphic footer. */
export function formatHeatTimestamp(iso: string | null | undefined, fallback: Date = new Date()): string {
  const parsed = iso ? new Date(iso) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
  const stamped = date.toLocaleString("en-US", {
    timeZone: CHICAGO,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return stamped.replace(/\sC[DS]T$/, " CT");
}

export function openGameUrl(origin: string, path: string): string {
  const root = origin.replace(/\/$/, "") || "https://command-center-flax-gamma.vercel.app";
  const href = path.startsWith("/") ? path : `/${path}`;
  return `${root}${href}`;
}

/**
 * Telegram caption. `reason` is RUWT's why-it-fired line (the same chips as the
 * heat push). Game / RUWT links live on the inline keyboard, not in this text.
 */
export function heatAlertCaption(reason: string | null | undefined): string {
  return (reason ?? "").replace(/\s+/g, " ").trim().slice(0, 1024);
}
