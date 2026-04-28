// components/AuthProvider.tsx
"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { DB, ZeroTrust, AuditLog, clearCryptoKey } from "@/lib/store";
import { useRouter } from "next/navigation";
import API from "@/lib/api";

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [useBackend, setUseBackend] = useState(false); // 是否使用后端
  const router = useRouter();

  useEffect(() => {
    // 首先尝试从后端会话加载
    const backendSession = API.getSession();
    if (backendSession) {
      setSession({
        id: backendSession.user_id,
        systemRole: backendSession.role || "individual",
        name: `${backendSession.platform} 用户`,
        apiSession: backendSession,
        platform: backendSession.platform
      });
      setUseBackend(true);
      setLoading(false);
      return;
    }

    // 然后尝试从本地存储加载
    DB.loadSession().then(s => {
      if (s?.systemRole) {
        setSession(s);
        setUseBackend(false);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    const check = setInterval(() => {
      if (session && ZeroTrust.isExpired()) {
        logout();
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
    // 确定是否使用后端
    const isBackendLogin = s.apiSession !== undefined;
    
    setSession(s);
    setUseBackend(isBackendLogin);
    ZeroTrust.touch();
    AuditLog.record('LOGIN', `login via ${isBackendLogin ? 'backend' : 'local'}`, s.systemRole);
    router.push("/dashboard");
  };

  const logout = async () => {
    // 如果使用后端，同时注销后端
    if (useBackend && session?.apiSession) {
      await API.logout();
    }
    
    await DB.clearSession();
    clearCryptoKey();
    AuditLog.record('LOGOUT', 'user logged out', session?.systemRole || '');
    setSession(null);
    setUseBackend(false);
    router.push("/login");
  };

  const switchPlatform = async (toPlatform: 'schumann' | 'sleep') => {
    if (!useBackend || !session?.apiSession) {
      console.error("平台切换仅在后端模式下可用");
      return false;
    }

    try {
      const result = await API.switchPlatform(toPlatform);
      if (result.status === 'success') {
        const newSession = {
          id: session.id,
          systemRole: result.data.session.role || toPlatform,
          name: session.name,
          apiSession: result.data.session,
          platform: toPlatform
        };
        setSession(newSession);
        AuditLog.record('PLATFORM_SWITCH', `switched to ${toPlatform}`, session?.systemRole);
        return true;
      }
    } catch (error) {
      console.error("平台切换失败:", error);
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ session, login, logout, loading, useBackend, switchPlatform }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);