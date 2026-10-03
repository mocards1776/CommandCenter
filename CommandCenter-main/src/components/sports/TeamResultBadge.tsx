import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  W: "bg-emerald-400/15 text-emerald-300 ring-emerald-300/30",
  L: "bg-red-400/15 text-red-300 ring-red-300/30",
  T: "bg-amber-300/15 text-amber-200 ring-amber-300/30",
  OTL: "bg-amber-300/15 text-amber-200 ring-amber-300/30",
};

const SOLID: Record<string, string> = {
  W: "bg-emerald-400 text-[#04150c]",
  L: "bg-red-400 text-[#2a0608]",
  T: "bg-amber-300 text-[#2a2208]",
  OTL: "bg-amber-300 text-[#2a2208]",
};

/** Shared W/L (or OTL) mark used on team schedules. `solid` is the large score-column tile. */
export default function TeamResultBadge({
  result,
  solid = false,
  className,
}: {
  result: string;
  solid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-black tracking-[0.04em]",
        solid
          ? cn(
              "h-10 w-10 shrink-0 rounded-lg text-[16px]",
              SOLID[result] ?? "bg-white/15 text-white",
            )
          : cn(
              "min-w-8 rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-[0.08em] ring-1",
              TONE[result] ?? "bg-white/10 text-white/70 ring-white/15",
            ),
        className,
      )}
    >
      {result}
    </span>
  );
}
