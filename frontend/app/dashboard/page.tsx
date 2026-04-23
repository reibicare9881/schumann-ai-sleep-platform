// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ROLES, can } from "@/lib/config";
import { DB } from "@/lib/store";
import { 
  ClipboardEdit, FileText, BarChart3, Target, 
  CalendarDays, Leaf, TrendingUp, AlertTriangle, ShieldCheck, LogOut 
} from "lucide-react";

export default function DashboardPage() {
  const { session, logout } = useAuth();
  const [history, setHistory] = useState<any[]>([]);

  // 載入歷史報告筆數
  useEffect(() => {
    if (session) {
      DB.loadReports().then((r: any) => setHistory(Array.isArray(r) ? r : []));
    }
  }, [session]);

  // 如果沒有 session，畫面先留白等 AuthProvider 跳轉
  if (!session) return null; 

  const roleInfo = ROLES[session.systemRole] || ROLES.individual;
  const isAdmin = session.systemRole === "admin";

  // 依照權限動態過濾功能磚 (Tiles)
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
      
      {/* 頂部歡迎與身分區塊 */}
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
        
        <button 
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
        >
          <LogOut className="w-4 h-4" /> 登出
        </button>
      </div>

      {isAdmin && (
        <div className="bg-purple-50 border border-purple-200 text-purple-700 text-xs px-4 py-3 rounded-xl mb-8 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          🔐 單位平台管理者 · HR人資高管/財務高管/負責人 · 可修改編輯所有報表參數
        </div>
      )}

      {/* 功能導覽磚 (Tiles) */}
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

    </div>
  );
}