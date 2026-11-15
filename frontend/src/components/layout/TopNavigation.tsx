import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Lock, LogIn, LogOut, Menu, PanelLeft, Search, ShieldCheck, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { SidebarNav } from "./SidebarNav";
import { pageTitle } from "./nav-items";
import { cn } from "@/lib/utils";
import { DEMO_REPORTS } from "@/data/demo-reports";
import type { LabReport } from "@/data/types";
import { reportsForPatient, shortReportId } from "@/lib/accounts";
import { analyzeReport, countStatuses } from "@/lib/analysis";
import { DEMO_ACCOUNTS, useAuth } from "@/lib/auth";

type Notification = { id: number; title: string; body: string; reportId: string | null };

/** Notifications come only from the signed-in account's own reports. */
function buildNotifications(reports: LabReport[]): Notification[] {
  const items: Notification[] = [];
  const report = reports[0];
  if (report) {
    items.push({ id: 1, title: "Analysis ready", body: `${report.name} has been explained.`, reportId: report.id });
    const urgent = countStatuses(analyzeReport(report)).urgent;
    if (urgent > 0) {
      items.push({
        id: 2,
        title: `${urgent} urgent value${urgent === 1 ? "" : "s"} identified`,
        body: "Review the highlighted result and contact a professional.",
        reportId: report.id,
      });
    }
  }
  items.push({ id: 3, title: "Glossary updated", body: "Plain-language entries for liver tests were added.", reportId: null });
  return items;
}

export function TopNavigation({
  sidebarHidden = false,
  onToggleSidebar,
}: {
  sidebarHidden?: boolean;
  onToggleSidebar?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [readKeys, setReadKeys] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, openAuthModal, logout, switchUser } = useAuth();
  const notifications = buildNotifications(reportsForPatient(DEMO_REPORTS, user?.patientId));
  const keyOf = (n: Notification) => `${user?.id ?? "guest"}:${n.id}`;
  const unread = notifications.filter((n) => !readKeys.includes(keyOf(n))).map((n) => n.id);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate({ to: "/glossary", search: q ? { q } : {} });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg border bg-card lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden h-9 w-9 place-items-center rounded-lg border bg-card transition-colors hover:bg-accent lg:grid"
            aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
            aria-pressed={sidebarHidden}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-[290px] bg-card p-5">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          <Link to="/" className="lg:hidden">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>
          <h1 className="hidden truncate font-display text-lg font-semibold lg:block">{pageTitle(pathname)}</h1>
        </div>

        <form onSubmit={onSearch} className="relative hidden md:block" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a test, e.g. ALT"
            aria-label="Search the medical glossary"
            className="h-9 w-64 rounded-full border bg-card pl-9 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:w-72 focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </form>

        <span className="hidden items-center gap-1.5 rounded-full border border-normal/50 bg-normal-soft px-3 py-1.5 text-xs font-semibold text-normal-ink sm:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" />
          Strict Privacy Guardrail
        </span>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative grid h-9 w-9 place-items-center rounded-full border bg-card transition-colors hover:bg-accent"
              aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
            >
              <Bell className="h-4 w-4" />
              {unread.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-urgent ring-2 ring-card" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-xl p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
              <button
                type="button"
                className="text-xs font-semibold text-primary disabled:text-muted-foreground"
                disabled={unread.length === 0}
                onClick={() => setReadKeys(notifications.map(keyOf))}
              >
                Mark all read
              </button>
            </div>
            <ul className="max-h-80 overflow-auto py-1">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    {...(n.reportId
                      ? { to: "/reports/$reportId" as const, params: { reportId: n.reportId } }
                      : { to: "/glossary" as const, search: {} })}
                    onClick={() => setReadKeys((k) => [...k, keyOf(n)])}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", unread.includes(n.id) ? "bg-primary" : "bg-border")} />
                    <span>
                      <span className="block text-sm font-semibold">{n.title}</span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        {/* User Account / Sign In */}
        {user ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50"
                aria-label="User Account"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-xs font-bold text-white">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div className="hidden sm:block">
                  <span className="block text-xs font-bold leading-tight text-navy">{user.name}</span>
                  <span className="block text-[10px] text-slate-500 font-mono leading-none">{user.patientId}</span>
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 rounded-2xl p-4 shadow-lg border border-slate-200">
              <div className="space-y-1 pb-3 border-b border-slate-100">
                <p className="text-xs font-bold text-navy">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                <div className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 font-semibold">
                  Patient ID: {user.patientId}
                </div>
              </div>
              <div className="py-3 border-b border-slate-100">
                <label htmlFor="demo-account" className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Demo account
                </label>
                <select
                  id="demo-account"
                  value={user.provider === "demo" ? user.patientId : ""}
                  onChange={(e) => e.target.value && switchUser(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                >
                  {user.provider !== "demo" && <option value="">Not a demo account</option>}
                  {DEMO_ACCOUNTS.map((a) => (
                    <option key={a.id} value={a.patientId}>
                      {a.name} ({shortReportId(a)})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">Each demo account sees only its own reports.</p>
              </div>
              <div className="pt-2 space-y-1">
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <User className="h-3.5 w-3.5 text-primary" />
                  Sign in / create account
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="flex items-center gap-1.5 rounded-full bg-navy px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-navy-2"
          >
            <LogIn className="h-3.5 w-3.5 text-cyan-300" />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
