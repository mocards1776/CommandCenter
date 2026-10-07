import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TimesHoldShell } from "@/components/newspaper/TimesHold";
import { pageFit } from "@/lib/newspaper-fit";
import {
  flatEditionExpired,
  flatManifestUrl,
  isFlatManifest,
  type FlatManifest,
  type FlatPage,
} from "@/lib/newspaper-flat";
import { parsePressId, pressEdition } from "@/lib/newspaper";
import { supabase } from "@/lib/supabase";

const PAGE_W = 1032;
const NEAR = 3;

function sectionOf(folio: string): string {
  const match = /^([A-Z]+)/.exec(folio);
  return match ? match[1]! : folio;
}

function chicagoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/**
 * The printed paper. One image per folio, the same pager gestures as the live
 * Times, and a transparent layer for the links captured at print time.
 * No story tree and no live desks.
 */
export function FlatPaper({ onFallback }: { onFallback: () => void }) {
  const [params, setParams] = useSearchParams();
  const asked = parsePressId(params.get("edition") ?? "")?.id ?? pressEdition().id;
  const [manifest, setManifest] = useState<FlatManifest | null>(null);
  const [editions, setEditions] = useState<string[]>([asked]);
  const [pageIndex, setPageIndex] = useState(0);
  const [fit, setFit] = useState(1);
  const [a1Ready, setA1Ready] = useState(false);
  const pagerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const fallback = useRef(onFallback);
  fallback.current = onFallback;

  useEffect(() => {
    let cancel = false;
    setManifest(null);
    setA1Ready(false);
    setPageIndex(0);
    indexRef.current = 0;
    const url = flatManifestUrl(import.meta.env.VITE_SUPABASE_URL, asked);
    void fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancel) return;
        if (!isFlatManifest(data) || data.issueId !== asked) fallback.current();
        else setManifest(data);
      })
      .catch(() => {
        if (!cancel) fallback.current();
      });
    return () => {
      cancel = true;
    };
  }, [asked]);

  useEffect(() => {
    const today = chicagoToday();
    void supabase
      .from("newspaper_issues")
      .select("id,printed_at")
      .eq("status", "ready")
      .order("printed_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        const ids = (data ?? [])
          .map((row) => row.id)
          .filter((id) => parsePressId(id) && !flatEditionExpired(id, today));
        if (ids.length) setEditions(ids);
      });
  }, []);

  const pages = manifest?.pages ?? [];

  useLayoutEffect(() => {
    const el = pagerRef.current;
    if (!el) return;
    const apply = () => setFit(pageFit(el.clientWidth, PAGE_W));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [manifest]);

  const go = useCallback(
    (idx: number) => {
      const el = pagerRef.current;
      if (!el || !pages.length) return;
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      const leaf = el.querySelectorAll(".wsj-page")[next] as HTMLElement | undefined;
      if (leaf) leaf.scrollTop = 0;
      el.scrollTo({
        left: next * el.clientWidth,
        behavior: Math.abs(next - indexRef.current) > NEAR ? "instant" : "smooth",
      });
      indexRef.current = next;
      setPageIndex(next);
      const folio = pages[next]?.folio;
      if (folio) window.history.replaceState(null, "", `#${folio}`);
    },
    [pages],
  );

  useEffect(() => {
    const el = pagerRef.current;
    if (!el || !pages.length) return;
    let timer = 0;
    const settle = () => {
      const idx = Math.round(el.scrollLeft / (el.clientWidth || 1));
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      if (next !== indexRef.current) {
        indexRef.current = next;
        setPageIndex(next);
        const folio = pages[next]?.folio;
        if (folio) window.history.replaceState(null, "", `#${folio}`);
      }
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", settle);
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const idx = pages.findIndex((p) => p.folio === hash);
      if (idx > 0) go(idx);
    }
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", settle);
    };
  }, [pages, go]);

  useEffect(() => {
    const root = pagerRef.current;
    if (!root) return;
    const imgs = [...root.querySelectorAll<HTMLImageElement>("img")];
    const jobs: Promise<unknown>[] = [];
    imgs.forEach((img, i) => {
      if (i < pageIndex || i > pageIndex + NEAR) return;
      img.loading = "eager";
      jobs.push(img.decode().catch(() => undefined));
    });
    void Promise.all(jobs);
    const idle = window.requestIdleCallback?.bind(window) ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const id = idle(() => {
      for (let i = pageIndex + NEAR + 1; i < pages.length; i++) {
        const img = new Image();
        img.decoding = "async";
        img.src = pages[i]!.url;
      }
    });
    return () => {
      if (window.cancelIdleCallback && typeof id === "number") window.cancelIdleCallback(id);
    };
  }, [pageIndex, pages]);

  if (!manifest) return <TimesHoldShell line="Opening the printed edition" />;

  const current = pages[pageIndex];
  const sections: { code: string; index: number }[] = [];
  for (const page of pages) {
    const code = page.section || sectionOf(page.folio);
    if (!sections.some((s) => s.code === code)) sections.push({ code, index: page.index });
  }
  const sectionIdx = sections.findIndex((s) => s.code === (current ? current.section || sectionOf(current.folio) : ""));

  function openHotspot(page: FlatPage, folio: string | null, href: string | null) {
    if (folio && pages.some((p) => p.folio === folio)) {
      go(pages.findIndex((p) => p.folio === folio));
      return;
    }
    if (href) window.location.assign(href);
    void page;
  }

  return (
    <div
      className="newspaper-root wsj-shell"
      data-times-flat="1"
      data-times-ready={a1Ready ? "1" : "0"}
      data-times-issue={manifest.issueId}
    >
      <div className="wsj-chrome print:hidden">
        <div className="wsj-chrome-l">
          <strong>Thompson Times</strong>
          <span>
            {current ? `Section ${current.section || sectionOf(current.folio)} · ${current.folio}` : manifest.issueId}
          </span>
        </div>
        <div className="wsj-chrome-c">
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Previous section"
            disabled={sectionIdx <= 0}
            onClick={() => {
              const prev = sections[sectionIdx - 1];
              if (prev) go(prev.index);
            }}
          >
            <ChevronLeft size={14} />
            <ChevronLeft size={14} className="-ml-2 opacity-60" />
          </button>
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Previous page"
            disabled={pageIndex <= 0}
            onClick={() => go(pageIndex - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="wsj-pager-label">
            {current?.folio ?? "A1"}
            <em>
              {pageIndex + 1}/{pages.length}
            </em>
          </span>
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Next page"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => go(pageIndex + 1)}
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="wsj-pager-btn"
            aria-label="Next section"
            disabled={sectionIdx < 0 || sectionIdx >= sections.length - 1}
            onClick={() => {
              const next = sections[sectionIdx + 1];
              if (next) go(next.index);
            }}
          >
            <ChevronRight size={14} className="-mr-2 opacity-60" />
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="wsj-chrome-r">
          <label className="wsj-chrome-btn">
            Edition
            <select
              aria-label="Edition"
              value={asked}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set("edition", e.target.value);
                next.set("flat", "1");
                setParams(next);
              }}
            >
              {editions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="newspaper-edition wsj-pager" ref={pagerRef} style={{ ["--tt-fit" as string]: String(fit) }}>
        {pages.map((page, index) => (
          <section key={page.folio} className="wsj-page" aria-label={`Page ${page.folio}`} data-folio={page.folio} data-kind={page.kind}>
            <div className="tt-flat-sheet" style={{ width: PAGE_W, zoom: fit }}>
              <div style={{ position: "relative", width: PAGE_W }}>
                <img
                  src={page.url}
                  alt=""
                  width={page.cssWidth}
                  height={page.cssHeight}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  loading={index <= NEAR ? "eager" : "lazy"}
                  draggable={false}
                  style={{ display: "block", width: "100%", height: "auto" }}
                  onLoad={
                    index === 0
                      ? (e) => {
                          void e.currentTarget.decode().then(
                            () => setA1Ready(true),
                            () => setA1Ready(true),
                          );
                        }
                      : undefined
                  }
                />
                <div style={{ position: "absolute", inset: 0 }}>
                  {page.hotspots.map((spot, i) => {
                    const style = {
                      position: "absolute" as const,
                      left: `${spot.x * 100}%`,
                      top: `${spot.y * 100}%`,
                      width: `${spot.w * 100}%`,
                      height: `${spot.h * 100}%`,
                      background: "transparent",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                    };
                    const href = spot.href || (spot.folio ? `#${spot.folio}` : undefined);
                    return (
                      <a
                        key={`${page.folio}-${i}`}
                        href={href}
                        aria-label={spot.label || spot.folio || "Link"}
                        style={style}
                        onClick={(event) => {
                          if (spot.folio && pages.some((p) => p.folio === spot.folio)) {
                            event.preventDefault();
                            openHotspot(page, spot.folio, null);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
