import { BookOpenText, FileStack, LayoutGrid, Settings, UploadCloud, Workflow } from "lucide-react";

export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/reports", label: "My Reports", icon: FileStack, exact: false },
  { to: "/upload", label: "Upload Report", icon: UploadCloud, exact: true },
  { to: "/glossary", label: "Medical Glossary", icon: BookOpenText, exact: true },
  { to: "/how-it-works", label: "How It Works", icon: Workflow, exact: true },
  { to: "/settings", label: "Settings", icon: Settings, exact: true },
] as const;

export function pageTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/reports/")) return "Report Analysis";
  const item = NAV_ITEMS.find((n) => n.to !== "/" && pathname.startsWith(n.to));
  return item?.label ?? "LabSense AI";
}
