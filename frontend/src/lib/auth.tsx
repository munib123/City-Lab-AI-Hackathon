import React, { createContext, useContext, useEffect, useState } from "react";

import { DEMO_REPORTS } from "@/data/demo-reports";
import { buildDemoAccounts, restoreUser, type AppUser } from "@/lib/accounts";

export type User = AppUser;

/**
 * The demo accounts: one per patient (14), built from the reports so each account's patient id is exactly the one
 * written on that patient's reports. An account sees its own reports and no one else's (see lib/accounts.ts).
 */
export const DEMO_ACCOUNTS = buildDemoAccounts(DEMO_REPORTS);
export const PRESET_USERS: User[] = DEMO_ACCOUNTS;

/** Who is signed in when nothing valid was saved: the first demo account (a guest with no reports if there were none). */
const DEFAULT_ACCOUNT: User = DEMO_ACCOUNTS[0] ?? {
  id: "guest",
  name: "Guest",
  email: "guest@demo.citylab",
  patientId: "CLD-GUEST-0000",
  provider: "demo",
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loginWithGoogle: (email?: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (name: string, email: string, pass: string, sex?: "Male" | "Female") => Promise<void>;
  logout: () => void;
  switchUser: (patientId: string) => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "citylab_auth_user_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Default to the first demo account, or restore the saved one. The saved copy is validated and rebuilt, so an old
  // or edited entry in the browser cannot carry a stale patient id or claim another patient's reports.
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return DEFAULT_ACCOUNT;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const restored = restoreUser(JSON.parse(stored), DEMO_ACCOUNTS);
        if (restored) return restored;
      }
    } catch {
      // fallback
    }
    return DEFAULT_ACCOUNT;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } catch {
        // storage disabled
      }
    } else {
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        // storage disabled
      }
    }
  }, [user]);

  const loginWithGoogle = async (email?: string) => {
    // Google sign-in simulation. Without an address it opens the first demo account.
    if (!email) {
      setUser(DEFAULT_ACCOUNT);
      setIsAuthModalOpen(false);
      return;
    }
    const matched = DEMO_ACCOUNTS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || {
      id: `user-${Date.now()}`,
      name: (email.split("@")[0] ?? email).replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      email,
      patientId: `CLD-G${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
      provider: "google" as const,
      biologicalSex: "Female" as const,
    };
    setUser(matched);
    setIsAuthModalOpen(false);
  };

  const loginWithEmail = async (email: string, _pass: string) => {
    const matched = DEMO_ACCOUNTS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || {
      id: `user-${Date.now()}`,
      name: (email.split("@")[0] ?? email).replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      email,
      patientId: `CLD-E${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
      provider: "email" as const,
      biologicalSex: "Male" as const,
    };
    setUser(matched);
    setIsAuthModalOpen(false);
  };

  const signupWithEmail = async (name: string, email: string, _pass: string, sex?: "Male" | "Female") => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: name.trim() || "New Patient",
      email: email.trim(),
      patientId: `CLD-U${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
      provider: "email",
    };
    if (sex) newUser.biologicalSex = sex;
    setUser(newUser);
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
  };

  const switchUser = (patientId: string) => {
    const found = DEMO_ACCOUNTS.find((u) => u.patientId === patientId);
    if (found) {
      setUser(found);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        logout,
        switchUser,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
