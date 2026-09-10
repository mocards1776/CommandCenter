/**
 * Dev-only entry for `/newspaper-preview.html`.
 *
 * Renders the printed edition from a fixture so Print Preview can be checked
 * without signing in or hitting any API. Not part of the production bundle —
 * `vite build` only builds `index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NewspaperEdition from "@/components/newspaper/NewspaperEdition";
import { PREVIEW_EDITION } from "@/components/newspaper/preview-fixture";
import "./index.css";

document.body.classList.add("tt-paper-mode");

/** `?sparse=1` — a quiet day, to check that empty sections still page cleanly. */
const sparse = new URLSearchParams(location.search).get("sparse") === "1";

const data = sparse
  ? {
      ...PREVIEW_EDITION,
      weather: null,
      lede: ["Marshfield opens the day with the weather desk still out. Nothing on the desk carries a date, which is its own kind of news."],
      lead: { kicker: "The desk", hed: "A clear desk, and no one to blame for it", dek: "Quiet morning" },
      dayBook: { ...PREVIEW_EDITION.dayBook, today: [], tomorrow: [] },
      agenda: { ...PREVIEW_EDITION.agenda, entries: [] },
      habits: { ...PREVIEW_EDITION.habits, entries: [] },
      teams: { ...PREVIEW_EDITION.teams, entries: [] },
      upcoming: { ...PREVIEW_EDITION.upcoming, entries: [] },
      boards: PREVIEW_EDITION.boards.map((b) => ({ ...b, games: [] })),
      finals: { ...PREVIEW_EDITION.finals, groups: [] },
      players: { ...PREVIEW_EDITION.players, entries: [] },
      standings: { ...PREVIEW_EDITION.standings, tables: [] },
      leaders: { ...PREVIEW_EDITION.leaders, boards: [] },
      dispatch: { ...PREVIEW_EDITION.dispatch, paragraphs: [], continued: false, wire: [] },
    }
  : PREVIEW_EDITION;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="tt-root">
      <NewspaperEdition data={data} />
    </div>
  </StrictMode>,
);
