import { useQuery } from "@tanstack/react-query";
import WatchGuide from "@/components/newspaper/WatchGuide";
import { fetchWatchList, sampleWatchSlate, WATCH_PAGE_GAMES } from "@/lib/newspaper-watch";

const TZ = "America/Chicago";

/**
 * Public fixture of the Section A viewing guide at iPad Pro 13" width.
 * Not linked from nav. Used to proof the printed timetable.
 */
export default function NewspaperWatchPreviewPage() {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const live = useQuery({
    queryKey: ["tt-watch-preview", day],
    queryFn: () => fetchWatchList(day, { limit: WATCH_PAGE_GAMES }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const games = live.data?.length ? live.data : sampleWatchSlate(day);

  return (
    <div className="newspaper-root wsj-shell tt-watch-preview">
      <div className="wsj-page" data-watch-preview="1">
        <div className="wsj-fit">
          <div className="wsj-sheet">
            <WatchGuide games={games} editionLabel="Evening Edition" />
          </div>
        </div>
      </div>
    </div>
  );
}
