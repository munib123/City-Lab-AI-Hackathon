import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { DEMO_PATIENT_ID } from "@/data/demo-reports";
import { NAV_ITEMS } from "./nav-items";

/** Navigation list + footer, shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
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

      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-xl border border-normal/50 bg-normal-soft p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-normal-ink">
            <ShieldCheck className="h-4 w-4" />
            Privacy protected
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Demo files stay in your browser. Only reports for {DEMO_PATIENT_ID} are shown.
          </p>
        </div>
        <Link
          to="/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-accent"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-primary-foreground">
            DP
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">Demo Patient</span>
            <span className="block truncate text-xs text-muted-foreground num">{DEMO_PATIENT_ID}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
