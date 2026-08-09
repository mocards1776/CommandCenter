import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { LayoutDashboard, ListChecks, Repeat, BookOpen, Trophy, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import StarField from "@/components/StarField";
import InstallHint from "@/components/InstallHint";
import PagesTodayBadge from "@/components/PagesTodayBadge";
import { useRouteManifest } from "@/hooks/useRouteManifest";
import {
  clearReadingSolo,
  markReadingSolo,
  prefersReadingHome,
} from "@/lib/reading-home";
import {
  clearSportsSolo,
  markSportsSolo,
  prefersSportsHome,
} from "@/lib/sports-home";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", short: "Today", Icon: LayoutDashboard },
  { to: "/todos", label: "Todos", short: "Todos", Icon: ListChecks },
  { to: "/habits", label: "Habits", short: "Habits", Icon: Repeat },
  { to: "/reading", label: "Reading", short: "Reading", Icon: BookOpen },
  { to: "/sports", label: "Sports", short: "Sports", Icon: Trophy },
];

function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  useRouteManifest();

  const soloParam = searchParams.get("solo") === "1";
  const onReading = pathname.startsWith("/reading");
  const onMlb = pathname.startsWith("/sports/mlb");
  const onSports = pathname.startsWith("/sports");

  // UI solo mode is session-scoped; localStorage only steers `/` + post-login.
  const [soloSession, setSoloSession] = useState(
    () =>
      soloParam ||
      (onMlb && prefersSportsHome()) ||
      (onReading && prefersReadingHome()),
  );

  useEffect(() => {
    if (onReading) {
      const readingManifest = document
        .querySelector('link[rel="manifest"]')
        ?.getAttribute("href")
        ?.includes("reading.webmanifest");
      if (soloParam || (isStandaloneApp() && readingManifest)) {
        markReadingSolo();
        clearSportsSolo();
        setSoloSession(true);
      }
      return;
    }

    if (onMlb) {
      const mlbManifest = document
        .querySelector('link[rel="manifest"]')
        ?.getAttribute("href")
        ?.includes("mlb.webmanifest");
      if (soloParam || (isStandaloneApp() && mlbManifest) || prefersSportsHome()) {
        markSportsSolo();
        clearReadingSolo();
        setSoloSession(true);
      }
      return;
    }

    // Using the rest of Command Center clears solo Home Screen preferences
    // so the main icon keeps opening the dashboard.
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/todos") ||
      pathname.startsWith("/habits") ||
      (onSports && !onMlb)
    ) {
      clearReadingSolo();
      clearSportsSolo();
      setSoloSession(false);
    }
  }, [soloParam, onReading, onMlb, onSports, pathname]);

  const readingOnly = useMemo(
    () => onReading && (soloParam || soloSession),
    [onReading, soloParam, soloSession],
  );
  const sportsOnly = useMemo(
    () => onMlb && (soloParam || soloSession || prefersSportsHome()),
    [onMlb, soloParam, soloSession],
  );
  const hideChrome = readingOnly || sportsOnly;

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const brand = onReading ? (
    <>
      <span className="text-accent">Reading</span>
    </>
  ) : onMlb ? (
    <>
      <span className="text-accent">MLB</span>
    </>
  ) : (
    <>
      Command <span className="text-accent">Center</span>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="bg-ink relative flex min-h-[58px] shrink-0 items-center justify-between overflow-hidden px-4 md:min-h-[70px] md:px-8"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
          paddingBottom: "0.5rem",
        }}
      >
        <StarField count={26} seed={3} />
        <div className="relative z-10 flex items-center gap-3 md:gap-4">
          <span className="flag-mark" />
          <h1 className="font-display text-cream text-[19px] tracking-[0.05em] md:text-[25px]">
            {brand}
          </h1>
        </div>
        {onReading ? (
          <PagesTodayBadge />
        ) : (
          <span className="label-caps relative z-10 hidden lg:inline">{today}</span>
        )}
      </header>
      <div className="rule-flag" />

      <div className="flex min-h-0 flex-1">
        {!hideChrome && (
          <nav className="bg-ink hidden w-[196px] shrink-0 flex-col border-r border-accent/15 py-5 md:flex">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "block border-l-2 px-7 py-3 text-[11.5px] uppercase tracking-[0.19em] transition-colors",
                    isActive || (to === "/sports" && onSports)
                      ? "border-accent bg-accent/[0.07] text-cream"
                      : "border-transparent text-chalk hover:text-cream",
                  )
                }
              >
                {label}
              </NavLink>
            ))}

            <button
              onClick={() => void signOut()}
              title={user?.email ?? undefined}
              className="text-chalk-dim hover:text-cream mt-auto flex items-center gap-2 px-7 py-3 text-[10.5px] uppercase tracking-[0.19em] transition-colors"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </nav>
        )}

        <main
          className={cn(
            "min-w-0 flex-1 overflow-x-hidden md:pb-0",
            hideChrome ? "pb-0" : "pb-[76px]",
          )}
        >
          <Outlet />
        </main>
      </div>

      <InstallHint />

      {!hideChrome && (
        <nav
          className="bg-ink fixed inset-x-0 bottom-0 z-40 flex border-t border-accent/20 md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {NAV.map(({ to, short, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[9.5px] uppercase tracking-[0.14em] transition-colors",
                  isActive || (to === "/sports" && onSports) ? "text-accent" : "text-chalk-dim",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={19}
                    className={
                      isActive || (to === "/sports" && onSports)
                        ? "scale-110 transition-transform"
                        : ""
                    }
                  />
                  {short}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
