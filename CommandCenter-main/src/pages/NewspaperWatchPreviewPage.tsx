import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import WatchGuide from "@/components/newspaper/WatchGuide";
import { fetchWatchList, sampleWatchSlate, sampleWatchSlateLight, WATCH_PAGE_GAMES } from "@/lib/newspaper-watch";

const TZ = "America/Chicago";

/**
 * Public fixture of the Section A viewing guide at iPad Pro 13" width.
 * Not linked from nav. Used to proof the printed timetable.
 * `?sample=1` or `?sample=dense` — Saturday-scale slate (~30–40 games).
 * `?sample=light` — Monday Oct 5 fixture (2 ALDS, MNF, 4 NHL, 5 NBA preseason).
 */
export default function NewspaperWatchPreviewPage() {
  const [params] = useSearchParams();
  const sample = params.get("sample");
  const dense = sample === "1" || sample === "dense";
  const light = sample === "light";
  const day = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const live = useQuery({
    queryKey: ["tt-watch-preview", day],
    queryFn: () => fetchWatchList(day, { limit: WATCH_PAGE_GAMES }),
    enabled: !dense && !light,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const games = dense
    ? sampleWatchSlate(day)
    : light
      ? sampleWatchSlateLight(day)
      : live.data?.length
        ? live.data
        : sampleWatchSlateLight(day);

  return (
    <div className="newspaper-root wsj-shell tt-watch-preview">
      <div className="wsj-page" data-watch-preview="1">
        <div className="wsj-fit">
          <div className="wsj-sheet">
            <WatchGuide games={games} editionLabel="Midday Edition" />
          </div>
        </div>
      </div>
    </div>
  );
}
