import { mlbTeamLogo } from "@/lib/mlb";
import { cn } from "@/lib/utils";

/** Team logo on a white disc so colored marks stay legible on dark UI. */
export default function TeamMark({
  teamId,
  size = "md",
  className,
  imgClassName,
}: {
  teamId: number | string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  imgClassName?: string;
}) {
  const dim =
    size === "xs"
      ? "h-5 w-5 p-0.5"
      : size === "sm"
        ? "h-7 w-7 p-1"
        : size === "md"
          ? "h-10 w-10 p-1.5"
          : size === "lg"
            ? "h-14 w-14 p-2 sm:h-16 sm:w-16"
            : "h-16 w-16 p-2 sm:h-20 sm:w-20";

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-white shadow-md ring-1 ring-black/10",
        dim,
        className,
      )}
    >
      <img
        src={mlbTeamLogo(teamId)}
        alt=""
        className={cn("h-full w-full object-contain", imgClassName)}
        loading="lazy"
      />
    </span>
  );
}
