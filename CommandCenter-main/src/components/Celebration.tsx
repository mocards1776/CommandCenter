import { useCallback, useRef, useState, type ReactNode } from "react";
import { CelebrationContext, type CelebrationApi } from "./celebration-context";

/**
 * Completing something should feel like something. Three levels:
 *   burst()      — stars fly out of the thing you just clicked. Every task.
 *   fanfare()    — full-screen volley plus a line of text. Milestones only.
 *   bookFinish() — closing a book. Longer, denser, and a little prouder.
 *
 * All are no-ops under prefers-reduced-motion.
 */

type Burst = { id: number; x: number; y: number; seed: number };
type Fanfare = { id: number; message: string };
type BookFinish = { id: number; title: string; line: string; seed: number };

const STAR_COLORS = ["#D9515C", "#F4F1E9", "#FF8A93", "#C0303B", "#EDEFF5"];
const BOOK_COLORS = ["#D9515C", "#F4F1E9", "#FF8A93", "#C0303B", "#E8D5A3", "#EDEFF5"];

const FINISH_LINES = [
  "That's a wrap.",
  "Another one down.",
  "Onto the shelf.",
  "Well read.",
  "Closed the cover.",
  "What a run.",
];

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function StarBurst({ x, y, seed }: Burst) {
  // Deterministic per burst so React re-renders don't reshuffle mid-flight.
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

  const stars = Array.from({ length: 14 }, () => {
    const angle = rnd() * Math.PI * 2;
    const dist = 34 + rnd() * 64;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 22, // bias upward; falling back reads as gravity
      rot: (rnd() * 2 - 1) * 220,
      size: 8 + rnd() * 11,
      color: STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)],
      delay: rnd() * 55,
    };
  });

  return (
    <div className="pointer-events-none fixed z-[100]" style={{ left: x, top: y }}>
      {stars.map((st, i) => (
        <span
          key={i}
          className="cc-star absolute leading-none"
          style={
            {
              color: st.color,
              fontSize: st.size,
              animationDelay: `${st.delay}ms`,
              "--dx": `${st.dx}px`,
              "--dy": `${st.dy}px`,
              "--rot": `${st.rot}deg`,
            } as React.CSSProperties
          }
        >
          ★
        </span>
      ))}
      <span className="cc-ring absolute" />
    </div>
  );
}

function Fanfare({ message }: Fanfare) {
  const cols = Array.from({ length: 26 }, (_, i) => ({
    left: `${(i * 3.9 + (i % 3) * 1.7) % 100}%`,
    delay: `${(i % 7) * 90}ms`,
    color: STAR_COLORS[i % STAR_COLORS.length],
    size: 11 + ((i * 7) % 15),
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[110] overflow-hidden">
      {cols.map((c, i) => (
        <span
          key={i}
          className="cc-fall absolute leading-none"
          style={{ left: c.left, color: c.color, fontSize: c.size, animationDelay: c.delay }}
        >
          ★
        </span>
      ))}
      <div className="absolute inset-x-0 top-[22%] flex justify-center">
        <div className="cc-pop bg-hero/95 rounded border border-accent/50 px-9 py-5 text-center backdrop-blur-sm">
          <p className="font-display text-cream text-[30px] leading-tight">{message}</p>
        </div>
      </div>
    </div>
  );
}

function BookFinishBanner({ title, line, seed }: BookFinish) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

  const cols = Array.from({ length: 48 }, (_, i) => ({
    left: `${(i * 2.15 + (i % 5) * 0.7) % 100}%`,
    delay: `${Math.floor(rnd() * 900)}ms`,
    color: BOOK_COLORS[i % BOOK_COLORS.length],
    size: 10 + ((i * 11) % 18),
    drift: `${(rnd() * 40 - 20).toFixed(1)}px`,
  }));

  // A few mid-screen bursts so the finish feels centered, not just raining.
  const pops = [
    { x: "22%", y: "38%", delay: 80 },
    { x: "78%", y: "32%", delay: 220 },
    { x: "50%", y: "58%", delay: 360 },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-[110] overflow-hidden">
      <div className="cc-book-wash absolute inset-0" />
      {cols.map((c, i) => (
        <span
          key={i}
          className="cc-book-fall absolute leading-none"
          style={
            {
              left: c.left,
              color: c.color,
              fontSize: c.size,
              animationDelay: c.delay,
              "--drift": c.drift,
            } as React.CSSProperties
          }
        >
          ★
        </span>
      ))}
      {pops.map((p, i) => (
        <span
          key={`pop-${i}`}
          className="cc-book-flare absolute"
          style={{ left: p.x, top: p.y, animationDelay: `${p.delay}ms` }}
        />
      ))}
      <div className="absolute inset-x-0 top-[20%] flex justify-center px-6">
        <div className="cc-book-pop bg-hero/95 max-w-md rounded border border-accent/55 px-8 py-6 text-center backdrop-blur-sm">
          <p className="text-accent mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]">
            Finished
          </p>
          <p className="font-display text-cream text-[28px] leading-tight sm:text-[34px]">
            {title}
          </p>
          <p className="text-chalk mt-3 text-[13px] tracking-wide">{line}</p>
        </div>
      </div>
    </div>
  );
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [fanfares, setFanfares] = useState<Fanfare[]>([]);
  const [bookFinishes, setBookFinishes] = useState<BookFinish[]>([]);
  const next = useRef(0);

  const burst = useCallback((x: number, y: number) => {
    if (reducedMotion()) return;
    const id = next.current++;
    setBursts((b) => [...b, { id, x, y, seed: id * 7919 + 13 }]);
    window.setTimeout(() => setBursts((b) => b.filter((s) => s.id !== id)), 900);
  }, []);

  const fanfare = useCallback((message: string) => {
    if (reducedMotion()) return;
    const id = next.current++;
    setFanfares((f) => [...f, { id, message }]);
    window.setTimeout(() => setFanfares((f) => f.filter((s) => s.id !== id)), 2600);
  }, []);

  const bookFinish = useCallback((title: string) => {
    if (reducedMotion()) return;
    const id = next.current++;
    const line = FINISH_LINES[id % FINISH_LINES.length];
    setBookFinishes((f) => [...f, { id, title, line, seed: id * 4243 + 7 }]);
    // Center bursts so finishing from a keyboard path still feels physical.
    const cx = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
    const cy = typeof window !== "undefined" ? window.innerHeight * 0.42 : 0;
    const b1 = next.current++;
    const b2 = next.current++;
    const b3 = next.current++;
    setBursts((b) => [
      ...b,
      { id: b1, x: cx - 80, y: cy, seed: id * 17 },
      { id: b2, x: cx + 80, y: cy + 40, seed: id * 31 },
      { id: b3, x: cx, y: cy - 30, seed: id * 53 },
    ]);
    window.setTimeout(
      () => setBursts((b) => b.filter((s) => s.id !== b1 && s.id !== b2 && s.id !== b3)),
      1100,
    );
    window.setTimeout(() => setBookFinishes((f) => f.filter((s) => s.id !== id)), 4200);
  }, []);

  return (
    <CelebrationContext.Provider value={{ burst, fanfare, bookFinish } satisfies CelebrationApi}>
      {children}
      {bursts.map((b) => (
        <StarBurst key={b.id} {...b} />
      ))}
      {fanfares.map((f) => (
        <Fanfare key={f.id} {...f} />
      ))}
      {bookFinishes.map((f) => (
        <BookFinishBanner key={f.id} {...f} />
      ))}
    </CelebrationContext.Provider>
  );
}
