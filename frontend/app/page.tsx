// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import { UploadCloud, History, Globe } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-screen bg-white text-slate-800">
      
      {/* ================= 左側邊欄 (Sidebar) ================= */}
      {/* 提供語言選擇與快速上傳區塊 */}
      <div className="w-80 bg-slate-50 border-r border-slate-200 p-8 flex flex-col space-y-10">
        
        {/* 1. Logo 區塊 (側邊欄頂端) */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 relative flex-shrink-0">
            {/* Logo 圖片：會自動讀取 public/logo.png */}
            <Image 
              src="/logo.png" 
              alt="REIBI Logo" 
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              睡眠大師 <span className="text-emerald-600">AI</span>
            </h1>
            <p className="text-xs text-slate-500">v2.5 Professional Edition</p>
          </div>
        </div>

        {/* 2. 語言選擇區塊 */}
        <div className="space-y-3">
          <div className="flex items-center text-sm font-medium text-slate-600">
            <Globe className="w-4 h-4 mr-2" />
            Language / 語言
          </div>
          <select className="w-full border border-slate-300 rounded-lg py-2.5 px-4 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-inner">
            <option>TW 繁體中文</option>
            <option>EN English</option>
          </select>
        </div>

        {/* 3. 快速開始區塊 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">請上傳您的報告</h2>
          <p className="text-sm text-slate-500 mb-6">請從此處選擇或拖曳報告檔案。</p>
          
          <Link href="/analyze" className="inline-flex w-full items-center justify-center space-x-2 py-3 px-5 border border-slate-300 rounded-lg shadow-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:border-emerald-500 hover:text-emerald-700 hover:shadow-md transition-all">
            <UploadCloud className="w-4 h-4 mr-2" />
            <span>Upload</span>
          </Link>
          
          <p className="text-xs text-slate-400">200MB per file • PDF, PNG, JPG, J...</p>
        </div>
        
        {/* 左下角歷史紀錄按鈕 */}
        <div className="mt-auto pt-6 border-t border-slate-200">
          <Link href="/history" className="inline-flex w-full items-center justify-center space-x-2 py-3 px-5 rounded-lg font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:shadow-md transition-all">
            <History className="w-4 h-4 mr-2" />
            <span>查看歷史紀錄</span>
          </Link>
        </div>
      </div>

      {/* ================= 右側主內容區 (Main Content) ================= */}
      {/* 這裡是預設歡迎畫面 */}
      <div className="flex-1 flex flex-col items-center pt-48 px-16 space-y-12">
        
        {/* 中央標題與 Logo (大型顯示) */}
        <div className="flex flex-col items-center text-center space-y-8">
          {/* 中央大型 Logo */}
          <div className="w-32 h-32 relative">
            <Image 
              src="/logo.png" 
              alt="REIBI Logo Large" 
              fill
              className="object-contain"
              priority
            />
          </div>
          
          {/* 文字標題 */}
          <div className="space-y-4">
            <h1 className="text-5xl font-extrabold text-[#3B4C36] tracking-wide">
              舒曼共振身心靈 AI 解說報告
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              透過先進的量子共振數據與 AI 深度模型，解析您的心率變異與能量頻率，探索您內在的能量風景。
            </p>
          </div>
        </div>

        {/* 淺藍色引導提示框 */}
        <div className="w-full max-w-4xl bg-[#EEF2FF] text-[#4F46E5] p-6 rounded-2xl text-lg font-medium border border-[#E0E7FF] text-center shadow-sm">
          歡迎使用！請從左側上傳您的原始分析報告開始，立即生成專屬深度解析報告。
        </div>

      </div>
    </div>
  );
}