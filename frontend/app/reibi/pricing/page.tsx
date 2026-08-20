"use client";

/**
 * 方案與定價（移植自 Artifact 主平台的 PricingScreen）。
 *
 * 這一頁沒有任何寫死的金額 —— 全部向後端要，而後端是由報價試算的同一組常數推導。
 * Artifact 的版本把「NT$60萬/年」「NT$169.94萬」這類數字直接打在頁面上，
 * 與報價計算是兩份各自維護的複本；改了設備單價，報價單會變、定價頁不會。
 *
 * 與 Artifact 一樣是登入後的站內頁面，不是對外公開的價目表。
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert, Tag } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type Row = Record<string, any>;

const wan = (value: any) =>
  value === null || value === undefined ? "客製議定" : `NT$ ${(Number(value) / 10000).toLocaleString("zh-TW", { maximumFractionDigits: 2 })} 萬`;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-black text-slate-800">{title}</h2>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b text-xs text-slate-500">{head.map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function ReibiPricingPage() {
  const { session, loading } = useAuth();
  const allowed = Boolean(session && can(session.systemRole, "manage_reibi"));
  const [data, setData] = useState<Row | null>(null);
  const [years, setYears] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (contractYears: number) => {
    setBusy(true); setError("");
    const response: any = await API.getReibiPricing(contractYears);
    if (response.status === "success") setData(response.data);
    else setError(response.message || "無法讀取方案與定價");
    setBusy(false);
  }, []);

  useEffect(() => { if (session && allowed) void load(years); }, [session, allowed, years, load]);

  if (loading || !session) return null;
  if (!allowed) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-4 text-xl font-black text-slate-900">沒有方案與定價檢視權限</h1>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">返回首頁</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/reibi" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-teal-700">
            <ArrowLeft className="h-4 w-4" /> 返回管理中心
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
            <Tag className="h-6 w-6 text-teal-700" /> 方案與定價
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">合約年數</label>
          <select value={years} onChange={event => setYears(Number(event.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold">
            {[1, 2, 3, 5].map(value => <option key={value} value={value}>{value} 年</option>)}
          </select>
          <button onClick={() => void load(years)} disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {!data && !error && <div className="py-16 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>}

      {data && (
        <>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{data.disclaimer}</p>

          <Section title={data.a_layer.title}>
            <Table head={["人數級距", "年費", `${data.contract_years} 年合計`]}>
              {data.a_layer.tiers.map((row: Row) => (
                <tr key={row.range} className="border-b">
                  <td className="p-2 font-bold text-slate-700">{row.range}</td>
                  <td className="p-2">{wan(row.annual_fee)}</td>
                  <td className="p-2 font-bold text-teal-700">{wan(row.contract_total)}</td>
                </tr>
              ))}
            </Table>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.a_layer.pay_modes.map((mode: Row) => (
                <span key={mode.key} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {mode.label}　×{mode.factor}　<span className="font-normal text-slate-500">{mode.note}</span>
                </span>
              ))}
            </div>
          </Section>

          <Section title={data.b_layer.title} note={`付款方式：${data.b_layer.payment_term}`}>
            <Table head={["設備", "單價"]}>
              {data.b_layer.equipment.map((row: Row) => (
                <tr key={row.key} className="border-b">
                  <td className="p-2 font-bold text-slate-700">{row.label}</td>
                  <td className="p-2">{wan(row.price)}</td>
                </tr>
              ))}
            </Table>
            <div className="mt-4 text-xs font-bold text-slate-500">依人數級距的建議配置</div>
            <div className="mt-2">
              <Table head={["級距", "雲朵床", "樂活椅", "LA200", "合計"]}>
                {data.b_layer.bundles.map((row: Row) => (
                  <tr key={row.tier} className="border-b">
                    <td className="p-2 font-bold text-slate-700">{row.tier} ≤{row.max_members} 人</td>
                    <td className="p-2">{row.bed} 台</td>
                    <td className="p-2">{row.chair} 台</td>
                    <td className="p-2">{row.la200} 組</td>
                    <td className="p-2 font-bold text-teal-700">{wan(row.total)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </Section>

          <Section title={data.c_layer.title} note={data.c_layer.high_risk_note}>
            <Table head={["方案", "年費"]}>
              {data.c_layer.tiers.map((row: Row) => (
                <tr key={row.tier} className="border-b">
                  <td className="p-2 font-bold text-slate-700">{row.tier}</td>
                  <td className="p-2">{wan(row.annual_fee)}</td>
                </tr>
              ))}
              <tr>
                <td className="p-2 font-bold text-slate-700">高風險高管加購</td>
                <td className="p-2">{wan(data.c_layer.high_risk_fee)} ／人</td>
              </tr>
            </Table>
          </Section>

          <Section title={data.d_layer.title} note={`${data.d_layer.note}　付款方式：${data.d_layer.payment_term}`}>
            <Table head={["項目", "估算區間"]}>
              {data.d_layer.items.map((row: Row) => (
                <tr key={row.key} className="border-b">
                  <td className="p-2 font-bold text-slate-700">{row.label}</td>
                  <td className="p-2">{wan(row.min)} ～ {wan(row.max)}</td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title={data.e_layer.title} note={data.e_layer.warranty_note}>
            <Table head={["加值服務", "年費"]}>
              {data.e_layer.value_added.map((row: Row) => (
                <tr key={row.key} className="border-b">
                  <td className="p-2 font-bold text-slate-700">{row.label}</td>
                  <td className="p-2">{wan(row.price)}</td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{data.e_layer.cpi_note}</p>
          </Section>
        </>
      )}
    </main>
  );
}
