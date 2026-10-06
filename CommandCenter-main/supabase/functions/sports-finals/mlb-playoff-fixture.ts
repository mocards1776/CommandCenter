/**
 * Full-box ALDS fixture matching Josh’s CHW 4–3 CLE Telegram card
 * (Progressive Field, Best of 5, Game 2). Used by sports-finals tests
 * and the finals-alert photo script so before/after PNGs share one box.
 */
import { cardFromSummary, type FinalCard } from "./card.ts";

function espnHeadshot(id: string): { href: string } {
  return { href: `https://a.espncdn.com/i/headshots/mlb/players/full/${id}.png` };
}

function batter(
  name: string,
  pos: string,
  stats: [string, string, string, string, string, string, string],
  starter = true,
  id?: string,
) {
  return {
    starter,
    athlete: {
      id,
      shortName: name,
      position: { abbreviation: pos },
      headshot: id ? espnHeadshot(id) : undefined,
    },
    stats,
  };
}

function pitcher(
  name: string,
  stats: [string, string, string, string, string, string],
  note?: string,
  id?: string,
) {
  return {
    starter: Boolean(note),
    athlete: {
      id,
      shortName: name,
      position: { abbreviation: "P" },
      headshot: id ? espnHeadshot(id) : undefined,
    },
    stats,
    notes: note ? [{ text: note }] : [],
  };
}

const CHW_LOGOS = [
  { href: "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png", rel: ["full", "default"] },
  { href: "https://a.espncdn.com/i/teamlogos/mlb/500-dark/chw.png", rel: ["full", "dark"] },
];
const CLE_LOGOS = [
  { href: "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png", rel: ["full", "default"] },
  { href: "https://a.espncdn.com/i/teamlogos/mlb/500-dark/cle.png", rel: ["full", "dark"] },
];

export function whiteSoxGuardiansPlayoffFixture(): FinalCard {
  const card = cardFromSummary("mlb", "401810002", {
    header: {
      id: "401810002",
      season: { year: 2026, type: 3 },
      competitions: [
        {
          status: { type: { state: "post", completed: true, shortDetail: "Final" } },
          date: "2026-10-05T21:00Z",
          venue: { fullName: "Progressive Field" },
          notes: [{ headline: "ALDS - Game 2" }],
          attendance: 32050,
          competitors: [
            {
              homeAway: "away",
              score: "4",
              hits: 6,
              errors: 1,
              linescores: [0, 0, 0, 1, 0, 3, 0, 0, 0],
              team: {
                id: "4",
                abbreviation: "CHW",
                displayName: "Chicago White Sox",
                color: "27251f",
                alternateColor: "c4ced4",
                logos: CHW_LOGOS,
              },
            },
            {
              homeAway: "home",
              score: "3",
              hits: 4,
              errors: 1,
              linescores: [2, 0, 0, 0, 0, 0, 0, 1, 0],
              team: {
                id: "5",
                abbreviation: "CLE",
                displayName: "Cleveland Guardians",
                color: "00385d",
                alternateColor: "e31937",
                logos: CLE_LOGOS,
              },
            },
          ],
        },
      ],
    },
    gameInfo: {
      venue: { fullName: "Progressive Field" },
      attendance: 32050,
      gameDuration: "3:06",
      weather: { temp: "61", condition: "Clear", wind: "13 mph, In From CF" },
    },
    seasonseries: [
      {
        type: "playoff",
        title: "Playoff Series",
        summary: "CHW leads series 2-0",
        totalCompetitions: 5,
        events: [
          {
            id: "401810001",
            date: "2026-10-03T21:00:00Z",
            status: "post",
            statusType: { state: "post", completed: true },
            competitors: [
              { homeAway: "away", score: "3", winner: true, team: { abbreviation: "CHW" } },
              { homeAway: "home", score: "0", winner: false, team: { abbreviation: "CLE" } },
            ],
          },
          {
            id: "401810002",
            date: "2026-10-05T21:00:00Z",
            status: "post",
            statusType: { state: "post", completed: true },
            competitors: [
              { homeAway: "away", score: "4", winner: true, team: { abbreviation: "CHW" } },
              { homeAway: "home", score: "3", winner: false, team: { abbreviation: "CLE" } },
            ],
          },
          {
            id: "401810003",
            date: "2026-10-07T19:00:00Z",
            status: "pre",
            statusType: { state: "pre", completed: false },
            competitors: [
              { homeAway: "away", team: { abbreviation: "CLE" } },
              { homeAway: "home", team: { abbreviation: "CHW" } },
            ],
          },
          {
            id: "401810004",
            date: "2026-10-08T19:00:00Z",
            status: "pre",
            statusType: { state: "pre", completed: false },
            competitors: [
              { homeAway: "away", team: { abbreviation: "CLE" } },
              { homeAway: "home", team: { abbreviation: "CHW" } },
            ],
          },
          {
            id: "401810005",
            date: "2026-10-10T19:00:00Z",
            status: "pre",
            statusType: { state: "pre", completed: false },
            competitors: [
              { homeAway: "away", team: { abbreviation: "CHW" } },
              { homeAway: "home", team: { abbreviation: "CLE" } },
            ],
          },
        ],
      },
    ],
    boxscore: {
      players: [
        {
          team: { abbreviation: "CHW" },
          statistics: [
            {
              type: "batting",
              labels: ["AB", "R", "H", "RBI", "HR", "BB", "K"],
              athletes: [
                batter("S. Antonacci", "LF", ["4", "0", "0", "0", "0", "0", "1"], true, "5207167"),
                batter("C. Teel", "C", ["4", "1", "1", "0", "0", "0", "2"], true, "4743772"),
                batter("M. Vargas", "3B", ["2", "1", "1", "0", "0", "2", "0"], true, "42453"),
                batter("M. Murakami", "1B", ["4", "0", "1", "0", "0", "0", "1"], true, "4872595"),
                batter("A. Benintendi", "DH", ["4", "0", "0", "0", "0", "0", "2"], true, "34986"),
                batter("R. Grichuk", "DH", ["1", "1", "1", "1", "0", "0", "0"], false, "31399"),
                batter("T. Peters", "CF", ["2", "0", "0", "0", "0", "0", "1"], true, "5085893"),
                batter("T. Pham", "PH", ["1", "0", "0", "0", "0", "0", "0"], false, "31208"),
                batter("B. Doyle", "CF", ["1", "0", "0", "0", "0", "0", "0"], false, "42462"),
                batter("B. Montgomery", "RF", ["4", "1", "2", "2", "0", "0", "2"], true, "4950345"),
                batter("C. Meidroth", "2B", ["4", "0", "1", "1", "0", "0", "1"], true, "5136929"),
                batter("C. Montgomery", "SS", ["3", "0", "0", "0", "0", "1", "2"], true, "4872685"),
              ],
            },
            {
              type: "pitching",
              labels: ["IP", "H", "R", "ER", "BB", "K"],
              athletes: [
                pitcher("A. Kay", ["0.1", "1", "2", "2", "1", "0"], undefined, "40947"),
                pitcher("S. Newcomb", ["2.0", "1", "0", "0", "1", "3"], undefined, "33856"),
                pitcher("S. Burke", ["5.1", "1", "1", "1", "1", "6"], "W, 1-0", "4867679"),
                pitcher("G. Taylor", ["1.1", "1", "0", "0", "0", "0"], "S, 2", "4927630"),
              ],
            },
          ],
        },
        {
          team: { abbreviation: "CLE" },
          statistics: [
            {
              type: "batting",
              labels: ["AB", "R", "H", "RBI", "HR", "BB", "K"],
              athletes: [
                batter("S. Kwan", "CF", ["3", "1", "1", "0", "0", "0", "0"], true, "41996"),
                batter("J. Ramirez", "3B", ["4", "1", "0", "0", "0", "0", "2"], true, "32801"),
                batter("C. DeLautter", "RF", ["4", "0", "2", "0", "0", "1", "0"], true, "4619649"),
                batter("J. Adell", "DH", ["3", "0", "1", "1", "0", "0", "2"], true, "40854"),
                batter("N. Lowe", "1B", ["4", "0", "0", "0", "0", "0", "2"], true, "40538"),
                batter("A. Martinez", "LF", ["3", "0", "0", "0", "0", "1", "1"], true, "42497"),
                batter("T. Bazzana", "2B", ["4", "0", "0", "0", "0", "0", "1"], true, "5007707"),
                batter("B. Bailey", "C", ["3", "0", "0", "0", "0", "0", "1"], true, "4345843"),
                batter("P. Rocchio", "SS", ["3", "0", "0", "0", "0", "0", "0"], true, "41217"),
              ],
            },
            {
              type: "pitching",
              labels: ["IP", "H", "R", "ER", "BB", "K"],
              athletes: [
                pitcher("G. Williams", ["5.0", "4", "2", "2", "3", "11"], undefined, "4345076"),
                pitcher("E. Sabrowski", ["0.2", "1", "2", "2", "1", "0"], "L, 0-1", "5194333"),
                pitcher("S. Armstrong", ["1.1", "0", "0", "0", "0", "1"], undefined, "33499"),
                pitcher("C. Smith", ["1.0", "0", "0", "0", "0", "1"], undefined, "4987924"),
              ],
            },
          ],
        },
      ],
    },
    pickcenter: [
      {
        details: "CLE -1.5",
        spread: 1.5,
        provider: { name: "DraftKings" },
        awayTeamOdds: { favorite: false, moneyLine: 130 },
        homeTeamOdds: { favorite: true, moneyLine: -150 },
        pointSpread: {
          away: { close: { line: "+1.5" } },
          home: { close: { line: "-1.5" } },
        },
      },
    ],
    plays: [
      { id: "t1", period: { number: 1, type: "Top" } },
      { id: "b1", period: { number: 1, type: "Bottom" } },
      { id: "t4", period: { number: 4, type: "Top" } },
      { id: "t6", period: { number: 6, type: "Top" } },
      { id: "b7", period: { number: 7, type: "Bottom" } },
      { id: "b9", period: { number: 9, type: "Bottom" } },
    ],
    winprobability: [
      { homeWinPercentage: 0.55, playId: "t1" },
      { homeWinPercentage: 0.72, playId: "b1" },
      { homeWinPercentage: 0.64, playId: "t4" },
      { homeWinPercentage: 0.22, playId: "t6" },
      { homeWinPercentage: 0.18, playId: "b7" },
      { homeWinPercentage: 0, playId: "b9" },
    ],
  });
  card.daySlot = "Game 1 of 2";
  card.sentAt = "2026-10-06T06:20:00Z";
  return card;
}
