import { Link } from "react-router-dom";
import LogoPlate from "@/components/sports/LogoPlate";
import { nhlAccentColor, nhlHeadshot, type NhlBoxRow, type NhlScoreSide } from "@/lib/nhl";

type GoalieCard = {
  side: NhlScoreSide;
  row: NhlBoxRow;
};

function read(row: NhlBoxRow, label: string): string | null {
  const v = row.stats.find((s) => s.label === label)?.value;
  return v && v !== "—" ? v : null;
}

function Goalie({ side, row }: GoalieCard) {
  const color = nhlAccentColor(side);
  const sv = read(row, "SV");
  const sa = read(row, "SA");
  const pct = read(row, "SV%");
  const ga = read(row, "GA");
  return (
    <Link
      to={`/sports/nhl/player/${row.id}`}
      className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-[#0a1424] px-3 py-2.5 hover:bg-[#0d1a2e]"
    >
      <img
        src={nhlHeadshot(row.id)}
        alt=""
        className="h-14 w-14 shrink-0 rounded-full bg-[#dfe6f2] object-cover object-top"
        style={{ boxShadow: `0 0 0 2px ${color}` }}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          {side.logo ? <LogoPlate src={side.logo} className="h-4 w-4" alt={side.abbrev} /> : null}
          <span className="text-cream truncate text-[15px] font-semibold leading-tight">{row.name}</span>
        </p>
        <p className="numeral mt-1 text-[12px] text-[#c5cce0]">
          {[sv && sa ? `${sv}/${sa} SV` : sv ? `${sv} SV` : null, ga ? `${ga} GA` : null, pct ? `${pct} SV%` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}

/** Final goalie lines from the ESPN box. Renders nothing without goalie rows. */
export default function NhlGoalies({
  away,
  home,
  rows,
}: {
  away: NhlScoreSide;
  home: NhlScoreSide;
  rows: { side: NhlScoreSide; row: NhlBoxRow }[];
}) {
  if (!rows.length) return null;
  return (
    <section className="bg-panel rounded-xl border border-white/[0.08] p-3 sm:p-4">
      <h3 className="rule-head mb-3">Goalies</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(({ side, row }) => (
          <Goalie key={`${side.abbrev}-${row.id}`} side={side} row={row} />
        ))}
      </div>
    </section>
  );
}
