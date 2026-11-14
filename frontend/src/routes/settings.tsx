import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useSettings, type AppSettings } from "@/lib/settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LabSense AI" },
      { name: "description", content: "Adjust text size, motion and how results open in LabSense AI." },
      { property: "og:title", content: "Settings — LabSense AI" },
      { property: "og:description", content: "Adjust text size, motion and how results open in LabSense AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const OPTIONS: { key: keyof AppSettings; title: string; body: string }[] = [
  { key: "largerText", title: "Larger text", body: "Increase the text size across the app." },
  { key: "reduceMotion", title: "Reduce motion", body: "Turn off floating and flowing animations." },
  { key: "expandFlaggedByDefault", title: "Open flagged results automatically", body: "Show the explanation for urgent, high and low results as soon as a report opens." },
];

function SettingsPage() {
  const { user } = useAuth();
  const { settings, update, reset } = useSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="eyebrow text-primary">Preferences</p>
        <h2 className="mt-2 font-display text-4xl font-light">Settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">Saved in this browser only.</p>
      </div>

      <section className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
        {OPTIONS.map((o) => (
          <label key={o.key} className="flex cursor-pointer items-center justify-between gap-6 px-6 py-5">
            <span>
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-muted-foreground">{o.body}</span>
            </span>
            <Switch checked={settings[o.key]} onCheckedChange={(v) => update({ [o.key]: v })} />
          </label>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-soft">
        <h3 className="font-display text-lg font-semibold">Profile</h3>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd className="font-semibold">{user?.name ?? "Not signed in"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Patient ID</dt>
            <dd className="font-semibold num">{user?.patientId ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Data</dt>
            <dd className="font-semibold">Fictional demo data</dd>
          </div>
        </dl>
      </section>

      <Button
        variant="outline"
        onClick={() => {
          reset();
          toast.success("Settings restored to defaults");
        }}
      >
        Restore defaults
      </Button>
    </div>
  );
}
