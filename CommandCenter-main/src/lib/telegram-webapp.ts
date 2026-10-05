/**
 * Telegram Mini App bootstrap for sports pages opened from heat / finals DMs.
 *
 * Telegram appends #tgWebAppData=… and keeps the existing query string, so
 * ?solo=1 still marks sports-only chrome. This file only runs inside Telegram's
 * WebView: ready + expand so the board is not a half-sheet.
 */

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    TelegramWebviewProxy?: unknown;
  }
}

const INK = "#081228";

export function isTelegramWebView(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.TelegramWebviewProxy) return true;
    if (window.Telegram?.WebApp) return true;
    if (/tgWebAppData=/.test(window.location.hash)) return true;
    return /\bTelegram/i.test(window.navigator.userAgent);
  } catch {
    return false;
  }
}

export function activateTelegramWebApp(app: TelegramWebApp | undefined = window.Telegram?.WebApp): boolean {
  if (!app) return false;
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("telegram-mini-app");
  }
  app.ready?.();
  app.expand?.();
  app.disableVerticalSwipes?.();
  app.setHeaderColor?.(INK);
  app.setBackgroundColor?.(INK);
  return true;
}

export function bootTelegramWebApp(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!isTelegramWebView()) return;
  if (activateTelegramWebApp()) return;
  const existing = document.querySelector<HTMLScriptElement>("script[data-telegram-web-app]");
  if (existing) {
    existing.addEventListener("load", () => activateTelegramWebApp(), { once: true });
    return;
  }
  const script = document.createElement("script");
  script.src = "https://telegram.org/js/telegram-web-app.js";
  script.async = true;
  script.dataset.telegramWebApp = "1";
  script.addEventListener("load", () => activateTelegramWebApp(), { once: true });
  document.head.appendChild(script);
}
