import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { CelebrationProvider } from "@/components/Celebration";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import { TimesHoldShell } from "@/components/newspaper/TimesHold";
import { homePath, markReadingSolo, safeNextPath } from "@/lib/reading-home";
import { markSportsSolo } from "@/lib/sports-home";
import { markRssSolo } from "@/lib/rss-home";

const DailyNewspaperPage = lazy(() => import("@/pages/DailyNewspaperPage"));
const NewspaperPhoneCardPage = lazy(() => import("@/pages/NewspaperPhoneCardPage"));
const NewspaperWatchPreviewPage = lazy(() => import("@/pages/NewspaperWatchPreviewPage"));
const NewspaperA1PreviewPage = lazy(() => import("@/pages/NewspaperA1PreviewPage"));
const NewspaperSportPreviewPage = lazy(() => import("@/pages/NewspaperSportPreviewPage"));
const NewspaperTimesPreviewPage = lazy(() => import("@/pages/NewspaperTimesPreviewPage"));
const NewspaperCoachesPreviewPage = lazy(() => import("@/pages/NewspaperCoachesPreviewPage"));
const NewspaperRacesPreviewPage = lazy(() => import("@/pages/NewspaperRacesPreviewPage"));
const RssPage = lazy(() => import("@/pages/RssPage"));
const PublicStoryPage = lazy(() => import("@/pages/PublicStoryPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const TodosPage = lazy(() => import("@/pages/TodosPage"));
const HabitsPage = lazy(() => import("@/pages/HabitsPage"));
const ReadingPage = lazy(() => import("@/pages/ReadingPage"));
const FinancePage = lazy(() => import("@/pages/FinancePage"));
const BuenaVistaNotebookPage = lazy(() => import("@/pages/BuenaVistaNotebookPage"));
const SportsPage = lazy(() => import("@/pages/SportsPage"));
const MlbPage = lazy(() => import("@/pages/MlbPage"));
const RuwtPage = lazy(() => import("@/pages/RuwtPage"));
const CardinalsProspectsPage = lazy(() => import("@/pages/CardinalsProspectsPage"));
const TagPlayersPage = lazy(() => import("@/pages/TagPlayersPage"));
const MlbPlayerPage = lazy(() => import("@/pages/MlbPlayerPage"));
const MlbGamePage = lazy(() => import("@/pages/MlbGamePage"));
const MlbManagersPage = lazy(() => import("@/pages/MlbManagersPage"));
const MlbManagerPage = lazy(() => import("@/pages/MlbManagerPage"));
const HotSeatPage = lazy(() => import("@/pages/HotSeatPage"));
const CfbPlayerPage = lazy(() => import("@/pages/CfbPlayerPage"));
const CfbPage = lazy(() => import("@/pages/CfbPage"));
const CfbGamePage = lazy(() => import("@/pages/CfbGamePage"));
const CfbTeamPage = lazy(() => import("@/pages/CfbTeamPage"));
const CfbCoachPage = lazy(() => import("@/pages/CfbCoachPage"));
const GolferPage = lazy(() => import("@/pages/GolferPage"));
const NflPage = lazy(() => import("@/pages/NflPage"));
const NflGamePage = lazy(() => import("@/pages/NflGamePage"));
const NflPlayerPage = lazy(() => import("@/pages/NflPlayerPage"));
const NflTeamPage = lazy(() => import("@/pages/NflTeamPage"));
const NflCoachPage = lazy(() => import("@/pages/NflCoachPage"));
const NhlPage = lazy(() => import("@/pages/NhlPage"));
const NhlGamePage = lazy(() => import("@/pages/NhlGamePage"));
const NhlPlayerPage = lazy(() => import("@/pages/NhlPlayerPage"));
const NhlTeamPage = lazy(() => import("@/pages/NhlTeamPage"));
const NhlCoachPage = lazy(() => import("@/pages/NhlCoachPage"));
const SoccerGamePage = lazy(() => import("@/pages/SoccerGamePage"));
const HeatAlertPreviewPage = lazy(() => import("@/pages/HeatAlertPreviewPage"));
const FieldDrivePreviewPage = lazy(() => import("@/pages/FieldDrivePreviewPage"));
const MlbPbpPreviewPage = lazy(() => import("@/pages/MlbPbpPreviewPage"));
const MomentAlertPreviewPage = lazy(() => import("@/pages/MomentAlertPreviewPage"));

function PageHold() {
  return (
    <div className="min-h-screen grid place-items-center">
      <span className="label-caps animate-pulse">Loading</span>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
});

/** Remember solo before any auth redirect can strip `?solo=1`. */
function captureSoloFromUrl() {
  if (typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("solo") !== "1") return;
  const path = window.location.pathname;
  if (path.startsWith("/sports")) {
    markSportsSolo();
  } else if (path.startsWith("/rss")) {
    markRssSolo();
  } else if (path.startsWith("/reading")) {
    markReadingSolo();
  }
}

function Protected() {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Render nothing while the stored session resolves, otherwise a refresh
  // flashes the login screen before landing back on the library/dashboard.
  if (loading) {
    if (location.pathname === "/newspaper") return <TimesHoldShell />;
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="label-caps animate-pulse">Loading</span>
      </div>
    );
  }

  if (!session && import.meta.env.VITE_DEV_BYPASS_AUTH !== "1") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <AppShell />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const [params] = useSearchParams();
  if (loading) return null;
  if (session) {
    captureSoloFromUrl();
    const next = safeNextPath(params.get("next")) ?? homePath();
    return <Navigate to={next} replace />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  captureSoloFromUrl();
  return <Navigate to={homePath()} replace />;
}

export default function App() {
  captureSoloFromUrl();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CelebrationProvider>
        <BrowserRouter>
          <Suspense fallback={<PageHold />}>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <LoginPage />
                </PublicOnly>
              }
            />
            {/* Token-gated client presentations — public, no app chrome */}
            <Route path="/story/:token" element={<PublicStoryPage />} />
            <Route path="/sports/field-drive-preview" element={<FieldDrivePreviewPage />} />
            <Route path="/sports/mlb-pbp-preview" element={<MlbPbpPreviewPage />} />
            <Route path="/sports/moment-alert-preview" element={<MomentAlertPreviewPage />} />
            <Route path="/newspaper/watch-preview" element={<NewspaperWatchPreviewPage />} />
            <Route path="/newspaper/a1-preview" element={<NewspaperA1PreviewPage />} />
            <Route path="/newspaper/sport-preview" element={<NewspaperSportPreviewPage />} />
            <Route path="/newspaper/times-preview" element={<NewspaperTimesPreviewPage />} />
            <Route path="/newspaper/coaches-preview" element={<NewspaperCoachesPreviewPage />} />
            <Route path="/newspaper/races-preview" element={<NewspaperRacesPreviewPage />} />
            <Route element={<Protected />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/newspaper"
                element={
                  <Suspense fallback={<TimesHoldShell />}>
                    <DailyNewspaperPage />
                  </Suspense>
                }
              />
              <Route
                path="/newspaper/phone-card"
                element={
                  <Suspense
                    fallback={
                      <div className="tt-phone-page" data-phone-card="loading" data-ready="loading">
                        Loading card…
                      </div>
                    }
                  >
                    <NewspaperPhoneCardPage />
                  </Suspense>
                }
              />
              <Route path="/todos" element={<TodosPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/reading" element={<ReadingPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/sports" element={<SportsPage />} />
              <Route path="/sports/mlb" element={<MlbPage />} />
              <Route path="/sports/ruwt" element={<RuwtPage />} />
              <Route path="/sports/mlb/prospects" element={<CardinalsProspectsPage />} />
              <Route path="/sports/mlb/tags/:tag" element={<TagPlayersPage />} />
              <Route path="/sports/mlb/managers" element={<MlbManagersPage />} />
              <Route path="/sports/mlb/managers/:managerId" element={<MlbManagerPage />} />
              <Route path="/sports/hot-seat" element={<HotSeatPage />} />
              <Route path="/sports/mlb/player/:playerId" element={<MlbPlayerPage />} />
              <Route path="/sports/mlb/game/:gamePk" element={<MlbGamePage />} />
              <Route path="/sports/golf/player/:golferId" element={<GolferPage />} />
              <Route path="/sports/nfl" element={<NflPage />} />
              <Route path="/sports/nfl/game/:eventId" element={<NflGamePage />} />
              <Route path="/sports/nfl/player/:playerId" element={<NflPlayerPage />} />
              <Route path="/sports/nfl/team/:teamId" element={<NflTeamPage />} />
              <Route path="/sports/nfl/coach/:coachId" element={<NflCoachPage />} />
              <Route path="/sports/nhl" element={<NhlPage />} />
              <Route path="/sports/nhl/game/:eventId" element={<NhlGamePage />} />
              <Route path="/sports/nhl/player/:playerId" element={<NhlPlayerPage />} />
              <Route path="/sports/nhl/team/:teamId" element={<NhlTeamPage />} />
              <Route path="/sports/nhl/coach/:coachId" element={<NhlCoachPage />} />
              <Route path="/sports/cfb" element={<CfbPage />} />
              <Route path="/sports/cfb/game/:eventId" element={<CfbGamePage />} />
              <Route path="/sports/cfb/team/:teamId" element={<CfbTeamPage />} />
              <Route path="/sports/cfb/coach/:coachId" element={<CfbCoachPage />} />
              <Route path="/sports/cfb/player/:playerId" element={<CfbPlayerPage />} />
              <Route path="/sports/soccer/game/:eventId" element={<SoccerGamePage />} />
              <Route path="/sports/heat-alert" element={<HeatAlertPreviewPage />} />
              <Route
                path="/rss"
                element={
                  <Suspense
                    fallback={
                      <div className="text-chalk flex min-h-[40vh] items-center justify-center text-[13px]">
                        Loading Dispatch…
                      </div>
                    }
                  >
                    <RssPage />
                  </Suspense>
                }
              />
              <Route path="/notebook/:slug" element={<BuenaVistaNotebookPage />} />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </CelebrationProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 2800,
            success: { duration: 2200 },
            error: { duration: 4000 },
            style: {
              background: "var(--color-panel)",
              color: "var(--color-cream)",
              border: "1px solid rgba(217,81,92,0.3)",
              borderRadius: "3px",
            },
          }}
          containerStyle={{ pointerEvents: "none" }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
