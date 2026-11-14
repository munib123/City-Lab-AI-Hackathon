import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortReportId } from "@/lib/accounts";
import { useAuth, DEMO_ACCOUNTS } from "@/lib/auth";
import { Lock, ShieldCheck, UserCheck, ArrowRight, Mail, Key } from "lucide-react";

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, loginWithGoogle, loginWithEmail, signupWithEmail, switchUser, user } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sex, setSex] = useState<"Male" | "Female">("Female");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    await loginWithGoogle();
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    if (mode === "login") {
      await loginWithEmail(email, password);
    } else {
      await signupWithEmail(name, email, password, sex);
    }
    setLoading(false);
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-slate-200 bg-white">
        {/* Top Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-6 pb-5 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-navy text-white shadow-xs">
            <Lock className="h-5 w-5 text-cyan-300" />
          </div>
          <DialogTitle className="mt-3 font-display text-xl font-bold text-navy">
            {mode === "login" ? "Sign in to CityLab" : "Create Patient Account"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
            Secure, HIPAA-compliant patient portal. Each account has isolated access strictly to its own medical records.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-4">
          {/* Demo accounts: pick a patient; that account sees only its own reports */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-bold text-navy">Choose a demo account</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Each demo account sees only its own reports, so you can check that one patient never sees another's.
            </p>
            <div className="mt-2 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pr-1" role="listbox" aria-label="Demo accounts">
              {DEMO_ACCOUNTS.map((u) => {
                const isActive = user?.patientId === u.patientId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      switchUser(u.patientId);
                      closeAuthModal();
                    }}
                    className={`flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5 text-primary font-bold"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold leading-tight">{u.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{shortReportId(u)}</p>
                    </div>
                    {isActive && <CheckIcon className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-slate-400 shrink-0">
              or sign in
            </span>
          </div>
          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-2.5 rounded-xl shadow-xs"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-slate-400 shrink-0">
              or continue with email
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Full Name</label>
                  <Input
                    type="text"
                    placeholder="e.g. Eleanor Vance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Biological Sex (for Reference Ranges)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Female", "Male"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSex(s)}
                        className={`h-9 rounded-xl border text-xs font-semibold transition-all ${
                          sex === s ? "border-primary bg-primary/5 text-primary" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Email Address</label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <Button type="submit" variant="hero" className="w-full h-10 text-xs font-semibold rounded-xl" disabled={loading}>
              {loading ? "Authenticating..." : mode === "login" ? "Sign In" : "Register Patient Account"}
            </Button>
          </form>

          {/* Toggle Login / Signup */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
              className="text-xs text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
