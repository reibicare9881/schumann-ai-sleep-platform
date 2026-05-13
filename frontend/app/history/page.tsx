"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  FileText, Calendar, Filter, Download, 
  TrendingUp, Plus, ChevronLeft, Search, XCircle, Moon, Activity
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { LX, LL } from "@/lib/config";

// 統一的資料介面
interface UnifiedReport {
  id: string;
  platform: "sleep" | "schumann";
  ts: string;
  profile: any;
  // 睡眠專屬欄位
  sScore?: number;
  pScore?: number;
  sLevel?: { key: string; label: string };
  pLevel?: { key: string; label: string };
  // 舒曼專屬欄位
  sdnn?: number;
  lf_hf_ratio?: string | number;
  report_url?: string;
}

export default function HistoryPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [reports, setReports] = useState<UnifiedReport[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "sleep" | "schumann">("all");
  const [isLoadingData, setIsLoadingData] = useState(true);

  // 1. 載入資料：前端同時並發請求兩支現有 API，免改後端！
  useEffect(() => {
    if (session && session.uid) {
      setIsLoadingData(true);
      Promise.all([
        API.listSleepReports(session.uid),
        API.listSchumannReports(session.uid)
      ])
      .then(([sleepRes, schumannRes]: [any, any]) => {
        let combined: UnifiedReport[] = [];

        // 整理睡眠報告
        if (sleepRes.status === 'success' && Array.isArray(sleepRes.reports)) {
          const sleepData = sleepRes.reports.map((d: any) => ({
            id: d.id,
            platform: "sleep" as const,
            ts: d.created_at,
            profile: d.profile || {},
            sScore: d.sleep_score,
            pScore: d.pain_score,
            sLevel: { key: d.sleep_level, label: LL[d.sleep_level as keyof typeof LL] || "" },
            pLevel: { key: d.pain_level, label: LL[d.pain_level as keyof typeof LL] || "" }
          }));
          combined = [...combined, ...sleepData];
        }

        // 整理舒曼報告
        if (schumannRes.status === 'success' && Array.isArray(schumannRes.reports)) {
          const schumannData = schumannRes.reports.map((d: any) => {
            const aiSummary = typeof d.ai_summary === 'string' ? JSON.parse(d.ai_summary || "{}") : (d.ai_summary || {});
            return {
              id: d.id,
              platform: "schumann" as const,
              ts: d.created_at,
              profile: { name: d.name_extracted || session.name },
              sdnn: d.sdnn_post || aiSummary.sdnn_post || aiSummary.sdnn || "N/A",
              lf_hf_ratio: d.lf_hf_value || aiSummary.lf_hf_value || aiSummary.lf_hf_ratio || "N/A",
              report_url: d.report_url
            };
          });
          combined = [...combined, ...schumannData];
        }

        setReports(combined);
      })
      .catch((err) => {
        console.error("API 獲取歷史紀錄失敗:", err);
      })
      .finally(() => {
        setIsLoadingData(false);
      });
    }
  }, [session]);

  if (loading || !session) return null;

  // 2. 篩選與排序邏輯 (完美保留您的日期過濾功能)
  const filtered = reports.filter(r => {
    const d = r.ts?.slice(0, 10) || "";
    const matchDate = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    const matchPlatform = platformFilter === "all" || r.platform === platformFilter;
    return matchDate && matchPlatform;
  });
  const sorted = [...filtered].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  // 3. 純文字匯出處理 (完美保留，並升級支援舒曼資料)
  const handleExportTxt = () => {
    if (filtered.length === 0) return alert("目前沒有資料可以匯出");
    const rows = sorted.map(r => {
      const dateStr = r.ts?.slice(0, 10);
      if (r.platform === "sleep") {
        return `[睡眠健康] ${dateStr} - 睡眠: ${r.sScore}/28, 疼痛: ${r.pScore}/50`;
      } else {
        return `[舒曼分析] ${dateStr} - SDNN: ${r.sdnn} ms, 交感/副交感: ${r.lf_hf_ratio}`;
      }
    }).join("\n");
    const b = new Blob(["REIBI 健康追蹤聯合報告\n\n" + rows], { type: "text/plain;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = "健康追蹤聯合報告.txt"; a.click();
    URL.revokeObjectURL(u);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* 頁首區塊 (完美保留您的按鈕) */}
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

      {/* 平台切換 Tabs (新功能) */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-6 self-start inline-flex">
        <button onClick={() => setPlatformFilter("all")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${platformFilter === "all" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
          全部紀錄
        </button>
        <button onClick={() => setPlatformFilter("sleep")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${platformFilter === "sleep" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
          <Moon className="w-4 h-4" /> 睡眠評估
        </button>
        <button onClick={() => setPlatformFilter("schumann")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${platformFilter === "schumann" ? "bg-white shadow-sm text-purple-600" : "text-slate-500 hover:text-slate-700"}`}>
          <Activity className="w-4 h-4" /> 舒曼分析
        </button>
      </div>

      {/* 篩選器卡片 (完美保留您的日期過濾與清除按鈕) */}
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
        
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-400 font-medium">共篩選出 {filtered.length} 筆資料</div>
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
        {isLoadingData ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 animate-pulse">
            資料讀取中...
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400">目前尚無符合條件的健康紀錄</p>
          </div>
        ) : (
          sorted.map((rec, idx) => {
            const isSleep = rec.platform === "sleep";
            const sColor = LX[rec.sLevel?.key as keyof typeof LX]?.c || "#666";
            const pColor = LX[rec.pLevel?.key as keyof typeof LX]?.c || "#666";

            return (
              <div key={rec.id} className={`bg-white border rounded-2xl p-5 hover:shadow-md transition-all flex flex-col sm:flex-row items-center justify-between gap-4 group ${isSleep ? 'border-blue-100' : 'border-purple-100'}`}>
                
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${isSleep ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'}`}>
                    {isSleep ? <Moon className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">
                      {rec.profile?.name || session?.name || "未知使用者"} 的{isSleep ? "睡眠評估" : "舒曼分析"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(rec.ts).toLocaleDateString()}
                      </span>
                      {isSleep ? (
                        <>
                          <span className="text-xs font-bold" style={{ color: sColor }}>睡眠: {rec.sScore}/28</span>
                          <span className="text-xs font-bold" style={{ color: pColor }}>疼痛: {rec.pScore}/50</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-purple-600">SDNN: {rec.sdnn} ms</span>
                          <span className="text-xs font-bold text-indigo-600">交感/副交感: {rec.lf_hf_ratio}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto relative">
                  {isSleep ? (
                    <button 
                      className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                      onClick={() => router.push(`/report/${rec.id}`)}
                    >
                      查看詳細報告
                    </button>
                  ) : (
                    <a 
                      href={rec.report_url} 
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" /> 下載 PDF
                    </a>
                  )}
                  {idx === 0 && (
                    <span className="absolute -top-3 -right-2 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-full shadow-sm">最新</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-8 text-center">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest">
          顯示 {filtered.length} / {reports.length} 筆資料 · 雙軌資料已整合
        </p>
      </div>
    </div>
  );
}