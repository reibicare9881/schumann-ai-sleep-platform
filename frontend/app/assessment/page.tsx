"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { SQ, PQ, WQ, getSR, getPR, C } from "@/lib/config";
import { DB } from "@/lib/store";
import { 
  ChevronLeft, ChevronRight, CheckCircle2, User, 
  Moon, Activity, Briefcase 
} from "lucide-react";

export default function AssessmentPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [step, setStep] = useState(0); // 0:基本資料, 1:睡眠, 2:疼痛, 3:工作
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 表單狀態 ---
  const [profile, setProfile] = useState<any>({
    age: "", gender: "male", height: "", weight: "", 
    dept: "", orgRole: "", shiftWork: "否"
  });
  const [sAns, setSAns] = useState<Record<string, number>>({});
  const [pAns, setPAns] = useState<Record<string, number>>({});
  const [wAns, setWAns] = useState<Record<string, number>>({});

  // 確保已登入
  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [session, loading, router]);

  if (loading || !session) return null;

  // --- 提交處理 ---
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // 1. 計算分數
    const sScore = Object.values(sAns).reduce((a, b) => a + b, 0);
    const pScore = Object.values(pAns).reduce((a, b) => a + b, 0);
    const wScore = Object.values(wAns).reduce((a, b) => a + b, 0);
    
    const sLevel = getSR(sScore);
    const pLevel = getPR(pScore);

    // 2. 準備報告物件 (這裡簡化了 AI 建議生成，直接給基本提示)
    const report = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      ts: new Date().toISOString(),
      session: { systemRole: session.systemRole, name: session.name },
      profile: { ...profile, name: session.name },
      sScore, sLevel, sAns,
      pScore, pLevel, pAns,
      wScore, wAns,
      recs: {
        generalHealth: "建議維持規律作息，注意飲食與適度運動。",
        reibiProducts: sScore >= 15 ? "您的睡眠分數偏高，建議可體驗 REIBI 舒曼波療法以協助放鬆。" : "目前狀況良好，可持續追蹤。"
      }
    };

    // 3. 儲存資料庫
    await DB.saveReport(report);
    if (session.orgCode) {
      await DB.saveOrgRec(session.orgCode, report);
    }

    // 4. 完成跳轉
    router.push("/history");
  };

  // --- 步驟設定 ---
  const steps = [
    { id: 0, title: "基本資料", icon: <User className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-100" },
    { id: 1, title: "睡眠評估", icon: <Moon className="w-5 h-5" />, color: "text-indigo-600", bg: "bg-indigo-100" },
    { id: 2, title: "疼痛影響", icon: <Activity className="w-5 h-5" />, color: "text-rose-600", bg: "bg-rose-100" },
    { id: 3, title: "工作效率", icon: <Briefcase className="w-5 h-5" />, color: "text-amber-600", bg: "bg-amber-100" }
  ];

  const canGoNext = () => {
    if (step === 0) return profile.age && profile.height && profile.weight;
    if (step === 1) return Object.keys(sAns).length === SQ.length;
    if (step === 2) return Object.keys(pAns).length === PQ.length;
    if (step === 3) return Object.keys(wAns).length === WQ.length;
    return false;
  };

  // --- 元件：分數選擇按鈕器 ---
  const ScorePicker = ({ value, onChange, max }: { value?: number, onChange: (v: number) => void, max: number }) => (
    <div className="flex gap-1 sm:gap-2 mt-4">
      {Array.from({length: max + 1}, (_, i) => i).map((num) => (
        <button
          key={num}
          onClick={() => onChange(num)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border
            ${value === num 
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-md transform scale-105' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          {num}
        </button>
      ))}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      
      {/* 頂部導航列 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ChevronLeft className="w-5 h-5" /> 返回
        </button>
        <h1 className="text-xl font-bold text-slate-800">健康自主評估</h1>
        <div className="w-16"></div>
      </div>

      {/* 步驟進度條 */}
      <div className="flex justify-between items-center mb-10 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-10 rounded-full transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }}></div>
        
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border-2 ${
              step >= i ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-400'
            }`}>
              {step > i ? <CheckCircle2 className="w-6 h-6" /> : s.icon}
            </div>
            <span className={`text-xs font-bold ${step >= i ? 'text-emerald-700' : 'text-slate-400'}`}>{s.title}</span>
          </div>
        ))}
      </div>

      {/* 主要內容區 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 mb-8 min-h-[400px]">
        
        {/* Step 0: 基本資料 */}
        {step === 0 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User className="w-6 h-6" /></div>
              <h2 className="text-2xl font-bold text-slate-800">個人基本資料</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">年齡</label>
                <input type="number" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="歲" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">性別</label>
                <select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                  <option value="male">男性</option><option value="female">女性</option><option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">身高 (cm)</label>
                <input type="number" value={profile.height} onChange={e => setProfile({...profile, height: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">體重 (kg)</label>
                <input type="number" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              {session.orgName && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">所屬部門</label>
                    <input type="text" value={profile.dept} onChange={e => setProfile({...profile, dept: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">職稱</label>
                    <input type="text" value={profile.orgRole} onChange={e => setProfile({...profile, orgRole: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 1: 睡眠評估 (ISI) */}
        {step === 1 && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Moon className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">睡眠品質評估 (ISI)</h2>
                  <p className="text-xs text-slate-500 mt-1">請根據過去一週的狀況作答</p>
                </div>
              </div>
              <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{Object.keys(sAns).length} / 7 題</span>
            </div>
            
            {SQ.map((q, idx) => (
              <div key={q.id} className={`p-5 rounded-xl border transition-colors ${sAns[q.id] !== undefined ? 'bg-slate-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                <div className="flex gap-3 mb-2">
                  <span className="text-xl">{q.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Q{idx + 1} · {q.d}</div>
                    <div className="text-sm text-slate-800 font-medium">{q.text}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-4">
                  {q.opts.map((opt) => (
                    <button
                      key={opt.s}
                      onClick={() => setSAns({...sAns, [q.id]: opt.s})}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-all text-center border ${
                        sAns[q.id] === opt.s 
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.l} <span className="block mt-1 opacity-70 text-[10px]">({opt.s}分)</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2: 疼痛評估 (BPI) */}
        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><Activity className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">疼痛影響評估 (BPI)</h2>
                  <p className="text-xs text-slate-500 mt-1">0分代表無影響，10分代表極度嚴重</p>
                </div>
              </div>
              <span className="text-sm font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">{Object.keys(pAns).length} / 5 題</span>
            </div>

            {PQ.map((q, idx) => (
              <div key={q.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                 <div className="flex gap-3 mb-2">
                  <span className="text-xl">{q.icon}</span>
                  <div>
                    <div className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Q{idx + 1} · {q.d}</div>
                    <div className="text-sm text-slate-800 font-medium">{q.text}</div>
                  </div>
                </div>
                <ScorePicker value={pAns[q.id]} onChange={(v) => setPAns({...pAns, [q.id]: v})} max={10} />
              </div>
            ))}
          </div>
        )}

        {/* Step 3: 工作效率 (WQ) */}
        {step === 3 && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Briefcase className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">工作效率評估</h2>
                  <p className="text-xs text-slate-500 mt-1">評估健康狀況對您工作的影響</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{Object.keys(wAns).length} / 3 題</span>
            </div>

            {WQ.map((q, idx) => (
              <div key={q.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
                 <div className="flex gap-3 mb-2">
                  <span className="text-xl text-amber-500">💼</span>
                  <div>
                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">W{idx + 1} · {q.d}</div>
                    <div className="text-sm text-slate-800 font-medium">{q.text}</div>
                  </div>
                </div>
                <ScorePicker value={wAns[q.id]} onChange={(v) => setWAns({...wAns, [q.id]: v})} max={10} />
              </div>
            ))}
          </div>
        )}

      </div>

      {/* 底部控制列 */}
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => setStep(Math.max(0, step - 1))}
          className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${step === 0 ? 'invisible' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <ChevronLeft className="w-5 h-5" /> 上一步
        </button>
        
        {step < 3 ? (
          <button 
            onClick={() => setStep(step + 1)}
            disabled={!canGoNext()}
            className="flex-1 max-w-xs px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            下一步 <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={!canGoNext() || isSubmitting}
            className="flex-1 max-w-xs px-6 py-3 rounded-xl font-bold text-white bg-linear-to-r from-emerald-600 to-teal-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? "產生報告中..." : "送出並產生報告"} <CheckCircle2 className="w-5 h-5" />
          </button>
        )}
      </div>

    </div>
  );
}