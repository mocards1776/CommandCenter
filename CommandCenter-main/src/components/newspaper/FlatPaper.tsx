import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TimesHoldShell } from "@/components/newspaper/TimesHold";
import { pageFit } from "@/lib/newspaper-fit";
import {
  flatEditionAsk,
  flatEditionExpired,
  flatManifestUrl,
  isFlatManifest,
  type FlatManifest,
  type FlatPage,
} from "@/lib/newspaper-flat";
import { pressEdition } from "@/lib/newspaper";
import { supabase } from "@/lib/supabase";

const PAGE_W = 1032;
const PAGE_H = 1376;

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
  const asked = flatEditionAsk(params.get("edition"), pressEdition().id);
  const [manifest, setManifest] = useState<FlatManifest | null>(null);
  const [editions, setEditions] = useState<string[]>([asked]);
  const [pageIndex, setPageIndex] = useState(0);
  const [fit, setFit] = useState(1);
  const [a1Ready, setA1Ready] = useState(false);
  const pagerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const turnToken = useRef(0);
  const decodedRef = useRef(new Set<string>());
  const imgRefs = useRef(new Map<number, HTMLImageElement>());
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
          .filter((id) => flatEditionAsk(id, "") === id && !flatEditionExpired(id, today));
        if (!ids.includes(asked)) ids.unshift(asked);
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

  const decodePage = useCallback(
    async (index: number) => {
      const page = pages[index];
      const img = imgRefs.current.get(index);
      if (!page || !img) return false;
      if (decodedRef.current.has(page.url) && img.complete && img.naturalWidth > 0) return true;
      img.decoding = "sync";
      if (img.getAttribute("src") !== page.url) img.src = page.url;
      try {
        await img.decode();
      } catch {
        return false;
      }
      if (img.naturalWidth > 0) {
        decodedRef.current.add(page.url);
        return true;
      }
      return false;
    },
    [pages],
  );

  // Stay on the page already on screen until the target bitmap is fully decoded,
  // then jump in one frame. A smooth scroll would show WebKit's late decode.
  const go = useCallback(
    (idx: number) => {
      if (!pages.length) return;
      const next = Math.max(0, Math.min(pages.length - 1, idx));
      const token = ++turnToken.current;
      void (async () => {
        await decodePage(next);
        if (token !== turnToken.current) return;
        const el = pagerRef.current;
        if (!el) return;
        const leaf = el.querySelectorAll(".wsj-page")[next] as HTMLElement | undefined;
        if (leaf) leaf.scrollTop = 0;
        indexRef.current = next;
        setPageIndex(next);
        setA1Ready(true);
        el.scrollTo({ left: next * el.clientWidth, behavior: "instant" });
        const folio = pages[next]?.folio;
        if (folio) window.history.replaceState(null, "", `#${folio}`);
      })();
    },
    [decodePage, pages],
  );

  useEffect(() => {
    const el = pagerRef.current;
    if (!el || !pages.length) return;
    const lock = () => {
      const width = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / width);
      if (idx !== indexRef.current) el.scrollTo({ left: indexRef.current * width, behavior: "instant" });
    };
    el.addEventListener("scroll", lock, { passive: true });
    const jumpHash = () => {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      const idx = hash ? pages.findIndex((p) => p.folio === hash) : 0;
      go(idx >= 0 ? idx : 0);
    };
    jumpHash();
    window.addEventListener("hashchange", jumpHash);
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0]!.clientX;
      startY = event.touches[0]!.clientY;
      tracking = true;
    };
    const touchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      go(indexRef.current + (dx < 0 ? 1 : -1));
    };
    el.addEventListener("touchstart", touchStart, { capture: true, passive: true });
    el.addEventListener("touchend", touchEnd, { capture: true });
    return () => {
      el.removeEventListener("scroll", lock);
      window.removeEventListener("hashchange", jumpHash);
      el.removeEventListener("touchstart", touchStart, true);
      el.removeEventListener("touchend", touchEnd, true);
    };
  }, [pages, go]);

  useEffect(() => {
    if (!pages.length) return;
    let cancel = false;
    void decodePage(pageIndex);
    if (pageIndex > 0) void decodePage(pageIndex - 1);
    if (pageIndex + 1 < pages.length) void decodePage(pageIndex + 1);
    void (async () => {
      for (let i = 0; i < pages.length; i++) {
        if (cancel) return;
        if (Math.abs(i - pageIndex) <= 1) continue;
        await decodePage(i);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [decodePage, pageIndex, pages.length]);

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
      style={{ position: "relative", height: "100%", overflow: "hidden" }}
      data-times-flat="1"
      data-times-ready={a1Ready ? "1" : "0"}
      data-times-issue={manifest.issueId}
    >
      {!a1Ready && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
          <TimesHoldShell line="Opening the printed edition" />
        </div>
      )}
      <style>{`
        [data-times-flat="1"] .wsj-chrome { position: absolute; top: 0; left: 0; right: 0; z-index: 4; }
        [data-times-flat="1"] .newspaper-edition.wsj-pager { position: absolute; inset: 0; height: auto; overflow: hidden; }
        [data-times-flat="1"] .wsj-page { overflow: hidden !important; max-height: none; }
      `}</style>
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
      <div
        className="newspaper-edition wsj-pager"
        ref={pagerRef}
        style={{ ["--tt-fit" as string]: String(fit), overflow: "hidden", scrollBehavior: "auto" }}
      >
        {pages.map((page, index) => (
          <section key={page.folio} className="wsj-page" aria-label={`Page ${page.folio}`} data-folio={page.folio} data-kind={page.kind} style={{ overflow: "hidden" }}>
            <div className="tt-flat-sheet" style={{ width: PAGE_W, height: PAGE_H, zoom: fit, overflow: "hidden" }}>
              <div style={{ position: "relative", width: PAGE_W, height: PAGE_H }}>
                <img
                  ref={(node) => {
                    if (node) imgRefs.current.set(index, node);
                    else imgRefs.current.delete(index);
                  }}
                  src={page.url}
                  alt=""
                  width={PAGE_W}
                  height={PAGE_H}
                  decoding="sync"
                  fetchPriority={index === pageIndex || index === pageIndex + 1 || index === pageIndex - 1 ? "high" : "low"}
                  draggable={false}
                  style={{ display: "block", width: PAGE_W, height: PAGE_H }}
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
