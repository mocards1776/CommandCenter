import { heatZoneGrid, type MlbHeatTemp } from "@/lib/mlb-pbp";
import { cn } from "@/lib/utils";

function heatFill(temp: MlbHeatTemp): { bg: string; fg: string } {
  if (temp === "hot") return { bg: "#d32f2f", fg: "#fff" };
  if (temp === "warm") return { bg: "#e08a90", fg: "#1a1220" };
  if (temp === "cold") return { bg: "#1e62d0", fg: "#fff" };
  if (temp === "cool") return { bg: "#7ea6e8", fg: "#102038" };
  return { bg: "#eceef4", fg: "#1a1d27" };
}

/**
 * Catcher's-view 3×3 hot zones. No batter silhouette.
 * `fill` stretches the cells to the parent box (pitch plot); `faded` drops the
 * heat to a backdrop so pitch dots read on top.
 */
export default function MlbHeatGrid({
  batterId,
  cells,
  pending,
  className,
  fill = false,
  faded = false,
}: {
  batterId: number | null;
  cells: ReturnType<typeof heatZoneGrid>;
  pending: boolean;
  className?: string;
  fill?: boolean;
  faded?: boolean;
}) {
  return (
    <div
      key={batterId ?? "none"}
      className={cn(
        "relative z-[1] grid grid-cols-3 rounded-[2px] bg-black/20 transition-opacity duration-500",
        fill ? "h-full w-full grid-rows-3 gap-[3px] p-[3px] sm:gap-[4px] sm:p-[4px]" : "gap-[5px] p-[5px]",
        faded && "opacity-[0.36]",
        className,
      )}
      role="img"
      aria-label="Batter strike-zone heat"
    >
      {cells.map((cell, i) => {
        const { bg, fg } = heatFill(cell.temp);
        return (
          <div
            key={cell.zone}
            className={cn(
              "mlb-pbp-cell-in flex items-center justify-center font-semibold tabular-nums",
              fill
                ? "min-h-0 min-w-0 text-[12px] sm:text-[14px]"
                : "h-14 w-16 text-[13px] sm:h-16 sm:w-[4.4rem] sm:text-[15px]",
            )}
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
