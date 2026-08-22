"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, MailQuestion } from "lucide-react";

import API from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response: any = await API.requestPasswordReset(email.trim());
    if (response.status === "success") {
      setMessage(response.message || "如果這個信箱有對應的可信帳號，重設密碼信已寄出");
    } else {
      setError(response.message || response.detail || "請求失敗，請稍後再試");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md">
        <Link href="/reibi-login" className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> 返回登入
        </Link>
        <section className="rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-teal-500/15 p-3 text-teal-300"><MailQuestion className="h-7 w-7" /></div>
            <div>
              <h1 className="text-xl font-black">忘記密碼</h1>
              <p className="mt-1 text-xs leading-5 text-slate-400">輸入受邀帳號的 Email，我們會寄送重設密碼連結。</p>
            </div>
          </div>

          {message ? (
            <div className="mt-7 flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0" />{message}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-xs font-bold text-slate-300">Email
                <input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-teal-500" />
              </label>
              {error && <div className="rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-xs text-red-200">{error}</div>}
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-black text-white hover:bg-teal-500 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailQuestion className="h-4 w-4" />}
                寄送重設連結
              </button>
            </form>
          )}
          <p className="mt-5 text-[11px] leading-5 text-slate-500">單位通行碼（PIN）登入不受影響，此頁僅適用於受邀的 Email 帳號。</p>
        </section>
      </div>
    </main>
  );
}
