"use client";

/**
 * 關於 REIBI（移植自 Artifact 主平台的 AboutREIBIScreen）。
 *
 * 五個分頁中有三個尚未定稿，內容為佔位。這一頁不自行判斷哪個是佔位 ——
 * 後端每個分頁都帶 `is_placeholder`，畫面照著顯示警示。
 *
 * 為什麼要標示得這麼明顯：一段看起來完成的公司使命宣言會被直接拿去對外簡報。
 * 留白會被補上，看起來完成的東西不會。
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Info, Loader2, TriangleAlert } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type Row = Record<string, any>;

export default function AboutReibiPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Row | null>(null);
  const [tab, setTab] = useState("mission");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response: any = await API.getReibiAbout();
    if (response.status === "success") setData(response.data);
    else setError(response.message || "無法讀取內容");
  }, []);

  useEffect(() => { if (session) void load(); }, [session, load]);

  if (loading || !session) return null;

  const tabs: Row[] = data?.tabs || [];
  const current = tabs.find(item => item.key === tab) || tabs[0] || null;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <div>
        <button onClick={() => router.push("/dashboard")} className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> 返回主選單
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Info className="h-6 w-6 text-teal-600" /> 關於 REIBI
        </h1>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!data && !error && <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>}

      {data && current && (
        <>
          {data.placeholder_count > 0 && (
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-bold text-amber-900">{data.placeholder_count} 個分頁尚未定稿</div>
                <p className="mt-1 text-xs text-amber-800">{data.placeholder_notice}</p>
              </div>
            </div>
          )}

          <nav className="flex flex-wrap gap-2">
            {tabs.map(item => (
              <button key={item.key} onClick={() => setTab(item.key)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${item.key === current.key ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                {item.title}{item.is_placeholder && <span className="ml-1 text-amber-500">•</span>}
              </button>
            ))}
          </nav>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            {current.is_placeholder && (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                本分頁為佔位內容，請勿對外引用。
              </div>
            )}

            {current.sections?.map((section: Row) => (
              <div key={section.heading}>
                <h2 className="font-black text-slate-800">{section.heading}</h2>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{section.body}</p>
              </div>
            ))}

            {current.groups?.map((group: Row) => (
              <div key={group.role} className="rounded-xl bg-slate-50 p-4">
                <h2 className="font-black text-slate-800">{group.role}</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {group.benefits.map((benefit: string) => <li key={benefit}>{benefit}</li>)}
                </ul>
              </div>
            ))}

            {current.items?.map((item: Row) => (
              <div key={item.code} className="rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-black text-teal-700">{item.code}　{item.title}</div>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
              </div>
            ))}

            {current.three_80 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {current.three_80.map((row: Row) => (
                  <div key={row.label} className="rounded-xl bg-teal-50 p-3">
                    <div className="text-xs font-black text-teal-800">{row.label}</div>
                    <p className="mt-1 text-xs text-teal-900">{row.body}</p>
                  </div>
                ))}
              </div>
            )}

            {current.timeline && (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  {current.timeline.map((row: Row) => (
                    <div key={row.week} className="rounded-xl border border-slate-200 p-3">
                      <div className="text-sm font-black text-slate-700">第 {row.week} 週 · {row.title}</div>
                      <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                        {row.actions.map((action: string) => <li key={action}>{action}</li>)}
                      </ul>
                      <div className="mt-1 text-xs font-bold text-teal-700">目標：{row.target}</div>
                    </div>
                  ))}
                </div>
                {current.source_note && <p className="text-xs text-slate-500">{current.source_note}</p>}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
