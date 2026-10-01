import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type HeroStatBox = { label: string; value: string; sub?: string | null };
export type HeroBioItem = { label: string; value: ReactNode };

/** MLB-style player hero for ESPN-backed leagues (NFL / NHL). */
export function EspnPlayerHero({
  name,
  league,
  teamName,
  teamHref,
  teamLogo,
  headshot,
  headshotFallback,
  accent,
  number,
  position,
  statBoxes,
  bio,
  isFavorite,
  onToggleFav,
}: {
  name: string;
  league: string;
  teamName: string | null;
  teamHref: string | null;
  teamLogo: string | null;
  headshot: string;
  headshotFallback?: string;
  accent: string;
  number: string | null;
  position: string | null;
  statBoxes: HeroStatBox[];
  bio: HeroBioItem[];
  isFavorite: boolean;
  onToggleFav: () => void;
}) {
  const parts = name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : name;
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
  const subline = [number ? `#${number.replace(/^#/, "")}` : null, position]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(145deg, #0a1428 0%, ${accent}55 45%, #07101f 100%)`,
        }}
      />
      {teamLogo ? (
        <img
          src={teamLogo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-6 h-[260px] w-[260px] object-contain opacity-[0.07] sm:-right-6 sm:h-[340px] sm:w-[340px]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-[#07101f]/30 to-transparent" />

      <div className="relative z-10 p-4 sm:p-5 lg:p-7">
        <div className="flex items-start gap-4 sm:gap-5 lg:gap-7">
          <div className="relative shrink-0">
            <div className="overflow-hidden rounded-xl bg-gradient-to-b from-[#e8edf5] to-[#c9d3e3] p-1 shadow-2xl ring-2 ring-white/30">
              <img
                src={headshot}
                alt=""
                width={200}
                height={200}
                className="h-[96px] w-[96px] rounded-[9px] object-cover object-top sm:h-[140px] sm:w-[140px] lg:h-[180px] lg:w-[180px]"
                onError={(e) => {
                  if (headshotFallback && e.currentTarget.src !== headshotFallback) {
                    e.currentTarget.src = headshotFallback;
                  }
                }}
              />
            </div>
            {teamLogo ? (
              <img
                src={teamLogo}
                alt=""
                className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-[#07101f] p-1 ring-2 ring-white/20 sm:h-11 sm:w-11"
              />
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {teamName ? (
                  teamHref ? (
                    <Link
                      to={teamHref}
                      className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:text-white sm:text-[12px]"
                    >
                      {teamName}
                    </Link>
                  ) : (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 sm:text-[12px]">
                      {teamName}
                    </span>
                  )
                ) : null}
                <span className="rounded-sm border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
                  {league}
                </span>
              </div>
              {firstName ? (
                <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.08em] text-white/65 sm:text-[13px]">
                  {firstName}
                </p>
              ) : null}
              <h1 className="font-display break-words text-[34px] leading-[0.95] text-white sm:text-[48px] lg:text-[56px]">
                {lastName}
              </h1>
              {subline ? <p className="mt-1.5 text-[13px] text-white/75">{subline}</p> : null}
            </div>

            {statBoxes.length > 0 ? (
              <div className="flex gap-2">
                {statBoxes.map((box) => (
                  <div
                    key={box.label}
                    className="flex min-w-[58px] shrink-0 flex-col items-center justify-center rounded-md border border-white/25 bg-black/35 px-3 py-2 text-center backdrop-blur-sm"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">
                      {box.label}
                    </p>
                    <p className="numeral text-[28px] leading-none text-white">{box.value}</p>
                    {box.sub ? (
                      <p className="mt-0.5 text-[10px] text-white/55">{box.sub}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/[0.1] pt-4 text-[12.5px] sm:mt-5 sm:grid-cols-3 lg:grid-cols-4">
          {bio.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-[10px] uppercase tracking-[0.14em] text-white/50">{item.label}</dt>
              <dd className="mt-0.5 break-words text-white">{item.value}</dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          onClick={() => void onToggleFav()}
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition",
            isFavorite
              ? "border-accent/50 bg-accent/15 text-cream"
              : "border-white/25 bg-black/25 text-white/85 hover:border-white/50 hover:text-white",
          )}
        >
          <Star size={13} className={isFavorite ? "fill-accent text-accent" : ""} />
          {isFavorite ? "Favorited" : "Add to favorites"}
        </button>
      </div>
    </article>
  );
}