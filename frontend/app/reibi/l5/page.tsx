"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, BellRing, CheckCircle2, ClipboardList, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type Kpi = { key: string; label: string; value: number; format: "number" | "currency"; detail: string; href: string };
type Todo = { key: string; category: string; title: string; detail: string; count: number; priority: "high" | "medium" | "low"; href: string };
type Notice = { key: string; level: "critical" | "warning" | "info"; title: string; detail: string; count: number; href: string };
type Dashboard = {
  role: { key: string; label: string; realm: string };
  scope: { kind: "global" | "partner"; partner_codes: string[]; enterprise_count: number };
  kpis: Kpi[];
  workflow: Record<string, Record<string, number>>;
  todos: Todo[];
  notifications: Notice[];
  trend: { month: string; count: number }[];
  generated_at: string;
  notification_mode: "live";
  truncated: boolean;
};

const L5_ROLES = new Set(["reibi_super", "reibi_finance", "reibi_data", "reibi_cs", "partner_primary", "partner_sub"]);
const workflowLabels: Record<string, { title: string; metrics: Record<string, string>; href: string }> = {
  quotes: { title: "報價", metrics: { pending: "待確認", confirmed: "已確認", total: "全部" }, href: "/reibi/workflow" },
  contracts: { title: "合約", metrics: { pending_sign: "待用印", active: "執行中", expiring_90: "90 天內到期", total: "全部" }, href: "/reibi/workflow" },
  work_orders: { title: "工單", metrics: { pending_acceptance: "待驗收", anomaly: "驗收異常", total: "全部" }, href: "/reibi/workflow" },
};

function formatValue(item: Kpi) {
  if (item.format === "currency") return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(item.value);
  return new Intl.NumberFormat("zh-TW").format(item.value);
}

function priorityClass(priority: Todo["priority"]) {
  if (priority === "high") return "bg-rose-100 text-rose-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function noticeClass(level: Notice["level"]) {
  if (level === "critical") return "border-rose-200 bg-rose-50 text-rose-800";
  if (level === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

export default function ReibiL5Page() {
  const { session } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const allowed = Boolean(session && L5_ROLES.has(session.systemRole));

  async function load() {
    if (!allowed) return;
    setLoading(true);
    setError("");
    try {
      const response = await API.getReibiL5Overview();
      if (response.status !== "success" || !response.data) throw new Error(response.message || response.detail || "無法讀取 L5 總覽");
      setDashboard(response.data as Dashboard);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法讀取 L5 總覽");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const maxTrend = useMemo(() => Math.max(1, ...(dashboard?.trend.map(item => item.count) || [1])), [dashboard]);

  if (!session) return null;
  if (!allowed) {
    return <main className="mx-auto max-w-4xl px-4 py-12"><div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm"><ShieldAlert className="mx-auto h-10 w-10 text-rose-600" /><h1 className="mt-4 text-xl font-black text-slate-900">沒有 L5 總覽權限</h1><p className="mt-2 text-sm text-slate-600">此頁只開放 REIBI 內部與經銷商可信角色。</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">返回首頁</Link></div></main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-teal-700"><ArrowLeft className="h-4 w-4" /> 返回首頁</Link><h1 className="mt-2 text-3xl font-black text-slate-900">L5 營運總覽</h1><p className="mt-1 text-sm text-slate-600">後端依登入角色與經銷商範圍裁切資料；通知為即時條件，不是永久收件匣。</p></div>
        <div className="flex flex-wrap gap-2">{["reibi_super", "reibi_finance"].includes(session.systemRole) && <Link href="/reibi/onboarding" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><ClipboardList className="h-4 w-4" />新案開通</Link>}<button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 重新整理</button></div>
      </header>
      {error && <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      {loading && !dashboard && <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">正在整理角色化營運資料…</div>}

      {dashboard && <div className="space-y-6">
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">{dashboard.role.label}</span><span className="text-sm text-slate-600">{dashboard.scope.kind === "global" ? "全企業範圍" : `經銷商範圍：${dashboard.scope.partner_codes.join("、")}`}</span><span className="ml-auto text-xs text-slate-400">更新：{new Date(dashboard.generated_at).toLocaleString("zh-TW")}</span>{dashboard.truncated && <span className="w-full rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">資料量已達單次總覽上限，請改用報表取得完整明細。</span>}</section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{dashboard.kpis.map(item => <Link key={item.key} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400"><div className="text-xs font-bold text-slate-500">{item.label}</div><div className="mt-2 text-2xl font-black text-slate-900">{formatValue(item)}</div>{item.detail && <div className="mt-2 text-xs text-slate-500">{item.detail}</div>}</Link>)}</section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-teal-700" /><h2 className="text-lg font-black text-slate-900">我的待辦</h2></div><div className="space-y-3">{dashboard.todos.length === 0 && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />目前沒有待辦。</div>}{dashboard.todos.map(item => <Link key={item.key} href={item.href} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:border-teal-300 hover:bg-teal-50/40"><span className={`rounded-lg px-2 py-1 text-[11px] font-black ${priorityClass(item.priority)}`}>{item.category}</span><div className="min-w-0 flex-1"><div className="text-sm font-bold text-slate-800">{item.title}</div>{item.detail && <div className="truncate text-xs text-slate-500">{item.detail}</div>}</div><span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black text-white">{item.count}</span></Link>)}</div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><BellRing className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-black text-slate-900">即時通知</h2></div><div className="space-y-3">{dashboard.notifications.length === 0 && <div className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700"><CheckCircle2 className="mr-2 inline h-4 w-4" />目前沒有異常通知。</div>}{dashboard.notifications.map(item => <Link key={item.key} href={item.href} className={`flex items-start gap-3 rounded-xl border p-3 ${noticeClass(item.level)}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1"><div className="text-sm font-black">{item.title}（{item.count}）</div>{item.detail && <div className="mt-1 text-xs opacity-80">{item.detail}</div>}</div></Link>)}</div></section>
        </div>

        {Object.keys(dashboard.workflow).length > 0 && <section><h2 className="mb-3 text-lg font-black text-slate-900">作業流程</h2><div className="grid gap-4 md:grid-cols-3">{Object.entries(dashboard.workflow).map(([key, values]) => { const config = workflowLabels[key]; if (!config) return null; return <Link key={key} href={config.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-teal-400"><h3 className="font-black text-slate-900">{config.title}</h3><div className="mt-4 grid grid-cols-2 gap-3">{Object.entries(values).map(([metric, value]) => <div key={metric} className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold text-slate-500">{config.metrics[metric] || metric}</div><div className="mt-1 text-xl font-black text-slate-900">{value}</div></div>)}</div></Link>; })}</div></section>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-violet-700" /><h2 className="text-lg font-black text-slate-900">近 12 個月新增企業</h2></div><div className="grid h-44 grid-cols-12 items-end gap-2" aria-label="近 12 個月新增企業趨勢">{dashboard.trend.map(item => <div key={item.month} className="flex h-full flex-col justify-end text-center"><span className="mb-1 text-xs font-black text-slate-700">{item.count}</span><div className="min-h-1 rounded-t-md bg-violet-500" style={{ height: `${Math.max(4, item.count / maxTrend * 100)}%` }} /><span className="mt-2 text-[10px] text-slate-400">{item.month.slice(5)}</span></div>)}</div></section>
      </div>}
    </main>
  );
}
