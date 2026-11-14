import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Lock, Menu, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/Logo";
import { SidebarNav } from "./SidebarNav";
import { pageTitle } from "./nav-items";
import { cn } from "@/lib/utils";
import { SAMPLE_REPORT_ID } from "@/data/demo-reports";

const INITIAL_NOTIFICATIONS = [
  { id: 1, title: "Analysis ready", body: "Complete Blood Count & Metabolic Panel has been explained.", reportId: SAMPLE_REPORT_ID },
  { id: 2, title: "1 urgent value identified", body: "Review the highlighted result and contact a professional.", reportId: SAMPLE_REPORT_ID },
  { id: 3, title: "Glossary updated", body: "Plain-language entries for liver tests were added.", reportId: null },
] as const;

export function TopNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [unread, setUnread] = useState<number[]>(INITIAL_NOTIFICATIONS.map((n) => n.id));
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Lock className="h-3 w-3" />
          Private session
        </span>

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
                onClick={() => setUnread([])}
              >
                Mark all read
              </button>
            </div>
            <ul className="max-h-80 overflow-auto py-1">
              {INITIAL_NOTIFICATIONS.map((n) => (
                <li key={n.id}>
                  <Link
                    {...(n.reportId
                      ? { to: "/reports/$reportId" as const, params: { reportId: n.reportId } }
                      : { to: "/glossary" as const, search: {} })}
                    onClick={() => setUnread((u) => u.filter((x) => x !== n.id))}
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

        <Link
          to="/settings"
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-bold text-primary-foreground"
          aria-label="Profile and settings"
        >
          DP
        </Link>
      </div>
    </header>
  );
}
