// components/AuthProvider.tsx
"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { DB, ZeroTrust, AuditLog, clearCryptoKey } from "@/lib/store";
import { useRouter } from "next/navigation";

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    DB.loadSession().then(s => {
      if (s?.systemRole) {
        setSession(s);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    const check = setInterval(() => {
      if (session && ZeroTrust.isExpired()) {
        DB.clearSession(); clearCryptoKey();
        AuditLog.record("SESSION_TIMEOUT", "auto-logout", session?.systemRole || "");
        setSession(null);
        router.push("/login");
      }
    }, 60000);
    const touch = () => ZeroTrust.touch();
    window.addEventListener("mousemove", touch);
    window.addEventListener("keydown", touch);
    return () => {
      clearInterval(check);
      window.removeEventListener("mousemove", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [session, router]);

  const login = async (s: any) => {
    setSession(s);
    ZeroTrust.touch();
    AuditLog.record('LOGIN', 'login', s.systemRole);
    router.push("/dashboard");
  };

  const logout = async () => {
    await DB.clearSession();
    clearCryptoKey();
    AuditLog.record('LOGOUT', 'user logged out', session?.systemRole || '');
    setSession(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ session, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);