/**
 * Album gate for @FinalsAndStats_bot.
 *
 * Which games fire a Telegram photo is still `select.ts` (favorites + RUWT).
 * This module only decides single photo vs two-page album: a game gets the
 * album when a Command Center favorite team and/or favorite player is in it.
 *
 * Stores (same ones Sports / RUWT already read — do not invent another):
 *   public.favorite_sports_teams
 *   public.favorite_sports_players
 *   sports_push_subscriptions.favorites  (board team ids)
 *   TELEGRAM_FINALS_FAVORITES             (optional team-id override)
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { FinalBoxPlayer, FinalCard, FinalSide } from "./card.ts";
import { parseFavoriteTokens, type FavoriteToken } from "./select.ts";

export type FavoriteTeam = {
  sport: string;
  teamId: string;
  abbrev: string | null;
  names: string[];
};

export type FavoritePlayer = {
  sport: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  position: string | null;
};

export type AlbumFavorites = {
  teams: FavoriteTeam[];
  players: FavoritePlayer[];
};

export type FeaturedLine = {
  label: string;
  text: string;
};

export type FeaturedPlayer = {
  playerId: string;
  name: string;
  teamAbbrev: string;
  position: string | null;
  lines: FeaturedLine[];
  photoUrl: string | null;
  photoData: string | null;
};

export type AlbumDecision = {
  album: boolean;
  reason: "team" | "player" | "both" | null;
  teams: FavoriteTeam[];
  featured: FeaturedPlayer[];
  teamPerformers: FinalBoxPlayer[];
};

/** DEFAULT_FAVORITES ids/names for the four finals sports. */
export const FINALS_TEAM_CATALOG: {
  sport: string;
  espnId: string;
  abbrev: string;
  names: string[];
}[] = [
  { sport: "mlb", espnId: "24", abbrev: "STL", names: ["st louis cardinals", "cardinals"] },
  { sport: "nhl", espnId: "19", abbrev: "STL", names: ["st louis blues", "blues"] },
  { sport: "cfb", espnId: "142", abbrev: "MIZ", names: ["mizzou football", "missouri tigers", "mizzou"] },
  { sport: "cfb", espnId: "2623", abbrev: "MOST", names: ["missouri state football", "missouri state bears", "missouri state"] },
  { sport: "nfl", espnId: "8", abbrev: "DET", names: ["detroit lions", "lions"] },
  { sport: "nfl", espnId: "12", abbrev: "KC", names: ["kansas city chiefs", "chiefs"] },
  { sport: "nfl", espnId: "6", abbrev: "DAL", names: ["dallas cowboys", "cowboys"] },
];

const STAFF_POSITION = /^(coach|manager|gm|general manager)$/i;

export function foldName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = foldName(a);
  const y = foldName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xs = x.split(" ");
  const ys = y.split(" ");
  const lastX = xs[xs.length - 1] ?? "";
  const lastY = ys[ys.length - 1] ?? "";
  if (!lastX || lastX !== lastY || lastX.length < 3) return false;
  const firstX = xs[0] ?? "";
  const firstY = ys[0] ?? "";
  if (!firstX || !firstY) return false;
  if (firstX.length === 1 || firstY.length === 1) return firstX[0] === firstY[0];
  return firstX === firstY;
}

export function finalsSport(sport?: string | null, league?: string | null): string | null {
  const s = (sport ?? "").toLowerCase().trim();
  const l = (league ?? "").toLowerCase().trim();
  if (s === "mlb" || l === "mlb" || s === "baseball") return "mlb";
  if (s === "nhl" || l === "nhl" || s === "hockey") return "nhl";
  if (s === "nfl" || l === "nfl") return "nfl";
  if (s === "cfb" || l === "cfb") return "cfb";
  if (s === "football") {
    if (l === "nfl") return "nfl";
    if (l === "ncaa" || l === "cfb" || l.includes("college")) return "cfb";
    return null;
  }
  return null;
}

export function isPerformerPosition(position: string | null | undefined): boolean {
  return !STAFF_POSITION.test((position ?? "").trim());
}

export function catalogTeam(name: string, sport: string): (typeof FINALS_TEAM_CATALOG)[number] | null {
  const folded = foldName(name);
  if (!folded) return null;
  return (
    FINALS_TEAM_CATALOG.find(
      (row) => row.sport === sport && row.names.some((alias) => folded === alias || folded.includes(alias) || alias.includes(folded)),
    ) ?? null
  );
}

function uniqueNames(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const text = (value ?? "").trim();
    if (!text) continue;
    const key = foldName(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function teamFromBoardName(teamName: string, sportRaw?: string | null, league?: string | null): FavoriteTeam | null {
  const sport = finalsSport(sportRaw, league);
  if (!sport) return null;
  const catalog = catalogTeam(teamName, sport);
  return {
    sport,
    teamId: catalog?.espnId ?? "",
    abbrev: catalog?.abbrev ?? null,
    names: uniqueNames([teamName, catalog?.abbrev, ...(catalog?.names ?? [])]),
  };
}

export function teamFromPush(sport: string, teamId: string, shortName?: string | null): FavoriteTeam | null {
  const league = sport === "cfb" ? "ncaa" : sport;
  const mapped = finalsSport(sport, league);
  if (!mapped || !teamId) return null;
  const catalog = FINALS_TEAM_CATALOG.find((row) => row.sport === mapped && row.espnId === teamId) ?? null;
  return {
    sport: mapped,
    teamId,
    abbrev: catalog?.abbrev ?? null,
    names: uniqueNames([shortName, catalog?.abbrev, ...(catalog?.names ?? [])]),
  };
}

export function teamFromToken(token: FavoriteToken): FavoriteTeam | null {
  const digits = token.token.replace(/\D/g, "");
  if (digits) return teamFromPush(token.sport, digits, token.token);
  const catalog = FINALS_TEAM_CATALOG.find(
    (row) => row.sport === token.sport && (row.abbrev.toLowerCase() === token.token || row.names.includes(foldName(token.token))),
  );
  if (!catalog) {
    return { sport: token.sport, teamId: "", abbrev: token.token.toUpperCase(), names: [token.token] };
  }
  return {
    sport: catalog.sport,
    teamId: catalog.espnId,
    abbrev: catalog.abbrev,
    names: [...catalog.names],
  };
}

export function playerFromRow(row: {
  player_id?: string;
  playerId?: string;
  player_name?: string;
  playerName?: string;
  team_id?: string | null;
  teamId?: string | null;
  team_name?: string | null;
  teamName?: string | null;
  sport?: string | null;
  league?: string | null;
  position?: string | null;
}): FavoritePlayer | null {
  const sport = finalsSport(row.sport, row.league);
  const playerId = String(row.player_id ?? row.playerId ?? "").trim();
  const playerName = String(row.player_name ?? row.playerName ?? "").trim();
  if (!sport || !playerName) return null;
  return {
    sport,
    playerId,
    playerName,
    teamId: row.team_id != null ? String(row.team_id) : row.teamId != null ? String(row.teamId) : null,
    teamName: row.team_name ?? row.teamName ?? null,
    position: row.position ?? null,
  };
}

function mergeTeams(rows: FavoriteTeam[]): FavoriteTeam[] {
  const byKey = new Map<string, FavoriteTeam>();
  for (const row of rows) {
    const key = `${row.sport}:${row.teamId || foldName(row.names[0] ?? "")}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...row, names: [...row.names] });
      continue;
    }
    prev.teamId = prev.teamId || row.teamId;
    prev.abbrev = prev.abbrev || row.abbrev;
    prev.names = uniqueNames([...prev.names, ...row.names]);
  }
  return [...byKey.values()];
}

export function sideHitsTeam(side: FinalSide, team: FavoriteTeam): boolean {
  if (team.teamId && side.teamId && team.teamId === side.teamId) return true;
  if (team.abbrev && side.abbrev && team.abbrev.toLowerCase() === side.abbrev.toLowerCase()) return true;
  const sideFold = foldName(side.name);
  for (const name of team.names) {
    const folded = foldName(name);
    if (!folded) continue;
    if (folded === sideFold || folded === foldName(side.abbrev)) return true;
    if (folded.length >= 5 && (sideFold.includes(folded) || folded.includes(sideFold))) return true;
  }
  return false;
}

export function teamHitsCard(card: FinalCard, team: FavoriteTeam): boolean {
  if (team.sport !== card.sport) return false;
  return sideHitsTeam(card.away, team) || sideHitsTeam(card.home, team);
}

function boxHits(card: FinalCard): Array<{
  playerId: string;
  name: string;
  shortName: string;
  teamAbbrev: string;
  position: string | null;
  group: string;
  groupLabel: string;
  line: string;
  photoUrl: string | null;
  photoData: string | null;
}> {
  const out: Array<{
    playerId: string;
    name: string;
    shortName: string;
    teamAbbrev: string;
    position: string | null;
    group: string;
    groupLabel: string;
    line: string;
    photoUrl: string | null;
    photoData: string | null;
  }> = [];
  for (const row of card.boxPlayers ?? []) {
    out.push({
      playerId: row.playerId,
      name: row.name,
      shortName: row.shortName,
      teamAbbrev: row.teamAbbrev,
      position: row.position,
      group: row.group,
      groupLabel: row.groupLabel,
      line: row.line,
      photoUrl: row.photoUrl,
      photoData: row.photoData,
    });
  }
  for (const row of card.leaders) {
    out.push({
      playerId: row.playerId ?? "",
      name: row.name,
      shortName: row.name,
      teamAbbrev: row.teamAbbrev,
      position: null,
      group: row.group,
      groupLabel: row.groupLabel,
      line: row.line,
      photoUrl: row.photoUrl ?? null,
      photoData: row.photoData ?? null,
    });
  }
  for (const row of card.threeStars) {
    out.push({
      playerId: row.playerId ?? "",
      name: row.name,
      shortName: row.name,
      teamAbbrev: row.teamAbbrev,
      position: row.position,
      group: "stars",
      groupLabel: "Three Stars",
      line: row.line,
      photoUrl: row.photoUrl,
      photoData: row.photoData,
    });
  }
  for (const row of card.goalies) {
    out.push({
      playerId: row.playerId ?? "",
      name: row.name,
      shortName: row.name,
      teamAbbrev: row.teamAbbrev,
      position: "G",
      group: "goalies",
      groupLabel: "Goalies",
      line: row.line,
      photoUrl: row.photoUrl,
      photoData: row.photoData,
    });
  }
  for (const side of card.mlbBox ? [card.mlbBox.batting.away, card.mlbBox.batting.home, card.mlbBox.pitching.away, card.mlbBox.pitching.home] : []) {
    const pitching = side.labels.includes("IP");
    for (const row of side.rows) {
      out.push({
        playerId: row.playerId ?? "",
        name: row.name,
        shortName: row.name,
        teamAbbrev: side.abbrev,
        position: row.pos || null,
        group: pitching ? "pitching" : "batting",
        groupLabel: pitching ? "Pitching" : "Batting",
        line: pitching
          ? ["IP", "H", "ER", "K"]
              .map((key) => {
                const at = side.labels.indexOf(key);
                const value = at >= 0 ? row.cells[at] : "";
                return value && value !== "–" ? `${value} ${key}` : null;
              })
              .filter(Boolean)
              .join(" · ")
          : ["H", "HR", "RBI", "R"]
              .map((key) => {
                const at = side.labels.indexOf(key);
                const value = at >= 0 ? row.cells[at] : "";
                return value && value !== "–" && value !== "0" ? `${value} ${key}` : null;
              })
              .filter(Boolean)
              .join(" · "),
        photoUrl: row.photoUrl ?? null,
        photoData: null,
      });
    }
  }
  return out;
}

export function playerHitsCard(card: FinalCard, player: FavoritePlayer): boolean {
  if (player.sport !== card.sport) return false;
  if (!isPerformerPosition(player.position)) return false;
  const rows = boxHits(card);
  if (player.playerId && rows.some((row) => row.playerId && row.playerId === player.playerId)) return true;
  return rows.some((row) => namesMatch(player.playerName, row.name) || namesMatch(player.playerName, row.shortName));
}

function featuredFrom(card: FinalCard, player: FavoritePlayer): FeaturedPlayer | null {
  if (!playerHitsCard(card, player)) return null;
  const rows = boxHits(card).filter(
    (row) =>
      (player.playerId && row.playerId && row.playerId === player.playerId) ||
      namesMatch(player.playerName, row.name) ||
      namesMatch(player.playerName, row.shortName),
  );
  if (!rows.length) return null;
  const lines: FeaturedLine[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const text = row.line.trim();
    if (!text) continue;
    const key = `${foldName(row.groupLabel)}:${foldName(text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({ label: row.groupLabel, text });
    if (lines.length >= 3) break;
  }
  const best = rows.find((row) => row.photoData || row.photoUrl) ?? rows[0]!;
  return {
    playerId: player.playerId || best.playerId,
    name: player.playerName || best.name,
    teamAbbrev: best.teamAbbrev,
    position: best.position || player.position,
    lines: lines.length ? lines : [{ label: "Line", text: "Played" }],
    photoUrl: best.photoUrl,
    photoData: best.photoData,
  };
}

function teamSideAbbrevs(card: FinalCard, teams: FavoriteTeam[]): Set<string> {
  const out = new Set<string>();
  for (const team of teams) {
    if (sideHitsTeam(card.away, team)) out.add(card.away.abbrev);
    if (sideHitsTeam(card.home, team)) out.add(card.home.abbrev);
  }
  return out;
}

export function decideAlbum(card: FinalCard, board: AlbumFavorites): AlbumDecision {
  const teams = board.teams.filter((team) => teamHitsCard(card, team));
  const featured = board.players
    .filter((player) => isPerformerPosition(player.position))
    .map((player) => featuredFrom(card, player))
    .filter((row): row is FeaturedPlayer => Boolean(row));
  const seen = new Set<string>();
  const uniqueFeatured: FeaturedPlayer[] = [];
  for (const row of featured) {
    const key = foldName(row.name) || row.playerId;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueFeatured.push(row);
  }
  const featuredKeys = new Set(uniqueFeatured.map((row) => foldName(row.name)));
  const abbrevs = teamSideAbbrevs(card, teams);
  const teamPerformers = (card.boxPlayers ?? [])
    .filter((row) => abbrevs.has(row.teamAbbrev) && !featuredKeys.has(foldName(row.name)))
    .slice(0, 8);
  const album = teams.length > 0 || uniqueFeatured.length > 0;
  const reason = album ? (teams.length && uniqueFeatured.length ? "both" : teams.length ? "team" : "player") : null;
  return { album, reason, teams, featured: uniqueFeatured.slice(0, 4), teamPerformers };
}

export function teamsFromBoardRows(
  rows: Array<{ team_name?: string; teamName?: string; sport?: string | null; league?: string | null }>,
): FavoriteTeam[] {
  return mergeTeams(
    rows
      .map((row) => teamFromBoardName(String(row.team_name ?? row.teamName ?? ""), row.sport, row.league))
      .filter((row): row is FavoriteTeam => Boolean(row)),
  );
}

export function teamsFromPushFavorites(raw: unknown): FavoriteTeam[] {
  if (!Array.isArray(raw)) return [];
  const out: FavoriteTeam[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const sport = String(rec.sport ?? "").toLowerCase();
    const teamId = String(rec.teamId ?? "").replace(/\D/g, "");
    const shortName = String(rec.shortName ?? rec.key ?? "").trim();
    const team = teamFromPush(sport, teamId, shortName);
    if (team) out.push(team);
  }
  return mergeTeams(out);
}

export function emptyAlbumFavorites(): AlbumFavorites {
  return { teams: [], players: [] };
}

export function mergeAlbumFavorites(...parts: AlbumFavorites[]): AlbumFavorites {
  const players: FavoritePlayer[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    for (const player of part.players) {
      const key = `${player.sport}:${player.playerId || foldName(player.playerName)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      players.push(player);
    }
  }
  return {
    teams: mergeTeams(parts.flatMap((part) => part.teams)),
    players,
  };
}

export async function loadAlbumFavorites(db: SupabaseClient): Promise<AlbumFavorites> {
  const [teamsRes, playersRes, pushRes] = await Promise.all([
    db.from("favorite_sports_teams").select("team_name, league, sport"),
    db.from("favorite_sports_players").select("player_id, player_name, team_name, team_id, sport, league, position"),
    db.from("sports_push_subscriptions").select("favorites"),
  ]);
  if (teamsRes.error) console.error("finals album teams", teamsRes.error.message);
  if (playersRes.error) console.error("finals album players", playersRes.error.message);
  if (pushRes.error) console.error("finals album push", pushRes.error.message);

  const fromBoard = teamsFromBoardRows((teamsRes.data ?? []) as Array<{ team_name: string; league: string | null; sport: string | null }>);
  const fromPush = mergeTeams(
    (pushRes.data ?? []).flatMap((row) => teamsFromPushFavorites((row as { favorites?: unknown }).favorites)),
  );
  const fromEnv = mergeTeams(parseFavoriteTokens(Deno.env.get("TELEGRAM_FINALS_FAVORITES")).map(teamFromToken).filter((row): row is FavoriteTeam => Boolean(row)));
  const players = ((playersRes.data ?? []) as Array<{
    player_id: string;
    player_name: string;
    team_name: string | null;
    team_id: string | null;
    sport: string | null;
    league: string | null;
    position: string | null;
  }>)
    .map(playerFromRow)
    .filter((row): row is FavoritePlayer => Boolean(row));

  return mergeAlbumFavorites({ teams: fromBoard, players }, { teams: fromPush, players: [] }, { teams: fromEnv, players: [] });
}
