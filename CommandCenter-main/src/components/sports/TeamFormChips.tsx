import type { TeamFormStrip } from "@/lib/team-form";
import { cn } from "@/lib/utils";

/** Compact Last 5 / Last 10 / Last 20 chips for team box-score headers. */
export function TeamFormChips({
  form,
  className,
  align = "left",
}: {
  form: TeamFormStrip | null | undefined;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  if (!form) return null;
  return (
    <dl
      className={cn(
        // Hide Last 5/10/20 on phones; keep on iPad / desktop.
        "mt-1.5 hidden grid-cols-3 gap-1.5 md:grid",
        align === "right" && "ml-auto",
        align === "center" && "mx-auto",
        className,
      )}
    >
      {(
        [
          ["Last 5", form.last5],
          ["Last 10", form.last10],
          ["Last 20", form.last20],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="rounded-md bg-white/[0.05] px-1.5 py-1.5 text-center">
          <dt className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8b93a7]">
            {label}
          </dt>
          <dd className="numeral text-cream mt-0.5 text-[11px] leading-none">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** League/division rank under a team record — 1px smaller than the old L5 line (10→9). */
export function TeamStandingLine({
  standing,
  className,
}: {
  standing: string | null | undefined;
  className?: string;
}) {
  if (!standing) return null;
  return (
    <p className={cn("mt-0.5 text-[10px] leading-tight text-white/50 md:text-[9px]", className)}>{standing}</p>
  );
}
