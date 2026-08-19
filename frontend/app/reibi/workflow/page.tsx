"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Calculator, CheckCircle2, ClipboardList, FileCheck2, FileText, HardHat, Plus, Printer, RefreshCw, Save, Trash2 } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type Tab = "quotes" | "contracts" | "work-orders";
type Row = Record<string, any>;
type WorkItem = { name: string; spec: string; quantity: number; note: string; result?: "pass" | "fail"; check_note?: string };
type CatalogSpec = { key: string; label: string; options: string[] };
type CatalogItem = { key: string; name: string; unit: string; default_quantity: number; specs: CatalogSpec[]; deliverables: string[]; accept_criteria: string[] };
type ChecklistRow = { check_id: string; criterion: string; result: "pass" | "fail" | null; note: string | null };
type ChecklistGroup = { key: string; name: string; unit: string; quantity: number; specs: Record<string, string>; deliverables: string[]; checks: ChecklistRow[] };
type Checklist = { groups: ChecklistGroup[]; total: number; passed: number; failed: number; percent: number; all_passed: boolean };

const QUOTE_NEXT: Record<string, string> = { 草稿: "已發送", 已發送: "已確認" };
const CONTRACT_NEXT: Record<string, string> = { "草稿(合約)": "已發送", 已發送: "待用印", 待用印: "用印完成", 用印完成: "執行中", 執行中: "存檔" };
const WORK_NEXT: Record<string, string> = { 草稿: "已發出", 已發出: "出貨中", 出貨中: "安裝中", 安裝中: "待驗收", 待驗收: "驗收中", 驗收完成: "已存檔" };
const D_ITEMS = [
  ["poster", "基礎海報套組"], ["board", "健促公告欄"], ["display", "設備展示區"],
  ["qr", "QR Code 貼紙組"], ["digital", "數位看板內容"], ["install", "現場施工"],
] as const;

// D 層套組（Artifact PRICING.D.bundles）。
// 只當成勾選預設值使用，不帶自己的價格：Artifact 的套組金額是「快速試算」頁的
// 區間中位數，跟正式報價單逐項加總的結果本來就不同（例如完整型套組標 10-20 萬，
// 六項逐項加總是 10.5-21.5 萬）。正式報價一律以逐項金額為準，這裡若再顯示套組
// 標價會出現兩個互相矛盾的數字。
const D_BUNDLES: Array<[string, ReadonlyArray<string>]> = [
  ["基礎型", ["poster", "qr"]],
  ["標準型", ["poster", "qr", "board", "install"]],
  ["完整型", ["poster", "qr", "board", "display", "digital", "install"]],
];

// 人數級距的建議配置（Artifact QuickQuote 的 applyTier）。
// 選定級距會一併帶入 B 層設備數量與 C 層方案，業務再依現場需求調整。
// 超過 1000 人為定制型，Artifact 不給建議數量，這裡同樣不提供按鈕。
const MEMBER_TIERS: Array<{ label: string; members: number; bed: number; chair: number; la200: number; cTier: string }> = [
  { label: "基本型 ≤100 人", members: 100, bed: 1, chair: 1, la200: 1, cTier: "基本型" },
  { label: "成長型 101-300 人", members: 300, bed: 2, chair: 2, la200: 2, cTier: "成長型" },
  { label: "專業型 301-500 人", members: 500, bed: 3, chair: 3, la200: 3, cTier: "專業型" },
  { label: "旗艦型 501-1000 人", members: 1000, bed: 5, chair: 5, la200: 5, cTier: "旗艦型" },
];

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
  // 備註欄位。不參與任何計算，但是業務記錄議定條件的地方。
  note: "", b_custom_note: "", d_note: "", e_note: "",
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
  global_note: "", special_terms: "",
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
  // D 層施工項目目錄與工單本身的勾選、數量、規格、逐項備註。
  const [itemCatalog, setItemCatalog] = useState<CatalogItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [itemQty, setItemQty] = useState<Record<string, number>>({});
  const [itemSpecs, setItemSpecs] = useState<Record<string, Record<string, string>>>({});
  const [itemNote, setItemNote] = useState<Record<string, string>>({});
  // 逐條驗收勾核。checks 以 "項目key:標準序號" 為鍵，與後端 acceptance_checklist 相同。
  const [acceptChecks, setAcceptChecks] = useState<Record<string, "pass" | "fail">>({});
  const [checkNotes, setCheckNotes] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
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

  // 施工項目目錄不隨企業改變，載入一次即可。
  useEffect(() => {
    if (!allowed) return;
    void API.getReibiWorkOrderCatalog().then((response: any) => {
      if (response.status === "success") setItemCatalog(response.data || []);
      else setError(response.message || "無法讀取施工項目目錄");
    });
  }, [allowed]);

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
    c_fee_base: isDistributor ? 0 : fees.c_fee_base, c_high_risk_fee: isDistributor ? 0 : fees.c_high_risk_fee,
    d_layer_fee_min: isDistributor ? 0 : fees.d_layer_fee_min, d_layer_fee_max: isDistributor ? 0 : fees.d_layer_fee_max, e_layer_fee: isDistributor ? 0 : fees.e_layer_fee,
    total_year_fee: isDistributor ? 0 : fees.total_year_fee, total_contract_fee: isDistributor ? 0 : fees.total_contract_fee,
    // 同上：備註要能被清空，因此送空字串而不是 null。
    note: quote.note, b_custom_note: quote.b_custom_note,
    d_note: quote.d_note, e_note: quote.e_note,
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
      note: row.note || "", b_custom_note: row.b_custom_note || "", d_note: row.d_note || "", e_note: row.e_note || "",
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
    if (tab === "work-orders") void editWork(row);
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

  const applyWorkOrder = (row: Row) => {
    setWork({
      ...EMPTY_WORK, ...row, scheduled_date: row.scheduled_date || "",
      scope_confirm_reibi_date: row.scope_confirm_reibi_date || "", scope_confirm_client_date: row.scope_confirm_client_date || "",
      global_note: row.global_note || "", special_terms: row.special_terms || "",
    });
    const items = row.items || {};
    setWorkItems(Array.isArray(items.customItems) ? items.customItems : []);
    setSelectedItems(items.selectedItems && typeof items.selectedItems === "object" ? items.selectedItems : {});
    setItemQty(items.itemQty && typeof items.itemQty === "object" ? items.itemQty : {});
    setItemSpecs(items.itemSpecs && typeof items.itemSpecs === "object" ? items.itemSpecs : {});
    setItemNote(items.itemNote && typeof items.itemNote === "object" ? items.itemNote : {});
    const acceptance = row.acceptance || {};
    setAcceptChecks(acceptance.acceptChecks && typeof acceptance.acceptChecks === "object" ? acceptance.acceptChecks : {});
    setCheckNotes(acceptance.checkNotes && typeof acceptance.checkNotes === "object" ? acceptance.checkNotes : {});
    setAcceptanceDate(row.acceptance_date || "");
    setClientSignName(row.client_sign_name || "");
    setPunchList(row.punch_list || "");
    setChecklist(row.acceptance_checklist || null);
    setSelected(row);
  };

  // 清單只帶回摘要欄位，逐項規格與驗收勾核要再取單筆。
  const editWork = async (row: Row) => {
    applyWorkOrder(row);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const response: any = await API.getReibiWorkOrder(row.id);
    if (response.status === "success") applyWorkOrder(response.data);
  };

  const workItemsPayload = () => ({
    ...(selected?.items || {}),
    selectedItems, itemQty, itemSpecs, itemNote, customItems: workItems,
  });

  const saveWork = async () => {
    if (!work.id) return;
    setLoading(true); setError("");
    const response: any = await API.updateReibiWorkOrder(work.id, {
      work_order_no: work.work_order_no, contract_id: work.contract_id, contract_no: clean(work.contract_no), client_name: work.client_name,
      status: work.status, contact_name: clean(work.contact_name), phone: clean(work.phone), email: clean(work.email), address: clean(work.address),
      scheduled_date: clean(work.scheduled_date), service_period: clean(work.service_period), staff_names: clean(work.staff_names),
      scope_confirm_reibi: clean(work.scope_confirm_reibi), scope_confirm_reibi_date: clean(work.scope_confirm_reibi_date),
      scope_confirm_client: clean(work.scope_confirm_client), scope_confirm_client_date: clean(work.scope_confirm_client_date),
      // 備註送空字串而非 null：後端的 _serialize_payload 會濾掉 None，
      // 用 clean() 就會變成「清空後儲存，舊內容仍在」。
      global_note: work.global_note, special_terms: work.special_terms,
      items: workItemsPayload(), acceptance: { acceptChecks, checkNotes },
    });
    if (response.status === "success") { setMessage("工單內容已更新。"); await editWork(response.data); await loadRows("work-orders"); }
    else setError(response.message || "工單更新失敗");
    setLoading(false);
  };

  const submitAcceptance = async (result: "驗收完成" | "驗收異常") => {
    if (!work.id || !acceptanceDate || !clientSignName.trim()) { setError("請填寫驗收日期與客戶簽署姓名"); return; }
    setLoading(true); setError("");
    const response: any = await API.acceptReibiWorkOrder(work.id, {
      acceptance_result: result, acceptance_date: acceptanceDate, client_sign_name: clientSignName,
      punch_list: clean(punchList),
      acceptance: {
        acceptChecks, checkNotes,
        // 自訂項目沒有目錄標準可對，逐項結果單獨保留。
        item_results: workItems.map(item => ({ name: item.name, result: item.result || "pass", note: item.check_note || "" })),
      },
    });
    if (response.status === "success") { setMessage(`驗收結果已登錄為「${result}」。`); await editWork(response.data); await loadRows("work-orders"); }
    else setError(response.message || "驗收登錄失敗");
    setLoading(false);
  };

  // 勾核清單在畫面上即時反映，不必等後端重算。
  const liveChecklist = useMemo(() => {
    const groups = itemCatalog.filter(item => selectedItems[item.key]);
    const rows = groups.flatMap(item => item.accept_criteria.map((_, index) => `${item.key}:${index}`));
    const passed = rows.filter(id => acceptChecks[id] === "pass").length;
    const failed = rows.filter(id => acceptChecks[id] === "fail").length;
    return { groups, total: rows.length, passed, failed, allPassed: rows.length > 0 && passed === rows.length };
  }, [itemCatalog, selectedItems, acceptChecks]);

  const toggleCatalogItem = (item: CatalogItem, checked: boolean) => {
    setSelectedItems(previous => ({ ...previous, [item.key]: checked }));
    if (checked) { setItemQty(previous => ({ ...previous, [item.key]: previous[item.key] || item.default_quantity })); return; }
    // 取消勾選時一併清掉該項的驗收勾核，否則後端會判定為孤兒鍵值而擋下驗收。
    setAcceptChecks(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !id.startsWith(`${item.key}:`))) as Record<string, "pass" | "fail">);
    setCheckNotes(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !id.startsWith(`${item.key}:`))));
  };

  // 場勘需求單的來源。報價把 D 層配置放在 config，合約放在 terms.quote_snapshot.config，
  // 工單則在建立時複製到 items —— 三種文件都能產生同一份單子。
  const surveySource = useMemo(() => {
    if (!selected) return { items: {} as Record<string, boolean>, sites: [] as Row[], note: "" };
    const fromContract = selected.terms?.quote_snapshot?.config;
    const source = selected.config || fromContract || selected.items || {};
    return {
      items: (source.dItems || {}) as Record<string, boolean>,
      sites: Array.isArray(source.dSites) ? source.dSites : [],
      note: selected.d_note || "",
    };
  }, [selected]);
  const surveySites = surveySource.sites;
  const surveyItems = useMemo(
    () => itemCatalog.filter(item => surveySource.items[item.key]),
    [itemCatalog, surveySource],
  );

  const currentRows = rows[tab];
  const expiryWarning = useMemo(() => {
    if (!selected?.contract_end) return null;
    const days = Math.ceil((new Date(selected.contract_end).getTime() - Date.now()) / 86_400_000);
    return days >= 0 && days <= 90 ? `合約將於 ${days} 天後到期` : days < 0 ? `合約已逾期 ${Math.abs(days)} 天` : null;
  }, [selected]);

  if (!session) return <div className="p-8 text-center text-slate-500">請先登入。</div>;
  if (!allowed) return <div className="p-8 text-center text-red-700">目前帳號沒有 REIBI 商務文件管理權限。</div>;

  // D 層場勘需求單（Artifact QuoteForm／ContractView 的 showSurvey 畫面）。
  // 業務帶著這張單子到現場，勾選項目與場域已印好，右側留白給現場記錄。
  if (showSurvey && selected) return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex justify-between print:hidden">
        <button onClick={() => setShowSurvey(false)} className="text-sm font-bold text-teal-700">← 返回文件</button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"><Printer className="h-4 w-4" />列印／另存 PDF</button>
      </div>
      <section className="print-area rounded-2xl border border-slate-200 bg-white p-8 leading-relaxed">
        <p className="text-center text-base font-black text-slate-800">麗媚生化科技有限公司<br /><span className="text-sm">REIBI BIO-Technology Co., Ltd.</span></p>
        <p className="mt-2 text-center text-sm font-black text-slate-700">D 層 健康識能環境佈置 — 場勘需求單</p>
        <dl className="mt-6 grid gap-1 rounded-xl bg-slate-50 p-4 text-sm">
          <div>客戶：{selected.client_name || "—"}{selected.address ? `（${selected.address}）` : ""}</div>
          <div>聯絡人：{selected.contact_name || "—"} · {selected.phone || "—"}</div>
          <div>文件編號：{selected.doc_no || selected.work_order_no || "（草稿，尚未儲存）"}</div>
          <div>製表日期：{new Date().toISOString().slice(0, 10)}</div>
        </dl>

        <h2 className="mt-6 text-sm font-black text-slate-700">客戶已選擇項目</h2>
        <div className="mt-2 space-y-2">{surveyItems.length > 0 ? surveyItems.map(item => <div key={item.key} className="rounded-lg border border-slate-200 p-3 text-xs">
          <b className="text-slate-700">{item.name}</b>
          <div className="mt-1 text-slate-500">預設 {item.default_quantity} {item.unit}　交付：{item.deliverables.join("、")}</div>
        </div>) : <p className="text-xs text-slate-500">（尚未勾選 D 層項目，請先於報價的 D 層勾選後再產生本單）</p>}</div>

        <h2 className="mt-6 text-sm font-black text-slate-700">場域地點</h2>
        <div className="mt-2 space-y-2">{surveySites.length > 0 ? surveySites.map((site: Row, index: number) => <div key={site.id ?? index} className="rounded-lg border border-slate-200 p-3 text-xs">
          <b className="text-slate-700">{site.label || "(未命名場域)"}</b>
          <div className="text-slate-500">{site.address || "(地址待場勘後補登)"}</div>
          {site.note && <div className="text-slate-400">備註：{site.note}</div>}
        </div>) : [1, 2, 3].map(n => <div key={n} className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-400">場域{n}　名稱：________________　地址：____________________________</div>)}</div>

        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-xs">
          <p className="font-black text-amber-900">業務現場勘查記錄欄（現場填寫）</p>
          {["現況空間／動線：", "電力／網路可用性：", "與 B 層設備安裝之協調事項：", "勘查人員：________________　勘查日期：________________"].map(label => (
            <p key={label} className="mt-4 text-amber-900">{label}</p>
          ))}
        </div>

        {surveySource.note && <p className="mt-4 text-xs text-slate-600">報價 D 層備註：{surveySource.note}</p>}
        <p className="mt-4 text-xs text-slate-500">付款方式：50% 訂金 → 50% 完工驗收。正式報價需現場勘查確認後 3-7 工作日內提供。</p>
        <p className="mt-3 text-center text-xs text-slate-400">本文件由系統自動產生，如有疑問請聯繫 reibiservice@gmail.com</p>
      </section>
    </div>
  );

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
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-600">人數級距建議配置</div>
          <p className="mt-1 text-[11px] text-slate-500">帶入該級距的人數、B 層設備數量與 C 層方案，之後仍可逐項調整。1000 人以上為定制型，需個別議價。</p>
          <div className="mt-2 flex flex-wrap gap-2">{MEMBER_TIERS.map(tier => <button key={tier.label} type="button"
            onClick={() => setQuote(p => ({ ...p, member_count: tier.members, b_bed: tier.bed, b_chair: tier.chair, b_la200: tier.la200, c_tier: tier.cTier }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-600 hover:text-teal-700">{tier.label}</button>)}</div>
        </div>
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
        <div className="mt-4"><div className="mb-2 text-xs font-bold text-slate-600">D 層環境佈置</div>
          <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[11px] text-slate-500">套組快選</span>{D_BUNDLES.map(([name, keys]) => <button key={name} type="button"
            onClick={() => setQuote(p => ({ ...p, d_items: Object.fromEntries(D_ITEMS.map(([key]) => [key, keys.includes(key)])) }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-teal-600 hover:text-teal-700">{name}</button>)}
            <button type="button" onClick={() => setQuote(p => ({ ...p, d_items: {} }))} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-700">清除</button></div>
          <div className="flex flex-wrap gap-2">{D_ITEMS.map(([key,label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={Boolean(quote.d_items[key])} onChange={e => setQuote(p => ({ ...p, d_items: { ...p.d_items, [key]: e.target.checked } }))} />{label}</label>)}</div>{catalogs.sites.length > 0 && <><div className="mb-2 mt-4 text-xs font-bold text-slate-600">施工場域</div><div className="flex flex-wrap gap-2">{catalogs.sites.map(site => <label key={site.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={quote.d_sites.includes(site.id)} onChange={e => setQuote(p => ({...p,d_sites:e.target.checked ? [...p.d_sites,site.id] : p.d_sites.filter(id => id !== site.id)}))} />{site.label}</label>)}</div></>}
          <Field label="D 層備註"><textarea rows={2} className="input mt-3" value={quote.d_note} placeholder="場勘限制、施工時段、客戶自備材料等" onChange={e => setQuote(p => ({ ...p, d_note: e.target.value }))} /></Field>
        </div>
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
          <Field label="E 層備註"><textarea rows={2} className="input mt-3" value={quote.e_note} placeholder="延保起算年度、加值服務交付時程等" onChange={e => setQuote(p => ({ ...p, e_note: e.target.value }))} /></Field>
        </div>}

        {quote.doc_type === "升級報價" && <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-xs font-black text-indigo-900">升級差額（依原合約剩餘月份補收）</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="原 A 層年費"><input type="number" min={0} className="input" value={quote.original_a_fee} onChange={e => setQuote(p => ({ ...p, original_a_fee: e.target.value }))} /></Field>
            <Field label="升級日"><input type="date" className="input" value={quote.upgrade_date} onChange={e => setQuote(p => ({ ...p, upgrade_date: e.target.value }))} /></Field>
            <Field label="原合約到期日"><input type="date" className="input" value={quote.original_contract_end} onChange={e => setQuote(p => ({ ...p, original_contract_end: e.target.value }))} /></Field>
          </div>
        </div>}

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Field label="B 層設備備註"><textarea rows={2} className="input" value={quote.b_custom_note} placeholder="客製機型、交期約定、安裝條件" onChange={e => setQuote(p => ({ ...p, b_custom_note: e.target.value }))} /></Field>
          <Field label="整體備註"><textarea rows={2} className="input" value={quote.note} placeholder="議價條件、付款約定、其他說明" onChange={e => setQuote(p => ({ ...p, note: e.target.value }))} /></Field>
        </div>

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
        {calculation && Number(calculation.c_high_risk_fee || 0) > 0 && <p className="mt-2 text-xs text-slate-500">
          C 年費組成：方案費 {money(calculation.c_fee_base)} ＋ 高風險高管加購 {money(calculation.c_high_risk_fee)}（{quote.c_high_risk} 人 × {money(14000)}，均已含折扣）
        </p>}
      </section>}

      {tab === "work-orders" && work.id && <section className="rounded-2xl border border-slate-200 bg-white p-6 print:hidden"><h2 className="font-black text-slate-800">編輯工單 {work.work_order_no}</h2><div className="mt-4 grid gap-3 md:grid-cols-4"><Field label="聯絡人"><input className="input" value={work.contact_name} onChange={e => setWork(p => ({ ...p, contact_name: e.target.value }))} /></Field><Field label="施工日期"><input type="date" className="input" value={work.scheduled_date} onChange={e => setWork(p => ({ ...p, scheduled_date: e.target.value }))} /></Field><Field label="服務時段"><input className="input" value={work.service_period} onChange={e => setWork(p => ({ ...p, service_period: e.target.value }))} /></Field><Field label="服務人員"><input className="input" value={work.staff_names} onChange={e => setWork(p => ({ ...p, staff_names: e.target.value }))} /></Field><Field label="REIBI 範圍確認人"><input className="input" value={work.scope_confirm_reibi} onChange={e => setWork(p => ({ ...p, scope_confirm_reibi: e.target.value }))} /></Field><Field label="REIBI 確認日期"><input type="date" className="input" value={work.scope_confirm_reibi_date} onChange={e => setWork(p => ({ ...p, scope_confirm_reibi_date: e.target.value }))} /></Field><Field label="客戶範圍確認人"><input className="input" value={work.scope_confirm_client} onChange={e => setWork(p => ({ ...p, scope_confirm_client: e.target.value }))} /></Field><Field label="客戶確認日期"><input type="date" className="input" value={work.scope_confirm_client_date} onChange={e => setWork(p => ({ ...p, scope_confirm_client_date: e.target.value }))} /></Field></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="整體備註"><textarea rows={2} className="input" value={work.global_note} placeholder="適用於全部施工項目的說明" onChange={e => setWork(p => ({ ...p, global_note: e.target.value }))} /></Field>
          <Field label="特殊條款"><textarea rows={2} className="input" value={work.special_terms} placeholder="加班費分攤、現場限制、客戶自備材料等" onChange={e => setWork(p => ({ ...p, special_terms: e.target.value }))} /></Field>
        </div>

        {surveySites.length > 0 && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-black text-slate-700">施工場域</h3>
          <p className="mt-1 text-[11px] text-slate-500">由報價快照帶入，場域資料在企業設定維護；場勘需求單可從下方文件檢視列印。</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">{surveySites.map((site, index) => <div key={site.id ?? index} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <b className="text-slate-700">{site.label || "(未命名場域)"}</b>
            <div className="mt-1 text-slate-500">{site.address || "(地址待場勘後補登)"}</div>
            {site.note && <div className="mt-1 text-slate-400">備註：{site.note}</div>}
          </div>)}</div>
        </div>}

        <div className="mt-5"><h3 className="text-sm font-black text-slate-700">D 層施工項目</h3>
          <p className="mt-1 text-xs text-slate-500">勾選的項目會帶出規格選項與驗收標準；驗收清單由此產生。</p>
          <div className="mt-3 space-y-3">{itemCatalog.map(item => {
            const checked = Boolean(selectedItems[item.key]);
            return <div key={item.key} className={`rounded-xl border p-3 ${checked ? "border-teal-200 bg-teal-50/40" : "border-slate-200"}`}>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={checked} onChange={e => toggleCatalogItem(item, e.target.checked)} />{item.name}
              </label>
              {checked && <div className="mt-3 space-y-3">
                <div className="grid gap-2 md:grid-cols-4">
                  <Field label={`數量（${item.unit}）`}><input type="number" min={1} className="input" value={itemQty[item.key] ?? item.default_quantity}
                    onChange={e => setItemQty(p => ({ ...p, [item.key]: Number(e.target.value) }))} /></Field>
                  {item.specs.map(spec => <Field key={spec.key} label={spec.label}>
                    <select className="input" value={itemSpecs[item.key]?.[spec.key] || ""}
                      onChange={e => setItemSpecs(p => ({ ...p, [item.key]: { ...(p[item.key] || {}), [spec.key]: e.target.value } }))}>
                      <option value="">未指定</option>{spec.options.map(option => <option key={option} value={option}>{option}</option>)}
                    </select></Field>)}
                </div>
                <Field label="項目備註"><input className="input" value={itemNote[item.key] || ""} onChange={e => setItemNote(p => ({ ...p, [item.key]: e.target.value }))} /></Field>
                <div className="text-[11px] text-slate-500">交付項目：{item.deliverables.join("、")}</div>
              </div>}
            </div>;
          })}</div>
        </div>

        <div className="mt-5 flex items-center justify-between"><h3 className="text-sm font-black text-slate-700">自訂項目</h3><button onClick={() => setWorkItems(items => [...items, { name: "", spec: "", quantity: 1, note: "", result: "pass", check_note: "" }])} className="inline-flex items-center gap-1 text-xs font-bold text-teal-700"><Plus className="h-4 w-4" />新增項目</button></div>
        <div className="mt-2 space-y-2">{workItems.map((item,index) => <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-6"><input className="input" placeholder="項目" value={item.name} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,name:e.target.value}:v))} /><input className="input" placeholder="規格" value={item.spec} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,spec:e.target.value}:v))} /><input className="input" type="number" min={1} value={item.quantity} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,quantity:Number(e.target.value)}:v))} /><input className="input" placeholder="施工備註" value={item.note} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,note:e.target.value}:v))} /><select className="input" value={item.result || "pass"} onChange={e => setWorkItems(items => items.map((v,i) => i===index ? {...v,result:e.target.value as 'pass'|'fail'}:v))}><option value="pass">通過</option><option value="fail">未通過</option></select><button onClick={() => setWorkItems(items => items.filter((_,i) => i!==index))} className="inline-flex items-center justify-center text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        <button onClick={saveWork} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white"><Save className="h-4 w-4" />儲存工單內容</button>
        {work.status === "驗收中" && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-black text-amber-900">驗收簽署</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3"><Field label="驗收日期 *"><input type="date" className="input" value={acceptanceDate} onChange={e => setAcceptanceDate(e.target.value)} /></Field><Field label="客戶簽署姓名 *"><input className="input" value={clientSignName} onChange={e => setClientSignName(e.target.value)} /></Field><Field label="缺失改善清單"><input className="input" value={punchList} onChange={e => setPunchList(e.target.value)} /></Field></div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span>驗收進度 {liveChecklist.passed}/{liveChecklist.total} 項{liveChecklist.failed > 0 ? ` · ${liveChecklist.failed} 項異常` : ""}</span>
              <span>{liveChecklist.total ? Math.round(liveChecklist.passed / liveChecklist.total * 100) : 0}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
              <div className={`h-full rounded-full transition-all ${liveChecklist.allPassed ? "bg-emerald-600" : "bg-teal-600"}`}
                style={{ width: `${liveChecklist.total ? liveChecklist.passed / liveChecklist.total * 100 : 0}%` }} />
            </div>
          </div>

          <div className="mt-3 space-y-3">{liveChecklist.groups.map(item => <div key={item.key} className="rounded-xl bg-white p-3">
            <div className="text-sm font-black text-slate-700">{item.name} × {itemQty[item.key] ?? item.default_quantity}{item.unit}</div>
            {item.specs.some(spec => itemSpecs[item.key]?.[spec.key]) && <div className="mt-1 text-[11px] text-slate-500">
              {item.specs.filter(spec => itemSpecs[item.key]?.[spec.key]).map(spec => `${spec.label}：${itemSpecs[item.key][spec.key]}`).join("　")}
            </div>}
            <div className="mt-2 space-y-2">{item.accept_criteria.map((criterion, index) => {
              const checkId = `${item.key}:${index}`;
              const result = acceptChecks[checkId];
              return <div key={checkId} className="grid gap-2 md:grid-cols-[1fr_auto_200px] md:items-center">
                <span className="text-xs text-slate-600">{criterion}</span>
                <div className="flex gap-1">{(["pass", "fail"] as const).map(value => <button key={value} type="button"
                  onClick={() => setAcceptChecks(p => { const next = { ...p }; if (next[checkId] === value) delete next[checkId]; else next[checkId] = value; return next; })}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${result === value ? (value === "pass" ? "bg-emerald-700 text-white" : "bg-red-700 text-white") : "bg-slate-100 text-slate-500"}`}>
                  {value === "pass" ? "通過" : "異常"}</button>)}</div>
                <input className="input" placeholder="勾核備註" value={checkNotes[checkId] || ""} onChange={e => setCheckNotes(p => ({ ...p, [checkId]: e.target.value }))} />
              </div>;
            })}</div>
          </div>)}</div>
          {liveChecklist.total === 0 && <p className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-500">尚未勾選任何 D 層施工項目，因此沒有驗收標準可對；請先在上方選定項目並儲存。</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={() => submitAcceptance("驗收完成")} disabled={liveChecklist.total > 0 && !liveChecklist.allPassed}
              title={liveChecklist.total > 0 && !liveChecklist.allPassed ? "尚有驗收標準未通過" : undefined}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">驗收通過</button>
            <button onClick={() => submitAcceptance("驗收異常")} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">登錄異常</button>
            {liveChecklist.total > 0 && !liveChecklist.allPassed && <span className="text-xs text-amber-800">全部標準通過後才可登錄驗收完成。</span>}
          </div>
        </div>}
        {checklist && work.status !== "驗收中" && checklist.total > 0 && <p className="mt-4 text-xs text-slate-500">
          已登錄驗收：{checklist.passed}/{checklist.total} 項通過{checklist.failed > 0 ? `，${checklist.failed} 項異常` : ""}。
        </p>}
      </section>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 print:hidden">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="font-black text-slate-800">{tab === "quotes" ? "報價清單" : tab === "contracts" ? "合約清單" : "工單清單"}</h2><p className="mt-1 text-xs text-slate-500">點選文件可查看完整內容與後續動作。</p></div><div className="flex gap-2"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="輸入文件編號" className="input w-44" /><input value={statusFilter} onChange={e => setStatusFilter(e.target.value)} placeholder="狀態" className="input w-32" /><button onClick={() => loadRows()} className="rounded-xl bg-slate-800 px-4 text-sm font-bold text-white">搜尋</button></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-3">文件編號</th><th>客戶</th><th>類型</th><th>狀態</th><th>金額／日期</th><th className="text-right">動作</th></tr></thead><tbody>{currentRows.map(row => { const next = tab === "quotes" ? QUOTE_NEXT[row.status] : tab === "contracts" ? CONTRACT_NEXT[row.status] : WORK_NEXT[row.status]; return <tr key={row.id} className="border-b border-slate-100"><td className="py-3 font-mono text-xs font-bold text-slate-700">{row.doc_no || row.work_order_no}</td><td>{row.client_name}</td><td>{row.doc_type || row.contract_type || "施工工單"}</td><td><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{row.status}</span></td><td>{tab === "work-orders" ? row.scheduled_date || "未排程" : money(row.total_contract_fee)}</td><td><div className="flex justify-end gap-1"><button onClick={() => selectRow(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold">查看</button>{tab === "quotes" && ["草稿","已發送"].includes(row.status) && <button onClick={() => editQuote(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold">編輯</button>}{next && <button onClick={() => moveStatus(tab,row,next)} className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-700">{next}</button>}{tab === "quotes" && row.status === "已確認" && <button onClick={() => convertQuote(row)} className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700">轉合約</button>}</div></td></tr>})}</tbody></table>{currentRows.length === 0 && <div className="py-10 text-center text-sm text-slate-500">目前沒有符合條件的文件。</div>}</div>
      </section>

      {selected && <section className="print-area rounded-2xl border border-slate-200 bg-white p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-xs font-bold text-teal-700">REIBI 正式文件</div><h2 className="mt-1 text-xl font-black text-slate-800">{selected.doc_no || selected.work_order_no}</h2><p className="mt-1 text-sm text-slate-500">{selected.client_name} · {selected.status}</p></div><div className="print:hidden flex gap-2">{(surveyItems.length > 0 || surveySites.length > 0) && <button onClick={() => setShowSurvey(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-teal-700"><ClipboardList className="h-4 w-4" />場勘需求單</button>}<button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"><Printer className="h-4 w-4" />列印／另存 PDF</button></div></div>{expiryWarning && tab === "contracts" && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{expiryWarning}</div>}<dl className="grid gap-3 text-sm md:grid-cols-3">{Object.entries(selected).filter(([key]) => !["source_payload","artifact_id"].includes(key)).slice(0,30).map(([key,value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><dt className="text-[11px] font-bold uppercase text-slate-400">{key}</dt><dd className="mt-1 break-words font-medium text-slate-700">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "-")}</dd></div>)}</dl>{tab === "contracts" && <div className="print:hidden mt-5 space-y-4"><div className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-5"><Field label="簽署人"><input className="input" value={execution.signed_by} onChange={e => setExecution(p => ({...p,signed_by:e.target.value}))} /></Field><Field label="簽署日"><input type="date" className="input" value={execution.signed_at} onChange={e => setExecution(p => ({...p,signed_at:e.target.value}))} /></Field><Field label="用印日"><input type="date" className="input" value={execution.sealed_at} onChange={e => setExecution(p => ({...p,sealed_at:e.target.value}))} /></Field><Field label="執行日"><input type="date" className="input" value={execution.executed_at} onChange={e => setExecution(p => ({...p,executed_at:e.target.value}))} /></Field><Field label="備註"><input className="input" value={execution.note} onChange={e => setExecution(p => ({...p,note:e.target.value}))} /></Field><button onClick={saveContractExecution} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white md:col-span-5">儲存簽署／用印快照</button></div><div className="flex flex-wrap gap-2"><button onClick={() => createAdjustment(selected,"upgrade")} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700">建立升級報價</button><button onClick={() => createAdjustment(selected,"renewal")} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700">建立續約報價</button><button onClick={() => createWorkOrder(selected)} className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white">建立施工工單</button></div></div>}</section>}

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
