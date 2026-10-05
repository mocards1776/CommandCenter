import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { RecapBox, RecapChrome, RecapPhoto } from "@/components/newspaper/GameRecap";
import { SaveMark } from "@/components/newspaper/SaveMark";
import { fetchEspnRecapStory } from "@/lib/newspaper-box";
import { formatRecapWhen, recapBodyForPage, recapDropLead, recapIsScoreOnly, recapShouldDropCap, splitApDateline } from "@/lib/newspaper-recap";
import { cleanStoryCopy, isNavSoup, proseParas, readableCopy } from "@/lib/newspaper-copy";
import { isBoilerplateDek, storySource } from "@/lib/newspaper-source";
import { fetchRssArticle, scrubReaderChrome, stripDuplicateContentImages } from "@/lib/rss";
import { cn } from "@/lib/utils";
import { ReaderContext, type ReaderStory } from "@/components/newspaper/reader-context";

type ReaderBody = {
  html: string | null;
  text: string | null;
  photo: string | null;
  photoWidth: number | null;
  byline: string | null;
};

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [story, setStory] = useState<ReaderStory | null>(null);
  const open = useCallback((next: ReaderStory) => setStory(next), []);
  return (
    <ReaderContext.Provider value={open}>
      {children}
      {story && typeof document !== "undefined"
        ? createPortal(<PaperReader story={story} onClose={() => setStory(null)} />, document.body)
        : null}
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
  return formatRecapWhen(iso);
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
      if (game?.recap?.html && !isNavSoup(game.recap.html.replace(/<[^>]+>/g, " "))) {
        return { html: game.recap.html, text: null, photo: game.recap.photo, photoWidth: card.photoWidth ?? null, byline: game.recap.byline };
      }
      const own = readableCopy(card.body);
      const filed = card.sportLabel === "National" ? 80 : LONG_BODY;
      if (own.length >= filed) {
        return {
          html: null,
          text: own,
          photo: card.photo ?? null,
          photoWidth: card.photoWidth ?? null,
          byline: card.dateline ?? null,
        };
      }
      if (source && !isEspnGamePage(source)) {
        try {
          const article = await queryClient.fetchQuery({
            queryKey: ["rss-article-v3", source],
            queryFn: () => fetchRssArticle(source),
            staleTime: 10 * 60_000,
          });
          const text = readableCopy(article.contentText);
          if (text.length > Math.max(240, own.length)) {
            const html = article.contentHtml && !isNavSoup(article.contentHtml.replace(/<[^>]+>/g, " "))
              ? article.contentHtml
              : null;
            return { html, text: html ? null : text, photo: article.image, photoWidth: card.photoWidth ?? null, byline: article.byline };
          }
        } catch {
          /* fall through to the wire copy */
        }
      }
      if (espnEvent && path) {
        const espn = await fetchEspnRecapStory(path, espnEvent);
        if (espn && !isNavSoup(espn.html.replace(/<[^>]+>/g, " "))) {
          return { html: espn.html, text: null, photo: espn.photo, photoWidth: espn.photoWidth ?? card.photoWidth ?? null, byline: espn.byline };
        }
      }
      return { html: null, text: own, photo: null, photoWidth: card.photoWidth ?? null, byline: null };
    },
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    document.documentElement.classList.add("tt-reader-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.documentElement.classList.remove("tt-reader-open");
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const close = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 });
  }, [card.id]);

  const photo = card.photo || body.data?.photo || null;
  const html = useMemo(() => {
    const raw = body.data?.html;
    if (!raw) return null;
    return stripDuplicateContentImages(scrubReaderChrome(raw), photo);
  }, [body.data?.html, photo]);
  const paras = useMemo(() => {
    const text = recapBodyForPage(body.data?.text ?? "");
    return text ? proseParas(text) : [];
  }, [body.data?.text]);
  const dropCap = recapShouldDropCap(paras.join(" "));
  const skipBody = !html && recapIsScoreOnly(body.data?.text ?? paras.join(" "));
  const lifted = cleanStoryCopy(card.body).author;
  const outlet = storySource(card) ?? `${card.sportLabel} Wire`;
  const byline = body.data?.byline || (lifted ? `${lifted} · ${outlet}` : card.dateline || null);
  const kicker = [card.sportLabel, card.round || (card.postseason ? "Postseason" : null), card.teamName]
    .filter(Boolean)
    .join(" · ");
  const dek =
    card.dek && card.dek.trim() !== card.headline.trim() && !isBoilerplateDek(card.dek) ? card.dek : null;

  return (
    <div className="tt-reader" role="dialog" aria-modal="true" aria-label={card.headline}>
      <div className="tt-reader-bar">
        <button type="button" onPointerDown={close} className="tt-reader-back">
          <ArrowLeft size={14} /> Back to the paper
        </button>
        <span className="tt-reader-plate">The Thompson Times</span>
        <span className="tt-reader-tools">
          <SaveMark card={card} className="tt-save-reader" label="Save" />
          {source ? (
            <a href={source} target="_blank" rel="noreferrer" className="tt-reader-orig">
              Original <ExternalLink size={12} />
            </a>
          ) : null}
        </span>
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
                <em>By</em> {outlet}
              </>
            )}
            {card.when ? <span> · {whenLine(card.when)}</span> : null}
          </p>

          <RecapChrome card={card} game={game ?? null} />

          <RecapPhoto
            url={photo}
            width={body.data?.photoWidth ?? card.photoWidth}
            caption={card.caption}
          />

          {body.isLoading ? (
            <p className="tt-reader-wait">Setting the story in type…</p>
          ) : html ? (
            <div className={cn("tt-reader-body", recapShouldDropCap(html.replace(/<[^>]+>/g, " ")) && "drop")} dangerouslySetInnerHTML={{ __html: html }} />
          ) : skipBody ? null : paras.length ? (
            <div className={cn("tt-reader-body", dropCap && "drop")}>
              {paras.map((p, i) => {
                if (i === 0 && dropCap) {
                  const lead = recapDropLead(card.dateline, p);
                  if (lead) {
                    return (
                      <p key={i}>
                        <span className="wsj-drop">{lead.letter}</span>
                        {lead.datelineRest != null ? <span className="wsj-dateline">{lead.datelineRest} — </span> : null}
                        {lead.body}
                      </p>
                    );
                  }
                }
                if (i === 0) {
                  const split = splitApDateline(p);
                  const city = card.dateline || split.dateline;
                  return (
                    <p key={i}>
                      {city ? <span className="wsj-dateline">{city} — </span> : null}
                      {split.body}
                    </p>
                  );
                }
                return <p key={i}>{p}</p>;
              })}
            </div>
          ) : dek ? null : (
            <p className="tt-reader-wait">The wire filed a headline only.</p>
          )}

          <RecapBox
            card={card}
            game={
              game && espnEvent && !game.espnEventId ? { ...game, espnEventId: espnEvent } : game ?? null
            }
            forceFull
          />
        </article>
      </div>
    </div>
  );
}
