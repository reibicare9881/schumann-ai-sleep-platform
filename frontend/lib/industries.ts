/**
 * REIBI 行業分類（移植自 reibi-v10_3_34 的 IndustryScreen）。
 *
 * 新系統原本把 `industry` 做成自由文字輸入，於是同一個產業會出現「科技」「科技業」
 * 「Tech」等多種寫法，跨企業分析無法據此分群。這裡恢復 Artifact 的 10 大類 ×
 * 10 子類分類體系。
 *
 * 儲存格式維持單一文字欄位 `大類／子類`，因此既有的自由文字資料不會失效，
 * 只是不會對應到任何選項，畫面會原樣顯示並提示重新選擇。
 */

export type IndustryCategory = {
  key: string;
  label: string;
  icon: string;
  subs: string[];
};

export const INDUSTRY_SEPARATOR = "／";

export const INDUSTRIES: IndustryCategory[] = [
  {
    key: "tech", label: "科技", icon: "💻",
    subs: ["半導體", "軟體服務", "硬體製造", "雲端服務", "AI大數據", "電信通訊", "電子商務", "資安", "遊戲", "其他科技"],
  },
  {
    key: "finance", label: "金融", icon: "🏦",
    subs: ["銀行", "保險", "證券", "投信", "租賃", "票券", "電子支付", "會計師事務所", "財務顧問", "其他金融"],
  },
  {
    key: "mfg", label: "製造", icon: "🏭",
    subs: ["電子零組件", "機械設備", "汽車零件", "食品加工", "紡織成衣", "化學材料", "塑膠橡膠", "金屬製品", "印刷包裝", "其他製造"],
  },
  {
    key: "service", label: "服務", icon: "🛎",
    subs: ["零售業", "餐飲業", "物流運輸", "觀光旅遊", "不動產", "物業管理", "顧問諮詢", "清潔維護", "人力仲介", "其他服務"],
  },
  {
    key: "medical", label: "醫療", icon: "🏥",
    subs: ["醫院診所", "藥局", "醫療器材", "生技製藥", "長照機構", "復健診所", "健康檢查", "心理諮商", "牙醫", "其他醫療"],
  },
  {
    key: "edu", label: "教育", icon: "🎓",
    subs: ["大專院校", "中小學", "補習班", "幼兒園", "職業訓練", "線上學習", "特殊教育", "圖書館", "研究單位", "其他教育"],
  },
  {
    key: "const", label: "建築", icon: "🏗",
    subs: ["建設公司", "營造廠", "室內設計", "建築師事務所", "工程顧問", "景觀設計", "設施管理", "水電工程", "消防工程", "其他建築"],
  },
  {
    key: "media", label: "傳播", icon: "📡",
    subs: ["電視廣播", "平面媒體", "數位媒體", "廣告公關", "出版社", "影視製作", "音樂娛樂", "直播平台", "社群媒體", "其他傳播"],
  },
  {
    key: "gov", label: "政府", icon: "🏛",
    subs: ["中央機關", "地方機關", "公立學校", "公立醫院", "國營事業", "社會福利", "環保單位", "警消單位", "交通單位", "其他公部門"],
  },
  {
    key: "other", label: "其他", icon: "🔹",
    subs: ["農林漁牧", "礦業", "公益組織", "宗教團體", "社區發展", "體育運動", "藝術文化", "法律事務所", "其他行業", "待分類"],
  },
];

/** Split a stored value back into its category and sub-category. */
export function parseIndustry(value: string | null | undefined): {
  category: IndustryCategory | null;
  sub: string;
  raw: string;
} {
  const raw = (value || "").trim();
  if (!raw) return { category: null, sub: "", raw: "" };

  const [head, ...rest] = raw.split(INDUSTRY_SEPARATOR);
  const category = INDUSTRIES.find(item => item.label === head.trim()) || null;
  return { category, sub: rest.join(INDUSTRY_SEPARATOR).trim(), raw };
}

export function formatIndustry(categoryLabel: string, sub: string): string {
  if (!categoryLabel) return "";
  return sub ? `${categoryLabel}${INDUSTRY_SEPARATOR}${sub}` : categoryLabel;
}
