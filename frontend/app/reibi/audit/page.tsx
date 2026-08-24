"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, RefreshCw, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type Row = Record<string, any>;

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const input = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50";

// 動作代碼對照。後端 ACTION_CATALOG 是權威來源，這裡只負責顯示成中文；
// 對不上的代碼直接顯示原字串，不要靜靜吞掉。
const actionLabels: Record<string, string> = {
  "quote.create": "報價建立", "quote.update": "報價修改", "quote.status": "報價狀態變更",
  "quote.convert": "報價轉合約", "contract.status": "合約狀態變更", "contract.execution": "合約執行",
  "workorder.status": "工單狀態變更", "workorder.accept": "工單驗收",
  "invoice.status": "發票狀態變更", "remittance.reconcile": "匯款沖帳",
  "commission.confirm": "分潤確認", "commission.paid": "分潤匯款",
  "subscription.review": "訂閱審核", "subscription.reissue": "啟用碼補發",
};

function downloadCsv(rows: Row[]) {
  if (!rows.length) return;
  const keys = ["created_at", "action", "role_at_time", "user_id", "org_code", "detail"];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const text = "﻿" + [keys.join(","), ...rows.map(row => keys.map(key => escape(row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "reibi-audit.csv"; anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReibiAuditPage() {
  const { session } = useAuth();
  const allowed = Boolean(session && can(session.systemRole, "security_audit"));

  const [rows, setRows] = useState<Row[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [scopeOrg, setScopeOrg] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const response: any = await API.listReibiAudit({
      page, size: 50,
      action: action || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
    if (response.status === "success") {
      setRows(response.data?.rows || []);
      setActions(response.data?.actions || []);
      setScopeOrg(response.data?.org_code ?? null);
      setHasMore(Boolean(response.data?.has_more));
    } else {
      setError(response.message || response.detail || "無法讀取稽核紀錄");
      setRows([]);
    }
    setLoading(false);
  }, [allowed, page, action, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          此帳號沒有資安稽核檢視權限。
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/reibi" className="text-xs font-bold text-teal-700">← 返回 REIBI 管理</Link>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
              <ShieldCheck className="h-6 w-6 text-teal-700" />資安稽核紀錄
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {scopeOrg ? `範圍：${scopeOrg}（僅本企業）` : "範圍：全企業"}
              ．內容為操作摘要，送出前已去識別化處理。
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={secondary} onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />重新整理
            </button>
            <button type="button" className={secondary} disabled={!rows.length} onClick={() => downloadCsv(rows)}>
              <Download className="h-4 w-4" />CSV
            </button>
          </div>
        </div>

        <section className={`${card} mt-6`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-slate-600">動作
              <select className={`${input} mt-1 w-full`} value={action} onChange={event => { setPage(1); setAction(event.target.value); }}>
                <option value="">全部</option>
                {actions.map(code => <option key={code} value={code}>{actionLabels[code] || code}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">起始日期
              <input type="date" className={`${input} mt-1 w-full`} value={dateFrom} onChange={event => { setPage(1); setDateFrom(event.target.value); }} />
            </label>
            <label className="text-xs font-bold text-slate-600">結束日期
              <input type="date" className={`${input} mt-1 w-full`} value={dateTo} onChange={event => { setPage(1); setDateTo(event.target.value); }} />
            </label>
          </div>
        </section>

        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <section className={`${card} mt-6`}>
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">載入中…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">此範圍與條件下沒有稽核紀錄。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="pb-3 pr-4">時間</th>
                    <th className="pb-3 pr-4">動作</th>
                    <th className="pb-3 pr-4">操作者角色</th>
                    <th className="pb-3">內容</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-500">
                        {String(row.created_at || "").slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 font-bold text-slate-800">
                        {actionLabels[row.action] || row.action}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-600">{row.role_at_time || "—"}</td>
                      <td className="py-3 text-slate-700">{row.detail || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs text-slate-500">第 {page} 頁．本頁 {rows.length} 筆</span>
            <div className="flex gap-2">
              <button type="button" className={secondary} disabled={page <= 1 || loading} onClick={() => setPage(current => Math.max(1, current - 1))}>上一頁</button>
              <button type="button" className={secondary} disabled={!hasMore || loading} onClick={() => setPage(current => current + 1)}>下一頁</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
