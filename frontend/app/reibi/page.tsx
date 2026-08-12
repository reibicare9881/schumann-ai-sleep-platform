"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, FileCheck2, FileText, HardHat, RefreshCw, Save, Upload } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type ArtifactSource = "main" | "l5" | "quote" | "workorder";

type Overview = {
  enterprise: null | Record<string, any>;
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
  contract_start: "",
  contract_end: "",
  pay_mode: "annual",
};

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
      setMessage("企業資料已儲存至本機 API 所連接的 Supabase。");
      await loadOverview();
    } else {
      setError(response.message || "企業資料儲存失敗");
    }
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
        <button onClick={loadOverview} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 重新整理
        </button>
      </div>

      {(message || error) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>{error || message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(item => <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-4"><div className="text-teal-700 mb-3">{item.icon}</div><div className="text-xl font-black text-slate-800">{item.value}</div><div className="text-xs text-slate-500 mt-1">{item.label}</div></div>)}
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-black text-slate-800 mb-1">企業基本資料</h2>
        <p className="text-xs text-slate-500 mb-5">單位代碼由登入 Token 決定，前端不能指定或修改其他企業。</p>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ["org_name", "企業名稱"], ["org_alias", "企業簡稱"], ["ubn", "統一編號"], ["industry", "產業"],
            ["contact_name", "聯絡人"], ["phone", "電話"], ["email", "Email"], ["address", "地址"],
            ["plan_code", "方案"], ["member_limit", "服務人數上限"], ["contract_start", "合約開始日"], ["contract_end", "合約結束日"],
          ].map(([key, label]) => (
            <label key={key} className="block text-xs font-bold text-slate-600">{label}
              <input
                type={key.includes("date") ? "date" : key === "member_limit" ? "number" : "text"}
                value={(enterprise as any)[key] ?? ""}
                min={key === "member_limit" ? 0 : undefined}
                onChange={event => setEnterprise(prev => ({ ...prev, [key]: key === "member_limit" ? Number(event.target.value) : event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </label>
          ))}
        </div>
        <button onClick={saveEnterprise} disabled={loading || !enterprise.org_name} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="w-4 h-4" /> 儲存企業資料</button>
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
