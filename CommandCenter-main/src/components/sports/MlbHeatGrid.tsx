import { heatZoneGrid, type MlbHeatTemp } from "@/lib/mlb-pbp";
import { cn } from "@/lib/utils";

function heatFill(temp: MlbHeatTemp): { bg: string; fg: string } {
  if (temp === "hot") return { bg: "#d32f2f", fg: "#fff" };
  if (temp === "warm") return { bg: "#e08a90", fg: "#1a1220" };
  if (temp === "cold") return { bg: "#1e62d0", fg: "#fff" };
  if (temp === "cool") return { bg: "#7ea6e8", fg: "#102038" };
  return { bg: "#eceef4", fg: "#1a1d27" };
}

/** Catcher's-view 3×3 hot zones. No batter silhouette. */
export default function MlbHeatGrid({
  batterId,
  cells,
  pending,
  className,
}: {
  batterId: number | null;
  cells: ReturnType<typeof heatZoneGrid>;
  pending: boolean;
  className?: string;
}) {
  return (
    <div
      key={batterId ?? "none"}
      className={cn("relative z-[1] grid grid-cols-3 gap-[5px] rounded-[2px] bg-black/20 p-[5px]", className)}
      role="img"
      aria-label="Batter strike-zone heat"
    >
      {cells.map((cell, i) => {
        const { bg, fg } = heatFill(cell.temp);
        return (
          <div
            key={cell.zone}
            className="mlb-pbp-cell-in flex h-14 w-16 items-center justify-center text-[13px] font-semibold tabular-nums sm:h-16 sm:w-[4.4rem] sm:text-[15px]"
            style={{
              background: pending ? "rgba(255,255,255,0.08)" : bg,
              color: pending ? "rgba(255,255,255,0.35)" : fg,
              animationDelay: `${80 + i * 45}ms`,
            }}
          >
            {pending ? "—" : cell.value}
          </div>
        );
      })}
    </div>
  );
}
