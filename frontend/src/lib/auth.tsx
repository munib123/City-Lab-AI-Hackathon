import React, { createContext, useContext, useEffect, useState } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  patientId: string;
  provider: "google" | "email";
  avatar?: string;
  dateOfBirth?: string;
  biologicalSex?: "Male" | "Female";
}

export const PRESET_USERS: User[] = [
  {
    id: "user-alice",
    name: "Alice Smith",
    email: "alice.smith@gmail.com",
    patientId: "CLD-P001-9942",
    provider: "google",
    biologicalSex: "Female",
    dateOfBirth: "1994-06-12",
  },
  {
    id: "user-bob",
    name: "Bob Jones",
    email: "bob.jones@outlook.com",
    patientId: "CLD-P002-8821",
    provider: "email",
    biologicalSex: "Male",
    dateOfBirth: "1982-11-04",
  },
  {
    id: "user-charlie",
    name: "Charlie Brown",
    email: "charlie.b@gmail.com",
    patientId: "CLD-P003-7714",
    provider: "google",
    biologicalSex: undefined, // Missing demographics test case
  },
];

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
  // Default to Alice Smith as verified initial patient, or load from local storage
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return PRESET_USERS[0];
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return PRESET_USERS[0];
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
    // Realistic Google OAuth simulation
    const targetEmail = email || "alice.smith@gmail.com";
    const matched = PRESET_USERS.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase()) || {
      id: `user-${Date.now()}`,
      name: targetEmail.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      email: targetEmail,
      patientId: `CLD-G${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
      provider: "google" as const,
      biologicalSex: "Female" as const,
    };
    setUser(matched);
    setIsAuthModalOpen(false);
  };

  const loginWithEmail = async (email: string, _pass: string) => {
    const matched = PRESET_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || {
      id: `user-${Date.now()}`,
      name: email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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
      biologicalSex: sex,
    };
    setUser(newUser);
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
  };

  const switchUser = (patientId: string) => {
    const found = PRESET_USERS.find((u) => u.patientId === patientId);
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
