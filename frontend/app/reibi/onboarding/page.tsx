"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Download, Plus, RefreshCw, Send, Trash2 } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import IndustryPicker from "@/components/IndustryPicker";

type Row = Record<string, any>;
const plans = [
  ["basic", "基本（1–100 人）"], ["growth", "成長（101–300 人）"],
  ["professional", "專業（301–500 人）"], ["flagship", "旗艦（501–1000 人）"], ["custom", "客製（1000 人以上）"],
];
const today = new Date().toISOString().slice(0, 10);
const future = new Date(Date.now() + 3 * 365 * 86_400_000).toISOString().slice(0, 10);
const empty = {
  org_name: "", org_alias: "", admin_email: "", contact_name: "", phone: "", ubn: "", address: "", industry: "",
  plan_code: "growth", member_limit: 300, contract_start: today, contract_end: future, contract_years: 3, pay_mode: "annual",
  consultant: "", partner_code: "", referral_percent: "", a_layer_fee: 1200000, b_layer_fee: 0, c_layer_fee: 0, d_layer_fee: 0,
  devices: { cloud_beds: 1, relax_chairs: 1, la200: 0 },
  d_layer_config: { poster: false, board: false, digital: false, qr: false, display: false, install: false },
  c_layer_note: "", c_layer_executions: 0, d_layer_note: "",
};

const numberValue = (value: any) => value === "" ? 0 : Number(value);

export default function ReibiOnboardingPage() {
  const { session } = useAuth();
  const allowed = Boolean(session && ["reibi_super", "reibi_finance"].includes(session.systemRole));
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Row>({ ...empty });
  const [sites, setSites] = useState<Row[]>([]);
  const [cases, setCases] = useState<Row[]>([]);
  const [created, setCreated] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const update = (key: string, value: any) => setForm(previous => ({ ...previous, [key]: value }));
  const total = useMemo(() => ["a_layer_fee", "b_layer_fee", "c_layer_fee", "d_layer_fee"].reduce((sum, key) => sum + numberValue(form[key]), 0), [form]);

  const load = async () => {
    if (!allowed) return;
    const response: any = await API.listReibiOnboardingCases();
    if (response.status === "success") setCases(response.data || []);
    else setError(response.message || "無法讀取開通案件");
  };
  useEffect(() => { void load(); }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    setError("");
    if (step === 1 && (!form.org_name.trim() || !form.org_alias.trim() || !form.admin_email.trim() || !form.contact_name.trim() || !form.member_limit || !form.contract_start || !form.contract_end)) {
      setError("請完成企業名稱、代碼別名、管理員 Email、聯絡人、授權人數及合約日期。"); return;
    }
    setStep(previous => Math.min(3, previous + 1));
  };

  const submit = async () => {
    setLoading(true); setError(""); setMessage("");
    const payload = {
      ...form,
      org_alias: form.org_alias.toUpperCase(),
      phone: form.phone || null, ubn: form.ubn || null, address: form.address || null, industry: form.industry || null,
      consultant: form.consultant || null, partner_code: form.partner_code || null,
      referral_percent: form.partner_code || form.referral_percent === "" ? null : Number(form.referral_percent),
      member_limit: Number(form.member_limit), contract_years: Number(form.contract_years),
      a_layer_fee: numberValue(form.a_layer_fee), b_layer_fee: numberValue(form.b_layer_fee), c_layer_fee: numberValue(form.c_layer_fee), d_layer_fee: numberValue(form.d_layer_fee),
      c_layer_executions: Number(form.c_layer_executions || 0), c_layer_note: form.c_layer_note || null, d_layer_note: form.d_layer_note || null,
      sites: sites.filter(site => site.label.trim()).map((site, index) => ({ ...site, address: site.address || null, note: site.note || null, sort_order: index })),
    };
    const response: any = await API.createReibiOnboardingCase(payload);
    if (response.status === "success") {
      setCreated(response.data); setMessage(`新案 ${response.data.case.case_no} 已完成原子開通。`); await load();
    } else setError(response.message || "新案開通失敗");
    setLoading(false);
  };

  const download = async (caseId: number) => {
    try { await API.downloadReibiCredentialLetter(caseId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "下載失敗"); }
  };

  if (!session) return <div className="p-8 text-center text-slate-500">請先登入。</div>;
  if (!allowed) return <div className="p-8 text-center text-red-700">此流程限 REIBI 超級管理者或財務管理員。</div>;

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><Link href="/reibi/l5" className="inline-flex items-center gap-1 text-sm font-bold text-teal-700"><ArrowLeft className="h-4 w-4" />返回 L5 總覽</Link><h1 className="mt-2 text-2xl font-black text-slate-900">L5-01B 新案開通</h1><p className="mt-1 text-sm text-slate-500">企業、場域與開通案件在同一筆資料庫交易中建立；憑證函不含密碼或共用 PIN。</p></div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><RefreshCw className="h-4 w-4" />重新整理</button>
    </header>

    {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

    {created ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-6 w-6" /><h2 className="text-lg font-black">開通完成</h2></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3"><Info label="案件編號" value={created.case.case_no} /><Info label="組織代碼" value={created.enterprise.org_code} /><Info label="憑證函編號" value={created.case.credential_no} /></div>
      <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => void download(created.case.id)} className="btn-primary"><Download className="h-4 w-4" />下載安全憑證函</button><button onClick={() => { setCreated(null); setForm({ ...empty }); setSites([]); setStep(1); }} className="btn-secondary"><Plus className="h-4 w-4" />開立下一案</button><Link href={`/reibi/workflow?org_code=${encodeURIComponent(created.enterprise.org_code)}`} className="btn-secondary">前往商務文件</Link></div>
    </section> : <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 grid grid-cols-3 gap-2">{["企業資料", "配置與場域", "費用確認"].map((label, index) => <div key={label} className={`rounded-xl px-3 py-2 text-center text-sm font-bold ${step === index + 1 ? "bg-teal-700 text-white" : step > index + 1 ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-400"}`}>{index + 1}. {label}</div>)}</div>
      {step === 1 && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="企業名稱 *"><input className="input" value={form.org_name} onChange={e => update("org_name", e.target.value)} /></Field>
        <Field label="代碼別名（2–4 碼）*"><input className="input uppercase" maxLength={4} value={form.org_alias} onChange={e => update("org_alias", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></Field>
        <Field label="管理員 Email *"><input type="email" className="input" value={form.admin_email} onChange={e => update("admin_email", e.target.value)} /></Field>
        <Field label="聯絡人 *"><input className="input" value={form.contact_name} onChange={e => update("contact_name", e.target.value)} /></Field>
        <Field label="電話"><input className="input" value={form.phone} onChange={e => update("phone", e.target.value)} /></Field>
        <Field label="統編"><input className="input" maxLength={8} value={form.ubn} onChange={e => update("ubn", e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="地址"><input className="input" value={form.address} onChange={e => update("address", e.target.value)} /></Field>
        <Field label="產業"><IndustryPicker value={form.industry} onChange={next => update("industry", next)} /></Field>
        <Field label="方案"><select className="input" value={form.plan_code} onChange={e => update("plan_code", e.target.value)}>{plans.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="授權人數 *"><input type="number" min="1" className="input" value={form.member_limit} onChange={e => update("member_limit", e.target.value)} /></Field>
        <Field label="合約開始 *"><input type="date" className="input" value={form.contract_start} onChange={e => update("contract_start", e.target.value)} /></Field>
        <Field label="合約結束 *"><input type="date" className="input" value={form.contract_end} onChange={e => update("contract_end", e.target.value)} /></Field>
        <Field label="負責顧問"><input className="input" value={form.consultant} onChange={e => update("consultant", e.target.value)} /></Field>
        <Field label="接案經銷商代碼"><input className="input" value={form.partner_code} onChange={e => update("partner_code", e.target.value.toUpperCase())} /></Field>
        {!form.partner_code && <Field label="異業轉介分潤 %"><input type="number" min="0" max="100" className="input" value={form.referral_percent} onChange={e => update("referral_percent", e.target.value)} /></Field>}
      </div>}
      {step === 2 && <div className="space-y-6">
        <div><h2 className="font-black text-slate-800">B 層設備</h2><div className="mt-3 grid gap-3 md:grid-cols-3">{[["cloud_beds","舒曼雲床"],["relax_chairs","舒曼律動椅"],["la200","LA200"]].map(([key,label]) => <Field key={key} label={label}><input type="number" min="0" className="input" value={form.devices[key]} onChange={e => update("devices", { ...form.devices, [key]: Number(e.target.value) })} /></Field>)}</div></div>
        <div><h2 className="font-black text-slate-800">D 層環境配置</h2><div className="mt-3 flex flex-wrap gap-3">{[["poster","海報"],["board","公告欄"],["digital","數位內容"],["qr","QR Code"],["display","展示區"],["install","施工"]].map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={form.d_layer_config[key]} onChange={e => update("d_layer_config", { ...form.d_layer_config, [key]: e.target.checked })} />{label}</label>)}</div></div>
        <div><div className="flex items-center justify-between"><h2 className="font-black text-slate-800">企業場域</h2><button onClick={() => setSites(previous => [...previous, { label: "", address: "", note: "" }])} className="btn-secondary"><Plus className="h-4 w-4" />新增場域</button></div><div className="mt-3 space-y-3">{sites.map((site, index) => <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_2fr_2fr_auto]"><input className="input" placeholder="場域名稱" value={site.label} onChange={e => setSites(rows => rows.map((row, i) => i === index ? { ...row, label: e.target.value } : row))} /><input className="input" placeholder="地址" value={site.address} onChange={e => setSites(rows => rows.map((row, i) => i === index ? { ...row, address: e.target.value } : row))} /><input className="input" placeholder="備註" value={site.note} onChange={e => setSites(rows => rows.map((row, i) => i === index ? { ...row, note: e.target.value } : row))} /><button aria-label="刪除場域" onClick={() => setSites(rows => rows.filter((_, i) => i !== index))} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>
      </div>}
      {step === 3 && <div className="space-y-5"><div className="grid gap-3 md:grid-cols-4">{[["a_layer_fee","A 層授權"],["b_layer_fee","B 層設備"],["c_layer_fee","C 層服務"],["d_layer_fee","D 層環境"]].map(([key,label]) => <Field key={key} label={label}><input type="number" min="0" className="input" value={form[key]} onChange={e => update(key, e.target.value)} /></Field>)}</div><div className="rounded-xl bg-teal-50 p-4 text-right"><span className="text-sm text-teal-800">四層總額</span><div className="text-2xl font-black text-teal-900">NT$ {total.toLocaleString("zh-TW")}</div></div><p className="text-sm text-slate-600">確認後會建立正式企業、場域、開通案件與不可碰撞的流水編號。帳號密碼仍由 Supabase 邀請流程設定。</p></div>}
      <div className="mt-6 flex justify-between"><button disabled={step === 1} onClick={() => setStep(previous => previous - 1)} className="btn-secondary disabled:opacity-40">上一步</button>{step < 3 ? <button onClick={next} className="btn-primary">下一步</button> : <button disabled={loading} onClick={() => void submit()} className="btn-primary"><Building2 className="h-4 w-4" />{loading ? "開通中…" : "確認開通"}</button>}</div>
    </section>}

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-black text-slate-900">最近開通案件</h2><div className="mt-4 space-y-3">{cases.length ? cases.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"><div><div className="font-black">{row.reibi_enterprises?.org_name} <span className="text-sm text-slate-500">{row.reibi_enterprises?.org_code}</span></div><div className="text-xs text-slate-500">{row.case_no} · {row.status} · {String(row.created_at).slice(0, 10)}</div></div><div className="flex gap-2"><button onClick={() => void download(row.id)} className="btn-secondary"><Download className="h-4 w-4" />憑證函</button>{row.status === "provisioned" && <button onClick={async () => { await API.handoffReibiOnboardingCase(row.id); await load(); }} className="btn-secondary"><Send className="h-4 w-4" />標記已交付</button>}</div></div>) : <p className="text-sm text-slate-500">尚無開通案件。</p>}</div></section>
    <style jsx global>{`.input{width:100%;border:1px solid #e2e8f0;border-radius:.75rem;padding:.625rem .75rem;background:white;font-size:.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px #14b8a6}.btn-primary,.btn-secondary{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border-radius:.75rem;padding:.625rem 1rem;font-size:.875rem;font-weight:700}.btn-primary{background:#0f766e;color:white}.btn-secondary{border:1px solid #cbd5e1;background:white;color:#334155}`}</style>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-1 block">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: any }) { return <div className="rounded-xl bg-white p-3"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 font-black text-slate-900">{value}</div></div>; }
