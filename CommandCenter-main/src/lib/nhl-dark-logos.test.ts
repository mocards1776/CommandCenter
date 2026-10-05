/**
 * Run with: node --experimental-strip-types src/lib/nhl-dark-logos.test.ts
 * from CommandCenter-main/.
 */
import { nhlLogoOnDark, resolveNhlDarkRimHref } from "./nhl-dark-logos.ts";

const assert = {
  equal(actual: unknown, expected: unknown) {
    if (actual !== expected) throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  },
};

assert.equal(resolveNhlDarkRimHref({ abbrev: "TB" }), "/logos/nhl/nhl-tb.png");
assert.equal(resolveNhlDarkRimHref({ teamId: 20 }), "/logos/nhl/nhl-tb.png");
assert.equal(resolveNhlDarkRimHref({ abbrev: "WSH" }), "/logos/nhl/nhl-wsh.png");
assert.equal(resolveNhlDarkRimHref({ teamId: "23" }), "/logos/nhl/nhl-wsh.png");
assert.equal(
  resolveNhlDarkRimHref({ url: "https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png" }),
  "/logos/nhl/nhl-wsh.png",
);
assert.equal(
  resolveNhlDarkRimHref({ url: "https://a.espncdn.com/i/teamlogos/nhl/500-dark/20.png" }),
  "/logos/nhl/nhl-tb.png",
);
assert.equal(resolveNhlDarkRimHref({ url: "/logos/nhl/nhl-tb.png" }), "/logos/nhl/nhl-tb.png");
assert.equal(resolveNhlDarkRimHref({ abbrev: "PHI" }), null);
assert.equal(resolveNhlDarkRimHref({ sport: "mlb", abbrev: "TB" }), null);
assert.equal(resolveNhlDarkRimHref({ sport: "mlb", abbrev: "WSH" }), null);
assert.equal(
  resolveNhlDarkRimHref({ url: "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png" }),
  null,
);

assert.equal(
  nhlLogoOnDark("https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png", "WSH", 23),
  "/logos/nhl/nhl-wsh.png",
);
assert.equal(
  nhlLogoOnDark("https://a.espncdn.com/i/teamlogos/nhl/500/phi.png", "PHI", 15),
  "https://a.espncdn.com/i/teamlogos/nhl/500/phi.png",
);
assert.equal(nhlLogoOnDark(null, "STL", 19), "https://a.espncdn.com/i/teamlogos/nhl/500/stl.png");

console.log("nhl-dark-logos.test.ts ok");
