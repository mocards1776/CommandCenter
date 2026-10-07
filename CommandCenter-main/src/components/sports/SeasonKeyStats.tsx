/** Season key-stats block: AGE/PTS-style chip cards instead of a spreadsheet grid. */

export type SeasonKeyStat = {
  label: string;
  value: string;
  sub?: string | null;
};

export function SeasonKeyStats({
  title,
  stats,
  teamLogo,
  accent,
}: {
  title: string;
  stats: SeasonKeyStat[];
  teamLogo?: string | null;
  accent?: string | null;
}) {
  const wash = accent?.replace(/^#/, "") ?? "";
  const tint = wash.length === 6 ? `#${wash}` : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
      <div
        className="absolute inset-0"
        style={{
          background: tint
            ? `linear-gradient(155deg, #081224 0%, ${tint}28 46%, #061018 100%)`
            : "linear-gradient(155deg, #081224 0%, #0d1d3c 50%, #061018 100%)",
        }}
      />
      {teamLogo ? (
        <img
          src={teamLogo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-10 h-[220px] w-[220px] object-contain opacity-[0.1] sm:-right-2 sm:h-[280px] sm:w-[280px]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[#061018]/80 via-transparent to-[#061018]/25" />

      <div className="relative z-10 p-3.5 sm:p-4">
        <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.14em] text-white/70">
          {title}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={`${stat.label}-${i}`}
              className="flex min-h-[76px] flex-col items-center justify-center rounded-md border border-white/20 bg-white/[0.07] px-2.5 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:min-h-[84px]"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">
                {stat.label}
              </p>
              <p className="numeral mt-1 text-[28px] leading-none text-white sm:text-[30px]">
                {stat.value}
              </p>
              {stat.sub ? <p className="mt-0.5 text-[10px] text-white/50">{stat.sub}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
