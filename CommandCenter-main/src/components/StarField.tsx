import { useMemo } from "react";

/**
 * Stars placed individually at low opacity, so the surface reads as engraved
 * rather than tiled. Seeded, so a given surface keeps the same field across
 * re-renders instead of shimmering on every state change.
 */
export default function StarField({ count = 30, seed = 7 }: { count?: number; seed?: number }) {
  const stars = useMemo(() => {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    return Array.from({ length: count }, () => ({
      left: `${(rnd() * 100).toFixed(1)}%`,
      top: `${(rnd() * 100).toFixed(1)}%`,
      fontSize: `${(5 + rnd() * 8).toFixed(1)}px`,
      opacity: +(0.05 + rnd() * 0.13).toFixed(2),
    }));
  }, [count, seed]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((st, i) => (
        <span key={i} className="absolute leading-none text-white" style={st}>
          ★
        </span>
      ))}
    </div>
  );
}
