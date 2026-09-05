/** Yesterday's scores, highlights, and favorite-player lines for the Sports Home Screen. */

import { listFavoritePlayers, type FavoritePlayer } from "./favorite-players";
import {
  chicagoToday,
  fetchFavoritePlayersYesterday,
  mlbHeadshot,
  type FavoriteYesterdayLine,
} from "./mlb";
import {
  DEFAULT_FAVORITES,
  type SportsFavorite,
  type SportsLayout,
  visibleFavorites,
} from "./sports";

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports";

export type YesterdayRecapHighlight = {
  headline: string;
  thumbnail: string | null;
  href: string | null;
};

export type YesterdayRecapGame = {
  id: string;
  sport: "mlb" | "nfl" | "cfb" | "soccer" | "nhl" | "cbb" | "other";
  sportLabel: string;
  headline: string;
  detail: string | null;
  href: string;
  away: {
    name: string;
    abbrev: string;
    logo: string | null;
    score: string | null;
    winner: boolean;
  };
  home: {
    name: string;
    abbrev: string;
    logo: string | null;
    score: string | null;
    winner: boolean;
  };
  highlight: YesterdayRecapHighlight | null;
  favoriteKeys: string[];
};

export type YesterdayRecap = {
  date: string;
  games: YesterdayRecapGame[];
  playerLines: (FavoriteYesterdayLine & { headshot: string })[];
};

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function yyyymmdd(iso: string): string {
  return iso.replace(/-/g, "");
}

type BoardSport = {
  sport: YesterdayRecapGame["sport"];
  label: string;
  path: string;
  hrefFor: (eventId: string) => string;
};

function boardSportsForFavorites(favs: SportsFavorite[]): BoardSport[] {
  const out: BoardSport[] = [];
  const seen = new Set<string>();
  const add = (b: BoardSport) => {
    if (seen.has(b.path)) return;
    seen.add(b.path);
    out.push(b);
  };
  for (const f of favs) {
    if (f.kind !== "team") continue;
    const p = f.espnPath;
    if (p.startsWith("baseball/mlb/")) {
      add({
        sport: "mlb",
        label: "MLB",
        path: "baseball/mlb",
        hrefFor: (id) => `https://www.espn.com/mlb/game/_/gameId/${id}`,
      });
    } else if (p.startsWith("football/nfl/")) {
      add({
        sport: "nfl",
        label: "NFL",
        path: "football/nfl",
        hrefFor: (id) => `/sports/nfl/game/${id}`,
      });
    } else if (p.startsWith("football/college-football/")) {
      add({
        sport: "cfb",
        label: "CFB",
        path: "football/college-football",
        hrefFor: (id) => `/sports/cfb/game/${id}`,
      });
    } else if (p.startsWith("hockey/nhl/")) {
      add({
        sport: "nhl",
        label: "NHL",
        path: "hockey/nhl",
        hrefFor: (id) => `https://www.espn.com/nhl/game/_/gameId/${id}`,
      });
    } else if (p.startsWith("basketball/mens-college-basketball/")) {
      add({
        sport: "cbb",
        label: "CBB",
        path: "basketball/mens-college-basketball",
        hrefFor: (id) =>
          `https://www.espn.com/mens-college-basketball/game/_/gameId/${id}`,
      });
    } else if (p.startsWith("soccer/")) {
      const league = p.split("/")[1];
      if (league) {
        add({
          sport: "soccer",
          label: f.league || "Soccer",
          path: `soccer/${league}`,
          hrefFor: (id) => `/sports/soccer/game/${id}`,
        });
      }
    }
  }
  return out;
}

function favoriteTeamIds(favs: SportsFavorite[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of favs) {
    if (f.kind !== "team") continue;
    const id = f.espnPath.split("/").pop();
    if (!id) continue;
    const list = map.get(id) ?? [];
    list.push(f.key);
    map.set(id, list);
  }
  return map;
}

type EspnBoardEvent = {
  id?: string;
  name?: string;
  shortName?: string;
  competitions?: {
    status?: { type?: { completed?: boolean; description?: string; detail?: string } };
    competitors?: {
      homeAway?: string;
      score?: string;
      winner?: boolean;
      team?: {
        id?: string;
        displayName?: string;
        abbreviation?: string;
        logo?: string;
        logos?: { href?: string }[];
      };
    }[];
  }[];
};

async function fetchBoard(path: string, dates: string): Promise<EspnBoardEvent[]> {
  const res = await fetch(`${ESPN_SITE}/${path}/scoreboard?dates=${dates}&limit=300`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`scoreboard ${path} ${res.status}`);
  const data = (await res.json()) as { events?: EspnBoardEvent[] };
  return data.events ?? [];
}

async function fetchHighlight(
  path: string,
  eventId: string,
): Promise<YesterdayRecapHighlight | null> {
  try {
    const res = await fetch(`${ESPN_SITE}/${path}/summary?event=${encodeURIComponent(eventId)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as {
      highlights?: {
        headline?: string;
        thumbnail?: string;
        image?: string;
        links?: { href?: string; rel?: string[] }[];
      }[];
      videos?: {
        headline?: string;
        thumbnail?: string;
        links?: { href?: string; rel?: string[] }[];
      }[];
    };
    const clip =
      (raw.highlights ?? []).find((h) => h.headline) ??
      (raw.videos ?? []).find((v) => /highlight|recap/i.test(v.headline ?? "")) ??
      (raw.videos ?? [])[0];
    if (!clip?.headline) return null;
    const href =
      clip.links?.find((l) => l.rel?.includes("web") || l.rel?.includes("desktop"))?.href ??
      clip.links?.[0]?.href ??
      null;
    const thumbnail =
      ("thumbnail" in clip && typeof clip.thumbnail === "string" ? clip.thumbnail : null) ??
      ("image" in clip && typeof (clip as { image?: string }).image === "string"
        ? (clip as { image?: string }).image!
        : null);
    return {
      headline: clip.headline,
      thumbnail,
      href,
    };
  } catch {
    return null;
  }
}

export async function fetchYesterdayRecap(opts: {
  layout: SportsLayout;
  userId: string | null | undefined;
}): Promise<YesterdayRecap> {
  const date = addDaysIso(chicagoToday(), -1);
  const dates = yyyymmdd(date);
  const visible = visibleFavorites(opts.layout);
  const teamFavs = (visible.length ? visible : DEFAULT_FAVORITES).filter((f) => f.kind === "team");
  const idToKeys = favoriteTeamIds(teamFavs);
  const boards = boardSportsForFavorites(teamFavs);

  const games: YesterdayRecapGame[] = [];
  await Promise.all(
    boards.map(async (board) => {
      try {
        const events = await fetchBoard(board.path, dates);
        for (const ev of events) {
          const id = String(ev.id ?? "");
          if (!id) continue;
          const comp = ev.competitions?.[0];
          if (!comp?.status?.type?.completed) continue;
          const awayC = comp.competitors?.find((c) => c.homeAway === "away");
          const homeC = comp.competitors?.find((c) => c.homeAway === "home");
          if (!awayC?.team?.id || !homeC?.team?.id) continue;
          const keys = [
            ...(idToKeys.get(String(awayC.team.id)) ?? []),
            ...(idToKeys.get(String(homeC.team.id)) ?? []),
          ];
          if (!keys.length) continue;

          const side = (c: NonNullable<typeof awayC>) => ({
            name: c.team?.displayName ?? "—",
            abbrev: (c.team?.abbreviation ?? "—").toUpperCase(),
            logo: c.team?.logo ?? c.team?.logos?.[0]?.href ?? null,
            score: c.score ?? null,
            winner: Boolean(c.winner),
          });
          const away = side(awayC);
          const home = side(homeC);
          const scoreBit =
            away.score != null && home.score != null
              ? `${away.abbrev} ${away.score}–${home.score} ${home.abbrev}`
              : (ev.shortName ?? ev.name ?? "Final");

          games.push({
            id: `${board.sport}-${id}`,
            sport: board.sport,
            sportLabel: board.label,
            headline: scoreBit,
            detail: comp.status?.type?.detail ?? comp.status?.type?.description ?? "Final",
            href: board.hrefFor(id),
            away,
            home,
            highlight: null,
            favoriteKeys: keys,
          });
        }
      } catch {
        /* board optional */
      }
    }),
  );

  const withHighlights: YesterdayRecapGame[] = [];
  for (let i = 0; i < games.length; i += 4) {
    const chunk = games.slice(i, i + 4);
    const enriched = await Promise.all(
      chunk.map(async (g) => {
        const eventId = g.id.slice(g.sport.length + 1);
        const path = boards.find((b) => b.sport === g.sport)?.path;
        if (!path) return g;
        const highlight = await fetchHighlight(path, eventId);
        return { ...g, highlight };
      }),
    );
    withHighlights.push(...enriched);
  }

  withHighlights.sort(
    (a, b) => a.sportLabel.localeCompare(b.sportLabel) || a.headline.localeCompare(b.headline),
  );

  let playerLines: (FavoriteYesterdayLine & { headshot: string })[] = [];
  if (opts.userId) {
    try {
      const favorites = await listFavoritePlayers(opts.userId);
      const mlbFavs = favorites.filter(
        (f: FavoritePlayer) =>
          !f.sport ||
          /mlb|baseball/i.test(f.sport) ||
          !f.league ||
          /mlb/i.test(f.league ?? ""),
      );
      const y = await fetchFavoritePlayersYesterday(
        mlbFavs.map((f) => ({
          playerId: f.playerId,
          playerName: f.playerName,
          teamName: f.teamName,
          position: f.position,
        })),
      );
      playerLines = y.lines
        .filter((l) => l.played)
        .map((l) => ({
          ...l,
          headshot: mlbHeadshot(l.playerId, 213),
        }));
    } catch {
      playerLines = [];
    }
  }

  return { date, games: withHighlights, playerLines };
}
