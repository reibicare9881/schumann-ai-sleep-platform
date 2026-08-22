"use client";

/**
 * 個人訂閱（移植自 Artifact 主平台的 SubscribeScreen）。
 *
 * 只有個人用戶會看到內容：企業員工的功能由公司合約涵蓋，後端回 gated=false，
 * 這裡直接告訴他們不需要訂閱，而不是讓他們對著一個買不到也不必買的頁面。
 *
 * 付款維持 Artifact 的人工審核制：送出申請 → 以 LINE／Email 提供付款證明 →
 * 客服核准並核發一次性啟用碼 → 使用者在這裡輸入啟用碼完成啟用。
 * 頁面上沒有金額，因為價格是個案議定的，程式裡從來沒有這個數字。
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Loader2, Star, KeyRound, RefreshCw } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type Row = Record<string, any>;

const PLANS: Array<[string, string, string]> = [
  ["monthly", "月繳體驗", "先試一個月"],
  ["quarterly", "季繳方案", "三個月"],
  ["annual", "年繳方案", "最優惠"],
];

const STATUS_TEXT: Record<string, string> = {
  待審核: "審核中，客服確認付款後將核發啟用碼",
  已核准: "訂閱中",
  已拒絕: "申請未通過，請洽客服",
  已到期: "已到期，已自動降級為免費版（歷史資料完整保留）",
};

export default function SubscribePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [page, setPage] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState("monthly");
  const [contact, setContact] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [activationCode, setActivationCode] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response: any = await API.getReibiSubscription();
    if (response.status === "success") setPage(response.data);
    else setError(response.message || response.detail || "無法讀取訂閱狀態");
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (loading || !session) return null;

  const access = page?.access || {};
  const status: string | null = access.status || null;

  const run = async (action: () => Promise<any>, success: string) => {
    setBusy(true); setError(""); setMessage("");
    const response: any = await action();
    if (response.status === "success") { setMessage(success); await load(); }
    else setError(response.message || response.detail || "操作失敗");
    setBusy(false);
  };

  const apply = () => {
    if (!agreed) { setError("請先閱讀並勾選同意訂閱服務條款"); return; }
    if (!contact.trim()) { setError("請填寫聯絡方式，客服需要據此與您確認付款"); return; }
    void run(
      () => API.applyReibiSubscription({ plan_code: plan, contact: contact.trim(), agreed_terms_version: page!.terms_version }),
      "申請已送出。請透過 LINE 或 Email 提供付款證明，客服將於 1-2 個工作日內確認。",
    );
  };

  const activate = () => {
    if (!activationCode.trim()) { setError("請輸入客服提供的啟用碼"); return; }
    void run(() => API.activateReibiSubscription(activationCode.trim()), "訂閱已啟用，完整功能已開通。");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button onClick={() => router.push("/dashboard")} className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ChevronLeft className="h-4 w-4" /> 返回主選單
      </button>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Star className="h-6 w-6 text-amber-500" /> 個人訂閱
        </h1>
        <button onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> 重新整理
        </button>
      </div>

      {(error || message) && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      {!page ? <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        : access.gated === false ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-8 text-center">
            <div className="text-lg font-black text-teal-900">您的單位合約已涵蓋完整功能</div>
            <p className="mt-2 text-sm text-teal-800">{access.reason}　個人訂閱僅適用於自行註冊的個人用戶，您不需要另外訂閱。</p>
            <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">返回主選單</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 目前狀態 */}
            <section className={`rounded-2xl border p-5 ${access.is_pro ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">目前狀態</div>
                  <div className={`mt-1 text-lg font-black ${access.is_pro ? "text-emerald-800" : "text-slate-700"}`}>
                    {access.is_pro ? "⭐ 訂閱版" : status ? STATUS_TEXT[status] || status : "免費版"}
                  </div>
                  {access.plan_label && <div className="mt-1 text-sm text-slate-600">{access.plan_label}</div>}
                  {access.member_code && <div className="mt-1 font-mono text-xs text-slate-400">會員碼 {access.member_code}</div>}
                </div>
                {access.expires_at && (
                  <div className="text-right text-sm">
                    <div className="text-xs text-slate-400">到期日</div>
                    <div className="font-bold text-slate-700">{String(access.expires_at).slice(0, 10)}</div>
                  </div>
                )}
              </div>
              {access.expiring_soon && (
                <div className="mt-3 rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                  ⏰ 訂閱將於 {access.days_left} 天後到期。到期後自動降級為免費版，歷史資料完整保留。
                </div>
              )}
              {status === "已到期" && (
                <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                  您的評估紀錄一筆都沒有刪除。重新訂閱後即可再次查閱完整歷史與 AI 報告。
                </div>
              )}
            </section>

            {/* 功能對照 */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="font-black text-slate-700">免費版</div>
                <ul className="mt-3 space-y-2">
                  {(page.free_features || []).map((item: string) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-5">
                <div className="font-black text-amber-900">⭐ 訂閱版（含免費版全部功能）</div>
                <ul className="mt-3 space-y-2">
                  {(page.pro_features || []).map((item: string) => (
                    <li key={item} className="flex gap-2 text-sm text-amber-900">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 申請 */}
            {!access.is_pro && status !== "待審核" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="font-black text-slate-700">申請訂閱</h2>
                <p className="mt-1 text-xs text-slate-500">採人工審核制。送出後請透過 LINE 或 Email 提供付款證明，費用由客服與您個別確認。</p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {PLANS.map(([code, label, note]) => (
                    <button key={code} onClick={() => setPlan(code)}
                      className={`rounded-xl border p-3 text-left ${plan === code ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}>
                      <div className="font-bold text-slate-700">{label}</div>
                      <div className="text-xs text-slate-500">{note}</div>
                    </button>
                  ))}
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-bold text-slate-500">聯絡方式（Email 或 LINE ID）</span>
                  <input value={contact} onChange={event => setContact(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="客服將以此與您確認付款" />
                </label>

                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-bold text-slate-600">訂閱服務條款（{page.terms_version}）</div>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                    {(page.terms || []).map((term: string) => <li key={term}>{term}</li>)}
                  </ol>
                  <label className="mt-3 flex items-start gap-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" className="mt-1" checked={agreed} onChange={event => setAgreed(event.target.checked)} />
                    我已閱讀並同意上述訂閱服務條款
                  </label>
                </div>

                <button onClick={apply} disabled={busy}
                  className="mt-4 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                  送出訂閱申請
                </button>
              </section>
            )}

            {/* 啟用碼 */}
            {!access.is_pro && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-black text-slate-700"><KeyRound className="h-4 w-4" />輸入啟用碼</h2>
                <p className="mt-1 text-xs text-slate-500">客服確認付款後會提供一組一次性啟用碼，輸入即可開通。</p>
                <div className="mt-3 flex gap-2">
                  <input value={activationCode} onChange={event => setActivationCode(event.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-teal-400"
                    placeholder="RB-…" />
                  <button onClick={activate} disabled={busy}
                    className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">啟用</button>
                </div>
              </section>
            )}
          </div>
        )}
    </div>
  );
}
