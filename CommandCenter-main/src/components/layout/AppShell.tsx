import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import StarField from "@/components/StarField";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/todos", label: "Todos" },
  { to: "/habits", label: "Habits" },
  { to: "/reading", label: "Reading" },
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
    <div className="flex min-h-screen flex-col">
      <header className="bg-ink relative flex h-[70px] shrink-0 items-center justify-between overflow-hidden px-6 md:px-8">
        <StarField count={26} seed={3} />
        <div className="relative z-10 flex items-center gap-4">
          <span className="flag-mark" />
          <h1 className="font-display text-cream text-[25px] tracking-[0.05em]">
            Command <span className="text-accent">Center</span>
          </h1>
        </div>
        <button
          onClick={() => void signOut()}
          title={user?.email ?? undefined}
          className="label-caps relative z-10 flex items-center gap-2 transition-colors hover:text-cream"
        >
          <span className="hidden sm:inline">{today}</span>
          <LogOut size={14} />
        </button>
      </header>
      <div className="rule-flag" />

      <div className="flex min-h-0 flex-1">
        <nav className="bg-ink w-[68px] shrink-0 border-r border-accent/15 py-5 md:w-[196px]">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "block border-l-2 px-4 py-3 text-[11.5px] uppercase tracking-[0.19em] transition-colors md:px-7",
                  isActive
                    ? "border-accent bg-accent/[0.07] text-cream"
                    : "border-transparent text-chalk hover:text-cream",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
