import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import DayAhead from "@/components/newspaper/DayAhead";
import RacesPage from "@/components/newspaper/RacesPage";
import { insertBeez, sampleBeezDesk } from "@/lib/newspaper-beez";
import { insertDayAhead } from "@/lib/newspaper-day-ahead";
import { editionDateline, editionIssue, romanNumeral } from "@/lib/newspaper";
import { oct6LiveRaceBriefs } from "@/lib/newspaper-races-oct6-live";
import {
  insertRaceBriefs,
  sampleRaceBriefs,
  sampleRaceBriefsOverflow,
  type FavoritesRacesPage,
} from "@/lib/newspaper-races";
import { buildEdition } from "@/lib/newspaper-sections";

const DAY = "2026-10-06";

/**
 * Public fixture of the Section A races page. Width stays --tt-page-w 1032;
 * height hugs the copy. Not linked from nav.
 *   ?live=1          2026-10-06 filed rows (SD 8 + SD 30) — proof, not SAMPLE
 *   ?sample=1        two-race morning (default)
 *   ?sample=overflow second folio
 *   ?empty=1         races omitted; Day Ahead and the folio rail stay put
 */
export default function NewspaperRacesPreviewPage() {
  const [params] = useSearchParams();
  const empty = params.get("empty") === "1";
  const live = params.get("live") === "1";
  const overflow = params.get("sample") === "overflow";
  const desk = live ? oct6LiveRaceBriefs(DAY) : overflow ? sampleRaceBriefsOverflow(DAY) : sampleRaceBriefs(DAY);
  const edition = useMemo(() => {
    const built = buildEdition({ stories: [], clubs: [], edition: `${DAY}-morning` });
    const withDay = insertDayAhead(built, {
      date: DAY,
      events: [
        { start: "07:30", end: "08:00", all_day: false, title: "Breakfast with the kids", kind: "family", location: "Home" },
        { start: "09:00", end: "10:00", all_day: false, title: "Standup", kind: "work", location: "Office" },
        { start: "12:00", end: "13:00", all_day: false, title: "Lunch", kind: "work", location: null },
      ],
      upcoming: [],
    });
    const withBeez = insertBeez(withDay, sampleBeezDesk());
    return empty ? insertRaceBriefs(withBeez, null) : insertRaceBriefs(withBeez, desk);
  }, [desk, empty]);
  const sectionA = edition.pages.filter((p) => p.section === "A");
  const racePages = sectionA.filter((p): p is FavoritesRacesPage => p.kind === "favorites-races");
  const dayPage = sectionA.find((p) => p.kind === "favorites-day");
  const shown = overflow ? racePages.slice(1) : racePages;
  const { volume, issue } = editionIssue(DAY);
  const mode = empty ? "empty" : live ? "live" : overflow ? "overflow" : "sample";

  return (
    <div className="newspaper-root wsj-shell tt-watch-preview tt-races-preview" data-races-preview={mode}>
      <p
        className="tt-races-preview-rail"
        data-races-proof={live ? "live" : empty ? "empty" : "sample"}
        data-races-folios={sectionA.map((p) => `${p.folio}:${p.kind}`).join("|")}
      >
        {live ? "PROOF · live 2026-10-06 rows · " : ""}
        Section A · {sectionA.map((p) => p.folio).join(" · ")}
        {empty ? " · races omitted" : ""}
      </p>
      {empty ? (
        <PreviewSheet folio={dayPage && "folio" in dayPage ? dayPage.folio : "A5"} label="The Day Ahead" volume={volume} issue={issue}>
          {dayPage && dayPage.kind === "favorites-day" ? (
            <DayAhead date={dayPage.date} events={dayPage.events} upcoming={dayPage.upcoming} editionLabel="Morning Edition" />
          ) : null}
        </PreviewSheet>
      ) : (
        shown.map((page) => (
          <PreviewSheet key={page.folio} folio={page.folio} label={page.continued ? "Races We're Tracking · continued" : "Races We're Tracking"} volume={volume} issue={issue} live={live}>
            <RacesPage page={page} />
          </PreviewSheet>
        ))
      )}
    </div>
  );
}

function PreviewSheet({
  folio,
  label,
  volume,
  issue,
  live,
  children,
}: {
  folio: string;
  label: string;
  volume: number;
  issue: number;
  live?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(Math.round(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div className="wsj-page" data-races-sheet={folio} data-sheet-h={height} data-vol={romanNumeral(volume)} data-issue={issue}>
      {live ? (
        <p className="tt-races-proof-stamp">
          PROOF · iPad 768×1024 · live {DAY} rows · {folio} · {label}
        </p>
      ) : null}
      <div className="wsj-fit">
        <div ref={ref} className="wsj-sheet">
          <header className="wsj-run">
            <span className="wsj-run-plate">The Thompson Times</span>
            <span className="wsj-run-section">
              <b>A</b>
              <span>The Essentials</span>
              <em>{label}</em>
            </span>
            <span className="wsj-run-folio">
              {editionDateline(DAY)}
              <b>{folio}</b>
            </span>
          </header>
          <div className="wsj-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
