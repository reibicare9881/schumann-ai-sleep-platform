"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeDollarSign, BarChart3, Boxes, Building2, CalendarClock, FileCheck2, FileText, HardHat, Headphones, HeartPulse, MapPin, Network, Pencil, Plus, RefreshCw, Save, Trash2, Upload, Users } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type ArtifactSource = "main" | "l5" | "quote" | "workorder";

type Overview = {
  enterprise: null | Record<string, any>;
  metrics: null | {
    member_limit: number;
    used_count: number;
    registered_member_count: number;
    usage_percent: number | null;
    usage_alert: boolean;
    usage_count_outdated: boolean;
    contract_state: "not_set" | "upcoming" | "active" | "expiring" | "expired" | "invalid";
    contract_days_left: number | null;
  };
  quotes: number;
  contracts: number;
  work_orders: number;
};

type Validation = {
  sha256: string;
  byte_size: number;
  record_count: number;
  skipped_count: number;
  storage_keys: Record<string, number>;
  target_counts: Record<string, number>;
  warnings: string[];
};

type EnterpriseSite = {
  id: number;
  label: string;
  address?: string | null;
  note?: string | null;
  sort_order: number;
};

type Department = {
  id: number;
  parent_id?: number | null;
  name: string;
  hierarchy_level: number;
  sort_order: number;
  is_active: boolean;
  direct_member_count: number;
  member_count: number;
};

const EMPTY_ENTERPRISE = {
  org_name: "",
  org_alias: "",
  status: "pending",
  ubn: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  industry: "",
  plan_code: "",
  member_limit: 0,
  used_count: 0,
  contract_start: "",
  contract_end: "",
  contract_years: 3,
  pay_mode: "annual",
  consultant: "",
  partner_code: "",
  referral_percent: "",
  a_layer_fee: 0,
  b_layer_fee: 0,
  c_layer_fee: 0,
  d_layer_fee: 0,
  devices: { cloudBeds: 0, relaxChairs: 0, la200: 0 },
  d_layer_config: { poster: false, board: false, digital: false, qr: false, display: false, install: false },
};

const EMPTY_SITE = { label: "", address: "", note: "", sort_order: 0 };
const EMPTY_DEPARTMENT = { name: "", parent_id: "", sort_order: 0, is_active: true };
const PLAN_OPTIONS = [
  { value: "基本", label: "基本（100 人以下）", annualFee: 600000, devices: { cloudBeds: 1, relaxChairs: 0, la200: 0 } },
  { value: "成長", label: "成長（101–300 人）", annualFee: 1200000, devices: { cloudBeds: 1, relaxChairs: 1, la200: 0 } },
  { value: "專業", label: "專業（301–500 人）", annualFee: 1800000, devices: { cloudBeds: 2, relaxChairs: 1, la200: 1 } },
  { value: "旗艦", label: "旗艦（501–1000 人）", annualFee: 3000000, devices: { cloudBeds: 2, relaxChairs: 2, la200: 1 } },
  { value: "custom", label: "定制型（1000 人以上）", annualFee: 0, devices: { cloudBeds: 0, relaxChairs: 0, la200: 0 } },
] as const;
const DEVICE_FIELDS = [
  ["cloudBeds", "舒曼波雲朵床", 800000],
  ["relaxChairs", "舒曼波樂活電動椅", 750000],
  ["la200", "LA200 光能設備", 149400],
] as const;
const D_LAYER_FIELDS = [
  ["poster", "基礎海報套組"], ["board", "健促公告欄"], ["digital", "數位看板內容"],
  ["qr", "QR Code 貼紙組"], ["display", "設備展示區佈置"], ["install", "現場佈置施工"],
] as const;

function normalizeExport(parsed: any, source: ArtifactSource, version: string) {
  if (parsed && Array.isArray(parsed.entries)) {
    return {
      source_artifact: parsed.source_artifact || source,
      source_version: parsed.source_version || version || undefined,
      entries: parsed.entries,
    };
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("JSON 必須是 storage key/value 物件，或包含 entries 陣列的標準匯出格式");
  }
  return {
    source_artifact: source,
    source_version: version || undefined,
    entries: Object.entries(parsed).map(([storage_key, value]) => ({ storage_key, value })),
  };
}

export default function ReibiManagementPage() {
  const { session } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [enterprise, setEnterprise] = useState({ ...EMPTY_ENTERPRISE });
  const [sites, setSites] = useState<EnterpriseSite[]>([]);
  const [siteDraft, setSiteDraft] = useState({ ...EMPTY_SITE });
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentDraft, setDepartmentDraft] = useState({ ...EMPTY_DEPARTMENT });
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);
  const [source, setSource] = useState<ArtifactSource>("main");
  const [version, setVersion] = useState("");
  const [exportPayload, setExportPayload] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const allowed = Boolean(session && can(session.systemRole, "manage_reibi"));

  const loadOverview = async () => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const response: any = await API.getReibiOverview();
    if (response.status === "success") {
      const data = response.data as Overview;
      setOverview(data);
      if (data.enterprise) {
        setEnterprise({
          ...EMPTY_ENTERPRISE,
          ...Object.fromEntries(Object.entries(data.enterprise).filter(([key]) => key in EMPTY_ENTERPRISE)),
        });
        const [siteResponse, departmentResponse]: any[] = await Promise.all([
          API.listReibiEnterpriseSites(),
          API.listReibiDepartments(),
        ]);
        if (siteResponse.status === "success") setSites(siteResponse.data || []);
        else setError(siteResponse.message || "無法讀取企業場域");
        if (departmentResponse.status === "success") setDepartments(departmentResponse.data || []);
        else setError(departmentResponse.message || "無法讀取部門架構");
      } else {
        setSites([]);
        setDepartments([]);
      }
    } else {
      setError(response.message || "無法讀取 REIBI 資料");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!session) return null;

  if (!allowed) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">權限不足</h1>
          <p className="text-sm text-slate-500 mt-2">REIBI 管理中心目前只開放單位平台管理者。</p>
          <Link href="/dashboard" className="inline-flex mt-6 text-sm font-bold text-teal-700">返回儀表板</Link>
        </div>
      </div>
    );
  }

  const saveEnterprise = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    const payload = Object.fromEntries(
      Object.entries(enterprise).map(([key, value]) => [key, value === "" ? null : value])
    );
    const response: any = await API.saveReibiEnterprise(payload);
    if (response.status === "success") {
      setMessage("企業資料已儲存。");
      await loadOverview();
    } else {
      setError(response.message || "企業資料儲存失敗");
    }
    setLoading(false);
  };

  const saveSite = async () => {
    if (!siteDraft.label.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");
    const payload = {
      ...siteDraft,
      label: siteDraft.label.trim(),
      address: siteDraft.address.trim() || null,
      note: siteDraft.note.trim() || null,
    };
    const response: any = editingSiteId
      ? await API.updateReibiEnterpriseSite(editingSiteId, payload)
      : await API.createReibiEnterpriseSite(payload);
    if (response.status === "success") {
      setSiteDraft({ ...EMPTY_SITE });
      setEditingSiteId(null);
      setMessage(editingSiteId ? "場域已更新。" : "場域已新增。");
      await loadOverview();
    } else {
      setError(response.message || "場域儲存失敗");
    }
    setLoading(false);
  };

  const editSite = (site: EnterpriseSite) => {
    setEditingSiteId(site.id);
    setSiteDraft({
      label: site.label,
      address: site.address || "",
      note: site.note || "",
      sort_order: site.sort_order,
    });
  };

  const deleteSite = async (site: EnterpriseSite) => {
    if (!window.confirm(`確定刪除場域「${site.label}」？`)) return;
    setLoading(true);
    const response: any = await API.deleteReibiEnterpriseSite(site.id);
    if (response.status === "success") {
      setMessage("場域已刪除。");
      await loadOverview();
    } else setError(response.message || "場域刪除失敗");
    setLoading(false);
  };

  const saveDepartment = async () => {
    if (!departmentDraft.name.trim()) return;
    setLoading(true);
    setError("");
    setMessage("");
    const payload = {
      name: departmentDraft.name.trim(),
      parent_id: departmentDraft.parent_id ? Number(departmentDraft.parent_id) : null,
      sort_order: departmentDraft.sort_order,
      is_active: departmentDraft.is_active,
    };
    const response: any = editingDepartmentId
      ? await API.updateReibiDepartment(editingDepartmentId, payload)
      : await API.createReibiDepartment(payload);
    if (response.status === "success") {
      setDepartmentDraft({ ...EMPTY_DEPARTMENT });
      setEditingDepartmentId(null);
      setMessage(editingDepartmentId ? "部門已更新。" : "部門已新增。");
      await loadOverview();
    } else setError(response.message || "部門儲存失敗");
    setLoading(false);
  };

  const editDepartment = (department: Department) => {
    setEditingDepartmentId(department.id);
    setDepartmentDraft({
      name: department.name,
      parent_id: department.parent_id ? String(department.parent_id) : "",
      sort_order: department.sort_order,
      is_active: department.is_active,
    });
  };

  const deleteDepartment = async (department: Department) => {
    if (!window.confirm(`確定刪除部門「${department.name}」？有下層部門時系統會拒絕刪除。`)) return;
    setLoading(true);
    const response: any = await API.deleteReibiDepartment(department.id);
    if (response.status === "success") {
      setMessage("部門已刪除。");
      await loadOverview();
    } else setError(response.message || "部門刪除失敗");
    setLoading(false);
  };

  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setMessage("");
    setValidation(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      setExportPayload(normalizeExport(parsed, source, version));
      setFileName(file.name);
    } catch (err) {
      setExportPayload(null);
      setFileName("");
      setError(err instanceof Error ? err.message : "JSON 解析失敗");
    }
  };

  const validateExport = async () => {
    if (!exportPayload) {
      setError("請先選擇 Artifact JSON 匯出檔");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    const payload = { ...exportPayload, source_artifact: source, source_version: version || exportPayload.source_version };
    const response: any = await API.validateReibiArtifact(payload);
    if (response.status === "success") {
      setValidation(response.data);
      setMessage("預檢完成；沒有寫入任何資料。");
    } else {
      setValidation(null);
      setError(response.message || "Artifact 預檢失敗");
    }
    setLoading(false);
  };

  const stats = [
    { label: "企業狀態", value: overview?.enterprise?.status || "尚未建檔", icon: <Building2 className="w-5 h-5" /> },
    { label: "授權使用", value: overview?.metrics?.usage_percent == null ? "未設定" : `${overview.metrics.usage_percent}%`, icon: <Users className="w-5 h-5" /> },
    { label: "合約狀態", value: ({ not_set: "未設定", upcoming: "尚未生效", active: "有效", expiring: "30 天內到期", expired: "已到期", invalid: "日期異常" } as Record<string, string>)[overview?.metrics?.contract_state || "not_set"], icon: <CalendarClock className="w-5 h-5" /> },
    { label: "報價單", value: overview?.quotes ?? 0, icon: <FileText className="w-5 h-5" /> },
    { label: "合約", value: overview?.contracts ?? 0, icon: <FileCheck2 className="w-5 h-5" /> },
    { label: "工單", value: overview?.work_orders ?? 0, icon: <HardHat className="w-5 h-5" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 mb-2"><ArrowLeft className="w-4 h-4" /> 返回儀表板</Link>
          <h1 className="text-2xl font-black text-slate-800">REIBI 管理中心</h1>
          <p className="text-sm text-slate-500 mt-1">企業資料、商務文件統計與 Artifact 搬移預檢</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/reibi/workflow" className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white"><FileCheck2 className="w-4 h-4" /> 商務文件工作台</Link>
          <Link href="/reibi/operations" className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white"><BadgeDollarSign className="w-4 h-4" /> 財務與夥伴營運</Link>
          <Link href="/reibi/health" className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white"><HeartPulse className="w-4 h-4" /> 健康與職安</Link>
          <Link href="/reibi/analytics" className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white"><BarChart3 className="w-4 h-4" /> 組織分析</Link>
          <Link href="/reibi/service" className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white"><Headphones className="w-4 h-4" /> 服務與整合</Link>
          <button onClick={loadOverview} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 重新整理
          </button>
        </div>
      </div>

      {(message || error) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>{error || message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {stats.map(item => <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-4"><div className="text-teal-700 mb-3">{item.icon}</div><div className="text-xl font-black text-slate-800">{item.value}</div><div className="text-xs text-slate-500 mt-1">{item.label}</div></div>)}
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-black text-slate-800 mb-1">企業基本資料</h2>
        <p className="text-xs text-slate-500 mb-5">單位代碼由登入 Token 決定，前端不能指定或修改其他企業。</p>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ["org_name", "企業名稱"], ["org_alias", "企業簡稱"], ["ubn", "統一編號"], ["industry", "產業"],
            ["contact_name", "聯絡人"], ["phone", "電話"], ["email", "Email"], ["address", "地址"],
          ].map(([key, label]) => (
            <label key={key} className="block text-xs font-bold text-slate-600">{label}
              <input
                type="text"
                value={(enterprise as any)[key] ?? ""}
                onChange={event => setEnterprise(prev => ({ ...prev, [key]: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
          ))}
        </div>
        <button onClick={saveEnterprise} disabled={loading || !enterprise.org_name} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="w-4 h-4" /> 儲存企業資料</button>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-black text-slate-800 flex items-center gap-2"><Boxes className="w-5 h-5 text-amber-700" /> 方案、授權用量與合約</h2>
            <p className="text-xs text-slate-500 mt-1">保留 Artifact 的方案與已用人數，同時顯示目前 Supabase profiles 的實際帳號數供核對。</p>
          </div>
          {overview?.metrics?.usage_alert && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">授權使用率達 90%</span>}
        </div>

        {overview?.metrics && (
          <div className="grid md:grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">REIBI 已用／上限</div><div className="mt-1 text-lg font-black text-slate-800">{overview.metrics.used_count}／{overview.metrics.member_limit || "未設定"}</div></div>
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">目前平台帳號</div><div className="mt-1 text-lg font-black text-slate-800">{overview.metrics.registered_member_count}</div>{overview.metrics.usage_count_outdated && <button type="button" onClick={() => setEnterprise(prev => ({ ...prev, used_count: overview.metrics!.registered_member_count }))} className="mt-2 text-xs font-bold text-teal-700">帶入已用人數欄位</button>}</div>
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">合約剩餘</div><div className="mt-1 text-lg font-black text-slate-800">{overview.metrics.contract_days_left == null ? "未設定" : overview.metrics.contract_days_left < 0 ? `逾期 ${Math.abs(overview.metrics.contract_days_left)} 天` : `${overview.metrics.contract_days_left} 天`}</div></div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-xs font-bold text-slate-600">方案等級
            <select value={enterprise.plan_code} onChange={event => setEnterprise(prev => ({ ...prev, plan_code: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="">未設定</option>{PLAN_OPTIONS.map(plan => <option key={plan.value} value={plan.value}>{plan.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">企業狀態
            <select value={enterprise.status} onChange={event => setEnterprise(prev => ({ ...prev, status: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="pending">待啟用</option><option value="啟用中">啟用中</option><option value="試用中">試用中</option><option value="暫停">暫停</option><option value="終止">終止</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">付款方式
            <select value={enterprise.pay_mode} onChange={event => setEnterprise(prev => ({ ...prev, pay_mode: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="annual">年繳</option><option value="semi">半年繳</option><option value="quarterly">季繳</option>
            </select>
          </label>
          {([ ["member_limit", "授權人數上限"], ["used_count", "REIBI 已用人數"], ["contract_years", "合約年限（年）"] ] as const).map(([key, label]) => <label key={key} className="text-xs font-bold text-slate-600">{label}<input type="number" min={key === "contract_years" ? 1 : 0} value={enterprise[key]} onChange={event => setEnterprise(prev => ({ ...prev, [key]: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>)}
          <label className="text-xs font-bold text-slate-600">合約開始日<input type="date" value={enterprise.contract_start} onChange={event => setEnterprise(prev => ({ ...prev, contract_start: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-bold text-slate-600">合約結束日<input type="date" value={enterprise.contract_end} onChange={event => setEnterprise(prev => ({ ...prev, contract_end: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-bold text-slate-600">負責顧問<input value={enterprise.consultant} onChange={event => setEnterprise(prev => ({ ...prev, consultant: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-bold text-slate-600">接案經銷商代碼<input value={enterprise.partner_code} onChange={event => setEnterprise(prev => ({ ...prev, partner_code: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-bold text-slate-600">合作夥伴分潤％<input type="number" min={0} max={100} step="0.01" value={enterprise.referral_percent} onChange={event => setEnterprise(prev => ({ ...prev, referral_percent: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
        </div>

        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4">
            <div className="font-black text-teal-900">A 層｜軟體平台年授權</div>
            <label className="mt-3 block text-xs font-bold text-slate-600">實際年費（元）<input type="number" min={0} value={enterprise.a_layer_fee} onChange={event => setEnterprise(prev => ({ ...prev, a_layer_fee: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            {PLAN_OPTIONS.find(plan => plan.value === enterprise.plan_code) && <button type="button" onClick={() => { const plan = PLAN_OPTIONS.find(item => item.value === enterprise.plan_code)!; setEnterprise(prev => ({ ...prev, a_layer_fee: plan.annualFee, devices: { ...plan.devices } })); }} className="mt-2 text-xs font-bold text-teal-700">套用 Artifact 方案預設費用與設備</button>}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="font-black text-amber-900">B 層｜常駐設備</div>
            <div className="mt-3 grid gap-2">{DEVICE_FIELDS.map(([key, label, price]) => <label key={key} className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600"><span>{label}<span className="ml-1 font-normal text-slate-400">NT${price.toLocaleString()}</span></span><input type="number" min={0} value={enterprise.devices[key]} onChange={event => setEnterprise(prev => ({ ...prev, devices: { ...prev.devices, [key]: Number(event.target.value) } }))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" /></label>)}</div>
            <label className="mt-3 block text-xs font-bold text-slate-600">B 層實際費用（元）<input type="number" min={0} value={enterprise.b_layer_fee} onChange={event => setEnterprise(prev => ({ ...prev, b_layer_fee: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
            <button type="button" onClick={() => setEnterprise(prev => ({ ...prev, b_layer_fee: DEVICE_FIELDS.reduce((sum, [key, , price]) => sum + prev.devices[key] * price, 0) }))} className="mt-2 text-xs font-bold text-amber-800">依 Artifact 設備定價計算</button>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
            <div className="font-black text-purple-900">C 層｜高管健促服務</div>
            <label className="mt-3 block text-xs font-bold text-slate-600">年度服務費（元）<input type="number" min={0} value={enterprise.c_layer_fee} onChange={event => setEnterprise(prev => ({ ...prev, c_layer_fee: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
            <div className="font-black text-indigo-900">D 層｜健康識能環境佈置</div>
            <div className="mt-3 grid grid-cols-2 gap-2">{D_LAYER_FIELDS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={enterprise.d_layer_config[key]} onChange={event => setEnterprise(prev => ({ ...prev, d_layer_config: { ...prev.d_layer_config, [key]: event.target.checked } }))} /> {label}</label>)}</div>
            <label className="mt-3 block text-xs font-bold text-slate-600">D 層確認費用（元）<input type="number" min={0} value={enterprise.d_layer_fee} onChange={event => setEnterprise(prev => ({ ...prev, d_layer_fee: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></label>
          </div>
        </div>
        <button onClick={saveEnterprise} disabled={loading || !enterprise.org_name} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="w-4 h-4" /> 儲存方案與合約</button>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-black text-slate-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-teal-700" /> 企業服務場域</h2>
            <p className="text-xs text-slate-500 mt-1">管理總公司、廠區或其他健促服務地點；報價與工單稍後會直接引用這些場域。</p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{sites.length} 個場域</span>
        </div>

        {!overview?.enterprise ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">請先儲存企業基本資料，再新增服務場域。</div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              <label className="text-xs font-bold text-slate-600">場域名稱 *
                <input value={siteDraft.label} onChange={event => setSiteDraft(prev => ({ ...prev, label: event.target.value }))} placeholder="例如：總公司／一廠" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">地址
                <input value={siteDraft.address} onChange={event => setSiteDraft(prev => ({ ...prev, address: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">備註
                <input value={siteDraft.note} onChange={event => setSiteDraft(prev => ({ ...prev, note: event.target.value }))} placeholder="例如：設備展示區" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">排序
                <input type="number" min={0} value={siteDraft.sort_order} onChange={event => setSiteDraft(prev => ({ ...prev, sort_order: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button onClick={saveSite} disabled={loading || !siteDraft.label.trim()} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{editingSiteId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editingSiteId ? "更新場域" : "新增場域"}</button>
                {editingSiteId && <button onClick={() => { setEditingSiteId(null); setSiteDraft({ ...EMPTY_SITE }); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600">取消編輯</button>}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {sites.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">尚未建立場域。</div>}
              {sites.map(site => (
                <div key={site.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div><div className="font-bold text-slate-800">{site.label}</div><div className="text-xs text-slate-500 mt-1">{site.address || "未填地址"}{site.note ? ` · ${site.note}` : ""}</div></div>
                  <div className="flex gap-2">
                    <button onClick={() => editSite(site)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><Pencil className="w-3.5 h-3.5" /> 編輯</button>
                    <button onClick={() => deleteSite(site)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><Trash2 className="w-3.5 h-3.5" /> 刪除</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-black text-slate-800 flex items-center gap-2"><Network className="w-5 h-5 text-indigo-700" /> 四層部門架構</h2>
            <p className="text-xs text-slate-500 mt-1">最多四層；上層關係由後端重新計算，避免跨企業連結、循環與誤刪整個部門樹。</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{departments.length} 個部門</span>
        </div>

        {!overview?.enterprise ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">請先儲存企業基本資料，再建立部門架構。</div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
              <label className="text-xs font-bold text-slate-600">部門名稱 *
                <input value={departmentDraft.name} onChange={event => setDepartmentDraft(prev => ({ ...prev, name: event.target.value }))} placeholder="例如：人力資源部" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-600">上層部門
                <select value={departmentDraft.parent_id} onChange={event => setDepartmentDraft(prev => ({ ...prev, parent_id: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <option value="">無（建立第一層）</option>
                  {departments.filter(item => item.hierarchy_level < 4 && item.id !== editingDepartmentId).map(item => <option key={item.id} value={item.id}>{"　".repeat(Math.max(0, item.hierarchy_level - 1))}{item.name}（L{item.hierarchy_level}）</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">排序
                <input type="number" min={0} value={departmentDraft.sort_order} onChange={event => setDepartmentDraft(prev => ({ ...prev, sort_order: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600"><input type="checkbox" checked={departmentDraft.is_active} onChange={event => setDepartmentDraft(prev => ({ ...prev, is_active: event.target.checked }))} /> 啟用此部門</label>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button onClick={saveDepartment} disabled={loading || !departmentDraft.name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{editingDepartmentId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editingDepartmentId ? "更新部門" : "新增部門"}</button>
                {editingDepartmentId && <button onClick={() => { setEditingDepartmentId(null); setDepartmentDraft({ ...EMPTY_DEPARTMENT }); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600">取消編輯</button>}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {departments.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">尚未建立部門；先建立一個第一層部門。</div>}
              {departments.map(department => (
                <div key={department.id} style={{ marginLeft: `${Math.max(0, department.hierarchy_level - 1) * 18}px` }} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">L{department.hierarchy_level}</span><div><div className="font-bold text-slate-800">{department.name}</div><div className="text-xs text-slate-500 mt-1">{department.is_active ? "啟用中" : "已停用"} · 直接 {department.direct_member_count || 0} 人 · 含下層 {department.member_count || 0} 人</div></div></div>
                  <div className="flex gap-2">
                    <button onClick={() => editDepartment(department)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><Pencil className="w-3.5 h-3.5" /> 編輯</button>
                    <button onClick={() => deleteDepartment(department)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><Trash2 className="w-3.5 h-3.5" /> 刪除</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-black text-slate-800 mb-1">Artifact 搬移預檢</h2>
        <p className="text-xs text-slate-500 mb-5">只解析、分類並檢查 JSON，不會寫入資料庫；session、PIN、token 與暫存 handoff 會被排除。</p>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-xs font-bold text-slate-600">Artifact
            <select value={source} onChange={event => { setSource(event.target.value as ArtifactSource); setValidation(null); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white">
              <option value="main">主平台</option><option value="l5">L5 後台</option><option value="quote">報價／合約</option><option value="workorder">工單</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">來源版本
            <input value={version} onChange={event => setVersion(event.target.value)} placeholder="例如 v10.3.34" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-600">JSON 匯出檔
            <input type="file" accept="application/json,.json" onChange={selectFile} className="mt-1 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-bold" />
          </label>
        </div>
        {fileName && <div className="mt-3 text-xs text-slate-500">已載入：{fileName}</div>}
        <button onClick={validateExport} disabled={loading || !exportPayload} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Upload className="w-4 h-4" /> 執行預檢</button>

        {validation && (
          <div className="mt-6 border-t border-slate-100 pt-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black">{validation.record_count}</div><div className="text-xs text-slate-500">可處理記錄</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black">{validation.skipped_count}</div><div className="text-xs text-slate-500">排除 keys</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black">{Object.keys(validation.storage_keys).length}</div><div className="text-xs text-slate-500">storage keys</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-lg font-black">{(validation.byte_size / 1024).toFixed(1)} KB</div><div className="text-xs text-slate-500">解析大小</div></div>
            </div>
            <div><div className="text-xs font-bold text-slate-600 mb-2">目標資料表</div><div className="flex flex-wrap gap-2">{Object.entries(validation.target_counts).map(([table, count]) => <span key={table} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">{table}: {count}</span>)}</div></div>
            {validation.warnings.length > 0 && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4"><div className="text-xs font-bold text-amber-800 mb-2">注意事項</div><ul className="list-disc pl-5 text-xs text-amber-700 space-y-1">{validation.warnings.slice(0, 20).map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}
            <div className="rounded-xl bg-slate-900 p-3 text-[11px] text-slate-300 font-mono break-all">SHA-256: {validation.sha256}</div>
            <p className="text-xs text-slate-500">正式跨企業匯入尚未在網頁開放；後端只允許未來的 <code>reibi_super</code> 身分執行。</p>
          </div>
        )}
      </section>
    </div>
  );
}
