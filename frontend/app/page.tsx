"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { 
  Upload, FileText, Loader2, AlertCircle, 
  History, LogOut, ChevronDown, ChevronUp, RefreshCw, Globe
} from "lucide-react";
// 如果你的 Logo 放在 public/reibi_logo.png，可以使用 img 標籤或 next/image

export default function SchumannHomePage() {
  const router = useRouter();
  const { session, logout, switchPlatform } = useAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  
  // 🌟 新增：控制 AI 生成報告的語言狀態
  const [language, setLanguage] = useState("🇹🇼 繁體中文");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError("");
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(selectedFile));
      setShowPreview(true);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    const currentUserId = session?.id || session?.apiSession?.user_id;
    const token = session?.apiSession?.access_token;
    
    if (!currentUserId || !token) {
      setError("無法取得登入憑證，請重新登入");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", currentUserId);
    formData.append("assessment_round", "1");
    // 🌟 關鍵：將選擇的語言傳遞給後端 API
    formData.append("language", language); 

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.status === "success") {
        router.push(`/result?id=${data.record_id}`);
      } else {
        throw new Error(data.detail || "分析失敗，請檢查後端狀態");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchPlatform = async () => {
    const success = await switchPlatform('sleep');
    if (success) {
      router.push('/dashboard');
    } else {
      alert("切換平台失敗");
    }
  };

  if (!session) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      
      {/* ================= 左側：操作側邊欄 ================= */}
      <div className="w-full md:w-[320px] bg-slate-50 border-r border-slate-200 flex flex-col h-screen sticky top-0">
        
        {/* 🌟 復原：Logo 與身分區塊 */}
        {/* 🌟 品牌與個人名片區塊 */}
        {/* 🌟 品牌與個人名片區塊 (視覺放大版) */}
        <div className="p-6 border-b border-slate-200">
          
          {/* 1. 系統品牌 Logo 區 */}
          <div className="flex items-center gap-4 mb-6"> {/* gap-3 改 gap-4 增加呼吸空間 */}
            {/* Logo 外框加大到 w-14 h-14 */}
            <div className="w-14 h-14 bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              {/* 標題字體加大到 text-xl */}
              <h2 className="text-xl font-bold text-slate-800 leading-tight">舒曼共振平台</h2>
            </div>
          </div>

          {/* 2. 個人資訊小名片 (User Profile Card) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm mb-6 flex items-center gap-3">
            {/* 頭像稍微加大到 w-11 h-11 */}
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-inner">
              {session?.name ? session.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex flex-col overflow-hidden">
              {/* 顯示使用者姓名 (字體稍微加大到 text-base) */}
              <span className="text-base font-bold text-slate-800 truncate">
                {session?.name || "未知使用者"}
              </span>
              {/* 顯示單位名稱 (使用 org_code) */}
              <span className="text-sm text-slate-500 truncate mt-0.5">
                {session?.org_code ? `單位：${session.org_code}` : "個人帳號"}
              </span>
            </div>
          </div>

          {/* 3. 操作按鈕 */}
          <div className="flex flex-col gap-2">
            <button onClick={handleSwitchPlatform} className="flex items-center gap-2 text-sm text-indigo-600 font-bold hover:bg-indigo-50 p-2 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" /> 切換至睡眠平台
            </button>
            <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-500 font-bold hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" /> 登出系統
            </button>
          </div>
        </div>

        {/* 🌟 復原：語言切換區塊 */}
        <div className="px-6 pt-6 pb-2">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
            <Globe className="w-4 h-4" /> Language / 語言
          </label>
          <div className="relative">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 px-4 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer shadow-sm"
            >
              <option value="🇹🇼 繁體中文">🇹🇼 繁體中文</option>
              <option value="🇨🇳 簡體中文">🇨🇳 簡體中文</option>
              <option value="🇯🇵 日本語">🇯🇵 日本語</option>
              <option value="🇺🇸 English">🇺🇸 English</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 上傳區塊 */}
        <div className="p-6 flex-1">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-1">請上傳您的報告</h3>
            <p className="text-xs text-slate-500 mb-4">請選擇 PDF 分析報告檔案</p>

            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange} 
              className="hidden" 
              id="sidebar-file-upload"
              disabled={loading}
            />
            
            <label htmlFor="sidebar-file-upload" className="cursor-pointer block">
              <div className={`border border-dashed rounded-lg p-4 text-center transition-colors ${file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-medium">選擇檔案 (Upload)</span>
                  </div>
                )}
              </div>
            </label>

            {error && (
              <div className="mt-3 flex items-center text-red-600 bg-red-50 p-2 rounded text-xs">
                <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" /> {error}
              </div>
            )}

            {file && (
              <button
                onClick={handleUpload}
                disabled={loading}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center text-sm disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> AI 分析中...</>
                ) : (
                  "啟動 AI 深度分析"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================= 右側：主內容與預覽區 ================= */}
      <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-white">
        
        {/* 外層容器：控制最大寬度並居中，內容整體靠左 */}
        <div className="max-w-5xl mx-auto xl:ml-10">
          
          {/* 🌟 標題區 (完美還原附圖的橫向排版與垂直居中) */}
          <div className="flex flex-row items-center gap-6 mb-10 mt-6">
            {/* Logo */}
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-24 md:w-[110px] object-contain shrink-0" 
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            
            {/* 標題與副標題 */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-[2.5rem] font-bold tracking-tight text-[#2A5A3B] leading-none">
                  舒曼共振身心靈 AI 解說報告
                </h1>
              </div>
              <p className="text-slate-500 text-lg md:text-xl leading-relaxed">
                透過量子共振數據，探索您內在的能量風景
              </p>
            </div>
          </div>

          {/* 檔案預覽或歡迎視窗 */}
          <div className="w-full">
            {!pdfUrl ? (
              // 🌟 歡迎視窗 (還原淡藍色底色、藍灰色字體與對齊邊界)
              <div className="bg-[#F0F5FA] rounded-xl p-5 border border-transparent">
                <p className="text-[#5174A8] font-medium text-[15px]">
                  請從左側上傳您的分析報告開始。
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                {/* 預覽區標題列 (可收合) */}
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
                >
                  <div className="flex items-center gap-2 text-slate-700 font-bold">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    檢視原始上傳文件
                  </div>
                  {showPreview ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                
                {/* PDF iframe 渲染區塊 */}
                {showPreview && (
                  <div className="bg-slate-100 p-4">
                    <iframe 
                      src={`${pdfUrl}#toolbar=0&navpanes=0`} 
                      className="w-full h-[600px] rounded-lg shadow-inner bg-white border border-slate-200"
                      title="PDF Preview"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}