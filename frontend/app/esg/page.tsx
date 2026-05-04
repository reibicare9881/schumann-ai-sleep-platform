"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { MappedSleepReport, BackendSleepReport } from "@/types"; // 🟢 加入型別
import API from "@/lib/api";
import { can } from "@/lib/config";
import { 
  Leaf, ChevronLeft, Download, Calendar, 
  BarChart, Edit3, Save, TrendingUp, ShieldAlert, Globe
} from "lucide-react";

export default function ESGPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  // 🟢 替換為嚴謹的型別
  const [data, setData] = useState<MappedSleepReport[]>([]);
  const [ready, setReady] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [params, setParams] = useState({
    sickDays: 3, dailySalary: 3000, insSaving: 15000, effGain: 5, implCost: 80000
  });
  const [editP, setEditP] = useState(false);

  useEffect(() => {
    if (!session?.orgCode) {
      setReady(true);
      return;
    }

    // 🟢 1. 安全組裝網址參數
    const params = new URLSearchParams({
      org_code: session.orgCode,
      page: "1",
      size: "1000"
    });
    // 如果有選日期才加進去
    if (dateFrom) params.append("start_date", dateFrom);
    if (dateTo) params.append("end_date", dateTo);

    // 🟢 2. 明確宣告 method: 'GET'
    Promise.all([
      API.request(`/api/org/records?${params.toString()}`, { method: 'GET' }),
      API.getOrgSettings(session.orgCode)
    ]).then(([recsRes, savedRes]: [any, any]) => {
      
      if (recsRes.status === 'success' && recsRes.data) {
        // 型別綁定與資料清理 mapping
        const mappedData: MappedSleepReport[] = recsRes.data.map((d: BackendSleepReport) => ({
             ...d,
             id: d.id,
             uid: d.user_id,
             ts: d.created_at,             
             sScore: d.sleep_score,        
             pScore: d.pain_score,
             wScore: d.work_score,
             sKey: d.sleep_level,          
             pKey: d.pain_level,
             profile: { 
               ...d.profile, 
               name: d.profile?.name || "未知使用者" 
             },
             dept: d.profile?.dept || "未分類部門",
        }));
        setData(mappedData);
      } else {
        setData([]);
      }

      if (savedRes.status === 'success' && savedRes.data) {
        const dbData = savedRes.data;
        setParams(p => ({
          ...p,
          sickDays: dbData.sick_days || p.sickDays,
          dailySalary: dbData.daily_salary || p.dailySalary,
          insSaving: dbData.ins_saving || p.insSaving,
          effGain: dbData.eff_gain || p.effGain,
          implCost: dbData.impl_cost || p.implCost
        }));
      }
      setReady(true);
    });
  }, [session?.orgCode, dateFrom, dateTo]);

  if (loading || !ready) return null;

  if (!can(session?.systemRole, "view_esg")) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">無權限訪問</h2>
        <p className="text-slate-500 mt-2">ESG 健康效益報告涉及企業營運機密，僅限單位平台管理者訪問。</p>
        <button onClick={() => router.back()} className="mt-6 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">返回主選單</button>
      </div>
    );
  }

  // 🟢 無情刪除多餘的 dateFrom/dateTo 前端過濾，直接使用 data
  const n = data.length;
  const sHighRisk = data.filter(r => ["orange", "red"].includes(r.sKey || "")).length;
  const sGreen = data.filter(r => r.sKey === "green").length;
  const improved = sGreen;
  
  const prevalencePct = n > 0 ? Math.round(sHighRisk / n * 100) : 0;
  const improvePct = sHighRisk > 0 ? Math.round(sGreen / sHighRisk * 100) : 0;
  const impactPct = n > 0 ? Math.round(sGreen / n * 100) : 0;
  
  const hpi = n > 0 ? Math.round(100 - data.reduce((a, r) => a + (r.sScore || 0), 0) / n / 28 * 100) : 0;
  
  const sickSav = params.sickDays * params.dailySalary * improved;
  const insS = params.insSaving * improved;
  const perPersonProd = Math.round((params.dailySalary / 22) * (params.effGain / 100) * 240);
  const prodTotal = perPersonProd * improved;
  const totalBenefit = params.implCost > 0 ? Math.max(0, sickSav + insS + prodTotal - params.implCost) : 0;
  const roiPct = params.implCost > 0 ? Math.round((sickSav + insS + prodTotal - params.implCost) / params.implCost * 100) : 0;

  const exportESG = () => {
    const lines = [
      `REIBI麗媚生化科技 · ESG健康效益報告`,
      `單位：${session.orgName}`,
      `日期區間：${dateFrom || "全部"}～${dateTo || "全部"}`,
      `報告產出：${new Date().toLocaleDateString("zh-TW")}`,
      ``,
      `= ESG人力資本健康指標 =`,
      `評估人次：${n}人`,
      `健康促進指數(HPI)：${hpi}/100`,
      `睡眠問題盛行率：${prevalencePct}%`,
      `健康改善率(KPI)：${improvePct}%  ← 主要KPI`,
      `全體健康貢獻率：${impactPct}%`,
      ``,
      `= ROI 健康經濟效益 =`,
      `病假節省：NT$${sickSav.toLocaleString()}`,
      `保險節省：NT$${insS.toLocaleString()}`,
      `生產力提升：NT$${prodTotal.toLocaleString()}`,
      `導入成本：NT$${params.implCost.toLocaleString()}`,
      `年度淨效益：NT$${totalBenefit.toLocaleString()}`,
      `投資報酬率(ROI)：${roiPct}%`,
      ``,
      `= ESG意涵 =`,
      `S (Social)：提升員工健康識能，降低病假率${params.sickDays}天/人/年`,
      `G (Governance)：數位化健康管理，透明KPI追蹤`,
      `E (Environment)：減少醫療資源浪費，促進永續健康`,
      ``,
      `⚠ 本報告依REIBI健康管理系統自動統計，數據為去識別化。`
    ];
    const b = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = `ESG健康效益報告.txt`; a.click();
    URL.revokeObjectURL(u);
  };

  const saveParams = async () => {
    try {
      await API.updateOrgSettings(session.orgCode, params);
      setEditP(false);
    } catch (err) {
      alert("儲存失敗，請確認您是否有管理員權限。");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* 標題與操作區 */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回主選單
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Leaf className="w-6 h-6 text-green-600" /> ESG 健康效益報告
          </h1>
          <p className="text-xs text-slate-500 mt-2 bg-slate-100 inline-block px-3 py-1 rounded-full">
            企業永續 · 人力資本健康 · 降本/增效/社會責任
          </p>
        </div>
        
        <button onClick={exportESG} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-green-700 shadow-md transition-colors">
          <Download className="w-4 h-4" /> 下載永續報告資料
        </button>
      </div>

      {/* ESG 核心論述區塊 */}
      <div className="bg-linear-to-r from-emerald-50 to-green-50 border border-green-200 rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
        <h3 className="text-lg font-bold text-green-800 mb-6 flex items-center gap-2">
          <Globe className="w-5 h-5" /> ESG × 企業健康管理利基點
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-green-900 leading-relaxed">
          <div className="bg-white/60 p-5 rounded-2xl border border-white/80">
            <div className="font-bold text-green-700 mb-2 text-base">S (Social 社會)</div>
            提升員工健康識能與自主管理，降低病假率，增進工作生活品質與職場安全。
          </div>
          <div className="bg-white/60 p-5 rounded-2xl border border-white/80">
            <div className="font-bold text-green-700 mb-2 text-base">G (Governance 治理)</div>
            數位化健康 KPI 追蹤，透明化管理，符合衛福部健促政策目標與企業責任。
          </div>
          <div className="bg-white/60 p-5 rounded-2xl border border-white/80">
            <div className="font-bold text-green-700 mb-2 text-base">E (Environment 環境)</div>
            減少不必要醫療資源與藥物浪費，促進永續健康生態圈。
          </div>
        </div>
        <div className="mt-6 font-bold text-green-700 text-sm bg-white/50 inline-block px-4 py-2 rounded-lg">
          📊 數位燈號回饋機制，將健康識能轉化為具體財務績效與國家政策達成率。
        </div>
      </div>

      {/* 篩選與指標區塊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400"/> 日期區間過濾</h3>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">起始日期</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">結束日期</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-medium bg-slate-50 p-2 rounded-lg text-center">
            結算資料：共 {n} / {data.length} 筆
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart className="w-5 h-5 text-purple-600"/> 永續發展健康指標</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: "HPI健康指數", v: hpi + "/100", desc: "企業整體健康度", c: hpi >= 75 ? "text-green-600" : hpi >= 50 ? "text-amber-600" : "text-rose-600", bg: "bg-green-50" },
              { l: "改善率 ★ 主要", v: improvePct + "%", desc: "健康轉綠比例", c: improvePct >= 70 ? "text-green-600" : "text-amber-600", bg: "bg-emerald-50" },
              { l: "問題盛行率", v: prevalencePct + "%", desc: "高風險人數占比", c: "text-amber-600", bg: "bg-amber-50" },
              { l: "全體貢獻率", v: impactPct + "%", desc: "企業總體提升", c: "text-purple-600", bg: "bg-purple-50" }
            ].map(s => (
              <div key={s.l} className="border border-slate-100 rounded-2xl p-4 text-center hover:shadow-sm transition-all">
                <div className="text-[10px] font-bold text-slate-400 mb-1">{s.l}</div>
                <div className={`text-2xl font-black mb-1 ${s.c}`}>{s.v}</div>
                <div className="text-[10px] text-slate-500">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            💡 <strong>ESG報告建議：</strong>以「健康改善率 {improvePct}%」為主要對外揭露指標。依據國際職場健康促進計畫標竿，每投入 1 元健促成本，預期可回收 3~5 元生產力價值。
          </div>
        </div>
      </div>

      {/* ROI 經濟效益 */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32 text-slate-900" /></div>
        
        <div className="flex items-center justify-between mb-6 relative z-10">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            💰 財務化效益 (ROI) 轉換評估
          </h3>
          <button onClick={() => setEditP(!editP)} className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-slate-200">
            {editP ? <><Save className="w-3 h-3"/> 關閉參數</> : <><Edit3 className="w-3 h-3"/> 修改計算參數</>}
          </button>
        </div>

        {editP && (
          <div className="bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-200 animate-in fade-in relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="block text-xs text-slate-500 mb-1">減少病假天數/人</label><input type="number" value={params.sickDays} onChange={e=>setParams({...params, sickDays: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">平均日薪 (NT$)</label><input type="number" value={params.dailySalary} onChange={e=>setParams({...params, dailySalary: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">保險節省 (NT$)</label><input type="number" value={params.insSaving} onChange={e=>setParams({...params, insSaving: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">效率提升 (%)</label><input type="number" value={params.effGain} onChange={e=>setParams({...params, effGain: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">導入成本 (NT$)</label><input type="number" value={params.implCost} onChange={e=>setParams({...params, implCost: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            </div>
            <button onClick={saveParams} className="mt-4 bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-900">儲存參數設定</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex justify-between border-b border-slate-100 pb-2"><span>病假節省 (<span className="text-xs text-slate-400">{improved}人</span>)</span><span className="font-bold">NT$ {sickSav.toLocaleString()}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-2"><span>保險費節約</span><span className="font-bold">NT$ {insS.toLocaleString()}</span></div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <div>生產力產出提升<div className="text-[10px] text-slate-400 mt-1">WPAI = (日薪/22)×{params.effGain}%×240天</div></div>
              <span className="font-bold mt-1">NT$ {prodTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-500 font-bold border-b border-slate-100 pb-2"><span>扣除導入成本</span><span>- NT$ {params.implCost.toLocaleString()}</span></div>
          </div>
          
          <div className="flex flex-col justify-center gap-4">
            <div className={`p-5 rounded-2xl border ${totalBenefit > 0 ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'} text-center`}>
              <div className="text-xs text-slate-500 mb-1">年度淨財務效益</div>
              <div className={`text-3xl font-black ${totalBenefit > 0 ? 'text-green-700' : 'text-rose-600'}`}>NT$ {totalBenefit.toLocaleString()}</div>
            </div>
            <div className="p-5 rounded-2xl border bg-amber-50 border-amber-200 text-center">
              <div className="text-xs text-slate-500 mb-1">健康投資報酬率 (ROI)</div>
              <div className="text-3xl font-black text-amber-700">{roiPct}%</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}