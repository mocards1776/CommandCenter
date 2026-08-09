import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  CelebrationContext,
  type BookFinishPayload,
  type CelebrationApi,
} from "./celebration-context";
import FinishBookCard from "./FinishBookCard";

/**
 * Completing something should feel like something. Three levels:
 *   burst()      — stars fly out of the thing you just clicked. Every task.
 *   fanfare()    — full-screen volley plus a line of text. Milestones only.
 *   bookFinish() — closing a book. Share-style card + a short confetti wash.
 *
 * Confetti is a no-op under prefers-reduced-motion; the finish card still shows.
 */

type Burst = { id: number; x: number; y: number; seed: number };
type Fanfare = { id: number; message: string };
type BookFinish = { id: number; card: BookFinishPayload; seed: number };

const STAR_COLORS = ["#D9515C", "#F4F1E9", "#FF8A93", "#C0303B", "#EDEFF5"];
const BOOK_COLORS = ["#D9515C", "#F4F1E9", "#FF8A93", "#C0303B", "#E8D5A3", "#EDEFF5"];

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

function BookFinishConfetti({ seed }: { seed: number }) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

  const cols = Array.from({ length: 36 }, (_, i) => ({
    left: `${(i * 2.8 + (i % 5) * 0.7) % 100}%`,
    delay: `${Math.floor(rnd() * 700)}ms`,
    color: BOOK_COLORS[i % BOOK_COLORS.length],
    size: 10 + ((i * 11) % 16),
    drift: `${(rnd() * 40 - 20).toFixed(1)}px`,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[115] overflow-hidden">
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
    </div>
  );
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [fanfares, setFanfares] = useState<Fanfare[]>([]);
  const [bookFinishes, setBookFinishes] = useState<BookFinish[]>([]);
  const [confetti, setConfetti] = useState<{ id: number; seed: number }[]>([]);
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

  const bookFinish = useCallback((card: BookFinishPayload) => {
    const id = next.current++;
    // One card at a time — finishing two books back-to-back shouldn't stack modals.
    setBookFinishes([{ id, card, seed: id * 4243 + 7 }]);

    if (!reducedMotion()) {
      const cid = next.current++;
      setConfetti([{ id: cid, seed: id * 4243 + 7 }]);
      window.setTimeout(() => setConfetti((c) => c.filter((s) => s.id !== cid)), 2800);

      const cx = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
      const cy = typeof window !== "undefined" ? window.innerHeight * 0.38 : 0;
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
    }
  }, []);

  const dismissFinish = useCallback((id: number) => {
    setBookFinishes((f) => f.filter((s) => s.id !== id));
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
      {confetti.map((c) => (
        <BookFinishConfetti key={c.id} seed={c.seed} />
      ))}
      {bookFinishes.map((f) => (
        <FinishBookCard key={f.id} card={f.card} onClose={() => dismissFinish(f.id)} />
      ))}
    </CelebrationContext.Provider>
  );
}
