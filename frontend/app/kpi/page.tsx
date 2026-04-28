"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DB, K_MIN } from "@/lib/store";
import { C, LX, LL, can } from "@/lib/config";
import { 
  BarChart3, ChevronLeft, Download, Calendar, 
  Filter, Lock, AlertTriangle, Users, Target, Activity, MapPin 
} from "lucide-react";

export default function KPIPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [data, setData] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [fDept, setFDept] = useState("全部");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const isAdmin = session?.systemRole === "admin";
  const isDept = session?.systemRole === "dept_head";

  useEffect(() => {
    if (session?.orgCode) {
      DB.loadOrgRecs(session.orgCode).then((r: any) => {
        setData(Array.isArray(r) ? r : []);
        setReady(true);
      });
    } else if (session) {
      setReady(true); // 沒有 orgCode 的個人用戶會顯示無資料
    }
  }, [session]);

  if (loading || !ready) return null;

  // --- 資料過濾邏輯 (權限 + 部門 + 日期) --- 
  const allData = isDept ? data.filter(r => r.dept === session.dept) : data;
  const depts = Array.from(new Set(allData.map(r => r.dept).filter(Boolean)));
  
  let fd = fDept === "全部" ? allData : allData.filter(r => r.dept === fDept);
  if (dateFrom) fd = fd.filter(r => r.ts?.slice(0, 10) >= dateFrom);
  if (dateTo) fd = fd.filter(r => r.ts?.slice(0, 10) <= dateTo);
  
  const n = fd.length;

  if (!allData.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">單位：{session?.orgName}</h2>
        <p className="text-slate-500 mt-2 mb-6">目前尚無成員的評估記錄。</p>
        <button onClick={() => router.back()} className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">← 返回主選單</button>
      </div>
    );
  }

  // --- 統計計算 --- [cite: 106-107]
  const avgOf = (key: string) => n > 0 ? fd.reduce((a, r) => a + (r[key] || 0), 0) / n : 0;
  const avgS = avgOf("sScore"), avgP = avgOf("pScore"), avgW = avgOf("wScore");
  const cb = fd.filter(r => ["yellow", "orange", "red"].includes(r.sKey) && ["yellow", "orange", "red"].includes(r.pKey)).length;
  
  const HPI = n > 0 ? Math.round(100 - ((avgS / 28 * 40) + (avgP / 50 * 40) + (avgW / 30 * 20))) : 0;
  const hc = HPI >= 75 ? "text-emerald-600" : HPI >= 50 ? "text-amber-600" : "text-rose-600";
  const hcBg = HPI >= 75 ? "bg-emerald-500" : HPI >= 50 ? "bg-amber-500" : "bg-rose-500";
  
  const sDist: any = { green: 0, yellow: 0, orange: 0, red: 0 };
  const pDist: any = { green: 0, yellow: 0, orange: 0, red: 0 };
  fd.forEach(r => {
    if (r.sKey && sDist[r.sKey] !== undefined) sDist[r.sKey]++;
    if (r.pKey && pDist[r.pKey] !== undefined) pDist[r.pKey]++;
  });

  const locCounts: any = {};
  fd.forEach(r => (r.painLocs || []).forEach((l: string) => { locCounts[l] = (locCounts[l] || 0) + 1; }));
  const topLocs = Object.entries(locCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);
  
  const sHighRisk = fd.filter(r => ["orange", "red"].includes(r.sKey)).length;
  const sGreen = fd.filter(r => r.sKey === "green").length;
  const pGreen = fd.filter(r => r.pKey === "green").length;
  
  const improvePct = sHighRisk > 0 ? Math.round(sGreen / sHighRisk * 100) : 0;
  const prevalencePct = n > 0 ? Math.round(sHighRisk / n * 100) : 0;
  const impactPct = n > 0 ? Math.round(sGreen / n * 100) : 0;

  // --- 下載報告邏輯 --- [cite: 110-111]
  const exportReport = () => {
    const lines = [
      `REIBI 麗媚生化科技 單位KPI報告`,
      `單位：${session.orgName}`,
      `日期區間：${dateFrom || "全部"}～${dateTo || "全部"}`,
      ``,
      `健康促進指數(HPI): ${HPI}/100`,
      `評估人次: ${n}`,
      `睡眠高風險: ${Math.round(sHighRisk / n * 100)}%`,
      `共病率: ${Math.round(cb / n * 100)}%`,
      ``,
      `KPI指標:`,
      `改善率: ${improvePct}%（改善人數/有問題人數）`,
      `問題盛行率: ${prevalencePct}%（有問題人數/總人數）`,
      `全體貢獻率: ${impactPct}%（改善人數/總人數）`
    ];
    const b = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = `KPI報告_${session.orgName}.txt`; a.click();
    URL.revokeObjectURL(u);
  };

  // --- 分布長條圖元件 --- [cite: 109]
  const DistBar = ({ dist }: { dist: any }) => (
    <div className="space-y-3 mt-4">
      {Object.entries(dist).map(([k, c]: [string, any]) => {
        const p = n > 0 ? Math.round(c / n * 100) : 0;
        const color = LX[k as keyof typeof LX].c;
        return (
          <div key={k} className="flex items-center gap-3">
            <div className="w-14 text-xs font-bold" style={{ color }}>{(LL as any)[k]}</div>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${p}%`, backgroundColor: color }}></div>
            </div>
            <div className="w-8 text-xs text-slate-500 text-right">{c}人</div>
            <div className="w-8 text-xs font-bold text-slate-700 text-right">{p}%</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* 標題與操作區 */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回主選單
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-600" /> {isDept ? "部門" : "單位"} KPI 報表
          </h1>
          <p className="text-xs text-slate-500 mt-2 bg-slate-100 inline-block px-3 py-1 rounded-full">
            🏢 {session.orgName} · 總計 {allData.length} 筆 · 資料已去識別化
          </p>
        </div>
        
        {can(session.systemRole, "dl_dept") && n > 0 && (
          <button onClick={exportReport} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-purple-700 shadow-md transition-colors">
            <Download className="w-4 h-4" /> 匯出報表
          </button>
        )}
      </div>

      {/* 篩選面板 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-4">
          <Filter className="w-4 h-4" /> 資料篩選
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-transparent text-sm outline-none" />
            </div>
            <span className="text-slate-300">-</span>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-transparent text-sm outline-none" />
            </div>
          </div>

          {isAdmin && depts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 w-full mb-1">部門過濾：</span>
              {["全部", ...depts].map(d => (
                <button 
                  key={d} onClick={() => setFDept(d)} 
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${fDept === d ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 text-xs text-slate-400 font-medium">顯示 {n} / {allData.length} 筆符合條件的紀錄</div>
      </div>

      {/* 🔒 k-Anonymity 保護機制 */}
      {n > 0 && n < K_MIN ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 mb-8 text-center animate-in fade-in">
          <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-amber-800 mb-2">k-匿名性保護 (k-Anonymity) 已啟動</h3>
          <p className="text-sm text-amber-700 leading-relaxed max-w-lg mx-auto">
            您目前篩選的條件下只有 <strong>{n}</strong> 筆評估人數。<br/>
            為保護員工個人隱私，防止數據被逆向識別，系統已自動隱藏詳細統計圖表。<br/>
            <span className="font-bold">待符合條件人數達 {K_MIN} 人以上時，即會自動解鎖顯示。</span>
          </p>
        </div>
      ) : n === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          無符合篩選條件的資料
        </div>
      ) : (
        <>
          {/* HPI 指數看板 */}
          <div className="bg-linear-to-br from-[#ebf6f8] to-[#f0f4fb] border border-teal-200 rounded-3xl p-8 mb-8 shadow-sm">
            <h3 className="text-sm font-bold text-teal-800 mb-6 flex items-center gap-2">
              <Target className="w-5 h-5" /> 健康促進指數 HPI (Health Promotion Index)
            </h3>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="text-center shrink-0">
                <div className={`text-6xl font-black tracking-tighter ${hc}`}>{HPI}</div>
                <div className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">/ 100 分</div>
                <div className={`text-sm font-bold mt-2 ${hc}`}>{HPI >= 75 ? "🟢 狀態良好" : HPI >= 50 ? "🟡 需關注介入" : "🔴 高風險群體"}</div>
              </div>
              <div className="flex-1 w-full">
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-4">
                  <div className={`h-full ${hcBg} rounded-full`} style={{ width: `${HPI}%` }}></div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs font-bold text-slate-600">
                  <div className="bg-white/60 p-3 rounded-xl border border-white/40">🌙 睡眠子數: {Math.round(100 - avgS / 28 * 100)}/100</div>
                  <div className="bg-white/60 p-3 rounded-xl border border-white/40">🩺 疼痛子數: {Math.round(100 - avgP / 50 * 100)}/100</div>
                  <div className="bg-white/60 p-3 rounded-xl border border-white/40">💼 效率子數: {Math.round(100 - avgW / 30 * 100)}/100</div>
                </div>
              </div>
            </div>
          </div>

          {/* 三大速覽指標 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: <Users className="w-6 h-6" />, l: "有效評估人次", v: n, c: "text-blue-600", bg: "bg-blue-50" },
              { icon: <AlertTriangle className="w-6 h-6" />, l: "睡眠高風險比例", v: `${Math.round(sHighRisk / n * 100)}%`, c: "text-rose-600", bg: "bg-rose-50" },
              { icon: <Activity className="w-6 h-6" />, l: "睡眠+疼痛共病率", v: `${Math.round(cb / n * 100)}%`, c: "text-amber-600", bg: "bg-amber-50" }
            ].map(s => (
              <div key={s.l} className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
                <div className={`w-12 h-12 rounded-full ${s.bg} ${s.c} flex items-center justify-center mx-auto mb-3`}>{s.icon}</div>
                <div className={`text-3xl font-black ${s.c} mb-1`}>{s.v}</div>
                <div className="text-xs font-bold text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>

          {/* 長條圖分布 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-indigo-700 mb-2">🌙 睡眠風險層級分布</h3>
              <DistBar dist={sDist} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-rose-700 mb-2">🩺 疼痛風險層級分布</h3>
              <DistBar dist={pDist} />
            </div>
          </div>

          {/* 疼痛部位 */}
          {topLocs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">
              <h3 className="text-sm font-bold text-rose-700 mb-6 flex items-center gap-2"><MapPin className="w-4 h-4" /> 企業好發疼痛部位 (Top 5)</h3>
              <div className="space-y-4">
                {topLocs.map(([loc, cnt]: [string, any]) => {
                  const p = Math.round(cnt / n * 100);
                  return (
                    <div key={loc} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium text-slate-700">{loc}</div>
                      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400 rounded-full" style={{ width: `${p}%` }}></div>
                      </div>
                      <div className="w-16 text-right text-sm font-bold text-rose-600">{cnt} 人 <span className="text-xs text-slate-400 ml-1">({p}%)</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPI 計算公式區塊 */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl">
            <h3 className="text-lg font-bold text-purple-300 mb-6">📐 KPI 計算與成效指標 (依本期數據)</h3>
            <div className="grid gap-6">
              {[
                { num: "1", label: "健康改善率 (Improvement Rate) ★ 主要KPI", formula: "改善人數 ÷ 初始高風險人數 × 100%", calc: `${sGreen} ÷ ${sHighRisk} × 100%`, pct: improvePct, color: improvePct >= 70 ? "text-emerald-400" : improvePct >= 50 ? "text-amber-400" : "text-rose-400", bg: "bg-emerald-500", desc: "改善率 ≥75% 為優異表現，代表現行舒曼波/雷射干預方案具高度效益。" },
                { num: "2", label: "問題盛行率 (Prevalence Rate)", formula: "高風險人數 ÷ 總人數 × 100%", calc: `${sHighRisk} ÷ ${n} × 100%`, pct: prevalencePct, color: "text-amber-400", bg: "bg-amber-500", desc: "衡量企業整體健康問題嚴重程度的現狀指標。" },
                { num: "3", label: "全體健康貢獻率 (Total Impact Rate)", formula: "改善人數 ÷ 總人數 × 100%", calc: `${sGreen} ÷ ${n} × 100%`, pct: impactPct, color: "text-purple-400", bg: "bg-purple-500", desc: "衡量健康促進方案對整間公司全體員工帶來的總體提升。" },
              ].map(f => (
                <div key={f.num} className="bg-white/10 border border-white/20 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-6 h-6 rounded-full ${f.bg} flex items-center justify-center text-xs font-black`}>{f.num}</div>
                    <div className="font-bold">{f.label}</div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">公式：{f.formula}</div>
                      <div className="text-sm font-mono text-slate-300">{f.calc}</div>
                    </div>
                    <div className={`text-4xl font-black ${f.color}`}>{f.pct}%</div>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div className={`h-full ${f.bg}`} style={{ width: `${Math.min(f.pct, 100)}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}