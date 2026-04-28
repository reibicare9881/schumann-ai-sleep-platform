"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { DB } from "@/lib/store";
import { SQ, PQ, ROLES, LX, LL } from "@/lib/config";
import { ChevronLeft, TrendingUp, BookOpen, Waves, AlertTriangle, FileText, CheckCircle2, Printer } from "lucide-react";
import html2pdf from "html2pdf.js";

// ══ PDF 報表產生器 (完整版 from sleepplatform.txt) ═══════════════════════════════════════════════
const buildPDF = (report: any, session: any) => {
  const { 
    profile = {}, 
    sScore = 0, 
    sLevel = { key: "green", label: "" }, 
    sAns = {}, 
    pScore = 0, 
    pLevel = { key: "green", label: "" }, 
    pAns = {}, 
    wScore = 0,
    recs = {},
    ts, 
    id = "",
    declarationTs 
  } = report;
  
  const date = ts ? new Date(ts).toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" }) : "";
  
  // 顏色對應
  const lc: Record<string, string> = {
    green: "#2d7a5a",
    yellow: "#b07015",
    orange: "#c05a28",
    red: "#b82020"
  };
  
  // 進度條產生器
  const b = (s: number, max: number) => {
    const p = Math.round(s / max * 100);
    const c = p === 0 ? "#2d7a5a" : p <= 33 ? "#7ab828" : p <= 66 ? "#b07015" : p <= 83 ? "#c05a28" : "#b82020";
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;page-break-inside:avoid">
      <div style="flex:1;height:6px;background:#e8ddd4;border-radius:3px;min-width:60px">
        <div style="width:${p}%;height:100%;background:${c};border-radius:3px"></div>
      </div>
      <span style="font-size:11px;color:${c};font-weight:700;min-width:32px;text-align:right">${s}/${max}</span>
    </div>`;
  };
  
  // 建議區塊產生器
  const rec = (icon: string, ti: string, co: string, ac: string) => `
    <div style="margin-bottom:10px;padding:9px 12px;border-left:4px solid ${ac};background:#faf8f5;border-radius:0 7px 7px 0">
      <div style="font-size:11px;font-weight:700;color:${ac};margin-bottom:3px">${icon} ${ti}</div>
      <p style="font-size:11px;color:#4a3c38;line-height:1.8;margin:0">${co || ""}</p>
    </div>`;

  return `<!DOCTYPE html><html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>健康報告_${profile.name || "匿名"}_${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Noto Serif TC', 'Microsoft JhengHei', 'Georgia', serif; color: #2a2220; background: #f8f7f5; font-size: 13px; line-height: 1.7; }
    @page { size: A4; margin: 15mm 12mm; }
    @media print { .np { display: none !important; }; body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    .st { font-size: 15px; font-weight: 800; color: #217a8c; border-bottom: 2.5px solid #e8ddd4; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 1px; }
    .sec { margin-bottom: 18px; padding: 0; page-break-inside: avoid !important; break-inside: avoid; }
    .np { position: fixed; top: 10px; right: 10px; z-index: 99; display: flex; gap: 7px; }
    .divider { border-top: 1.5px dashed #e8ddd4; margin: 16px 0 12px 0; page-break-inside: avoid; page-break-after: avoid; }
    .table-title { font-size: 12px; color: #6a5e58; font-weight: 700; margin-bottom: 6px; margin-top: 2px; }
    .score-table { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
    .score-table td { padding: 3px 6px; font-size: 11px; word-wrap: break-word; }
    .score-table tr { border-bottom: 0.5px solid #f0ece8; page-break-inside: avoid; }
    .rec-block { margin-bottom: 8px; padding: 9px 11px; border-left: 5px solid var(--rec-color,#2a7d8c); background: #faf8f5; border-radius: 0 10px 10px 0; box-shadow: 0 1px 4px #0001; page-break-inside: avoid !important; break-inside: avoid; }
    .rec-title { font-size: 11px; font-weight: 700; color: var(--rec-color,#2a7d8c); margin-bottom: 2px; letter-spacing: 0.3px; }
    .rec-content { font-size: 11px; color: #4a3c38; line-height: 1.65; margin: 0; word-wrap: break-word; overflow-wrap: break-word; }
    .hero { background: linear-gradient(135deg,#2a7d8c,#1a6474); color: #fff; padding: 36px 28px 28px 28px; border-radius: 14px; margin-bottom: 22px; text-align: center; box-shadow: 0 2px 12px #0002; page-break-inside: avoid; }
    .hero-grid { display: inline-grid; grid-template-columns: repeat(5,auto); gap: 10px 20px; background: rgba(255,255,255,.13); border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; }
    .hero-score { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }
    .score-card { background: #fff; border: 2.5px solid #e8ddd4; border-radius: 10px; padding: 10px 14px; text-align: center; min-width: 100px; box-shadow: 0 1px 6px #0001; page-break-inside: avoid; }
    .score-label { font-size: 10px; color: #6a5e58; margin-bottom: 2px; font-weight: 700; }
    .score-value { font-size: 20px; font-weight: 800; margin-bottom: 1px; }
    .score-level { font-size: 11px; font-weight: 700; }
    .footer { margin-top: 18px; padding-top: 10px; border-top: 1.5px solid #e8ddd4; }
  </style>
</head>
<body>
  <!-- 列印按鈕 (PDF 內部用) -->
  <div class="np">
    <button style="padding:8px 14px;border-radius:7px;border:none;cursor:pointer;background:#2a7d8c;color:#fff;font-size:12px;font-weight:600" onclick="window.print()">🖨️ 列印</button>
    <button style="padding:8px 14px;border-radius:7px;border:none;cursor:pointer;background:#f0ece8;color:#5a4e48;font-size:12px" onclick="window.close()">✕ 關閉</button>
  </div>
  
  <!-- 英雄區塊 -->
  <div class="hero">
    <div style="font-size:9px;letter-spacing:2px;opacity:.7;margin-bottom:6px">健康自主管理評估報告 · REIBI Health Platform</div>
    <h1 style="font-size:24px;font-weight:800;margin-bottom:4px;letter-spacing:1px">睡眠 × 疼痛聯合評估報告</h1>
    <p style="opacity:.8;font-size:11px;margin-bottom:12px">麗媚生化科技 REIBI · ISI &amp; BPI 國際量表 · 四色燈號分級</p>
    <!-- 基本資訊網格 -->
    <div class="hero-grid">
      ${[
        ["評估對象", profile.name || "匿名"],
        ["年齡", `${profile.age || "—"}歲`],
        ["日期", date],
        ["編號", id.slice(0, 8).toUpperCase()],
        ["角色", ROLES[session?.systemRole || "individual"]?.label || ""]
      ].map(([l, v]) => `
        <div style="text-align:center">
          <div style="font-size:8.5px;opacity:.65;margin-bottom:1px">${l}</div>
          <div style="font-size:11px;font-weight:700">${v}</div>
        </div>
      `).join("")}
    </div>
    <!-- 分數區塊 -->
    <div class="hero-score">
      ${[
        { l: "睡眠ISI", s: sScore, m: 28, lv: sLevel },
        { l: "疼痛BPI", s: pScore, m: 50, lv: pLevel }
      ].map(x => `
        <div class="score-card" style="border-color:${LX[x.lv.key as keyof typeof LX]?.br}">
          <div class="score-label">${x.l}</div>
          <div class="score-value" style="color:${lc[x.lv.key]}">${x.s}<span style="font-size:10px;color:#b8afa8">/${x.m}</span></div>
          <div class="score-level" style="color:${lc[x.lv.key]}">${LL[x.lv.key as keyof typeof LL]}</div>
        </div>
      `).join("")}
    </div>
  </div>
  
  <!-- 01 誠實填寫聲明 -->
  <div class="sec">
    <div class="st">01 📜 誠實填寫聲明</div>
    <div style="background:#fdf6e8;border:1.5px solid #f0c76a;border-radius:10px;padding:10px 14px;margin-bottom:1px">
      <p style="font-size:11px;color:#6b4a10;margin:0;letter-spacing:0.2px;line-height:1.6">✅ 本人已聲明所填資訊為真實健康狀況，理解此評估目的為健康自主管理促進，同意資料依本系統隱私政策處理。（${declarationTs ? new Date(declarationTs).toLocaleString("zh-TW") : "—"}）</p>
    </div>
  </div>
  <div class="divider"></div>
  
  <!-- 02 睡眠評估 (ISI) -->
  <div class="sec">
    <div class="st">02 🌙 睡眠評估（ISI）</div>
    <div style="display:flex;gap:10px;padding:10px 12px;background:${LX[sLevel.key as keyof typeof LX]?.bg};border:2px solid ${LX[sLevel.key as keyof typeof LX]?.br};border-radius:12px;margin-bottom:8px;align-items:center">
      <div style="text-align:center;min-width:48px">
        ${["red", "orange", "yellow", "green"].map(k => `
          <div style="width:14px;height:14px;border-radius:50%;margin:2px auto;background:${k === sLevel.key ? lc[k] : "#e8ddd4"}"></div>
        `).join("")}
      </div>
      <div style="text-align:left">
        <div style="font-size:16px;font-weight:800;color:${lc[sLevel.key]};margin-bottom:1px">${LL[sLevel.key as keyof typeof LL]} ${sLevel.label}</div>
        <p style="font-size:11px;color:#4a3c38;margin:2px 0 1px 0;line-height:1.5">${sLevel.desc || ""}</p>
        <p style="font-size:11px;color:${lc[sLevel.key]};font-weight:700;margin:0">▸ ${sLevel.action || ""}</p>
      </div>
    </div>
    <div class="table-title">ISI 睡眠量表細項</div>
    <table class="score-table" style="width:100%;border-collapse:collapse">
      ${SQ.map(q => `
        <tr>
          <td style="width:38%;color:#7a6e68;">${q.icon} ${q.d}</td>
          <td>${b((sAns || {})[q.id] ?? 0, 4)}</td>
        </tr>
      `).join("")}
    </table>
  </div>
  <div class="divider"></div>
  
  <!-- 03 疼痛評估 (BPI) -->
  <div class="sec">
    <div class="st">03 🩺 疼痛評估（BPI）</div>
    <div style="display:flex;gap:10px;padding:10px 12px;background:${LX[pLevel.key as keyof typeof LX]?.bg};border:2px solid ${LX[pLevel.key as keyof typeof LX]?.br};border-radius:12px;margin-bottom:8px;align-items:center">
      <div style="text-align:center;min-width:48px">
        ${["red", "orange", "yellow", "green"].map(k => `
          <div style="width:14px;height:14px;border-radius:50%;margin:2px auto;background:${k === pLevel.key ? lc[k] : "#e8ddd4"}"></div>
        `).join("")}
      </div>
      <div style="text-align:left">
        <div style="font-size:16px;font-weight:800;color:${lc[pLevel.key]};margin-bottom:1px">${LL[pLevel.key as keyof typeof LL]} ${pLevel.label}</div>
        <p style="font-size:11px;color:#4a3c38;margin:2px 0 1px 0;line-height:1.5">${pLevel.desc || ""}</p>
        <p style="font-size:11px;color:${lc[pLevel.key]};font-weight:700;margin:0">▸ ${pLevel.action || ""}</p>
      </div>
    </div>
    <div class="table-title">BPI 疼痛量表細項</div>
    <table class="score-table" style="width:100%;border-collapse:collapse">
      ${PQ.map(q => `
        <tr>
          <td style="width:38%;color:#7a6e68;">${q.icon} ${q.d}</td>
          <td>${b((pAns || {})[q.id] ?? 0, 10)}</td>
        </tr>
      `).join("")}
    </table>
  </div>
  <div class="divider"></div>
  
  <!-- 04 個人化健康促進建議 -->
  <div class="sec">
    <div class="st">04 💡 個人化健康促進建議</div>
    <div class="rec-block" style="--rec-color:#2a7d8c"> <div class="rec-title">🏃 綜合健康促進</div> <div class="rec-content">${recs.generalHealth || ""}</div> </div>
    <div class="rec-block" style="--rec-color:#c05a28"> <div class="rec-title">💊 疼痛衛教</div> <div class="rec-content">${recs.painEducation || ""}</div> </div>
    <div class="rec-block" style="--rec-color:#6b54a0"> <div class="rec-title">🌙 睡眠衛教</div> <div class="rec-content">${recs.sleepEducation || ""}</div> </div>
    <div class="rec-block" style="--rec-color:#2d7a5a"> <div class="rec-title">🥗 飲食衛教</div> <div class="rec-content">${recs.dietaryAdvice || ""}</div> </div>
    <div class="rec-block" style="--rec-color:#b07015"> <div class="rec-title">🤸 物理治療</div> <div class="rec-content">${recs.physicalTherapy || ""}</div> </div>
    <div style="background:linear-gradient(135deg,#ebf6f8,#eef0fb);border:1.5px solid #b8dfe5;border-radius:10px;padding:10px 12px;margin-top:6px;box-shadow:0 1px 4px #0001;page-break-inside:avoid">
      <div style="font-size:11px;font-weight:700;color:#1a6074;margin-bottom:2px">🔬 麗媚生化科技 REIBI · 舒曼波 &amp; LA200 雷射治療</div>
      <p style="font-size:11px;color:#2c4a52;line-height:1.65;margin:0">${recs.reibiProducts || ""}</p>
    </div>
  </div>
  <div class="divider"></div>
  
  <!-- 頁尾 -->
  <div class="footer">
    <p style="font-size:8.5px;color:#b8afa8;margin:0 0 3px 0">[1] 衛福部（2023）。2023–2026年國民健康白皮書。[2] Morin CM (1993). ISI. Guilford Press. [3] Cleeland CS (1994). BPI. Ann Acad Med.</p>
    <p style="font-size:8.5px;color:#c05a28;font-weight:700;margin:0 0 3px 0">⚠ 本報告僅供健康篩查，不能替代專業醫療診斷。</p>
    <p style="font-size:8.5px;color:#d0c8c0;text-align:center;margin-top:6px">報告編號：${id.toUpperCase()} · ${date} · 麗媚生化科技 REIBI健康管理系統</p>
  </div>
</body>
</html>`;
};

export default function ReportPage() {
  const { id } = useParams();
  const { session, loading } = useAuth();
  const router = useRouter();
  
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (session) {
      DB.loadReports().then((reports: any[]) => {
        const found = reports.find(r => r.id === id);
        if (found) setReport(found);
        else setError(true);
      });
    }
  }, [id, session]);

  if (loading || (!report && !error)) return <div className="text-center py-20">報告讀取中...</div>;
  if (error) return <div className="text-center py-20">找不到此報告紀錄</div>;

  const sLv = report.sLevel || { key: "green", label: "" };
  const pLv = report.pLevel || { key: "green", label: "" };
  const wScore = report.wScore || 0;
  const comorbid = ["yellow", "orange", "red"].includes(sLv.key) && ["yellow", "orange", "red"].includes(pLv.key);
  const recs = report.recs || {};

  const handleDownloadPDF = () => {
    const html = buildPDF(report, session);
    const element = document.createElement("div");
    element.innerHTML = html;
    
    const opt = {
      margin: [10, 9, 10, 9] as [number, number, number, number],
      filename: `健康報告_${report.profile?.name || "匿名"}_${new Date(report.ts).toLocaleDateString("zh-TW")}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, windowHeight: 1600 },
      jsPDF: { orientation: "portrait" as const, unit: "mm" as const, format: "a4" },
      pagebreak: { mode: "avoid-all" as any }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  const handlePrintPDF = () => {
    const html = buildPDF(report, session);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => printWindow.print(), 250);
      };
    }
  };

  const RecBox = ({ title, content, colorClass, icon }: any) => (
    <div className={`p-5 rounded-2xl border-l-4 mb-4 bg-white shadow-sm ${colorClass}`}>
      <h4 className="font-bold flex items-center gap-2 mb-2 text-slate-800">{icon} {title}</h4>
      <p className="text-sm text-slate-600 leading-relaxed">{content}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* 頂部導航 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push("/history")} className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> 歷史清單
        </button>
        <div className="flex gap-2">
          <button onClick={handleDownloadPDF} className="bg-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-teal-700 shadow-sm transition-colors">
            <FileText className="w-4 h-4" /> 下載 PDF
          </button>
          <button onClick={handlePrintPDF} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-blue-700 shadow-sm transition-colors">
            <Printer className="w-4 h-4" /> 列印
          </button>
          <button onClick={() => router.push("/analysis")} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors">
            <TrendingUp className="w-4 h-4" /> 看趨勢圖
          </button>
        </div>
      </div>

      {/* 英雄區塊 (Hero Section) */}
      <div className="bg-linear-to-r from-teal-700 to-indigo-800 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><FileText className="w-32 h-32" /></div>
        <div className="relative z-10">
          <div className="text-[10px] tracking-widest opacity-70 mb-2">REIBI HEALTH REPORT</div>
          <h1 className="text-3xl font-bold mb-4">睡眠 × 疼痛 聯合評估報告</h1>
          <div className="flex flex-wrap gap-4 text-sm opacity-90 mb-8 bg-white/10 inline-flex px-4 py-2 rounded-lg">
            <span>評估者：{report.profile?.name || "匿名"}</span>
            <span>|</span>
            <span>日期：{new Date(report.ts).toLocaleDateString()}</span>
            <span>|</span>
            <span>報告編號：{String(id).slice(0, 8).toUpperCase()}</span>
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="bg-white text-slate-900 rounded-2xl p-4 min-w-[140px] text-center shadow-md">
              <div className="text-xs text-slate-500 mb-1 font-bold">睡眠 (ISI)</div>
              <div className="text-3xl font-black mb-1" style={{ color: LX[sLv.key as keyof typeof LX]?.c }}>{report.sScore}<span className="text-sm text-slate-400">/28</span></div>
              <div className="text-xs font-bold" style={{ color: LX[sLv.key as keyof typeof LX]?.c }}>{LL[sLv.key as keyof typeof LX]}</div>
            </div>
            <div className="bg-white text-slate-900 rounded-2xl p-4 min-w-[140px] text-center shadow-md">
              <div className="text-xs text-slate-500 mb-1 font-bold">疼痛 (BPI)</div>
              <div className="text-3xl font-black mb-1" style={{ color: LX[pLv.key as keyof typeof LX]?.c }}>{report.pScore}<span className="text-sm text-slate-400">/50</span></div>
              <div className="text-xs font-bold" style={{ color: LX[pLv.key as keyof typeof LX]?.c }}>{LL[pLv.key as keyof typeof LX]}</div>
            </div>
            <div className="bg-white text-slate-900 rounded-2xl p-4 min-w-[140px] text-center shadow-md">
              <div className="text-xs text-slate-500 mb-1 font-bold">工作效率</div>
              <div className="text-3xl font-black mb-1 text-amber-600">{wScore}<span className="text-sm text-slate-400">/30</span></div>
              <div className="text-xs font-bold text-amber-600">{wScore <= 10 ? "🟢 影響極微" : wScore <= 20 ? "🟡 中度干擾" : "🔴 嚴重干擾"}</div>
            </div>
          </div>
        </div>
      </div>

      {comorbid && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-4 shadow-sm animate-in slide-in-from-bottom-4">
          <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800 mb-1">⚠️ 疼痛–睡眠共病警示</h4>
            <p className="text-sm text-amber-700 leading-relaxed">您的評估結果顯示同時存在疼痛與睡眠問題，這容易形成「疼痛–失眠惡性循環」。建議整合治療並告知您的醫師。</p>
          </div>
        </div>
      )}

      {/* 衛教建議區塊 */}
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-emerald-600" /> 個人化健康促進建議
      </h3>
      
      <div className="space-y-4">
        <RecBox title="綜合健康方針" content={recs.generalHealth} icon="🏃" colorClass="border-teal-500" />
        <RecBox title="睡眠衛教建議" content={recs.sleepEducation} icon="🌙" colorClass="border-indigo-500" />
        <RecBox title="疼痛衛教建議" content={recs.painEducation} icon="💊" colorClass="border-rose-500" />
        <RecBox title="物理治療建議" content={recs.physicalTherapy} icon="🤸" colorClass="border-amber-500" />
        
        <div className="bg-slate-900 rounded-2xl p-6 text-white mt-8 shadow-xl">
          <h4 className="font-bold flex items-center gap-2 mb-3 text-emerald-400"><Waves className="w-5 h-5" /> 系統介入：舒曼波與雷射療程</h4>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{recs.reibiProducts}</p>
          <button onClick={() => router.push("/appointment")} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            前往預約排程 →
          </button>
        </div>
      </div>

    </div>
  );
}