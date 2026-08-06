import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ListChecks, Repeat, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/todos", label: "Todos", icon: ListChecks },
  { to: "/habits", label: "Habits", icon: Repeat },
];

export default function AppShell() {
  const { user, signOut } = useAuth();

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-shell flex items-center justify-between px-5 py-2">
        <div className="flex items-baseline gap-4">
          <h1 className="display text-xl font-bold uppercase tracking-[0.18em] text-white">
            Command Center
          </h1>
          <span className="label-caps hidden sm:inline">{today}</span>
        </div>
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-2 text-chalk hover:text-gold transition-colors text-sm"
          title={user?.email ?? undefined}
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>
      <div className="stripe" />

      <div className="flex flex-1 min-h-0">
        <nav className="bg-shell w-16 md:w-52 shrink-0 py-4 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 md:px-5 py-3 text-sm transition-colors border-l-3",
                  isActive
                    ? "border-gold bg-panel text-cream"
                    : "border-transparent text-chalk hover:text-cream hover:bg-panel/50",
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="hidden md:inline uppercase tracking-wider text-xs font-semibold">
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 min-w-0 p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
