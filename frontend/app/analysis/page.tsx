"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DB } from "@/lib/store";
import { C, LX } from "@/lib/config";
import { 
  ChevronLeft, TrendingUp, AlertCircle, Calendar, 
  ArrowDownCircle, ArrowUpCircle, Info, Zap, Waves 
} from "lucide-react";

// ══ 內部元件：趨勢圖表 (100% 移植自原始 SVG 繪圖邏輯) ══
const TrendChart = ({ data, color, label, maxVal, showPred = false }: any) => {
  if (!data || data.length < 2) {
    return <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">需至少 2 筆資料才能顯示趨勢圖</div>;
  }

  const W = 400, H = 150, pad = { t: 20, r: 40, b: 30, l: 40 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  const mx = maxVal || Math.max(...data.map((d: any) => d.v)) * 1.15 || 1;
  
  const n = data.length;
  // 讓 X 軸動態縮放，如果有預測點，就多留一格的寬度
  const steps = showPred ? n : Math.max(1, n - 1);
  const xs = data.map((_: any, i: number) => pad.l + (i / steps) * cW);
  const ys = data.map((d: any) => pad.t + cH * (1 - d.v / mx));

  // 線性回歸計算 (線性推測)
  const xm = (n - 1) / 2, ym = data.reduce((a: any, d: any) => a + d.v, 0) / n;
  const sxy = data.reduce((a: any, d: any, i: number) => a + (i - xm) * (d.v - ym), 0);
  const sxx = data.reduce((a: any, _: any, i: number) => a + (i - xm) ** 2, 0);
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = ym - slope * xm;
  const pred = (d: number) => Math.max(0, Math.min(mx, slope * d + intercept));

  const ptStr = xs.map((x: number, i: number) => `${x},${ys[i]}`).join(" ");
  const aStr = `${xs[0]},${ys[0]} ${ptStr} ${xs[xs.length - 1]},${H - pad.b} ${xs[0]},${H - pad.b}`;
  
  const predX = pad.l + (n / steps) * cW;
  const predY = pad.t + cH * (1 - pred(n) / mx);

  return (
    <div className="w-full">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* 背景格線 */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const gy = pad.t + cH * pct;
          return (
            <g key={pct}>
              <line x1={pad.l} y1={gy} x2={pad.l + cW} y2={gy} stroke="#f1f5f9" strokeWidth="1" />
              <text x={pad.l - 5} y={gy + 3} fontSize="8" fill="#94a3b8" textAnchor="end">{Math.round(mx * (1 - pct))}</text>
            </g>
          );
        })}
        {/* 漸層填充 */}
        <polygon points={aStr} fill={color} opacity="0.1" />
        {/* 實際趨勢線 */}
        <polyline points={ptStr} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {/* 預測點 */}
        {showPred && predY > 0 && predY < H && (
          <g>
            <line x1={xs[xs.length-1]} y1={ys[ys.length-1]} x2={predX} y2={predY} stroke={color} strokeWidth="2" strokeDasharray="4,3" opacity="0.5" />
            <circle cx={predX} cy={predY} r="5" fill="white" stroke={color} strokeWidth="2" />
            <text x={predX} y={predY - 10} fontSize="10" fill={color} textAnchor="middle" fontWeight="bold">預測</text>
          </g>
        )}
        {/* 數據點點 */}
        {xs.map((x: number, i: number) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r="4" fill={color} stroke="white" strokeWidth="2" />
          </g>
        ))}
      </svg>
      <div className="flex justify-between px-10 mt-2">
        {data.map((d: any, i: number) => (
          <span key={i} className="text-[10px] text-slate-400 font-medium">{d.label}</span>
        ))}
      </div>
    </div>
  );
};

export default function AnalysisPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (session) {
      DB.loadReports().then((r: any) => setReports(Array.isArray(r) ? r : []));
    }
  }, [session]);

  if (loading || !session) return null;

  const sorted = [...reports].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const sData = sorted.map((r, i) => ({ v: r.sScore || 0, label: `第${i+1}次` }));
  const pData = sorted.map((r, i) => ({ v: r.pScore || 0, label: `第${i+1}次` }));
  
  const latest = sorted[sorted.length - 1];
  const sTrend = sData.length >= 2 ? sData[sData.length - 1].v - sData[0].v : 0;
  const pTrend = pData.length >= 2 ? pData[pData.length - 1].v - pData[0].v : 0;

  // 療程建議邏輯 (100% 移植) 
  const suggestions = [];
  if (latest) {
    const s = latest.sScore;
    const p = latest.pScore;
    if (s >= 15) suggestions.push({ icon: <Waves />, name: "舒曼共振減壓", reason: `ISI ${s}分 (中度以上)`, freq: "每週 3-5 次" });
    else if (s >= 8) suggestions.push({ icon: <Waves />, name: "舒曼共振減壓", reason: `ISI ${s}分 (輕度失眠)`, freq: "每週 1-2 次" });
    
    if (p >= 26) suggestions.push({ icon: <Zap />, name: "激光物理干預 LA200", reason: `BPI ${p}分 (重度疼痛)`, freq: "每週 2-3 次" });
    else if (p >= 13) suggestions.push({ icon: <Zap />, name: "激光物理干預 LA200", reason: `BPI ${p}分 (中度疼痛)`, freq: "每週 1-2 次" });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* 標題區 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1">
          <ChevronLeft className="w-5 h-5" /> 返回
        </button>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-indigo-600" /> 健康分析與趨勢預測
        </h1>
        <div className="w-16"></div>
      </div>

      {/* 免責聲明 */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <strong>重要聲明：</strong> 以下趨勢圖與預測線僅為基於歷史數據之推算，不構成醫療診斷或治療建議。如有健康疑慮，請務必諮詢專業醫療人員 [cite: 160]。
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* 睡眠分析卡片 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">🌙 睡眠品質趨勢 (ISI)</h3>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${sTrend <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {sTrend <= 0 ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
              {sTrend <= 0 ? "改善中" : "需關注"} {Math.abs(sTrend)}分
            </div>
          </div>
          <TrendChart data={sData} color="#4f46e5" maxVal={28} showPred={sData.length >= 3} />
        </div>

        {/* 疼痛分析卡片 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">🩺 疼痛改善曲線 (BPI)</h3>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${pTrend <= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {pTrend <= 0 ? <ArrowDownCircle className="w-3 h-3" /> : <ArrowUpCircle className="w-3 h-3" />}
              {pTrend <= 0 ? "改善中" : "需關注"} {Math.abs(pTrend)}分
            </div>
          </div>
          <TrendChart data={pData} color="#e11d48" maxVal={50} showPred={pData.length >= 3} />
        </div>
      </div>

      {/* 療程建議區塊 */}
      {suggestions.length > 0 && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingUp className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Info className="w-6 h-6 text-emerald-400" /> 系統介入建議療程
            </h2>
            <p className="text-slate-400 text-xs mb-8">基於您的最新評估數據，自動生成的非處方參考建議 [cite: 166-167]。</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((s, i) => (
                <div key={i} className="bg-white/10 border border-white/20 rounded-2xl p-6 hover:bg-white/15 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">{s.icon}</div>
                    <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-1 rounded-full">{s.freq}</span>
                  </div>
                  <h4 className="text-lg font-bold mb-1">{s.name}</h4>
                  <p className="text-xs text-slate-400 mb-4">{s.reason}</p>
                  <button 
                    onClick={() => router.push('/appointment')}
                    className="w-full py-2 bg-white text-slate-900 rounded-lg text-xs font-bold hover:bg-emerald-400 transition-colors"
                  >
                    前往預約排程
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    {/* 補回：定期評估提醒設定 */}
      <div className="bg-[#fdf8f3] border border-[#e8ddd4] rounded-3xl p-6 md:p-8 mt-12 shadow-sm">
        <h3 className="text-lg font-bold text-amber-700 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" /> 定期評估提醒設定
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-6">
          建議每 4–6 週完成一次評估，追蹤健康變化趨勢。由於本系統為網頁應用程式，無法主動推送通知，建議透過以下方式設定提醒：
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: "📱", t: "手機行事曆", d: "新增每 4 週循環提醒「完成健康評估」" },
            { icon: "💬", t: "LINE 提醒", d: "設定 LINE 自訂提醒訊息，每月固定日提醒" },
            { icon: "📧", t: "Email 循環", d: "請單位管理者設定定期評估通知信" }
          ].map((r, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow">
              <span className="text-2xl">{r.icon}</span>
              <div>
                <div className="text-sm font-bold text-slate-800 mb-1">{r.t}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{r.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-slate-400 mt-6 text-center font-bold tracking-widest uppercase">
          * 未來版本將整合原生推播通知功能
        </div>
      </div>
    </div>
  );
}