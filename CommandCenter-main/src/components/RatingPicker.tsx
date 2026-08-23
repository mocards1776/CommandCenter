import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Half-star picker. StoryGraph uses quarter stars; halves are the useful part. */
export default function RatingPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative h-5 w-5">
          <button
            aria-label={`${i - 0.5} stars`}
            onMouseEnter={() => setHover(i - 0.5)}
            onClick={() => onChange(i - 0.5)}
            className="absolute left-0 top-0 z-10 h-full w-1/2"
          />
          <button
            aria-label={`${i} stars`}
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            className="absolute right-0 top-0 z-10 h-full w-1/2"
          />
          <Star
            size={19}
            className={cn(
              "absolute inset-0",
              shown >= i - 0.5 ? "text-accent" : "text-white/20",
            )}
            style={
              shown >= i
                ? { fill: "currentColor" }
                : shown >= i - 0.5
                  ? {
                      fill: "currentColor",
                      clipPath: "inset(0 50% 0 0)",
                    }
                  : undefined
            }
          />
        </span>
      ))}
      {value !== null && (
        <button
          onClick={() => onChange(null)}
          className="text-chalk-dim hover:text-alert ml-1.5 text-[10px] uppercase tracking-[0.15em]"
        >
          clear
        </button>
      )}
    </div>
  );
}
