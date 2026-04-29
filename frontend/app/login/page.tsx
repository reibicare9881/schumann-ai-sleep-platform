"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  User, Building2, ChevronLeft, Lock, ShieldCheck, 
  Info, Check, Globe, HelpCircle 
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { C, ROLES, PERMS } from "@/lib/config";
import { DB, stor } from "@/lib/store";
import API from "@/lib/api";

// ══ 內部元件：任務橫幅 (Mission Banner) ══
const MissionBanner = () => (
  <div className="bg-linear-to-br from-[#1a6474] to-[#2a7d8c] text-white p-6 mb-8 rounded-2xl shadow-xl">
    <div className="flex items-center gap-4 mb-4">
      <div className="text-3xl">🌿</div>
      <div>
        <div className="text-base font-bold">麗媚生化科技 REIBI · 健康自主管理平台</div>
        <div className="text-[10px] opacity-75 tracking-widest uppercase">Health Self-Management Platform</div>
      </div>
    </div>
    <div className="text-sm font-bold mb-2">💚 自己的健康，自己照顧</div>
    <div className="text-xs leading-relaxed opacity-90 mb-4">
      養成關注健康的習慣，從「知道」到「做到」，落實身心健康自主管理。睡眠品質、疼痛管理與慢病防治，一次掌握。
    </div>
    <div className="flex flex-wrap gap-2">
      {["🔍 健康識能提升", "💊 慢病三高管理", "🌙 睡眠品質改善", "💪 疼痛緩解", "📊 企業健康KPI"].map(t => (
        <span key={t} className="text-[10px] px-2 py-1 rounded-full bg-white/15 border border-white/30">{t}</span>
      ))}
    </div>
  </div>
);

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"individual" | "org" | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 個人模式狀態
  const [iName, setIName] = useState("");

  // 組織模式狀態
  const [oName, setOName] = useState("");
  const [oCode, setOCode] = useState("");
  const [oOrgName, setOOrgName] = useState("");
  const [oRole, setORole] = useState("member");
  const [pin, setPin] = useState("");
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [setupMPin, setSetupMPin] = useState("");
  const [setupDPin, setSetupDPin] = useState("");
  const [setupAPin, setSetupAPin] = useState("");

  // 邏輯：自動填寫單位名稱與偵測首次設定
  useEffect(() => {
    if (mode === "org" && oCode.length >= 3) {
      const code = oCode.toUpperCase();
      DB.getCreds(code).then((c: any) => {
        setIsFirstTime(!c);
        if (c?.orgName && !oOrgName) setOOrgName(c.orgName);
      });
    } else {
      setIsFirstTime(null);
    }
  }, [mode, oCode, oOrgName]);

  // 邏輯：載入已儲存的身份
  useEffect(() => {
    if (mode === "org" && oCode.length >= 3 && oRole !== "admin") {
      stor.get("mem_id_" + oCode.toUpperCase() + "_" + oRole).then((d: any) => {
        if (d?.name && !oName) setOName(d.name);
      });
    }
  }, [mode, oCode, oRole, oName]);

  // 執行：個人登入
  const doIndividualLogin = async () => {
    if (!iName.trim()) { setErr("請輸入姓名或代稱"); return; }
    setLoading(true);
    setErr("");

    try {
      // ✅ 補上 name 參數
      const apiResult = await API.login('sleep', { 
        role: 'individual',
        name: iName.trim() 
      });
      
      if (apiResult.status === 'success') {
        const { user, session, access_token } = apiResult; // 記得接 access_token
        const s = {
          uid: user?.id || session?.user_id,
          name: iName.trim(),
          systemRole: "individual",
          loginTs: new Date().toISOString(),
          apiSession: session,
          platform: 'sleep',
          accessToken: access_token // 存起來供後續 API 使用
        };
        await DB.saveSession(s);
        login(s);
        return;
      } else {
        // 如果後端回傳 400，顯示錯誤並阻斷
        setErr("登入失敗，請檢查輸入資料");
        setLoading(false);
        return;
      }
    } catch (apiError: any) {
      console.error("後端 API 不可用:", apiError);
      // 🚨 移除了本機假登入！發生錯誤直接擋下！
      setErr("伺服器連線失敗，請稍後再試");
      setLoading(false);
      return; 
    }
  };

  // 執行：組織登入
  const doOrgLogin = async () => {
    setErr("");
    if (!oCode.trim() || !oName.trim()) { setErr("請填寫姓名與單位代碼"); return; }
    const code = oCode.trim().toUpperCase();
    setLoading(true);

    // ... (保留你原本 96 ~ 116 行的本機首次設定檢查邏輯) ...

    try {
      // ✅ 補上 name 參數
      const apiResult = await API.login('sleep', {
        role: oRole,
        pin: pin || setupAPin,
        org_code: code,
        name: oName.trim() // 👈 關鍵修正
      });
      
      if (apiResult.status === 'success') {
        const { user, session, access_token } = apiResult;
        const s = {
          uid: user?.id || session?.user_id,
          name: oName.trim(),
          orgCode: code,
          orgName: oOrgName.trim() || code, // 顯示用
          systemRole: oRole,
          loginTs: new Date().toISOString(),
          apiSession: session,
          platform: 'sleep',
          accessToken: access_token
        };
        await DB.saveSession(s);
        login(s);
        return;
      } else {
        setErr("登入驗證失敗");
        setLoading(false);
        return;
      }
    } catch (apiError: any) {
      console.error("後端 API 不可用:", apiError);
      // 🚨 移除了本機假登入！
      setErr("伺服器連線失敗或帳密錯誤");
      setLoading(false);
      return;
    }
  };

  const nonAdminRoles = Object.entries(ROLES).filter(([k]) => k !== "individual");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <MissionBanner />

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">健康自主管理評估系統</h1>
        <p className="text-sm text-slate-500">Sleep × Pain 聯合評估 · 國際標準量表</p>
      </div>

      {!mode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => setMode("individual")}
            className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <User className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">個人使用</h3>
            <p className="text-xs text-slate-500 leading-relaxed">個人健康自主管理<br/>完整存取個人報告</p>
          </button>

          <button 
            onClick={() => setMode("org")}
            className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:border-plum-500 hover:shadow-md transition-all text-center group"
          >
            <div className="bg-purple-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Building2 className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">單位 / 組織</h3>
            <p className="text-xs text-slate-500 leading-relaxed">多層級角色分權<br/>OKR 績效管理</p>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <button onClick={() => {setMode(null); setErr("");}} className="text-slate-400 hover:text-slate-600 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="font-bold text-slate-800">
              {mode === "individual" ? "個人模式登入" : "單位模式登入"}
            </h2>
            <div className="w-6" /> {/* Spacer */}
          </div>

          <div className="p-8 space-y-6">
            {mode === "individual" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">您的姓名 / 代稱</label>
                  <input 
                    type="text" value={iName} onChange={e => setIName(e.target.value)}
                    placeholder="請輸入姓名"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                  <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 leading-relaxed">提示：個人模式資料僅儲存於本裝置，更換裝置或清除瀏覽器快取將導致資料遺失。</p>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">姓名 / 代稱 (去識別化)</label>
                    <input 
                      type="text" value={oName} onChange={e => setOName(e.target.value)}
                      placeholder="個人識別用"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">單位代碼 (Org Code)</label>
                    <input 
                      type="text" value={oCode} onChange={e => setOCode(e.target.value.toUpperCase())}
                      placeholder="例: REIBI001"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">單位名稱</label>
                  <input 
                    type="text" value={oOrgName} onChange={e => setOOrgName(e.target.value)}
                    placeholder="例: 麗媚生化科技"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3 text-center">請選擇登入角色</label>
                  <div className="space-y-3">
                    {nonAdminRoles.map(([key, role]) => (
                      <button 
                        key={key} onClick={() => setORole(key)}
                        className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${oRole === key ? 'border-purple-500 bg-purple-50' : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 mt-1 shrink-0 flex items-center justify-center ${oRole === key ? 'border-purple-500 bg-purple-500' : 'border-slate-300'}`}>
                          {oRole === key && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{role.icon} {role.label}</div>
                          <div className="text-[10px] text-slate-500 mt-1">{role.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {isFirstTime === true && oRole === "admin" && (
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                      <ShieldCheck className="w-5 h-5" /> 首次設定管理者權限
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <input type="password" value={setupMPin} onChange={e => setSetupMPin(e.target.value)} placeholder="設定單位成員通行碼" className="w-full px-4 py-2 text-sm rounded-lg border border-purple-200" />
                      <input type="password" value={setupDPin} onChange={e => setSetupDPin(e.target.value)} placeholder="設定部門主管通行碼" className="w-full px-4 py-2 text-sm rounded-lg border border-purple-200" />
                      <input type="password" value={setupAPin} onChange={e => setSetupAPin(e.target.value)} placeholder="設定您的管理者密碼" className="w-full px-4 py-2 text-sm rounded-lg border border-purple-500 bg-white" />
                    </div>
                  </div>
                )}

                {isFirstTime === false && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">🔐 通行碼驗證</label>
                    <input 
                      type="password" value={pin} onChange={e => setPin(e.target.value)}
                      placeholder={`請輸入${ROLES[oRole]?.label}通行碼`}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                )}
              </>
            )}

            {err && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-xs font-medium border border-red-100 animate-pulse">
                ⚠ {err}
              </div>
            )}

            <button 
              onClick={mode === "individual" ? doIndividualLogin : doOrgLogin}
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all transform active:scale-95 ${mode === "individual" ? 'bg-linear-to-r from-emerald-600 to-teal-700' : 'bg-linear-to-r from-purple-600 to-plum-700'}`}
            >
              {loading ? "驗證中..." : (isFirstTime ? "建立並進入單位 →" : "進入系統 →")}
            </button>

            {/* 權限說明表 (僅在組織模式顯示) */}
            {mode === "org" && (
              <div className="pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-4 uppercase tracking-widest">
                  <Lock className="w-3 h-3" /> 各角色權限矩陣
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-slate-50 text-slate-400 uppercase">
                      <tr>
                        <th className="px-4 py-2">功能項目</th>
                        <th className="px-2 py-2 text-center">成員</th>
                        <th className="px-2 py-2 text-center">主管</th>
                        <th className="px-2 py-2 text-center">管理</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {PERMS.filter(p => p.roles.includes("member")).map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2 text-slate-600 font-medium">{p.label}</td>
                          {["member", "dept_head", "admin"].map(r => (
                            <td key={r} className="px-2 py-2 text-center">
                              {p.roles.includes(r) ? <Check className="w-3 h-3 text-emerald-500 mx-auto" /> : <span className="text-slate-200">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}