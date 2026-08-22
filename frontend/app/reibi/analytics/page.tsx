"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, Download, Loader2, Printer, RefreshCw, Save, Search } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type Row = Record<string, any>;
type OrgTab = "overview" | "departments" | "roi" | "plan888" | "gri" | "reports";
type SuperTab = "cross" | "directory" | "reports";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const input = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50";
const reportLabels: Record<string, string> = {
  esg: "ESG 健康效益", okr: "企業健康 OKR", highrisk: "高風險趨勢", kpi: "健康 KPI",
  roi: "健康促進 ROI", plan888: "888 計畫", gri: "GRI 403", ohs: "職安衛計畫", cross_org: "跨企業策略",
};

function unwrap(response: any, fallback: string) {
  if (response?.status !== "success") throw new Error(response?.message || fallback);
  return response.data;
}

function money(value: unknown) {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function valueText(value: unknown, suffix = "") {
  return value === null || value === undefined ? "樣本不足" : `${value}${suffix}`;
}

function downloadCsv(filename: string, rows: Row[]) {
  if (!rows.length) return;
  const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escape = (value: unknown) => `"${String(typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? "").replaceAll('"', '""')}"`;
  const text = "\uFEFF" + [keys.map(escape).join(","), ...rows.map(row => keys.map(key => escape(row[key])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

function Metric({ label, value, suffix = "" }: { label: string; value: unknown; suffix?: string }) {
  return <div className={card}><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-900">{valueText(value, suffix)}</div></div>;
}

function GoalBar({ label, current, target, unit = "" }: { label: string; current: number; target: number; unit?: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        <span className="text-xs text-slate-400">{pct}%</span>
      </div>
      <div className="mt-1 text-sm font-black text-slate-900">
        {money(current)}{unit} / {money(target)}{unit}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** 策略彙整。原本整包用 JSON.stringify 傾印，能看但沒法用；
 *  其中 NPS 回訪是唯一有行動意義的欄位（合約滿 3 個月或 1 年），特別拉出來。 */
function StrategyPanel({ strategy }: { strategy: Row | null | undefined }) {
  if (!strategy) return <div className={card}><p className="text-sm text-slate-500">尚無策略資料。</p></div>;
  const goals = strategy.goals || {};
  const regions: Array<[string, number]> = Object.entries(strategy.by_region || {}) as any;
  const partners: Array<[string, Row]> = Object.entries(strategy.by_partner || {}) as any;
  const followUps: string[] = strategy.nps_follow_up_org_codes || [];

  return (
    <div className="space-y-4">
      {followUps.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-black text-amber-900">NPS 客戶滿意度回訪</h2>
          <p className="mt-1 text-xs text-amber-800">以下企業合約已滿 3 個月或 1 年，請安排主動聯繫。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {followUps.map(code => (
              <span key={code} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900">{code}</span>
            ))}
          </div>
        </div>
      )}

      <div className={card}>
        <h2 className="font-black">年度目標達成</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <GoalBar label="企業家數" current={Number(strategy.enterprise_count || 0)} target={Number(goals.annual_enterprises || 0)} unit=" 家" />
          <GoalBar label="簽約金額" current={Number(strategy.contracted_revenue || 0)} target={Number(goals.annual_revenue || 0)} unit=" 元" />
          <GoalBar label="授權使用率" current={Number(strategy.used_members || 0)} target={Number(strategy.licensed_members || 0)} unit=" 人" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="有效合約企業" value={strategy.active_enterprise_count} suffix=" 家" />
          <Metric label="經銷商總數" value={strategy.distributor_count} suffix=" 家" />
          <Metric label="待回訪企業" value={followUps.length} suffix=" 家" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h2 className="font-black">區域佈點</h2>
          {regions.length === 0 ? <p className="mt-3 text-sm text-slate-500">尚無區域資料。</p> : (
            <div className="mt-3 space-y-2">
              {regions.sort((a, b) => b[1] - a[1]).map(([region, count]) => (
                <div key={region} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span>{region}</span><b>{count} 家</b>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={card}>
          <h2 className="font-black">經銷商貢獻</h2>
          {partners.length === 0 ? <p className="mt-3 text-sm text-slate-500">尚無經銷商資料。</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="pb-2">代碼</th><th className="pb-2">企業數</th><th className="pb-2 text-right">簽約金額</th></tr></thead>
                <tbody>
                  {partners.sort((a, b) => Number(b[1].revenue || 0) - Number(a[1].revenue || 0)).map(([code, row]) => (
                    <tr key={code} className="border-t border-slate-100">
                      <td className="py-2 font-bold">{code}</td>
                      <td className="py-2">{row.enterprise_count}</td>
                      <td className="py-2 text-right">{money(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReibiAnalyticsPage() {
  const { session } = useAuth();
  const isSuper = session?.systemRole === "reibi_super";
  const canViewOrg = Boolean(session && can(session.systemRole, "org_analytics"));
  const canGenerate = Boolean(session && can(session.systemRole, "generate_org_reports"));
  const [orgTab, setOrgTab] = useState<OrgTab>("overview");
  const [superTab, setSuperTab] = useState<SuperTab>("cross");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [department, setDepartment] = useState("");
  const [overview, setOverview] = useState<Row | null>(null);
  const [departments, setDepartments] = useState<Row[]>([]);
  const [cross, setCross] = useState<Row | null>(null);
  const [reports, setReports] = useState<Row[]>([]);
  const [selectedReport, setSelectedReport] = useState<Row | null>(null);
  const [settings, setSettings] = useState<Row>({});
  const [reportType, setReportType] = useState("kpi");
  const [directoryKind, setDirectoryKind] = useState<"enterprise" | "distributor">("enterprise");
  const [search, setSearch] = useState("");
  const [directory, setDirectory] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const query = useMemo(() => ({
    period_start: periodStart || undefined,
    period_end: periodEnd || undefined,
    department: department || undefined,
  }), [periodStart, periodEnd, department]);

  const run = useCallback(async (task: () => Promise<void>, success = "") => {
    setLoading(true); setError(""); setMessage("");
    try { await task(); if (success) setMessage(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "操作失敗"); }
    finally { setLoading(false); }
  }, []);

  const loadOrg = useCallback(async () => {
    await run(async () => {
      const [overviewResponse, departmentResponse, settingsResponse, reportResponse]: any[] = await Promise.all([
        API.getReibiAnalyticsOverview(query), API.getReibiDepartmentAnalytics(query),
        API.getReibiAnalyticsSettings(), API.listReibiAnalyticsReports(),
      ]);
      setOverview(unwrap(overviewResponse, "無法讀取組織分析"));
      setDepartments(unwrap(departmentResponse, "無法讀取部門分析") || []);
      setSettings(unwrap(settingsResponse, "無法讀取 ROI 參數") || {});
      setReports(unwrap(reportResponse, "無法讀取報告") || []);
    });
  }, [query, run]);

  const loadSuper = useCallback(async () => {
    await run(async () => {
      const [crossResponse, reportResponse]: any[] = await Promise.all([
        API.getReibiCrossOrgAnalytics(query), API.listReibiCrossOrgReports(),
      ]);
      setCross(unwrap(crossResponse, "無法讀取跨企業分析"));
      setReports(unwrap(reportResponse, "無法讀取跨企業報告") || []);
    });
  }, [query, run]);

  const loadDirectory = useCallback(async () => {
    await run(async () => {
      const response: any = await API.getReibiAnalyticsDirectory(directoryKind, {
        search: search || undefined, period_start: periodStart || undefined, period_end: periodEnd || undefined,
      });
      setDirectory(unwrap(response, "無法讀取名冊") || []);
    });
  }, [directoryKind, search, periodStart, periodEnd, run]);

  useEffect(() => { if (isSuper) void loadSuper(); else if (canViewOrg) void loadOrg(); }, [isSuper, canViewOrg, loadOrg, loadSuper]);
  useEffect(() => { if (isSuper && superTab === "directory") void loadDirectory(); }, [isSuper, superTab, directoryKind, loadDirectory]);

  const saveSettings = () => void run(async () => {
    const payload = Object.fromEntries(["headcount", "improve_rate", "sick_days_reduced", "avg_daily_salary", "avg_monthly_salary", "insurance_saving", "productivity_gain", "implement_cost", "d_layer_cost", "participant_boost"].map(key => [key, Number(settings[key])]));
    const response: any = await API.saveReibiAnalyticsSettings(payload);
    setSettings(unwrap(response, "無法儲存 ROI 參數")); await loadOrg();
  }, "ROI 參數已儲存");

  const generate = () => void run(async () => {
    const response: any = await API.generateReibiAnalyticsReport({
      report_type: isSuper ? "cross_org" : reportType,
      period_start: periodStart || null, period_end: periodEnd || null,
      department_key: !isSuper && department ? department : null,
    });
    setSelectedReport(unwrap(response, "Gemini 報告產生失敗"));
    if (isSuper) await loadSuper(); else await loadOrg();
  }, "Gemini 報告已產生並保存");

  const openReport = (row: Row) => void run(async () => {
    if (isSuper) { setSelectedReport(row); return; }
    const response: any = await API.getReibiAnalyticsReport(row.id);
    setSelectedReport(unwrap(response, "無法讀取報告"));
  });

  if (!isSuper && !canViewOrg) return <main className="mx-auto max-w-3xl p-8"><div className={card}>此角色沒有組織分析權限。</div></main>;

  const snapshot = overview?.snapshot || {};
  const metrics = snapshot.metrics || {};
  const kpis = overview?.kpis || {};
  const roi = overview?.roi || {};
  const tabs = isSuper ? [["cross", "跨企業分析"], ["directory", "企業／經銷名冊"], ["reports", "Gemini 報告"]] : [["overview", "總覽與 KPI"], ["departments", "部門趨勢"], ["roi", "ROI 試算"], ["plan888", "888 計畫"], ["gri", "GRI 403"], ["reports", "Gemini 報告"]];
  const activeTab = isSuper ? superTab : orgTab;

  return <main className="min-h-screen bg-[#f8fafc] p-4 text-slate-800 md:p-8 print:bg-white print:p-0">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div><Link href="/reibi" className="inline-flex items-center gap-1 text-sm font-bold text-teal-700"><ArrowLeft className="h-4 w-4" />REIBI</Link><h1 className="mt-2 text-3xl font-black">{isSuper ? "跨企業策略分析" : "組織健康分析中心"}</h1><p className="mt-1 text-sm text-slate-500">所有健康指標由資料庫執行 k≥5 去識別化；AI 報告僅由後端 Gemini 產生。</p></div>
        <div className="flex gap-2"><button className={secondary} onClick={() => window.print()}><Printer className="h-4 w-4" />列印／PDF</button><button className={secondary} disabled={loading} onClick={() => void (isSuper ? loadSuper() : loadOrg())}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}重新整理</button></div>
      </header>

      <section className={`${card} mb-5 flex flex-wrap items-end gap-3 print:hidden`}>
        <label className="text-xs font-bold">開始日期<input type="date" className={`${input} mt-1 block`} value={periodStart} onChange={event => setPeriodStart(event.target.value)} /></label>
        <label className="text-xs font-bold">結束日期<input type="date" className={`${input} mt-1 block`} value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></label>
        {!isSuper && session?.systemRole !== "dept_head" && <label className="text-xs font-bold">部門（空白為全單位）<input className={`${input} mt-1 block`} value={department} maxLength={120} onChange={event => setDepartment(event.target.value)} /></label>}
        <button className={primary} onClick={() => void (isSuper ? loadSuper() : loadOrg())}>套用篩選</button>
      </section>

      {(error || message) && <div className={`mb-4 rounded-xl p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}
      <nav className="mb-5 flex gap-2 overflow-x-auto print:hidden">{tabs.map(([key, label]) => <button key={key} onClick={() => isSuper ? setSuperTab(key as SuperTab) : setOrgTab(key as OrgTab)} className={activeTab === key ? primary : secondary}>{label}</button>)}</nav>

      {!isSuper && activeTab === "overview" && <section className="space-y-4">
        {snapshot.suppressed ? <div className="rounded-xl bg-amber-50 p-4 text-amber-800">目前篩選範圍只有 {snapshot.sample_size || 0} 人，未達 5 人，因此不顯示健康指標。</div> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="納入樣本" value={snapshot.sample_size} suffix=" 人" /><Metric label="良好睡眠率" value={kpis.sleep_good_rate} suffix="%" /><Metric label="輕微疼痛率" value={kpis.pain_mild_rate} suffix="%" /><Metric label="MHI 平均" value={kpis.mhi_average} /></div><div className="grid gap-4 md:grid-cols-3"><Metric label="睡眠平均" value={metrics.sleep?.average_score} /><Metric label="疼痛平均" value={metrics.pain?.average_score} /><Metric label="工作影響平均" value={metrics.work?.average_score} /></div></>}
        <div className={card}><div className="flex justify-between"><h2 className="font-black">KPI／OKR 摘要</h2><button className={secondary} onClick={() => downloadCsv("reibi-kpi.csv", [kpis])}><Download className="h-4 w-4" />CSV</button></div><pre className="mt-4 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(kpis, null, 2)}</pre></div>
      </section>}

      {!isSuper && activeTab === "departments" && <section className={card}><div className="flex justify-between"><h2 className="font-black">部門去識別化趨勢</h2><button className={secondary} onClick={() => downloadCsv("reibi-departments.csv", departments)}><Download className="h-4 w-4" />CSV</button></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b">{["部門", "樣本", "睡眠良好率", "疼痛輕微率", "MHI"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{departments.map(row => <tr key={row.department} className="border-b"><td className="p-3 font-bold">{row.department}</td><td className="p-3">{row.snapshot?.sample_size}</td><td className="p-3">{valueText(row.kpis?.sleep_good_rate, "%")}</td><td className="p-3">{valueText(row.kpis?.pain_mild_rate, "%")}</td><td className="p-3">{valueText(row.kpis?.mhi_average)}</td></tr>)}</tbody></table></div></section>}

      {!isSuper && activeTab === "roi" && <section className="grid gap-4 lg:grid-cols-[420px_1fr]"><div className={card}><h2 className="font-black">ROI 參數</h2><div className="mt-4 grid grid-cols-2 gap-3">{[["headcount", "員工數"], ["improve_rate", "改善率 %"], ["sick_days_reduced", "減少病假日"], ["avg_daily_salary", "平均日薪"], ["avg_monthly_salary", "平均月薪"], ["insurance_saving", "每人保險節省"], ["productivity_gain", "生產力增益 %"], ["implement_cost", "導入成本"], ["d_layer_cost", "D 層成本"], ["participant_boost", "參與提升 %"]].map(([key, label]) => <label key={key} className="text-xs font-bold">{label}<input type="number" className={`${input} mt-1 w-full`} value={settings[key] ?? ""} onChange={event => setSettings(old => ({ ...old, [key]: event.target.value }))} /></label>)}</div>{canGenerate && <button className={`${primary} mt-4 w-full`} onClick={saveSettings}><Save className="h-4 w-4" />儲存並重算</button>}</div><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Metric label="年度效益" value={`NT$ ${money(roi.annual_benefit)}`} /><Metric label="預估改善人數" value={roi.improved_people} suffix=" 人" /></div>{Object.entries(roi.scenarios || {}).map(([key, scenario]: any) => <div key={key} className={card}><h3 className="font-black">{key}</h3><div className="mt-3 grid grid-cols-3 gap-3 text-sm"><span>年度效益<br /><b>NT$ {money(scenario.annual_benefit)}</b></span><span>三年 ROI<br /><b>{scenario.three_year_net_roi_percent}%</b></span><span>回本<br /><b>{scenario.payback_months} 月</b></span></div></div>)}<p className="text-xs text-slate-500">{roi.disclaimer}</p></div></section>}

      {!isSuper && activeTab === "plan888" && <section className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><Metric label="第一個 80%：早期發現" value={overview?.plan888?.three_80?.early_detection} suffix="%" /><Metric label="第二個 80%：生活諮商" value={overview?.plan888?.three_80?.lifestyle_counseling} suffix="%" /><Metric label="第三個 80%：有效控制" value={overview?.plan888?.three_80?.effective_control} suffix="%" /></div><div className="grid gap-3 md:grid-cols-2">{(overview?.plan888?.timeline || []).map((row: Row) => <div key={row.week} className={card}><b>第 {row.week} 週 · {row.title}</b><ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{row.actions.map((action: string) => <li key={action}>{action}</li>)}</ul><p className="mt-2 text-xs font-bold text-teal-700">目標：{row.target}</p></div>)}</div></section>}

      {!isSuper && activeTab === "gri" && <section className="space-y-4">{(overview?.gri || []).map((row: Row) => <div key={row.standard} className={card}><h2 className="font-black">{row.standard} · {row.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{row.content}</p></div>)}</section>}

      {isSuper && activeTab === "cross" && <section className="space-y-4"><div className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800">{cross?.privacy}</div><div className="grid gap-4 sm:grid-cols-3"><Metric label="合格企業數" value={cross?.health?.organization_count} /><Metric label="研究同意樣本" value={cross?.health?.sample_size} suffix=" 人" /><Metric label="有效合約" value={cross?.strategy?.active_enterprise_count} /></div><div className={card}><div className="flex justify-between"><h2 className="font-black">跨企業健康（每企業 k≥5）</h2><button className={secondary} onClick={() => downloadCsv("reibi-cross-org.csv", cross?.health?.organizations || [])}><Download className="h-4 w-4" />CSV</button></div><pre className="mt-4 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(cross?.health?.organizations || [], null, 2)}</pre></div><StrategyPanel strategy={cross?.strategy} /></section>}

      {isSuper && activeTab === "directory" && <section className={card}><div className="flex flex-wrap items-end gap-3"><label className="text-xs font-bold">名冊<select className={`${input} mt-1 block`} value={directoryKind} onChange={event => setDirectoryKind(event.target.value as any)}><option value="enterprise">企業</option><option value="distributor">經銷商</option></select></label><label className="text-xs font-bold">搜尋<input className={`${input} mt-1 block`} value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /></label><button className={primary} onClick={() => void loadDirectory()}><Search className="h-4 w-4" />搜尋</button><button className={secondary} onClick={() => downloadCsv(`reibi-${directoryKind}.csv`, directory)}><Download className="h-4 w-4" />CSV</button></div><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b">{["代碼", "名稱", "狀態", "聯絡人", "電話", "Email", "地區／產業"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{directory.map(row => <tr key={row.id} className="border-b"><td className="p-2 font-bold">{row.org_code}</td><td className="p-2">{row.org_name || row.name}</td><td className="p-2">{row.status}</td><td className="p-2">{row.contact_name}</td><td className="p-2">{row.phone}</td><td className="p-2">{row.email}</td><td className="p-2">{row.region || row.industry}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-500">此名冊只包含企業／經銷商資料，不提供任何個人健康名冊。</p></section>}

      {activeTab === "reports" && <section className="grid gap-4 lg:grid-cols-[380px_1fr]"><div className={`${card} print:hidden`}><h2 className="font-black">Gemini 報告</h2>{!isSuper && <label className="mt-4 block text-xs font-bold">報告類型<select className={`${input} mt-1 w-full`} value={reportType} onChange={event => setReportType(event.target.value)}>{Object.entries(reportLabels).filter(([key]) => key !== "cross_org").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}<button className={`${primary} mt-4 w-full`} disabled={loading || (!isSuper && !canGenerate)} onClick={generate}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}產生 {isSuper ? "跨企業" : "組織"}報告</button>{!isSuper && !canGenerate && <p className="mt-2 text-xs text-slate-500">部門主管可查閱自己部門既有報告，只有平台管理者可產生新報告。</p>}<h3 className="mt-6 font-black">歷史版本</h3><div className="mt-3 max-h-[520px] space-y-2 overflow-auto">{reports.map(row => <button key={row.id} className="w-full rounded-xl border p-3 text-left text-sm hover:bg-teal-50" onClick={() => openReport(row)}><b>{row.title}</b><small className="block text-slate-400">{String(row.created_at).slice(0, 16).replace("T", " ")} · {row.ai_provider} / {row.ai_model}</small></button>)}</div></div><article className={card}><div className="flex justify-between"><div><h2 className="text-xl font-black">{selectedReport?.title || "選擇或產生一份報告"}</h2>{selectedReport && <small className="text-slate-500">樣本 {selectedReport.sample_size} · {selectedReport.ai_provider} / {selectedReport.ai_model}</small>}</div>{selectedReport && <button className={`${secondary} print:hidden`} onClick={() => window.print()}><Printer className="h-4 w-4" />PDF</button>}</div><div className="mt-6 whitespace-pre-wrap text-sm leading-7">{selectedReport?.content || "報告內容會顯示在這裡。"}</div></article></section>}
    </div>
  </main>;
}
