"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DB } from "@/lib/store";
import { LX, LL } from "@/lib/config";
import { ChevronLeft, TrendingUp, BookOpen, Waves, AlertTriangle, FileText } from "lucide-react";

export default function ReportPage() {
  const { id } = useParams();
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (session) {
      DB.loadReports().then((reports: any[]) => {
        const found = reports.find(r => r.id === id);
        if (found) setReport(found);
        else setError(true);
      });
    }
  }, [id, session]);

  if (loading || (!report && !error)) return <div className="text-center py-20">報告讀取中...</div>;
  if (error) return <div className="text-center py-20">找不到此報告紀錄</div>;

  const sLv = report.sLevel || { key: "green", label: "" };
  const pLv = report.pLevel || { key: "green", label: "" };
  const wScore = report.wScore || 0;
  const comorbid = ["yellow", "orange", "red"].includes(sLv.key) && ["yellow", "orange", "red"].includes(pLv.key);
  const recs = report.recs || {};

  const RecBox = ({ title, content, colorClass, icon }: any) => (
    <div className={`p-5 rounded-2xl border-l-4 mb-4 bg-white shadow-sm ${colorClass}`}>
      <h4 className="font-bold flex items-center gap-2 mb-2 text-slate-800">{icon} {title}</h4>
      <p className="text-sm text-slate-600 leading-relaxed">{content}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* 頂部導航 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push("/history")} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> 回歷史清單
        </button>
        <button onClick={() => router.push("/analysis")} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
          <TrendingUp className="w-4 h-4" /> 看趨勢圖
        </button>
      </div>

      {/* 英雄區塊 (Hero Section) */}
      <div className="bg-linear-to-r from-teal-700 to-indigo-800 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><FileText className="w-32 h-32" /></div>
        <div className="relative z-10">
          <div className="text-[10px] tracking-widest opacity-70 mb-2">REIBI HEALTH REPORT</div>
          <h1 className="text-3xl font-bold mb-4">睡眠 × 疼痛 聯合評估報告</h1>
          <div className="flex flex-wrap gap-4 text-sm opacity-90 mb-8 bg-white/10 inline-flex px-4 py-2 rounded-lg">
            <span>評估者：{report.profile?.name || "匿名"}</span>
            <span>|</span>
            <span>日期：{new Date(report.ts).toLocaleDateString()}</span>
            <span>|</span>
            <span>報告編號：{String(id).slice(0, 8).toUpperCase()}</span>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="bg-white text-slate-900 rounded-2xl p-4 min-w-[140px] text-center shadow-md">
              <div className="text-xs text-slate-500 mb-1 font-bold">睡眠 (ISI)</div>
              <div className="text-3xl font-black mb-1" style={{ color: LX[sLv.key as keyof typeof LX]?.c }}>{report.sScore}<span className="text-sm text-slate-400">/28</span></div>
              <div className="text-xs font-bold" style={{ color: LX[sLv.key as keyof typeof LX]?.c }}>{LL[sLv.key as keyof typeof LX]}</div>
            </div>
            <div className="bg-white text-slate-900 rounded-2xl p-4 min-w-[140px] text-center shadow-md">
              <div className="text-xs text-slate-500 mb-1 font-bold">疼痛 (BPI)</div>
              <div className="text-3xl font-black mb-1" style={{ color: LX[pLv.key as keyof typeof LX]?.c }}>{report.pScore}<span className="text-sm text-slate-400">/50</span></div>
              <div className="text-xs font-bold" style={{ color: LX[pLv.key as keyof typeof LX]?.c }}>{LL[pLv.key as keyof typeof LX]}</div>
            </div>
            <div className="bg-white text-slate-900 rounded-2xl p-4 min-w-[140px] text-center shadow-md">
              <div className="text-xs text-slate-500 mb-1 font-bold">工作效率</div>
              <div className="text-3xl font-black mb-1 text-amber-600">{wScore}<span className="text-sm text-slate-400">/30</span></div>
              <div className="text-xs font-bold text-amber-600">{wScore <= 10 ? "🟢 影響極微" : wScore <= 20 ? "🟡 中度干擾" : "🔴 嚴重干擾"}</div>
            </div>
          </div>
        </div>
      </div>

      {comorbid && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-4 shadow-sm animate-in slide-in-from-bottom-4">
          <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800 mb-1">⚠️ 疼痛–睡眠共病警示</h4>
            <p className="text-sm text-amber-700 leading-relaxed">您的評估結果顯示同時存在疼痛與睡眠問題，這容易形成「疼痛–失眠惡性循環」。建議整合治療並告知您的醫師。</p>
          </div>
        </div>
      )}

      {/* 衛教建議區塊 */}
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-emerald-600" /> 個人化健康促進建議
      </h3>
      
      <div className="space-y-4">
        <RecBox title="綜合健康方針" content={recs.generalHealth} icon="🏃" colorClass="border-teal-500" />
        <RecBox title="睡眠衛教建議" content={recs.sleepEducation} icon="🌙" colorClass="border-indigo-500" />
        <RecBox title="疼痛衛教建議" content={recs.painEducation} icon="💊" colorClass="border-rose-500" />
        <RecBox title="物理治療建議" content={recs.physicalTherapy} icon="🤸" colorClass="border-amber-500" />
        
        <div className="bg-slate-900 rounded-2xl p-6 text-white mt-8 shadow-xl">
          <h4 className="font-bold flex items-center gap-2 mb-3 text-emerald-400"><Waves className="w-5 h-5" /> 系統介入：舒曼波與雷射療程</h4>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{recs.reibiProducts}</p>
          <button onClick={() => router.push("/appointment")} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            前往預約排程 →
          </button>
        </div>
      </div>

    </div>
  );
}