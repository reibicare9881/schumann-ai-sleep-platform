"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type MfaSetup = {
  already_enrolled?: boolean;
  factor_id: string;
  qr_code?: string;
  secret?: string;
};

export default function ReibiMfaPage() {
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const enroll = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response: any = await API.enrollCurrentIdentityMfa(password);
    const data = response.data as MfaSetup | undefined;
    if (response.status === "success" && data?.factor_id) {
      setSetup(data);
    } else {
      setError(response.message || response.detail || "無法開始 MFA 設定");
    }
    setLoading(false);
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!setup) return;
    setLoading(true);
    setError("");
    const response: any = await API.verifyCurrentIdentityMfa(password, setup.factor_id, code);
    if (response.status === "success" && response.data?.aal === "aal2") {
      API.clearSession();
      setPassword("");
      setCode("");
      setComplete(true);
    } else {
      setError(response.message || response.detail || "MFA 驗證失敗");
    }
    setLoading(false);
  };

  if (!session) return null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-teal-500/15 p-3 text-teal-300"><ShieldCheck className="h-7 w-7" /></div>
          <div>
            <h1 className="text-xl font-black">設定 MFA 雙重驗證</h1>
            <p className="mt-1 text-xs leading-5 text-slate-400">目前帳號：{session.name}。完成後會撤銷現有工作階段，下一次登入必須輸入驗證器 App 的六位數代碼。</p>
          </div>
        </div>

        {complete ? (
          <div className="mt-7">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-800 bg-emerald-950/70 px-4 py-4 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div><div className="font-black">MFA 已啟用</div><p className="mt-1 text-xs leading-5">TOTP factor 已驗證，舊 AAL1 工作階段已撤銷。請重新登入並輸入新的六位數驗證碼。</p></div>
            </div>
            <button type="button" onClick={() => window.location.assign("/reibi-login")} className="mt-5 w-full rounded-xl bg-teal-600 px-4 py-3 font-black hover:bg-teal-500">前往重新登入</button>
          </div>
        ) : setup ? (
          <form onSubmit={verify} className="mt-7 space-y-4">
            {setup.already_enrolled ? (
              <div className="rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-300">這個帳號已有已驗證的 TOTP factor。請直接輸入驗證器 App 目前顯示的六位數代碼，以正式要求 MFA。</div>
            ) : (
              <div className="rounded-xl bg-slate-950 p-4 text-center">
                <p className="text-xs leading-5 text-slate-300">使用 Google Authenticator、Microsoft Authenticator 或其他 TOTP App 掃描 QR Code。</p>
                {setup.qr_code && <img src={setup.qr_code} alt="TOTP QR code" className="mx-auto mt-4 h-52 w-52 rounded-lg bg-white p-2" />}
                {setup.secret && <details className="mt-3 text-left text-xs text-slate-400"><summary className="cursor-pointer">無法掃描時顯示設定密鑰</summary><code className="mt-2 block break-all rounded bg-slate-900 p-2 text-slate-200">{setup.secret}</code></details>}
              </div>
            )}
            <label className="block text-xs font-bold text-slate-300">六位驗證碼
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center tracking-[0.35em] outline-none focus:border-teal-500" />
            </label>
            {error && <div className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-xs text-red-200">{error}</div>}
            <button disabled={loading || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-black disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />}驗證並啟用 MFA</button>
          </form>
        ) : (
          <form onSubmit={enroll} className="mt-7 space-y-4">
            <div className="rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-xs leading-5 text-amber-100">請先準備驗證器 App。系統不會在完成六位數驗證前開啟 <code>mfa_required</code>。</div>
            <label className="block text-xs font-bold text-slate-300">再次輸入目前密碼
              <input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-teal-500" />
            </label>
            {error && <div className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-xs text-red-200">{error}</div>}
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-black disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}開始設定 MFA</button>
            <Link href="/reibi" className="block text-center text-xs font-bold text-slate-400 hover:text-white">暫時取消，返回 REIBI 管理中心</Link>
          </form>
        )}
      </section>
    </main>
  );
}
