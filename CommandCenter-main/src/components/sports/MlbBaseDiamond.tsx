import { cn } from "@/lib/utils";

/** Three-bag diamond. Empty bases stay a graphic — never the word “EMPTY”. */
export default function MlbBaseDiamond({
  onFirst,
  onSecond,
  onThird,
  className,
  size = "md",
}: {
  onFirst: boolean;
  onSecond: boolean;
  onThird: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const bag = (on: boolean) =>
    on ? "bg-cream shadow-[0_0_0_1px_rgba(255,255,255,0.35)]" : "bg-white/15";
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const gem = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <div
      className={cn("relative mx-auto", box, className)}
      aria-hidden
      data-occupied={`${onFirst ? "1" : ""}${onSecond ? "2" : ""}${onThird ? "3" : ""}`}
    >
      <span className={cn("absolute top-0 left-1/2 -translate-x-1/2 rotate-45", gem, bag(onSecond))} />
      <span className={cn("absolute top-1/2 left-0 -translate-y-1/2 rotate-45", gem, bag(onThird))} />
      <span className={cn("absolute top-1/2 right-0 -translate-y-1/2 rotate-45", gem, bag(onFirst))} />
    </div>
  );
}
