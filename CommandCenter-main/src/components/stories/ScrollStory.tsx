import { useEffect, useRef, useState } from "react";
import type { ClientStory } from "@/lib/stories/types";

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  story: ClientStory;
  /** When true, hide staff-only chrome (always true on public /story/:token). */
  clientMode?: boolean;
  label?: string | null;
};

/**
 * Full-bleed chapter scroll for client presentations.
 * Capitol brand on paper — navy ink, red accent, Playfair display.
 */
export default function ScrollStory({ story, clientMode = true, label }: Props) {
  const [active, setActive] = useState("hero");
  const rootRef = useRef<HTMLDivElement>(null);

  const toc = [
    { id: "hero", label: "Open" },
    ...story.chapters.map((c) => ({ id: c.id, label: c.eyebrow })),
    { id: "comps", label: "Comps" },
    { id: "range", label: "Range" },
    { id: "notebook", label: "Notebook" },
  ];

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
      { root: null, threshold: [0.35, 0.55], rootMargin: "-10% 0px -35% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [story.slug]);

  useEffect(() => {
    document.title = label
      ? `${story.metaTitle} · ${label}`
      : story.metaTitle;
  }, [story.metaTitle, label]);

  return (
    <div ref={rootRef} className="story-root">
      <style>{STORY_CSS}</style>

      {!clientMode ? null : (
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
      )}

      <header className="story-hero" id="hero" data-chapter>
        <div className="story-hero-wash" aria-hidden />
        <p className="story-brand reveal">{story.brand}</p>
        <p className="story-kicker reveal delay-1">{story.cityLine}</p>
        <h1 className="reveal delay-2">{story.address}</h1>
        <p className="story-lede reveal delay-3">{story.heroLine}</p>
        <p className="story-support reveal delay-4">{story.support}</p>
        <dl className="story-facts reveal delay-5">
          {story.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {story.chapters.map((ch) => (
        <section key={ch.id} id={ch.id} className="story-chapter" data-chapter>
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
        </section>
      ))}

      <section id="comps" className="story-chapter story-comps" data-chapter>
        <p className="story-eyebrow">Comparables</p>
        <h2>What nearby houses say about price.</h2>
        <p className="story-body">
          Estimates on the same block set the mid-$300k neighborhood. Larger updated sales set the
          ceiling. The $115k fixer is noise for a livable ranch.
        </p>
        <div className="comp-list">
          {story.comps.map((c) => (
            <article key={c.address} className="comp-row">
              <div>
                <h3>{c.address}</h3>
                <p>
                  {c.beds} bd · {c.baths} ba · {c.sqft.toLocaleString()} sq ft
                  {c.date ? ` · ${c.date}` : ""}
                </p>
                <p className="comp-note">{c.note}</p>
              </div>
              <div className="comp-price">
                <span>{c.priceLabel}</span>
                <em>{c.kind}</em>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="range" className="story-chapter story-range" data-chapter>
        <p className="story-eyebrow">Valuation</p>
        <h2>A wide but honest band.</h2>
        <p className="story-body">{story.valuation.thesis}</p>
        <div className="range-bar" role="img" aria-label="Value range versus offer">
          <div className="range-track">
            <span className="range-fill" />
            <span
              className="range-offer"
              style={{
                left: `${Math.min(
                  96,
                  Math.max(
                    4,
                    ((story.valuation.offer - story.valuation.low * 0.85) /
                      (story.valuation.high * 1.05 - story.valuation.low * 0.85)) *
                      100,
                  ),
                )}%`,
              }}
            >
              Offer {money(story.valuation.offer)}
            </span>
          </div>
          <div className="range-labels">
            <span>{money(story.valuation.low)}</span>
            <span>Mid {money(story.valuation.mid)}</span>
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
    --story-paper: #f7f4ec;
    --story-wash: #ebe6da;
    --story-muted: #5c6578;
    --story-line: rgba(8, 18, 40, 0.12);
    --font-display: "Playfair Display", Georgia, serif;
    --font-body: "Libre Franklin", system-ui, sans-serif;
    background: var(--story-paper);
    color: var(--story-ink);
    font-family: var(--font-body);
    min-height: 100vh;
  }
  .story-root * { box-sizing: border-box; }
  .story-rail {
    display: none;
  }
  @media (min-width: 1100px) {
    .story-rail {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      position: fixed;
      top: 2.5rem;
      left: 1.5rem;
      width: 8.5rem;
      z-index: 20;
    }
    .story-rail-brand {
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--story-red);
      margin-bottom: 0.75rem;
      font-weight: 600;
    }
    .story-rail a {
      color: var(--story-muted);
      text-decoration: none;
      font-size: 12px;
      letter-spacing: 0.04em;
      border-left: 2px solid transparent;
      padding-left: 0.65rem;
      transition: color 180ms ease, border-color 180ms ease;
    }
    .story-rail a.is-active {
      color: var(--story-ink);
      border-left-color: var(--story-red);
    }
  }
  .story-hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: clamp(2rem, 6vw, 4.5rem);
    padding-bottom: clamp(2.5rem, 8vw, 5rem);
    overflow: hidden;
    scroll-snap-align: start;
  }
  .story-hero-wash {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 80% 10%, rgba(192, 48, 59, 0.12), transparent 55%),
      linear-gradient(165deg, #dfe6f2 0%, var(--story-paper) 48%, var(--story-wash) 100%);
    z-index: 0;
  }
  .story-hero > *:not(.story-hero-wash) { position: relative; z-index: 1; max-width: 42rem; }
  .story-brand {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--story-red);
    font-weight: 700;
    margin: 0 0 1.25rem;
  }
  .story-kicker {
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--story-muted);
    margin: 0 0 0.75rem;
  }
  .story-hero h1 {
    font-family: var(--font-display);
    font-size: clamp(2.6rem, 7vw, 4.4rem);
    line-height: 0.98;
    margin: 0 0 1.1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .story-lede {
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 2.6vw, 1.65rem);
    line-height: 1.35;
    margin: 0 0 0.85rem;
    max-width: 34rem;
  }
  .story-support {
    color: var(--story-muted);
    font-size: 1.02rem;
    line-height: 1.55;
    margin: 0 0 2rem;
    max-width: 34rem;
  }
  .story-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem 1.25rem;
    margin: 0;
    padding-top: 1.25rem;
    border-top: 1px solid var(--story-line);
    max-width: 36rem;
  }
  @media (min-width: 720px) {
    .story-facts { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  .story-facts dt {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--story-muted);
    margin: 0 0 0.2rem;
  }
  .story-facts dd {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .story-chapter {
    min-height: 88svh;
    padding: clamp(3rem, 8vw, 6rem) clamp(1.5rem, 6vw, 4.5rem);
    max-width: 48rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    scroll-snap-align: start;
    border-top: 1px solid var(--story-line);
  }
  .story-eyebrow {
    font-size: 11px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--story-red);
    font-weight: 700;
    margin: 0 0 0.85rem;
  }
  .story-chapter h2 {
    font-family: var(--font-display);
    font-size: clamp(1.85rem, 4vw, 2.75rem);
    line-height: 1.12;
    margin: 0 0 1.15rem;
    letter-spacing: -0.015em;
  }
  .story-body {
    font-size: 1.08rem;
    line-height: 1.65;
    color: #1c2436;
    margin: 0 0 1.25rem;
  }
  .story-stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0 1.5rem;
    padding: 1.1rem 0;
    border-top: 1px solid var(--story-line);
    border-bottom: 1px solid var(--story-line);
    width: fit-content;
    min-width: 12rem;
  }
  .story-stat-value {
    font-family: var(--font-display);
    font-size: clamp(2.4rem, 5vw, 3.4rem);
    line-height: 1;
    color: var(--story-navy);
  }
  .story-stat-label {
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--story-muted);
  }
  .story-bullets {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.65rem;
  }
  .story-bullets li {
    padding-left: 1rem;
    border-left: 2px solid var(--story-red);
    color: var(--story-navy);
    line-height: 1.45;
    font-size: 0.98rem;
  }
  .comp-list { display: grid; gap: 0; margin-top: 0.5rem; }
  .comp-row {
    display: flex;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 1.1rem 0;
    border-top: 1px solid var(--story-line);
  }
  .comp-row h3 {
    font-family: var(--font-body);
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }
  .comp-row p { margin: 0; font-size: 0.88rem; color: var(--story-muted); }
  .comp-note { margin-top: 0.35rem !important; color: var(--story-ink) !important; }
  .comp-price {
    text-align: right;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .comp-price span {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
  }
  .comp-price em {
    font-style: normal;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--story-muted);
  }
  .range-bar { margin-top: 1.5rem; }
  .range-track {
    position: relative;
    height: 10px;
    border-radius: 999px;
    background: var(--story-wash);
    margin: 2.75rem 0 0.85rem;
  }
  .range-fill {
    position: absolute;
    inset: 0 8% 0 12%;
    border-radius: inherit;
    background: linear-gradient(90deg, #9db0d0, var(--story-navy));
  }
  .range-offer {
    position: absolute;
    top: -2.1rem;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 12px;
    font-weight: 700;
    color: var(--story-red);
    letter-spacing: 0.04em;
  }
  .range-offer::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 100%;
    width: 2px;
    height: 1.55rem;
    background: var(--story-red);
    transform: translateX(-50%);
  }
  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--story-navy);
  }
  .notebook-p + .notebook-p { margin-top: 1rem; }
  .story-footer {
    margin-top: 2.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--story-line);
    color: var(--story-muted);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .story-sources { margin-top: 0.5rem; font-size: 0.78rem; }
  .reveal {
    animation: story-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .delay-1 { animation-delay: 80ms; }
  .delay-2 { animation-delay: 160ms; }
  .delay-3 { animation-delay: 240ms; }
  .delay-4 { animation-delay: 320ms; }
  .delay-5 { animation-delay: 400ms; }
  @keyframes story-in {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal { animation: none; }
  }
`;
