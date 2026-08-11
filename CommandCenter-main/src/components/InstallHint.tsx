import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Share } from "lucide-react";

const DISMISSED_KEY = "cc_install_hint_dismissed";

/**
 * iOS bookmarks the URL of the page you’re on — the Add sheet won’t let you
 * edit it. Reading/Sports must be added from their static launch pages,
 * never from /dashboard.
 */
export default function InstallHint() {
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();
  const onReading = pathname.startsWith("/reading");
  const onSports = pathname.startsWith("/sports");
  const onRss = pathname.startsWith("/rss");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (!isIOS || !isSafari) return;

    const t = window.setTimeout(() => setShow(true), 1800);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-3 z-50 md:hidden"
      style={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }}
    >
      <div className="bg-hero border-accent/50 flex items-start gap-3 rounded-lg border px-4 py-3.5 shadow-2xl">
        <span className="flag-mark mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-cream text-[13px] font-semibold">
            {onReading
              ? "Bookmark Reading (not Dashboard)"
              : onSports
                ? "Bookmark Sports (not Dashboard)"
                : onRss
                  ? "Bookmark Dispatch (not Dashboard)"
                  : "Add to your Home Screen"}
          </p>
          <p className="text-chalk mt-1 text-[11.5px] leading-relaxed">
            {onReading ? (
              <>
                Open{" "}
                <a href="/read.html" className="text-accent underline underline-offset-2">
                  /read.html
                </a>
                , then tap <Share size={11} className="inline align-[-1px]" /> →{" "}
                <span className="text-cream">Add to Home Screen</span>. The URL must say read.html
                — Safari won’t let you edit it.
              </>
            ) : onSports ? (
              <>
                Open{" "}
                <a href="/sports.html" className="text-accent underline underline-offset-2">
                  /sports.html
                </a>
                , then tap <Share size={11} className="inline align-[-1px]" /> →{" "}
                <span className="text-cream">Add to Home Screen</span>. The URL must say
                sports.html — Safari won’t let you edit it.
              </>
            ) : onRss ? (
              <>
                Open{" "}
                <a href="/rss.html" className="text-accent underline underline-offset-2">
                  /rss.html
                </a>
                , then tap <Share size={11} className="inline align-[-1px]" /> →{" "}
                <span className="text-cream">Add to Home Screen</span>. The URL must say rss.html
                — Safari won’t let you edit it.
              </>
            ) : (
              <>
                Tap <Share size={11} className="inline align-[-1px]" /> then{" "}
                <span className="text-cream">Add to Home Screen</span> — it opens full screen, with
                no browser bar.
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, "1");
            setShow(false);
          }}
          aria-label="Dismiss"
          className="text-chalk-dim hover:text-cream shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
