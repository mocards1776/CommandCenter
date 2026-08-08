import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lets one app produce two Home Screen icons: adding from /reading gives a
 * Reading icon that opens straight to the library, adding from anywhere else
 * gives the full Command Center.
 *
 * iOS reads all of this at the moment you tap "Add to Home Screen". Crucially
 * it takes the icon from <link rel="apple-touch-icon">, NOT from the
 * manifest's icons array — swapping only the manifest leaves the old icon,
 * which is exactly what went wrong the first time.
 */
export function useRouteManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reading = pathname.startsWith("/reading");

    const manifest = reading ? "/reading.webmanifest" : "/manifest.webmanifest";
    const icon192 = reading ? "/icon-books-192.png" : "/icon-192.png";
    const icon512 = reading ? "/icon-books-512.png" : "/icon-512.png";
    const title = reading ? "Reading" : "Command";

    // Replace the manifest element rather than mutating href: Safari does not
    // reliably re-read a manifest whose href was changed in place.
    const oldManifest = document.querySelector('link[rel="manifest"]');
    if (!oldManifest || !oldManifest.getAttribute("href")?.endsWith(manifest)) {
      oldManifest?.remove();
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = manifest;
      document.head.appendChild(link);
    }

    // The one iOS actually uses for the Home Screen icon.
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

    // Safari shows the document title under the icon when adding, so make it
    // match what the icon will be called.
    document.title = reading ? "Reading" : "🇺🇸 Josh's Command Center";
  }, [pathname]);
}
