"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api"; 
import { MappedSleepReport, BackendSleepReport } from "@/types";
import { can, LX } from "@/lib/config";
import { 
  AlertOctagon, ChevronLeft, ShieldAlert, HeartPulse, 
  Clock, Activity, UserX, PhoneCall, Stethoscope, Mail
} from "lucide-react";

export default function HighRiskPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [data, setData] = useState<MappedSleepReport[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "overdue">("all");

  useEffect(() => {
    if (session?.orgCode && (can(session.systemRole, "view_org") || can(session.systemRole, "view_dept_okr"))) {
      
      // 🟢 強制宣告 GET 並將必填參數直接寫在網址上
      API.request(`/api/org/records?org_code=${session.orgCode}&page=1&size=1000`, { 
        method: 'GET' 
      })
        .then((res: any) => {
          if (res.status === 'success' && res.data) {
             const mappedData: MappedSleepReport[] = res.data.map((d: BackendSleepReport) => ({
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
          setReady(true);
        })
        .catch((err) => {
          console.error("獲取組織資料失敗:", err);
          setReady(true);
        });
        
    } else if (session) {
      setReady(true);
    }
  }, [session]);

  if (loading || !ready) return null;

  if (!can(session?.systemRole, "view_org") && !can(session?.systemRole, "view_dept_okr")) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">權限不足</h2>
        <p className="text-slate-500 mt-2">您沒有權限訪問高風險族群分析模組。此功能僅限 HR、職護與高階主管使用。</p>
        <button onClick={() => router.back()} className="mt-6 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">返回主選單</button>
      </div>
    );
  }

  // 🟢 無情刪除多餘的 isDept 前端過濾邏輯，直接使用 data
  const isDept = session?.systemRole === "dept_head";
  const userMap = new Map();
  
  data.forEach(r => {
    const key = r.profile?.name || r.uid || r.id;
    if (!key) return; 
    
    if (!userMap.has(key)) {
      userMap.set(key, r);
    } else {
      const existing = userMap.get(key);
      if (new Date(r.ts) > new Date(existing.ts)) {
        userMap.set(key, r); 
      }
    }
  });

  const uniqueUsers = Array.from(userMap.values());
  const now = new Date().getTime();

  const isCritical = (r: MappedSleepReport) => 
    ["orange", "red"].includes(r.sLevel?.key || r.sKey || "") && 
    ["orange", "red"].includes(r.pLevel?.key || r.pKey || "");
  
  const isOverdue = (r: MappedSleepReport) => (now - new Date(r.ts).getTime()) > 30 * 24 * 60 * 60 * 1000;

  const criticalUsers = uniqueUsers.filter(isCritical);
  const overdueUsers = uniqueUsers.filter(isOverdue);

  let displayUsers = uniqueUsers;
  if (filter === "critical") displayUsers = criticalUsers;
  if (filter === "overdue") displayUsers = overdueUsers;

  displayUsers.sort((a, b) => (b.sScore + b.pScore) - (a.sScore + a.pScore));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回主選單
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-red-600" /> 高風險族群吹哨系統
          </h1>
          <p className="text-xs text-slate-500 mt-2">
            {session.orgName} {isDept ? `· ${session.dept}` : '· 全單位'}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8 flex gap-3 shadow-lg">
        <ShieldAlert className="w-6 h-6 text-red-500 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-red-400 text-sm block mb-1">【極機密】個資與醫療隱私保護宣告</strong>
          本頁面包含具名之員工健康風險預測資訊。根據《個人資料保護法》及《職業安全衛生法》，此資訊僅限授權之職護、人資主管與單位負責人進行健康關懷與工作調整評估使用。<strong>嚴禁截圖、外流或作為績效考核之負面依據。</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <button onClick={() => setFilter("all")} className={`bg-white border rounded-2xl p-6 text-left transition-all ${filter === "all" ? 'border-slate-800 shadow-md ring-1 ring-slate-800' : 'border-slate-200 hover:border-slate-400'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"><Activity className="w-5 h-5" /></div>
            <div className="font-bold text-slate-700">受測總人數</div>
          </div>
          <div className="text-3xl font-black text-slate-800">{uniqueUsers.length} <span className="text-sm font-medium text-slate-400">人</span></div>
        </button>

        <button onClick={() => setFilter("critical")} className={`bg-white border rounded-2xl p-6 text-left transition-all ${filter === "critical" ? 'border-red-500 shadow-md ring-1 ring-red-500' : 'border-slate-200 hover:border-red-300'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><HeartPulse className="w-5 h-5" /></div>
              <div className="font-bold text-red-700">睡眠+疼痛共病</div>
            </div>
            {criticalUsers.length > 0 && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
          </div>
          <div className="text-3xl font-black text-red-600">{criticalUsers.length} <span className="text-sm font-medium text-red-400">人需關懷</span></div>
        </button>

        <button onClick={() => setFilter("overdue")} className={`bg-white border rounded-2xl p-6 text-left transition-all ${filter === "overdue" ? 'border-amber-500 shadow-md ring-1 ring-amber-500' : 'border-slate-200 hover:border-amber-300'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div>
            <div className="font-bold text-amber-700">超過30天未評估</div>
          </div>
          <div className="text-3xl font-black text-amber-600">{overdueUsers.length} <span className="text-sm font-medium text-amber-400">人怠惰</span></div>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800">
            {filter === "all" ? "全體受測員工清單" : filter === "critical" ? "🚨 重度共病優先關懷名單" : "⏳ 追蹤怠惰名單"}
          </h3>
          <span className="text-xs font-bold bg-slate-200 text-slate-600 px-3 py-1 rounded-full">{displayUsers.length} 筆資料</span>
        </div>

        {displayUsers.length === 0 ? (
          <div className="text-center py-16">
            <UserX className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">目前沒有符合條件的員工</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayUsers.map((r, idx) => {
              const c = isCritical(r);
              const o = isOverdue(r);
              const timeDiff = now - new Date(r.ts).getTime();
              const daysAgo = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60 * 24)));
              
              const sKey = r.sLevel?.key || r.sKey || "green";
              const pKey = r.pLevel?.key || r.pKey || "green";

              return (
                <div key={idx} className={`p-6 transition-colors ${c ? 'bg-red-50/30' : 'hover:bg-slate-50'}`}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 ${c ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {r.profile?.name?.[0] || "?"}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          {r.profile?.name} 
                          {c && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-sm uppercase">高危險</span>}
                        </h4>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>{r.dept || "未分類部門"}</span>
                          <span className="text-slate-300">|</span>
                          <span className={o ? 'text-amber-600 font-bold' : ''}>上次評估: {daysAgo === 0 ? '今天' : `${daysAgo} 天前`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">睡眠 (ISI)</div>
                        <div className="text-sm font-bold px-3 py-1 rounded-full border" style={{ color: LX[sKey as keyof typeof LX]?.c, borderColor: LX[sKey as keyof typeof LX]?.c, backgroundColor: LX[sKey as keyof typeof LX]?.bg }}>
                          {r.sScore}/28
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">疼痛 (BPI)</div>
                        <div className="text-sm font-bold px-3 py-1 rounded-full border" style={{ color: LX[pKey as keyof typeof LX]?.c, borderColor: LX[pKey as keyof typeof LX]?.c, backgroundColor: LX[pKey as keyof typeof LX]?.bg }}>
                          {r.pScore}/50
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[280px]">
                      {c ? (
                        <div className="bg-white border border-red-200 rounded-xl p-3 shadow-sm">
                          <div className="text-[10px] font-bold text-red-500 mb-2 flex items-center gap-1"><AlertOctagon className="w-3 h-3" /> 系統建議介入行動</div>
                          <div className="flex gap-2">
                            <button className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 text-xs py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors border border-red-100">
                              <Stethoscope className="w-3 h-3" /> 安排職醫
                            </button>
                            <button onClick={() => router.push('/appointment')} className="flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors border border-emerald-100">
                              <HeartPulse className="w-3 h-3" /> 安排舒曼波
                            </button>
                          </div>
                        </div>
                      ) : o ? (
                        <div className="bg-white border border-amber-200 rounded-xl p-3 shadow-sm">
                          <div className="text-[10px] font-bold text-amber-600 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> 追蹤怠惰警示</div>
                          <div className="flex gap-2">
                            <button className="flex-1 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-colors border border-amber-100">
                              <Mail className="w-3 h-3" /> 發送重測提醒
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-slate-400 font-medium px-4 py-2">
                          目前狀況穩定，持續常規追蹤。
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}