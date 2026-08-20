"use client";

/**
 * REIBI 體驗場域（移植自 Artifact 主平台的 VenueScreen）。
 *
 * 場域資料目前是**佔位內容**，尚未由業務端提供。佔位場域由後端標記
 * `is_placeholder` 並回報 `bookable: false`，這一頁只負責把那個事實顯示出來 ——
 * 判斷不在前端重做一次，否則兩邊會各自解讀。
 *
 * 「首次免費體驗每人限一次」在 Artifact 只是畫面上的一句話，從未被檢查；
 * 這裡的額度狀態來自資料庫，用掉就是用掉。
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, Loader2, MapPin, Navigation, Sparkles, TriangleAlert } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";

type Row = Record<string, any>;

export default function VenuesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Row | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response: any = await API.getReibiVenues();
    if (response.status === "success") setData(response.data);
    else setError(response.message || "無法讀取體驗場域");
  }, []);

  useEffect(() => { if (session) void load(); }, [session, load]);

  if (loading || !session) return null;

  const venues: Row[] = data?.venues || [];
  const freeVisit: Row = data?.free_visit || {};
  const current = venues.find(venue => venue.id === selected) || null;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <div>
        <button onClick={() => router.push("/dashboard")} className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeft className="h-4 w-4" /> 返回主選單
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <MapPin className="h-6 w-6 text-teal-600" /> REIBI 體驗場域
        </h1>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!data && !error && <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>}

      {data && (
        <>
          {data.placeholder_notice && (
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="text-sm font-bold text-amber-900">場域資料尚未確認</div>
                <p className="mt-1 text-xs text-amber-800">{data.placeholder_notice}</p>
              </div>
            </div>
          )}

          {freeVisit.available && (
            <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>您還有一次免費體驗額度。{freeVisit.note}</span>
            </div>
          )}
          {freeVisit.used && (
            <div className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
              免費體驗額度已使用。{freeVisit.note}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {venues.map(venue => {
              const isSelected = venue.id === selected;
              return (
                <button key={venue.id} onClick={() => setSelected(isSelected ? null : venue.id)}
                  className={`rounded-2xl border-2 p-4 text-left transition ${isSelected ? "border-teal-600 bg-teal-50/50" : "border-slate-200 bg-white"} ${venue.is_placeholder ? "opacity-70" : ""}`}>
                  <div className="font-black text-slate-800">{venue.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{venue.city} · {venue.area}</div>
                  {venue.is_placeholder && (
                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">佔位資料</span>
                  )}
                  {venue.first_visit_free && (
                    <span className="mt-2 ml-1 inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">首次免費</span>
                  )}
                </button>
              );
            })}
          </div>

          {venues.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              目前沒有開放中的體驗場域。
            </div>
          )}

          {current && (
            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-black text-slate-800">{current.name}</h2>

              <div>
                <div className="text-[11px] font-bold text-slate-400">地址</div>
                <div className="text-sm text-slate-700">{current.address || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400">開放時間</div>
                <div className="flex items-center gap-1 text-sm text-slate-700"><Clock className="h-3.5 w-3.5" />{current.opening_hours || "—"}</div>
              </div>
              {current.transport.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400">交通方式</div>
                  <ul className="mt-1 space-y-1">
                    {current.transport.map((line: string) => (
                      <li key={line} className="flex items-start gap-1 text-sm text-slate-700">
                        <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {current.services.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400">體驗項目</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {current.services.map((item: string) => (
                      <span key={item} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {current.note && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{current.note}</p>}

              {current.bookable ? (
                <button onClick={() => router.push(`/appointment?venue=${current.id}`)}
                  className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white">
                  預約此場域
                </button>
              ) : (
                <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-500">
                  此場域尚未開放預約
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
