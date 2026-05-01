"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  FileText, Calendar, Filter, Download, 
  TrendingUp, Plus, ChevronLeft, Search, XCircle 
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { DB } from "@/lib/store";
import API from "@/lib/api";
import { LX, LL, ROLES, SQ, PQ } from "@/lib/config";

// ══ 內部工具：PDF 報表產生器 (100% 移植自原始邏輯) ══
const buildPDF = (report: any, session: any) => {
  const { profile = {}, sScore = 0, sLevel = {}, sAns = {}, pScore = 0, pLevel = {}, pAns = {}, ts, id = "" } = report;
  const date = new Date(ts).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
  const lc: any = { green: "#2d7a5a", yellow: "#b07015", orange: "#c05a28", red: "#b82020" };
  
  const b = (s: number, max: number) => {
    const p = Math.round((s / max) * 100);
    const c = p === 0 ? "#2d7a5a" : p <= 33 ? "#7ab828" : p <= 66 ? "#b07015" : p <= 83 ? "#c05a28" : "#b82020";
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><div style="flex:1;height:5px;background:#e8ddd4;border-radius:3px"><div style="width:${p}%;height:100%;background:${c};border-radius:3px"></div></div><span style="font-size:10px;color:${c};font-weight:700;min-width:26px">${s}/${max}</span></div>`;
  };

  return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>報告_${profile.name}_${date}</title><style>body{font-family:serif;padding:20px;color:#2a2220;}</style></head><body>
    <div style="background:#2a7d8c;color:#fff;padding:20px;border-radius:10px;text-align:center">
      <h1>睡眠 × 疼痛聯合評估報告</h1>
      <p>${profile.name} · ${date}</p>
    </div>
    <div style="margin-top:20px">
      <h3>睡眠評估 (ISI): ${sScore}/28 - ${sLevel.label}</h3>
      <h3>疼痛評估 (BPI): ${pScore}/50 - ${pLevel.label}</h3>
    </div>
    <p style="font-size:10px;color:#7a6e68;margin-top:30px">本報告由 REIBI 健康平台自動產生，僅供自主管理參考。</p>
    <script>window.print();</script>
  </body></html>`;
};

export default function HistoryPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [reports, setReports] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // 1. 載入資料 (改由 FastAPI + Supabase 獲取)
  useEffect(() => {
    // 確保 session 存在且有 uid 才發送請求
    if (session && session.uid) {
      // 呼叫我們在 main.py 寫好的列表端點，並把 user_id 當作查詢參數傳過去
      API.request(`/api/sleep/reports?user_id=${session.uid}`, {
        method: 'GET'
      })
      .then((res: any) => {
        if (res.status === 'success' && Array.isArray(res.reports)) {
          
          // 2. 資料格式轉換 (Data Mapping)
          // 把後端資料庫的 snake_case 轉換為前端列表與 PDF 需要的格式
          const formattedReports = res.reports.map((dbData: any) => ({
            ...dbData,
            id: dbData.id,
            ts: dbData.created_at,             // 時間戳記對接
            sScore: dbData.sleep_score,        // 分數對接
            pScore: dbData.pain_score,
            wScore: dbData.work_score,
            // 轉換燈號與標籤 (結合你 import 進來的 LL 字典)
            sLevel: { 
              key: dbData.sleep_level, 
              label: LL[dbData.sleep_level as keyof typeof LL] || "" 
            },
            pLevel: { 
              key: dbData.pain_level, 
              label: LL[dbData.pain_level as keyof typeof LL] || "" 
            },
            profile: dbData.profile || {},
          }));

          setReports(formattedReports);
        } else {
          setReports([]); // 如果沒資料或狀態不對，設為空陣列
        }
      })
      .catch((err) => {
        console.error("API 獲取歷史紀錄失敗:", err);
        setReports([]);
      });
    }
  }, [session]);

  if (loading || !session) return null;

  // 2. 篩選與排序邏輯 
  const filtered = reports.filter(r => {
    const d = r.ts?.slice(0, 10) || "";
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  });
  const sorted = [...filtered].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  // 3. PDF 下載處理 
  const handleDownloadPDF = (r: any) => {
    const html = buildPDF(r, session);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  // 補回：下載純文字紀錄的邏輯
  const handleExportTxt = () => {
    if (filtered.length === 0) return alert("目前沒有資料可以匯出");
    const rows = sorted.map(r => `${r.ts?.slice(0, 10)} 睡眠${r.sScore}/28 疼痛${r.pScore}/50`).join("\n");
    const b = new Blob(["REIBI健康追蹤報告\n\n" + rows], { type: "text/plain;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = "健康追蹤.txt"; a.click();
    URL.revokeObjectURL(u);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* 頁首區塊 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button onClick={() => router.push("/dashboard")} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回主選單
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" /> 歷史分析紀錄
          </h1>
        </div>
        
        <div className="flex gap-2">
          <Link href="/analysis" className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors">
            <TrendingUp className="w-4 h-4" /> 健康趨勢
          </Link>
          <Link href="/assessment" className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-md transition-colors">
            <Plus className="w-4 h-4" /> 新增評估
          </Link>
        </div>
      </div>

      {/* 篩選器卡片  */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-4">
          <Filter className="w-4 h-4" /> 篩選日期區間
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1 ml-1">起始日期</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1 ml-1">結束日期</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        </div>
        
        {/* 清除與下載按鈕區 */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-400 font-medium">
            共篩選出 {filtered.length} 筆資料
          </div>
          <div className="flex gap-4">
            {(dateFrom || dateTo) && (
              <button onClick={() => {setDateFrom(""); setDateTo("");}} className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 bg-rose-50 px-3 py-1.5 rounded-lg">
                <XCircle className="w-3 h-3" /> 清除條件
              </button>
            )}
            {filtered.length > 0 && (
              <button onClick={handleExportTxt} className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg hover:bg-teal-100 flex items-center gap-1 transition-colors border border-teal-100">
                <Download className="w-3 h-3" /> 下載純文字紀錄
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 紀錄列表 */}
      <div className="space-y-4">
        {sorted.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400">目前尚無符合條件的健康紀錄</p>
          </div>
        ) : (
          sorted.map((rec, idx) => {
            const sLevel = rec.sLevel || {};
            const pLevel = rec.pLevel || {};
            const sColor = LX[sLevel.key as keyof typeof LX]?.c || "#666";
            const pColor = LX[pLevel.key as keyof typeof LX]?.c || "#666";

            return (
              <div key={rec.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all flex flex-col sm:flex-row items-center justify-between gap-4 group">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-xl shrink-0 group-hover:bg-emerald-50 transition-colors">
                    <FileText className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {
                        rec.profile?.name || 
                        (rec.user_id === session?.uid ? session?.name : "未知使用者") 
                      } 的分析報告
</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(rec.ts).toLocaleDateString()}
                      </span>
                      <span className="text-xs font-bold" style={{ color: sColor }}>睡眠: {rec.sScore}/28</span>
                      <span className="text-xs font-bold" style={{ color: pColor }}>疼痛: {rec.pScore}/50</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => handleDownloadPDF(rec)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-2"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button 
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 flex items-center justify-center"
                    onClick={() => router.push(`/report/${rec.id}`)}
                  >
                    查看詳情
                  </button>
                  {idx === 0 && (
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full shadow-sm">最新</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest">
          顯示 {filtered.length} / {reports.length} 筆資料 · 全部資料已加密存儲
        </p>
      </div>
    </div>
  );
}