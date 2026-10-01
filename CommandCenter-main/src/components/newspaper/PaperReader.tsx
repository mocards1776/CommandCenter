import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Decisions, Goals, Leaders, Linescore, MlbAgate } from "@/components/newspaper/BoxScore";
import { fetchEspnRecapStory, gameClock } from "@/lib/newspaper-box";
import { proseParas } from "@/lib/newspaper-copy";
import { fetchRssArticle, scrubReaderChrome, stripDuplicateContentImages } from "@/lib/rss";
import { cn } from "@/lib/utils";
import { ReaderContext, type ReaderStory } from "@/components/newspaper/reader-context";

type ReaderBody = {
  html: string | null;
  text: string | null;
  photo: string | null;
  byline: string | null;
};

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [story, setStory] = useState<ReaderStory | null>(null);
  const open = useCallback((next: ReaderStory) => setStory(next), []);
  return (
    <ReaderContext.Provider value={open}>
      {children}
      {story ? <PaperReader story={story} onClose={() => setStory(null)} /> : null}
    </ReaderContext.Provider>
  );
}

const LONG_BODY = 600;

function httpUrl(href: string | null | undefined): string | null {
  return href && /^https?:\/\//i.test(href) ? href : null;
}

/** ESPN's game pages are a scoreboard, not an article — the summary API carries the story. */
function isEspnGamePage(url: string): boolean {
  return /espn\.com\/.+\/(?:game|recap|preview|match)\b/i.test(url);
}

function espnEventOf(story: ReaderStory): string | null {
  if (story.game?.espnEventId) return story.game.espnEventId;
  const url = httpUrl(story.card.wrapHref) ?? "";
  const hit = url.match(/gameId\/(\d+)/) ?? url.match(/\/game\/(?:_\/)?(?:id\/)?(\d{6,})/);
  if (hit) return hit[1]!;
  if (/espn\.com/i.test(url) && story.card.gameId && /^\d{6,}$/.test(story.card.gameId)) {
    return story.card.gameId;
  }
  return null;
}

function whenLine(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function PaperReader({ story, onClose }: { story: ReaderStory; onClose: () => void }) {
  const { card, game } = story;
  const queryClient = useQueryClient();
  const sheetRef = useRef<HTMLDivElement>(null);
  const source = httpUrl(card.wrapHref) ?? httpUrl(game?.recap?.url) ?? httpUrl(card.gameHref);
  const espnEvent = espnEventOf(story);
  const path = game?.path ?? card.leaguePath;

  const body = useQuery({
    queryKey: ["tt-reader", card.id, source, espnEvent],
    queryFn: async (): Promise<ReaderBody> => {
      if (game?.recap?.html) {
        return { html: game.recap.html, text: null, photo: game.recap.photo, byline: game.recap.byline };
      }
      const own = card.body?.trim() ?? "";
      if (own.length >= LONG_BODY) return { html: null, text: own, photo: null, byline: null };
      if (source && !isEspnGamePage(source)) {
        try {
          const article = await queryClient.fetchQuery({
            queryKey: ["rss-article-v3", source],
            queryFn: () => fetchRssArticle(source),
            staleTime: 10 * 60_000,
          });
          if ((article.contentText?.length ?? 0) > Math.max(240, own.length)) {
            return { html: article.contentHtml, text: null, photo: article.image, byline: article.byline };
          }
        } catch {
          /* fall through to the wire copy */
        }
      }
      if (espnEvent && path) {
        const espn = await fetchEspnRecapStory(path, espnEvent);
        if (espn) return { html: espn.html, text: null, photo: espn.photo, byline: espn.byline };
      }
      return { html: null, text: own || card.dek || "", photo: null, byline: null };
    },
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [card.id]);

  const photo = card.photo || body.data?.photo || null;
  const html = useMemo(() => {
    const raw = body.data?.html;
    if (!raw) return null;
    return stripDuplicateContentImages(scrubReaderChrome(raw), photo);
  }, [body.data?.html, photo]);
  const paras = useMemo(() => proseParas(body.data?.text ?? ""), [body.data?.text]);
  const byline = body.data?.byline || null;
  const kicker = [card.sportLabel, card.round || (card.postseason ? "Postseason" : null), card.teamName]
    .filter(Boolean)
    .join(" · ");
  const dek = card.dek && card.dek.trim() !== card.headline.trim() ? card.dek : null;

  return (
    <div className="tt-reader" role="dialog" aria-modal="true" aria-label={card.headline}>
      <div className="tt-reader-bar">
        <button type="button" onClick={onClose} className="tt-reader-back">
          <ArrowLeft size={14} /> Back to the paper
        </button>
        <span className="tt-reader-plate">The Thompson Times</span>
        {source ? (
          <a href={source} target="_blank" rel="noreferrer" className="tt-reader-orig">
            Original <ExternalLink size={12} />
          </a>
        ) : (
          <span />
        )}
      </div>
      <div className="tt-reader-scroll" ref={sheetRef} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <article
          className="tt-reader-sheet"
          style={story.color ? { ["--tt-team" as string]: story.color } : undefined}
        >
          <p className="wsj-kicker">{kicker}</p>
          <h1 className="tt-reader-hl">{card.headline}</h1>
          {dek ? <p className="tt-reader-dek">{dek}</p> : null}
          <p className="tt-reader-by">
            {byline ? (
              <>
                <em>By</em> {byline}
              </>
            ) : (
              <>
                <em>By</em> {card.sportLabel} Wire
              </>
            )}
            {card.when ? <span> · {whenLine(card.when)}</span> : null}
          </p>

          {game && (game.final || game.live) ? (
            <section className="tt-reader-box">
              <header>
                <b>{gameClock(game)}</b>
                <span>{[game.round, game.series, game.venue].filter(Boolean).join(" · ")}</span>
              </header>
              <Linescore game={game} />
              <Decisions game={game} faces />
              <Goals game={game} />
              <Leaders game={game} max={4} />
            </section>
          ) : null}

          {photo ? (
            <figure className="tt-reader-photo">
              <img src={photo} alt="" />
              {card.caption ? <figcaption>{card.caption}</figcaption> : null}
            </figure>
          ) : null}

          {body.isLoading ? (
            <p className="tt-reader-wait">Setting the story in type…</p>
          ) : html ? (
            <div className="tt-reader-body" dangerouslySetInnerHTML={{ __html: html }} />
          ) : paras.length ? (
            <div className="tt-reader-body">
              {paras.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : (
            <p className="tt-reader-wait">The wire filed a headline only.</p>
          )}

          {game?.path === "baseball/mlb" && (game.final || game.live) ? (
            <section className={cn("tt-reader-agate")}>
              <h3>Box score</h3>
              <MlbAgate game={game} />
            </section>
          ) : null}
        </article>
      </div>
    </div>
  );
}
