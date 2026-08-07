import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

const DISMISSED_KEY = "cc_install_hint_dismissed";

/**
 * iOS only grants standalone mode to apps launched from the Home Screen icon
 * — a URL opened in Safari always keeps the browser chrome, and no manifest
 * setting overrides that. So the best available answer is to make the Home
 * Screen route obvious, once, on the devices where it applies.
 */
export default function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed? Nothing to suggest.
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // Safari's own flag, which predates the standard media query.
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Only iOS Safari needs the manual instructions; Android fires its own
    // install prompt and desktop has an address-bar affordance.
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (!isIOS || !isSafari) return;

    // Let the page settle before interrupting.
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
          <p className="text-cream text-[13px] font-semibold">Add to your Home Screen</p>
          <p className="text-chalk mt-1 text-[11.5px] leading-relaxed">
            Tap <Share size={11} className="inline align-[-1px]" /> then{" "}
            <span className="text-cream">Add to Home Screen</span> — it opens full screen, with no
            browser bar.
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
