import { bytesToBase64 } from "./binary.ts";
import type { HeatAlertCard, HeatSide } from "./types.ts";

async function inlineLogo(href: string | null): Promise<string | null> {
  if (!href) return null;
  if (href.startsWith("data:image/")) return href;
  if (!/^https?:/i.test(href)) return null;
  try {
    const res = await fetch(href, {
      headers: { Accept: "image/png,image/jpeg", "User-Agent": "CommandCenterHeatAlert" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 1_500_000) return null;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpeg) return null;
    const mime = png ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

async function withLogo(side: HeatSide): Promise<HeatSide> {
  return { ...side, logoHref: await inlineLogo(side.logoHref) };
}

/** resvg does not fetch remote images. Inline the ESPN marks before rasterizing. */
export async function embedLogos(card: HeatAlertCard): Promise<HeatAlertCard> {
  const [away, home] = await Promise.all([withLogo(card.away), withLogo(card.home)]);
  return { ...card, away, home };
}
