"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Calculator, CheckCircle2, FileCheck2, FileText, HardHat, Plus, Printer, RefreshCw, Save, Trash2 } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type Tab = "quotes" | "contracts" | "work-orders";
type Row = Record<string, any>;
type WorkItem = { name: string; spec: string; quantity: number; note: string; result?: "pass" | "fail"; check_note?: string };

const QUOTE_NEXT: Record<string, string> = { 草稿: "已發送", 已發送: "已確認" };
const CONTRACT_NEXT: Record<string, string> = { "草稿(合約)": "已發送", 已發送: "待用印", 待用印: "用印完成", 用印完成: "執行中", 執行中: "存檔" };
const WORK_NEXT: Record<string, string> = { 草稿: "已發出", 已發出: "出貨中", 出貨中: "安裝中", 安裝中: "待驗收", 待驗收: "驗收中", 驗收完成: "已存檔" };
const D_ITEMS = [
  ["poster", "基礎海報套組"], ["board", "健促公告欄"], ["display", "設備展示區"],
  ["qr", "QR Code 貼紙組"], ["digital", "數位看板內容"], ["install", "現場施工"],
] as const;

const EMPTY_QUOTE = {
  doc_type: "新簽報價", client_name: "", client_alias: "", contact_name: "", phone: "", email: "", address: "", industry: "",
  distributor_id: "", partner_id: "", staff_id: "", original_contract_no: "",
  member_count: 100, pay_mode: "annual", contract_years: 3, contract_start: "", contract_end: "", a_custom_fee: "",
  discount_percent: 0, b_bed: 0, b_chair: 0, b_la200: 0, c_tier: "基本型", c_high_risk: 0,
  c_custom_fee: "", e_layer_fee: 0, d_items: {} as Record<string, boolean>, d_sites: [] as number[],
  // E 層結構（續約報價適用）與升級差額輸入
  e_warranty_bed: false, e_warranty_chair: false, e_warranty_la200: false, e_warranty_rate: 7,
  e_value_added: {} as Record<string, boolean>, e_value_custom: 0,
  e_cpi_apply: false, e_cpi_rate: 0,
  original_a_fee: "", upgrade_date: "", original_contract_end: "",
};

const E_VALUE_ITEMS: Array<[string, string, number]> = [
  ["annual_report", "年度健康加值報告", 30000],
  ["industry_white", "產業健康白皮書（企業版）", 50000],
  ["esg_report", "ESG 健促揭露報告", 40000],
  ["hr_consult", "年度 HR 健促顧問諮詢（4 次）", 80000],
];

const EMPTY_WORK = {
  id: null as number | null, work_order_no: "", contract_id: null as number | null, contract_no: "", client_name: "", status: "草稿",
  contact_name: "", phone: "", email: "", address: "", scheduled_date: "", service_period: "", staff_names: "",
  scope_confirm_reibi: "", scope_confirm_reibi_date: "", scope_confirm_client: "", scope_confirm_client_date: "",
};

const money = (value: any) => `NT$ ${Number(value || 0).toLocaleString("zh-TW")}`;
const clean = (value: any) => value === "" ? null : value;

export default function ReibiWorkflowPage() {
  const { session } = useAuth();
  const allowed = Boolean(session && can(session.systemRole, "manage_reibi"));
  const [tab, setTab] = useState<Tab>("quotes");
  const [rows, setRows] = useState<Record<Tab, Row[]>>({ quotes: [], contracts: [], "work-orders": [] });
  const [catalogs, setCatalogs] = useState<{ distributors: Row[]; partners: Row[]; staff: Row[]; sites: Row[] }>({ distributors: [], partners: [], staff: [], sites: [] });
  const [selected, setSelected] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [quote, setQuote] = useState({ ...EMPTY_QUOTE });
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  const [calculation, setCalculation] = useState<Row | null>(null);
  const [work, setWork] = useState({ ...EMPTY_WORK });
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [acceptanceDate, setAcceptanceDate] = useState("");
  const [clientSignName, setClientSignName] = useState("");
  const [punchList, setPunchList] = useState("");
  const [execution, setExecution] = useState({ signed_by: "", signed_at: "", sealed_at: "", executed_at: "", note: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [enterprises, setEnterprises] = useState<Row[]>([]);
  const [selectedOrgCode, setSelectedOrgCode] = useState("");

  const loadRows = async (nextTab: Tab = tab) => {
    if (!allowed) return;
    setLoading(true); setError("");
    const response: any = nextTab === "quotes"
      ? await API.listReibiQuotes(1, 100, statusFilter || undefined, search || undefined)
      : nextTab === "contracts"
        ? await API.listReibiContracts(1, 100, statusFilter || undefined, search || undefined)
        : await API.listReibiWorkOrders(1, 100, statusFilter || undefined, search || undefined);
    if (response.status === "success") setRows(previous => ({ ...previous, [nextTab]: response.data || [] }));
    else setError(response.message || "無法讀取商務文件");
    setLoading(false);
  };

  useEffect(() => {
    if (!allowed) return;
    void API.listReibiOperationEnterprises().then((response: any) => {
      if (response.status !== "success") { setError(response.message || "無法讀取企業範圍"); return; }
      const list = response.data || [];
      setEnterprises(list);
      const sessionCode = session?.orgCode || "";
      const requested = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("org_code") || "";
      setSelectedOrgCode(previous => previous || (list.some((row: Row) => row.org_code === requested) ? requested : list.some((row: Row) => row.org_code === sessionCode) ? sessionCode : list[0]?.org_code || ""));
    });
    return () => API.setWorkflowOrgCode(null);
  }, [allowed, session?.orgCode]);

  useEffect(() => {
    if (!allowed || !selectedOrgCode) return;
    API.setWorkflowOrgCode(selectedOrgCode);
    setSelected(null);
    void loadRows(tab);
    void API.getReibiBusinessCatalogs().then((response: any) => {
      if (response.status === "success") setCatalogs(response.data);
      else setError(response.message || "無法讀取企業商務目錄");
    });
  }, [allowed, tab, selectedOrgCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculate = async () => {
    setLoading(true); setError("");
    const response: any = await API.calculateReibiQuote({
      member_count: quote.member_count, pay_mode: quote.pay_mode, contract_years: quote.contract_years,
      discount_percent: quote.discount_percent, a_custom_fee: quote.a_custom_fee === "" ? null : Number(quote.a_custom_fee),
      b_bed: quote.b_bed, b_chair: quote.b_chair, b_la200: quote.b_la200,
      c_tier: quote.c_tier || null, c_high_risk: quote.c_high_risk,
      c_custom_fee: quote.c_custom_fee === "" ? null : Number(quote.c_custom_fee),
      d_items: D_ITEMS.filter(([key]) => quote.d_items[key]).map(([key]) => key), e_layer_fee: quote.e_layer_fee,
      doc_type: quote.doc_type,
      e_warranty_bed: quote.e_warranty_bed, e_warranty_chair: quote.e_warranty_chair,
      e_warranty_la200: quote.e_warranty_la200, e_warranty_rate: quote.e_warranty_rate,
      e_value_added: E_VALUE_ITEMS.filter(([key]) => quote.e_value_added[key]).map(([key]) => key),
      e_value_custom: quote.e_value_custom,
      e_cpi_apply: quote.e_cpi_apply, e_cpi_rate: quote.e_cpi_rate,
      original_a_fee: quote.original_a_fee === "" ? null : Number(quote.original_a_fee),
      upgrade_date: quote.upgrade_date || null,
      original_contract_end: quote.original_contract_end || null,
    });
    if (response.status === "success") setCalculation(response.data);
    else setError(response.message || "報價試算失敗");
    setLoading(false);
    return response.status === "success" ? response.data : null;
  };

  const quotePayload = (fees: Row) => {
    const isDistributor = quote.doc_type === "經銷商報價";
    return ({
    doc_type: quote.doc_type, status: "草稿", client_name: quote.client_name, client_alias: clean(quote.client_alias),
    distributor_id: clean(quote.distributor_id) ? Number(quote.distributor_id) : null,
    partner_id: clean(quote.partner_id) ? Number(quote.partner_id) : null,
    staff_id: clean(quote.staff_id) ? Number(quote.staff_id) : null,
    original_contract_no: clean(quote.original_contract_no),
    contact_name: clean(quote.contact_name), phone: clean(quote.phone), email: clean(quote.email), address: clean(quote.address), industry: clean(quote.industry),
    member_count: quote.member_count, pay_mode: quote.pay_mode, contract_years: quote.contract_years,
    contract_start: clean(quote.contract_start), contract_end: clean(quote.contract_end),
    a_layer_fee: isDistributor ? 0 : fees.a_layer_fee, b_layer_fee: isDistributor ? 0 : fees.b_layer_fee, c_layer_fee: isDistributor ? 0 : fees.c_layer_fee,
    d_layer_fee_min: isDistributor ? 0 : fees.d_layer_fee_min, d_layer_fee_max: isDistributor ? 0 : fees.d_layer_fee_max, e_layer_fee: isDistributor ? 0 : fees.e_layer_fee,
    total_year_fee: isDistributor ? 0 : fees.total_year_fee, total_contract_fee: isDistributor ? 0 : fees.total_contract_fee,
    config: {
      bBed: quote.b_bed, bChair: quote.b_chair, bLA200: quote.b_la200, cTier: quote.c_tier,
      cHighRisk: quote.c_high_risk, dItems: quote.d_items,
      dSites: catalogs.sites.filter(site => quote.d_sites.includes(site.id)), eLayerFee: quote.e_layer_fee,
    },
  }); };

  const saveQuote = async () => {
    if (!quote.client_name.trim()) { setError("請填寫客戶名稱"); return; }
    const fees = calculation || await calculate();
    if (!fees) return;
    setLoading(true); setError("");
    const response: any = editingQuoteId
      ? await API.updateReibiQuote(editingQuoteId, quotePayload(fees))
      : await API.createReibiQuote(quotePayload(fees));
    if (response.status === "success") {
      setMessage(editingQuoteId ? "報價與版本快照已更新。" : `已建立報價 ${response.data.doc_no}`);
      setQuote({ ...EMPTY_QUOTE }); setCalculation(null); setEditingQuoteId(null); await loadRows("quotes");
    } else setError(response.message || "儲存報價失敗");
    setLoading(false);
  };

  const editQuote = (row: Row) => {
    const config = row.config || {};
    setQuote({
      ...EMPTY_QUOTE, ...row, discount_percent: 0, b_bed: config.bBed || 0, b_chair: config.bChair || 0,
      b_la200: config.bLA200 || 0, c_tier: config.cTier || "基本型", c_high_risk: config.cHighRisk || 0,
      a_custom_fee: "", c_custom_fee: "", e_layer_fee: Number(row.e_layer_fee || 0), d_items: config.dItems || {},
      distributor_id: row.distributor_id ? String(row.distributor_id) : "", partner_id: row.partner_id ? String(row.partner_id) : "",
      staff_id: row.staff_id ? String(row.staff_id) : "", original_contract_no: row.original_contract_no || "",
      d_sites: Array.isArray(config.dSites) ? config.dSites.map((site: Row) => Number(site.id)).filter(Boolean) : [],
      contract_start: row.contract_start || "", contract_end: row.contract_end || "",
    });
    setCalculation(row); setEditingQuoteId(row.id); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const moveStatus = async (kind: Tab, row: Row, next: string) => {
    setLoading(true); setError("");
    const response: any = await API.updateReibiDocumentStatus(kind, row.id, next);
    if (response.status === "success") { setMessage(`${row.doc_no || row.work_order_no} 已更新為「${next}」。`); setSelected(response.data); await loadRows(kind); }
    else setError(response.message || "狀態更新失敗");
    setLoading(false);
  };

  const convertQuote = async (row: Row) => {
    const contractType = row.original_contract_no ? "補充合約" : row.doc_type === "經銷商報價" ? "經銷商合約" : row.doc_type === "續約報價" ? "續約合約" : "企業合約";
    setLoading(true); setError("");
    const response: any = await API.convertReibiQuote(row.id, contractType, { execution: {}, signatures: {}, print_version: 1 });
    if (response.status === "success") { setMessage(`已原子轉換為合約 ${response.data.doc_no}`); await loadRows("quotes"); setTab("contracts"); }
    else setError(response.message || "報價轉合約失敗");
    setLoading(false);
  };

  const createAdjustment = async (row: Row, adjustmentType: "upgrade" | "renewal") => {
    setLoading(true); setError("");
    const response: any = await API.createReibiAdjustmentQuote(row.id, adjustmentType);
    if (response.status === "success") { setMessage(`已建立${adjustmentType === "upgrade" ? "升級" : "續約"}報價 ${response.data.doc_no}`); setTab("quotes"); }
    else setError(response.message || "建立調整報價失敗");
    setLoading(false);
  };

  const createWorkOrder = async (contract: Row) => {
    setLoading(true); setError("");
    const response: any = await API.createReibiWorkOrderFromContract(contract.id, { items: {} });
    if (response.status === "success") { setMessage(`已建立工單 ${response.data.work_order_no}`); setTab("work-orders"); }
    else setError(response.message || "建立工單失敗");
    setLoading(false);
  };

  const selectRow = (row: Row) => {
    setSelected(row);
    if (tab === "work-orders") editWork(row);
    if (tab === "contracts") {
      const current = row.terms?.execution || {};
      setExecution({ signed_by: current.signed_by || "", signed_at: current.signed_at || "", sealed_at: current.sealed_at || "", executed_at: current.executed_at || "", note: current.note || "" });
    }
  };

  const saveContractExecution = async () => {
    if (!selected) return;
    setLoading(true); setError("");
    const response: any = await API.updateReibiContractExecution(selected.id, Object.fromEntries(Object.entries(execution).map(([key,value]) => [key, clean(value)])));
    if (response.status === "success") { setMessage("合約簽署、用印與執行資料已建立不可變更快照。"); setSelected(response.data); await loadRows("contracts"); }
    else setError(response.message || "更新合約執行資料失敗");
    setLoading(false);
  };

  const editWork = (row: Row) => {
    setWork({ ...EMPTY_WORK, ...row, scheduled_date: row.scheduled_date || "", scope_confirm_reibi_date: row.scope_confirm_reibi_date || "", scope_confirm_client_date: row.scope_confirm_client_date || "" });
    setWorkItems(Array.isArray(row.items?.customItems) ? row.items.customItems : []);
    setSelected(row); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveWork = async () => {
    if (!work.id) return;
    setLoading(true); setError("");
    const response: any = await API.updateReibiWorkOrder(work.id, {
      work_order_no: work.work_order_no, contract_id: work.contract_id, contract_no: clean(work.contract_no), client_name: work.client_name,
      status: work.status, contact_name: clean(work.contact_name), phone: clean(work.phone), email: clean(work.email), address: clean(work.address),
      scheduled_date: clean(work.scheduled_date), service_period: clean(work.service_period), staff_names: clean(work.staff_names),
      scope_confirm_reibi: clean(work.scope_confirm_reibi), scope_confirm_reibi_date: clean(work.scope_confirm_reibi_date),
      scope_confirm_client: clean(work.scope_confirm_client), scope_confirm_client_date: clean(work.scope_confirm_client_date),
      items: { ...(selected?.items || {}), customItems: workItems }, acceptance: selected?.acceptance || {},
    });
    if (response.status === "success") { setMessage("工單內容已更新。"); setSelected(response.data); await loadRows("work-orders"); }
    else setError(response.message || "工單更新失敗");
    setLoading(false);
  };

  const submitAcceptance = async (result: "驗收完成" | "驗收異常") => {
    if (!work.id || !acceptanceDate || !clientSignName.trim()) { setError("請填寫驗收日期與客戶簽署姓名"); return; }
    setLoading(true); setError("");
    const response: any = await API.acceptReibiWorkOrder(work.id, {
      acceptance_result: result, acceptance_date: acceptanceDate, client_sign_name: clientSignName,
      punch_list: clean(punchList), acceptance: { item_results: workItems.map(item => ({ name: item.name, result: item.result || "pass", note: item.check_note || "" })) },
    });
    if (response.status === "success") { setMessage(`驗收結果已登錄為「${result}」。`); editWork(response.data); await loadRows("work-orders"); }
    else setError(response.message || "驗收登錄失敗");
    setLoading(false);
  };

  const currentRows = rows[tab];
  const expiryWarning = useMemo(() => {
    if (!selected?.contract_end) return null;
    const days = Math.ceil((new Date(selected.contract_end).getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days <= 90 ? `合約將於 ${days} 天後到期` : days < 0 ? `合約已逾期 ${Math.abs(days)} 天` : null;
  }, [selected]);

  if (!session) return <div className="p-8 text-center text-slate-500">請先登入。</div>;
  if (!allowed) return <div className="p-8 text-center text-red-700">目前帳號沒有 REIBI 商務文件管理權限。</div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div><Link href="/reibi" className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-teal-700"><ArrowLeft className="h-4 w-4" /> 返回管理中心</Link><h1 className="text-2xl font-black text-slate-800">REIBI 商務文件工作台</h1><p className="mt-1 text-sm text-slate-500">報價、合約、施工與驗收集中管理</p></div>
        <button onClick={() => loadRows()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 重新整理</button>
      </header>

      {(message || error) && <div className={`print:hidden rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}

      <section className="print:hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-2 text-sm font-bold text-slate-700 md:flex-row md:items-center">
          <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-teal-700" />目前操作企業</span>
          {enterprises.length ? <select value={selectedOrgCode} onChange={event => { setError(""); setSelectedOrgCode(event.target.value); }} className="input md:max-w-md">
            {enterprises.map(row => <option key={row.id} value={row.org_code}>{row.org_name}（{row.org_code}）</option>)}
          </select> : <span className="font-normal text-amber-700">尚無企業資料。請先到 <Link className="font-bold underline" href="/reibi/onboarding">新案開通</Link> 建立第一家企業。</span>}
        </label>
      </section>

      <nav className="flex flex-wrap gap-2 print:hidden">{([['quotes','報價單',FileText],['contracts','合約',FileCheck2],['work-orders','工單',HardHat]] as const).map(([value,label,Icon]) => <button key={value} disabled={!selectedOrgCode} onClick={() => { setTab(value); setSelected(null); setStatusFilter(""); }} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${tab === value ? "bg-teal-700 text-white" : "border border-slate-200 bg-white text-slate-600"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>

      {tab === "quotes" && <section className="rounded-2xl border border-slate-200 bg-white p-6 print:hidden">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-800">{editingQuoteId ? "編輯報價" : "快速試算與正式報價"}</h2><p className="mt-1 text-xs text-slate-500">計價規則沿用 Artifact；編號由資料庫安全產生。</p></div>{editingQuoteId && <button onClick={() => { setEditingQuoteId(null); setQuote({ ...EMPTY_QUOTE }); setCalculation(null); }} className="text-sm font-bold text-slate-500">取消編輯</button>}</div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="報價類型"><select value={quote.doc_type} onChange={e => setQuote(p => ({ ...p, doc_type: e.target.value }))} className="input"><option>新簽報價</option><option>經銷商報價</option><option>升級報價</option><option>續約報價</option></select></Field>
          <Field label="客戶名稱 *"><input value={quote.client_name} onChange={e => setQuote(p => ({ ...p, client_name: e.target.value }))} className="input" /></Field>
          <Field label="聯絡人"><input value={quote.contact_name} onChange={e => setQuote(p => ({ ...p, contact_name: e.target.value }))} className="input" /></Field>
          <Field label="Email"><input type="email" value={quote.email} onChange={e => setQuote(p => ({ ...p, email: e.target.value }))} className="input" /></Field>
          <Field label="經銷商"><select value={quote.distributor_id} onChange={e => setQuote(p => ({ ...p, distributor_id: e.target.value }))} className="input"><option value="">不指定</option>{catalogs.distributors.map(item => <option key={item.id} value={item.id}>{item.name}{item.alias ? `（${item.alias}）` : ""}</option>)}</select></Field>
          <Field label="合作夥伴"><select value={quote.partner_id} onChange={e => setQuote(p => ({ ...p, partner_id: e.target.value }))} className="input"><option value="">不指定</option>{catalogs.partners.map(item => <option key={item.id} value={item.id}>{item.name}（預設 {item.default_percent}%）</option>)}</select></Field>
          <Field label="負責人員"><select value={quote.staff_id} onChange={e => setQuote(p => ({ ...p, staff_id: e.target.value }))} className="input"><option value="">不指定</option>{catalogs.staff.map(item => <option key={item.id} value={item.id}>{item.name}{item.title ? ` · ${item.title}` : ""}</option>)}</select></Field>
          {(quote.doc_type === "升級報價" || quote.doc_type === "續約報價") && <Field label="原合約編號 *"><input value={quote.original_contract_no} onChange={e => setQuote(p => ({ ...p, original_contract_no: e.target.value }))} className="input" /></Field>}
          <NumberField label="企業人數" value={quote.member_count} onChange={value => setQuote(p => ({ ...p, member_count: value }))} />
          <Field label="A 層自訂年費（元）"><input type="number" min={0} value={quote.a_custom_fee} placeholder="1000 人以上或議價時填寫" onChange={e => setQuote(p => ({ ...p, a_custom_fee: e.target.value }))} className="input" /></Field>
          <Field label="付款方式"><select value={quote.pay_mode} onChange={e => setQuote(p => ({ ...p, pay_mode: e.target.value }))} className="input"><option value="annual">年繳（95 折）</option><option value="semi">半年繳</option><option value="quarterly">季繳（含 3%）</option></select></Field>
          <NumberField label="合約年數" value={quote.contract_years} onChange={value => setQuote(p => ({ ...p, contract_years: value }))} />
          <NumberField label="額外折扣 %" value={quote.discount_percent} onChange={value => setQuote(p => ({ ...p, discount_percent: value }))} />
          <NumberField label="雲朵床數量" value={quote.b_bed} onChange={value => setQuote(p => ({ ...p, b_bed: value }))} />
          <NumberField label="樂活椅數量" value={quote.b_chair} onChange={value => setQuote(p => ({ ...p, b_chair: value }))} />
          <NumberField label="LA200 數量" value={quote.b_la200} onChange={value => setQuote(p => ({ ...p, b_la200: value }))} />
          <Field label="C 層方案"><select value={quote.c_tier} onChange={e => setQuote(p => ({ ...p, c_tier: e.target.value }))} className="input"><option>基本型</option><option>成長型</option><option>專業型</option><option>旗艦型</option></select></Field>
          <NumberField label="高風險高管人數" value={quote.c_high_risk} onChange={value => setQuote(p => ({ ...p, c_high_risk: value }))} />
          <NumberField label="E 層年度費用" value={quote.e_layer_fee} onChange={value => setQuote(p => ({ ...p, e_layer_fee: value }))} />
          <Field label="合約開始"><input type="date" value={quote.contract_start} onChange={e => setQuote(p => ({ ...p, contract_start: e.target.value }))} className="input" /></Field>
          <Field label="合約結束"><input type="date" value={quote.contract_end} onChange={e => setQuote(p => ({ ...p, contract_end: e.target.value }))} className="input" /></Field>
        </div>
        <div className="mt-4"><div className="mb-2 text-xs font-bold text-slate-600">D 層環境佈置</div><div className="flex flex-wrap gap-2">{D_ITEMS.map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={Boolean(quote.d_items[key])} onChange={e => setQuote(p => ({ ...p, d_items: { ...p.d_items, [key]: e.target.checked } }))} />{label}</label>)}</div>{catalogs.sites.length > 0 && <><div className="mb-2 mt-4 text-xs font-bold text-slate-600">施工場域</div><div className="flex flex-wrap gap-2">{catalogs.sites.map(site => <label key={site.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={quote.d_sites.includes(site.id)} onChange={e => setQuote(p => ({...p,d_sites:e.target.checked ? [...p.d_sites,site.id] : p.d_sites.filter(id => id !== site.id)}))} />{site.label}</label>)}</div></>}</div>
        {quote.doc_type === "續約報價" && <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <div className="text-xs font-black text-violet-900">E 層：設備延保與加值服務（續約適用）</div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {([["e_warranty_bed", "雲朵床延保"], ["e_warranty_chair", "樂活椅延保"], ["e_warranty_la200", "LA200 延保"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={Boolean((quote as any)[key])} onChange={e => setQuote(p => ({ ...p, [key]: e.target.checked }))} />{label}
              </label>
            ))}
            <Field label="延保費率 %（5–10）"><input type="number" min={5} max={10} step={0.5} className="input" value={quote.e_warranty_rate} onChange={e => setQuote(p => ({ ...p, e_warranty_rate: Number(e.target.value) }))} /></Field>
          </div>

          <div className="mt-3 text-xs font-black text-violet-900">加值服務</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {E_VALUE_ITEMS.map(([key, label, price]) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={Boolean(quote.e_value_added[key])} onChange={e => setQuote(p => ({ ...p, e_value_added: { ...p.e_value_added, [key]: e.target.checked } }))} />
                {label}（{money(price)}）
              </label>
            ))}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="其他加值金額"><input type="number" min={0} className="input" value={quote.e_value_custom} onChange={e => setQuote(p => ({ ...p, e_value_custom: Number(e.target.value) }))} /></Field>
            <label className="flex items-end gap-2 pb-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={quote.e_cpi_apply} onChange={e => setQuote(p => ({ ...p, e_cpi_apply: e.target.checked }))} />套用 CPI 調幅
            </label>
            <Field label="CPI 調幅（上限 5%，超過自動截去）"><input type="number" min={0} max={1} step={0.01} className="input" value={quote.e_cpi_rate} onChange={e => setQuote(p => ({ ...p, e_cpi_rate: Number(e.target.value) }))} /></Field>
          </div>
        </div>}

        {quote.doc_type === "升級報價" && <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-xs font-black text-indigo-900">升級差額（依原合約剩餘月份補收）</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="原 A 層年費"><input type="number" min={0} className="input" value={quote.original_a_fee} onChange={e => setQuote(p => ({ ...p, original_a_fee: e.target.value }))} /></Field>
            <Field label="升級日"><input type="date" className="input" value={quote.upgrade_date} onChange={e => setQuote(p => ({ ...p, upgrade_date: e.target.value }))} /></Field>
            <Field label="原合約到期日"><input type="date" className="input" value={quote.original_contract_end} onChange={e => setQuote(p => ({ ...p, original_contract_end: e.target.value }))} /></Field>
          </div>
        </div>}

        <div className="mt-5 flex flex-wrap gap-2"><button onClick={calculate} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 px-4 py-2.5 text-sm font-bold text-teal-700"><Calculator className="h-4 w-4" />重新試算</button><button onClick={saveQuote} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{editingQuoteId ? "儲存版本" : "建立草稿"}</button></div>
        {calculation?.cpi_capped && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">CPI 調幅超過 5% 上限，已自動截為 5%。</div>}
        {calculation?.upgrade_supplement && <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          升級差額：每月 {money(calculation.upgrade_supplement.month_diff)} × 剩餘 {calculation.upgrade_supplement.months_left} 個月 ＝ <b>{money(calculation.upgrade_supplement.supplement)}</b>
        </div>}
        {calculation?.e_layer_applies && <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[["E 延保", calculation.e_warranty_fee], ["E 加值服務", calculation.e_value_added_fee], ["CPI 倍率", calculation.cpi_multiplier]].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl bg-violet-50 p-3"><div className="text-xs text-violet-700">{label}</div><div className="mt-1 text-sm font-black text-violet-900">{label === "CPI 倍率" ? `×${value}` : money(Number(value))}</div></div>
          ))}
        </div>}
        {calculation && <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">{[["A 年費",calculation.a_layer_fee],["B 設備",calculation.b_layer_fee],["C 年費",calculation.c_layer_fee],["D 區間",`${money(calculation.d_layer_fee_min)}～${money(calculation.d_layer_fee_max)}`],["合約基本總額",calculation.total_contract_fee]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-sm font-black text-slate-800">{typeof value === "string" ? value : money(value)}</div></div>)}</div>}
      </section>}

      {tab === "work-orders" && work.id && <section className="rounded-2xl border border-slate-200 bg-white p-6 print:hidden"><h2 className="font-black text-slate-800">編輯工單 {work.work_order_no}</h2><div className="mt-4 grid gap-3 md:grid-cols-4"><Field label="聯絡人"><input className="input" value={work.contact_name} onChange={e => setWork(p => ({ ...p, contact_name: e.target.value }))} /></Field><Field label="施工日期"><input type="date" className="input" value={work.scheduled_date} onChange={e => setWork(p => ({ ...p, scheduled_date: e.target.value }))} /></Field><Field label="服務時段"><input className="input" value={work.service_period} onChange={e => setWork(p => ({ ...p, service_period: e.target.value }))} /></Field><Field label="服務人員"><input className="input" value={work.staff_names} onChange={e => setWork(p => ({ ...p, staff_names: e.target.value }))} /></Field><Field label="REIBI 範圍確認人"><input className="input" value={work.scope_confirm_reibi} onChange={e => setWork(p => ({ ...p, scope_confirm_reibi: e.target.value }))} /></Field><Field label="REIBI 確認日期"><input type="date" className="input" value={work.scope_confirm_reibi_date} onChange={e => setWork(p => ({ ...p, scope_confirm_reibi_date: e.target.value }))} /></Field><Field label="客戶範圍確認人"><input className="input" value={work.scope_confirm_client} onChange={e => setWork(p => ({ ...p, scope_confirm_client: e.target.value }))} /></Field><Field label="客戶確認日期"><input type="date" className="input" value={work.scope_confirm_client_date} onChange={e => setWork(p => ({ ...p, scope_confirm_client_date: e.target.value }))} /></Field></div>
        <div className="mt-5 flex items-center justify-between"><h3 className="text-sm font-black text-slate-700">施工與驗收項目</h3><button onClick={() => setWorkItems(items => [...items, { name: "", spec: "", quantity: 1, note: "", result: "pass", check_note: "" }])} className="inline-flex items-center gap-1 text-xs font-bold text-teal-700"><Plus className="h-4 w-4" />新增項目</button></div>
        <div className="mt-2 space-y-2">{workItems.map((item,index) => <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-6"><input className="input" placeholder="項目" value={item.name} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,name:e.target.value}:v))} /><input className="input" placeholder="規格" value={item.spec} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,spec:e.target.value}:v))} /><input className="input" type="number" min={1} value={item.quantity} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,quantity:Number(e.target.value)}:v))} /><input className="input" placeholder="施工備註" value={item.note} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,note:e.target.value}:v))} /><select className="input" value={item.result || "pass"} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,result:e.target.value as 'pass'|'fail'}:v))}><option value="pass">通過</option><option value="fail">未通過</option></select><button onClick={() => setWorkItems(items => items.filter((_,i) => i!==index))} className="inline-flex items-center justify-center text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        <button onClick={saveWork} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white"><Save className="h-4 w-4" />儲存工單內容</button>
        {work.status === "驗收中" && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-black text-amber-900">驗收簽署</h3><div className="mt-3 grid gap-3 md:grid-cols-3"><Field label="驗收日期 *"><input type="date" className="input" value={acceptanceDate} onChange={e => setAcceptanceDate(e.target.value)} /></Field><Field label="客戶簽署姓名 *"><input className="input" value={clientSignName} onChange={e => setClientSignName(e.target.value)} /></Field><Field label="缺失改善清單"><input className="input" value={punchList} onChange={e => setPunchList(e.target.value)} /></Field></div><div className="mt-3 flex gap-2"><button onClick={() => submitAcceptance("驗收完成")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">驗收通過</button><button onClick={() => submitAcceptance("驗收異常")} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">登錄異常</button></div></div>}
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 print:hidden">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="font-black text-slate-800">{tab === "quotes" ? "報價清單" : tab === "contracts" ? "合約清單" : "工單清單"}</h2><p className="mt-1 text-xs text-slate-500">點選文件可查看完整內容與後續動作。</p></div><div className="flex gap-2"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="輸入文件編號" className="input w-44" /><input value={statusFilter} onChange={e => setStatusFilter(e.target.value)} placeholder="狀態" className="input w-32" /><button onClick={() => loadRows()} className="rounded-xl bg-slate-800 px-4 text-sm font-bold text-white">搜尋</button></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-3">文件編號</th><th>客戶</th><th>類型</th><th>狀態</th><th>金額／日期</th><th className="text-right">動作</th></tr></thead><tbody>{currentRows.map(row => { const next = tab === "quotes" ? QUOTE_NEXT[row.status] : tab === "contracts" ? CONTRACT_NEXT[row.status] : WORK_NEXT[row.status]; return <tr key={row.id} className="border-b border-slate-100"><td className="py-3 font-mono text-xs font-bold text-slate-700">{row.doc_no || row.work_order_no}</td><td>{row.client_name}</td><td>{row.doc_type || row.contract_type || "施工工單"}</td><td><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{row.status}</span></td><td>{tab === "work-orders" ? row.scheduled_date || "未排程" : money(row.total_contract_fee)}</td><td><div className="flex justify-end gap-1"><button onClick={() => selectRow(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold">查看</button>{tab === "quotes" && ["草稿","已發送"].includes(row.status) && <button onClick={() => editQuote(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold">編輯</button>}{next && <button onClick={() => moveStatus(tab,row,next)} className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-700">{next}</button>}{tab === "quotes" && row.status === "已確認" && <button onClick={() => convertQuote(row)} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700">轉合約</button>}</div></td></tr>})}</tbody></table>{currentRows.length === 0 && <div className="py-10 text-center text-sm text-slate-500">目前沒有符合條件的文件。</div>}</div>
      </section>

      {selected && <section className="print-area rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-xs font-bold text-teal-700">REIBI 正式文件</div><h2 className="mt-1 text-xl font-black text-slate-800">{selected.doc_no || selected.work_order_no}</h2><p className="mt-1 text-sm text-slate-500">{selected.client_name} · {selected.status}</p></div><button onClick={() => window.print()} className="print:hidden inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"><Printer className="h-4 w-4" />列印／另存 PDF</button></div>{expiryWarning && tab === "contracts" && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{expiryWarning}</div>}<dl className="grid gap-3 text-sm md:grid-cols-3">{Object.entries(selected).filter(([key]) => !["source_payload","artifact_id"].includes(key)).slice(0,30).map(([key,value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><dt className="text-[11px] font-bold uppercase text-slate-400">{key}</dt><dd className="mt-1 break-words font-medium text-slate-700">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "-")}</dd></div>)}</dl>{tab === "contracts" && <div className="print:hidden mt-5 space-y-4"><div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-5"><Field label="簽署人"><input className="input" value={execution.signed_by} onChange={e => setExecution(p => ({...p,signed_by:e.target.value}))} /></Field><Field label="簽署日"><input type="date" className="input" value={execution.signed_at} onChange={e => setExecution(p => ({...p,signed_at:e.target.value}))} /></Field><Field label="用印日"><input type="date" className="input" value={execution.sealed_at} onChange={e => setExecution(p => ({...p,sealed_at:e.target.value}))} /></Field><Field label="執行日"><input type="date" className="input" value={execution.executed_at} onChange={e => setExecution(p => ({...p,executed_at:e.target.value}))} /></Field><Field label="備註"><input className="input" value={execution.note} onChange={e => setExecution(p => ({...p,note:e.target.value}))} /></Field><button onClick={saveContractExecution} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white md:col-span-5">儲存簽署／用印快照</button></div><div className="flex flex-wrap gap-2"><button onClick={() => createAdjustment(selected,"upgrade")} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700">建立升級報價</button><button onClick={() => createAdjustment(selected,"renewal")} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700">建立續約報價</button><button onClick={() => createWorkOrder(selected)} className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white">建立施工工單</button></div></div>}</section>}

      <style jsx global>{`.input{width:100%;border:1px solid #e2e8f0;border-radius:.75rem;padding:.625rem .75rem;background:white;font-size:.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px #14b8a6}@media print{body *{visibility:hidden}.print-area,.print-area *{visibility:visible}.print-area{position:absolute;inset:0;border:0}}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-bold text-slate-600">{label}<div className="mt-1">{children}</div></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><input type="number" min={0} value={value} onChange={event => onChange(Number(event.target.value))} className="input" /></Field>;
}
