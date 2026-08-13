"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";

import API from "@/lib/api";

export default function CompleteInvitePage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<any>(null);
  const [mfaEmail, setMfaEmail] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setAccessToken(hash.get("access_token") || "");
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!accessToken) {
      setError("邀請連結缺少驗證資訊，請要求管理者重新寄送邀請。");
      return;
    }
    if (password.length < 12) {
      setError("密碼至少需要 12 個字元。");
      return;
    }
    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致。");
      return;
    }
    setLoading(true);
    const response: any = await API.completeIdentityInvite(accessToken, password);
    if (response.status === "success") {
      const setup = response.data?.mfa_setup;
      if (setup && !setup.already_enrolled) {
        setMfaSetup(setup);
        setMfaEmail(response.data?.email || "");
      } else setMessage(setup?.already_enrolled ? "密碼設定完成，MFA 已經啟用。" : (response.message || "密碼設定完成"));
    }
    else setError(response.message || response.detail || "無法完成邀請");
    setLoading(false);
  };

  const verifyMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError("");
    const response: any = await API.verifyIdentityMfa(mfaEmail, password, mfaSetup.factor_id, mfaCode);
    if (response.status === "success") { setMfaSetup(null); setMessage(response.message || "MFA 設定完成"); }
    else setError(response.message || response.detail || "MFA 驗證失敗");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <section className="mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-teal-500/15 p-3 text-teal-300"><KeyRound className="h-6 w-6" /></div>
          <div><h1 className="text-xl font-black">完成帳號邀請</h1><p className="mt-1 text-xs text-slate-400">設定密碼後即可使用可信帳號登入。</p></div>
        </div>
        {message ? (
          <div className="mt-7">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5" />{message}</div>
            <Link href="/reibi-login" className="mt-4 block rounded-xl bg-teal-600 px-4 py-3 text-center font-black">前往登入</Link>
          </div>
        ) : mfaSetup ? (
          <form onSubmit={verifyMfa} className="mt-7 space-y-4">
            <div className="rounded-xl bg-slate-950 p-4 text-center">
              <p className="text-xs text-slate-300">請用驗證器 App 掃描 QR code，再輸入六位驗證碼。</p>
              {mfaSetup.qr_code && <img src={mfaSetup.qr_code} alt="TOTP QR code" className="mx-auto mt-4 h-48 w-48 rounded-lg bg-white p-2" />}
              <details className="mt-3 text-left text-xs text-slate-400"><summary className="cursor-pointer">無法掃描時顯示設定密鑰</summary><code className="mt-2 block break-all rounded bg-slate-900 p-2 text-slate-200">{mfaSetup.secret}</code></details>
            </div>
            <label className="block text-xs font-bold text-slate-300">六位驗證碼<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center tracking-[0.35em] outline-none focus:border-teal-500" /></label>
            {error && <div className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-xs text-red-200">{error}</div>}
            <button disabled={loading || mfaCode.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-black disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />}完成 MFA 設定</button>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-bold text-slate-300">新密碼（至少 12 字元）<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-teal-500" /></label>
            <label className="block text-xs font-bold text-slate-300">再次輸入新密碼<input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-teal-500" /></label>
            {error && <div className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-xs text-red-200">{error}</div>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-black disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />}設定密碼</button>
          </form>
        )}
      </section>
    </main>
  );
}
