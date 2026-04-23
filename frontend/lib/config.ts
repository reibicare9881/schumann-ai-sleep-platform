// lib/config.ts

// ══ TOKENS & UI CONSTANTS ══
export const C = {
  bg: "#fdf8f3", card: "#fff", border: "#e8ddd4",
  teal: "#2a7d8c", tealBg: "#ebf6f8", tealLight: "#b8dfe5",
  coral: "#c05a28", coralBg: "#fdf2ec",
  amber: "#b07015", amberBg: "#fdf6e8",
  sage: "#2d7a5a", sageBg: "#edf7f3",
  plum: "#6b4a8c", plumBg: "#f5f0fb",
  text: "#2a2220", muted: "#7a6e68", faint: "#b8afa8",
  divider: "#e8ddd4", shadow: "0 2px 12px rgba(42,34,32,0.08)"
};

export const LX = {
  green: { c: "#2d7a5a", bg: "#edf7f3", br: "#7ecfaa" },
  yellow: { c: "#b07015", bg: "#fdf6e8", br: "#f0c76a" },
  orange: { c: "#c05a28", bg: "#fdf2ec", br: "#f0b898" },
  red: { c: "#b82020", bg: "#fdf0f0", br: "#f0a0a0" }
};

export const LL = { green: "🟢 綠燈", yellow: "🟡 黃燈", orange: "🟠 橙燈", red: "🔴 紅燈" };

// ══ RBAC 角色與權限 ══
export const ROLES: Record<string, any> = {
  individual: { label: "個人用戶", icon: "👤", color: C.teal, desc: "個人健康自主管理，完整存取自身報告", perms: ["assess", "view_own", "dl_own", "view_history"] },
  member: { label: "單位成員", icon: "🏢", color: C.sage, desc: "個人評估填寫，資料提交至單位", perms: ["assess", "view_own", "dl_own", "view_history", "submit_org", "view_appt"] },
  dept_head: { label: "部門主管", icon: "📋", color: C.amber, desc: "查閱本部門去識別化統計及OKR", perms: ["assess", "view_own", "dl_own", "view_history", "submit_org", "view_dept_okr", "dl_dept", "view_appt", "view_date_report"] },
  admin: { label: "單位平台管理者", icon: "🔐", color: C.plum, desc: "HR人資高管／財務高管／負責人", perms: ["assess", "view_own", "dl_own", "view_history", "view_org", "dl_org", "view_okr", "manage_okr", "view_appt", "manage_appt", "dl_appt", "view_kpi", "edit_params", "view_date_report", "dl_date_report", "view_esg"] },
};

export const PERMS = [
  { p: "assess", label: "健康評估填寫", roles: ["individual", "member", "dept_head"] },
  { p: "view_own", label: "查閱自身報告", roles: ["individual", "member", "dept_head"] },
  { p: "dl_own", label: "下載自身PDF報告", roles: ["individual", "member", "dept_head"] },
  { p: "view_history", label: "個人歷史追蹤", roles: ["individual", "member", "dept_head"] },
  { p: "submit_org", label: "提交評估至單位", roles: ["member", "dept_head"] },
  { p: "view_dept_okr", label: "查閱部門去識別化OKR", roles: ["dept_head", "admin"] },
  { p: "view_org", label: "查閱全單位KPI/報表", roles: ["admin"] },
  { p: "manage_okr", label: "設定/修改OKR獎酬參數", roles: ["admin"] },
  { p: "edit_params", label: "修改經濟效益計算參數", roles: ["admin"] },
  { p: "view_appt", label: "查閱自主健管預約排程", roles: ["member", "dept_head", "admin"] },
  { p: "manage_appt", label: "管理/修改/刪除排程", roles: ["admin"] },
  { p: "dl_appt", label: "下載/列印全單位排程", roles: ["admin"] },
  { p: "view_date_report", label: "依日期區間查詢報告", roles: ["dept_head", "admin"] },
  { p: "dl_date_report", label: "下載日期區間報告", roles: ["admin"] },
  { p: "view_esg", label: "ESG健康效益報告", roles: ["admin"] },
];

export const can = (role: string, p: string) => ROLES[role]?.perms?.includes(p) ?? false;

// ══ 題目與選項 ══
export const SQ = [
  { id: "s1", icon: "🌙", d: "入睡困難", text: "過去一週，上床後需超過30分鐘才能入睡的頻率？", opts: [{ l: "完全沒有", s: 0 }, { l: "每週1–2次", s: 1 }, { l: "每週3–4次", s: 2 }, { l: "每週5–6次", s: 3 }, { l: "每晚都有", s: 4 }] },
  { id: "s2", icon: "👁️", d: "夜間覺醒/早醒", text: "夜間醒來難以再次入睡，或比預期早醒的頻率？", opts: [{ l: "完全沒有", s: 0 }, { l: "每週1–2次", s: 1 }, { l: "每週3–4次", s: 2 }, { l: "每週5–6次", s: 3 }, { l: "每晚都有", s: 4 }] },
  { id: "s3", icon: "😌", d: "睡眠滿意度", text: "您對目前整體睡眠品質感到滿意嗎？", opts: [{ l: "非常滿意", s: 0 }, { l: "滿意", s: 1 }, { l: "普通", s: 2 }, { l: "不滿意", s: 3 }, { l: "非常不滿意", s: 4 }] },
  { id: "s4", icon: "☀️", d: "日間功能影響", text: "睡眠問題干擾日間工作、社交或學習的程度？", opts: [{ l: "完全沒有", s: 0 }, { l: "輕微", s: 1 }, { l: "中等", s: 2 }, { l: "明顯", s: 3 }, { l: "嚴重", s: 4 }] },
  { id: "s5", icon: "🪞", d: "睡眠問題察覺", text: "目前睡眠問題被別人注意到或自己在意的程度？", opts: [{ l: "完全不在意", s: 0 }, { l: "輕微", s: 1 }, { l: "中等", s: 2 }, { l: "明顯", s: 3 }, { l: "非常嚴重", s: 4 }] },
  { id: "s6", icon: "😟", d: "對睡眠的擔憂", text: "因睡眠問題感到擔心、苦惱或情緒低落的嚴重度？", opts: [{ l: "完全沒有", s: 0 }, { l: "輕微", s: 1 }, { l: "中等", s: 2 }, { l: "明顯", s: 3 }, { l: "非常嚴重", s: 4 }] },
  { id: "s7", icon: "🌿", d: "生活品質影響", text: "整體而言，睡眠問題影響您生活品質的程度？", opts: [{ l: "完全沒有", s: 0 }, { l: "輕微", s: 1 }, { l: "中等", s: 2 }, { l: "明顯", s: 3 }, { l: "嚴重", s: 4 }] },
];

export const PQ = [
  { id: "p1", icon: "📊", d: "平均疼痛", text: "過去一週平均疼痛程度？（0=無，10=最劇烈）" },
  { id: "p2", icon: "🔺", d: "最嚴重疼痛", text: "過去一週最嚴重時的疼痛程度？" },
  { id: "p3", icon: "🌙", d: "干擾睡眠", text: "疼痛干擾睡眠（難以入睡、夜間痛醒）的程度？" },
  { id: "p4", icon: "🚶", d: "干擾日常", text: "疼痛干擾日常活動（工作、家務、行走）的程度？" },
  { id: "p5", icon: "💔", d: "影響情緒", text: "疼痛讓您感到苦惱、煩躁或低落的程度？" },
];

export const WQ = [
  { id: "w1", d: "專注力", text: "睡眠或疼痛問題影響工作專注力的程度？" },
  { id: "w2", d: "工作效率", text: "睡眠或疼痛問題降低工作效率的程度？" },
  { id: "w3", d: "缺勤傾向", text: "過去一個月因睡眠或疼痛問題請假或早退的頻率？" },
];

export const PAIN_LOCS = ["頭部/頭痛", "頸部/頸椎", "肩膀", "上背部", "下背部/腰", "手臂/手肘", "手腕/手部", "臀部/髖關節", "大腿/膝蓋", "小腿/踝部", "足部", "胸部", "腹部", "其他"];

// 判斷邏輯
export const getSR = (t: number) => {
  if (t <= 7) return { key: "green", label: "睡眠品質良好", range: "0–7", desc: "無臨床意義的失眠，睡眠品質良好。", action: "維持規律作息，落實睡眠衛生習慣。" };
  if (t <= 14) return { key: "yellow", label: "輕度失眠", range: "8–14", desc: "輕度失眠，建議注意睡眠衛生習慣。", action: "固定作息、減少咖啡因，進行睡眠衛生教育。" };
  if (t <= 21) return { key: "orange", label: "中度失眠", range: "15–21", desc: "中度失眠，已影響日常功能，建議就醫。", action: "建議至睡眠醫學科或精神科門診評估。" };
  return { key: "red", label: "重度失眠", range: "22–28", desc: "重度失眠，強烈建議睡眠專科就診。", action: "積極就醫，可能需藥物治療或CBT-I。" };
};

export const getPR = (t: number) => {
  if (t <= 12) return { key: "green", label: "疼痛輕微", range: "0–12", desc: "疼痛輕微，對生活及睡眠影響甚小。", action: "自我管理：熱敷、適度活動、伸展。" };
  if (t <= 25) return { key: "yellow", label: "中度疼痛", range: "13–25", desc: "中度疼痛，對睡眠或日常有一定影響。", action: "記錄疼痛日記，諮詢疼痛科或復健科。" };
  if (t <= 38) return { key: "orange", label: "重度疼痛", range: "26–38", desc: "重度疼痛，明顯干擾睡眠及生活品質。", action: "疼痛專科評估，藥物治療合併物理治療。" };
  return { key: "red", label: "極重度疼痛", range: "39–50", desc: "極重度疼痛，需立即就醫評估。", action: "立即就醫，排除急性病變。" };
};