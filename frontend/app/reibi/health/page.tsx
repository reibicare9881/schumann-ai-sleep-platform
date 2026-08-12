"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Printer, RefreshCw, Save, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/AuthProvider";
import API from "@/lib/api";
import { can } from "@/lib/config";

type Row = Record<string, any>;
type Tab = "actions" | "diary" | "assessments" | "vitals" | "timeline" | "feedback" | "eap" | "aggregate" | "ohs" | "access";

const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";
const primaryClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const ghostClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50";
const today = new Date().toISOString().slice(0, 10);
const currentQuarter = `${today.slice(0, 4)}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;

const ASSESSMENTS: Record<string, { label: string; max: number; questions: string[] }> = {
  phq4: { label: "PHQ-4", max: 3, questions: ["神經緊張、焦慮或緊繃", "無法停止或控制擔憂", "失去興趣或樂趣", "心情低落、沮喪或絕望"] },
  pss4: { label: "PSS-4", max: 4, questions: ["預期外事件使您心煩意亂", "無法控制重要事情", "有自信能處理個人問題", "事情順心如意"] },
  mind3: { label: "正念", max: 3, questions: ["專注當下", "觀察情緒後再反應", "留意呼吸或身體感受"] },
  ow: { label: "過勞", max: 4, questions: ["工作與加班時數", "無法休息天數", "工作造成睡眠不足", "過勞身體警訊", "工作量與期限壓力", "工作自主性", "下班後擔憂工作", "私人生活受影響"] },
  bsrs5: { label: "BSRS-5", max: 4, questions: ["緊張不安", "容易苦惱或動怒", "憂鬱、心情低落", "覺得比不上別人", "睡眠困難、易醒或早醒"] },
};
const MSK = [["neck", "頸部"], ["back_up", "上背"], ["back_low", "下背"], ["shoulder_l", "左肩"], ["shoulder_r", "右肩"], ["elbow_l", "左手肘/前臂"], ["elbow_r", "右手肘/前臂"], ["wrist_l", "左手/手腕"], ["wrist_r", "右手/手腕"], ["hip_l", "左臀/大腿"], ["hip_r", "右臀/大腿"], ["knee_l", "左膝"], ["knee_r", "右膝"], ["ankle_l", "左腳踝/腳"], ["ankle_r", "右腳踝/腳"]];
const VIOLENCE = [["violence", "職場暴力"], ["harass", "性騷擾"], ["stalk", "跟蹤騷擾"], ["discrim", "就業歧視"]];
const RISK_FACTORS = ["長期加班", "輪班或夜班", "三高或心臟病史", "重大傷病或喪親", "職場人際緊張", "績效壓力", "心悸胸痛或暈眩", "久坐缺乏運動"];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-xs font-bold text-slate-600">{label}{children}</label>;
}

function Scale({ value, max, onChange }: { value: number | undefined; max: number; onChange: (value: number) => void }) {
  return <div className="mt-2 flex flex-wrap gap-2">
    {Array.from({ length: max + 1 }, (_, score) => <button key={score} type="button" onClick={() => onChange(score)} className={`h-9 w-9 rounded-lg border text-sm font-bold ${value === score ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200"}`}>{score}</button>)}
  </div>;
}

export default function ReibiHealthPage() {
  const { session } = useAuth();
  const personal = Boolean(session && can(session.systemRole, "health_self"));
  const manager = Boolean(session && can(session.systemRole, "manage_ohs"));
  const occupational = Boolean(session && can(session.systemRole, "oh_interview"));
  const aggregateViewer = Boolean(session && can(session.systemRole, "health_aggregate"));
  const [tab, setTab] = useState<Tab>(personal ? "actions" : occupational ? "ohs" : "aggregate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actions, setActions] = useState<Row>({ categories: {}, checkins: [], balance: 0 });
  const [points, setPoints] = useState<Row>({ balance: 0, ledger: [] });
  const [diaryKind, setDiaryKind] = useState<"sleep" | "pain">("sleep");
  const [diaries, setDiaries] = useState<Row[]>([]);
  const [sleep, setSleep] = useState({ entry_date: today, bed_time: "23:00", sleep_latency_minutes: 20, night_awakenings: 0, wake_time: "07:00", quality: 3 });
  const [pain, setPain] = useState({ entry_date: today, level: 0, body_locations: [] as string[], times: [] as string[], triggers: [] as string[], relief: [] as string[], work_impact: 0 });
  const [assessmentType, setAssessmentType] = useState("phq4");
  const [answers, setAnswers] = useState<number[]>([]);
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [screened, setScreened] = useState(false);
  const [suicideIdeation, setSuicideIdeation] = useState(0);
  const [assessments, setAssessments] = useState<Row[]>([]);
  const [assessmentReminders, setAssessmentReminders] = useState<Row[]>([]);
  const [mhi, setMhi] = useState<Row | null>(null);
  const [vitals, setVitals] = useState<Row>({ health_status: "none", systolic: "", diastolic: "", fasting_glucose: "", ldl: "", height_cm: "", weight_kg: "", waist_cm: "", department_key: session?.dept || "", department_consent: false });
  const [timeline, setTimeline] = useState<Row[]>([]);
  const [curve, setCurve] = useState<Row[]>([]);
  const [feedback, setFeedback] = useState({ period_key: currentQuarter, satisfaction_score: 1, nps_score: 0, free_text: "" });
  const [eap, setEap] = useState<Row[]>([]);
  const [eapDraft, setEapDraft] = useState({ category_code: "B", title: "", description: "", phone: "", url: "", is_emergency: false, is_active: true, sort_order: 0 });
  const [activity, setActivity] = useState<Row>({ counts: {} });
  const [vitalAggregate, setVitalAggregate] = useState<Row | null>(null);
  const [feedbackAggregate, setFeedbackAggregate] = useState<Row | null>(null);
  const [ohsType, setOhsType] = useState(occupational ? "interview" : "hazard");
  const [ohsRows, setOhsRows] = useState<Row[]>([]);
  const [ohsSnapshot, setOhsSnapshot] = useState<Row | null>(null);
  const [ohs, setOhs] = useState<Row>({ status: "計畫中", risk_level: "medium", owner: "", due_date: "", verified_at: "", title: "", details: "", employee_key: "", severity: "medium", frequency: "low", interviewer_role: "doctor", score: "", follow_date: "", version: "1.0" });
  const [occupationalPin, setOccupationalPin] = useState("");
  const [rosterVisible, setRosterVisible] = useState(false);

  const unwrap = (response: any, fallback: string) => {
    if (response.status !== "success") throw new Error(response.message || fallback);
    return response.data;
  };
  const run = async (task: () => Promise<any>, success?: string) => {
    setLoading(true); setError(""); setMessage("");
    try { const data = unwrap(await task(), success || "操作失敗"); if (success) setMessage(success); return data; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "操作失敗"); return null; }
    finally { setLoading(false); }
  };

  const loadPersonal = async () => {
    if (!personal) return;
    const results: any[] = await Promise.all([API.getReibiHealthActions(), API.getReibiPoints(), API.listReibiHealthAssessments(), API.getReibiMentalHealthIndex(), API.getReibiVitals(), API.getReibiHealthTimeline(), API.listReibiEapResources(), API.getReibiAssessmentReminders()]);
    setActions(unwrap(results[0], "無法讀取行動"));
    setPoints(unwrap(results[1], "無法讀取積分"));
    setAssessments(unwrap(results[2], "無法讀取評估") || []);
    setMhi(unwrap(results[3], "無法讀取 MHI"));
    const latestVitals = unwrap(results[4], "無法讀取三高資料");
    if (latestVitals) setVitals((old: Row) => ({ ...old, ...latestVitals }));
    const timelineData = unwrap(results[5], "無法讀取時間軸") || { events: [], curve: [] };
    setTimeline(timelineData.events || []); setCurve(timelineData.curve || []);
    setEap(unwrap(results[6], "無法讀取 EAP") || []);
    setAssessmentReminders(unwrap(results[7], "無法讀取評估提醒") || []);
  };
  const loadManagement = async () => {
    if (manager || aggregateViewer) {
      const jobs: Promise<any>[] = [API.getReibiVitalAggregate(), API.getReibiFeedbackAggregate(currentQuarter)];
      if (manager) jobs.push(API.getReibiAssessmentActivity());
      const results: any[] = await Promise.all(jobs);
      setVitalAggregate(unwrap(results[0], "無法讀取三高彙整"));
      setFeedbackAggregate(unwrap(results[1], "無法讀取回饋彙整"));
      if (manager) setActivity(unwrap(results[2], "無法讀取職安活躍度"));
    }
    if (manager || occupational) {
      const response: any = await API.listReibiOhs(occupational ? "interview" : ohsType);
      setOhsRows(unwrap(response, "無法讀取職安資料") || []);
    }
    if (manager) {
      const [resourceResponse, snapshotResponse]: any[] = await Promise.all([
        API.listReibiEapResources(), API.getReibiOhsSnapshot(),
      ]);
      setEap(unwrap(resourceResponse, "無法讀取 EAP") || []);
      setOhsSnapshot(unwrap(snapshotResponse, "無法讀取 OHS 計畫快照"));
    }
  };
  const reload = async () => {
    setLoading(true); setError("");
    try { await loadPersonal(); await loadManagement(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "讀取失敗"); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (session) void reload(); }, [session?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (manager || occupational) void loadManagement(); }, [ohsType]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!personal || tab !== "diary") return;
    void run(() => API.getReibiDiary(diaryKind)).then(data => data && setDiaries(data));
  }, [diaryKind, tab, personal]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = useMemo<Array<[Tab, string]>>(() => [
    ...(personal ? [["actions", "行動與積分"], ["diary", "健康日誌"], ["assessments", "心理與職安問卷"], ["vitals", "三高／BMI"], ["timeline", "888 時間軸"], ["feedback", "使用回饋"], ["eap", "EAP 資源"]] as Array<[Tab, string]> : []),
    ...(aggregateViewer ? [["aggregate", "去識別化彙整"]] as Array<[Tab, string]> : []),
    ...(manager || occupational ? [["ohs", occupational ? "面談記錄" : "OHS 計畫"]] as Array<[Tab, string]> : []),
    ...(manager ? [["access", "臨場醫護設定"]] as Array<[Tab, string]> : []),
  ], [personal, manager, occupational, aggregateViewer]);

  if (!session) return null;
  if (!tabs.length) return <main className="p-8"><Card className="mx-auto max-w-xl text-center"><ShieldCheck className="mx-auto h-10 w-10 text-slate-400" /><h1 className="mt-3 text-xl font-black">沒有 Batch D 使用權限</h1></Card></main>;

  const selectAssessment = (kind: string) => { setAssessmentType(kind); setAnswers([]); setRiskFactors([]); setScreened(false); setSuicideIdeation(0); };
  const assessmentPairs = assessmentType === "msk" ? MSK : assessmentType === "violence" ? VIOLENCE : null;
  const submitAssessment = async () => {
    const value = assessmentPairs ? Object.fromEntries(assessmentPairs.map(([key], index) => [key, answers[index] ?? 0])) : answers;
    const payload: Row = { assessment_type: assessmentType, answers: value, risk_factors: riskFactors };
    if (assessmentType === "msk") payload.screened = screened;
    if (assessmentType === "bsrs5") payload.suicide_ideation = suicideIdeation;
    const data = await run(() => API.submitReibiHealthAssessment(payload), "評估已完成");
    if (data) { if (data.emergency) setMessage("請立即尋求專業協助：安心專線 1925；若有立即危險請撥 119。"); selectAssessment(assessmentType); await loadPersonal(); }
  };
  const saveVitals = async () => {
    const numeric = ["systolic", "diastolic", "fasting_glucose", "ldl", "height_cm", "weight_kg", "waist_cm"];
    const allowed = ["health_status", "department_key", "department_consent", ...numeric];
    const payload = Object.fromEntries(Object.entries(vitals).filter(([key]) => allowed.includes(key)).map(([key, value]) => [key, numeric.includes(key) ? (value === "" || value == null ? null : Number(value)) : value]));
    if (await run(() => API.saveReibiVitals(payload), "三高／BMI 資料已儲存")) await loadPersonal();
  };
  const saveOhs = async () => {
    const recordType = occupational ? "interview" : ohsType;
    const source: Row = { title: ohs.title, details: ohs.details, version: ohs.version };
    if (["roster", "tracking", "interview"].includes(recordType)) source.employee_key = ohs.employee_key;
    if (recordType === "hazard") Object.assign(source, { severity: ohs.severity, frequency: ohs.frequency });
    if (recordType === "interview") Object.assign(source, { interviewer_role: ohs.interviewer_role, overwork_score: ohs.score ? Number(ohs.score) : null, action: ohs.details, follow_date: ohs.follow_date });
    const payload = { record_type: recordType, status: ohs.status || null, risk_level: ohs.risk_level || null, owner: ohs.owner || null, due_date: ohs.due_date || null, verified_at: ohs.verified_at || null, payload: source };
    if (await run(() => API.createReibiOhs(payload), "職安記錄已建立")) { setOhs((old: Row) => ({ ...old, title: "", details: "", employee_key: "", score: "" })); await loadManagement(); }
  };

  return <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3"><Link href="/dashboard" className={ghostClass}><ArrowLeft className="h-4 w-4" />返回</Link><div><h1 className="text-2xl font-black text-slate-800">REIBI 個人健康與職安</h1><p className="text-sm text-slate-500">健康行動、心理量表、職安四表、EAP、臨場面談與 OHS 計畫</p></div></div>
        <button className={ghostClass} disabled={loading} onClick={() => void reload()}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}重新整理</button>
      </header>
      {(error || message) && <div className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{error || message}</div>}
      <nav className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm print:hidden">{tabs.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? "bg-teal-700 text-white" : "text-slate-600"}`}>{label}</button>)}</nav>

      {tab === "actions" && <section className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card><div className="mb-4 flex justify-between"><h2 className="font-black">22 項健康行動</h2><b className="text-amber-700">⭐ {actions.balance || points.balance || 0}</b></div><p className="mb-4 text-xs text-slate-500">每項 +5 分；同項需間隔 7 天，所有增減都保留 ledger。</p>{Object.entries(actions.categories || {}).map(([category, items]: any) => <div key={category} className="mb-5"><h3 className="mb-2 text-xs font-black text-slate-500">{category}</h3><div className="grid gap-2 sm:grid-cols-2">{items.map(([code, label]: string[]) => <button key={code} onClick={async () => { if (await run(() => API.checkinReibiHealthAction(code), `${label}打卡完成`)) await loadPersonal(); }} className="rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-teal-50">{label}</button>)}</div></div>)}</Card>
        <Card><h2 className="font-black">積分明細</h2><div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">{(points.ledger || []).map((row: Row) => <div key={row.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-xs"><span>{row.metadata?.reward_label || row.metadata?.action_label || row.event_code}<small className="block text-slate-400">{String(row.created_at).slice(0, 16).replace("T", " ")}</small></span><b className={row.points > 0 ? "text-emerald-700" : "text-red-700"}>{row.points > 0 ? "+" : ""}{row.points}</b></div>)}</div><button className={`${ghostClass} mt-4 w-full`} onClick={() => void run(() => API.redeemReibiPoints({ reward_code: "health_consult", reward_label: "健康諮詢兌換", cost: 50 }), "兌換完成").then(data => data && loadPersonal())}>50 分兌換健康諮詢</button></Card>
      </section>}

      {tab === "diary" && <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card><div className="mb-4 flex gap-2"><button className={diaryKind === "sleep" ? primaryClass : ghostClass} onClick={() => setDiaryKind("sleep")}>睡眠日記</button><button className={diaryKind === "pain" ? primaryClass : ghostClass} onClick={() => setDiaryKind("pain")}>疼痛日誌</button></div>{diaryKind === "sleep" ? <div className="grid gap-3"><Field label="日期"><input type="date" className={inputClass} value={sleep.entry_date} onChange={e => setSleep({ ...sleep, entry_date: e.target.value })} /></Field><div className="grid grid-cols-2 gap-2"><Field label="上床"><input type="time" className={inputClass} value={sleep.bed_time} onChange={e => setSleep({ ...sleep, bed_time: e.target.value })} /></Field><Field label="起床"><input type="time" className={inputClass} value={sleep.wake_time} onChange={e => setSleep({ ...sleep, wake_time: e.target.value })} /></Field><Field label="入睡分鐘"><input type="number" className={inputClass} value={sleep.sleep_latency_minutes} onChange={e => setSleep({ ...sleep, sleep_latency_minutes: Number(e.target.value) })} /></Field><Field label="夜醒次數"><input type="number" className={inputClass} value={sleep.night_awakenings} onChange={e => setSleep({ ...sleep, night_awakenings: Number(e.target.value) })} /></Field></div><Field label={`睡眠品質 ${sleep.quality}/5`}><input type="range" min="1" max="5" className={inputClass} value={sleep.quality} onChange={e => setSleep({ ...sleep, quality: Number(e.target.value) })} /></Field></div> : <div className="grid gap-3"><Field label="日期"><input type="date" className={inputClass} value={pain.entry_date} onChange={e => setPain({ ...pain, entry_date: e.target.value })} /></Field><Field label={`疼痛 ${pain.level}/10`}><input type="range" min="0" max="10" className={inputClass} value={pain.level} onChange={e => setPain({ ...pain, level: Number(e.target.value) })} /></Field><Field label={`工作干擾 ${pain.work_impact}/10`}><input type="range" min="0" max="10" className={inputClass} value={pain.work_impact} onChange={e => setPain({ ...pain, work_impact: Number(e.target.value) })} /></Field><Field label="疼痛部位（逗號分隔）"><input className={inputClass} onChange={e => setPain({ ...pain, body_locations: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })} /></Field><Field label="觸發因素（逗號分隔）"><input className={inputClass} onChange={e => setPain({ ...pain, triggers: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })} /></Field></div>}<button className={`${primaryClass} mt-4 w-full`} onClick={async () => { if (await run(() => API.saveReibiDiary(diaryKind, diaryKind === "sleep" ? sleep : pain), "日誌已儲存，+3 分")) { const response: any = await API.getReibiDiary(diaryKind); setDiaries(unwrap(response, "讀取失敗") || []); await loadPersonal(); } }}><Save className="h-4 w-4" />儲存</button></Card>
        <Card><h2 className="font-black">近期香港記錄</h2><div className="mt-4 space-y-2">{diaries.map(row => <div key={row.id} className="rounded-xl bg-slate-50 p-3 text-sm"><b>{row.entry_date}</b><pre className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{JSON.stringify(row.source_payload, null, 2)}</pre></div>)}</div></Card>
      </section>}

      {tab === "assessments" && <section className="grid gap-4 lg:grid-cols-[1fr_390px]">
        <Card><div className="mb-4 flex flex-wrap gap-2">{[...Object.keys(ASSESSMENTS), "msk", "violence"].map(kind => <button key={kind} onClick={() => selectAssessment(kind)} className={assessmentType === kind ? primaryClass : ghostClass}>{ASSESSMENTS[kind]?.label || (kind === "msk" ? "NMQ" : "不法侵害")}</button>)}</div>{assessmentType === "violence" && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">依官方風險分類設計的個人篩檢，不是官方固定題本或正式申訴管道。</p>}{assessmentType === "msk" && <label className="mb-4 block text-sm"><input type="checkbox" className="mr-2" checked={screened} onChange={e => setScreened(e.target.checked)} />過去一年曾有持續兩週以上的不適</label>}<div className="space-y-3">{(assessmentPairs || ASSESSMENTS[assessmentType].questions.map((question, index) => [String(index), question])).map(([key, label], index) => <div key={key} className="rounded-xl border border-slate-200 p-3"><b className="text-sm">{label}</b><Scale value={answers[index]} max={assessmentPairs ? (assessmentType === "msk" ? 5 : 3) : ASSESSMENTS[assessmentType].max} onChange={value => setAnswers(old => { const next = [...old]; next[index] = value; return next; })} /></div>)}</div>{assessmentType === "ow" && <div className="mt-4 grid gap-2 sm:grid-cols-2">{RISK_FACTORS.map(value => <label key={value} className="rounded-xl border border-slate-200 p-2 text-xs"><input type="checkbox" className="mr-2" checked={riskFactors.includes(value)} onChange={() => setRiskFactors(old => old.includes(value) ? old.filter(item => item !== value) : [...old, value])} />{value}</label>)}</div>}{assessmentType === "bsrs5" && <div className="mt-4"><b className="text-sm text-red-700">附加題：最近一星期是否有自殺想法？</b><Scale value={suicideIdeation} max={4} onChange={setSuicideIdeation} /></div>}<button className={`${primaryClass} mt-5 w-full`} onClick={() => void submitAssessment()}>完成評估</button></Card>
        <Card>{assessmentReminders.map(row => <div key={row.id} className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><b>評估提醒：{row.source_payload?.title || "定期評估"}</b><small className="block">預定日期 {row.due_date}</small></div>)}{mhi && <div className="mb-4 rounded-xl bg-teal-50 p-4"><div className="text-xs font-bold text-teal-700">MHI 身心健康指數</div><div className="text-3xl font-black text-teal-800">{mhi.score}/100</div><small>{mhi.complete ? "已綜合三項評估" : "完成三項可取得完整指數"}</small></div>}<h2 className="font-black">個人評估歷史</h2><p className="mt-1 text-xs text-slate-500">管理者看不到個人答案。</p><div className="mt-4 space-y-2">{assessments.map(row => <div key={row.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between"><b>{row.assessment_type}</b><span>{row.score} · {row.level_label}</span></div><small>{String(row.assessed_at).slice(0, 10)}</small></div>)}</div></Card>
      </section>}

      {tab === "vitals" && <Card className="mx-auto max-w-3xl">
        <h2 className="font-black">三高與 BMI 自主管理</h2>
        <p className="mt-1 text-xs text-slate-500">個人數值只供自己查看；同意後才納入 k≥5 彙整。首次 +20、一般年度更新 +10、確診者每月更新 +5。</p>
        {vitals.next_update_due && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">下次建議更新：{vitals.next_update_due}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">{[["systolic", "收縮壓"], ["diastolic", "舒張壓"], ["fasting_glucose", "空腹血糖"], ["ldl", "LDL"], ["height_cm", "身高 cm"], ["weight_kg", "體重 kg"], ["waist_cm", "腰圍 cm"]].map(([key, label]) => <Field key={key} label={label}><input type="number" className={inputClass} value={vitals[key] ?? ""} onChange={e => setVitals((old: Row) => ({ ...old, [key]: e.target.value }))} /></Field>)}<Field label="健康狀態"><select className={inputClass} value={vitals.health_status} onChange={e => setVitals((old: Row) => ({ ...old, health_status: e.target.value }))}><option value="none">無診斷</option><option value="borderline">需追蹤</option><option value="diagnosed">已診斷</option></select></Field><Field label="部門"><input className={inputClass} value={vitals.department_key || ""} onChange={e => setVitals((old: Row) => ({ ...old, department_key: e.target.value }))} /></Field></div>
        <label className="mt-4 flex gap-2 rounded-xl bg-teal-50 p-3 text-sm"><input type="checkbox" checked={Boolean(vitals.department_consent)} onChange={e => setVitals((old: Row) => ({ ...old, department_consent: e.target.checked }))} /><span><b>同意納入部門去識別化統計</b><small className="block">未達 5 人不顯示指標，可隨時取消。</small></span></label>
        {vitals.bmi && <p className="mt-3 font-bold">BMI：{vitals.bmi}</p>}
        <button className={`${primaryClass} mt-5`} onClick={() => void saveVitals()}><Save className="h-4 w-4" />儲存</button>
      </Card>}

      {tab === "timeline" && <section className="space-y-4"><Card><h2 className="font-black">888 行動曲線</h2><div className="mt-4 flex h-40 items-end gap-2">{curve.map(row => <div key={row.week} className="flex flex-1 flex-col items-center"><b className="text-xs">{row.points}</b><div className="w-full rounded-t bg-teal-600" style={{ height: `${Math.max(4, Math.min(120, Math.abs(Number(row.points))))}px` }} /><small className="mt-1 text-[9px] text-slate-400">{String(row.week).slice(5)}</small></div>)}</div></Card><Card><h2 className="font-black">個人時間軸</h2><div className="mt-4 grid gap-2 md:grid-cols-2">{timeline.map((row, index) => <div key={`${row.type}-${row.at}-${index}`} className="rounded-xl border border-slate-200 p-3"><b>{row.action_label || row.assessment_type || row.diary_type}</b><small className="block text-slate-400">{String(row.at).slice(0, 16).replace("T", " ")}</small></div>)}</div></Card></section>}

      {tab === "feedback" && <Card className="mx-auto max-w-xl"><h2 className="font-black">季度使用回饋</h2><div className="mt-4 grid gap-3"><Field label="季度"><input className={inputClass} value={feedback.period_key} onChange={e => setFeedback({ ...feedback, period_key: e.target.value })} /></Field><Field label={`滿意度 ${feedback.satisfaction_score}/5`}><input type="range" min="1" max="5" className={inputClass} value={feedback.satisfaction_score} onChange={e => setFeedback({ ...feedback, satisfaction_score: Number(e.target.value) })} /></Field><Field label={`NPS ${feedback.nps_score}/10`}><input type="range" min="0" max="10" className={inputClass} value={feedback.nps_score} onChange={e => setFeedback({ ...feedback, nps_score: Number(e.target.value) })} /></Field><Field label="建議"><textarea className={inputClass} rows={4} value={feedback.free_text} onChange={e => setFeedback({ ...feedback, free_text: e.target.value })} /></Field></div><button className={`${primaryClass} mt-4 w-full`} onClick={() => void run(() => API.submitReibiFeedback({ ...feedback, answers: { satisfaction: feedback.satisfaction_score, nps: feedback.nps_score } }), "回饋已送出").then(data => data && loadPersonal())}>送出回饋</button></Card>}

      {tab === "eap" && <section className="grid gap-4 lg:grid-cols-2">{manager && <Card><h2 className="font-black">新增 EAP 資源</h2><div className="mt-4 grid gap-3"><Field label="分類"><select className={inputClass} value={eapDraft.category_code} onChange={e => setEapDraft({ ...eapDraft, category_code: e.target.value })}>{["A", "B", "C", "D", "E"].map(value => <option key={value}>{value}</option>)}</select></Field><Field label="名稱"><input className={inputClass} value={eapDraft.title} onChange={e => setEapDraft({ ...eapDraft, title: e.target.value })} /></Field><Field label="說明"><textarea className={inputClass} value={eapDraft.description} onChange={e => setEapDraft({ ...eapDraft, description: e.target.value })} /></Field><Field label="電話"><input className={inputClass} value={eapDraft.phone} onChange={e => setEapDraft({ ...eapDraft, phone: e.target.value })} /></Field><Field label="網址"><input className={inputClass} value={eapDraft.url} onChange={e => setEapDraft({ ...eapDraft, url: e.target.value })} /></Field></div><button className={`${primaryClass} mt-4`} onClick={() => void run(() => API.createReibiEapResource({ ...eapDraft, phone: eapDraft.phone || null, url: eapDraft.url || null }), "EAP 資源已新增").then(data => data && loadManagement())}><Plus className="h-4 w-4" />新增</button></Card>}<Card className={manager ? "" : "lg:col-span-2"}><h2 className="font-black">健康關懷與緊急資源</h2><div className="mt-4 space-y-3">{eap.map(row => <div key={row.id} className={`rounded-xl border p-3 ${row.is_emergency ? "border-red-200 bg-red-50" : "border-slate-200"}`}><b>{row.category_code} · {row.title}</b><p className="text-xs text-slate-500">{row.description}</p><div className="mt-2 flex gap-2">{row.phone && <a className={primaryClass} href={`tel:${row.phone}`}>撥打 {row.phone}</a>}{row.url && <a className={ghostClass} href={row.url} target="_blank" rel="noreferrer">開啟網站</a>}{manager && row.org_code && <button className={ghostClass} onClick={() => void run(() => API.updateReibiEapResource(row.id, { category_code: row.category_code, title: row.title, description: row.description, phone: row.phone, url: row.url, is_emergency: row.is_emergency, is_active: false, sort_order: row.sort_order }), "資源已停用").then(data => data && loadManagement())}>停用</button>}</div></div>)}</div></Card></section>}

      {tab === "aggregate" && <section className="space-y-4"><div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">資料庫端強制 k≥5；不足時不回傳指標。</div><div className="grid gap-4 md:grid-cols-3"><Card><h2 className="font-black">三高／BMI</h2><pre className="mt-3 whitespace-pre-wrap text-xs">{JSON.stringify(vitalAggregate, null, 2)}</pre></Card><Card><h2 className="font-black">職安填答活躍度</h2><p className="text-xs text-slate-500">送出份數，不是完成率；不含不法侵害。</p>{Object.entries(activity.counts || {}).map(([key, value]) => <div key={key} className="mt-2 flex justify-between rounded-xl bg-slate-50 p-3"><b>{key}</b><span>{String(value)} 份</span></div>)}</Card><Card><h2 className="font-black">回饋彙整</h2><pre className="mt-3 whitespace-pre-wrap text-xs">{JSON.stringify(feedbackAggregate, null, 2)}</pre></Card></div></section>}

      {tab === "ohs" && <section className="grid gap-4 lg:grid-cols-[390px_1fr] print:block">
        <Card className="print:hidden"><h2 className="font-black">{occupational ? "新增面談記錄" : "新增 OHS 記錄"}</h2>{!occupational && <Field label="類型"><select className={inputClass} value={ohsType} onChange={e => setOhsType(e.target.value)}>{[["hazard", "危害"], ["measure", "措施"], ["review", "檢討"], ["meta", "計畫版本"], ["roster", "roster"], ["schedule", "排程"], ["tracking", "追蹤"], ["interview", "面談"]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>}<div className="mt-3 grid gap-3">{["roster", "tracking", "interview"].includes(occupational ? "interview" : ohsType) && <Field label="去識別化員工代碼"><input className={inputClass} value={ohs.employee_key} onChange={e => setOhs({ ...ohs, employee_key: e.target.value })} /></Field>}<Field label="標題"><input className={inputClass} value={ohs.title} onChange={e => setOhs({ ...ohs, title: e.target.value })} /></Field>{ohsType === "hazard" && <div className="grid grid-cols-2 gap-2"><Field label="嚴重度"><select className={inputClass} value={ohs.severity} onChange={e => setOhs({ ...ohs, severity: e.target.value })}>{["low", "medium", "high"].map(value => <option key={value}>{value}</option>)}</select></Field><Field label="頻率"><select className={inputClass} value={ohs.frequency} onChange={e => setOhs({ ...ohs, frequency: e.target.value })}>{["low", "medium", "high"].map(value => <option key={value}>{value}</option>)}</select></Field></div>}<Field label="負責／面談人員"><input className={inputClass} value={ohs.owner} onChange={e => setOhs({ ...ohs, owner: e.target.value })} /></Field>{(occupational || ohsType === "interview") && <Field label="過勞分數"><input type="number" className={inputClass} value={ohs.score} onChange={e => setOhs({ ...ohs, score: e.target.value })} /></Field>}<Field label="內容／措施"><textarea className={inputClass} rows={4} value={ohs.details} onChange={e => setOhs({ ...ohs, details: e.target.value })} /></Field><Field label="期限／面談日"><input type="date" className={inputClass} value={ohs.due_date} onChange={e => setOhs({ ...ohs, due_date: e.target.value })} /></Field>{ohsType === "meta" && <Field label="版本"><input className={inputClass} value={ohs.version} onChange={e => setOhs({ ...ohs, version: e.target.value })} /></Field>}</div><button className={`${primaryClass} mt-4 w-full`} onClick={() => void saveOhs()}><Save className="h-4 w-4" />儲存</button></Card>
        <Card className={manager ? "print:hidden" : ""}><div className="flex justify-between"><h2 className="font-black">{occupational ? "面談記錄" : `OHS：${ohsType}`}</h2>{manager && <button className={ghostClass} onClick={() => window.print()}><Printer className="h-4 w-4" />列印／PDF</button>}</div><p className="text-xs text-slate-500">只保存員工代碼；計畫版本以新增記錄留存。</p><div className="mt-4 space-y-3">{ohsRows.map(row => <div key={row.id} className="rounded-xl border p-3"><b>{row.source_payload?.title || row.source_payload?.employee_key || row.record_type}</b><span className="float-right text-xs font-bold">{row.risk_level || row.status}</span><p className="text-xs text-slate-500">{row.source_payload?.details || row.source_payload?.action}</p>{manager && <button className="mt-2 text-xs font-bold text-red-700" onClick={() => void run(() => API.deleteReibiOhs(row.id), "記錄已刪除").then(data => data && loadManagement())}>刪除</button>}</div>)}</div></Card>
        {manager && ohsSnapshot && <Card className="lg:col-span-2"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">職業安全衛生管理計畫</h2><p className="text-xs text-slate-500">單位：{ohsSnapshot.org_code}　產生時間：{String(ohsSnapshot.generated_at).slice(0, 16).replace("T", " ")}</p></div><button className={`${ghostClass} print:hidden`} onClick={() => window.print()}><Printer className="h-4 w-4" />列印／另存 PDF</button></div>{([['meta', '版本紀錄'], ['hazard', '危害辨識'], ['measure', '改善措施'], ['review', '定期檢討']] as const).map(([kind, label]) => <section key={kind} className="mt-6 break-inside-avoid"><h3 className="border-b pb-2 font-black">{label}</h3><div className="mt-2 space-y-2">{(ohsSnapshot[kind] || []).length ? (ohsSnapshot[kind] || []).map((row: Row) => <div key={row.id} className="rounded-lg border p-3 text-sm"><b>{row.source_payload?.title || `${label} #${row.id}`}</b><span className="float-right text-xs">{row.risk_level || row.status || row.source_payload?.version}</span><p className="mt-1 text-slate-600">{row.source_payload?.details || "—"}</p><small className="text-slate-400">負責：{row.owner || "—"}　期限：{row.due_date || "—"}</small></div>) : <p className="py-2 text-xs text-slate-400">尚無資料</p>}</div></section>)}</Card>}
      </section>}

      {tab === "access" && <Card className="mx-auto max-w-xl"><h2 className="font-black">臨場醫護獨立登入</h2><p className="text-xs text-slate-500">通行碼與管理 PIN 分離，只可存取 roster 與面談記錄。</p><Field label="通行碼"><input type="password" className={inputClass} value={occupationalPin} onChange={e => setOccupationalPin(e.target.value)} /></Field><label className="mt-4 block text-sm"><input type="checkbox" className="mr-2" checked={rosterVisible} onChange={e => setRosterVisible(e.target.checked)} />允許查看去識別化 roster</label><button className={`${primaryClass} mt-4`} disabled={occupationalPin.length < 4} onClick={() => void run(() => API.setReibiOccupationalAccess(occupationalPin, rosterVisible), "設定已更新").then(data => data && setOccupationalPin(""))}><Save className="h-4 w-4" />儲存</button></Card>}
    </div>
  </main>;
}
