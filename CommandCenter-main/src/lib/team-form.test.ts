/**
 * Run with: node --experimental-strip-types src/lib/team-form.test.ts
 * from CommandCenter-main/.
 */
import {
  formatDivisionPlace,
  isBareConferenceLabel,
  shortDivisionLabel,
  standingLineFromEspnTree,
} from "./division-place.ts";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(shortDivisionLabel("American Football Conference West Division") === "AFC West", "AFC West");
assert(shortDivisionLabel("National League Central") === "NL Central", "NL Central");
assert(isBareConferenceLabel("AFC") === true, "bare AFC");
assert(isBareConferenceLabel("AFC West") === false, "division is not bare");
assert(formatDivisionPlace(1, "AFC West") === "1st AFC West", "1st AFC West");
assert(formatDivisionPlace(2, "American Football Conference") === null, "omit bare AFC");

const tree = {
  children: [
    {
      name: "American Football Conference",
      standings: {
        entries: [{ team: { id: "12" } }, { team: { id: "13" } }, { team: { id: "24" } }],
      },
      children: [
        {
          name: "AFC West",
          standings: {
            entries: [{ team: { id: "12" } }, { team: { id: "13" } }, { team: { id: "24" } }, { team: { id: "7" } }],
          },
        },
      ],
    },
  ],
};

assert(standingLineFromEspnTree(tree, "12") === "1st AFC West", "KC is 1st in the smallest group");
assert(standingLineFromEspnTree(tree, "13") === "2nd AFC West", "LV is 2nd in AFC West");
assert(standingLineFromEspnTree(tree, "99") === null, "missing club");

const conferenceOnly = {
  children: [
    {
      name: "American Football Conference",
      standings: { entries: [{ team: { id: "12" } }, { team: { id: "13" } }] },
    },
  ],
};
assert(standingLineFromEspnTree(conferenceOnly, "12") === null, "do not print bare AFC");

console.log("team-form.test.ts ok");
