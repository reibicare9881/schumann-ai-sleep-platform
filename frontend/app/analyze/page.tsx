"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, AlertCircle } from "lucide-react";

export default function AnalyzePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // 預設帶入我們在資料庫建好的測試帳號 ID
  const [userId, setUserId] = useState("33bb2f97-e8ec-4723-b538-30efbfc91827");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("請先選擇一份 PDF 檔案");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", userId);
    formData.append("assessment_round", "1");

    try {
      // 呼叫你的 FastAPI 後端
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.status === "success") {
        // 成功後跳轉到結果頁面，並帶上 record_id
        router.push(`/result?id=${data.record_id}&url=${encodeURIComponent(data.report_url)}`);
      } else {
        throw new Error(data.detail || "分析失敗，請檢查後端狀態");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center pt-20">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-800">上傳舒曼共振報告</h1>
          <p className="text-slate-500 mt-2">支援上傳儀器產出的 PDF 原始檔</p>
        </div>

        <div className="space-y-6">
          {/* 測試用：User ID 輸入框 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">使用者 ID (測試用)</label>
            <input 
              type="text" 
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* 拖曳與選擇檔案區塊 */}
          <div className="border-2 border-dashed border-emerald-200 rounded-xl p-10 text-center hover:bg-emerald-50 transition-colors">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange} 
              className="hidden" 
              id="file-upload"
              disabled={loading}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              {file ? (
                <>
                  <FileText className="w-12 h-12 text-emerald-600 mb-3" />
                  <span className="text-slate-800 font-medium">{file.name}</span>
                  <span className="text-slate-500 text-sm mt-1">點擊重新選擇檔案</span>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-slate-400 mb-3" />
                  <span className="text-slate-600 font-medium">點擊選擇 PDF 檔案</span>
                  <span className="text-slate-400 text-sm mt-1">或將檔案拖曳至此處</span>
                </>
              )}
            </label>
          </div>

          {/* 錯誤提示 */}
          {error && (
            <div className="flex items-center text-red-600 bg-red-50 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 送出按鈕 */}
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                AI 深度解析中，請稍候...
              </>
            ) : (
              "開始分析"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}