import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, ShieldCheck, User } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { NAV_ITEMS } from "./nav-items";
import { useAuth } from "@/lib/auth";

/** Navigation list + footer, shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, openAuthModal, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <Link to="/" onClick={onNavigate} className="px-3 pt-1 pb-8">
        <Logo />
      </Link>

      <p className="eyebrow px-3 pb-3 text-muted-foreground">Workspace</p>
      <nav className="flex flex-col gap-1" aria-label="Main">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact, includeSearch: false }}
            className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-navy data-[status=active]:text-navy-foreground data-[status=active]:shadow-soft"
          >
            <Icon className="h-[18px] w-[18px] transition-transform group-hover:scale-105" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-3 pt-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-navy">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Patient Data Isolation
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {user
              ? `Strictly scoped to ${user.name} (${user.patientId}). Access to other patients is blocked.`
              : "Sign in to access your personal laboratory records."}
          </p>
        </div>

        {user ? (
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-navy text-xs font-bold text-white shrink-0">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-navy leading-tight">{user.name}</p>
                <p className="truncate text-[10px] text-slate-500 font-mono">{user.patientId}</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
              <button
                type="button"
                onClick={openAuthModal}
                className="font-semibold text-primary hover:underline"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1 text-slate-400 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3 w-3" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-3 py-2.5 text-xs font-semibold text-white shadow-soft transition-all hover:bg-navy-2"
          >
            <LogIn className="h-4 w-4 text-cyan-300" />
            Sign In / Register
          </button>
        )}
      </div>
    </div>
  );
}
