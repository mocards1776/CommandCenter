import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type Mode = "reading" | "sports" | "rss" | "newspaper" | "app";

const MODES: Record<Mode, { manifest: string; icon: string; short: string; title: string }> = {
  reading: {
    manifest: "/reading.webmanifest",
    icon: "/icon-books",
    short: "Reading",
    title: "Reading",
  },
  sports: {
    manifest: "/sports.webmanifest",
    icon: "/icon-mlb",
    short: "Sports",
    title: "Sports",
  },
  rss: {
    manifest: "/rss.webmanifest",
    icon: "/icon-rss",
    short: "Dispatch",
    title: "Dispatch",
  },
  newspaper: {
    manifest: "/times.webmanifest",
    icon: "/icon-times",
    short: "Times",
    title: "Thompson Times",
  },
  app: {
    manifest: "/manifest.webmanifest",
    icon: "/icon",
    short: "Command",
    title: "🇺🇸 Josh's Command Center",
  },
};

function modeFor(pathname: string): Mode {
  if (pathname.startsWith("/reading")) return "reading";
  if (pathname.startsWith("/sports")) return "sports";
  if (pathname.startsWith("/rss")) return "rss";
  if (pathname.startsWith("/newspaper")) return "newspaper";
  return "app";
}

/**
 * Lets one app produce multiple Home Screen icons: Reading, Sports, Dispatch,
 * Thompson Times, or full Command Center — depending on which route you’re on
 * when you Add.
 *
 * iOS reads all of this at the moment you tap "Add to Home Screen". Crucially
 * it takes the icon from <link rel="apple-touch-icon">, NOT from the
 * manifest's icons array — swapping only the manifest leaves the old icon.
 */
export function useRouteManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const { manifest, icon, short, title } = MODES[modeFor(pathname)];
    const icon192 = `${icon}-192.png`;
    const icon512 = `${icon}-512.png`;

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
    if (titleMeta) titleMeta.content = short;

    document.title = title;
  }, [pathname]);
}
