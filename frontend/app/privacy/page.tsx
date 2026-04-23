"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DB, AuditLog, clearCryptoKey, K_MIN } from "@/lib/store";
import { 
  Lock, ChevronLeft, ShieldCheck, FileText, Trash2, 
  Eye, CheckCircle2, AlertTriangle, Key, Users, Activity
} from "lucide-react";

export default function PrivacyPage() {
  const { session, loading, logout } = useAuth();
  const router = useRouter();

  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState(false);

  // 取得稽核日誌
  useEffect(() => {
    if (showAudit) {
      setAuditLog(AuditLog.getLog());
    }
  }, [showAudit]);

  if (loading || !session) return null;

  // --- 資料抹除邏輯 ---
  const handleDataErase = async () => {
    AuditLog.record("DATA_ERASE", "user requested data erasure", session?.systemRole);
    await DB.clearSession();
    clearCryptoKey();
    alert("您的本機資料與安全金鑰已成功清除。");
    // 呼叫 AuthProvider 的 logout 確保狀態清空並跳轉
    logout(); 
  };

  const ComplianceTag = ({ label, icon, colorClass }: { label: string, icon: string, colorClass: string }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold mr-2 mb-2 ${colorClass}`}>
      <span>{icon}</span> {label}
    </span>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* 標題與操作區 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2 text-sm">
            <ChevronLeft className="w-4 h-4" /> 返回主選單
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Lock className="w-6 h-6 text-slate-700" /> 隱私 & 安全中心
          </h1>
          <p className="text-xs text-slate-500 mt-2 bg-slate-100 inline-block px-3 py-1 rounded-full">
            最高安全級別 · Zero Trust 架構 · 端到端加密防護
          </p>
        </div>
      </div>

      {/* 法規對齊聲明 */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <h3 className="text-sm font-bold text-teal-700 mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5" /> 法規對齊與技術聲明
        </h3>
        <div className="mb-6">
          <ComplianceTag label="台灣《個人資料保護法》" icon="🇹🇼" colorClass="bg-teal-50 text-teal-700 border-teal-200" />
          <ComplianceTag label="GDPR 概念對齊" icon="🇪🇺" colorClass="bg-indigo-50 text-indigo-700 border-indigo-200" />
          <ComplianceTag label="HIPAA-ready (可升級)" icon="🏥" colorClass="bg-rose-50 text-rose-700 border-rose-200" />
          <ComplianceTag label="Zero Trust 架構" icon="🛡️" colorClass="bg-slate-100 text-slate-700 border-slate-300" />
          <ComplianceTag label="AES-256-GCM 加密" icon="🔐" colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" />
          <ComplianceTag label="k-匿名性保護" icon="👥" colorClass="bg-amber-50 text-amber-700 border-amber-200" />
          <ComplianceTag label="差分隱私 DP (ε=0.8)" icon="📊" colorClass="bg-purple-50 text-purple-700 border-purple-200" />
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <strong>注意：</strong>本聲明為應用程式層級之技術措施說明。完整的企業合規需搭配組織內部政策、法律文件（如 DPA、BAA）及實體安全措施，非本應用程式單獨即可達成。
          </div>
        </div>
      </div>

      {/* 三大安全機制 */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" /> 核心安全防護機制
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 font-bold text-indigo-700 mb-4"><Activity className="w-4 h-4"/> 零信任架構 (ZTA)</div>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 每次敏感操作重新驗證 RBAC 權限</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 閒置 30 分鐘自動強制登出</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 行為稽核日誌記錄所有存取事件</li>
              <li className="flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0"/> 網路層 ZTA 需部署端基礎設施支援</li>
            </ul>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 font-bold text-emerald-700 mb-4"><Users className="w-4 h-4"/> 角色分層與去識別化</div>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 四層嚴密角色：個人/成員/主管/管理</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 管理者首次設定三組相異通行碼</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 去識別化：主管僅見所屬部門數據</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> k-匿名性：&lt;{K_MIN}人不顯示KPI統計</li>
            </ul>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 font-bold text-amber-700 mb-4"><Key className="w-4 h-4"/> 加密防護機制</div>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 本機儲存加密：AES-256-GCM</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 金鑰衍生：PBKDF2 (十萬次 SHA-256)</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 單位碼與通行碼動態衍生，不持久化</li>
              <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> 差分隱私 (Laplace) 保護彙總統計</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 資料主體權利與抹除 */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm mb-8">
        <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-rose-600" /> 行使被遺忘權 (資料抹除)
        </h3>
        <p className="text-xs text-slate-600 mb-6">
          依據《個人資料保護法》第三條，您擁有請求刪除個人資料之權利。點擊下方按鈕將徹底清除儲存於本機裝置的所有健康紀錄、加密金鑰與登入狀態。
        </p>

        {!eraseConfirm ? (
          <button 
            onClick={() => setEraseConfirm(true)} 
            className="w-full py-4 border-2 border-rose-200 text-rose-600 font-bold rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" /> 行使刪除權 (清除本裝置資料)
          </button>
        ) : (
          <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 animate-in fade-in">
            <div className="text-sm font-bold text-rose-700 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> 警告：此操作無法復原
            </div>
            <p className="text-xs text-rose-600 mb-6">您確定要刪除所有本機資料嗎？包含您的登入 Session 與所有填寫過的問卷紀錄都將被永久抹除，系統將為您強制登出。</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setEraseConfirm(false)} 
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50"
              >
                取消
              </button>
              <button 
                onClick={handleDataErase} 
                className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl shadow-md hover:bg-rose-700"
              >
                確認永久刪除
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 行為稽核日誌 (Audit Log) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl text-slate-300">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-400" /> 本次 Session 行為稽核日誌 (Audit Log)
          </h3>
          <button 
            onClick={() => setShowAudit(!showAudit)} 
            className="px-4 py-2 border border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            {showAudit ? "收起日誌" : "展開查閱"}
          </button>
        </div>
        
        <p className="text-xs text-slate-500 mb-4">系統實作零信任監控。以下記錄僅留存於本次登入狀態的記憶體中，絕不上傳伺服器。</p>

        {showAudit && (
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 max-h-64 overflow-y-auto font-mono text-[10px] space-y-2">
            {auditLog.length === 0 ? (
              <div className="text-center text-slate-600 py-8">目前尚無行為紀錄</div>
            ) : (
              auditLog.map((entry, i) => (
                <div key={i} className={`flex gap-4 p-2 rounded ${entry.action.includes('DENIED') ? 'bg-rose-900/20 text-rose-300' : 'hover:bg-slate-800/50'}`}>
                  <span className={`font-bold shrink-0 w-32 ${entry.action.includes('DENIED') ? 'text-rose-400' : 'text-emerald-400'}`}>
                    [{entry.action}]
                  </span>
                  <span className="flex-1 text-slate-400">{entry.detail}</span>
                  <span className="shrink-0 text-slate-600">{entry.ts.split('T')[1].split('.')[0]}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}