"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { 
  CalendarDays, ChevronLeft, PlusCircle, CheckCircle2, 
  XCircle, Clock, Trash2, ShieldAlert, Waves, Zap 
} from "lucide-react";

const SVCS: Record<string, any> = {
  schumann: { id: "schumann", label: "舒曼共振減壓", icon: <Waves className="w-5 h-5" />, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  laser: { id: "laser", label: "激光物理干預", icon: <Zap className="w-5 h-5" />, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" }
};

const TIMES = ["09:00", "10:00", "11:00", "13:30", "14:30", "15:30", "18:00", "19:00"];

export default function AppointmentPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [appts, setAppts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("schumann");
  
  // 預約表單狀態
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = session?.systemRole === "admin";

  // 載入該項目的所有預約紀錄
  const loadAppts = async () => {
    if (!session?.orgCode) return;
    try {
      const res = await API.getAppointments(session.orgCode, activeTab);
      if (res.status === 'success' && res.data) {
        const mapped = res.data.map((d: any) => {
          // 🛡️ 防呆 1：處理 Supabase 回傳的 profiles 可能是陣列或物件的問題
          const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
          
          return {
            id: d.id,
            uid: d.user_id,
            name: profile?.full_name || "未知",
            dept: profile?.department || "未分類",
            // 🛡️ 防呆 2：確保 date 與 time 絕對不會是 undefined
            date: d.execution_date || "", 
            time: d.appointment_time || "",
            svc: d.service_type,
            status: d.status,
            ts: d.created_at
          };
        });
        setAppts(mapped);
      }
    } catch (err) {
      console.error("載入預約失敗", err);
      setAppts([]);
    }
  };

  useEffect(() => {
    if (session) loadAppts();
  }, [session, activeTab]);

  if (loading || !session) return null;

  // 阻擋非單位成員
  if (!session.orgCode) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">個人用戶無法使用此功能</h2>
        <p className="text-slate-500 mt-2">自主健管預約排程功能目前僅開放給與 REIBI 合作之企業單位成員使用。</p>
        <button onClick={() => router.back()} className="mt-6 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">返回主選單</button>
      </div>
    );
  }

  const currentUserId = session?.uid || session?.id || session?.apiSession?.user_id;

  // --- 送出預約邏輯 ---
  const handleBook = async () => {
    if (!formDate || !formTime) return alert("請選擇日期與時間");
    setIsSubmitting(true);
    
    try {
      const res = await API.createAppointment({
        user_id: currentUserId, // 🛡️ 防呆 3：確保絕對有 ID 傳給後端
        execution_date: formDate,
        appointment_time: formTime,
        service_type: activeTab
      });

      if (res.status === 'success') {
        setFormDate("");
        setFormTime("");
        alert("預約已送出，請靜待管理員審核確認！");
        loadAppts();
      }
    } catch (err) {
      alert("預約送出失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 管理員操作邏輯 ---
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await API.updateAppointmentStatus(id, newStatus);
      loadAppts(); // 重新載入以確保狀態同步
    } catch (err) {
      alert("狀態更新失敗");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除/取消這筆預約嗎？")) return;
    try {
      await API.deleteAppointment(id);
      loadAppts(); // 重新載入以確保狀態同步
    } catch (err) {
      alert("刪除失敗");
    }
  };

  // --- 過濾顯示邏輯 ---
  // 管理員看全部，一般成員只看自己的
  const displayAppts = isAdmin ? appts : appts.filter(a => a.uid === currentUserId);
  // 按日期與時間排序 (最新的在下面，因為是未來的排程)
  displayAppts.sort((a, b) => {
    // 🛡️ 防呆 4：如果遇到沒有日期的壞資料，給予預設值 0 避免排序當機
    const timeA = a.date && a.time ? new Date(`${a.date}T${a.time}`).getTime() : 0;
    const timeB = b.date && b.time ? new Date(`${b.date}T${b.time}`).getTime() : 0;
    return timeA - timeB;
  });

  const svc = SVCS[activeTab];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* 標題與返回區塊 */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回主選單
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-sky-600" /> 自主健管預約排程
          </h1>
          <p className="text-xs text-slate-500 mt-2 bg-slate-100 inline-block px-3 py-1 rounded-full">
            🏢 {session.orgName} {isAdmin ? "· 管理員檢視模式" : ""}
          </p>
        </div>
      </div>

      {/* 服務切換頁籤 (Tabs) */}
      <div className="flex gap-4 mb-8 border-b border-slate-200">
        {Object.values(SVCS).map(s => (
          <button
            key={s.id}
            onClick={() => setActiveTab(s.id)}
            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 ${
              activeTab === s.id ? `border-${s.color.split('-')[1]}-600 ${s.color}` : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 左側：新增預約表單 (一般成員顯示) */}
        {!isAdmin && (
          <div className="lg:col-span-1">
            <div className={`bg-white border rounded-3xl p-6 shadow-sm ${svc.border}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${svc.bg} ${svc.color}`}>
                {svc.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">新增預約</h3>
              <p className="text-xs text-slate-500 mb-6">請選擇您希望安排【{svc.label}】的日期與時段。</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">預約日期</label>
                  <input 
                    type="date" 
                    min={new Date().toISOString().split("T")[0]}
                    value={formDate} 
                    onChange={e => setFormDate(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">期望時段</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIMES.map(t => (
                      <button 
                        key={t}
                        onClick={() => setFormTime(t)}
                        className={`py-2 text-sm font-medium rounded-lg border transition-colors ${formTime === t ? `${svc.bg} ${svc.color} border-${svc.color.split('-')[1]}-300` : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleBook}
                disabled={isSubmitting || !formDate || !formTime}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'schumann' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {isSubmitting ? "送出中..." : "送出預約申請"} <PlusCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 右側：預約清單列表 */}
        <div className={isAdmin ? "lg:col-span-3" : "lg:col-span-2"}>
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-[400px]">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" /> 
              {isAdmin ? "全單位預約總表" : "我的預約紀錄"}
              <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full ml-2">共 {displayAppts.length} 筆</span>
            </h3>

            {displayAppts.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">目前尚無【{svc.label}】的預約紀錄</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayAppts.map((a) => (
                  <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-sm transition-all gap-4">
                    
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center bg-white border shadow-sm ${svc.border}`}>
                        <div className="text-xs font-bold text-slate-400 uppercase">{new Date(a.date).toLocaleDateString('en-US', { month: 'short' })}</div>
                        <div className={`text-xl font-black ${svc.color}`}>{a.date ? a.date.split('-')[2] : '--'}</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          {a.time}
                          {a.status === 'pending' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-sm">審核中</span>}
                          {a.status === 'confirmed' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-sm">已確認</span>}
                          {a.status === 'cancelled' && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-sm">已取消</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {isAdmin ? <><strong className="text-slate-700">{a.name}</strong> ({a.dept})</> : "您的排程"}
                          <span className="mx-2 text-slate-300">|</span> 
                          申請於 {new Date(a.ts).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* 管理員操作按鈕 */}
                    {isAdmin ? (
                      <div className="flex gap-2 w-full sm:w-auto">
                        {a.status === 'pending' && (
                          <button onClick={() => handleStatusChange(a.id, 'confirmed')} className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition-colors border border-emerald-200">
                            核准
                          </button>
                        )}
                        {a.status !== 'cancelled' && (
                          <button onClick={() => handleStatusChange(a.id, 'cancelled')} className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg text-xs font-bold transition-colors border border-rose-200">
                            退回
                          </button>
                        )}
                        <button onClick={() => handleDelete(a.id)} className="px-3 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      // 員工取消按鈕 (僅限審核中可自刪)
                      a.status === 'pending' && (
                        <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 hover:underline w-full sm:w-auto text-right">
                          取消申請
                        </button>
                      )
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}