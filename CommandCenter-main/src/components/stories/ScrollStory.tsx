import { useEffect, useMemo, useRef, useState } from "react";
import TurnerLogo from "@/components/stories/TurnerLogo";
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
    case "concern":
      return { chip: "Concern", className: "is-concern" };
    default:
      return { chip: "Older", className: "is-original" };
  }
}

function mapsEmbedSrc(story: ClientStory) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(story.geo.label)}&z=15&output=embed`;
}

function osmEmbedSrc(story: ClientStory) {
  const { lat, lng } = story.geo;
  const d = 0.012;
  const bbox = `${lng - d}%2C${lat - d * 0.7}%2C${lng + d}%2C${lat + d * 0.7}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function streetViewSrc(story: ClientStory) {
  const { lat, lng } = story.geo;
  return `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,0,0,0,0&output=svembed`;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function ScrollStory({ story, clientMode = true, label }: Props) {
  const [active, setActive] = useState("open");
  const [mapProvider, setMapProvider] = useState<"google" | "osm">("google");
  const rootRef = useRef<HTMLDivElement>(null);

  const isProceeds = story.layout === "proceeds";

  const toc = useMemo(
    () => [
      { id: "open", label: "Open" },
      { id: "brief", label: "Brief" },
      ...story.chapters.map((c) => ({ id: c.id, label: c.eyebrow })),
      ...(isProceeds
        ? []
        : [
            { id: "comps", label: "Comps" },
            { id: "range", label: "Range" },
          ]),
      { id: "notebook", label: isProceeds ? "Notes" : "Math" },
    ],
    [story.chapters, isProceeds],
  );

  const maxComp = Math.max(
    1,
    ...story.comps.map((c) => c.price ?? 0),
    story.valuation.offer || 0,
  );
  const gap = story.valuation.mid - story.valuation.offer;

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

      {/* Almanac-style title / scroll cover */}
      <section className="title-cover" id="open" data-chapter>
        <div className="title-blobs" aria-hidden>
          <span className="blob blob-a" />
          <span className="blob blob-b" />
          <span className="blob blob-c" />
        </div>

        <div className="title-inner">
          <TurnerLogo
            stacked
            className="title-logo reveal"
            brand={story.brand}
            markSrc={story.markSrc}
          />

          <p className="title-kicker reveal delay-1">{story.cityLine}</p>
          <h1 className="title-display reveal delay-2">{story.cover.display}</h1>
          <p className="title-sub reveal delay-2">{story.cover.sub}</p>
          <p className="title-meta reveal delay-3">{story.cover.meta}</p>

          <div className="title-stat reveal delay-4">
            <strong>{story.cover.statValue}</strong>
            <span>{story.cover.statLabel}</span>
          </div>

          <p className="title-compare reveal delay-4">
            <em className="is-warn">{story.cover.compareWarn}</em>
            <span aria-hidden> · </span>
            <em className="is-good">{story.cover.compareGood}</em>
          </p>

          <p className="title-tagline reveal delay-5">{story.heroLine}</p>

          <button
            type="button"
            className="scroll-cue reveal delay-5"
            onClick={() => scrollToId("brief")}
          >
            <span>Scroll</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </section>

      {clientMode ? (
        <nav className="story-dock" aria-label="Chapters">
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={active === t.id ? "is-active" : undefined}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(t.id);
              }}
            >
              {t.label}
            </a>
          ))}
        </nav>
      ) : null}

      <header className={`story-hero ${isProceeds ? "is-proceeds" : ""}`} id="brief" data-chapter>
        {isProceeds ? (
          <div className="hero-proceeds-panel" aria-hidden>
            <div className="proceeds-hero big">
              <strong>2</strong>
              <span>of</span>
              <em>3</em>
              <p>Shared approval before sale proceeds move</p>
            </div>
          </div>
        ) : (
          <div className="hero-map">
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
        )}
        <div className="hero-copy">
          <TurnerLogo className="hero-brand reveal" brand={story.brand} markSrc={story.markSrc} />
          <p className="story-kicker reveal delay-1">{story.cityLine}</p>
          <h1 className="reveal delay-1">{story.address}</h1>
          <p className="story-lede reveal delay-2">{story.heroLine}</p>
          <p className="story-support reveal delay-3">{story.support}</p>

          <div className="verdict reveal delay-4">
            <span className="verdict-flag">Recommendation</span>
            <strong>{story.valuation.recommendation}</strong>
          </div>

          {isProceeds ? (
            <div className="hero-offer reveal delay-5">
              <div className="is-warn">
                <span className="hero-offer-label">People</span>
                <strong>3</strong>
              </div>
              <div>
                <span className="hero-offer-label">Approvals</span>
                <strong>2</strong>
              </div>
              <div>
                <span className="hero-offer-label">Vehicle</span>
                <strong className="accent">Trust</strong>
              </div>
            </div>
          ) : (
            <div className="hero-offer reveal delay-5">
              <div className="is-warn">
                <span className="hero-offer-label">As-is offer</span>
                <strong>{money(story.valuation.offer)}</strong>
              </div>
              <div>
                <span className="hero-offer-label">Clean mid</span>
                <strong>{money(story.valuation.mid)}</strong>
              </div>
              <div>
                <span className="hero-offer-label">Vs clean</span>
                <strong className="accent">−{money(gap)}</strong>
              </div>
            </div>
          )}

          <dl className="story-facts reveal delay-5">
            {story.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>

          {story.keyNumbers?.length ? (
            <div className="key-numbers reveal delay-5">
              {story.keyNumbers.map((n) => (
                <div key={n.label} className={`key-number is-${n.tone ?? "neutral"}`}>
                  <span>{n.label}</span>
                  <strong>{n.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {story.callouts?.length ? (
            <div className="story-callouts reveal delay-5">
              {story.callouts.map((c) => (
                <aside key={c.title} className="story-callout">
                  <strong>{c.title}</strong>
                  <p>{c.body}</p>
                </aside>
              ))}
            </div>
          ) : null}
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
                <div
                  className={`story-stat ${
                    ch.id === "numbers" ||
                    ch.id === "tempo" ||
                    ch.id === "risk" ||
                    ch.id === "look" ||
                    ch.id === "appraisal" ||
                    ch.id === "repairs" ||
                    ch.id === "offer" ||
                    ch.id === "odds" ||
                    ch.id === "proceeds" ||
                    ch.id === "rule" ||
                    ch.id === "medicaid" ||
                    ch.id === "bank" ||
                    ch.id === "call"
                      ? "is-warn"
                      : ""
                  }`}
                >
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
                <p className="visual-caption">Street view · Ravenwood</p>
                <div className="mini-map">
                  <iframe title="Neighborhood map" src={osmEmbedSrc(story)} loading="lazy" />
                </div>
              </aside>
            ) : null}

            {ch.visual === "condition" ? (
              <aside className="visual-pane">
                <div className="floor-split" aria-hidden>
                  <div className="floor-new">
                    <span>Already done</span>
                    <em>Roof · half remodel · HVAC</em>
                  </div>
                  <div className="floor-old is-risk">
                    <span>Still open</span>
                    <em>Crawl · moisture · age systems</em>
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
                      <div className="school-rating">
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
                <div className="highlight-band">
                  <p>
                    Clean comps sit near <strong>{money(story.valuation.mid)}</strong>. Heavy leftover
                    inspection risk can pull an as-is sale toward{" "}
                    <strong>{money(story.valuation.offer)}</strong>–$280k.
                  </p>
                </div>
              </aside>
            ) : null}

            {ch.visual === "repairs" ? (
              <aside className="visual-pane">
                <div className="repair-list">
                  {story.repairs.map((r) => (
                    <article key={r.issue} className="repair-card">
                      <header>
                        <h3>{r.issue}</h3>
                        <strong>
                          {money(r.low)}–{money(r.high)}
                        </strong>
                      </header>
                      <p>{r.note}</p>
                    </article>
                  ))}
                </div>
                <div className="highlight-band">
                  <p>
                    List at {money(story.valuation.mid)} with ~6% fees keeps about{" "}
                    <strong>{money(Math.round(story.valuation.mid * 0.94))}</strong> before repairs.
                    About <strong>$61k</strong> of fix-up is the rough line where $230k ties that path.
                  </p>
                </div>
              </aside>
            ) : null}

            {ch.visual === "compare" ? (
              <aside className="visual-pane">
                <div className="compare-grid">
                  {(story.compareCards ?? []).map((card) => (
                    <article key={card.title} className="compare-card">
                      <h3>{card.title}</h3>
                      <p className="compare-cost">{card.cost}</p>
                      <p>
                        <span>Answers</span>
                        {card.answers}
                      </p>
                      <p>
                        <span>Does not</span>
                        {card.doesNot}
                      </p>
                    </article>
                  ))}
                </div>
              </aside>
            ) : null}

            {ch.visual === "odds" ? (
              <aside className="visual-pane">
                <div className="odds-list">
                  {(story.repairOdds ?? []).map((row) => (
                    <article key={row.amount} className="odds-row">
                      <div className="odds-meta">
                        <strong>≥ {money(row.amount)}</strong>
                        <span>{row.note}</span>
                      </div>
                      <div className="odds-track" aria-hidden>
                        <span style={{ width: `${row.pct}%` }} />
                      </div>
                      <div className="odds-pct">{row.pct}%</div>
                    </article>
                  ))}
                </div>
                <p className="visual-caption">Judgment odds · not a contractor bid</p>
              </aside>
            ) : null}

            {ch.visual === "nets" ? (
              <aside className="visual-pane">
                <div className="net-list">
                  {story.netScenarios.map((n) => (
                    <article key={n.label} className={`net-card ${n.highlight ? "is-offer" : ""}`}>
                      <header>
                        <h3>{n.label}</h3>
                        {n.highlight ? <em>{isProceeds ? "Preferred" : "On the table"}</em> : null}
                      </header>
                      {isProceeds ? (
                        <div className="net-row is-total">
                          <span>Path</span>
                          <strong>{n.note.split(".")[0]}</strong>
                        </div>
                      ) : (
                        <>
                          <div className="net-row">
                            <span>Sale price</span>
                            <strong>{money(n.salePrice)}</strong>
                          </div>
                          <div className="net-row">
                            <span>
                              Realtor fees
                              {n.realtorFeePct > 0
                                ? ` (~${(n.realtorFeePct * 100).toFixed(1)}%)`
                                : ""}
                            </span>
                            <strong>{n.realtorFee ? `−${money(n.realtorFee)}` : "$0"}</strong>
                          </div>
                          <div className="net-row is-total">
                            <span>You keep (before other closing costs)</span>
                            <strong>{money(n.estimatedNet)}</strong>
                          </div>
                        </>
                      )}
                      <p>{n.note}</p>
                    </article>
                  ))}
                </div>
              </aside>
            ) : null}

            {ch.visual === "proceeds" ? (
              <aside className="visual-pane">
                <div className="proceeds-hero" aria-hidden>
                  <strong>2</strong>
                  <span>of</span>
                  <em>3</em>
                  <p>People named · two must agree before money moves</p>
                </div>
                <div className="proceeds-list">
                  {(story.proceedsOptions ?? []).map((opt) => (
                    <article key={opt.title} className="proceeds-card">
                      <header>
                        <h3>{opt.title}</h3>
                        <em>{opt.summary}</em>
                      </header>
                      <p>{opt.detail}</p>
                    </article>
                  ))}
                </div>
              </aside>
            ) : null}
          </div>
        </section>
      ))}

      {!isProceeds ? (
        <>
      <section id="comps" className="story-chapter story-wide" data-chapter>
        <p className="story-eyebrow">Nearby homes</p>
        <h2>What similar houses suggest.</h2>
        <p className="story-body narrow">
          Same-street homes look like the low-to-mid $300,000s when they inspect clean. Leftover risk
          from age and the tree-damage chapter is what can knock this into as-is pricing.
        </p>

        <div className="comps-layout">
          <div className="comp-map" role="img" aria-label="Approximate neighborhood comps map">
            <div className="comp-map-grid" />
            <div className="comp-pin is-subject" style={{ left: "52%", top: "50%" }}>
              <span>This home</span>
              <strong>Offer {money(story.valuation.offer)}</strong>
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
                  <strong>{c.priceLabel.replace(" est.", "")}</strong>
                </div>
              ))}
            <p className="comp-map-legend">Sketch map · pins are approximate</p>
          </div>

          <div className="comp-bars">
            {[
              { address: "Offer · this house", price: story.valuation.offer, kind: "offer" as const },
              ...story.comps,
            ].map((c) => {
              const price = "price" in c && c.price != null ? c.price : story.valuation.offer;
              const width = Math.max(8, Math.round((price / maxComp) * 100));
              return (
                <div
                  key={c.address}
                  className={`comp-bar-row ${"kind" in c && c.kind === "offer" ? "is-offer" : ""}`}
                >
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
            })}
          </div>
        </div>
      </section>

      <section id="range" className="story-chapter" data-chapter>
        <p className="story-eyebrow">Value range</p>
        <h2>Where a fair deal should land.</h2>
        <p className="story-body">{story.valuation.thesis}</p>

        <div className="callout-strip">
          <div>
            <span>As-is offer</span>
            <strong>{money(story.valuation.offer)}</strong>
          </div>
          <p>{story.valuation.recommendation}</p>
        </div>

        <div className="range-cards">
          {[
            ["Offer", story.valuation.offer, "warn"],
            ["Risk low", story.valuation.low, ""],
            ["Clean mid", story.valuation.mid, "good"],
            ["Clean high", story.valuation.high, ""],
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
        </>
      ) : null}

      <section id="notebook" className="story-chapter story-notebook" data-chapter>
        <p className="story-eyebrow">{isProceeds ? "Notes" : "The math"}</p>
        <h2>{story.notebook.title}</h2>
        {story.notebook.paragraphs.map((p) => (
          <p key={p.slice(0, 48)} className="story-body notebook-p">
            {p}
          </p>
        ))}
        <footer className="story-footer">
          <div className="footer-brand">
            <TurnerLogo compact brand={story.brand} markSrc={story.markSrc} />
            <div>
              <strong>{story.brand}</strong>
              <span>{story.brandTag}</span>
            </div>
          </div>
          <p>
            Research dated {story.researchDate}. This is not an appraisal, legal advice, or tax advice.
            Trust and account setups should be confirmed with an attorney and the bank.
          </p>
          <p className="story-sources">{story.sources.join(" · ")}</p>
        </footer>
      </section>
    </div>
  );
}

const STORY_CSS = `
  .story-root {
    --ink: #0b1f3a;
    --navy: #143356;
    --copper: #c45c26;
    --copper-deep: #a3481c;
    --paper: #f3f5f8;
    --wash: #e7edf4;
    --muted: #5e6b7c;
    --line: rgba(11, 31, 58, 0.12);
    --good: #2f6b4f;
    --warn: #b42318;
    --font-display: "Playfair Display", Georgia, serif;
    --font-body: "Libre Franklin", system-ui, sans-serif;
    --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-body);
    min-height: 100vh;
    padding-bottom: 4.5rem;
  }
  .story-root * { box-sizing: border-box; }

  /* Logo — stylized mark already includes ring; no extra border */
  .turner-logo {
    display: inline-flex; align-items: center; gap: 0.8rem;
  }
  .turner-logo.is-stacked {
    flex-direction: column; text-align: center; gap: 0.9rem;
  }
  .turner-logo.is-compact { display: inline-flex; }
  .turner-mark {
    width: 56px; height: 56px; object-fit: contain;
    flex-shrink: 0;
    filter: drop-shadow(0 8px 18px rgba(11,31,58,0.16));
  }
  .turner-logo.is-compact .turner-mark { width: 38px; height: 38px; filter: none; }
  .turner-logo.is-stacked .turner-mark { width: 96px; height: 96px; }
  .turner-text { display: flex; flex-direction: column; gap: 0.14rem; line-height: 1.05; }
  .turner-text strong {
    font-family: var(--font-display); font-size: 1.25rem; letter-spacing: -0.01em;
  }
  .turner-text span {
    font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--muted); font-weight: 700;
  }
  .turner-logo.is-stacked .turner-text strong { font-size: 1.45rem; }
  .hero-brand { margin-bottom: 1rem; }

  /* Title cover */
  .title-cover {
    position: relative; min-height: 100svh;
    display: grid; place-items: center;
    overflow: hidden; text-align: center;
    padding: 2.5rem 1.25rem 5.5rem;
  }
  .title-blobs { position: absolute; inset: 0; pointer-events: none; }
  .blob {
    position: absolute; border-radius: 999px; filter: blur(48px); opacity: 0.55;
  }
  .blob-a {
    width: 280px; height: 280px; left: -60px; top: 12%;
    background: rgba(180, 35, 24, 0.18);
  }
  .blob-b {
    width: 320px; height: 320px; right: -80px; top: 28%;
    background: rgba(20, 51, 86, 0.16);
  }
  .blob-c {
    width: 220px; height: 220px; left: 30%; bottom: 8%;
    background: rgba(196, 92, 38, 0.12);
  }
  .title-inner {
    position: relative; z-index: 1;
    max-width: 34rem; width: 100%;
    display: flex; flex-direction: column; align-items: center;
  }
  .title-logo { margin-bottom: 2rem; }
  .title-kicker {
    margin: 0 0 0.65rem;
    font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); font-weight: 600;
  }
  .title-display {
    margin: 0;
    font-family: var(--font-body);
    font-size: clamp(3rem, 12vw, 4.6rem);
    font-weight: 800; letter-spacing: -0.04em; line-height: 0.95;
    color: var(--ink);
  }
  .title-sub {
    margin: 0.45rem 0 0.85rem;
    font-family: var(--font-display);
    font-size: clamp(1.55rem, 4.5vw, 2.1rem);
    color: #8b3d28; font-weight: 600;
  }
  .title-meta {
    margin: 0 0 1.6rem;
    font-family: var(--font-mono);
    font-size: 11px; letter-spacing: 0.04em;
    color: #8b3d28;
  }
  .title-stat {
    display: flex; align-items: baseline; gap: 0.55rem;
    margin-bottom: 0.55rem;
  }
  .title-stat strong {
    font-family: var(--font-body);
    font-size: clamp(2.8rem, 10vw, 3.8rem);
    font-weight: 800; color: var(--warn); letter-spacing: -0.03em; line-height: 1;
  }
  .title-stat span {
    font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--muted); font-weight: 600;
  }
  .title-compare {
    margin: 0 0 1.1rem; font-size: 0.95rem; color: var(--muted);
  }
  .title-compare em { font-style: normal; font-weight: 700; }
  .title-compare .is-warn { color: var(--warn); }
  .title-compare .is-good { color: var(--navy); }
  .title-tagline {
    margin: 0 0 2.25rem; max-width: 26rem;
    font-family: var(--font-display);
    font-size: 1.05rem; line-height: 1.45; color: #394556;
  }
  .scroll-cue {
    display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
    background: none; border: 0; cursor: pointer; color: #9aa3b2;
    animation: cue-bob 2.2s ease-in-out infinite;
  }
  .scroll-cue span {
    font-size: 11px; letter-spacing: 0.42em; text-transform: uppercase; font-weight: 600;
    padding-left: 0.42em;
  }
  @keyframes cue-bob {
    0%, 100% { transform: translateY(0); opacity: 0.7; }
    50% { transform: translateY(6px); opacity: 1; }
  }

  /* Bottom dock (Almanac-style) */
  .story-dock {
    position: fixed; left: 50%; bottom: 0.85rem; transform: translateX(-50%);
    z-index: 50; display: flex; gap: 0.15rem; flex-wrap: nowrap;
    max-width: calc(100vw - 1.25rem); overflow-x: auto;
    padding: 0.35rem; border-radius: 999px;
    background: rgba(255,255,255,0.88);
    border: 1px solid rgba(11,31,58,0.08);
    box-shadow: 0 10px 30px rgba(11,31,58,0.12);
    backdrop-filter: blur(10px);
    -webkit-overflow-scrolling: touch;
  }
  .story-dock a {
    flex: 0 0 auto;
    text-decoration: none; color: var(--muted);
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    font-weight: 700; padding: 0.55rem 0.7rem; border-radius: 999px;
    white-space: nowrap;
  }
  .story-dock a.is-active {
    background: rgba(20, 51, 86, 0.1); color: var(--ink);
  }

  .story-hero {
    position: relative; min-height: 100svh; display: grid;
    grid-template-columns: 1fr; overflow: hidden;
  }
  @media (min-width: 960px) {
    .story-hero { grid-template-columns: 1.05fr 0.95fr; }
    .hero-map { order: 2; min-height: 100svh; }
  }
  .hero-map { position: relative; min-height: 40svh; background: #c9d2e0; }
  .hero-proceeds-panel {
    position: relative; min-height: 40svh;
    display: grid; place-items: center;
    padding: 2rem;
    background:
      linear-gradient(160deg, #0b1f3a 0%, #143356 48%, #1a4060 100%);
  }
  .proceeds-hero.big {
    width: min(100%, 28rem);
    border-color: rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: #f5f7fa;
  }
  .proceeds-hero.big strong, .proceeds-hero.big em { color: #f5f7fa; }
  .proceeds-hero.big em { color: #e8a87c; }
  .proceeds-hero.big span, .proceeds-hero.big p { color: rgba(245,247,250,0.72); }
  @media (min-width: 960px) {
    .story-hero.is-proceeds .hero-proceeds-panel { order: 2; min-height: 100svh; }
  }
  .hero-map iframe, .street-frame iframe, .mini-map iframe {
    position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
    filter: grayscale(0.2) contrast(1.05) saturate(0.9);
  }
  .hero-map-veil {
    position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(90deg, rgba(11,31,58,0.2), transparent 42%),
      linear-gradient(0deg, rgba(11,31,58,0.22), transparent 40%);
  }
  .map-swap {
    position: absolute; right: 0.8rem; bottom: 0.8rem; z-index: 2;
    border: 0; background: rgba(245,247,250,0.94); color: var(--ink);
    font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
    font-weight: 700; padding: 0.55rem 0.7rem; cursor: pointer;
  }
  .hero-copy {
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: clamp(1.5rem, 4.5vw, 3.25rem);
    background:
      linear-gradient(165deg, #e8eef6 0%, var(--paper) 48%, #eef1f5 100%);
  }
  .story-kicker {
    font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 0.55rem; font-weight: 600;
  }
  .story-hero h1 {
    font-family: var(--font-display);
    font-size: clamp(2.3rem, 5.2vw, 3.6rem);
    line-height: 0.98; margin: 0 0 0.85rem; letter-spacing: -0.02em;
  }
  .story-lede {
    font-family: var(--font-display);
    font-size: clamp(1.2rem, 2.3vw, 1.55rem);
    line-height: 1.3; margin: 0 0 0.75rem; max-width: 34rem;
  }
  .story-support {
    color: var(--muted); font-size: 0.98rem; line-height: 1.55;
    margin: 0 0 1.2rem; max-width: 36rem;
  }
  .verdict {
    border-left: 4px solid var(--copper);
    background: rgba(196,92,38,0.08);
    padding: 0.85rem 1rem; margin: 0 0 1.2rem; max-width: 38rem;
  }
  .verdict-flag {
    display: block; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--copper-deep); font-weight: 700; margin-bottom: 0.3rem;
  }
  .verdict strong {
    font-family: var(--font-body); font-size: 0.98rem; font-weight: 600; line-height: 1.45;
  }
  .hero-offer {
    display: grid; grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 0.65rem; margin: 0 0 1.25rem; padding: 0.85rem 0;
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
  }
  .hero-offer-label {
    display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 0.2rem;
  }
  .hero-offer strong {
    font-family: var(--font-display); font-size: clamp(1.1rem, 2vw, 1.4rem);
  }
  .hero-offer .is-warn strong, .hero-offer strong.accent { color: var(--warn); }
  .story-facts {
    display: grid; grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 0.7rem 1rem; margin: 0;
  }
  @media (min-width: 720px) {
    .story-facts { grid-template-columns: repeat(4, minmax(0,1fr)); }
  }
  .story-facts dt {
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 0.12rem;
  }
  .story-facts dd { margin: 0; font-size: 0.92rem; font-weight: 600; }

  .key-numbers {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem; margin: 1.1rem 0 0.85rem;
  }
  @media (min-width: 720px) {
    .key-numbers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  .key-number {
    border: 1px solid var(--line); background: rgba(255,255,255,0.65);
    padding: 0.7rem 0.75rem;
  }
  .key-number span {
    display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 0.2rem; font-weight: 700;
  }
  .key-number strong {
    font-family: var(--font-display); font-size: 1.15rem; color: var(--navy);
  }
  .key-number.is-warn {
    border-color: rgba(180,35,24,0.35); background: rgba(180,35,24,0.07);
  }
  .key-number.is-warn strong { color: var(--warn); }
  .key-number.is-good {
    border-color: rgba(47,107,79,0.35); background: rgba(47,107,79,0.08);
  }
  .key-number.is-good strong { color: var(--good); }

  .story-callouts { display: grid; gap: 0.55rem; margin-top: 0.35rem; }
  .story-callout {
    border-left: 4px solid var(--warn);
    background: rgba(180,35,24,0.07);
    padding: 0.85rem 0.95rem;
  }
  .story-callout strong {
    display: block; font-size: 0.92rem; margin-bottom: 0.3rem; color: var(--warn);
  }
  .story-callout p {
    margin: 0; font-size: 0.9rem; line-height: 1.45; color: var(--navy);
  }

  .compare-grid { display: grid; gap: 0.65rem; }
  .compare-card {
    border: 1px solid var(--line); background: rgba(255,255,255,0.55);
    padding: 0.9rem 1rem;
  }
  .compare-card h3 {
    margin: 0 0 0.25rem; font-family: var(--font-body); font-size: 1rem; font-weight: 700;
  }
  .compare-cost {
    margin: 0 0 0.65rem; font-family: var(--font-mono); font-size: 0.78rem; color: var(--copper-deep);
  }
  .compare-card p {
    margin: 0 0 0.45rem; font-size: 0.88rem; line-height: 1.4; color: var(--muted);
  }
  .compare-card p span {
    display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    font-weight: 700; color: var(--navy); margin-bottom: 0.15rem;
  }

  .odds-list { display: grid; gap: 0.55rem; }
  .odds-row {
    display: grid; grid-template-columns: 1fr auto; gap: 0.35rem 0.75rem;
    align-items: center;
    border: 1px solid var(--line); background: rgba(255,255,255,0.55);
    padding: 0.7rem 0.8rem;
  }
  .odds-meta { grid-column: 1 / -1; }
  .odds-meta strong {
    display: block; font-family: var(--font-display); font-size: 1.05rem; color: var(--navy);
  }
  .odds-meta span { font-size: 0.78rem; color: var(--muted); line-height: 1.35; }
  .odds-track {
    height: 0.55rem; border-radius: 999px; background: rgba(11,31,58,0.08); overflow: hidden;
  }
  .odds-track span {
    display: block; height: 100%; border-radius: 999px;
    background: linear-gradient(90deg, var(--copper), var(--warn));
  }
  .odds-pct {
    font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; color: var(--warn);
    min-width: 3rem; text-align: right;
  }

  .story-chapter {
    padding: clamp(2.5rem, 6vw, 5rem) clamp(1.25rem, 5vw, 3.25rem);
    border-top: 1px solid var(--line);
  }
  .story-wide { max-width: 72rem; margin: 0 auto; }
  .chapter-grid { max-width: 68rem; margin: 0 auto; display: grid; gap: 1.75rem; }
  @media (min-width: 900px) {
    .chapter-grid { grid-template-columns: 1fr 1.05fr; align-items: center; gap: 2.5rem; }
  }
  .chapter-copy { max-width: 34rem; }
  .story-eyebrow {
    font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--copper); font-weight: 700; margin: 0 0 0.7rem;
  }
  .story-chapter h2 {
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 3.4vw, 2.45rem);
    line-height: 1.12; margin: 0 0 0.95rem; letter-spacing: -0.015em;
  }
  .story-body {
    font-size: 1.04rem; line-height: 1.65; color: #1d2736; margin: 0 0 1.1rem;
  }
  .story-body.narrow { max-width: 40rem; }
  .story-stat {
    display: flex; flex-direction: column; gap: 0.15rem;
    margin: 0.3rem 0 1.15rem; padding: 0.9rem 0;
    border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
    width: fit-content; min-width: 11rem;
  }
  .story-stat-value {
    font-family: var(--font-display); font-size: clamp(2.1rem, 4.2vw, 3rem);
    line-height: 1; color: var(--navy);
  }
  .story-stat.is-warn .story-stat-value { color: var(--warn); }
  .story-stat-label {
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
  }
  .story-bullets { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.5rem; }
  .story-bullets li {
    padding: 0.55rem 0.75rem; background: rgba(255,255,255,0.55);
    border-left: 3px solid var(--copper); color: var(--navy); line-height: 1.4; font-size: 0.95rem;
  }

  .visual-pane { display: grid; gap: 0.8rem; }
  .street-frame, .mini-map {
    position: relative; overflow: hidden; background: #cfd6e2;
    border: 1px solid var(--line);
  }
  .street-frame { aspect-ratio: 16 / 11; min-height: 210px; }
  .mini-map { aspect-ratio: 16 / 8; min-height: 130px; }
  .visual-caption {
    margin: -0.25rem 0 0; font-size: 11px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--muted);
  }

  .floor-split {
    display: grid; grid-template-columns: 1fr 1fr; min-height: 118px;
    border: 1px solid var(--line); overflow: hidden;
  }
  .floor-new, .floor-old {
    display: flex; flex-direction: column; justify-content: flex-end;
    padding: 0.95rem; gap: 0.15rem;
  }
  .floor-new {
    background:
      linear-gradient(145deg, rgba(47,107,79,0.18), rgba(47,107,79,0.05)),
      repeating-linear-gradient(-35deg, transparent, transparent 10px, rgba(47,107,79,0.07) 10px, rgba(47,107,79,0.07) 11px);
  }
  .floor-old {
    background:
      linear-gradient(145deg, rgba(11,31,58,0.1), rgba(11,31,58,0.03)),
      repeating-linear-gradient(35deg, transparent, transparent 10px, rgba(11,31,58,0.05) 10px, rgba(11,31,58,0.05) 11px);
  }
  .floor-old.is-risk {
    background:
      linear-gradient(145deg, rgba(180,35,24,0.16), rgba(180,35,24,0.05)),
      repeating-linear-gradient(35deg, transparent, transparent 10px, rgba(180,35,24,0.08) 10px, rgba(180,35,24,0.08) 11px);
  }
  .floor-new span, .floor-old span {
    font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700;
  }
  .floor-new span { color: var(--good); }
  .floor-old span { color: var(--navy); }
  .floor-old.is-risk span { color: var(--warn); }
  .floor-new em, .floor-old em { font-style: normal; font-size: 0.88rem; color: var(--muted); }

  .condition-grid { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
  @media (min-width: 560px) { .condition-grid { grid-template-columns: 1fr 1fr; } }
  .condition-card {
    border: 1px solid var(--line); background: rgba(255,255,255,0.55);
    padding: 0.8rem 0.85rem;
  }
  .condition-card header {
    display: flex; justify-content: space-between; gap: 0.45rem; align-items: baseline;
    margin-bottom: 0.3rem;
  }
  .condition-card h3 { font-family: var(--font-body); font-size: 0.92rem; margin: 0; font-weight: 700; }
  .condition-card em {
    font-style: normal; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
  }
  .condition-card p { margin: 0; font-size: 0.84rem; line-height: 1.4; color: var(--muted); }
  .condition-card.is-new, .condition-card.is-recent {
    border-color: rgba(47,107,79,0.28); background: rgba(47,107,79,0.07);
  }
  .condition-card.is-new em, .condition-card.is-recent em { color: var(--good); }
  .condition-card.is-partial em { color: #9a6b1f; }
  .condition-card.is-concern {
    border-color: rgba(180,35,24,0.4); background: rgba(180,35,24,0.08);
  }
  .condition-card.is-concern em { color: var(--warn); }
  .condition-card.is-original em { color: var(--muted); }

  .repair-list { display: grid; gap: 0.5rem; }
  .repair-card {
    border: 1px solid var(--line); background: rgba(255,255,255,0.55);
    padding: 0.75rem 0.85rem;
  }
  .repair-card header {
    display: flex; justify-content: space-between; gap: 0.75rem; align-items: baseline;
    margin-bottom: 0.25rem;
  }
  .repair-card h3 {
    font-family: var(--font-body); font-size: 0.9rem; margin: 0; font-weight: 700;
  }
  .repair-card strong {
    font-family: var(--font-mono); font-size: 0.78rem; color: var(--navy); white-space: nowrap;
  }
  .repair-card p { margin: 0; font-size: 0.82rem; line-height: 1.4; color: var(--muted); }

  .proceeds-hero {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.45rem 0.55rem;
    border: 1px solid var(--line); padding: 1rem 1.1rem;
    background:
      linear-gradient(145deg, rgba(20,51,86,0.1), rgba(196,92,38,0.08)),
      rgba(255,255,255,0.55);
  }
  .proceeds-hero strong, .proceeds-hero em {
    font-family: var(--font-display); font-style: normal;
    font-size: clamp(2.4rem, 5vw, 3.2rem); line-height: 1; color: var(--navy);
  }
  .proceeds-hero em { color: var(--copper-deep); }
  .proceeds-hero span {
    font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
    font-weight: 700; color: var(--muted);
  }
  .proceeds-hero p {
    flex: 1 1 100%; margin: 0.25rem 0 0;
    font-size: 0.9rem; color: var(--muted); line-height: 1.4;
  }
  .proceeds-list { display: grid; gap: 0.5rem; }
  .proceeds-card {
    border: 1px solid var(--line); background: rgba(255,255,255,0.55);
    padding: 0.8rem 0.9rem;
  }
  .proceeds-card header { margin-bottom: 0.3rem; }
  .proceeds-card h3 {
    font-family: var(--font-body); font-size: 0.92rem; margin: 0 0 0.15rem; font-weight: 700;
  }
  .proceeds-card em {
    font-style: normal; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    font-weight: 700; color: var(--copper-deep);
  }
  .proceeds-card p { margin: 0; font-size: 0.84rem; line-height: 1.45; color: var(--muted); }

  .school-stack { display: grid; gap: 0.55rem; }
  .school-card {
    display: flex; gap: 0.85rem; align-items: center;
    border: 1px solid var(--line); padding: 0.8rem 0.9rem;
    background: rgba(255,255,255,0.5);
  }
  .school-rating {
    width: 3.3rem; height: 3.3rem; border-radius: 999px;
    display: grid; place-content: center; text-align: center;
    background: var(--ink); color: #f5f7fa;
    font-family: var(--font-display); font-size: 1.3rem; line-height: 1; flex-shrink: 0;
  }
  .school-rating span {
    display: block; font-size: 9px; letter-spacing: 0.08em; opacity: 0.7; font-family: var(--font-body);
  }
  .school-card h3 { margin: 0 0 0.12rem; font-size: 0.95rem; font-family: var(--font-body); }
  .school-card p { margin: 0; font-size: 0.82rem; color: var(--muted); }
  .highlight-band {
    border: 1px solid rgba(196,92,38,0.28);
    background: linear-gradient(120deg, rgba(196,92,38,0.12), rgba(196,92,38,0.04));
    padding: 0.95rem 1rem;
  }
  .highlight-band p { margin: 0; font-size: 0.98rem; line-height: 1.45; }
  .highlight-band strong { color: var(--copper-deep); }

  .net-list { display: grid; gap: 0.65rem; }
  .net-card {
    border: 1px solid var(--line); background: rgba(255,255,255,0.6);
    padding: 0.9rem 1rem;
  }
  .net-card.is-offer {
    border-color: rgba(180,35,24,0.35);
    background: rgba(180,35,24,0.06);
  }
  .net-card header {
    display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline;
    margin-bottom: 0.55rem;
  }
  .net-card h3 { margin: 0; font-size: 0.95rem; font-family: var(--font-body); }
  .net-card header em {
    font-style: normal; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--warn); font-weight: 700;
  }
  .net-row {
    display: flex; justify-content: space-between; gap: 0.75rem;
    font-size: 0.86rem; padding: 0.2rem 0; color: var(--muted);
  }
  .net-row strong { color: var(--ink); font-weight: 600; }
  .net-row.is-total {
    margin-top: 0.35rem; padding-top: 0.45rem; border-top: 1px solid var(--line);
    color: var(--ink); font-weight: 600;
  }
  .net-row.is-total strong {
    font-family: var(--font-display); font-size: 1.15rem;
  }
  .net-card.is-offer .net-row.is-total strong { color: var(--warn); }
  .net-card > p { margin: 0.45rem 0 0; font-size: 0.82rem; color: var(--muted); line-height: 1.4; }

  .comps-layout { display: grid; gap: 1.4rem; margin-top: 1.15rem; }
  @media (min-width: 900px) {
    .comps-layout { grid-template-columns: 0.95fr 1.15fr; gap: 1.85rem; align-items: start; }
  }
  .comp-map {
    position: relative; aspect-ratio: 1; min-height: 270px;
    border: 1px solid var(--line); overflow: hidden;
    background:
      radial-gradient(circle at 52% 50%, rgba(196,92,38,0.14), transparent 28%),
      linear-gradient(180deg, #d5deeb 0%, #c2cedd 100%);
  }
  .comp-map-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(11,31,58,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(11,31,58,0.06) 1px, transparent 1px);
    background-size: 12.5% 12.5%;
  }
  .comp-pin {
    position: absolute; transform: translate(-50%, -50%);
    display: flex; flex-direction: column; align-items: center; gap: 0.08rem;
    white-space: nowrap; pointer-events: none;
  }
  .comp-pin::before {
    content: ""; width: 10px; height: 10px; border-radius: 999px;
    background: var(--navy); border: 2px solid #f5f7fa;
  }
  .comp-pin span {
    font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
  }
  .comp-pin strong {
    font-size: 11px; font-family: var(--font-display); color: var(--ink);
    background: rgba(245,247,250,0.94); padding: 0.1rem 0.28rem;
  }
  .comp-pin.is-subject { z-index: 2; }
  .comp-pin.is-subject::before { background: var(--warn); width: 14px; height: 14px; }
  .comp-pin.is-subject strong { color: var(--warn); }
  .comp-map-legend {
    position: absolute; left: 0.7rem; bottom: 0.6rem; margin: 0;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
  }
  .comp-bars { display: grid; gap: 0.65rem; }
  .comp-bar-row {
    display: grid; grid-template-columns: 1.2fr 1.4fr auto; gap: 0.6rem; align-items: center;
  }
  @media (max-width: 640px) {
    .comp-bar-row { grid-template-columns: 1fr; gap: 0.22rem; }
  }
  .comp-bar-meta strong { display: block; font-size: 0.86rem; }
  .comp-bar-meta span { font-size: 0.76rem; color: var(--muted); }
  .comp-bar-track { height: 8px; background: var(--wash); overflow: hidden; }
  .comp-bar-track span {
    display: block; height: 100%; background: linear-gradient(90deg, #8fa3c2, var(--navy));
  }
  .comp-bar-row.is-offer .comp-bar-track span { background: var(--warn); }
  .comp-bar-price {
    font-family: var(--font-display); font-size: 0.95rem; text-align: right; white-space: nowrap;
  }

  .callout-strip {
    display: grid; gap: 0.75rem; max-width: 40rem;
    margin: 0 0 1.25rem; padding: 1rem 1.1rem;
    border: 1px solid rgba(180,35,24,0.28);
    background:
      linear-gradient(120deg, rgba(180,35,24,0.08), rgba(180,35,24,0.02));
  }
  @media (min-width: 640px) {
    .callout-strip { grid-template-columns: auto 1fr; align-items: center; }
  }
  .callout-strip span {
    display: block; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--warn); font-weight: 700;
  }
  .callout-strip strong {
    font-family: var(--font-display); font-size: 1.6rem; color: var(--warn);
  }
  .callout-strip p { margin: 0; font-size: 0.95rem; line-height: 1.45; }

  .range-cards {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.55rem;
    max-width: 36rem; margin: 0 0 1.35rem;
  }
  @media (min-width: 640px) { .range-cards { grid-template-columns: repeat(4, 1fr); } }
  .range-card {
    border: 1px solid var(--line); padding: 0.85rem 0.7rem; background: rgba(255,255,255,0.5);
  }
  .range-card.warn { border-color: rgba(180,35,24,0.3); background: rgba(180,35,24,0.06); }
  .range-card.good { border-color: rgba(47,107,79,0.3); background: rgba(47,107,79,0.07); }
  .range-card span {
    display: block; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 0.2rem;
  }
  .range-card strong { font-family: var(--font-display); font-size: 1.2rem; }
  .range-card.warn strong { color: var(--warn); }
  .range-card.good strong { color: var(--good); }
  .range-bar { max-width: 40rem; }
  .range-track {
    position: relative; height: 10px; background: var(--wash); margin: 2.3rem 0 0.7rem;
  }
  .range-fill {
    position: absolute; inset: 0 6% 0 18%;
    background: linear-gradient(90deg, #9db0d0, var(--navy));
  }
  .range-offer {
    position: absolute; top: -1.8rem; transform: translateX(-50%);
    font-size: 11px; font-weight: 700; color: var(--warn); letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .range-offer::after {
    content: ""; position: absolute; left: 50%; top: 100%; width: 2px; height: 1.35rem;
    background: var(--warn); transform: translateX(-50%);
  }
  .range-labels {
    display: flex; justify-content: space-between;
    font-size: 0.86rem; font-weight: 600; color: var(--navy);
  }

  .story-notebook { max-width: 44rem; margin: 0 auto; }
  .notebook-p + .notebook-p { margin-top: 0.95rem; }
  .story-footer {
    margin-top: 2.1rem; padding-top: 1.1rem; border-top: 1px solid var(--line);
    color: var(--muted); font-size: 0.84rem; line-height: 1.5;
  }
  .footer-brand {
    display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem; color: var(--ink);
  }
  .footer-brand strong { display: block; font-size: 0.92rem; }
  .footer-brand span {
    display: block; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted);
  }
  .story-sources { margin-top: 0.4rem; font-size: 0.75rem; }

  .reveal { animation: story-in 720ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  .delay-1 { animation-delay: 70ms; }
  .delay-2 { animation-delay: 140ms; }
  .delay-3 { animation-delay: 210ms; }
  .delay-4 { animation-delay: 280ms; }
  .delay-5 { animation-delay: 350ms; }
  @keyframes story-in {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) { .reveal { animation: none; } }
`;
