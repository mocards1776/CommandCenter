import { Link } from "react-router-dom";
import LogoPlate from "@/components/sports/LogoPlate";
import { cn } from "@/lib/utils";

export type TeamStatsLogoSide = {
  logo?: string | null;
  abbrev: string;
  name?: string | null;
  record?: string | null;
  href?: string | null;
};

function Side({ side, align }: { side: TeamStatsLogoSide; align: "left" | "right" }) {
  const label = side.name || side.abbrev;
  const mark = side.logo ? (
    <LogoPlate src={side.logo} alt={label} className="h-9 w-9 sm:h-10 sm:w-10" />
  ) : (
    <span className="text-cream text-[13px] font-semibold leading-tight">{side.abbrev}</span>
  );
  const body = (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      {mark}
      {side.record ? (
        <span className="numeral text-chalk-dim block text-[10.5px] leading-tight">{side.record}</span>
      ) : null}
    </span>
  );
  if (!side.href) return body;
  return (
    <Link to={side.href} aria-label={label} className="min-w-0 hover:opacity-90">
      {body}
    </Link>
  );
}

/** Away / home marks for a Team stats header. Logo when present; abbrev is the fallback. */
export default function TeamStatsLogos({
  away,
  home,
}: {
  away: TeamStatsLogoSide;
  home: TeamStatsLogoSide;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-white/[0.06] px-4 py-3">
      <Side side={away} align="left" />
      <span className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]">vs</span>
      <div className="flex justify-end">
        <Side side={home} align="right" />
      </div>
    </div>
  );
}
