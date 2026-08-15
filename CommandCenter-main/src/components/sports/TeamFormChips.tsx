import type { TeamFormStrip } from "@/lib/team-form";
import { cn } from "@/lib/utils";

/** Compact L5 / L10 / L20 chips for team box-score headers. */
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
        "mt-1.5 grid grid-cols-3 gap-1",
        align === "right" && "ml-auto",
        align === "center" && "mx-auto",
        className,
      )}
    >
      {(
        [
          ["L5", form.last5],
          ["L10", form.last10],
          ["L20", form.last20],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="rounded-md bg-white/[0.05] px-1 py-1 text-center">
          <dt className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[#8b93a7]">
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
    <p className={cn("mt-0.5 text-[9px] leading-tight text-white/50", className)}>{standing}</p>
  );
}
