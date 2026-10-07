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
            ? `linear-gradient(155deg, #0a1428 0%, ${tint}32 48%, #07101f 100%)`
            : "linear-gradient(155deg, #0a1428 0%, #0d1d3c 50%, #07101f 100%)",
        }}
      />
      {teamLogo ? (
        <img
          src={teamLogo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-8 -bottom-8 h-[200px] w-[200px] object-contain opacity-[0.08] sm:-right-4 sm:h-[240px] sm:w-[240px]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07101f]/70 via-transparent to-[#07101f]/20" />

      <div className="relative z-10 p-3.5 sm:p-4">
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-white/55">
          {title}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={`${stat.label}-${i}`}
              className="flex min-h-[72px] flex-col items-center justify-center rounded-md border border-white/25 bg-black/35 px-3 py-2.5 text-center backdrop-blur-sm"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">
                {stat.label}
              </p>
              <p className="numeral mt-1 text-[26px] leading-none text-white sm:text-[28px]">
                {stat.value}
              </p>
              {stat.sub ? <p className="mt-0.5 text-[10px] text-white/55">{stat.sub}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
