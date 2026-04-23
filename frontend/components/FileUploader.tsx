// components/FileUploader.tsx
"use client";

import { useState } from 'react';

// 1. 定義傳入的 Props 型別
interface FileUploaderProps {
  userId: string;
}

// 將型別套用到元件上
export default function FileUploader({ userId }: FileUploaderProps) {
  const [loading, setLoading] = useState(false);

  // 2. 定義事件 'e' 的型別為 React 的 Input 改變事件
  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // 確保有選擇檔案
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    formData.append('assessment_round', '1');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        window.location.href = `/result?id=${data.record_id}`;
      } else {
        console.error("分析失敗:", data.detail);
      }
    } catch (err) {
      console.error("上傳發生錯誤:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-green-200 p-10 text-center rounded-xl">
      <input 
        type="file" 
        accept=".pdf"
        onChange={onUpload} 
        disabled={loading} 
        className="hidden" 
        id="pdf-upload" 
      />
      <label 
        htmlFor="pdf-upload" 
        className={`cursor-pointer px-6 py-3 rounded-lg text-white transition-colors ${
          loading ? "bg-slate-400 cursor-not-allowed" : "bg-green-700 hover:bg-green-800"
        }`}
      >
        {loading ? "AI 深度分析中..." : "上傳舒曼共振報告 (PDF)"}
      </label>
    </div>
  );
}