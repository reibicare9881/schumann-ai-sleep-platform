"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Download, ArrowLeft } from "lucide-react";

export default function ResultPage() {
  const searchParams = useSearchParams();
  const reportUrl = searchParams.get("url");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-6">
          <CheckCircle className="w-16 h-16 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 mb-2">分析完成！</h1>
        <p className="text-slate-600 mb-8">
          您的舒曼共振報告已成功解析，並已存入資料庫中。
        </p>

        <div className="space-y-4">
          {reportUrl && (
            <a 
              href={reportUrl} 
              target="_blank" 
              rel="noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center"
            >
              <Download className="w-5 h-5 mr-2" />
              開啟 PDF 報告
            </a>
          )}
          
          <Link 
            href="/"
            className="w-full bg-white hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-lg transition-colors flex items-center justify-center border border-slate-200"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}