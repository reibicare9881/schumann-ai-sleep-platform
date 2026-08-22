"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

export default function ReibiInternalLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response: any = await API.accountLogin(email, password, totpCode);
    if (response.status === "success") {
      const apiSession = API.getSession();
      await login({
        id: apiSession?.user_id,
        uid: apiSession?.user_id,
        name: apiSession?.name,
        systemRole: apiSession?.role,
        orgCode: apiSession?.org_code,
        dept: apiSession?.dept,
        platform: "sleep",
        apiSession,
      });
    } else {
      setError(response.message || response.detail || "登入失敗");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> 返回一般登入
        </Link>
        <section className="rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-teal-500/15 p-3 text-teal-300"><ShieldCheck className="h-7 w-7" /></div>
            <div>
              <h1 className="text-xl font-black">SleepM／REIBI 帳號登入</h1>
              <p className="mt-1 text-xs leading-5 text-slate-400">使用受邀的 Supabase Auth 帳號登入；角色、企業、部門及經銷商範圍均由伺服器核定。</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-bold text-slate-300">Email
              <input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-teal-500" />
            </label>
            <label className="block text-xs font-bold text-slate-300">密碼
              <input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-teal-500" />
            </label>
            <label className="block text-xs font-bold text-slate-300">MFA 驗證碼（帳號有啟用時必填）
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={totpCode} onChange={event => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm tracking-[0.35em] outline-none focus:border-teal-500" />
            </label>
            {error && <div className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-xs text-red-200">{error}</div>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-black text-white hover:bg-teal-500 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              安全登入
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/reibi-login/forgot-password" className="text-xs font-bold text-slate-400 hover:text-slate-200">忘記密碼？</Link>
          </div>
          <p className="mt-5 text-[11px] leading-5 text-slate-500">工作階段 30 分鐘後自動失效；登出或後台撤銷後立即失效。瀏覽器不會取得 Supabase service-role 或 refresh token。</p>
        </section>
      </div>
    </main>
  );
}
