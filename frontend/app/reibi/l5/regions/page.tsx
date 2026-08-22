"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPinned, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type Region = {
  key: string;
  label: string;
  cities: string[];
  target: number;
  count: number;
  percent: number;
};

type Coverage = {
  total: { count: number; target: number; percent: number };
  regions: Region[];
  assigned_count: number;
  unassigned: {
    count: number;
    reasons: { no_partner: number; unknown_partner: number; partner_without_region: number };
  };
};

// Roles holding cross_org_analytics. The backend is the authority; this only
// decides whether to render the page or the no-permission notice.
const ALLOWED_ROLES = new Set(["reibi_super", "reibi_data"]);

const REGION_ACCENT: Record<string, { bar: string; text: string }> = {
  north: { bar: "bg-teal-600", text: "text-teal-700" },
  central: { bar: "bg-emerald-600", text: "text-emerald-700" },
  south: { bar: "bg-amber-600", text: "text-amber-700" },
  east: { bar: "bg-rose-500", text: "text-rose-600" },
  overseas: { bar: "bg-violet-600", text: "text-violet-700" },
};

const UNASSIGNED_LABELS: Record<string, string> = {
  no_partner: "未指定接案經銷商",
  unknown_partner: "經銷商代碼查無資料",
  partner_without_region: "經銷商未設定負責區域",
};

export default function ReibiRegionCoveragePage() {
  const { session } = useAuth();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const allowed = Boolean(session && ALLOWED_ROLES.has(session.systemRole));

  async function load() {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const response = await API.getReibiL5Regions();
      if (response.status !== "success" || !response.data) {
        throw new Error(response.message || response.detail || "無法讀取區域佈點");
      }
      setCoverage(response.data as Coverage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取區域佈點");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!session) return null;

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-4 text-xl font-black text-slate-900">沒有區域佈點檢視權限</h1>
          <p className="mt-2 text-sm text-slate-600">此頁只開放 REIBI 超級管理者與數據分析師。</p>
          <Link href="/reibi/l5" className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            返回 L5 總覽
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link href="/reibi/l5" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-teal-700">
            <ArrowLeft className="h-4 w-4" /> 返回 L5 總覽
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-black text-slate-900">
            <MapPinned className="h-7 w-7 text-teal-700" />區域佈點
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            區域取自企業接案經銷商的負責區域；次級經銷商未設定時沿用主經銷商。
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 重新整理
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
      )}
      {loading && !coverage && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          正在整理區域佈點資料…
        </div>
      )}

      {coverage && (
        <div className="space-y-6">
          <section className="rounded-2xl bg-gradient-to-br from-teal-700 to-slate-800 p-6 text-white shadow-sm">
            <div className="text-sm opacity-80">全區佈點目標</div>
            <div className="mt-1 text-4xl font-black">
              {coverage.total.count}
              <span className="text-2xl opacity-70"> / {coverage.total.target} 家</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white/80" style={{ width: `${coverage.total.percent}%` }} />
            </div>
            <div className="mt-2 text-xs opacity-80">{coverage.total.percent}% 達成率</div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {coverage.regions.map(region => {
              const accent = REGION_ACCENT[region.key] || { bar: "bg-slate-600", text: "text-slate-700" };
              return (
                <div key={region.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`font-black ${accent.text}`}>{region.label}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">{region.cities.join(" · ")}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-xl font-black ${accent.text}`}>
                        {region.count}/{region.target}
                      </div>
                      <div className="text-[11px] text-slate-400">目標 {region.target} 家</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${accent.bar}`} style={{ width: `${region.percent}%` }} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-500">{region.percent}% 達成</div>
                </div>
              );
            })}
          </section>

          {coverage.unassigned.count > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 font-black text-amber-900">
                <TriangleAlert className="h-5 w-5" />
                {coverage.unassigned.count} 家企業尚未歸入任何區域
              </div>
              <p className="mt-1 text-xs text-amber-800">
                區域卡片合計 {coverage.assigned_count} 家，與總數 {coverage.total.count} 家的差額如下。補齊經銷商的負責區域即可納入統計。
              </p>
              <ul className="mt-3 space-y-1.5">
                {Object.entries(coverage.unassigned.reasons)
                  .filter(([, count]) => count > 0)
                  .map(([reason, count]) => (
                    <li key={reason} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm">
                      <span className="text-amber-900">{UNASSIGNED_LABELS[reason] || reason}</span>
                      <span className="font-black text-amber-900">{count} 家</span>
                    </li>
                  ))}
              </ul>
              <Link
                href="/reibi/operations"
                className="mt-3 inline-flex rounded-xl bg-amber-900 px-3 py-2 text-xs font-bold text-white"
              >
                前往經銷商管理
              </Link>
            </section>
          ) : (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-800">
              所有企業都已歸入區域。
            </section>
          )}
        </div>
      )}
    </main>
  );
}
