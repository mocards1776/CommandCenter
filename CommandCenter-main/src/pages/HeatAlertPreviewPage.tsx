import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import HeatAlertImage from "@/components/sports/HeatAlertImage";
import { heatAlertCaption, openGameUrl, situationLine } from "@heat/copy.ts";
import { loadHeatAlertCard } from "@heat/fetch-game.ts";

/**
 * Signed-in preview of the heat-alert drawing. Sending still goes through the
 * sports-telegram function or scripts/heat-alert-photo.ts — this page is not scraped.
 * The drawing follows the URL. The form is a draft until Load, so typing an id
 * does not fire a lookup on every keystroke.
 */
export default function HeatAlertPreviewPage() {
  const [params, setParams] = useSearchParams();
  const sport = params.get("sport") || "nfl";
  const gameId = params.get("game") || params.get("gameId") || "";
  const [draftSport, setDraftSport] = useState(sport);
  const [draftGameId, setDraftGameId] = useState(gameId);

  useEffect(() => {
    setDraftSport(sport);
    setDraftGameId(gameId);
  }, [sport, gameId]);

  const card = useQuery({
    queryKey: ["heat-alert-preview", sport, gameId],
    queryFn: () => loadHeatAlertCard({ sport, gameId: gameId || null }),
  });

  const caption = card.data ? heatAlertCaption(params.get("reason")) : "";
  const openUrl = card.data ? openGameUrl(window.location.origin, card.data.gamePath) : "";
  const ruwtUrl = `${window.location.origin.replace(/\/$/, "")}/sports/ruwt?solo=1`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <header className="space-y-1">
        <p className="label-caps">Sports</p>
        <h1 className="text-cream text-2xl">Heat alert photo</h1>
        <p className="text-chalk text-[13px] leading-relaxed">
          This is the drawing Telegram receives: scoreboard, a compact field, the live
          win-probability chart, and Apple-style team stats from the live game. The heat
          reason stays in the caption. Telegram adds Open game and RUWT board buttons.
        </p>
      </header>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (draftSport) next.set("sport", draftSport);
          if (draftGameId.trim()) next.set("game", draftGameId.trim());
          const reason = params.get("reason");
          if (reason) next.set("reason", reason);
          setParams(next, { replace: true });
        }}
      >
        <label className="text-[12px] text-chalk">
          Sport
          <select
            value={draftSport}
            onChange={(event) => setDraftSport(event.target.value)}
            className="mt-1 block rounded-md border border-white/10 bg-ink px-2 py-1.5 text-cream"
          >
            {["nfl", "cfb", "nhl", "mlb", "soccer"].map((item) => (
              <option key={item} value={item}>
                {item.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-chalk">
          ESPN game id
          <input
            value={draftGameId}
            onChange={(event) => setDraftGameId(event.target.value)}
            placeholder="latest live"
            className="mt-1 block w-40 rounded-md border border-white/10 bg-ink px-2 py-1.5 text-cream"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-accent-deep px-3 py-1.5 text-[12px] font-semibold text-white"
        >
          Load
        </button>
      </form>
      {card.isLoading ? <p className="text-chalk text-[13px]">Loading the game…</p> : null}
      {card.error ? (
        <p className="text-[13px] text-alert">{card.error instanceof Error ? card.error.message : "Could not load that game"}</p>
      ) : null}
      {card.data ? (
        <div className="space-y-3">
          <HeatAlertImage card={card.data} />
          <p className="text-chalk text-[12px]">{situationLine(card.data)}</p>
          <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-ink px-3 py-2 text-[12px] text-cream">
            {caption || "(no heat reason)"}
          </pre>
          <p className="text-chalk text-[12px]">
            Buttons:{" "}
            <a className="text-accent underline" href={openUrl}>
              Open game
            </a>
            {" · "}
            <a className="text-accent underline" href={ruwtUrl}>
              RUWT board
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
