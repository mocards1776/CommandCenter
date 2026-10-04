import { renderHeatAlertSvg } from "@heat/svg.ts";
import type { HeatAlertCard } from "@heat/types.ts";

/** Same drawing the Telegram photo rasterizes. Remote logo URLs are fine in the browser. */
export default function HeatAlertImage({ card }: { card: HeatAlertCard }) {
  const svg = renderHeatAlertSvg(card);
  return (
    <div
      className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
