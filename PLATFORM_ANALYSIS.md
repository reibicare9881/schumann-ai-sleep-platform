# 🏥 REIBI 麗媚生化科技 健康管理平台 · 完整功能清單

**平台名稱**：REIBI 健康自主管理評估系統  
**核心產品**：睡眠 × 疼痛聯合評估 + ESG健康效益  
**技術棧**：React + WebCrypto + IndexedDB  
**安全版本**：v1.0 (Zero Trust + AES-256-GCM + k-Anonymity + DP)

---

## 📋 目錄
1. [所有頁面與模組](#所有頁面與模組)
2. [所有核心功能](#所有核心功能)
3. [所有用戶角色與權限](#所有用戶角色與權限)
4. [所有數據結構](#所有數據結構)
5. [所有安全特性](#所有安全特性)
6. [所有頁面路由](#所有頁面路由)
7. [色彩系統與設計](#色彩系統與設計)
8. [API 與存儲層](#api-與存儲層)

---

## 所有頁面與模組

### 🎯 用戶界面頁面

| 頁面名稱 | 組件 | 功能描述 | 適用角色 |
|---------|------|--------|--------|
| **登入頁** | `LoginScreen` | 個人模式 / 單位模式登入選擇、角色分流 | 所有用戶 |
| **使命橫幅** | `MissionBanner` | 品牌信息、健康自主管理理念展示 | 所有用戶 |
| **聲明模態框** | `DeclModal` | 誠實填寫聲明確認（4項勾選條款） | 首次評估者 |
| **主儀表板** | `Dashboard` | 導航樞紐、快速統計、最近評估記錄 | 所有認證用戶 |
| **個人資料頁** | `ProfileScreen` | 基本資料 (年齡/性別/身高/體重/BMI) + 職場資訊 + 慢病史 | 評估中用戶 |
| **睡眠評估問卷** | `SleepQ` | ISI 7題量表（入睡困難、夜間覺醒、滿意度等） | 所有評估用戶 |
| **疼痛評估問卷** | `PainQ` | BPI 5題量表（平均/最嚴重/干擾睡眠/日常/情緒） | 所有評估用戶 |
| **工作效率評估** | `WorkQ` | 3題工作影響評估（專注力、效率、缺勤） | 所有評估用戶 |
| **加載屏幕** | `LoadingScreen` | AI 個人化建議生成進度動畫 | 評估完成後 |
| **報告頁面** | `ReportScreen` | 完整個人評估報告、建議、PDF下載 | 個人/成員/部門主管 |
| **歷史追蹤頁** | `HistoryScreen` | 年度健康評估歷史、日期篩選、PDF匯出 | 個人/成員/部門主管 |
| **分析與趨勢** | `AnalysisPage` | 睡眠/疼痛/工作曲線、趨勢預測、療程建議 | 個人/成員/部門主管 |
| **單位KPI報表** | `OrgKPIScreen` | 去識別化統計、KPI公式計算、部門篩選 | 管理者/部門主管 |
| **OKR績效儀表板** | `OKRScreen` | OKR目標設定、獎金計算器、ROI效益分析 | 管理者/部門主管 |
| **預約排程頁** | `ApptScreen` | 舒曼共振/激光預約、時段管理、完成紀錄 | 所有角色 |
| **ESG效益報告** | `ESGScreen` | 企業永續指標、人力資本健康、降本增效 | 管理者 |
| **高風險分析** | `HighRiskPanel` | 高風險族群辨識、共病率、30天未評估警示 | 管理者 |
| **隱私安全中心** | `PrivacyCenter` | 法規對齊、加密機制、去識別化政策、稽核日誌 | 所有用戶 |

---

## 所有核心功能

### 🎯 評估與計分系統

```
1. ISI 睡眠品質評估（7題）
   ├─ S1: 入睡困難 (0-4分)
   ├─ S2: 夜間覺醒/早醒 (0-4分)
   ├─ S3: 睡眠滿意度 (0-4分)
   ├─ S4: 日間功能影響 (0-4分)
   ├─ S5: 睡眠問題察覺 (0-4分)
   ├─ S6: 對睡眠的擔憂 (0-4分)
   ├─ S7: 生活品質影響 (0-4分)
   └─ 總分範圍：0-28分

2. BPI 疼痛影響評估（5題）
   ├─ P1: 平均疼痛 (0-10分)
   ├─ P2: 最嚴重疼痛 (0-10分)
   ├─ P3: 干擾睡眠 (0-10分)
   ├─ P4: 干擾日常活動 (0-10分)
   ├─ P5: 影響情緒 (0-10分)
   └─ 總分範圍：0-50分

3. 工作效率影響（3題，0-10分NRS）
   ├─ W1: 專注力影響
   ├─ W2: 工作效率降低
   └─ W3: 缺勤傾向
```

### 📊 評分標準與燈號系統

#### 睡眠評估 (ISI) 燈號分級
```
🟢 綠燈: 0-7分     → 睡眠品質良好 (無臨床意義失眠)
🟡 黃燈: 8-14分    → 輕度失眠 (建議睡眠衛教)
🟠 橙燈: 15-21分   → 中度失眠 (建議就醫評估)
🔴 紅燈: 22-28分   → 重度失眠 (強烈建議睡眠專科就診)
```

#### 疼痛評估 (BPI) 燈號分級
```
🟢 綠燈: 0-12分    → 疼痛輕微
🟡 黃燈: 13-25分   → 中度疼痛
🟠 橙燈: 26-38分   → 重度疼痛
🔴 紅燈: 39-50分   → 極重度疼痛 (需立即就醫)
```

### 🎨 健康促進指數 (HPI) 計算

```javascript
HPI = 100 - [(睡眠分數/28×40%) + (疼痛分數/50×40%) + (工作分數/30×20%)]

範圍: 0-100分
75分以上 → 良好
50-74分  → 需關注
<50分    → 高風險
```

### 💡 個人化建議系統（AI Anthropic Claude）

**生成 6 大建議主題**（各150字繁體中文）
1. `generalHealth` - 綜合健康促進 (衛福部政策對齊)
2. `painEducation` - 疼痛衛教 (IASP 2023 多模式管理)
3. `sleepEducation` - 睡眠衛教 (CBT-I 2024指南一線治療)
4. `dietaryAdvice` - 飲食衛教 (地中海飲食科學證據)
5. `physicalTherapy` - 物理治療建議 (實證效益)
6. `reibiProducts` - REIBI療程建議 (舒曼波7.83Hz、LA200雷射)

**Fallback 內建建議庫** (`FR`) - 確保 API 失敗時仍有高品質內容

---

### 📋 所有用戶角色與權限

### RBAC 四層角色結構

```
┌─────────────────────────────────────────────────────────┐
│              REIBI 角色分層授權模型                       │
└─────────────────────────────────────────────────────────┘

1️⃣ 👤 個人用戶 (individual)
   ├─ 描述：個人健康自主管理，完整存取自身報告
   ├─ 顏色標記：🇨🇭 Teal (#2a7d8c)
   ├─ 權限列表：
   │  ├─ assess ...................... 健康評估填寫
   │  ├─ view_own ................... 查閱自身報告
   │  ├─ dl_own ..................... 下載自身PDF報告
   │  └─ view_history ............... 個人歷史追蹤
   └─ 存儲位置：本地設備 (個人IndexedDB)
   
2️⃣ 🏢 單位成員 (member)
   ├─ 描述：個人評估填寫，資料提交至單位
   ├─ 顏色標記：🌿 Sage (#2d7a5a)
   ├─ 權限列表：
   │  ├─ assess ....................... 健康評估填寫
   │  ├─ view_own ..................... 查閱自身報告
   │  ├─ dl_own ....................... 下載自身PDF報告
   │  ├─ view_history ................. 個人歷史追蹤
   │  ├─ submit_org ................... 提交評估至單位 ★
   │  └─ view_appt .................... 查閱預約排程
   └─ 登入方式：單位碼 + 成員通行碼

3️⃣ 📋 部門主管 (dept_head)
   ├─ 描述：查閱本部門去識別化統計及OKR
   ├─ 顏色標記：🟠 Amber (#b07015)
   ├─ 權限列表：
   │  ├─ assess ....................... 健康評估填寫
   │  ├─ view_own ..................... 查閱自身報告
   │  ├─ dl_own ....................... 下載自身PDF報告
   │  ├─ view_history ................. 個人歷史追蹤
   │  ├─ submit_org ................... 提交評估至單位
   │  ├─ view_dept_okr ................ 查閱部門去識別化OKR ★
   │  ├─ dl_dept ...................... 下載部門報表
   │  ├─ view_appt .................... 查閱預約排程
   │  └─ view_date_report ............ 依日期區間查詢報告 ★
   └─ 登入方式：單位碼 + 部門主管通行碼

4️⃣ 🔐 單位平台管理者 (admin)
   ├─ 描述：HR人資高管／財務高管／負責人
   ├─ 顏色標記：🟣 Plum (#6b4a8c)
   ├─ 權限列表：
   │  ├─ assess ....................... 健康評估填寫
   │  ├─ view_own ..................... 查閱自身報告
   │  ├─ dl_own ....................... 下載自身PDF報告
   │  ├─ view_history ................. 個人歷史追蹤
   │  ├─ submit_org ................... 提交評估至單位
   │  ├─ view_org ..................... 查閱全單位KPI/報表 ★
   │  ├─ dl_org ....................... 下載全單位報表
   │  ├─ view_okr ..................... 查閱OKR及獎酬參數 ★
   │  ├─ manage_okr ................... 設定/修改OKR獎酬參數 ★
   │  ├─ view_appt .................... 查閱預約排程
   │  ├─ manage_appt .................. 管理/修改/刪除排程 ★
   │  ├─ dl_appt ...................... 下載/列印全單位排程
   │  ├─ view_date_report ............ 依日期區間查詢報告
   │  ├─ dl_date_report .............. 下載日期區間報告 ★
   │  ├─ edit_params .................. 修改經濟效益計算參數 ★
   │  └─ view_esg ..................... ESG健康效益報告 ★
   └─ 登入方式：單位碼 + 管理者通行碼
              首次需設定3組各不相同通行碼

权限总览表 (17项权限，分布于4个角色)
╔═══════════════════════════════╦═══════╦════╦═══╦═══╗
║ 權限名稱                       ║Individual║Member║DH║Admin║
╠═══════════════════════════════╬═══════╬════╬═══╬═══╣
║ assess (健康評估填寫)          ║   ✓   ║ ✓ ║ ✓ ║ ✓ ║
║ view_own (查閱自身報告)        ║   ✓   ║ ✓ ║ ✓ ║ ✓ ║
║ dl_own (下載自身PDF)           ║   ✓   ║ ✓ ║ ✓ ║ ✓ ║
║ view_history (個人歷史追蹤)    ║   ✓   ║ ✓ ║ ✓ ║ ✓ ║
║ submit_org (提交至單位)        ║   —   ║ ✓ ║ ✓ ║ ✓ ║
║ view_dept_okr (查閱部門OKR)    ║   —   ║ — ║ ✓ ║ ✓ ║
║ dl_dept (下載部門報表)         ║   —   ║ — ║ ✓ ║ ✓ ║
║ view_org (查閱全單位KPI)       ║   —   ║ — ║ — ║ ✓ ║
║ manage_okr (設定OKR獎酬)       ║   —   ║ — ║ — ║ ✓ ║
║ edit_params (修改計算參數)     ║   —   ║ — ║ — ║ ✓ ║
║ view_appt (查閱預約排程)       ║   —   ║ ✓ ║ ✓ ║ ✓ ║
║ manage_appt (管理排程)         ║   —   ║ — ║ — ║ ✓ ║
║ dl_appt (下載排程)             ║   —   ║ — ║ — ║ ✓ ║
║ view_date_report (日期查詢)    ║   —   ║ — ║ ✓ ║ ✓ ║
║ dl_date_report (下載日期報表)  ║   —   ║ — ║ — ║ ✓ ║
║ view_esg (ESG報告)             ║   —   ║ — ║ — ║ ✓ ║
╚═══════════════════════════════╩═══════╩════╩═══╩═══╝
```

---

## 所有數據結構

### 📝 問卷題庫

#### 1. 睡眠問卷 (SQ) - ISI 7題
```javascript
SQ = [
  { id: "s1", icon: "🌙", d: "入睡困難", 
    text: "過去一週，上床後需超過30分鐘才能入睡的頻率？",
    opts: [0,1,2,3,4] → ["完全沒有", "每週1–2次", "每週3–4次", "每週5–6次", "每晚都有"]
  },
  { id: "s2", icon: "👁️", d: "夜間覺醒/早醒", ... },
  { id: "s3", icon: "😌", d: "睡眠滿意度", ... },
  { id: "s4", icon: "☀️", d: "日間功能影響", ... },
  { id: "s5", icon: "🪞", d: "睡眠問題察覺", ... },
  { id: "s6", icon: "😟", d: "對睡眠的擔憂", ... },
  { id: "s7", icon: "🌿", d: "生活品質影響", ... },
]
總分範圍: 0-28分
```

#### 2. 疼痛問卷 (PQ) - BPI 5題（NRS 0-10分）
```javascript
PQ = [
  { id: "p1", icon: "📊", d: "平均疼痛", 
    text: "過去一週平均疼痛程度？（0=無，10=最劇烈）" },
  { id: "p2", icon: "🔺", d: "最嚴重疼痛", ... },
  { id: "p3", icon: "🌙", d: "干擾睡眠", ... },
  { id: "p4", icon: "🚶", d: "干擾日常", ... },
  { id: "p5", icon: "💔", d: "影響情緒", ... },
]
總分範圍: 0-50分
```

#### 3. 工作效率問卷 (WQ) - 3題（NRS 0-10分）
```javascript
WQ = [
  { id: "w1", d: "專注力", text: "睡眠或疼痛問題影響工作專注力的程度？" },
  { id: "w2", d: "工作效率", text: "睡眠或疼痛問題降低工作效率的程度？" },
  { id: "w3", d: "缺勤傾向", text: "過去一個月因睡眠或疼痛問題請假或早退的頻率？" },
]
總分範圍: 0-30分
```

#### 4. 疼痛部位 (PAIN_LOCS) - 14項
```javascript
["頭部/頭痛", "頸部/頸椎", "肩膀", "上背部", "下背部/腰", 
 "手臂/手肘", "手腕/手部", "臀部/髖關節", "大腿/膝蓋", 
 "小腿/踝部", "足部", "胸部", "腹部", "其他"]
```

### 🎨 報告數據結構

```javascript
Report = {
  id: string,                        // 報告唯一ID
  uid: string,                       // 用戶ID
  ts: ISO8601,                       // 評估時間戳
  declarationTs: ISO8601,            // 聲明簽署時間
  
  // 個人資料
  profile: {
    name: string,
    age: number,
    gender: "male"|"female"|"other",
    height: number,                  // cm
    weight: number,                  // kg
    bmi: number,                     // 自動計算
    dept: string,
    orgRole: string,
    industry: string,
    shiftWork: string,
    hypertension: string,
    diabetes: string,
    hyperlipidemia: string,
    heartDisease: string,
    medications: string,
    painLocations: [string],         // 勾選的疼痛部位
  },
  
  // 睡眠評估
  sScore: number,                    // 0-28
  sLevel: {                          // 自動判定
    key: "green"|"yellow"|"orange"|"red",
    label: "睡眠品質良好"|"輕度失眠"|"中度失眠"|"重度失眠",
    range: "0–7"|"8–14"|"15–21"|"22–28",
    desc: string,
    action: string,
  },
  sAns: {[q_id]: score},             // 各題答案
  
  // 疼痛評估
  pScore: number,                    // 0-50
  pLevel: {                          // 自動判定
    key: "green"|"yellow"|"orange"|"red",
    label: "疼痛輕微"|"中度疼痛"|"重度疼痛"|"極重度疼痛",
    range: "0–12"|"13–25"|"26–38"|"39–50",
    desc: string,
    action: string,
  },
  pAns: {[q_id]: score},             // 各題答案
  
  // 工作效率
  wScore: number,                    // 0-30
  
  // 個人化建議（API/Fallback）
  recs: {
    generalHealth: string,           // 綜合健康促進
    painEducation: string,           // 疼痛衛教
    sleepEducation: string,          // 睡眠衛教
    dietaryAdvice: string,           // 飲食衛教
    physicalTherapy: string,         // 物理治療
    reibiProducts: string,           // REIBI療程建議
  },
}
```

### 🏢 組織級去識別化記錄

```javascript
OrgRecord = {
  sScore: number,
  sKey: "green"|"yellow"|"orange"|"red",
  pScore: number,
  pKey: "green"|"yellow"|"orange"|"red",
  wScore: number,
  dept: string,
  painLocs: [string],
  ts: ISO8601,
  
  // 不包含: 姓名、uid、個人識別資訊
}
```

### 💰 OKR / 獎金參數

```javascript
OKRParams = {
  // 獎金設定（管理者編輯）
  baseBudget: number,                // 基礎獎金額度
  activationPct: number,             // 啟動門檻 (50-100%)
  valueMultiplier: number,           // 燈號改善加成倍數 (1-5倍)
  
  // ROI計算參數（管理者編輯）
  sickDays: number,                  // 減少病假天數/人/年
  dailySalary: number,               // 平均日薪
  insSaving: number,                 // 每人醫療保險節省
  effGain: number,                   // 效率提升百分比 (1-20%)
  implCost: number,                  // 導入成本/年
  effGain: number,                   // 效率提升百分比
  
  savedAt: ISO8601,                  // 參數保存時間
}
```

---

## 所有安全特性

### 🛡️ 零信任架構 (Zero Trust)

```javascript
ZeroTrust = {
  TIMEOUT_MS: 30 * 60 * 1000,        // 30 分鐘自動登出
  lastActivity: Date.now(),
  
  validateAction(session, permission) {
    ✓ 檢查 session 存在
    ✓ 檢查是否超時
    ✓ 重新驗證 RBAC 權限 (can(role, perm))
    ✓ 記錄稽核日誌
    ✓ 標記 ACCESS_GRANTED 或 ACCESS_DENIED
    return ok
  },
  
  // 稽核日誌
  AuditLog = {
    _log: [],
    record(action, detail, role) {
      _log.unshift({
        ts: ISO8601,
        action: string,                  // "ACCESS_GRANTED" | "ACCESS_DENIED" | "ORG_DATA_SUBMITTED"
        detail: string,                  // 權限名稱或詳細說明
        role: string,                    // 用戶角色
        id: random_id,
      })
    },
    getLog() { return [..._log] }        // 最多保存 100 筆記錄
  }
}
```

### 🔐 AES-256-GCM 加密引擎

```javascript
CryptoEngine = {
  // 金鑰衍生（PBKDF2）
  deriveKey(orgCode, pin) {
    ✓ 使用 WebCrypto API
    ✓ 金鑰來源：pin + orgCode
    ✓ Salt：固定字符串 "REIBI-SALT-2025-v1"
    ✓ 迭代次數：100,000 (SHA-256)
    ✓ 算法：PBKDF2
    ✓ 派生金鑰：AES-GCM 256-bit
    ✓ 結果緩存：_keyCache (Map)
    return derivedKey
  },
  
  // 加密
  encrypt(key, plaintext) {
    ✓ IV (初始化向量)：12字節隨機值
    ✓ 算法：AES-GCM
    ✓ 格式：Base64(IV + Ciphertext)
    return base64_encrypted
  },
  
  // 解密
  decrypt(key, b64) {
    ✓ 提取 IV (前12字節)
    ✓ 提取密文 (後續字節)
    ✓ 驗證認證標籤 (GCM 內含)
    return plaintext || null
  },
  
  clearKey(orgCode, pin) {
    // 明確清除快取金鑰
  }
}
```

### 🔐 差分隱私 (Differential Privacy)

```javascript
DP_EPSILON = 0.8;                    // 隱私預算

dpNoise(sensitivity=1, epsilon=DP_EPSILON) {
  const u = Math.random() - 0.5;
  return (sensitivity / epsilon) * Math.sign(u) * Math.log(1 - 2*Math.abs(u))
  // Laplace 機制
}

// 用於統計
dpCount(trueCount) {
  return Math.max(0, Math.round(trueCount + dpNoise(1)))
}

dpPct(truePct) {
  return Math.min(100, Math.max(0, Math.round(truePct + dpNoise(5))))
}
```

### 👥 k-匿名性保護

```javascript
K_MIN = 5;                           // 最小群體大小

kAnonymize(data, showFn) {
  if (!Array.isArray(data) || data.length < K_MIN) {
    return null;                     // 抑制輸出 (Suppression)
  }
  return showFn(data);               // 群體足夠時才顯示
}

// 應用場景：
// - 部門統計 < 5 人 → 不顯示分佈
// - 高風險族群 < 5 人 → 警告提示
```

### 🧹 去識別化政策

| 層級 | 範圍 | 保留資訊 | 移除資訊 |
|-----|------|--------|--------|
| **個人層** | 本地存儲 | 所有 ISI/BPI/工作分、評估答案、建議、個人資料 | 無 |
| **組織層** | 單位服務器 | 分數、燈號、部門、疼痛部位、時間戳 | 姓名、UID、個人識別資料 |
| **統計層** | KPI/OKR報表 | 聚合數據、百分比、分佈 | 個體數據、部門資訊 |
| **公開層** | ESG報告 | 高層指標 (HPI、改善率、ROI) | 所有個體/部門資訊 |

### 📋 法規對齊聲明

```
✓ 台灣《個人資料保護法》(PDPA)
  ├─ 知情同意：登入前聲明模態框
  ├─ 目的限制：明確說明評估用途
  ├─ 使用限制：個人層與組織層分離
  └─ 安全保護：AES-256-GCM + Zero Trust

✓ GDPR 概念對齐 (可升級至完整合規)
  ├─ 透明性：隱私中心詳述機制
  ├─ 存取權：用戶可下載自身報告
  ├─ 刪除權：支援資料抹除功能 (future)
  └─ 攜帶權：PDF 匯出格式開放

✓ HIPAA-ready (可升級)
  ├─ 當前：應用層級加密
  ├─ 升級需：傳輸層 (TLS)、儲存層 (加密DB)、
  │        身份認證 (MFA)、稽核日誌 (完整)
  └─ 狀態：架構支援但需部署配置

✓ Zero Trust 架構
  ├─ 每次重驗
  ├─ 最小權限
  ├─ 行為監控
  └─ 段隔離 (應用層實現)
```

---

## 所有頁面路由

### 🗺️ 導航結構（基於 `onNav` 函數）

```
┌─ 登入分支 ──────────────────────────────┐
│                                           │
├─> individual → LoginScreen               │
│   ├─> assess → Dashboard → Assess Flow   │
│   └─> ...                                │
│                                           │
├─> org (首次設定)                          │
│   ├─> admin 首次設定 → 3組通行碼設定     │
│   └─> ...                                │
│                                           │
└─ 認證後導航流程 ──────────────────────┐
   │                                        │
   ├─ assess ─────────────────────────────┤
   │  └─ ProfileScreen                    │
   │     └─ SleepQ (7題)                  │
   │        └─ PainQ (5題)                │
   │           └─ WorkQ (3題)             │
   │              └─ LoadingScreen        │
   │                 └─ ReportScreen      │
   │                    ├─ 下載 PDF       │
   │                    ├─ 前往歷史追蹤   │
   │                    └─ 前往分析       │
   │                                       │
   ├─ history ────────────────────────────┤
   │  └─ HistoryScreen                    │
   │     ├─ 日期篩選                      │
   │     ├─ 查看 PDF                      │
   │     ├─ 匯出記錄                      │
   │     └─ 前往分析                      │
   │                                       │
   ├─ analysis ───────────────────────────┤
   │  └─ AnalysisPage                     │
   │     ├─ 睡眠趨勢圖 (需≥2次)           │
   │     ├─ 疼痛趨勢圖 (需≥2次)           │
   │     ├─ 工作效率圖                    │
   │     ├─ 自動療程建議                  │
   │     └─ 定期評估提醒                  │
   │                                       │
   ├─ org (KPI) ──────────────────────────┤
   │  └─ OrgKPIScreen  [管理者/部門主管]   │
   │     ├─ 日期篩選                      │
   │     ├─ 部門篩選 (管理者)              │
   │     ├─ HPI 指數卡片                  │
   │     ├─ 睡眠/疼痛分佈                 │
   │     ├─ 疼痛部位排行                  │
   │     ├─ KPI 公式計算                  │
   │     │  ├─ 改善率 KR ★ 主要            │
   │     │  ├─ 盛行率 KR                   │
   │     │  └─ 貢獻率 KR                   │
   │     └─ 下載報表                      │
   │                                       │
   ├─ okr ────────────────────────────────┤
   │  └─ OKRScreen  [管理者/部門主管]      │
   │     ├─ 日期篩選 (管理者)              │
   │     ├─ HPI 指數                      │
   │     ├─ OKR 3 大目標                  │
   │     │  ├─ O1: 提升睡眠健康            │
   │     │  ├─ O2: 降低疼痛影響            │
   │     │  └─ O3: 整體健促+參與率         │
   │     ├─ 💰 獎金計算器 (可編輯參數)    │
   │     │  ├─ 基礎獎金額度                │
   │     │  ├─ 啟動門檻                    │
   │     │  └─ 加成倍數                    │
   │     ├─ 📈 ROI 效益分析 (可編輯參數)   │
   │     │  ├─ 病假節省                    │
   │     │  ├─ 保險節省                    │
   │     │  ├─ 生產力提升                  │
   │     │  └─ 導入成本                    │
   │     ├─ 三階段健康認可制度             │
   │     └─ 下載報表                      │
   │                                       │
   ├─ appt ───────────────────────────────┤
   │  └─ ApptScreen  [所有角色]            │
   │     ├─ 🌊 舒曼共振減壓               │
   │     │  └─ 7.83Hz, 30-45分鐘          │
   │     ├─ ⚡ 激光物理干預                │
   │     │  └─ LA200 LLLT, 10-15分鐘      │
   │     ├─ 新增預約 (個人 + 成員)         │
   │     │  ├─ 日期選擇                    │
   │     │  ├─ 時段選擇 (16個)             │
   │     │  └─ 備註                        │
   │     ├─ 查閱排程 (管理者全部權限)      │
   │     │  ├─ 完成記錄                    │
   │     │  ├─ 取消預約                    │
   │     │  └─ 匯出/列印                   │
   │     └─ 排程日期區間篩選               │
   │                                       │
   ├─ esg ────────────────────────────────┤
   │  └─ ESGScreen  [管理者]               │
   │     ├─ ESG × 企業健管利基點           │
   │     ├─ 日期篩選                      │
   │     ├─ KPI 指標                      │
   │     │  ├─ HPI                        │
   │     │  ├─ 改善率 ★ 主要               │
   │     │  ├─ 盛行率                     │
   │     │  └─ 貢獻率                     │
   │     ├─ ROI 經濟效益                  │
   │     │  ├─ 病假節省                    │
   │     │  ├─ 保險節省                    │
   │     │  ├─ 生產力提升                  │
   │     │  └─ 淨效益 / ROI%               │
   │     └─ 下載報告                      │
   │                                       │
   ├─ highrisk ───────────────────────────┤
   │  └─ HighRiskPanel  [管理者]           │
   │     ├─ 高風險摘要卡片                │
   │     ├─ 健康分佈 (k-Anonymity 保護)   │
   │     ├─ 30天未評估警示                │
   │     ├─ 高風險族群介入建議             │
   │     └─ 轉介建議                      │
   │                                       │
   ├─ privacy ────────────────────────────┤
   │  └─ PrivacyCenter  [所有角色]         │
   │     ├─ 法規對齐聲明                  │
   │     │  ├─ PDPA / GDPR / HIPAA-ready  │
   │     │  ├─ Zero Trust                 │
   │     │  ├─ AES-256-GCM                │
   │     │  ├─ k-Anonymity                │
   │     │  └─ Differential Privacy       │
   │     ├─ 三大安全機制詳解              │
   │     ├─ 去識別化政策                  │
   │     ├─ 稽核日誌查詢                  │
   │     └─ 資料抹除申請 (future)         │
   │                                       │
   └─ dashboard ──────────────────────────┘
      └─ Dashboard  [首頁]
         ├─ 用戶卡片 (頭像/角色/部門)
         ├─ 9個快速導航磁貼
         ├─ 最近評估記錄
         └─ 登出按鈕
```

---

## 色彩系統與設計

### 🎨 完整色彩編碼

```javascript
C = {
  // 背景與基調
  bg: "#fdf8f3",                    // 淡米色主背景
  card: "#fff",                     // 卡片白
  border: "#e8ddd4",                // 淡灰邊框
  divider: "#e8ddd4",               // 分隔線
  shadow: "0 2px 12px rgba(42,34,32,0.08)",
  
  // 主色調
  teal: "#2a7d8c",                  // 💚 Teal (登入、主操作)
  tealBg: "#ebf6f8",
  tealLight: "#b8dfe5",
  
  coral: "#c05a28",                 // 🔴 Coral (疼痛、警告)
  coralBg: "#fdf2ec",
  
  amber: "#b07015",                 // 🟠 Amber (部門主管、参數編輯)
  amberBg: "#fdf6e8",
  
  sage: "#2d7a5a",                  // 🌿 Sage (成員、正面)
  sageBg: "#edf7f3",
  
  plum: "#6b4a8c",                  // 🟣 Plum (管理者、高層)
  plumBg: "#f5f0fb",
  
  // 文字
  text: "#2a2220",                  // 深灰 (主文字)
  muted: "#7a6e68",                 // 淺灰 (輔文字)
  faint: "#b8afa8",                 // 極淺灰 (提示)
}

// 燈號 LX (Light 系統)
LX = {
  green: { c: "#2d7a5a", bg: "#edf7f3", br: "#7ecfaa" },
  yellow: { c: "#b07015", bg: "#fdf6e8", br: "#f0c76a" },
  orange: { c: "#c05a28", bg: "#fdf2ec", br: "#f0b898" },
  red: { c: "#b82020", bg: "#fdf0f0", br: "#f0a0a0" },
}

// 燈號標籤 LL (Label)
LL = {
  green: "🟢 綠燈",
  yellow: "🟡 黃燈",
  orange: "🟠 橙燈",
  red: "🔴 紅燈",
}
```

---

## API 與存儲層

### 💾 存儲架構

```javascript
// 前端儲存層 (IndexedDB 包裝)
stor = {
  async get(key): Promise<value|null>,     // 讀取 (含自動解密)
  async set(key, value): Promise<void>,    // 寫入 (含自動加密)
  async del(key): Promise<void>,           // 刪除
  
  // 超時設置 (2.5秒)
  // 自動加密/解密判定：
  //   - 如果 _cryptoKey 存在 & 值包含 "ENC:" → 解密
  //   - 如果 _cryptoKey 存在 & 寫入 → 加密
}

// 業務層數據庫 (DB)
DB = {
  // 會話
  saveSession(session): Promise<void>,
  loadSession(): Promise<Session|null>,
  clearSession(): Promise<void>,
  
  // 個人檔案
  saveMemProfile(uid, profile): Promise<void>,
  loadMemProfile(uid): Promise<Profile|null>,
  
  // 評估報告（個人）
  saveReport(report): Promise<void>,
  loadReports(): Promise<Report[]>,
  
  // 組織級去識別化記錄
  saveOrgRec(orgCode, deIdRecord): Promise<void>,
  loadOrgRecs(orgCode): Promise<OrgRecord[]>,
  
  // 單位憑證
  getCreds(orgCode): Promise<Creds|null>,
  setCreds(orgCode, creds): Promise<void>,
  
  // OKR 參數
  getOKR(orgCode): Promise<OKRParams|null>,
  setOKR(orgCode, params): Promise<void>,
  
  // 預約排程
  getAppts(orgCode, service): Promise<Appointment[]>,
  setAppts(orgCode, service, appointments): Promise<void>,
}
```

### 🤖 AI 個人化建議引擎

```javascript
genRecs = async (profile, sleepTotal, sleepLevel, painTotal, painLevel, workTotal) => {
  // API 調用: Anthropic Claude Sonnet 4
  
  POST https://api.anthropic.com/v1/messages
  
  請求範例:
  {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1800,
    messages: [{
      role: "user",
      content: `台灣健康管理顧問，2022–2025循證醫學，個人化建議。
              回傳純JSON，6鍵，各150字繁體，直接從{開始。
              年齡${age} 睡眠${sleepTotal}/28→${sleepLevel.label} 疼痛${painTotal}/50→${painLevel.label}`
    }]
  }
  
  預期輸出:
  {
    "generalHealth": "... 150字 ...",
    "painEducation": "... 150字 ...",
    "sleepEducation": "... 150字 ...",
    "dietaryAdvice": "... 150字 ...",
    "physicalTherapy": "... 150字 ...",
    "reibiProducts": "... 150字 ..."
  }
  
  // 超時: 7秒
  // Fallback: FR (內建建議庫) 
}
```

### 📄 PDF 報告生成

```javascript
buildPDF(report, session): string {
  // 返回完整 HTML5 文檔 (A4 格式, print-optimized)
  
  包含:
  ✓ 漸層頭 (品牌 + 評估資訊)
  ✓ 誠實聲明確認
  ✓ ISI 睡眠評估詳細分項
  ✓ BPI 疼痛評估詳細分項
  ✓ 6 大個人化健康建議
  ✓ REIBI 療程建議
  ✓ 列印友善樣式
  ✓ 法律免責聲明
  
  返回值: 可用 window.open() 打開或下載
}
```

---

## 📊 主要計算公式

### 1️⃣ 健康促進指數 (HPI)

```
HPI = 100 - [
  (睡眠分數 ÷ 28 × 40%) +
  (疼痛分數 ÷ 50 × 40%) +
  (工作分數 ÷ 30 × 20%)
]

範圍: 0-100
評判:
  ≥ 75 = 良好
  50-74 = 需關注
  < 50 = 高風險
```

### 2️⃣ OKR KPI 主要指標

```
改善率 (Improvement Rate) ★ 主要KPI
= 改善人數 (燈號轉綠) ÷ 初始高風險人數 (橙/紅燈) × 100%

盛行率 (Prevalence Rate)
= 有問題人數 (橙/紅燈) ÷ 總評估人次 × 100%

全體貢獻率 (Total Impact Rate)
= 改善人數 ÷ 總評估人次 × 100%

目標: 改善率 ≥ 75% 為優異表現
```

### 3️⃣ 獎金計算

```
專案獎金 = [基礎額度 × (參與率 ÷ 門檻%)] + [基礎×30% × 綠燈達成率 × 倍數]

門檻: 參與率須達 activationPct (通常80%)
加成: valueMultiplier (1-5倍)
```

### 4️⃣ ROI 企業經濟效益

```
年度淨效益 = (病假節省 + 保險節省 + 生產力提升) − 導入成本

病假節省 = 減少病假天數 × 平均日薪 × 改善人數
保險節省 = 每人保險節省金額 × 改善人數
生產力提升 = (日薪 ÷ 22) × 效率提升% × 240工作天 × 改善人數

ROI% = 年度淨效益 ÷ 導入成本 × 100%
標竿: 每投1元回收3~5元
```

---

## 🎯 核心特色總結

| 特色 | 說明 | 創新點 |
|-----|------|-------|
| **雙層評估** | ISI睡眠 + BPI疼痛 | 首次整合睡眠×疼痛聯合評估 |
| **四色燈號** | 綠/黃/橙/紅 | 直觀風險分級系統 |
| **四層RBAC** | 個人/成員/主管/管理者 | 完整分權治理 |
| **零信任架構** | 30分鐘自動登出+重驗 | 無持久信任狀態 |
| **AES-256加密** | 應用層端到端 | WebCrypto API標準實現 |
| **k-匿名性** | <5人抑制統計 | 隱私保護門檻 |
| **差分隱私** | Laplace機制 | 聚合數據噪聲保護 |
| **AI建議** | Claude Sonnet 4 | 2022-2025循證醫學 |
| **PDF報告** | A4印友善 | 完整法律免責聲明 |
| **OKR系統** | 目標+獎金+ROI | 企業績效驅動 |
| **ESG報告** | 人力資本健康 | 永續治理指標 |
| **高風險預警** | 30天未評估追蹤 | 參與度保障機制 |
| **自主預約** | 舒曼波+激光療程 | 整合健管服務 |
| **趨勢分析** | 線性回歸預測 | 健康軌跡預測 |

---

## 📝 附錄：內建建議庫 (FR - Fallback Recommendations)

當 API 失敗時自動降級使用：

```javascript
FR = {
  generalHealth: "依據衛福部2023–2026年國民健康白皮書...",
  painEducation: "2023年IASP建議採多模式疼痛管理...",
  sleepEducation: "失眠認知行為治療(CBT-I)為2024年指南一線治療...",
  dietaryAdvice: "地中海飲食持續顯示對三高、慢性疼痛及睡眠有正向效益...",
  physicalTherapy: "多模式物理治療可改善慢性疼痛(30–40%)及睡眠品質...",
  reibiProducts: "REIBI舒曼波療法(7.83Hz)調節自律神經、降低皮質醇...",
}
```

---

**文件生成時間**：2026年4月27日  
**數據來源**：sleepplatform.txt 完整代碼解析  
**版本**：1.0 · Zero Trust Security v1.0
