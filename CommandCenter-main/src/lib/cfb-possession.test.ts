/**
 * Run with: node --experimental-strip-types src/lib/cfb-possession.test.ts
 * from CommandCenter-main/.
 */
import { cfbPossessionTeamId } from "./cfb-possession.ts";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const flaReturn = {
  possession: "142",
  downDistanceText: "1st & 10",
  yardLine: 69,
  lastPlay: {
    type: { text: "Kickoff" },
    scoringPlay: false,
    text: "B.Reus kickoff 65 yards to the Gators00 L.Montgomery return 31 yards to the Gators31",
    team: { id: "142" },
    start: { team: { id: "142" } },
    end: { team: { id: "57" }, yardLine: 69, possessionText: "FLA 31" },
  },
};

assertEqual(cfbPossessionTeamId(flaReturn), "57", "stale kicking-team flag yields to the return");

assertEqual(
  cfbPossessionTeamId({
    lastPlay: {
      type: { text: "Kickoff" },
      team: { id: "120" },
      start: { team: { id: "158" } },
      end: { team: { id: "120" } },
    },
  }),
  "120",
  "a kickoff whose last-play team is already the receiver stays there",
);

assertEqual(
  cfbPossessionTeamId({
    possession: "57",
    lastPlay: {
      type: { text: "Kickoff" },
      team: { id: "142" },
      start: { team: { id: "142" } },
      end: { team: { id: "57" } },
    },
  }),
  "57",
  "an updated possession flag is kept",
);

assertEqual(
  cfbPossessionTeamId({
    possession: "142",
    lastPlay: {
      type: { text: "Kickoff" },
      scoringPlay: false,
      team: { id: "142" },
      start: { team: { id: "142" } },
      end: { team: { id: "142" } },
    },
  }),
  "142",
  "an onside kick recovered by the kicking team stays with them",
);

assertEqual(
  cfbPossessionTeamId({
    possession: "142",
    lastPlay: {
      type: { text: "Kickoff" },
      scoringPlay: true,
      text: "kickoff return for a touchdown",
      team: { id: "57" },
      start: { team: { id: "142" } },
      end: { team: { id: "57" } },
    },
  }),
  "142",
  "a scoring return does not open an offensive drive",
);

assertEqual(
  cfbPossessionTeamId({
    possession: "256",
    lastPlay: {
      type: { text: "Rush" },
      team: { id: "256" },
      start: { team: { id: "256" } },
      end: { team: { id: "256" } },
    },
  }),
  "256",
  "a rush keeps the offense",
);

assertEqual(
  cfbPossessionTeamId({
    lastPlay: {
      type: { text: "Timeout" },
      text: "Timeout Missouri",
      team: { id: "57" },
      start: { team: { id: "142" } },
      end: { team: { id: "57" } },
    },
  }),
  "57",
  "a timeout keeps the team that had the ball",
);

assertEqual(
  cfbPossessionTeamId({
    lastPlay: {
      type: { text: "Punt Return" },
      team: { id: "25" },
      start: { team: { id: "25" } },
      end: { team: { id: "2439" } },
    },
  }),
  "2439",
  "a punt return gives the ball to the receiving team",
);

console.log("cfb-possession.test.ts ok");
