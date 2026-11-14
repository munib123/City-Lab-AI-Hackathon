import { createFileRoute } from "@tanstack/react-router";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { RecentReports } from "@/components/dashboard/RecentReports";
import { DEMO_REPORTS } from "@/data/demo-reports";
import { reportsForPatient } from "@/lib/accounts";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LabSense AI — Your health results, made understandable" },
      { name: "description", content: "Turn complex lab reports into clear explanations, spot unusual values, and prepare questions for your doctor." },
      { property: "og:title", content: "LabSense AI — Your health results, made understandable" },
      { property: "og:description", content: "Turn complex lab reports into clear explanations, spot unusual values, and prepare questions for your doctor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  // Only the signed-in demo account's own reports (never anyone else's).
  const { user } = useAuth();
  const mine = reportsForPatient(DEMO_REPORTS, user?.patientId);
  const recent = mine.slice(0, 3);
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <DashboardHero />
      <StatsOverview reports={mine} />
      <RecentReports reports={recent} />
    </div>
  );
}
