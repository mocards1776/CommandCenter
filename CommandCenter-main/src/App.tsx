import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { CelebrationProvider } from "@/components/Celebration";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TodosPage from "@/pages/TodosPage";
import HabitsPage from "@/pages/HabitsPage";
import ReadingPage from "@/pages/ReadingPage";
import SportsPage from "@/pages/SportsPage";
import MlbPage from "@/pages/MlbPage";
import RuwtPage from "@/pages/RuwtPage";
import CardinalsProspectsPage from "@/pages/CardinalsProspectsPage";
import TagPlayersPage from "@/pages/TagPlayersPage";
import MlbPlayerPage from "@/pages/MlbPlayerPage";
import MlbGamePage from "@/pages/MlbGamePage";
import MlbManagersPage from "@/pages/MlbManagersPage";
import MlbManagerPage from "@/pages/MlbManagerPage";
import HotSeatPage from "@/pages/HotSeatPage";
import GolferPage from "@/pages/GolferPage";
import NflPage from "@/pages/NflPage";
import NflGamePage from "@/pages/NflGamePage";
import NflPlayerPage from "@/pages/NflPlayerPage";
import NflTeamPage from "@/pages/NflTeamPage";
import NflCoachPage from "@/pages/NflCoachPage";
import RssPage from "@/pages/RssPage";
import PublicStoryPage from "@/pages/PublicStoryPage";
import BuenaVistaNotebookPage from "@/pages/BuenaVistaNotebookPage";
import { homePath, markReadingSolo, safeNextPath } from "@/lib/reading-home";
import { markSportsSolo } from "@/lib/sports-home";
import { markRssSolo } from "@/lib/rss-home";

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
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="label-caps animate-pulse">Loading</span>
      </div>
    );
  }

  if (!session) {
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
            <Route element={<Protected />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/todos" element={<TodosPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/reading" element={<ReadingPage />} />
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
              <Route path="/rss" element={<RssPage />} />
              <Route path="/notebook/:slug" element={<BuenaVistaNotebookPage />} />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
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
