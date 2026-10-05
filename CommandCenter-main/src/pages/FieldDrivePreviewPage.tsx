import NflFieldMap from "@/components/sports/NflFieldMap";
import type { CfbDriveGlance } from "@/lib/cfb-drive";

const nflDrive: CfbDriveGlance = {
  teamAbbrev: "WSH",
  playCount: 6,
  yards: 41,
  timeOfPossession: "3:12",
  startYardLine: 81,
  startText: "WSH 19",
  displayResult: null,
  description: null,
};

const cfbDrive: CfbDriveGlance = {
  teamAbbrev: "MIZ",
  playCount: 8,
  yards: 58,
  timeOfPossession: "4:05",
  startYardLine: 75,
  startText: "MIZ 25",
  displayResult: null,
  description: null,
};

/**
 * Side-by-side sample of the Apple Sports drive capsule on the existing field.
 * Public so screenshots do not need a session. Not linked from nav.
 */
export default function FieldDrivePreviewPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-[#07101d] px-4 py-8">
      <header className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b93a7]">
          Field overlay
        </p>
        <h1 className="text-2xl font-semibold text-[#f4f1e9]">Drive capsule preview</h1>
        <p className="text-[13px] leading-relaxed text-[#c5cce0]">
          Same grass, end zones, and yard lines. Only the drive marks changed: glassy
          capsule from the first snap to the LOS, circular football, yellow stick.
        </p>
      </header>

      <section className="space-y-3" data-testid="nfl-field-preview">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#e8e4d9]">
          NFL · IND at WSH · 1st &amp; 10 at WSH 40
        </h2>
        <NflFieldMap
          branded
          game={{
            away: { teamId: "11", abbrev: "IND", color: "003b75" },
            home: { teamId: "28", abbrev: "WSH", color: "5a1414" },
            situation: { downDistanceText: "1st & 10 at WSH 40", lastPlayText: "Two-Minute Warning" },
          }}
          homeYardLine={40}
          possessionTeamId="28"
          downDistanceText="1st & 10 at WSH 40"
          drive={nflDrive}
          omitLastPlay
        />
      </section>

      <section className="space-y-3" data-testid="cfb-field-preview">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#e8e4d9]">
          CFB · MIZ at FLA · 3rd &amp; 3 at FLA 17
        </h2>
        <NflFieldMap
          branded
          game={{
            away: { teamId: "142", abbrev: "MIZ", color: "f1b82d" },
            home: { teamId: "57", abbrev: "FLA", color: "0021a5" },
            situation: {
              downDistanceText: "3rd & 3 at FLA 17",
              lastPlayText: "Moss pass complete to Cooper for 12 yards",
            },
          }}
          homeYardLine={17}
          possessionTeamId="142"
          downDistanceText="3rd & 3 at FLA 17"
          drive={cfbDrive}
          omitLastPlay
        />
      </section>
    </div>
  );
}
