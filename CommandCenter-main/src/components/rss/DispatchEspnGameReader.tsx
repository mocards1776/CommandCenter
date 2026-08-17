import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Loader2, Share } from "lucide-react";
import toast from "react-hot-toast";
import { SelectableHighlightRegion } from "@/components/rss/SelectableHighlightRegion";
import { MlbGameDetail } from "@/pages/MlbGamePage";
import { NflGameDetailView } from "@/pages/NflGamePage";
import { SoccerGameDetailView } from "@/pages/SoccerGamePage";
import { parseEspnGameIdFromUrl, resolveMlbGamePkFromEspnEvent } from "@/lib/mlb";
import { fetchNflGameDetail } from "@/lib/nfl";

function isNflEspnUrl(url: string): boolean {
  return /espn\.com\/nfl\//i.test(url);
}

function isSoccerEspnUrl(url: string): boolean {
  return /espn\.com\/soccer\//i.test(url);
}

function soccerLeagueHintFromUrl(url: string): string | null {
  const m =
    url.match(/[?&]league=([a-z0-9.]+)/i) ||
    url.match(/\/league\/_\/name\/([a-z0-9.]+)/i) ||
    url.match(/soccer\/([a-z]{2,}\.\d+)\//i);
  return m?.[1]?.toLowerCase() ?? null;
}

async function fetchEspnStoryFallback(
  eventId: string,
  sport: "mlb" | "nfl",
): Promise<{ headline: string; html: string; url: string } | null> {
  const path = sport === "nfl" ? "football/nfl" : "baseball/mlb";
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(eventId)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const sum = (await res.json()) as {
    article?: {
      headline?: string;
      description?: string;
      story?: string;
      links?: { web?: { href?: string } };
    };
  };
  const article = sum.article;
  const html =
    article?.story?.trim() ||
    (article?.description ? `<p>${article.description.replace(/^—\s*/, "")}</p>` : "");
  if (!html || html.replace(/<[^>]+>/g, "").trim().length < 40) return null;
  return {
    headline: article?.headline || "Game story",
    html,
    url:
      article?.links?.web?.href ||
      `https://www.espn.com/${sport}/preview/_/gameId/${eventId}`,
  };
}

export default function DispatchEspnGameReader({
  url,
  title,
  heroImage,
  leagueHint,
  onBack,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  url: string;
  title?: string;
  heroImage?: string | null;
  /** Preferred ESPN soccer league slug (e.g. eng.1 / eng.2). */
  leagueHint?: string | null;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const eventId = parseEspnGameIdFromUrl(url);
  const nfl = isNflEspnUrl(url);
  const soccer = isSoccerEspnUrl(url);
  const soccerLeagueHint = leagueHint || (soccer ? soccerLeagueHintFromUrl(url) : null);

  const resolved = useQuery({
    queryKey: ["mlb-gamepk-from-espn", eventId],
    queryFn: () => resolveMlbGamePkFromEspnEvent(eventId!),
    enabled: Boolean(eventId) && !nfl && !soccer,
    staleTime: 300_000,
    retry: 1,
  });

  const nflGame = useQuery({
    queryKey: ["nfl-game-dispatch", eventId],
    queryFn: () => fetchNflGameDetail(eventId!),
    enabled: Boolean(eventId) && nfl,
    staleTime: 30_000,
  });

  const fallback = useQuery({
    queryKey: ["espn-story-fallback", nfl ? "nfl" : "mlb", eventId],
    queryFn: () => fetchEspnStoryFallback(eventId!, nfl ? "nfl" : "mlb"),
    enabled:
      Boolean(eventId) &&
      !soccer &&
      (nfl
        ? nflGame.isSuccess && !nflGame.data?.article?.storyHtml
        : resolved.isSuccess && resolved.data == null),
    staleTime: 300_000,
  });

  async function shareLink() {
    const shareTitle = title || (soccer ? "Soccer match" : nfl ? "NFL game" : "MLB game");
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url, text: shareTitle });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        toast.error("Couldn't share");
      }
    }
  }

  const chrome = (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="font-body text-chalk hover:text-cream inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={() => void shareLink()}
          className="font-body text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
        >
          <Share size={14} />
          Share
        </button>
      </div>
      {(onPrev || onNext) && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev || !onPrev}
            onClick={onPrev}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <button
            type="button"
            disabled={!hasNext || !onNext}
            onClick={onNext}
            className="font-body text-chalk hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] disabled:opacity-30"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );

  const hero = heroImage ? (
    <div className="relative -mx-4 mb-4 overflow-hidden md:-mx-7">
      <div className="relative aspect-[16/9] max-h-[280px] w-full md:aspect-[21/9] md:max-h-[340px]">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-[#07101f]/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c1a36]/55 via-transparent to-[#1a0e14]/35" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 md:px-7">
          <p className="text-accent text-[10px] font-semibold uppercase tracking-[0.2em]">
            Game wrap
          </p>
          {title ? (
            <h2 className="font-rss text-cream mt-1 max-w-2xl text-[22px] font-semibold leading-snug md:text-[28px]">
              {title}
            </h2>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  if (!eventId) {
    return (
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
        {chrome}
        <p className="text-alert text-[13px]">Couldn’t find an ESPN game id in this link.</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[12px] underline-offset-2 hover:underline"
        >
          Open original <ExternalLink size={12} />
        </a>
      </div>
    );
  }

  if (soccer) {
    return (
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
        {chrome}
        {hero}
        <SoccerGameDetailView
          eventId={eventId!}
          leagueHint={soccerLeagueHint}
          title={title}
          espnUrl={url}
        />
      </div>
    );
  }

  if (nfl) {
    if (nflGame.isPending) {
      return (
        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
          {chrome}
          <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Loading NFL game…
          </div>
        </div>
      );
    }
    if (nflGame.data || eventId) {
      return (
        <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
          {chrome}
          {hero}
          <NflGameDetailView eventId={eventId!} suppressStoryHeader={Boolean(heroImage || title)} />
        </div>
      );
    }
  }

  if (!nfl && !soccer && resolved.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
        {chrome}
        <div className="text-chalk flex min-h-[40vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Loading game…
        </div>
      </div>
    );
  }

  if (!nfl && !soccer && resolved.data != null) {
    return (
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
        {chrome}
        {hero}
        <MlbGameDetail
          gamePk={String(resolved.data)}
          espnEventId={eventId}
          suppressWrapHeader={Boolean(heroImage || title)}
        />
      </div>
    );
  }

  if (fallback.isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
        {chrome}
        <div className="text-chalk flex min-h-[30vh] items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Extracting preview…
        </div>
      </div>
    );
  }

  if (fallback.data) {
    return (
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
        {chrome}
        {hero}
        <section className="bg-panel overflow-hidden rounded-xl border border-white/[0.08] font-rss">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Game preview
            </p>
            <h2 className="font-rss mt-1 text-[20px] font-semibold leading-snug text-cream sm:text-[22px]">
              {fallback.data.headline}
            </h2>
          </div>
          <SelectableHighlightRegion
            articleUrl={url}
            articleTitle={fallback.data.headline || title || "Game preview"}
            feedUrl={nfl ? "synthetic:nfl-wraps" : "synthetic:mlb-wraps"}
            articleImage={heroImage ?? null}
            html={fallback.data.html}
            className="rss-reader px-4 py-4 text-[15px] leading-[1.75] text-[#d5dae6] [&_a]:font-semibold [&_a]:text-accent [&_a]:hover:underline [&_p]:my-3.5 [&_mark.rss-hl]:bg-accent/35 [&_mark.rss-hl]:text-cream"
          />
          <div className="px-4 pb-4">
            <a
              href={fallback.data.url}
              target="_blank"
              rel="noreferrer"
              className="text-chalk-dim hover:text-cream inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]"
            >
              ESPN <ExternalLink size={11} />
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden px-3 py-4 sm:p-4 md:p-7">
      {chrome}
      <p className="text-alert text-[13px]">Couldn’t extract this ESPN game story.</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-chalk hover:text-cream inline-flex items-center gap-1.5 text-[12px] underline-offset-2 hover:underline"
      >
        Open original <ExternalLink size={12} />
      </a>
    </div>
  );
}
