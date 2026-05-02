"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { SQ, PQ, WQ, getSR, getPR, PAIN_LOCS } from "@/lib/config";
import API from "@/lib/api";
import { 
  ChevronLeft, ChevronRight, CheckCircle2, User, 
  Moon, Activity, Briefcase, HeartPulse, ScrollText
} from "lucide-react";

// ══ 原始系統的預設衛教庫 (Fallback Recommendations) ══
const FR = {
  generalHealth: "依據衛福部2023–2026年國民健康白皮書，健康自主管理為慢性病防治核心策略。建議每日監測血壓血糖，每週150分鐘中等強度有氧運動，並落實規律作息與睡眠衛生。三高患者應積極參與整合照護計畫，定期完成年度健康檢查，透過數位化工具持續追蹤健康型態改變。",
  painEducation: "2023年IASP建議採多模式疼痛管理，整合藥物與非藥物治療。疼痛神經科學教育（PNE）有助改變對疼痛的認知，降低恐懼迴避行為。CBT-P及ACT均對慢性疼痛有效。漸進式復健運動可減少25–40%疼痛強度，記錄疼痛日記有助醫師精準調整治療方向。",
  sleepEducation: "失眠認知行為治療（CBT-I）為2024年指南一線治療，優於藥物且無依賴性。核心技術：睡眠限制療法、刺激控制、放鬆訓練、認知重構。建議固定起床時間、睡前1小時避免藍光、臥室保持18–20°C。輪班者建議使用遮光窗簾與白噪音輔助生理時鐘調節。",
  dietaryAdvice: "地中海飲食持續顯示對三高、慢性疼痛及睡眠有正向效益。增加Omega-3（深海魚）降炎症；鎂（南瓜子）助眠；色胺酸（香蕉）促褪黑激素合成。高血壓者採DASH飲食；糖尿病者注意升糖指數；避免睡前2小時大量進食。",
  physicalTherapy: "多模式物理治療可改善慢性疼痛（30–40%）及睡眠品質（PSQI改善3–4分）。每週3–5次有氧運動；辦公室每小時起身3分鐘；水中運動適合關節疼痛者；瑜伽太極對疼痛與睡眠均有實證效益。",
  reibiProducts: "REIBI舒曼波療法（7.83Hz）調節自律神經、降低皮質醇、提升深度睡眠δ波，建議每晚睡前30–45分鐘，持續4–6週。REIBI LA200雷射（LLLT，650–808nm）促進細胞ATP合成、抑制炎性介質，建議每週2–3次、每次10–15分鐘，配合物理治療效果倍增。"
};

export default function AssessmentPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  // --- 隱私聲明狀態 ---
  const [showDecl, setShowDecl] = useState(true);
  const [declTs, setDeclTs] = useState<string | null>(null);
  const [agrees, setAgrees] = useState({ c1: false, c2: false, c3: false, c4: false });
  const allAgreed = Object.values(agrees).every(Boolean);

  const [step, setStep] = useState(0); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 表單狀態 ---
  const [profile, setProfile] = useState<any>({
    age: "", gender: "male", height: "", weight: "", 
    dept: "", orgRole: "", industry: "科技業", shiftWork: "否",
    hypertension: "否", diabetes: "否", hyperlipidemia: "否", heartDisease: "否",
    medications: "", painLocations: []
  });
  const [sAns, setSAns] = useState<Record<string, number>>({});
  const [pAns, setPAns] = useState<Record<string, number>>({});
  const [wAns, setWAns] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!loading && !session) router.push("/login");
  }, [session, loading, router]);

  if (loading || !session) return null;

  // --- 處理同意聲明 ---
  const handleAgreeDeclaration = () => {
    setDeclTs(new Date().toISOString());
    setShowDecl(false);
  };

  // 處理疼痛部位複選
  const togglePainLoc = (loc: string) => {
    setProfile((prev: any) => ({
      ...prev,
      painLocations: prev.painLocations.includes(loc) 
        ? prev.painLocations.filter((l: string) => l !== loc)
        : [...prev.painLocations, loc]
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
        // 1. 打包後端需要的資料格式 (對應 main.py 的 AssessmentData)
        const payload = {
            user_id: session?.apiSession?.user_id || session?.uid || session?.id || "", // 從 session 抓取目前登入者的 ID
            profile: {
                name: session.name,
                age: Number(profile.age) || 0,
                gender: profile.gender,
                height: Number(profile.height) || 0,
                weight: Number(profile.weight) || 0,
                dept: profile.dept,
                orgRole: profile.orgRole,
                industry: profile.industry,
                shiftWork: profile.shiftWork,
                hypertension: profile.hypertension,
                diabetes: profile.diabetes,
                hyperlipidemia: profile.hyperlipidemia,
                heartDisease: profile.heartDisease,
                medications: profile.medications,
                painLocations: profile.painLocations
            },
            sleep_scores: sAns,
            pain_scores: pAns,
            work_scores: wAns
        };

        // 2. 呼叫我們已經上好鎖的 FastAPI 端點
        const result = await API.request('/api/sleep/assessment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // 3. 成功後跳轉到報告頁面 (加入 as any 繞過 TS 檢查)
        if (result.status === 'success') {
            // 使用 (result as any) 來告訴 TypeScript 強制讀取 report_id
            router.push(`/report/${(result as any).report_id}`);
        } else {
            console.error("提交失敗:", result);
            alert("提交失敗，請稍後再試！");
            setIsSubmitting(false);
        }

    } catch (error) {
        console.error("API 錯誤:", error);
        alert("伺服器連線異常，請檢查網路狀態。");
        setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 0, title: "基本資料", icon: <User className="w-5 h-5" /> },
    { id: 1, title: "睡眠評估", icon: <Moon className="w-5 h-5" /> },
    { id: 2, title: "疼痛影響", icon: <Activity className="w-5 h-5" /> },
    { id: 3, title: "工作效率", icon: <Briefcase className="w-5 h-5" /> }
  ];

  const canGoNext = () => {
    if (step === 0) return profile.age && profile.height && profile.weight;
    if (step === 1) return Object.keys(sAns).length === SQ.length;
    if (step === 2) return Object.keys(pAns).length === PQ.length;
    if (step === 3) return Object.keys(wAns).length === WQ.length;
    return false;
  };

  const ScorePicker = ({ value, onChange, max }: { value?: number, onChange: (v: number) => void, max: number }) => (
    <div className="flex gap-1 sm:gap-2 mt-4">
      {Array.from({length: max + 1}, (_, i) => i).map((num) => (
        <button key={num} onClick={() => onChange(num)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${value === num ? 'bg-emerald-500 text-white border-emerald-600 shadow-md transform scale-105' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          {num}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* 🛡️ 隱私同意聲明彈出視窗 */}
      {showDecl && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center mb-6">
              <ScrollText className="w-12 h-12 text-teal-600 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-slate-800 mb-1">誠實填寫聲明</h2>
              <p className="text-xs text-slate-500">請仔細閱讀並勾選所有條款以開始評估</p>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6 space-y-3">
              {[
                { k: "c1", t: "本人聲明所填寫之所有健康資訊均為真實狀況，無故意提供不實資料。" },
                { k: "c2", t: "本人理解此評估目的為健康自主管理促進，非醫療診斷依據。" },
                { k: "c3", t: "本人同意個人填寫資訊依本系統隱私政策處理，單位層級僅接收去識別化統計。" },
                { k: "c4", t: "本人已閱讀並理解以上聲明內容，自願完成本次健康評估問卷。" }
              ].map(item => (
                <div 
                  key={item.k} 
                  onClick={() => setAgrees(p => ({ ...p, [item.k]: !p[item.k as keyof typeof p] }))} 
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors border-2 ${agrees[item.k as keyof typeof agrees] ? 'bg-teal-500 border-teal-500 text-white' : 'bg-white border-slate-300 group-hover:border-teal-400'}`}>
                    {agrees[item.k as keyof typeof agrees] && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-sm text-slate-700 leading-relaxed select-none">{item.t}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => router.back()} 
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleAgreeDeclaration} 
                disabled={!allAgreed} 
                className="flex-[2] py-3 rounded-xl border border-transparent font-bold text-white transition-all disabled:bg-slate-200 disabled:text-slate-400 bg-linear-to-r from-teal-600 to-[#1a6474] hover:shadow-lg"
              >
                {allAgreed ? "✓ 同意，開始填寫" : "請勾選所有選項"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📝 主要問卷區塊 (若彈窗開啟則隱藏) */}
      <div className={`max-w-3xl mx-auto px-4 py-8 transition-opacity duration-300 ${showDecl ? 'opacity-0 h-0 overflow-hidden py-0' : 'opacity-100'}`}>
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1"><ChevronLeft className="w-5 h-5" /> 返回</button>
          <h1 className="text-xl font-bold text-slate-800">健康自主評估</h1>
          <div className="w-16"></div>
        </div>

        <div className="flex justify-between items-center mb-10 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-10 rounded-full transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }}></div>
          {steps.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border-2 ${step >= i ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300 text-slate-400'}`}>
                {step > i ? <CheckCircle2 className="w-6 h-6" /> : s.icon}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 mb-8 min-h-[400px]">
          
          {step === 0 && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div>
                <h3 className="text-sm font-bold text-emerald-700 border-b border-emerald-100 pb-2 mb-4">基本身體數值</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs text-slate-500 mb-1">年齡</label><input type="number" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">性別</label><select value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500"><option value="male">男性</option><option value="female">女性</option><option value="other">其他</option></select></div>
                  <div><label className="block text-xs text-slate-500 mb-1">身高 (cm)</label><input type="number" value={profile.height} onChange={e => setProfile({...profile, height: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">體重 (kg)</label><input type="number" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-indigo-700 border-b border-indigo-100 pb-2 mb-4">職場與慢病資訊</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {session.orgName && (
                    <>
                      <div><label className="block text-xs text-slate-500 mb-1">部門</label><input type="text" value={profile.dept} onChange={e => setProfile({...profile, dept: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                      <div><label className="block text-xs text-slate-500 mb-1">職稱</label><input type="text" value={profile.orgRole} onChange={e => setProfile({...profile, orgRole: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    </>
                  )}
                  <div><label className="block text-xs text-slate-500 mb-1">行業別</label><select value={profile.industry} onChange={e => setProfile({...profile, industry: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"><option>科技業</option><option>金融業</option><option>醫療院所</option><option>製造業</option><option>服務業/零售</option><option>其他</option></select></div>
                  <div><label className="block text-xs text-slate-500 mb-1">輪班情況</label><select value={profile.shiftWork} onChange={e => setProfile({...profile, shiftWork: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"><option>否</option><option>日夜輪班</option><option>大夜班（固定）</option><option>早晚班</option></select></div>
                  <div><label className="block text-xs text-slate-500 mb-1">高血壓</label><select value={profile.hypertension} onChange={e => setProfile({...profile, hypertension: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"><option>否</option><option>是（已控制）</option><option>是（未控制）</option><option>邊緣值</option></select></div>
                  <div><label className="block text-xs text-slate-500 mb-1">糖尿病</label><select value={profile.diabetes} onChange={e => setProfile({...profile, diabetes: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"><option>否</option><option>第一型</option><option>第二型</option><option>前期</option></select></div>
                  <div><label className="block text-xs text-slate-500 mb-1">高血脂</label><select value={profile.hyperlipidemia} onChange={e => setProfile({...profile, hyperlipidemia: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"><option>否</option><option>是（已控制）</option><option>邊緣值</option></select></div>
                  <div><label className="block text-xs text-slate-500 mb-1">心臟疾病</label><select value={profile.heartDisease} onChange={e => setProfile({...profile, heartDisease: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"><option>否</option><option>冠狀動脈疾病</option><option>心律不整</option><option>其他</option></select></div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-rose-700 border-b border-rose-100 pb-2 mb-4 flex items-center gap-2"><HeartPulse className="w-4 h-4"/> 疼痛部位 (可複選)</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {PAIN_LOCS.map(loc => (
                    <button 
                      key={loc} onClick={() => togglePainLoc(loc)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${profile.painLocations.includes(loc) ? 'bg-rose-100 text-rose-700 border-rose-300 font-bold shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">目前長期用藥</label><input type="text" value={profile.medications} onChange={e => setProfile({...profile, medications: e.target.value})} className="w-full px-3 py-2 rounded-lg border bg-slate-50 outline-none focus:ring-2 focus:ring-rose-500" placeholder="如：降壓藥、止痛藥，無則留空" /></div>
              </div>
            </div>
          )}

          {/* Step 1: 睡眠評估 (ISI) */}
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><Moon className="w-6 h-6 text-indigo-600"/> 睡眠品質評估 (ISI)</span>
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{Object.keys(sAns).length} / 7 題</span>
              </h2>
              {SQ.map((q, idx) => (
                <div key={q.id} className={`p-4 rounded-xl border transition-colors ${sAns[q.id] !== undefined ? 'bg-slate-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <div className="font-bold text-indigo-700 mb-3">{idx + 1}. {q.text}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {q.opts.map((opt) => (
                      <button key={opt.s} onClick={() => setSAns({...sAns, [q.id]: opt.s})} className={`py-2 rounded-lg text-xs font-medium border transition-all ${sAns[q.id] === opt.s ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{opt.l}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: 疼痛評估 (BPI) */}
          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><Activity className="w-6 h-6 text-rose-600"/> 疼痛影響評估 (BPI)</span>
                <span className="text-sm font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">{Object.keys(pAns).length} / 5 題</span>
              </h2>
              {PQ.map((q, idx) => (
                <div key={q.id} className="p-4 rounded-xl border bg-white shadow-sm mb-4">
                  <div className="font-bold text-rose-700 mb-3">{idx + 1}. {q.text}</div>
                  <ScorePicker value={pAns[q.id]} onChange={(v) => setPAns({...pAns, [q.id]: v})} max={10} />
                </div>
              ))}
            </div>
          )}

          {/* Step 3: 工作效率 (WQ) */}
          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><Briefcase className="w-6 h-6 text-amber-600"/> 工作效率評估</span>
                <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{Object.keys(wAns).length} / 3 題</span>
              </h2>
              {WQ.map((q, idx) => (
                <div key={q.id} className="p-4 rounded-xl border bg-white shadow-sm mb-4">
                  <div className="font-bold text-amber-700 mb-3">{idx + 1}. {q.text}</div>
                  <ScorePicker value={wAns[q.id]} onChange={(v) => setWAns({...wAns, [q.id]: v})} max={10} />
                </div>
              ))}
            </div>
          )}

        </div>

        <div className="flex items-center justify-between gap-4">
          <button onClick={() => setStep(Math.max(0, step - 1))} className={`px-6 py-3 rounded-xl font-bold ${step === 0 ? 'invisible' : 'bg-white border text-slate-600 hover:bg-slate-50'}`}><ChevronLeft className="w-5 h-5" /> 上一步</button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canGoNext()} className="flex-1 max-w-xs px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">下一步 <ChevronRight className="w-5 h-5" /></button>
          ) : (
            <button onClick={handleSubmit} disabled={!canGoNext() || isSubmitting} className="flex-1 max-w-xs px-6 py-3 rounded-xl font-bold text-white bg-linear-to-r from-emerald-600 to-teal-700 hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">{isSubmitting ? "產生中..." : "送出並查看報告"} <CheckCircle2 className="w-5 h-5"/></button>
          )}
        </div>
      </div>
    </>
  );
}