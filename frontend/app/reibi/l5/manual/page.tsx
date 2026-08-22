"use client";

/**
 * L5 站內操作手冊（移植自 Artifact reibi-l5 的 ManualScreen）。
 *
 * 這一頁不存任何內容 —— 全部向後端要。角色權限表由權限 registry 產生、
 * 分潤比例與升級門檻由計價模組產生，所以改了規則手冊就跟著變。
 * Artifact 的版本是手寫的，結果它描述的分潤規則跟它自己的程式碼是矛盾的。
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type Row = Record<string, any>;

const TABS: Array<[string, string]> = [
  ["roles", "角色說明"],
  ["onboarding", "新案開通"],
  ["settlement", "月結流程"],
  ["commission", "分潤規則"],
  ["faq", "常見問題"],
  ["emergency", "緊急操作"],
];

const TONE: Record<string, string> = {
  danger: "border-rose-400",
  warning: "border-amber-400",
  info: "border-teal-400",
};

const money = (value: any) => `NT$ ${Number(value || 0).toLocaleString("zh-TW")}`;
const wan = (value: any) => `${(Number(value || 0) / 10000).toLocaleString("zh-TW")} 萬`;

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>;
}

export default function ReibiL5ManualPage() {
  const { session, loading } = useAuth();
  const [manual, setManual] = useState<Row | null>(null);
  const [tab, setTab] = useState("roles");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true); setError("");
    const response: any = await API.getReibiL5Manual();
    if (response.status === "success") setManual(response.data);
    else setError(response.message || "無法讀取操作手冊");
    setBusy(false);
  }, []);

  useEffect(() => { if (session) void load(); }, [session, load]);

  if (loading || !session) return null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/reibi/l5" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-teal-700">
            <ArrowLeft className="h-4 w-4" /> 返回 L5 總覽
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
            <BookOpen className="h-6 w-6 text-teal-700" /> 操作手冊
          </h1>
          <p className="mt-1 text-sm text-slate-500">角色權限與分潤規則由系統即時產生，永遠等於實際設定。</p>
        </div>
        <button onClick={() => void load()} disabled={busy}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> 重新整理
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-9 w-9 text-rose-600" />
          <p className="mt-3 text-sm font-bold text-slate-700">{error}</p>
        </div>
      )}

      {!manual && !error && <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>}

      {manual && (
        <>
          <nav className="flex flex-wrap gap-2">
            {TABS.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                {label}
              </button>
            ))}
          </nav>

          {tab === "roles" && (
            <Card>
              <p className="text-xs text-slate-500">{manual.roles.note}</p>
              <div className="mt-4 space-y-3">
                {manual.roles.items.map((role: Row) => (
                  <div key={role.key} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-slate-800">{role.label}</b>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">{role.realm_label}</span>
                      {role.mfa_recommended && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">需 MFA</span>}
                      {role.scopes.map((scope: string) => (
                        <span key={scope} className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">{scope}</span>
                      ))}
                    </div>
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                      {role.permission_labels.map((label: string) => <li key={label}>{label}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{manual.roles.audit_note}</p>
            </Card>
          )}

          {tab === "onboarding" && (
            <div className="space-y-3">
              {manual.onboarding.steps.map((step: Row) => (
                <Card key={step.step}>
                  <div className="font-black text-teal-800">{step.step} — {step.title}</div>
                  <div className="mt-1 text-xs text-slate-500">執行人：{step.owner}</div>
                  <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
                    {step.items.map((item: string) => <li key={item}>{item}</li>)}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          {tab === "settlement" && (
            <Card>
              <div className="space-y-3">
                {manual.settlement.timeline.map((row: Row) => (
                  <div key={row.when} className="flex flex-col gap-1 rounded-xl bg-slate-50 p-4 sm:flex-row sm:gap-4">
                    <div className="w-24 shrink-0 font-black text-teal-700">{row.when}</div>
                    <div>
                      <b className="text-slate-800">{row.title}</b>
                      <p className="mt-1 text-sm text-slate-600">{row.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "commission" && (
            <div className="space-y-4">
              <Card>
                <h2 className="font-black text-slate-800">各層分潤比例</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs text-slate-500">
                        <th className="p-2">層級</th>
                        {manual.commission.layers[0].percentages.map((row: Row) => (
                          <th key={row.level} className="p-2">{row.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {manual.commission.layers.map((layer: Row) => (
                        <tr key={layer.key} className="border-b">
                          <td className="p-2"><b>{layer.label}</b><div className="text-[11px] text-slate-500">{layer.note}</div></td>
                          {layer.percentages.map((row: Row) => <td key={row.level} className="p-2 font-bold text-teal-700">{row.percent}%</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{manual.commission.guardrail_note}</p>
              </Card>

              <Card>
                <h2 className="font-black text-slate-800">等級升級門檻</h2>
                <div className="mt-3 space-y-2">
                  {manual.commission.thresholds.map((row: Row) => (
                    <div key={row.to_level} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
                      <span>{row.from_label} → <b>{row.to_label}</b></span>
                      <b className="text-amber-700">年簽約額 ≥ {wan(row.threshold)}</b>
                    </div>
                  ))}
                  <div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    <span>白金 → <b>戰略</b></span>
                    <span>參考 {wan(manual.commission.strategic_reference)}，門檻另議</span>
                  </div>
                </div>
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{manual.commission.basis_note}</p>
              </Card>
            </div>
          )}

          {tab === "faq" && (
            <div className="space-y-3">
              {manual.faq.map((row: Row, index: number) => (
                <Card key={row.q}>
                  <div className="font-bold text-teal-800">Q{index + 1}. {row.q}</div>
                  <p className="mt-2 text-sm text-slate-700">{row.a}</p>
                </Card>
              ))}
            </div>
          )}

          {tab === "emergency" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                {manual.emergency.audit_note}
              </div>
              {manual.emergency.items.map((row: Row) => (
                <div key={row.title} className={`rounded-2xl border-l-4 bg-white p-4 shadow-sm ${TONE[row.tone] || TONE.info}`}>
                  <b className="text-slate-800">{row.title}</b>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{row.detail}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
