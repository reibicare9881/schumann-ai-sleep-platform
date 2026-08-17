"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bell, ClipboardList, Copy, FileSpreadsheet, KeyRound, MessageCircle, RefreshCw, Send, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type Row = Record<string, any>;
type Tab = "tickets" | "announcements" | "departments" | "messages" | "access" | "manual";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-600";
const primary = "inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50";

function unwrap(response: any, fallback: string) {
  if (response?.status !== "success") throw new Error(response?.message || fallback);
  return response.data;
}

export default function ReibiServicePage() {
  const { session } = useAuth();
  const isSuper = session?.systemRole === "reibi_super";
  const isServiceManager = ["reibi_super", "reibi_cs"].includes(session?.systemRole || "");
  const isPartner = ["partner_primary", "partner_sub"].includes(session?.systemRole || "");
  const isManager = ["admin", "reibi_super"].includes(session?.systemRole || "");
  const allowed = Boolean(session && (isServiceManager || can(session.systemRole, "service_center")));
  const [tab, setTab] = useState<Tab>("tickets");
  const [catalog, setCatalog] = useState<Row>({});
  const [tickets, setTickets] = useState<Row[]>([]);
  const [serviceScope, setServiceScope] = useState<Row>({ enterprises: [], partner_codes: [] });
  const [announcements, setAnnouncements] = useState<Row[]>([]);
  const [messages, setMessages] = useState<Row[]>([]);
  const [accessRequests, setAccessRequests] = useState<Row[]>([]);
  const [ticket, setTicket] = useState({ enterprise_id: "", ticket_type: "服務申請", priority: "一般", preferred_date: "", note: "", contact_email: "" });
  const [announcement, setAnnouncement] = useState({ title: "", body: "", event_date: "", quota: "", status: "draft", template_code: "" });
  const [messageDraft, setMessageDraft] = useState({ target_type: "specific", target_artifact_id: "", target_name: "", template_code: "custom", message: "", delivery_mode: "manual" });
  const [accessDraft, setAccessDraft] = useState({ requester_name: "", requester_email: "", request_type: "credential_recovery", requested_role: "", reason: "" });
  const [csvText, setCsvText] = useState("");
  const [preflight, setPreflight] = useState<Row | null>(null);
  const [architecture, setArchitecture] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = useCallback(async (task: () => Promise<any>, success = "") => {
    setLoading(true); setError(""); setMessage("");
    try { const data = await task(); if (success) setMessage(success); return data; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "操作失敗"); return null; }
    finally { setLoading(false); }
  }, []);

  const load = useCallback(async () => {
    if (!allowed) return;
    await run(async () => {
      const [catalogResponse, scopeResponse, ticketsResponse, announcementsResponse] = await Promise.all([
        API.getReibiServiceCatalog(), API.getReibiServiceScope(), API.listReibiServiceTickets(), API.listReibiAnnouncements(),
      ]);
      setCatalog(unwrap(catalogResponse, "無法讀取服務設定"));
      const nextScope = unwrap(scopeResponse, "無法讀取服務企業範圍") || { enterprises: [], partner_codes: [] };
      setServiceScope(nextScope);
      if (nextScope.requires_enterprise && nextScope.enterprises?.length === 1) {
        setTicket(current => ({ ...current, enterprise_id: String(nextScope.enterprises[0].id) }));
      }
      setTickets(unwrap(ticketsResponse, "無法讀取服務案件") || []);
      setAnnouncements(unwrap(announcementsResponse, "無法讀取公告") || []);
      if (isManager) setArchitecture(unwrap(await API.getReibiArchitecture(), "無法讀取部門架構"));
      if (isSuper) {
        setMessages(unwrap(await API.listReibiMessages(), "無法讀取訊息記錄") || []);
        setAccessRequests(unwrap(await API.listReibiAccessRequests(), "無法讀取權限申請") || []);
      }
    });
  }, [allowed, isManager, isSuper, run]);

  useEffect(() => { void load(); }, [load]);
  if (!session) return null;
  if (!allowed) return <div className="mx-auto max-w-3xl p-8"><div className={card}>此帳號沒有服務中心權限。</div></div>;

  const submitTicket = () => run(async () => {
    unwrap(await API.createReibiServiceTicket({ ...ticket, enterprise_id: ticket.enterprise_id ? Number(ticket.enterprise_id) : null, preferred_date: ticket.preferred_date || null, contact_email: ticket.contact_email || null }), "無法建立服務案件");
    setTicket({ enterprise_id: "", ticket_type: "服務申請", priority: "一般", preferred_date: "", note: "", contact_email: "" }); await load();
  }, "服務案件已送出，REIBI 會在兩個工作天內回覆。");

  const tabs: Array<[Tab, string]> = [["tickets", "服務案件"], ["announcements", "公告與報名"],
    ...(isManager ? [["departments", "部門 CSV"] as [Tab, string]] : []),
    ...(isSuper ? [["messages", "LINE 佇列"] as [Tab, string]] : []),
    ["access", "權限申請"],
    ["manual", "手冊與安全"]];

  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-sky-700"><ArrowLeft className="h-4 w-4" /> 返回首頁</Link><h1 className="mt-2 text-2xl font-black text-slate-900">REIBI 服務與整合中心</h1><p className="text-sm text-slate-500">服務請求、公告名額、部門匯入與可稽核的外部訊息。</p></div>
      <button className={secondary} onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />重新整理</button>
    </div>
    {(message || error) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}
    <div className="flex flex-wrap gap-2">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={tab === key ? primary : secondary}>{label}</button>)}</div>

    {tab === "tickets" && <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <form className={card} onSubmit={event => { event.preventDefault(); void submitTicket(); }}><h2 className="flex items-center gap-2 font-black"><ClipboardList className="h-5 w-5 text-sky-700" />新增服務案件</h2>
        {serviceScope.requires_enterprise && <label className="mt-4 block text-xs font-bold">服務企業<select required className={input} value={ticket.enterprise_id} onChange={e => setTicket({ ...ticket, enterprise_id: e.target.value })}><option value="">請選擇企業</option>{(serviceScope.enterprises || []).map((row: Row) => <option key={row.id} value={row.id}>{row.org_name}（{row.org_code}）</option>)}</select></label>}
        {isPartner && <div className="mt-3 rounded-xl bg-sky-50 p-3 text-xs text-sky-800">可服務範圍：{(serviceScope.partner_codes || []).join("、") || "尚未取得經銷商範圍"}。案件企業由伺服器再次驗證。</div>}
        <label className="mt-4 block text-xs font-bold">類型<select className={input} value={ticket.ticket_type} onChange={e => setTicket({ ...ticket, ticket_type: e.target.value })}>{(catalog.ticket_types || []).map((value: string) => <option key={value}>{value}</option>)}</select></label>
        <label className="mt-3 block text-xs font-bold">優先級<select className={input} value={ticket.priority} onChange={e => setTicket({ ...ticket, priority: e.target.value })}>{(catalog.ticket_priorities || []).map((value: string) => <option key={value}>{value}</option>)}</select></label>
        <label className="mt-3 block text-xs font-bold">希望日期<input type="date" className={input} value={ticket.preferred_date} onChange={e => setTicket({ ...ticket, preferred_date: e.target.value })} /></label>
        <label className="mt-3 block text-xs font-bold">聯絡 Email<input type="email" className={input} value={ticket.contact_email} onChange={e => setTicket({ ...ticket, contact_email: e.target.value })} /></label>
        <label className="mt-3 block text-xs font-bold">需求說明<textarea required rows={5} className={input} value={ticket.note} onChange={e => setTicket({ ...ticket, note: e.target.value })} /></label>
        <button className={`${primary} mt-4 w-full`} disabled={loading || (serviceScope.requires_enterprise && !ticket.enterprise_id)}>送出案件</button>
      </form>
      <div className="space-y-3">{tickets.map(row => <div key={row.id} className={card}><div className="flex justify-between gap-3"><div><b>{row.ticket_type}</b><div className="mt-1 text-xs text-slate-500">{row.reibi_enterprises?.org_name ? `${row.reibi_enterprises.org_name} · ` : ""}{row.preferred_date || "未指定日期"} · {row.priority}</div></div><span className="h-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">{row.status}</span></div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{row.note}</p>{row.response_note && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">回覆：{row.response_note}</div>}{isServiceManager && !["已完成", "已關閉"].includes(row.status) && <div className="mt-3 flex gap-2"><button className={secondary} onClick={() => void run(async () => { unwrap(await API.updateReibiServiceTicket(row.id, { status: "處理中" }), "更新失敗"); await load(); }, "案件已開始處理")}>開始處理</button><button className={primary} onClick={() => void run(async () => { unwrap(await API.updateReibiServiceTicket(row.id, { status: "已完成" }), "更新失敗"); await load(); }, "案件已完成")}>完成</button></div>}</div>)}{!tickets.length && <div className={card}>目前沒有服務案件。</div>}</div>
    </div>}

    {tab === "announcements" && <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      {isManager ? <form className={card} onSubmit={event => { event.preventDefault(); void run(async () => { unwrap(await API.createReibiAnnouncement({ ...announcement, quota: announcement.quota === "" ? null : Number(announcement.quota), event_date: announcement.event_date || null, template_code: announcement.template_code || null }), "建立公告失敗"); setAnnouncement({ title: "", body: "", event_date: "", quota: "", status: "draft", template_code: "" }); await load(); }, "公告已建立"); }}><h2 className="flex items-center gap-2 font-black"><Bell className="h-5 w-5 text-amber-700" />新增公告</h2><label className="mt-4 block text-xs font-bold">範本<select className={input} value={announcement.template_code} onChange={e => setAnnouncement({ ...announcement, template_code: e.target.value })}><option value="">不使用範本</option>{(catalog.announcement_templates || []).map((row: Row) => <option key={row.code} value={row.code}>{row.label}</option>)}</select></label><label className="mt-3 block text-xs font-bold">標題<input required className={input} value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} /></label><label className="mt-3 block text-xs font-bold">內容<textarea required rows={5} className={input} value={announcement.body} onChange={e => setAnnouncement({ ...announcement, body: e.target.value })} /></label><div className="grid grid-cols-2 gap-2"><label className="mt-3 block text-xs font-bold">日期<input type="date" className={input} value={announcement.event_date} onChange={e => setAnnouncement({ ...announcement, event_date: e.target.value })} /></label><label className="mt-3 block text-xs font-bold">名額<input type="number" min="0" className={input} value={announcement.quota} onChange={e => setAnnouncement({ ...announcement, quota: e.target.value })} /></label></div><label className="mt-3 block text-xs font-bold">狀態<select className={input} value={announcement.status} onChange={e => setAnnouncement({ ...announcement, status: e.target.value })}><option value="draft">草稿</option><option value="published">發布</option><option value="closed">關閉</option></select></label><button className={`${primary} mt-4 w-full`}>儲存公告</button></form> : <div className={card}>以下為目前企業已發布的公告。</div>}
      <div className="space-y-3">{announcements.map(row => <div key={row.id} className={card}><div className="flex justify-between gap-3"><div><b>{row.title}</b><div className="text-xs text-slate-500">{row.event_date || "未指定日期"}</div></div><span className="text-xs font-bold">{row.registered_count || 0}/{row.quota ?? "不限"}</span></div><p className="mt-3 whitespace-pre-wrap text-sm">{row.body}</p>{!isManager && <button className={`${row.my_registration === "registered" ? secondary : primary} mt-3`} onClick={() => void run(async () => { if (row.my_registration === "registered") unwrap(await API.cancelReibiAnnouncement(row.id), "取消失敗"); else unwrap(await API.registerReibiAnnouncement(row.id), "報名失敗"); await load(); }, row.my_registration === "registered" ? "已取消報名" : "報名成功")}>{row.my_registration === "registered" ? "取消報名" : "我要報名"}</button>}</div>)}</div>
    </div>}

    {tab === "departments" && isManager && <div className="grid gap-5 lg:grid-cols-2"><div className={card}><h2 className="flex items-center gap-2 font-black"><FileSpreadsheet className="h-5 w-5 text-emerald-700" />部門 CSV 預檢與匯入</h2><p className="mt-2 text-xs text-slate-500">欄位：部門名稱、層級(1-4)、上層部門名稱、人數。正式匯入會以單一資料庫交易取代目前架構；失敗時保留原資料。</p><a className={`${secondary} mt-3`} href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/reibi/enterprise/departments/template`} onClick={event => { event.preventDefault(); const token = API.getSession()?.access_token; fetch(event.currentTarget.href, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => r.blob()).then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "reibi-departments.csv"; a.click(); URL.revokeObjectURL(url); }); }}>下載範本</a><textarea rows={13} className={`${input} font-mono text-xs`} placeholder="貼上 UTF-8 CSV 內容" value={csvText} onChange={e => { setCsvText(e.target.value); setPreflight(null); }} /><div className="mt-3 flex gap-2"><button className={secondary} onClick={() => void run(async () => setPreflight(unwrap(await API.preflightReibiDepartments(csvText), "預檢失敗")))}>預檢</button><button className={primary} disabled={!preflight?.valid} onClick={() => void run(async () => { unwrap(await API.importReibiDepartments(csvText), "匯入失敗"); setPreflight(null); await load(); }, "部門架構已原子匯入")}>確認匯入</button></div>{preflight && <div className={`mt-3 rounded-xl p-3 text-sm ${preflight.valid ? "bg-emerald-50" : "bg-red-50"}`}>{preflight.valid ? `可匯入 ${preflight.rows.length} 個部門，聲明人數 ${preflight.declared_total}` : (preflight.errors || []).join("；")}</div>}</div><div className={card}><h2 className="font-black">架構確認資料</h2><div className="mt-3 text-sm">企業：{architecture?.enterprise?.org_name || "—"}<br />代碼：{architecture?.enterprise?.org_code || "—"}<br />平台帳號：{architecture?.registered_count ?? "—"}</div><div className="mt-4 space-y-2">{(architecture?.departments || []).map((row: Row) => <div key={row.id} className="rounded-xl bg-slate-50 p-3 text-sm">L{row.hierarchy_level} · {row.name}</div>)}</div><button className={`${secondary} mt-4`} onClick={() => window.print()}>列印架構確認單</button></div></div>}

    {tab === "messages" && isSuper && <div className="grid gap-5 lg:grid-cols-[360px_1fr]"><form className={card} onSubmit={event => { event.preventDefault(); void run(async () => { unwrap(await API.createReibiMessage(messageDraft), "建立訊息失敗"); setMessageDraft({ target_type: "specific", target_artifact_id: "", target_name: "", template_code: "custom", message: "", delivery_mode: "manual" }); await load(); }, "訊息草稿已建立"); }}><h2 className="flex items-center gap-2 font-black"><MessageCircle className="h-5 w-5 text-green-700" />LINE 訊息草稿</h2><label className="mt-4 block text-xs font-bold">範本<select className={input} value={messageDraft.template_code} onChange={e => setMessageDraft({ ...messageDraft, template_code: e.target.value })}>{(catalog.message_templates || []).map((row: Row) => <option key={row.code} value={row.code}>{row.label}</option>)}</select></label><label className="mt-3 block text-xs font-bold">對象名稱<input className={input} value={messageDraft.target_name} onChange={e => setMessageDraft({ ...messageDraft, target_name: e.target.value })} /></label><label className="mt-3 block text-xs font-bold">LINE 目標 ID<input className={input} value={messageDraft.target_artifact_id} onChange={e => setMessageDraft({ ...messageDraft, target_artifact_id: e.target.value })} /></label><label className="mt-3 block text-xs font-bold">模式<select className={input} value={messageDraft.delivery_mode} onChange={e => setMessageDraft({ ...messageDraft, delivery_mode: e.target.value })}><option value="manual">人工複製</option><option value="provider_api">LINE API</option></select></label><label className="mt-3 block text-xs font-bold">訊息<textarea required rows={7} className={input} value={messageDraft.message} onChange={e => setMessageDraft({ ...messageDraft, message: e.target.value })} /></label><button className={`${primary} mt-4 w-full`}>建立草稿</button></form><div className="space-y-3">{messages.map(row => <div key={row.id} className={card}><div className="flex justify-between"><b>{row.target_name || row.target_type}</b><span className="text-xs font-bold">{row.status}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{row.message}</p><div className="mt-3 flex gap-2"><button className={secondary} onClick={() => void navigator.clipboard.writeText(row.message)}><Copy className="h-4 w-4" />複製</button>{row.status === "draft" && <button className={primary} onClick={() => void run(async () => { unwrap(await API.dispatchReibiMessage(row.id), "發送失敗"); await load(); }, row.delivery_mode === "manual" ? "已標記為人工複製" : "LINE 已送出") }><Send className="h-4 w-4" />{row.delivery_mode === "manual" ? "標記人工複製" : "送出"}</button>}</div></div>)}</div></div>}

    {tab === "access" && isSuper && <div className={card}><h2 className="flex items-center gap-2 font-black"><KeyRound className="h-5 w-5 text-purple-700" />權限與憑證復原佇列</h2><p className="mt-2 text-xs text-slate-500">此流程不顯示、不傳送也不保存明文 PIN。完成前必須由內部人員以既定通道核驗身分。</p><div className="mt-4 space-y-3">{accessRequests.map(row => <div key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><b>{row.requester_name} · {row.request_type}</b><span className="text-xs font-bold">{row.status}</span></div><div className="mt-1 text-xs text-slate-500">{row.org_code || "無企業"} · {row.requester_email}</div><p className="mt-2 text-sm">{row.reason}</p>{row.status === "pending" && <button className={`${primary} mt-3`} onClick={() => { const note = window.prompt("請輸入核驗方式與處理備註"); if (note) void run(async () => { unwrap(await API.reviewReibiAccessRequest(row.id, { status: "verified", verification_method: note, resolution_note: note }), "處理失敗"); await load(); }, "已標記為身分核驗完成"); }}>記錄核驗</button>}</div>)}</div></div>}

    {tab === "access" && !isSuper && <form className={`${card} max-w-xl`} onSubmit={event => { event.preventDefault(); void run(async () => { unwrap(await API.createReibiAccessRequest(accessDraft), "送出申請失敗"); setAccessDraft({ requester_name: "", requester_email: "", request_type: "credential_recovery", requested_role: "", reason: "" }); }, "申請已送出；不會透過畫面傳送明文 PIN。"); }}><h2 className="flex items-center gap-2 font-black"><KeyRound className="h-5 w-5" />權限協助申請</h2><p className="mt-2 text-xs text-slate-500">內部人員會透過既定聯絡方式核驗身分。本表單不接受密碼或 PIN。</p><label className="mt-4 block text-xs font-bold">姓名<input required className={input} value={accessDraft.requester_name} onChange={e => setAccessDraft({ ...accessDraft, requester_name: e.target.value })} /></label><label className="mt-3 block text-xs font-bold">Email<input required type="email" className={input} value={accessDraft.requester_email} onChange={e => setAccessDraft({ ...accessDraft, requester_email: e.target.value })} /></label><label className="mt-3 block text-xs font-bold">申請類型<select className={input} value={accessDraft.request_type} onChange={e => setAccessDraft({ ...accessDraft, request_type: e.target.value })}><option value="credential_recovery">登入憑證復原</option><option value="permission_change">權限變更</option><option value="pin_retirement">舊 PIN 停用</option></select></label><label className="mt-3 block text-xs font-bold">希望角色（選填）<input className={input} value={accessDraft.requested_role} onChange={e => setAccessDraft({ ...accessDraft, requested_role: e.target.value })} /></label><label className="mt-3 block text-xs font-bold">原因（請勿填密碼或 PIN）<textarea required rows={5} className={input} value={accessDraft.reason} onChange={e => setAccessDraft({ ...accessDraft, reason: e.target.value })} /></label><button className={`${primary} mt-4 w-full`}>送出申請</button></form>}

    {tab === "manual" && <div className="grid gap-5 md:grid-cols-2"><div className={card}><h2 className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5 text-emerald-700" />隱私與安全邊界</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700"><li>瀏覽器不持有 Supabase service-role 金鑰。</li><li>權限復原採人工身分核驗，不回傳既有 PIN。</li><li>匯款辨識只用 Gemini；信心不足會進入人工覆核。</li><li>LINE 未設定憑證時只記錄人工複製，不宣稱已送達。</li></ul><Link href="/privacy" className={`${secondary} mt-4`}>查看隱私政策</Link></div><div className={card}><h2 className="font-black">版本與操作手冊</h2><div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">API {catalog.version?.api || "—"}<br />移植批次：Batch {catalog.version?.batch || "—"}<br />Main Artifact：{catalog.version?.artifact_main || "—"}<br />L5 Artifact：{catalog.version?.artifact_l5 || "—"}</div><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700"><li>新案件由使用者送出，內部管理者依狀態處理。</li><li>公告發布後，報名名額由資料庫鎖定避免超收。</li><li>部門 CSV 必須先預檢，確認後才以單一交易匯入。</li><li>外部訊息必須保留草稿、送出或失敗結果。</li></ol></div></div>}
  </main>;
}
