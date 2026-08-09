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
import MlbPlayerPage from "@/pages/MlbPlayerPage";
import { homePath, markReadingSolo, safeNextPath } from "@/lib/reading-home";
import { markSportsSolo } from "@/lib/sports-home";

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
  } else {
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
            <Route element={<Protected />}>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/todos" element={<TodosPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/reading" element={<ReadingPage />} />
              <Route path="/sports" element={<SportsPage />} />
              <Route path="/sports/mlb" element={<MlbPage />} />
              <Route path="/sports/mlb/player/:playerId" element={<MlbPlayerPage />} />
            </Route>
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
        </CelebrationProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-panel)",
              color: "var(--color-cream)",
              border: "1px solid rgba(217,81,92,0.3)",
              borderRadius: "3px",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
