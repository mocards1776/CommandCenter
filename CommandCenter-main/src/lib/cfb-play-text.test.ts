/**
 * Run with: node --experimental-strip-types src/lib/cfb-play-text.test.ts
 * from CommandCenter-main/.
 */
import { presentCfbPlayText, simplifyCfbPlayText } from "./cfb-play-text.ts";

const assert = {
  equal(actual: unknown, expected: unknown, message?: string) {
    if (actual !== expected) {
      throw new Error(message ?? `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  ok(cond: unknown, message: string) {
    if (!cond) throw new Error(message);
  },
};

function show(label: string, raw: string, hints?: Parameters<typeof presentCfbPlayText>[1]) {
  const copy = presentCfbPlayText(raw, hints);
  console.log(`\n[${label}] ${copy.tone} ${copy.tags.join(",")}`);
  console.log(copy.text);
  if (copy.detail) console.log(`  ${copy.detail}`);
  return copy;
}

const fg = show(
  "fg",
  "(00:01) #80 K.Ferrie field goal attempt from 32 yards GOOD (H: #47 W.Wilkinson, LS: #46 K.Rushing), clock 00:00",
  { type: "Field Goal Good", scoringPlay: true },
);
assert.equal(fg.text, "K. Ferrie field goal good from 32 yards");
assert.equal(fg.tone, "score");
assert.equal(fg.tags.join(","), "FG");
assert.ok(!/H:|LS:|clock/i.test(fg.text), "fg still has kick metadata");

const hold = show(
  "holding",
  "(00:18) Shotgun #1 K.Taylor pass incomplete short left to #7 Z.Ragins thrown to Bama00 PENALTY State Holding (#78 D.Chester) 10 yards from Bama04 to Bama14. NO PLAY",
  { type: "Penalty", penalty: true },
);
assert.equal(
  hold.text,
  "Holding, State (D. Chester), 10 yards from the Bama 4 to the Bama 14.",
);
assert.equal(hold.detail, "No play · K. Taylor pass incomplete short left to Z. Ragins");
assert.equal(hold.tone, "penalty");
assert.ok(!/Bama00|Bama04|Bama14/.test(`${hold.text} ${hold.detail}`), "raw yard codes remain");

const hurry = show(
  "hurry",
  "(00:12) No Huddle-Shotgun #1 K.Taylor pass incomplete short right to #7 Z.Ragins thrown to Bama05 QB hurried by #1 D.Thompkins",
  { type: "Pass Incompletion" },
);
assert.equal(
  hurry.text,
  "K. Taylor pass incomplete short right to Z. Ragins. QB hurried by D. Thompkins",
);
assert.equal(hurry.tone, "routine");

const timeout = show("timeout", "Timeout Mississippi State, clock 00:21", { type: "Timeout" });
assert.equal(timeout.text, "Timeout, Mississippi State");
assert.equal(timeout.tone, "timeout");

const pick = show(
  "pick six",
  '(08:41) No Huddle-Shotgun #1 K.Taylor pass intercepted by #5 D.Lee Jr. at State30 #5 D.Lee Jr. return 30 yards to the State00 TOUCHDOWN, clock 08:30 #31 C.Talty kick attempt good (H: #32 A.Asparuhov, LS: #55 A.Rozier)',
  { type: "Interception Return Touchdown", scoringPlay: true, turnover: true },
);
assert.equal(
  pick.text,
  "K. Taylor pass intercepted by D. Lee Jr. at the State 30. D. Lee Jr. returns 30 yards to the goal line, touchdown. C. Talty kick good",
);
assert.equal(pick.tone, "score");
assert.equal(pick.tags.join(","), "TD,INT");

const rushTd = show(
  "rush td",
  "(15:00) #12 K.Russell rush right for 17 yards gain to the State00 TOUCHDOWN, clock 14:53, 1ST DOWN #31 C.Talty kick attempt good (H: #32 A.Asparuhov, LS: #55 A.Rozier)",
  { type: "Rushing Touchdown", scoringPlay: true },
);
assert.equal(
  rushTd.text,
  "K. Russell rush right for 17 yards to the goal line, touchdown. C. Talty kick good",
);
assert.ok(!rushTd.tags.includes("1ST"), "td should not also chip first down");

const complete = show(
  "complete",
  "(15:00) No Huddle-Shotgun #1 K.Taylor pass complete short right to #3 A.Evans III caught at State25, for 8 yards to the State33 (#4 L.Metz; #18 B.Hubbard)",
  { type: "Pass Reception" },
);
assert.equal(complete.text, "K. Taylor pass complete short right to A. Evans III for 8 yards to the State 33");
assert.equal(complete.detail, null);

const declined = show(
  "declined",
  "(02:24) No Huddle-Shotgun #12 K.Russell pass complete deep left to #1 R.Coleman-Williams caught at State07, for 22 yards to the State07 (#1 K.Jones), 1ST DOWN, PENALTY State Offside declined",
  { type: "Pass Reception" },
);
assert.equal(
  declined.text,
  "K. Russell pass complete deep left to R. Coleman-Williams for 22 yards to the State 7",
);
assert.equal(declined.detail, "Offside declined, State.");
assert.equal(declined.tags.join(","), "1ST");
assert.equal(declined.tone, "routine");

const shift = show(
  "illegal shift",
  "(02:05) #4 D.Hill rush left for 0 yards to the Bama40 (#5 J.Gilbert) PENALTY Bama Illegal Shift 5 yards from Bama40 to Bama35. NO PLAY",
  { type: "Penalty", penalty: true },
);
assert.equal(shift.text, "Illegal Shift, Bama, 5 yards from the Bama 40 to the Bama 35.");
assert.equal(shift.detail, "No play · D. Hill rush left for 0 yards to the Bama 40");

const dpi = show(
  "dpi",
  "(00:29) No Huddle-Shotgun #1 K.Taylor pass incomplete short left to #3 A.Evans III thrown to Bama00 PENALTY Bama Pass Interference (#21 D.Kirkpatrick Jr.) 2 yards from Bama04 to Bama02, 1ST DOWN. NO PLAY",
  { type: "Penalty", penalty: true },
);
assert.equal(
  dpi.text,
  "Pass Interference, Bama (D. Kirkpatrick Jr.), 2 yards from the Bama 4 to the Bama 2, first down.",
);
assert.equal(dpi.tags.join(","), "PEN,1ST");

const sack = show(
  "sack",
  "(01:40) Shotgun #12 K.Russell sacked for loss of 4 yards to the Bama31 (#35 K.Dinkins)",
  { type: "Sack" },
);
assert.equal(sack.text, "K. Russell sacked by K. Dinkins for a loss of 4 yards to the Bama 31");
assert.equal(sack.tone, "sack");
assert.equal(sack.tags.join(","), "SACK");

const ownFumble = show(
  "own fumble",
  '(13:20) No Huddle-Shotgun #1 K.Taylor sacked for loss of 9 yards to the State48 (#90 L.Simmons), fumble by #1 K.Taylor recovered by Bama #90 L.Simmons at State48, End Of Play. The previous play is under automatic review - "Fumble". CALL UPHELD',
  { type: "Fumble Recovery (Own)" },
);
assert.equal(
  ownFumble.text,
  "K. Taylor sacked by L. Simmons for a loss of 9 yards to the State 48. Fumble by K. Taylor. Recovered by Bama, L. Simmons at the State 48",
);
assert.equal(ownFumble.detail, "Review upheld (Fumble).");
assert.equal(ownFumble.tone, "sack");

const punt = show(
  "punt",
  "(11:44) #32 A.Asparuhov punt 44 yards to the State11 fair catch by #3 A.Evans III at State11",
  { type: "Punt" },
);
assert.equal(punt.text, "A. Asparuhov punt 44 yards to the State 11. Fair catch by A. Evans III at the State 11");
assert.equal(punt.tags.join(","), "PUNT");

const end = show("end", "End of 2nd quarter.", { type: "End Period" });
assert.equal(end.tone, "period");
assert.equal(end.text, "End of 2nd quarter.");

const blurb = show("scoring blurb", "K. Ferrie 32 yd FG GOOD");
assert.equal(blurb.text, "K. Ferrie 32-yard field goal, good");
assert.equal(simplifyCfbPlayText("K. Russell run for 17 yds, for a TD (C. Talty KICK)"), "K. Russell run for 17 yds, touchdown. C. Talty kick good");

const tackled = presentCfbPlayText(
  "(08:00) #2 X.Gayten rush middle for 1 yard gain to the State26 (#11 X.Griffin; #7 C.O'Neal)",
  { type: "Rush" },
);
assert.equal(tackled.text, "X. Gayten rush middle for 1 yard to the State 26");
assert.equal(tackled.detail, null);

assert.equal(presentCfbPlayText("").text, "");
assert.equal(presentCfbPlayText(null).text, "");

console.log("\ncfb-play-text: ok");
