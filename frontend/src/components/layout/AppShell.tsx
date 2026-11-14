import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { SidebarNav } from "./SidebarNav";
import { TopNavigation } from "./TopNavigation";
import { useSettings } from "@/lib/settings";

export function AppShell({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("text-large", settings.largerText);
    html.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings.largerText, settings.reduceMotion]);

  return (
    <div className="min-h-screen surface-ambient">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-sidebar-border bg-sidebar p-5 backdrop-blur-xl lg:block">
        <SidebarNav />
      </aside>
      <div className="lg:pl-[248px]">
        <TopNavigation />
        {/* key on pathname gives each page a soft entrance transition */}
        <main key={pathname} className="animate-fade-up px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
