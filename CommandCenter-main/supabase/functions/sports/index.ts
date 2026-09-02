import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  CORS,
  ESPN,
  UA,
  FETCH_MS,
  SEARCH_MS,
  HEAVY_MS,
  json,
  timedFetch,
  fetchBbrefHtml,
  withBudget,
  safePath,
  stripTags,
  moneyDisplay,
  parseMoney,
  pickCurrentSalary,
  parseBbrefTotals,
  scrapeBbref,
  slugifyName,
  SPOTRAC_PLAYER_RE,
  normalizeSpotracUrl,
  spotracUrlForName,
  findSpotracUrl,
  scrapeSpotrac,
  hasContractBits,
  scrapeContract,
  normPerson,
  firstNamesMatch,
  splitPersonName,
  peopleMatch,
  slugMatchesName,
  notePublishedMs,
  scrapeRotoWireNote,
  parseRotoWorldPosts,
  scrapeRotoWorldFeed,
  scrapeRotoWorldNote,
  scrapePlayerBrief,
  findBbrefManagerUrl,
  parseBbrefInt,
  extractBbrefManagerPhoto,
  detectManagerLeash,
  extractBbrefManagerContract,
  extractBbrefInterimRecord,
  scrapeBbrefManager,
  ordinal,
  fetchGoogleNews,
  isRelevantMlbManagerRumor,
  scrapeManagerRumors,
  scrapeBbrefManagerPhoto,
  kalshiDollarProb,
  kalshiMidProb,
  kalshiAmerican,
  scrapeManagerFiredOdds,
  scrapeManagerMotyOdds,
  scrapeNflCoachFiredOdds,
  scrapeCfbCoachFiredOdds,
  type PlayerNewsNote,
  type RotoWorldFeedItem
} from "./lib-a.ts";

import {
  decodeHtmlEntities,
  scrapeGolferSeasonResults,
  scrapeGolferLastWin,
  resolveGolferRotoWireUrl,
  scrapeGolferRotoNotes,
  parsePipelineBio,
  slugifyPlayer,
  scrapeMlbPlayerBio,
  bbrefPageMatchesName,
  loadBbrefPlayerHtml,
  previewTeamCode,
  stripCell,
  parseBbrefPreviewTeamSummary,
  parseBbrefPreviewTable,
  scrapeBbrefGamePreview,
  parseBbrefWarCell,
  extractBbrefWarTables,
  parseBbrefSeasonAndCareerWar,
  WAR_DUMP_TTL_MS,
  normalizeWarName,
  ingestWarDump,
  loadWarDumpIndex,
  warFromDumpIndex,
  scrapeBbrefWarDaily,
  scrapePlayerExtras,
  scrapeFangraphsWar,
  parseCompactMoney,
  type PipelineBio,
  type PipelineRow,
  type WarDumpRec,
  type WarDumpIndex
} from "./lib-b.ts";

import {
  scrapeTeamBbrefSummary,
  scrapeTeamPayroll,
  BBREF_TEAM_ABBREVS,
  parseFaYear,
  isUpcomingFreeAgent,
  scrapeLeaguePayroll,
  scrapePipelineScouting,
  promotionProbFromProjectedPlace,
  americanFromProb,
  scrapeChampionshipPromotionOdds,
  type SoccerPromotionOdd
} from "./lib-c.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }
  if (body.action === "bbref" || body.action === "contract") {
    const name = String(body.name ?? "").trim();
    const hintUrl = body.url != null ? String(body.url) : null;
    const mlbIdRaw = body.mlbId ?? body.playerId;
    const mlbId =
      typeof mlbIdRaw === "number"
        ? mlbIdRaw
        : typeof mlbIdRaw === "string" && /^\d+$/.test(mlbIdRaw)
          ? Number(mlbIdRaw)
          : null;
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      const data =
        body.action === "bbref"
          ? await scrapeBbref(name, mlbId)
          : await scrapeContract(name, hintUrl, mlbId);
      return json(data);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "playerBrief") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(await scrapePlayerBrief(name));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "rotoWorldNews") {
    try {
      return json({ items: await scrapeRotoWorldFeed(3) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerCareer") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeBbrefManager(name),
          { error: "Manager career timed out", name },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerRumors") {
    const name = body.name != null ? String(body.name).trim() : null;
    try {
      return json(await scrapeManagerRumors(name));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerPhoto") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(await scrapeBbrefManagerPhoto(name));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "managerFiredOdds") {
    try {
      return json(await scrapeManagerFiredOdds());
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "managerMotyOdds") {
    try {
      return json(await scrapeManagerMotyOdds());
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "nflCoachFiredOdds") {
    try {
      return json(await scrapeNflCoachFiredOdds());
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "cfbCoachFiredOdds") {
    try {
      return json(await scrapeCfbCoachFiredOdds());
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "championshipPromotionOdds") {
    try {
      return json(
        await withBudget(
          18_000,
          () => scrapeChampionshipPromotionOdds(),
          { error: "Promotion odds timed out", league: "eng.2", items: [] },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), items: [] }, 200);
    }
  }
  if (body.action === "golferSeasonResults") {
    const golferId = String(body.golferId ?? "").trim();
    const year = Number(body.year) || new Date().getUTCFullYear();
    if (!/^\d+$/.test(golferId)) return json({ error: "Bad golferId" }, 400);
    try {
      return json(await scrapeGolferSeasonResults(golferId, year));
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), results: [] }, 200);
    }
  }
  if (body.action === "golferScorecard") {
    const golferId = String(body.golferId ?? "").trim();
    const season = Number(body.season) || new Date().getUTCFullYear();
    let eventId = String(body.eventId ?? "").trim();
    if (!/^\d+$/.test(golferId)) return json({ error: "Bad golferId" }, 400);
    try {
      if (!eventId) {
        const lbRes = await timedFetch(
          `${ESPN}/golf/leaderboard`,
          { headers: { Accept: "application/json" } },
          FETCH_MS,
        );
        if (lbRes.ok) {
          const lb = (await lbRes.json()) as { events?: { id?: string | number; name?: string }[] };
          const ev = lb.events?.[0];
          if (ev?.id != null) eventId = String(ev.id);
          if (ev?.name) body.eventName = ev.name;
        }
      }
      if (!eventId) return json({ error: "No event", rounds: [] }, 200);
      const url =
        `${ESPN}/golf/pga/leaderboard/${eventId}/playersummary?season=${season}&player=${golferId}`;
      const res = await timedFetch(url, { headers: { Accept: "application/json" } }, FETCH_MS);
      const text = await res.text();
      if (!res.ok) {
        return json({ error: `ESPN ${res.status}`, detail: text.slice(0, 200), rounds: [] }, 200);
      }
      const raw = JSON.parse(text) as Record<string, unknown>;
      return json({
        eventId,
        eventName: body.eventName ?? null,
        playerId: golferId,
        ...raw,
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), rounds: [] }, 200);
    }
  }
  if (body.action === "golferLastWin") {
    const golferId = String(body.golferId ?? "").trim();
    if (!/^\d+$/.test(golferId)) return json({ error: "Bad golferId" }, 400);
    try {
      return json({ lastWin: await scrapeGolferLastWin(golferId) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), lastWin: null }, 200);
    }
  }
  if (body.action === "golferRotoNotes") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeGolferRotoNotes(name),
          { error: "RotoWire notes timed out", name, url: null, notes: [] },
        ),
      );
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : String(e), name, url: null, notes: [] },
        200,
      );
    }
  }
  if (body.action === "pipelineScouting") {
    const playerId = Number(body.playerId);
    if (!Number.isFinite(playerId) || playerId <= 0) {
      return json({ error: "Bad playerId" }, 400);
    }
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapePipelineScouting(playerId),
          { error: "Pipeline scouting timed out", playerId, found: false },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), found: false }, 200);
    }
  }
  if (body.action === "pipelineSelection") {
    const slug = String(body.slug ?? "").trim();
    const limit = Math.min(Math.max(Number(body.limit ?? 100) || 100, 1), 100);
    if (!/^sel-pr-\d{4}-[a-z0-9-]+$/i.test(slug)) {
      return json({ error: "Bad slug", rows: [] }, 400);
    }
    const query = `
      query PipelineSelection($slug: String!, $limit: Int) {
        getPlayerRankingsFromSelection(slug: $slug, limit: $limit) {
          rank
          playerEntity {
            position
            player {
              id
              fullName
              primaryPosition { abbreviation }
            }
          }
        }
      }
    `;
    try {
      const res = await timedFetch(
        "https://data-graph.mlb.com/graphql",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Origin: "https://www.mlb.com",
            Referer: "https://www.mlb.com/prospects",
            "User-Agent": UA,
          },
          body: JSON.stringify({ query, variables: { slug, limit } }),
        },
        FETCH_MS,
      );
      if (!res.ok) return json({ rows: [], status: res.status }, 200);
      const payload = (await res.json()) as {
        data?: {
          getPlayerRankingsFromSelection?: {
            rank?: number | null;
            playerEntity?: {
              position?: string | null;
              player?: {
                id?: number | null;
                fullName?: string | null;
                primaryPosition?: { abbreviation?: string | null } | null;
              } | null;
            } | null;
          }[];
        };
      };
      const rows = (payload.data?.getPlayerRankingsFromSelection ?? [])
        .map((row) => {
          const playerId = Number(row.playerEntity?.player?.id);
          const rank = Number(row.rank);
          if (!Number.isFinite(playerId) || playerId <= 0 || !Number.isFinite(rank) || rank <= 0) {
            return null;
          }
          return {
            rank,
            playerId,
            name: row.playerEntity?.player?.fullName ?? null,
            position:
              row.playerEntity?.position ??
              row.playerEntity?.player?.primaryPosition?.abbreviation ??
              null,
          };
        })
        .filter(Boolean);
      return json({ rows, slug });
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : String(e), rows: [] },
        200,
      );
    }
  }
  if (body.action === "playerBio") {
    const playerId = Number(body.playerId);
    const name = String(body.name ?? "").trim();
    if (!Number.isFinite(playerId) || playerId <= 0) return json({ error: "Bad playerId" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeMlbPlayerBio(playerId, name),
          { error: "Player bio timed out", found: false },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e), found: false }, 200);
    }
  }
  if (body.action === "playerWar") {
    const name = String(body.name ?? "").trim();
    const mlbIdRaw = body.mlbId ?? body.playerId;
    const mlbId =
      typeof mlbIdRaw === "number"
        ? mlbIdRaw
        : typeof mlbIdRaw === "string" && /^\d+$/.test(mlbIdRaw)
          ? Number(mlbIdRaw)
          : null;
    const teamAbbrev =
      typeof body.teamAbbrev === "string" && body.teamAbbrev.trim()
        ? body.teamAbbrev.trim().toUpperCase()
        : null;
    if ((name.length < 3 || name.length > 80) && !(mlbId != null && mlbId > 0)) {
      return json({ error: "Bad name" }, 400);
    }
    try {
      const dump = await scrapeBbrefWarDaily({ mlbId, name: name || null });
      if (dump && (dump.seasonWar != null || dump.careerWar != null)) {
        return json({
          source: "bbref-war-daily",
          name: name || null,
          mlbId,
          ...dump,
        });
      }
      const extras = await scrapePlayerExtras(
        name || "Player",
        Boolean(body.isPitcher),
        mlbId,
        teamAbbrev,
      );
      if (extras.seasonWar != null || extras.careerWar != null) {
        return json({
          ...extras,
          name: name || null,
          mlbId,
        });
      }
      return json({ error: "WAR not found", name, mlbId, seasonWar: null, careerWar: null });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "playerExtras") {
    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 80) return json({ error: "Bad name" }, 400);
    const mlbIdRaw = body.mlbId ?? body.playerId;
    const mlbId =
      typeof mlbIdRaw === "number"
        ? mlbIdRaw
        : typeof mlbIdRaw === "string" && /^\d+$/.test(mlbIdRaw)
          ? Number(mlbIdRaw)
          : null;
    const teamAbbrev =
      typeof body.teamAbbrev === "string" && body.teamAbbrev.trim()
        ? body.teamAbbrev.trim().toUpperCase()
        : null;
    try {
      // Do not Promise.race an empty partial — that used to return blank WAR while the
      // scrape was still finishing. timedFetch caps inside scrapePlayerExtras prevent hangs.
      const full = await scrapePlayerExtras(
        name,
        Boolean(body.isPitcher),
        mlbId,
        teamAbbrev,
      );
      return json(full);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "teamBbrefSummary") {
    const abbrev = String(body.abbrev ?? "").trim().toUpperCase();
    const season = Number(body.season) || new Date().getFullYear();
    if (!/^[A-Z0-9]{2,3}$/.test(abbrev)) return json({ error: "Bad abbrev" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeTeamBbrefSummary(abbrev, season),
          { error: "Team summary timed out", abbrev, season },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "bbrefGamePreview") {
    const homeAbbrev = String(body.homeAbbrev ?? "").trim().toUpperCase();
    const awayAbbrev = String(body.awayAbbrev ?? "").trim().toUpperCase();
    const date = String(body.date ?? "").trim();
    const gameNumber = Number(body.gameNumber) || 0;
    if (!homeAbbrev || !awayAbbrev || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "homeAbbrev, awayAbbrev, and date (YYYY-MM-DD) required" }, 400);
    }
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeBbrefGamePreview({ homeAbbrev, awayAbbrev, date, gameNumber }),
          { error: "BBRef game preview timed out", homeAbbrev, awayAbbrev, date },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "teamPayroll") {
    const abbrev = String(body.abbrev ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{2,3}$/.test(abbrev)) return json({ error: "Bad abbrev" }, 400);
    try {
      return json(
        await withBudget(
          HEAVY_MS,
          () => scrapeTeamPayroll(abbrev),
          { error: "Team payroll timed out", abbrev },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  if (body.action === "leaguePayroll") {
    try {
      return json(
        await withBudget(
          55_000,
          () => scrapeLeaguePayroll(),
          { error: "League payroll timed out" },
        ),
      );
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 200);
    }
  }
  const safe = safePath(String(body.path ?? ""));
  if (!safe) return json({ error: "Bad path" }, 400);
  try {
    // Bare Accept header — UA+Referer gets Akamai 403 from some edge IPs.
    const res = await timedFetch(
      `${ESPN}/${safe}`,
      { headers: { Accept: "application/json" } },
      FETCH_MS,
    );
    const text = await res.text();
    if (!res.ok) return json({ error: `ESPN ${res.status}`, detail: text.slice(0, 200) }, 200);
    return new Response(text, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 200);
  }
});
