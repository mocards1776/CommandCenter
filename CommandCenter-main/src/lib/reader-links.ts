/** Resolves an article href against its source; null for anything a reader shouldn't follow. */
export function readerHref(href: string | null | undefined, base: string | null | undefined): string | null {
  const raw = (href ?? "").trim();
  if (!raw || raw.startsWith("#")) return null;
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  return /^(?:https?|mailto):$/.test(url.protocol) ? url.href : null;
}

function readerSrcset(srcset: string, base: string | null | undefined): string {
  return srcset
    .split(",")
    .map((part) => {
      const [src, ...rest] = part.trim().split(/\s+/);
      const abs = readerHref(src, base);
      return abs && !abs.startsWith("mailto:") ? [abs, ...rest].join(" ") : null;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Article HTML is injected on our origin: relative links and images must point
 * back at the source, links open outside the paper, and script hooks go.
 */
export function readerLinks(html: string, base: string | null | undefined): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return html;

  root.querySelectorAll("script, iframe, object, embed, form").forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
  });
  root.querySelectorAll("a").forEach((a) => {
    const href = readerHref(a.getAttribute("href"), base);
    if (!href) {
      a.replaceWith(...a.childNodes);
      return;
    }
    a.setAttribute("href", href);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  root.querySelectorAll("img, source").forEach((el) => {
    const src = el.getAttribute("src");
    if (src) {
      const abs = readerHref(src, base);
      if (abs && !abs.startsWith("mailto:")) el.setAttribute("src", abs);
      else if (!/^data:image\//i.test(src)) el.removeAttribute("src");
    }
    const srcset = el.getAttribute("srcset");
    if (srcset) {
      const abs = readerSrcset(srcset, base);
      if (abs) el.setAttribute("srcset", abs);
      else el.removeAttribute("srcset");
    }
  });
  return root.innerHTML;
}
