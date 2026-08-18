import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Copy, Link2, Presentation } from "lucide-react";
import ScrollStory from "@/components/stories/ScrollStory";
import { getStory } from "@/lib/stories/types";
import { mintStoryLink, storyShareUrl } from "@/lib/stories/share";

/**
 * Internal notebook / report page for client scroll stories.
 * Staff can mint a client scroll-presentation URL from here.
 */
export default function BuenaVistaNotebookPage() {
  const { slug = "1715-e-buena-vista" } = useParams();
  const story = getStory(slug);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);

  if (!story) return <Navigate to="/notebook/1715-e-buena-vista" replace />;

  const storySlug = story.slug;
  const mintLabel =
    story.layout === "portrait"
      ? story.address
      : story.layout === "land"
      ? story.address
      : story.brand.includes("Financial")
        ? "1715 E. Buena Vista · Financial"
        : story.slug.includes("buena-vista")
          ? "1715 E. Buena Vista"
          : story.address;

  async function onMint() {
    setBusy(true);
    try {
      const token = await mintStoryLink(storySlug, mintLabel);
      const url = storyShareUrl(token);
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Scroll presentation link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mint link");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Copied");
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (preview) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className="fixed top-3 right-3 z-50 rounded-sm bg-ink px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase text-cream"
        >
          Exit preview
        </button>
        <ScrollStory story={story} clientMode />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="label-caps text-accent mb-2">Notebook</p>
      <h1 className="text-3xl sm:text-4xl text-cream mb-2">{story.address}</h1>
      <p className="text-chalk text-sm mb-8">{story.cityLine}</p>

      <div className="rounded-sm border border-white/10 bg-panel p-4 sm:p-5 mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Presentation className="size-4 text-accent" aria-hidden />
          <h2 className="text-cream font-semibold text-sm tracking-wide">Scroll presentation</h2>
        </div>
        <p className="text-chalk text-sm leading-relaxed mb-4">
          Mint a secret client URL for the read-only scroll story. No login, no admin chrome.
          Links use <code className="text-cream/80">VITE_CLIENT_SHARE_ORIGIN</code> when set.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            disabled={busy}
            onClick={onMint}
            className="inline-flex items-center gap-2 rounded-sm bg-accent-deep px-3 py-2 text-[12px] font-semibold tracking-wide text-cream disabled:opacity-60"
          >
            <Link2 className="size-3.5" aria-hidden />
            {busy ? "Minting…" : "Scroll presentation"}
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="inline-flex items-center gap-2 rounded-sm border border-white/15 px-3 py-2 text-[12px] font-semibold tracking-wide text-cream"
          >
            Preview story
          </button>
        </div>
        {shareUrl ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-sm border border-white/10 bg-field px-3 py-2 text-xs text-cream font-mono"
              aria-label="Client share URL"
            />
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-sm border border-white/15 px-3 py-2 text-[12px] text-cream"
            >
              {copied ? <Check className="size-3.5 text-turf" /> : <Copy className="size-3.5" />}
              Copy
            </button>
          </div>
        ) : null}
      </div>

      <section className="mb-10">
        <div className="rule-head mb-4">
          <span>{story.layout === "portrait" ? "Brief" : "Offer brief"}</span>
        </div>
        <p className="text-cream/90 leading-relaxed mb-3">{story.heroLine}</p>
        <p className="text-chalk text-sm leading-relaxed mb-4">{story.support}</p>
        <p className="text-sm text-accent mb-6 border-l-2 border-accent pl-3">
          {story.valuation.recommendation}
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {story.facts.map((f) => (
            <div key={f.label} className="border border-white/10 rounded-sm p-3 bg-field/60">
              <dt className="label-caps mb-1">{f.label}</dt>
              <dd className="text-sm text-cream font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {story.condition.length ? (
        <section className="mb-10">
          <div className="rule-head mb-4">
            <span>{story.layout === "portrait" ? "Life" : "Condition"}</span>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {story.condition.map((c) => (
              <li key={c.label} className="border border-white/10 rounded-sm p-3 bg-field/60">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-cream font-medium text-sm">{c.label}</span>
                  <span className="label-caps">{c.status}</span>
                </div>
                <p className="text-chalk text-xs leading-relaxed">{c.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {story.repairs.length ? (
        <section className="mb-10">
          <div className="rule-head mb-4">
            <span>Repair ballparks</span>
          </div>
          <ul className="space-y-2">
            {story.repairs.map((r) => (
              <li
                key={r.issue}
                className="border border-white/10 rounded-sm p-3 bg-field/60 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1"
              >
                <div>
                  <div className="text-cream text-sm font-medium">{r.issue}</div>
                  <p className="text-chalk text-xs leading-relaxed">{r.note}</p>
                </div>
                <div className="text-sm text-cream font-mono whitespace-nowrap">
                  {r.low.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                  –
                  {r.high.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {story.proceedsOptions.length ? (
        <section className="mb-10">
          <div className="rule-head mb-4">
            <span>{story.layout === "land" ? "Hold income (non-sale)" : "Proceeds control"}</span>
          </div>
          <ul className="space-y-2">
            {story.proceedsOptions.map((opt) => (
              <li key={opt.title} className="border border-white/10 rounded-sm p-3 bg-field/60">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-1">
                  <span className="text-cream text-sm font-medium">{opt.title}</span>
                  <span className="label-caps">{opt.summary}</span>
                </div>
                <p className="text-chalk text-xs leading-relaxed">{opt.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {story.layout !== "portrait" ? (
      <section className="mb-10">
        <div className="rule-head mb-4">
          <span>Valuation range</span>
        </div>
        <p className="text-chalk text-sm leading-relaxed mb-4">{story.valuation.thesis}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-6">
          {(story.layout === "land"
            ? [
                ["Low", story.valuation.low],
                ["Mid", story.valuation.mid],
                ["High", story.valuation.high],
                ["Index", story.valuation.zest],
              ]
            : [
                ["Offer", story.valuation.offer],
                ["Low", story.valuation.low],
                ["Mid", story.valuation.mid],
                ["High", story.valuation.high],
              ]
          ).map(([label, value]) => (
            <div key={String(label)} className="border border-white/10 rounded-sm p-3 bg-field/60">
              <div className="label-caps mb-1">{label}</div>
              <div className="text-lg text-cream font-[family-name:var(--font-display)]">
                {Number(value).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="rule-head mb-4">
          <span>{story.layout === "land" ? "Sale / hold paths" : "Net after realtor fees"}</span>
        </div>
        <ul className="space-y-3">
          {story.netScenarios.map((n) => (
            <li key={n.label} className="border border-white/10 rounded-sm p-3 bg-field/60 text-sm">
              <div className="flex justify-between gap-3 text-cream font-medium mb-1">
                <span>{n.label}</span>
                <span>
                  {n.estimatedNet.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <p className="text-chalk text-xs leading-relaxed">
                {n.salePrice <= 0 ? (
                  <>Hold / lease path. {n.note}</>
                ) : (
                  <>
                    Sale{" "}
                    {n.salePrice.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    })}
                    {n.realtorFee
                      ? ` · fees −${n.realtorFee.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })}`
                      : " · no realtor"}
                    . {n.note}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>
      ) : null}

      <section className="mb-10">
        <div className="rule-head mb-4">
          <span>{story.notebook.title}</span>
        </div>
        <div className="space-y-4">
          {story.notebook.paragraphs.map((p) => (
            <p key={p.slice(0, 40)} className="text-sm text-chalk leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </section>

      {story.comps.length ? (
      <section className="mb-10">
        <div className="rule-head mb-4">
          <span>Comps</span>
        </div>
        <ul className="divide-y divide-white/10 border border-white/10 rounded-sm">
          {story.comps.map((c) => (
            <li key={c.address} className="flex justify-between gap-4 px-3 py-3 text-sm">
              <div>
                <div className="text-cream font-medium">{c.address}</div>
                <div className="text-chalk text-xs mt-0.5">
                  {c.acres != null
                    ? `${c.acres} ac · ${c.note}`
                    : `${c.beds}/${c.baths} · ${c.sqft.toLocaleString()} sq ft · ${c.note}`}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-cream">{c.priceLabel}</div>
                <div className="label-caps mt-0.5">{c.kind}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      ) : null}

      <p className="text-[11px] text-chalk-dim leading-relaxed">
        Research {story.researchDate}. Sources: {story.sources.join("; ")}.{" "}
        <Link to="/dashboard" className="underline underline-offset-2">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
