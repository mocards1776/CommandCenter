/**
 * Full-box ALDS fixture matching Josh’s CHW 4–3 CLE Telegram card
 * (Progressive Field, Best of 5, Game 2). Used by sports-finals tests
 * and the finals-alert photo script so before/after PNGs share one box.
 */
import { cardFromSummary, type FinalCard } from "./card.ts";

function batter(
  name: string,
  pos: string,
  stats: [string, string, string, string, string, string, string],
  starter = true,
) {
  return {
    starter,
    athlete: { shortName: name, position: { abbreviation: pos } },
    stats,
  };
}

function pitcher(name: string, stats: [string, string, string, string, string, string], note?: string) {
  return {
    starter: Boolean(note),
    athlete: { shortName: name, position: { abbreviation: "P" } },
    stats,
    notes: note ? [{ text: note }] : [],
  };
}

export function whiteSoxGuardiansPlayoffFixture(): FinalCard {
  return cardFromSummary("mlb", "401810002", {
    header: {
      id: "401810002",
      season: { year: 2026, type: 3 },
      competitions: [
        {
          status: { type: { state: "post", completed: true, shortDetail: "Final" } },
          date: "2026-10-05T21:00Z",
          venue: { fullName: "Progressive Field" },
          notes: [{ headline: "ALDS - Game 2" }],
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
              },
            },
            {
              homeAway: "home",
              score: "3",
              hits: 4,
              errors: 1,
              linescores: [2, 0, 0, 0, 0, 0, 1, 0, 0],
              team: {
                id: "5",
                abbreviation: "CLE",
                displayName: "Cleveland Guardians",
                color: "00385d",
                alternateColor: "e31937",
              },
            },
          ],
        },
      ],
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
                batter("S. Antonacci", "LF", ["4", "0", "0", "0", "0", "0", "1"]),
                batter("C. Teel", "C", ["4", "1", "1", "0", "0", "0", "2"]),
                batter("M. Vargas", "3B", ["2", "1", "1", "0", "0", "2", "0"]),
                batter("M. Murakami", "1B", ["4", "0", "1", "0", "0", "0", "1"]),
                batter("A. Benintendi", "DH", ["4", "0", "0", "0", "0", "0", "2"]),
                batter("R. Grichuk", "DH", ["1", "1", "1", "1", "0", "0", "0"], false),
                batter("T. Peters", "CF", ["2", "0", "0", "0", "0", "0", "1"]),
                batter("T. Pham", "PH", ["1", "0", "0", "0", "0", "0", "0"], false),
                batter("B. Doyle", "CF", ["1", "0", "0", "0", "0", "0", "0"], false),
                batter("B. Montgomery", "RF", ["4", "1", "2", "2", "0", "0", "2"]),
                batter("C. Meidroth", "2B", ["4", "0", "1", "1", "0", "0", "1"]),
                batter("C. Montgomery", "SS", ["3", "0", "0", "0", "0", "1", "2"]),
              ],
            },
            {
              type: "pitching",
              labels: ["IP", "H", "R", "ER", "BB", "K"],
              athletes: [
                pitcher("A. Kay", ["0.1", "1", "2", "2", "1", "0"]),
                pitcher("S. Newcomb", ["2.0", "1", "0", "0", "1", "3"]),
                pitcher("S. Burke", ["5.1", "1", "1", "1", "1", "6"], "W"),
                pitcher("G. Taylor", ["1.1", "1", "0", "0", "1", "1"]),
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
                batter("S. Kwan", "CF", ["3", "1", "1", "0", "0", "0", "0"]),
                batter("J. Ramirez", "3B", ["4", "1", "0", "0", "0", "0", "2"]),
                batter("C. DeLautter", "RF", ["4", "0", "2", "0", "0", "1", "0"]),
                batter("J. Adell", "DH", ["3", "0", "1", "1", "0", "0", "2"]),
                batter("N. Lowe", "1B", ["4", "0", "0", "0", "0", "0", "2"]),
                batter("A. Martinez", "LF", ["3", "0", "0", "0", "0", "1", "1"]),
                batter("T. Bazzana", "2B", ["4", "0", "0", "0", "0", "0", "1"]),
                batter("B. Bailey", "C", ["3", "0", "0", "0", "0", "0", "1"]),
                batter("P. Rocchio", "SS", ["3", "0", "0", "0", "0", "0", "0"]),
              ],
            },
            {
              type: "pitching",
              labels: ["IP", "H", "R", "ER", "BB", "K"],
              athletes: [
                pitcher("G. Williams", ["5.0", "4", "2", "2", "3", "11"]),
                pitcher("E. Sabrowski", ["0.2", "1", "2", "2", "1", "0"]),
                pitcher("S. Armstrong", ["1.1", "0", "0", "0", "0", "1"]),
                pitcher("C. Smith", ["1.0", "0", "0", "0", "0", "1"]),
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
}
