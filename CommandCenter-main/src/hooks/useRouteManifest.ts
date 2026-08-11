import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lets one app produce multiple Home Screen icons: Reading, Sports, Dispatch,
 * or full Command Center — depending on which route you’re on when you Add.
 *
 * iOS reads all of this at the moment you tap "Add to Home Screen". Crucially
 * it takes the icon from <link rel="apple-touch-icon">, NOT from the
 * manifest's icons array — swapping only the manifest leaves the old icon.
 */
export function useRouteManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reading = pathname.startsWith("/reading");
    const sports = pathname.startsWith("/sports");
    const rss = pathname.startsWith("/rss");

    const mode = reading ? "reading" : sports ? "sports" : rss ? "rss" : "app";

    const manifest =
      mode === "reading"
        ? "/reading.webmanifest"
        : mode === "sports"
          ? "/sports.webmanifest"
          : mode === "rss"
            ? "/rss.webmanifest"
            : "/manifest.webmanifest";
    const icon192 =
      mode === "reading"
        ? "/icon-books-192.png"
        : mode === "sports"
          ? "/icon-mlb-192.png"
          : mode === "rss"
            ? "/icon-rss-192.png"
            : "/icon-192.png";
    const icon512 =
      mode === "reading"
        ? "/icon-books-512.png"
        : mode === "sports"
          ? "/icon-mlb-512.png"
          : mode === "rss"
            ? "/icon-rss-512.png"
            : "/icon-512.png";
    const title =
      mode === "reading"
        ? "Reading"
        : mode === "sports"
          ? "Sports"
          : mode === "rss"
            ? "Dispatch"
            : "Command";

    const oldManifest = document.querySelector('link[rel="manifest"]');
    if (!oldManifest || !oldManifest.getAttribute("href")?.endsWith(manifest)) {
      oldManifest?.remove();
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = manifest;
      document.head.appendChild(link);
    }

    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((el) => el.remove());
    for (const [href, sizes] of [
      [icon192, "192x192"],
      [icon512, "512x512"],
    ]) {
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      link.setAttribute("sizes", sizes);
      link.href = href;
      document.head.appendChild(link);
    }

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = icon192;

    const titleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (titleMeta) titleMeta.content = title;

    document.title =
      mode === "reading"
        ? "Reading"
        : mode === "sports"
          ? "Sports"
          : mode === "rss"
            ? "Dispatch"
            : "🇺🇸 Josh's Command Center";
  }, [pathname]);
}
