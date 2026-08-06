import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/components/layout/AppShell";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TodosPage from "@/pages/TodosPage";
import HabitsPage from "@/pages/HabitsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
});

function Protected() {
  const { session, loading } = useAuth();

  // Render nothing while the stored session resolves, otherwise a refresh
  // flashes the login screen before landing back on the dashboard.
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <span className="label-caps animate-pulse">Loading</span>
      </div>
    );
  }

  return session ? <AppShell /> : <Navigate to="/login" replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/todos" element={<TodosPage />} />
              <Route path="/habits" element={<HabitsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-panel)",
              color: "var(--color-cream)",
              border: "1px solid var(--color-line)",
              borderRadius: "2px",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
