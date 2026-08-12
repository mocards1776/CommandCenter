import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientStory, ConditionItem } from "@/lib/stories/types";

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  story: ClientStory;
  clientMode?: boolean;
  label?: string | null;
};

function statusTone(status: ConditionItem["status"]) {
  switch (status) {
    case "new":
      return { chip: "New", className: "is-new" };
    case "recent":
      return { chip: "Recent", className: "is-recent" };
    case "partial":
      return { chip: "Partial", className: "is-partial" };
    default:
      return { chip: "Original", className: "is-original" };
  }
}

function mapsEmbedSrc(story: ClientStory) {
  const q = encodeURIComponent(story.geo.label);
  return `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
}

function osmEmbedSrc(story: ClientStory) {
  const { lat, lng } = story.geo;
  const d = 0.012;
  const bbox = `${lng - d}%2C${lat - d * 0.7}%2C${lng + d}%2C${lat + d * 0.7}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function streetViewSrc(story: ClientStory) {
  const { lat, lng } = story.geo;
  // Query-based Street View embed — no API key required for basic iframe use.
  return `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&output=svembed`;
}

/**
 * Full-bleed chapter scroll for client presentations.
 * Capitol brand on paper — navy ink, red accent, Playfair display.
 */
export default function ScrollStory({ story, clientMode = true, label }: Props) {
  const [active, setActive] = useState("hero");
  const [mapProvider, setMapProvider] = useState<"google" | "osm">("google");
  const rootRef = useRef<HTMLDivElement>(null);

  const toc = useMemo(
    () => [
      { id: "hero", label: "Open" },
      ...story.chapters.map((c) => ({ id: c.id, label: c.eyebrow })),
      { id: "comps", label: "Comps" },
      { id: "range", label: "Range" },
      { id: "notebook", label: "Notebook" },
    ],
    [story.chapters],
  );

  const maxComp = Math.max(...story.comps.map((c) => c.price ?? 0), story.valuation.offer);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>("[data-chapter]");
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { root: null, threshold: [0.25, 0.45], rootMargin: "-8% 0px -40% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [story.slug]);

  useEffect(() => {
    document.title = label ? `${story.metaTitle} · ${label}` : story.metaTitle;
  }, [story.metaTitle, label]);

  return (
    <div ref={rootRef} className="story-root">
      <style>{STORY_CSS}</style>

      {clientMode ? (
        <nav className="story-rail" aria-label="Chapters">
          <div className="story-rail-brand">{story.brand}</div>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={active === t.id ? "is-active" : undefined}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {t.label}
            </a>
          ))}
        </nav>
      ) : null}

      {/* ── Hero: brand + map plane ─────────────────────────────────────── */}
      <header className="story-hero" id="hero" data-chapter>
        <div className="hero-map" aria-hidden={false}>
          <iframe
            title={`Map of ${story.address}`}
            src={mapProvider === "google" ? mapsEmbedSrc(story) : osmEmbedSrc(story)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="hero-map-veil" />
          <button
            type="button"
            className="map-swap"
            onClick={() => setMapProvider((p) => (p === "google" ? "osm" : "google"))}
          >
            {mapProvider === "google" ? "OSM map" : "Google map"}
          </button>
        </div>
        <div className="hero-copy">
          <p className="story-brand reveal">{story.brand}</p>
          <p className="story-kicker reveal delay-1">{story.cityLine}</p>
          <h1 className="reveal delay-2">{story.address}</h1>
          <p className="story-lede reveal delay-3">{story.heroLine}</p>
          <p className="story-support reveal delay-4">{story.support}</p>
          <div className="hero-offer reveal delay-5">
            <div>
              <span className="hero-offer-label">Offer on the table</span>
              <strong>{money(story.valuation.offer)}</strong>
            </div>
            <div>
              <span className="hero-offer-label">Market mid</span>
              <strong className="muted">{money(story.valuation.mid)}</strong>
            </div>
            <div>
              <span className="hero-offer-label">vs Zestimate</span>
              <strong className="accent">
                −{Math.round((1 - story.valuation.offer / story.valuation.zest) * 100)}%
              </strong>
            </div>
          </div>
          <dl className="story-facts reveal delay-5">
            {story.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {story.chapters.map((ch) => (
        <section key={ch.id} id={ch.id} className="story-chapter" data-chapter>
          <div className="chapter-grid">
            <div className="chapter-copy">
              <p className="story-eyebrow">{ch.eyebrow}</p>
              <h2>{ch.title}</h2>
              <p className="story-body">{ch.body}</p>
              {ch.stat ? (
                <div className="story-stat">
                  <span className="story-stat-value">{ch.stat.value}</span>
                  <span className="story-stat-label">{ch.stat.label}</span>
                </div>
              ) : null}
              {ch.bullets?.length ? (
                <ul className="story-bullets">
                  {ch.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            {ch.visual === "map" ? (
              <aside className="visual-pane">
                <div className="street-frame">
                  <iframe
                    title={`Street view near ${story.address}`}
                    src={streetViewSrc(story)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
                <p className="visual-caption">Street-level look · Ravenwood block</p>
                <div className="mini-map">
                  <iframe
                    title="Neighborhood map"
                    src={osmEmbedSrc(story)}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </aside>
            ) : null}

            {ch.visual === "condition" ? (
              <aside className="visual-pane">
                <div className="floor-split" aria-hidden>
                  <div className="floor-new">
                    <span>Rebuilt</span>
                    <em>Open concept · new work</em>
                  </div>
                  <div className="floor-old">
                    <span>Original</span>
                    <em>1970s half · residual</em>
                  </div>
                </div>
                <div className="condition-grid">
                  {story.condition.map((item) => {
                    const tone = statusTone(item.status);
                    return (
                      <article key={item.label} className={`condition-card ${tone.className}`}>
                        <header>
                          <h3>{item.label}</h3>
                          <em>{tone.chip}</em>
                        </header>
                        <p>{item.detail}</p>
                      </article>
                    );
                  })}
                </div>
              </aside>
            ) : null}

            {ch.visual === "schools" ? (
              <aside className="visual-pane">
                <div className="school-stack">
                  {story.schools.map((s) => (
                    <div key={s.name} className="school-card">
                      <div className="school-rating" aria-label={`Rated ${s.rating} of 10`}>
                        {s.rating}
                        <span>/10</span>
                      </div>
                      <div>
                        <h3>{s.name}</h3>
                        <p>
                          {s.grades} · {s.miles}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="market-chips">
                  <div>
                    <strong>~10</strong>
                    <span>Days on market</span>
                  </div>
                  <div>
                    <strong>95%</strong>
                    <span>Sale / list</span>
                  </div>
                  <div>
                    <strong>Seller</strong>
                    <span>Market lean</span>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </section>
      ))}

      {/* ── Comps ──────────────────────────────────────────────────────── */}
      <section id="comps" className="story-chapter story-wide" data-chapter>
        <p className="story-eyebrow">Comparables</p>
        <h2>What nearby houses say about price.</h2>
        <p className="story-body narrow">
          Same-street peers sit near $310–320k. Updated Ravenwood sales set the ceiling. The $115k
          fixer is a floor, not a peer.
        </p>

        <div className="comps-layout">
          <div className="comp-map" role="img" aria-label="Approximate neighborhood comps map">
            <div className="comp-map-grid" />
            <div className="comp-pin is-subject" style={{ left: "52%", top: "50%" }}>
              <span>Subject</span>
              <strong>$230k</strong>
            </div>
            {story.comps
              .filter((c) => c.map)
              .map((c) => (
                <div
                  key={c.address}
                  className={`comp-pin is-${c.kind}`}
                  style={{ left: `${c.map!.x}%`, top: `${c.map!.y}%` }}
                  title={c.address}
                >
                  <span>{c.address.split(" ")[0]}</span>
                  <strong>{c.priceLabel.replace(" Zest.", "")}</strong>
                </div>
              ))}
            <p className="comp-map-legend">Schematic neighborhood · pins are approximate</p>
          </div>

          <div className="comp-bars">
            {[{ address: "Offer · this house", price: story.valuation.offer, kind: "offer" as const }, ...story.comps].map(
              (c) => {
                const price = "price" in c && c.price != null ? c.price : story.valuation.offer;
                const width = Math.max(8, Math.round((price / maxComp) * 100));
                return (
                  <div key={c.address} className={`comp-bar-row ${"kind" in c && c.kind === "offer" ? "is-offer" : ""}`}>
                    <div className="comp-bar-meta">
                      <strong>{c.address}</strong>
                      {"note" in c && c.note ? <span>{c.note}</span> : null}
                    </div>
                    <div className="comp-bar-track">
                      <span style={{ width: `${width}%` }} />
                    </div>
                    <div className="comp-bar-price">
                      {"priceLabel" in c ? c.priceLabel : money(price)}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </section>

      {/* ── Range ──────────────────────────────────────────────────────── */}
      <section id="range" className="story-chapter" data-chapter>
        <p className="story-eyebrow">Valuation</p>
        <h2>A wide but honest band.</h2>
        <p className="story-body">{story.valuation.thesis}</p>
        <div className="range-cards">
          {[
            ["Offer", story.valuation.offer, "accent"],
            ["Low", story.valuation.low, ""],
            ["Mid", story.valuation.mid, ""],
            ["High", story.valuation.high, ""],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className={`range-card ${tone}`}>
              <span>{label}</span>
              <strong>{money(Number(value))}</strong>
            </div>
          ))}
        </div>
        <div className="range-bar" role="img" aria-label="Value range versus offer">
          <div className="range-track">
            <span className="range-fill" />
            <span
              className="range-offer"
              style={{
                left: `${Math.min(
                  92,
                  Math.max(
                    6,
                    ((story.valuation.offer - story.valuation.low * 0.82) /
                      (story.valuation.high * 1.05 - story.valuation.low * 0.82)) *
                      100,
                  ),
                )}%`,
              }}
            >
              Offer
            </span>
          </div>
          <div className="range-labels">
            <span>{money(story.valuation.low)}</span>
            <span>{money(story.valuation.mid)}</span>
            <span>{money(story.valuation.high)}</span>
          </div>
        </div>
      </section>

      <section id="notebook" className="story-chapter story-notebook" data-chapter>
        <p className="story-eyebrow">Notebook</p>
        <h2>{story.notebook.title}</h2>
        {story.notebook.paragraphs.map((p) => (
          <p key={p.slice(0, 48)} className="story-body notebook-p">
            {p}
          </p>
        ))}
        <footer className="story-footer">
          <p>Research dated {story.researchDate}. Not an appraisal.</p>
          <p className="story-sources">{story.sources.join(" · ")}</p>
        </footer>
      </section>
    </div>
  );
}

const STORY_CSS = `
  .story-root {
    --story-ink: #081228;
    --story-navy: #0d1d3c;
    --story-red: #c0303b;
    --story-paper: #f3f5f8;
    --story-wash: #e4e8ef;
    --story-muted: #5c6578;
    --story-line: rgba(8, 18, 40, 0.12);
    --story-good: #2f6b4f;
    --font-display: "Playfair Display", Georgia, serif;
    --font-body: "Libre Franklin", system-ui, sans-serif;
    background: var(--story-paper);
    color: var(--story-ink);
    font-family: var(--font-body);
    min-height: 100vh;
  }
  .story-root * { box-sizing: border-box; }
  .story-rail { display: none; }
  @media (min-width: 1180px) {
    .story-rail {
      display: flex; flex-direction: column; gap: 0.55rem;
      position: fixed; top: 2.25rem; left: 1.25rem; width: 8.25rem; z-index: 30;
    }
    .story-rail-brand {
      font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
      color: var(--story-red); margin-bottom: 0.75rem; font-weight: 600;
    }
    .story-rail a {
      color: var(--story-muted); text-decoration: none; font-size: 12px;
      letter-spacing: 0.04em; border-left: 2px solid transparent; padding-left: 0.65rem;
      transition: color 180ms ease, border-color 180ms ease;
    }
    .story-rail a.is-active { color: var(--story-ink); border-left-color: var(--story-red); }
  }

  /* Hero — full-bleed map plane */
  .story-hero {
    position: relative; min-height: 100svh; display: grid;
    grid-template-columns: 1fr; overflow: hidden;
  }
  @media (min-width: 960px) {
    .story-hero { grid-template-columns: 1.05fr 0.95fr; }
  }
  .hero-map {
    position: relative; min-height: 42svh; background: #c9d2e0;
  }
  @media (min-width: 960px) {
    .hero-map { min-height: 100svh; order: 2; }
  }
  .hero-map iframe, .street-frame iframe, .mini-map iframe {
    position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
    filter: grayscale(0.25) contrast(1.05) saturate(0.85);
  }
  .hero-map-veil {
    position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(90deg, rgba(8,18,40,0.18), transparent 40%),
      linear-gradient(0deg, rgba(8,18,40,0.25), transparent 35%);
  }
  .map-swap {
    position: absolute; right: 0.85rem; bottom: 0.85rem; z-index: 2;
    border: 0; background: rgba(247,244,236,0.92); color: var(--story-ink);
    font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
    font-weight: 700; padding: 0.55rem 0.7rem; cursor: pointer;
  }
  .hero-copy {
    position: relative; z-index: 1;
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: clamp(1.75rem, 5vw, 3.5rem);
    background:
      radial-gradient(ellipse 90% 70% at 0% 100%, rgba(192,48,59,0.08), transparent 55%),
      linear-gradient(165deg, #e8edf5 0%, var(--story-paper) 45%, var(--story-wash) 100%);
  }
  .story-brand {
    font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--story-red); font-weight: 700; margin: 0 0 1rem;
  }
  .story-kicker {
    font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--story-muted); margin: 0 0 0.65rem;
  }
  .story-hero h1 {
    font-family: var(--font-display);
    font-size: clamp(2.35rem, 5.5vw, 3.8rem);
    line-height: 0.98; margin: 0 0 0.9rem; letter-spacing: -0.02em;
  }
  .story-lede {
    font-family: var(--font-display);
    font-size: clamp(1.15rem, 2.2vw, 1.45rem);
    line-height: 1.35; margin: 0 0 0.75rem; max-width: 34rem;
  }
  .story-support {
    color: var(--story-muted); font-size: 0.98rem; line-height: 1.55;
    margin: 0 0 1.35rem; max-width: 36rem;
  }
  .hero-offer {
    display: grid; grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 0.75rem; margin: 0 0 1.35rem; padding: 0.9rem 0;
    border-top: 1px solid var(--story-line); border-bottom: 1px solid var(--story-line);
  }
  .hero-offer-label {
    display: block; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--story-muted); margin-bottom: 0.25rem;
  }
  .hero-offer strong {
    font-family: var(--font-display); font-size: clamp(1.15rem, 2vw, 1.45rem);
  }
  .hero-offer strong.muted { color: var(--story-navy); }
  .hero-offer strong.accent { color: var(--story-red); }
  .story-facts {
    display: grid; grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 0.75rem 1rem; margin: 0;
  }
  @media (min-width: 720px) {
    .story-facts { grid-template-columns: repeat(4, minmax(0,1fr)); }
  }
  .story-facts dt {
    font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--story-muted); margin: 0 0 0.15rem;
  }
  .story-facts dd { margin: 0; font-size: 0.92rem; font-weight: 600; }

  .story-chapter {
    padding: clamp(2.75rem, 7vw, 5.5rem) clamp(1.25rem, 5vw, 3.5rem);
    border-top: 1px solid var(--story-line);
    scroll-snap-align: start;
  }
  .story-wide { max-width: 72rem; margin: 0 auto; }
  .chapter-grid {
    max-width: 68rem; margin: 0 auto;
    display: grid; gap: 2rem;
  }
  @media (min-width: 900px) {
    .chapter-grid { grid-template-columns: 1fr 1.05fr; align-items: center; gap: 2.75rem; }
  }
  .chapter-copy { max-width: 34rem; }
  .story-eyebrow {
    font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase;
    color: var(--story-red); font-weight: 700; margin: 0 0 0.75rem;
  }
  .story-chapter h2 {
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 3.6vw, 2.55rem);
    line-height: 1.12; margin: 0 0 1rem; letter-spacing: -0.015em;
  }
  .story-body {
    font-size: 1.05rem; line-height: 1.65; color: #1c2436; margin: 0 0 1.15rem;
  }
  .story-body.narrow { max-width: 40rem; }
  .story-stat {
    display: flex; flex-direction: column; gap: 0.2rem;
    margin: 0.35rem 0 1.25rem; padding: 0.95rem 0;
    border-top: 1px solid var(--story-line); border-bottom: 1px solid var(--story-line);
    width: fit-content; min-width: 11rem;
  }
  .story-stat-value {
    font-family: var(--font-display); font-size: clamp(2.2rem, 4.5vw, 3.1rem);
    line-height: 1; color: var(--story-navy);
  }
  .story-stat-label {
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--story-muted);
  }
  .story-bullets { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.55rem; }
  .story-bullets li {
    padding-left: 0.9rem; border-left: 2px solid var(--story-red);
    color: var(--story-navy); line-height: 1.45; font-size: 0.95rem;
  }

  .visual-pane { display: grid; gap: 0.85rem; }
  .street-frame, .mini-map {
    position: relative; overflow: hidden; background: #cfd6e2;
    border: 1px solid var(--story-line);
  }
  .street-frame { aspect-ratio: 16 / 11; min-height: 220px; }
  .mini-map { aspect-ratio: 16 / 8; min-height: 140px; }
  .visual-caption {
    margin: -0.35rem 0 0; font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--story-muted);
  }

  .floor-split {
    display: grid; grid-template-columns: 1fr 1fr; min-height: 120px;
    border: 1px solid var(--story-line); overflow: hidden;
  }
  .floor-new, .floor-old {
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 1rem; gap: 0.2rem;
  }
  .floor-new {
    background:
      linear-gradient(145deg, rgba(47,107,79,0.18), rgba(47,107,79,0.05)),
      repeating-linear-gradient(-35deg, transparent, transparent 10px, rgba(47,107,79,0.07) 10px, rgba(47,107,79,0.07) 11px);
  }
  .floor-old {
    background:
      linear-gradient(145deg, rgba(8,18,40,0.1), rgba(8,18,40,0.03)),
      repeating-linear-gradient(35deg, transparent, transparent 10px, rgba(8,18,40,0.06) 10px, rgba(8,18,40,0.06) 11px);
  }
  .floor-new span, .floor-old span {
    font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700;
  }
  .floor-new span { color: var(--story-good); }
  .floor-old span { color: var(--story-navy); }
  .floor-new em, .floor-old em { font-style: normal; font-size: 0.9rem; color: var(--story-muted); }

  .condition-grid {
    display: grid; grid-template-columns: 1fr; gap: 0.55rem;
  }
  @media (min-width: 560px) {
    .condition-grid { grid-template-columns: 1fr 1fr; }
  }
  .condition-card {
    border: 1px solid var(--story-line); background: rgba(255,255,255,0.45);
    padding: 0.85rem 0.9rem;
  }
  .condition-card header {
    display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline;
    margin-bottom: 0.35rem;
  }
  .condition-card h3 {
    font-family: var(--font-body); font-size: 0.95rem; margin: 0; font-weight: 700;
  }
  .condition-card em {
    font-style: normal; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    font-weight: 700;
  }
  .condition-card p { margin: 0; font-size: 0.86rem; line-height: 1.45; color: var(--story-muted); }
  .condition-card.is-new em, .condition-card.is-recent em { color: var(--story-good); }
  .condition-card.is-partial em { color: #9a6b1f; }
  .condition-card.is-original em { color: var(--story-muted); }
  .condition-card.is-new { border-color: rgba(47,107,79,0.28); background: rgba(47,107,79,0.06); }
  .condition-card.is-recent { border-color: rgba(47,107,79,0.2); }

  .school-stack { display: grid; gap: 0.65rem; }
  .school-card {
    display: flex; gap: 0.9rem; align-items: center;
    border: 1px solid var(--story-line); padding: 0.85rem 0.95rem;
    background: rgba(255,255,255,0.4);
  }
  .school-rating {
    width: 3.4rem; height: 3.4rem; border-radius: 999px;
    display: grid; place-content: center; text-align: center;
    background: var(--story-navy); color: #f7f4ec;
    font-family: var(--font-display); font-size: 1.35rem; line-height: 1;
    flex-shrink: 0;
  }
  .school-rating span { display: block; font-size: 9px; letter-spacing: 0.08em; opacity: 0.7; font-family: var(--font-body); }
  .school-card h3 { margin: 0 0 0.15rem; font-size: 0.98rem; font-family: var(--font-body); }
  .school-card p { margin: 0; font-size: 0.84rem; color: var(--story-muted); }
  .market-chips {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.55rem; margin-top: 0.25rem;
  }
  .market-chips > div {
    border: 1px solid var(--story-line); padding: 0.75rem 0.55rem; text-align: center;
    background: rgba(255,255,255,0.35);
  }
  .market-chips strong {
    display: block; font-family: var(--font-display); font-size: 1.2rem; margin-bottom: 0.15rem;
  }
  .market-chips span {
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--story-muted);
  }

  .comps-layout {
    display: grid; gap: 1.5rem; margin-top: 1.25rem;
  }
  @media (min-width: 900px) {
    .comps-layout { grid-template-columns: 0.95fr 1.15fr; gap: 2rem; align-items: start; }
  }
  .comp-map {
    position: relative; aspect-ratio: 1 / 1; min-height: 280px;
    border: 1px solid var(--story-line); overflow: hidden;
    background:
      radial-gradient(circle at 52% 50%, rgba(192,48,59,0.12), transparent 28%),
      linear-gradient(180deg, #d7dfeb 0%, #c4cfde 100%);
  }
  .comp-map-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(8,18,40,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(8,18,40,0.06) 1px, transparent 1px);
    background-size: 12.5% 12.5%;
  }
  .comp-pin {
    position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
    white-space: nowrap; pointer-events: none;
  }
  .comp-pin::before {
    content: ""; width: 10px; height: 10px; border-radius: 999px;
    background: var(--story-navy); border: 2px solid #f7f4ec;
    box-shadow: 0 0 0 1px rgba(8,18,40,0.2);
  }
  .comp-pin span {
    font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--story-muted);
  }
  .comp-pin strong {
    font-size: 11px; font-family: var(--font-display); color: var(--story-ink);
    background: rgba(247,244,236,0.92); padding: 0.1rem 0.3rem;
  }
  .comp-pin.is-subject { z-index: 2; }
  .comp-pin.is-subject::before { background: var(--story-red); width: 14px; height: 14px; }
  .comp-pin.is-subject strong { color: var(--story-red); }
  .comp-map-legend {
    position: absolute; left: 0.75rem; bottom: 0.65rem; margin: 0;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--story-muted);
  }
  .comp-bars { display: grid; gap: 0.7rem; }
  .comp-bar-row {
    display: grid; grid-template-columns: 1.2fr 1.4fr auto; gap: 0.65rem; align-items: center;
  }
  @media (max-width: 640px) {
    .comp-bar-row { grid-template-columns: 1fr; gap: 0.25rem; }
  }
  .comp-bar-meta strong { display: block; font-size: 0.88rem; }
  .comp-bar-meta span { font-size: 0.78rem; color: var(--story-muted); }
  .comp-bar-track {
    height: 8px; background: var(--story-wash); overflow: hidden;
  }
  .comp-bar-track span {
    display: block; height: 100%; background: linear-gradient(90deg, #8fa3c2, var(--story-navy));
  }
  .comp-bar-row.is-offer .comp-bar-track span { background: var(--story-red); }
  .comp-bar-price {
    font-family: var(--font-display); font-size: 0.98rem; text-align: right; white-space: nowrap;
  }

  .range-cards {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.65rem;
    max-width: 36rem; margin: 1rem 0 1.5rem;
  }
  @media (min-width: 640px) {
    .range-cards { grid-template-columns: repeat(4, 1fr); }
  }
  .range-card {
    border: 1px solid var(--story-line); padding: 0.9rem 0.75rem;
    background: rgba(255,255,255,0.4);
  }
  .range-card.accent {
    border-color: rgba(192,48,59,0.35); background: rgba(192,48,59,0.06);
  }
  .range-card span {
    display: block; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--story-muted); margin-bottom: 0.25rem;
  }
  .range-card strong { font-family: var(--font-display); font-size: 1.25rem; }
  .range-card.accent strong { color: var(--story-red); }
  .range-bar { max-width: 40rem; }
  .range-track {
    position: relative; height: 10px; background: var(--story-wash); margin: 2.4rem 0 0.75rem;
  }
  .range-fill {
    position: absolute; inset: 0 6% 0 18%;
    background: linear-gradient(90deg, #9db0d0, var(--story-navy));
  }
  .range-offer {
    position: absolute; top: -1.85rem; transform: translateX(-50%);
    font-size: 11px; font-weight: 700; color: var(--story-red); letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .range-offer::after {
    content: ""; position: absolute; left: 50%; top: 100%; width: 2px; height: 1.4rem;
    background: var(--story-red); transform: translateX(-50%);
  }
  .range-labels {
    display: flex; justify-content: space-between;
    font-size: 0.88rem; font-weight: 600; color: var(--story-navy);
  }

  .story-notebook { max-width: 44rem; margin: 0 auto; }
  .notebook-p + .notebook-p { margin-top: 1rem; }
  .story-footer {
    margin-top: 2.25rem; padding-top: 1.1rem; border-top: 1px solid var(--story-line);
    color: var(--story-muted); font-size: 0.84rem; line-height: 1.5;
  }
  .story-sources { margin-top: 0.45rem; font-size: 0.76rem; }

  .reveal { animation: story-in 720ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  .delay-1 { animation-delay: 70ms; }
  .delay-2 { animation-delay: 140ms; }
  .delay-3 { animation-delay: 210ms; }
  .delay-4 { animation-delay: 280ms; }
  .delay-5 { animation-delay: 350ms; }
  @keyframes story-in {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal { animation: none; }
  }
`;
