// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ROLES, can, LX } from "@/lib/config";
import { DB } from "@/lib/store";
import { useRouter } from "next/navigation";
import { 
  ClipboardEdit, FileText, BarChart3, Target, 
  CalendarDays, Leaf, TrendingUp, AlertTriangle, ShieldCheck, LogOut, ChevronRight, RefreshCw
} from "lucide-react";

export default function DashboardPage() {
  // 解構出 switchPlatform
  const { session, logout, switchPlatform } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (session) {
      DB.loadReports().then((r: any) => setHistory(Array.isArray(r) ? r : []));
    }
  }, [session]);

  if (!session) return null; 

  const roleInfo = ROLES[session.systemRole] || ROLES.individual;
  const isAdmin = session.systemRole === "admin";

  const tiles = [
    { id: "assess", icon: <ClipboardEdit className="w-8 h-8 text-teal-600" />, label: "開始健康評估", sub: "填寫問卷，生成個人報告", color: "border-teal-200 hover:border-teal-500", link: "/assessment", show: can(session.systemRole, "assess") },
    { id: "history", icon: <FileText className="w-8 h-8 text-emerald-600" />, label: "查閱個人報告", sub: `共 ${history.length} 筆記錄`, color: "border-emerald-200 hover:border-emerald-500", link: "/history", show: can(session.systemRole, "view_history") },
    { id: "org", icon: <BarChart3 className="w-8 h-8 text-purple-600" />, label: "單位KPI報表", sub: "去識別化統計分析", color: "border-purple-200 hover:border-purple-500", link: "/kpi", show: can(session.systemRole, "view_org") || can(session.systemRole, "view_dept_okr") },
    { id: "okr", icon: <Target className="w-8 h-8 text-amber-600" />, label: "OKR績效儀表板", sub: "健康成果 × 獎酬激勵", color: "border-amber-200 hover:border-amber-500", link: "/okr", show: can(session.systemRole, "view_okr") || can(session.systemRole, "view_dept_okr") },
    { id: "appt", icon: <CalendarDays className="w-8 h-8 text-sky-600" />, label: "自主健管預約排程", sub: isAdmin ? "查閱/修改/下載" : "舒曼波 / 激光物理干預", color: "border-sky-200 hover:border-sky-500", link: "/appointment", show: can(session.systemRole, "view_appt") },
    { id: "esg", icon: <Leaf className="w-8 h-8 text-green-600" />, label: "ESG健康效益", sub: "降本/增效/社會責任", color: "border-green-200 hover:border-green-500", link: "/esg", show: can(session.systemRole, "view_esg") },
    { id: "analysis", icon: <TrendingUp className="w-8 h-8 text-indigo-600" />, label: "健康分析 & 趨勢", sub: "睡眠/疼痛曲線・預測", color: "border-indigo-200 hover:border-indigo-500", link: "/analysis", show: can(session.systemRole, "view_history") },
    { id: "highrisk", icon: <AlertTriangle className="w-8 h-8 text-red-600" />, label: "高風險族群分析", sub: "健康分布・介入建議", color: "border-red-200 hover:border-red-500", link: "/highrisk", show: can(session.systemRole, "view_org") || can(session.systemRole, "view_dept_okr") },
    { id: "privacy", icon: <ShieldCheck className="w-8 h-8 text-slate-600" />, label: "隱私 & 安全中心", sub: "加密機制・法規・稽核", color: "border-slate-200 hover:border-slate-500", link: "/privacy", show: true },
  ].filter(t => t.show);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center text-2xl border border-slate-100">
            {roleInfo.icon}
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800">{session.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border" style={{ color: roleInfo.color, borderColor: `${roleInfo.color}44`, backgroundColor: `${roleInfo.color}18` }}>
                {roleInfo.label}
              </span>
              {session.orgName && <span className="text-xs text-slate-500">🏢 {session.orgName}</span>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 切換平台按鈕 */}
          <button 
            onClick={async () => {
               const toPlatform = session.platform === 'sleep' ? 'schumann' : 'sleep';
               const success = await switchPlatform(toPlatform);
               if (success) {
                  // 移除 alert，讓體驗更順暢 (如果你想保留 alert 也可以)
                  // 🌟 核心修改：根據切換的平台決定去哪裡
                  if (toPlatform === 'schumann') {
                      router.push('/'); // 跳轉到舒曼共振首頁 (http://localhost:3000)
                  } else {
                      window.location.reload(); // 切回睡眠時，重新整理留在 Dashboard
                  }
               } else {
                  alert("切換平台失敗");
               }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg transition-colors border border-transparent font-bold"
          >
            <RefreshCw className="w-4 h-4" /> 切換至 {session.platform === 'sleep' ? '舒曼' : '睡眠'}
          </button>

          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
          >
            <LogOut className="w-4 h-4" /> 登出
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-purple-50 border border-purple-200 text-purple-700 text-xs px-4 py-3 rounded-xl mb-8 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          🔐 單位平台管理者 · HR人資高管/財務高管/負責人 · 可修改編輯所有報表參數
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tiles.map((t) => (
          <Link href={t.link} key={t.id}>
            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-all duration-300 group h-full flex flex-col ${t.color}`}>
              <div className="bg-slate-50 w-14 h-14 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {t.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{t.label}</h3>
              <p className="text-xs text-slate-500">{t.sub}</p>
            </div>
          </Link>
        ))}
      </div>
      
      {history.length > 0 && (
        <div className="mt-10 bg-amber-50/50 border border-amber-100 rounded-3xl p-6 md:p-8 shadow-sm">
          <h3 className="text-lg font-bold text-amber-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> 最近評估記錄
          </h3>
          <div className="space-y-3">
            {history.slice(0, 3).map((rec: any, i: number) => {
              const sk = rec.sLevel?.key || "green";
              const pk = rec.pLevel?.key || "green";
              const sColor = LX[sk as keyof typeof LX]?.c || "#666";
              const pColor = LX[pk as keyof typeof LX]?.c || "#666";
              
              return (
                <Link href={`/report/${rec.id}`} key={rec.id}>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-amber-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                        {i + 1}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 mb-1">
                          {new Date(rec.ts).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })} 的評估
                        </div>
                        <div className="flex gap-4 text-xs font-bold">
                          <span style={{ color: sColor }}>睡眠 {rec.sScore}/28</span>
                          <span style={{ color: pColor }}>疼痛 {rec.pScore}/50</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      查看報告 <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}