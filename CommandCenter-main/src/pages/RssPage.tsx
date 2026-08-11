import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import {
  DEFAULT_RSS_FEED,
  fetchRssArticle,
  fetchRssFeed,
  formatFeedDate,
  type RssFeedItem,
} from "@/lib/rss";
import StarField from "@/components/StarField";
import { cn } from "@/lib/utils";

function readingMinutes(words: number): string {
  const m = Math.max(1, Math.round(words / 220));
  return `${m} min read`;
}

function FeedList({
  items,
  onOpen,
}: {
  items: RssFeedItem[];
  onOpen: (item: RssFeedItem) => void;
}) {
  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="hover:bg-white/[0.03] group flex w-full gap-4 px-1 py-5 text-left transition-colors md:gap-5"
          >
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="bg-hero h-[72px] w-[96px] shrink-0 object-cover md:h-[88px] md:w-[120px]"
                loading="lazy"
              />
            ) : (
              <div className="bg-hero text-chalk-dim grid h-[72px] w-[96px] shrink-0 place-items-center md:h-[88px] md:w-[120px]">
                <Newspaper size={22} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="label-caps text-accent mb-1.5">
                {formatFeedDate(item.publishedAt)}
                {item.author ? ` · ${item.author}` : ""}
              </div>
              <h3 className="font-display text-cream text-[22px] leading-snug transition-colors group-hover:text-white md:text-[26px]">
                {item.title}
              </h3>
              {item.snippet ? (
                <p className="text-chalk mt-2 line-clamp-2 text-[13.5px] leading-relaxed">
                  {item.snippet}
                </p>
              ) : null}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ReaderView({
  item,
  onBack,
}: {
  item: RssFeedItem;
  onBack: () => void;
}) {
  const article = useQuery({
    queryKey: ["rss-article", item.link],
    queryFn: () => fetchRssArticle(item.link),
    staleTime: 30 * 60_000,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [item.link]);

  const title = article.data?.title || item.title;
  const byline = article.data?.byline || item.author;
  const image = article.data?.image || item.image;

  return (
    <article className="mx-auto max-w-[42rem]">
      <button
        type="button"
        onClick={onBack}
        className="text-chalk hover:text-cream mb-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to feed
      </button>

      <header className="mb-8">
        <div className="label-caps text-accent mb-3">
          {formatFeedDate(item.publishedAt)}
          {byline ? ` · ${byline}` : ""}
          {article.data?.wordCount
            ? ` · ${readingMinutes(article.data.wordCount)}`
            : ""}
        </div>
        <h2 className="font-display text-cream text-[32px] leading-[1.15] md:text-[40px]">
          {title}
        </h2>
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-chalk hover:text-accent mt-4 inline-flex items-center gap-1.5 text-[12px] transition-colors"
        >
          Original
          <ExternalLink size={12} />
        </a>
      </header>

      {image ? (
        <img
          src={image}
          alt=""
          className="mb-8 max-h-[320px] w-full object-cover"
        />
      ) : null}

      {article.isLoading ? (
        <p className="label-caps animate-pulse">Extracting text</p>
      ) : article.isError ? (
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not extract article text:{" "}
          {article.error instanceof Error ? article.error.message : String(article.error)}
          <div className="mt-3">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream underline underline-offset-2"
            >
              Open original
            </a>
          </div>
        </div>
      ) : (
        <div
          className="rss-reader prose-invert max-w-none text-[17px] leading-[1.7] text-[#e8eaf0] [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-chalk [&_em]:text-[#d9dce6] [&_h2]:font-display [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-[26px] [&_h2]:text-cream [&_h3]:font-display [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[22px] [&_h3]:text-cream [&_img]:my-6 [&_img]:max-h-[360px] [&_img]:w-full [&_img]:object-contain [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-4 [&_strong]:text-cream [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: article.data?.contentHtml ?? "" }}
        />
      )}
    </article>
  );
}

export default function RssPage() {
  const [selected, setSelected] = useState<RssFeedItem | null>(null);

  const feed = useQuery({
    queryKey: ["rss-feed", DEFAULT_RSS_FEED],
    queryFn: () => fetchRssFeed(DEFAULT_RSS_FEED),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex flex-col gap-5 p-6 md:p-7">
      {!selected && (
        <div className="from-hero-lift to-hero relative overflow-hidden rounded border border-accent/30 bg-gradient-to-br px-7 py-6">
          <StarField count={28} seed={17} />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="rule-head">RSS</div>
              <h2 className="font-display text-cream mt-2 text-[34px] leading-tight md:text-[40px]">
                {feed.data?.title || "Missouri Scout"}
              </h2>
              <p className="text-chalk mt-2 max-w-xl text-sm leading-relaxed">
                Full article text extracted for reading — no need for Apple Reader Mode.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void feed.refetch()}
              disabled={feed.isFetching}
              className={cn(
                "text-chalk hover:text-cream relative z-10 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] transition-colors",
                feed.isFetching && "opacity-50",
              )}
            >
              <RefreshCw size={13} className={feed.isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      )}

      {feed.isLoading && !selected ? (
        <p className="label-caps animate-pulse">Loading feed</p>
      ) : feed.isError && !selected ? (
        <div className="bg-panel border-alert/40 text-alert rounded border p-4 text-sm">
          Could not load feed:{" "}
          {feed.error instanceof Error ? feed.error.message : String(feed.error)}
        </div>
      ) : selected ? (
        <ReaderView item={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="bg-panel rounded border border-white/[0.06] px-4 md:px-5">
          <FeedList items={feed.data?.items ?? []} onOpen={setSelected} />
        </div>
      )}
    </div>
  );
}
