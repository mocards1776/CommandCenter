import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  Repeat,
  BookOpen,
  Trophy,
  Newspaper,
  LogOut,
  Users,
  Flame,
} from "lucide-react";
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
  { to: "/rss", label: "RSS", short: "RSS", Icon: Newspaper },
  { to: "/sports", label: "Sports", short: "Sports", Icon: Trophy },
];

const SPORTS_NAV = [
  { to: "/sports?solo=1", match: (p: string) => p === "/sports", label: "Teams", Icon: Users },
  {
    to: "/sports/mlb?solo=1",
    match: (p: string) =>
      p === "/sports/mlb" ||
      p.startsWith("/sports/mlb/game") ||
      p.startsWith("/sports/mlb/player"),
    label: "MLB",
    Icon: Trophy,
  },
  {
    to: "/sports/mlb/managers?solo=1",
    match: (p: string) => p.startsWith("/sports/mlb/managers"),
    label: "Managers",
    Icon: Flame,
  },
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
  const onSports = pathname.startsWith("/sports");

  const [soloSession, setSoloSession] = useState(
    () =>
      soloParam ||
      (onSports && prefersSportsHome()) ||
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

    if (onSports) {
      const sportsManifest = document
        .querySelector('link[rel="manifest"]')
        ?.getAttribute("href")
        ?.includes("sports.webmanifest");
      // Solo only when explicitly launched (?solo=1) or from the Sports Home Screen app.
      // Do not force-hide Command Center chrome just because sports-solo is in storage.
      if (soloParam || (isStandaloneApp() && sportsManifest)) {
        markSportsSolo();
        clearReadingSolo();
        setSoloSession(true);
      }
      return;
    }

    // Leaving Sports/Reading for the rest of Command Center clears solo prefs
    // so the main icon keeps opening the dashboard.
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/todos") ||
      pathname.startsWith("/habits") ||
      pathname.startsWith("/rss")
    ) {
      clearReadingSolo();
      clearSportsSolo();
      setSoloSession(false);
    }
  }, [soloParam, onReading, onSports, pathname]);

  const readingOnly = useMemo(
    () => onReading && (soloParam || soloSession),
    [onReading, soloParam, soloSession],
  );
  const sportsOnly = useMemo(
    () => onSports && (soloParam || soloSession),
    [onSports, soloParam, soloSession],
  );
  const hideMainChrome = readingOnly || sportsOnly;

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const brand = onReading ? (
    <span className="text-accent">Reading</span>
  ) : sportsOnly || onSports ? (
    <span className="text-accent">Sports</span>
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
        {!hideMainChrome && (
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

        {/* Sports standalone: side rail with Teams / MLB only */}
        {sportsOnly && (
          <nav className="bg-ink hidden w-[160px] shrink-0 flex-col border-r border-accent/15 py-5 md:flex">
            {SPORTS_NAV.map(({ to, match, label }) => (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "block border-l-2 px-6 py-3 text-[11.5px] uppercase tracking-[0.19em] transition-colors",
                  match(pathname)
                    ? "border-accent bg-accent/[0.07] text-cream"
                    : "border-transparent text-chalk hover:text-cream",
                )}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        <main
          className={cn(
            "min-w-0 flex-1 overflow-x-hidden md:pb-0",
            // Reading solo: no bottom bar. Sports solo + full app: pad for tabs.
            readingOnly ? "pb-0" : "pb-[76px] md:pb-0",
          )}
        >
          <Outlet />
        </main>
      </div>

      <InstallHint />

      {/* Full Command Center mobile tabs */}
      {!hideMainChrome && (
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

      {/* Sports standalone mobile tabs — Teams + MLB only */}
      {sportsOnly && (
        <nav
          className="bg-ink fixed inset-x-0 bottom-0 z-40 flex border-t border-accent/20 md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {SPORTS_NAV.map(({ to, match, label, Icon }) => {
            const active = match(pathname);
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[9.5px] uppercase tracking-[0.14em] transition-colors",
                  active ? "text-accent" : "text-chalk-dim",
                )}
              >
                <Icon size={19} className={active ? "scale-110 transition-transform" : ""} />
                {label}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
