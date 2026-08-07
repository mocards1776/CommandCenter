import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * iOS reads the page's manifest at the moment you tap "Add to Home Screen",
 * so swapping which manifest is linked lets a single app produce more than
 * one icon: adding from /reading gives a Reading icon that opens straight to
 * the library, adding from anywhere else gives the full Command Center.
 */
export function useRouteManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const wanted = pathname.startsWith("/reading")
      ? "/reading.webmanifest"
      : "/manifest.webmanifest";
    if (!link.href.endsWith(wanted)) link.href = wanted;

    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (title) title.content = pathname.startsWith("/reading") ? "Reading" : "Command";
  }, [pathname]);
}
