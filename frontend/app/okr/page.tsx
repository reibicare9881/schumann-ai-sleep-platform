"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DB } from "@/lib/store";
import { 
  Target, ChevronLeft, Save, Edit3, DollarSign, 
  TrendingUp, Award, Activity, Briefcase, Calculator, CheckCircle2 
} from "lucide-react";

export default function OKRPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [data, setData] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  
  // 編輯模式狀態
  const [editBonus, setEditBonus] = useState(false);
  const [editROI, setEditROI] = useState(false);

  // 獎金參數
  const [baseBudget, setBaseBudget] = useState(100000);
  const [activationPct, setActivationPct] = useState(80);
  const [valueMultiplier, setValueMultiplier] = useState(1.5);
  
  // ROI 參數
  const [sickDays, setSickDays] = useState(3);
  const [dailySalary, setDailySalary] = useState(3000);
  const [insSaving, setInsSaving] = useState(15000);
  const [prodGain, setProdGain] = useState(200000);
  const [implCost, setImplCost] = useState(80000);
  const [effGain, setEffGain] = useState(5);

  const isAdmin = session?.systemRole === "admin";
  const isDept = session?.systemRole === "dept_head";
  const code = session?.orgCode || "";

  // 載入資料與儲存的參數 [cite: 117]
  useEffect(() => {
    if (!code) {
      setReady(true);
      return;
    }
    Promise.all([DB.loadOrgRecs(code), DB.getOKR(code)]).then(([recs, saved]: [any, any]) => {
      setData(Array.isArray(recs) ? recs : []);
      if (saved) {
        if (saved.baseBudget) setBaseBudget(saved.baseBudget);
        if (saved.activationPct) setActivationPct(saved.activationPct);
        if (saved.valueMultiplier) setValueMultiplier(saved.valueMultiplier);
        if (saved.sickDays) setSickDays(saved.sickDays);
        if (saved.dailySalary) setDailySalary(saved.dailySalary);
        if (saved.insSaving) setInsSaving(saved.insSaving);
        if (saved.prodGain) setProdGain(saved.prodGain);
        if (saved.implCost) setImplCost(saved.implCost);
        if (saved.effGain) setEffGain(saved.effGain);
      }
      setReady(true);
    });
  }, [code]);

  if (loading || !ready) return null;

  // 阻擋沒有權限的使用者
  if (!session?.orgCode || (!isAdmin && !isDept)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">無權限訪問</h2>
        <p className="text-slate-500 mt-2">此頁面僅限單位平台管理者與部門主管訪問。</p>
        <button onClick={() => router.back()} className="mt-6 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">返回主選單</button>
      </div>
    );
  }

  // 儲存參數 [cite: 118]
  const saveParams = async () => {
    await DB.setOKR(code, {
      baseBudget, activationPct, valueMultiplier, 
      sickDays, dailySalary, insSaving, prodGain, implCost, effGain, 
      savedAt: new Date().toISOString()
    });
    setEditBonus(false);
    setEditROI(false);
  };

  // 核心統計計算 [cite: 120-123]
  const fd = isDept ? data.filter(r => r.dept === session.dept) : data;
  const n = fd.length;
  const totalOrgN = Math.max(data.length, 1);

  if (n === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Target className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">單位：{session?.orgName}</h2>
        <p className="text-slate-500 mt-2 mb-6">尚無成員評估記錄，無法計算 OKR 與獎金。</p>
        <button onClick={() => router.back()} className="px-6 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">← 返回主選單</button>
      </div>
    );
  }

  const avgOf = (key: string) => n > 0 ? fd.reduce((a, r) => a + (r[key] || 0), 0) / n : 0;
  const avgS = avgOf("sScore"), avgP = avgOf("pScore"), avgW = avgOf("wScore");
  const sHighRisk = fd.filter(r => ["orange", "red"].includes(r.sKey)).length;
  const sGreen = fd.filter(r => r.sKey === "green").length;
  const pGreen = fd.filter(r => r.pKey === "green").length;
  const comorbid = fd.filter(r => ["yellow", "orange", "red"].includes(r.sKey) && ["yellow", "orange", "red"].includes(r.pKey)).length;

  const hpi = n > 0 ? Math.round(100 - ((avgS / 28 * 40) + (avgP / 50 * 40) + (avgW / 30 * 20))) : 0;
  
  // 獎金試算 (Bonus Calc)
  const participationRate = Math.min(n / totalOrgN, 1);
  const tgt = activationPct / 100;
  const met = participationRate >= tgt;
  const greenPct = (sGreen + pGreen) / (2 * Math.max(n, 1));
  const baseBonus = met ? baseBudget * (Math.min(participationRate, 1) / tgt) : 0;
  const valBonus = met ? baseBudget * 0.3 * greenPct * valueMultiplier : 0;
  const totalBonus = Math.round(baseBonus + valBonus);
  const improveCoeff = sHighRisk > 0 ? Math.round(sGreen / sHighRisk * 100) : 0;

  // 投資報酬率試算 (ROI Calc)
  const improved = sGreen;
  const sickSav = sickDays * dailySalary * improved;
  const insS = insSaving * improved;
  const totalBenefit = sickSav + insS + prodGain;
  const netROI = totalBenefit - implCost;
  const roiPct = implCost > 0 ? Math.round(netROI / implCost * 100) : 0;
  const perPersonProd = Math.round((dailySalary / 22) * (effGain / 100) * 240);

  // OKR 目標陣列 [cite: 123]
  const OKRs = [
    { key: "O1", title: "提升員工睡眠健康", krs: [
      { k: "KR1", label: "睡眠綠燈比例 ≥ 40%", cur: Math.round(sGreen / n * 100), tgt: 40, rev: false },
      { k: "KR2", label: "睡眠紅燈比例 ≤ 10%", cur: Math.round(fd.filter(r => r.sKey === "red").length / n * 100), tgt: 10, rev: true }
    ]},
    { key: "O2", title: "降低疼痛對工作影響", krs: [
      { k: "KR1", label: "疼痛綠燈比例 ≥ 50%", cur: Math.round(pGreen / n * 100), tgt: 50, rev: false },
      { k: "KR2", label: "共病率 ≤ 15%", cur: Math.round(comorbid / n * 100), tgt: 15, rev: true }
    ]},
    { key: "O3", title: "整體健康促進與參與率", krs: [
      { k: "KR1", label: "HPI ≥ 70分", cur: hpi, tgt: 70, rev: false },
      { k: "KR2", label: `參與率 ≥ ${activationPct}%`, cur: Math.round(participationRate * 100), tgt: activationPct, rev: false }
    ]}
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* 標題與操作區 */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回主選單
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-600" /> OKR 績效儀表板
          </h1>
          <p className="text-xs text-slate-500 mt-2 bg-slate-100 inline-block px-3 py-1 rounded-full">
            🏢 {session.orgName} {isDept ? `· ${session.dept}` : '· 全單位'}
          </p>
        </div>
      </div>

      {/* 目標與關鍵結果 (OKR) 看板 */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" /> 目標與關鍵結果追蹤 (Objectives & Key Results)
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {OKRs.map(obj => (
            <div key={obj.key} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="font-bold text-indigo-800 mb-4">{obj.key}: {obj.title}</div>
              <div className="space-y-4">
                {obj.krs.map(k => {
                  const ok = k.rev ? k.cur <= k.tgt : k.cur >= k.tgt;
                  const pct = Math.min(k.rev ? Math.max(0, (k.tgt * 2 - k.cur) / k.tgt / 2 * 100) : k.cur / k.tgt * 100, 100);
                  return (
                    <div key={k.k}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-600">{k.k}: {k.label}</span>
                        <span className={ok ? "text-emerald-600" : "text-amber-600"}>
                          {ok ? "✅ 達標" : `目前 ${k.cur}%`}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* 左側：專案獎金計算器 */}
        <div className="bg-white border border-amber-200 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><DollarSign className="w-32 h-32" /></div>
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-lg font-bold text-amber-800 flex items-center gap-2">
              <Award className="w-5 h-5" /> 專案獎金池試算
            </h3>
            {isAdmin && (
              <button onClick={() => setEditBonus(!editBonus)} className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-amber-100">
                {editBonus ? <><Save className="w-3 h-3"/> 關閉設定</> : <><Edit3 className="w-3 h-3"/> 修改參數</>}
              </button>
            )}
          </div>

          {editBonus && isAdmin ? (
            <div className="bg-amber-50 p-5 rounded-2xl mb-6 border border-amber-100 animate-in fade-in relative z-10">
              <h4 className="text-xs font-bold text-amber-800 mb-4">⚙️ 獎金參數設定</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">基礎獎金額度</span>
                  <input type="number" value={baseBudget} onChange={e => setBaseBudget(Number(e.target.value))} className="w-28 px-3 py-1 rounded border border-amber-200 text-right outline-none" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">啟動門檻 (參與率%)</span>
                  <input type="number" value={activationPct} onChange={e => setActivationPct(Number(e.target.value))} className="w-28 px-3 py-1 rounded border border-amber-200 text-right outline-none" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">燈號改善加成倍數</span>
                  <input type="number" value={valueMultiplier} step="0.1" onChange={e => setValueMultiplier(Number(e.target.value))} className="w-28 px-3 py-1 rounded border border-amber-200 text-right outline-none" />
                </div>
              </div>
              <button onClick={saveParams} className="mt-4 w-full bg-amber-500 text-white py-2 rounded-lg text-sm font-bold shadow-sm">儲存設定</button>
            </div>
          ) : (
            <div className="mb-6 relative z-10">
              <div className={`p-6 rounded-2xl border ${met ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="text-sm text-slate-500 mb-1">本期試算可發放總額</div>
                <div className={`text-4xl font-black mb-2 ${met ? 'text-emerald-600' : 'text-slate-400'}`}>
                  NT$ {totalBonus.toLocaleString()}
                </div>
                <div className={`text-xs font-bold ${met ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {met ? "✅ 已達參與率啟動門檻" : `⚠ 未達門檻 (目前 ${Math.round(participationRate*100)}% / 需 ${activationPct}%)`}
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl p-5 text-xs text-slate-600 leading-relaxed border border-slate-100 relative z-10">
            <ul className="space-y-1 mb-2 font-mono">
              <li>• 基礎獎金: NT$ {Math.round(baseBonus).toLocaleString()}</li>
              <li>• 價值加成: NT$ {Math.round(valBonus).toLocaleString()}</li>
            </ul>
            <p className="border-t border-slate-200 pt-2 text-[10px] text-slate-400">
              加權係數 = 轉綠人數({sGreen}) ÷ 高風險人數({sHighRisk}) × {valueMultiplier}倍 = <strong>{improveCoeff}%</strong>
            </p>
          </div>
        </div>

        {/* 右側：ROI 經濟效益計算器 */}
        <div className="bg-white border border-plum-200 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32 text-purple-900" /></div>
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
              <Calculator className="w-5 h-5" /> 投資報酬率 (ROI) 試算
            </h3>
            {isAdmin && (
              <button onClick={() => setEditROI(!editROI)} className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-purple-100">
                {editROI ? <><Save className="w-3 h-3"/> 關閉設定</> : <><Edit3 className="w-3 h-3"/> 修改參數</>}
              </button>
            )}
          </div>

          {editROI && isAdmin ? (
            <div className="bg-purple-50 p-5 rounded-2xl mb-6 border border-purple-100 animate-in fade-in relative z-10">
              <h4 className="text-xs font-bold text-purple-800 mb-4">⚙️ 效益參數設定</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">預估減少病假天數</span>
                  <input type="number" value={sickDays} onChange={e => setSickDays(Number(e.target.value))} className="w-24 px-3 py-1 rounded border border-purple-200 text-right outline-none" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">平均日薪</span>
                  <input type="number" value={dailySalary} onChange={e => setDailySalary(Number(e.target.value))} className="w-24 px-3 py-1 rounded border border-purple-200 text-right outline-none" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">保險節省 (每人)</span>
                  <input type="number" value={insSaving} onChange={e => setInsSaving(Number(e.target.value))} className="w-24 px-3 py-1 rounded border border-purple-200 text-right outline-none" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">系統導入成本</span>
                  <input type="number" value={implCost} onChange={e => setImplCost(Number(e.target.value))} className="w-24 px-3 py-1 rounded border border-purple-200 text-right outline-none" />
                </div>
              </div>
              <button onClick={saveParams} className="mt-4 w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-bold shadow-sm">儲存設定</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
              <div className={`p-5 rounded-2xl border ${netROI >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                <div className="text-xs text-slate-500 mb-1">年度淨效益</div>
                <div className={`text-2xl font-black ${netROI >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>NT$ {Math.abs(netROI).toLocaleString()}</div>
              </div>
              <div className="p-5 rounded-2xl border bg-amber-50 border-amber-100">
                <div className="text-xs text-slate-500 mb-1">投資報酬率 ROI</div>
                <div className="text-2xl font-black text-amber-600">{roiPct}%</div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl p-5 text-xs text-slate-600 leading-relaxed border border-slate-100 relative z-10 space-y-2">
            <div className="flex justify-between border-b border-slate-200 pb-1"><span>病假節省</span><span className="font-bold text-slate-800">NT$ {sickSav.toLocaleString()}</span></div>
            <div className="flex justify-between border-b border-slate-200 pb-1"><span>保險節省</span><span className="font-bold text-slate-800">NT$ {insS.toLocaleString()}</span></div>
            <div className="flex justify-between border-b border-slate-200 pb-1"><span>生產力提升</span><span className="font-bold text-slate-800">NT$ {prodGain.toLocaleString()}</span></div>
            <div className="flex justify-between text-rose-600 font-bold"><span>扣除導入成本</span><span>- NT$ {implCost.toLocaleString()}</span></div>
          </div>
        </div>

      </div>

      {/* 3階段健康認可制度 [cite: 131] */}
      <div className="bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 md:p-8">
        <h3 className="text-lg font-bold text-emerald-800 mb-6 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> 企業健康認可制度 (3-Stage Recognition)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { s: "第一階段：自主評核", d: "完成健康評估問卷，落實自我健康管理意識。", met: n > 0, th: `已完成評估 (${n}人)` },
            { s: "第二階段：優良肯定", d: "HPI達70分以上，個人評估顯示燈號轉綠。", met: hpi >= 70, th: `HPI ${hpi}/70分` },
            { s: "第三階段：績優表揚", d: "達成獎金啟動門檻，HPI達75分。", met: met && hpi >= 75, th: `需達標且 HPI≥75` }
          ].map((s, i) => (
            <div key={i} className={`p-5 rounded-2xl border transition-all ${s.met ? 'bg-white border-emerald-300 shadow-sm' : 'bg-white/50 border-emerald-100 opacity-70'}`}>
              <div className="text-xs font-black text-emerald-400 mb-2">STAGE 0{i+1}</div>
              <h4 className={`text-sm font-bold mb-2 ${s.met ? 'text-slate-800' : 'text-slate-600'}`}>{s.s}</h4>
              <p className="text-xs text-slate-500 mb-4 h-10">{s.d}</p>
              <div className={`text-xs font-bold inline-flex items-center gap-1 px-2 py-1 rounded-full ${s.met ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {s.met ? "✅ 已達成" : `⏳ ${s.th}`}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}