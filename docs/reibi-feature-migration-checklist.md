# REIBI 完整功能移植清單

最後盤點日期：2026-08-12
工作分支：`codex/reibi-fastapi-merge`

## 1. 範圍與完成定義

本清單以四個已發布 Artifact 的原始碼為功能基準：

- 主平台：`reibi-v10_3_34_20260730.jsx`
- L5 後台：`reibi-l5_v2_14_20260717.jsx`
- 報價／合約：`reibi-quote_v1_13_20260717.jsx`
- D 層工單：`reibi-workorder_v1_4_20260707.jsx`

狀態標記：

- `[x]` 已完成且已驗證
- `[-]` 已有骨架或部分功能，尚未達到完整驗收標準
- `[ ]` 尚未開始
- `[~]` 刻意延後，依賴外部服務或使用者決策

任何模組只有同時符合以下條件，才可改為 `[x]`：

1. Artifact 行為與欄位已逐項對照，已記錄刻意不搬移的差異。
2. Supabase schema、索引、外鍵、資料保留規則與 migration 完整。
3. FastAPI 具備輸入驗證、分頁、錯誤處理、權限與組織範圍限制。
4. 前端具備載入中、空狀態、錯誤狀態、成功回饋及手機版可用性。
5. `service_role` 不出現在前端；瀏覽器不直接操作 REIBI 資料表。
6. 後端單元／API 測試、前端型別／production build、資料庫 advisor 均通過。
7. 涉及既有 Artifact 資料時，完成 dry-run、筆數核對、重複匯入與失敗回復測試。
8. 涉及 AI 時只使用 Gemini，並記錄實際 `ai_model`；歷史文字不得偽標為 Gemini 產出。

## 2. 目前整體狀態

| 項目 | 狀態 | 現況 |
|---|---|---|
| Draft Pull Request | `[x]` | 已由使用者建立 |
| Supabase baseline | `[x]` | 本機與遠端 migration 一致 |
| Database hardening | `[x]` | `anon`／`authenticated` 無 REIBI 表權限 |
| REIBI domain schema | `[x]` | 20 張 `reibi_*` 表，20/20 啟用 RLS |
| FastAPI REIBI router | `[-]` | 有企業、報價、合約、工單基礎 API 與 Artifact 預檢／匯入 |
| Next.js REIBI 管理頁 | `[-]` | 有企業基本資料與 Artifact 預檢；尚無完整業務模組 |
| Artifact 欄位映射 | `[-]` | 主要 storage keys 已映射；仍需以實際匯出檔驗證 |
| Python 測試環境 | `[x]` | 工作區 `.venv` 已以 Python 3.11.9 重建；依賴檢查及 16 項後端測試通過 |
| 四 Artifact JSON 匯出 | `[ ]` | 尚未加入已發布 Artifact |
| `reibi_super` 安全登入 | `[ ]` | 後端角色守門已存在，但沒有可信登入來源 |
| 既有資料正式匯入 | `[ ]` | 必須等匯出工具與 `reibi_super` 完成 |

## 3. 全域基礎與資安

### FND：共用基礎

- [x] FND-01 FastAPI 為唯一 REIBI 資料存取層。
- [x] FND-02 前端環境只含 API URL，不含 Supabase secret/service-role key。
- [x] FND-03 REIBI 表 RLS 與資料表權限 hardening。
- [x] FND-04 新 AI 實作統一使用 Gemini。
- [ ] FND-05 統一 API response schema、錯誤代碼與 request correlation ID。
- [ ] FND-06 重要寫入操作 audit log（操作者、組織、動作、目標、前後狀態）。
- [ ] FND-07 標準分頁、排序、搜尋與日期範圍參數。
- [ ] FND-08 共用前端 REIBI layout、側欄／導覽、權限式選單與 breadcrumb。
- [ ] FND-09 共用表格、篩選、表單、確認對話框、列印與匯出元件。
- [ ] FND-10 PII／健康資料 log redaction 與錯誤訊息脫敏。
- [ ] FND-11 檔案上傳的大小、MIME、雜湊、路徑與惡意內容防護。
- [~] FND-12 Supabase Auth leaked-password protection（Dashboard 設定，遠端 advisor 目前唯一警告）。

### IAM：身分與權限

- [-] IAM-01 現有 `individual/member/dept_head/admin` JWT 登入。
- [ ] IAM-02 將 Artifact 的角色矩陣整理成後端單一權威來源。
- [ ] IAM-03 支援 `admin_hr/admin_finance/admin_it/occupational_health` 的可信身分與權限。
- [ ] IAM-04 支援 L5 內部角色及經銷商角色，不再使用 Artifact 測試模式登入。
- [ ] IAM-05 建立 `reibi_super` 內部帳號與安全登入；禁止以單位共用 PIN 取得此角色。
- [ ] IAM-06 管理者建立、停用、重設角色及撤銷 session。
- [ ] IAM-07 前後端權限矩陣自動化測試，避免 UI 顯示與 API 權限脫節。
- [ ] IAM-08 部門必選角色與 `session.dept` 的伺服器端驗證。

## 4. 主平台功能

### MP-01 登入、組織與個人評估核心

- [-] MP-01A 個人／組織登入、單位代碼驗證與 JWT session。
- [-] MP-01B 睡眠、疼痛、工作影響評估及報告保存。
- [-] MP-01C 個人報告、歷史紀錄、PDF 與趨勢分析。
- [ ] MP-01D Artifact 原有角色、部門選擇與訂閱閘門的完整對照測試。
- [ ] MP-01E 評估資料與 `reibi_health_assessments`／既有 `sleep_reports` 的去重與權威來源決策。

### MP-02 個人健康自主管理

- [x] MP-02A 每日行動打卡與積分 ledger（不可只存總分）。
- [x] MP-02B 積分紀錄、兌換／調整規則與稽核。
- [x] MP-02C 睡眠日記（睡眠效率、夜醒與歷史）。
- [x] MP-02D 疼痛日誌（部位、強度、干擾與歷史）。
- [x] MP-02E 三高／BMI 個人資料、部門 opt-in 與 k≥5 彙整。
- [x] MP-02F 888 曲線、個人時間軸與行動追蹤。
- [x] MP-02G 使用回饋、成效問卷及回饋報告。

### MP-03 心理健康、EAP 與職安問卷

- [x] MP-03A PHQ-4、PSS-4、正念自評及 MHI 計算。
- [x] MP-03B BSRS-5 與自殺意念敏感轉介流程。
- [x] MP-03C 過勞評估、提醒週期、個人歷史與高風險判定。
- [x] MP-03D 肌肉骨骼 NMQ 評估與歷史。
- [x] MP-03E 職場不法侵害自評與隱私邊界。
- [x] MP-03F 職安問卷入口與匿名填答活躍度。
- [x] MP-03G EAP 資源、轉介、緊急提示與資源內容管理。

### MP-04 職業健康與 OHS

- [x] MP-04A occupational-health 帳號與去識別化 roster。
- [x] MP-04B 過勞追蹤名單、排程、狀態與訪談紀錄。
- [x] MP-04C 臨場健康服務訪談紀錄。
- [x] MP-04D OHS 危害辨識、措施、追蹤與定期檢討。
- [x] MP-04E OHS 計畫書／報告列印與版本留存。
- [x] MP-04F 組織層級只能顯示 k≥5 的彙整資料。

### MP-05 組織管理與分析

- [-] MP-05A KPI、OKR、高風險、ESG 現有 sleepm 頁面。
- [ ] MP-05B 888 計畫總覽、完整報告及時間軸。
- [ ] MP-05C 年度統計、部門趨勢與 dept_head 專屬篩選。
- [ ] MP-05D ROI 參數與財務效益計算。
- [ ] MP-05E GRI 403-6 報告。
- [ ] MP-05F ESG／OKR／高風險／KPI／ROI／888 的 Gemini 組織報告。
- [ ] MP-05G CSV/PDF 匯出與列印（在一般瀏覽器環境重做，不沿用 Artifact 沙盒 workaround）。

### MP-06 組織設定與服務流程

- [x] MP-06A 部門 L1-L4 CRUD、排序、直接／含下層人數、上層關係與循環防護。
- [ ] MP-06B 部門 CSV 範本、匯入預檢與架構確認書。
- [ ] MP-06C 組織設定、帳號上限、產業別與方案設定。
- [ ] MP-06D 預約排程、服務場域與預約前置帶入。
- [ ] MP-06E 服務申請、變更需求與處理狀態。
- [ ] MP-06F 應付款、匯款申報、Gemini OCR／辨識與人工覆核。
- [ ] MP-06G 個人訂閱申請、查詢、審核、啟用與到期。
- [ ] MP-06H 隱私、資安文件、稽核紀錄、定價與 About REIBI。

## 5. L5 專屬管理後台

### L5-01 作業

- [ ] L5-01A 依角色顯示的總覽與待辦統計。
- [ ] L5-01B 新案開通流程、流水號與憑證函。
- [-] L5-01C 企業管理基本資料；目前企業管理者可完整維護自身企業，跨企業總覽須等 `reibi_super` 安全登入完成。
- [x] L5-01D 企業場域、設備、A/B/C/D 四層方案、授權用量、平台帳號核對與合約狀態。
- [ ] L5-01E 服務工單與企業／經銷商範圍限制。
- [ ] L5-01F 預約管理。
- [ ] L5-01G 點線面地圖／區域視圖。

### L5-02 財務

- [x] L5-02A 付款時程與應收狀態。
- [x] L5-02B 匯款申報比對與覆核。
- [x] L5-02C 發票 CRUD、品項、稅額、狀態與匯款關聯。
- [x] L5-02D 個人訂閱審核、啟用碼重新核發與發票關聯。

### L5-03 夥伴與內部人員

- [x] L5-03A 經銷商 CRUD、上下線、區域、等級與服務人員。
- [x] L5-03B 分潤計算、護欄、佣金明細與年度業績。
- [x] L5-03C 合作夥伴／推薦人 CRUD 與預設比例。
- [x] L5-03D REIBI staff CRUD、職稱、啟停用與接單歸戶。
- [x] L5-03E 經銷商可見資料與內部角色可見資料隔離測試。

### L5-04 系統與分析

- [ ] L5-04A 授權管理、PIN／憑證重設與安全替代方案。
- [ ] L5-04B LINE 推播佇列、範本、寄送結果與 message logs。
- [ ] L5-04C 跨企業健康大數據（僅 k≥5）。
- [ ] L5-04D 報表中心、日期篩選與可下載檔案。
- [ ] L5-04E 名冊查詢。
- [ ] L5-04F 策略面板與區域／夥伴分析。
- [ ] L5-04G 操作手冊與版本資訊。

## 6. 報價與合約

### QT-01 報價

- [x] QT-01A 快速報價試算。
- [x] QT-01B 報價完整 UI、API、編輯、搜尋與詳情。
- [x] QT-01C 新案／經銷商／升級／續約四種報價流程。
- [x] QT-01D A-E 層費用、設備、D 層項目、場域與付款模式計算。
- [x] QT-01E 經銷商、合作夥伴、staff 關聯與分潤護欄。
- [x] QT-01F 正式流水號並處理並行建立衝突。
- [x] QT-01G 草稿、發送、確認、作廢、已轉合約生命週期。
- [x] QT-01H 報價列印／PDF 與版本快照。

### CT-01 合約

- [x] CT-01A 合約完整 UI、API、受控編輯與詳情。
- [x] CT-01B 報價轉合約，以單一資料庫交易保證一致性。
- [x] CT-01C 企業／經銷商／補充／續約合約條款。
- [x] CT-01D 簽署、用印、執行、到期與 90 天續約提醒。
- [x] CT-01E 從原合約建立升級／續約報價。
- [x] CT-01F 合約列印／PDF、簽署欄位與不可變版本快照。

## 7. D 層工單與驗收

- [x] WO-01 工單完整 UI、API 與驗收流程。
- [x] WO-02 從合約建立工單並帶入企業、場域與 D 層項目。
- [x] WO-03 服務項目、規格、數量、備註與自訂項目。
- [x] WO-04 施工前 REIBI／客戶雙方範圍確認。
- [x] WO-05 草稿、發出、出貨、安裝、待驗收生命週期。
- [x] WO-06 逐項驗收 pass/fail、異常說明與 punch list。
- [x] WO-07 客戶簽名、驗收日期與驗收結果。
- [x] WO-08 狀態歷史、操作者與不可變稽核紀錄。
- [x] WO-09 工單／驗收單列印或 PDF。

## 8. Artifact 匯出與既有資料搬移

### EXP：四個 Artifact 匯出

- [ ] EXP-01 定義版本化 JSON envelope、來源版本、匯出時間與 SHA-256。
- [ ] EXP-02 主平台匯出工具；排除 session、PIN、token、lock 與暫存資料。
- [ ] EXP-03 L5 匯出工具。
- [ ] EXP-04 quote 匯出工具。
- [ ] EXP-05 workorder 匯出工具。
- [ ] EXP-06 每個 Artifact 重新發布後，以有意義的測試資料驗證匯出。
- [ ] EXP-07 大資料分批／分檔與 20 MB Artifact 限制處理。
- [ ] EXP-08 使用者保管原始匯出檔與匯出前筆數截圖，作為核對依據。

### IMP：預檢與匯入

- [-] IMP-01 JSON schema、10 MB／5,000 entries 限制、敏感欄位移除與 target planning。
- [-] IMP-02 import batch／record、SHA-256 去重與失敗摘要。
- [ ] IMP-03 真實匯出檔逐 key 預檢與欄位差異報告。
- [ ] IMP-04 前端只開放 `reibi_super` 的正式匯入確認流程。
- [ ] IMP-05 匯入前資料庫備份／還原點與操作 runbook。
- [ ] IMP-06 分 Artifact、分批匯入與可重跑策略。
- [ ] IMP-07 來源筆數、imported/skipped/rejected、目標筆數與關聯完整性核對。
- [ ] IMP-08 敏感資料、k≥5、舊 activation code、歷史 AI provider 抽樣驗證。
- [ ] IMP-09 匯入完成簽核與 Artifact 舊系統唯讀／退役決策。

## 9. 測試、品質與發布

### TST：測試環境

- [x] TST-01 安裝 Python 3.11.9，重建工作區 `.venv`。
- [x] TST-02 `pip check`、compile、unit test 與 FastAPI TestClient 均通過。
- [ ] TST-03 對 Supabase client 建立 fake／integration test 分層。
- [ ] TST-04 每個角色的 401／403、跨組織 IDOR/BOLA 測試。
- [ ] TST-05 Artifact mapping fixture 與真實匯出樣本回歸測試。
- [x] TST-06 前端 production build 通過。
- [ ] TST-07 前端主要流程瀏覽器 smoke test 與手機版檢查。
- [x] TST-08 migration 從空資料庫重播成功。
- [x] TST-09 本機 database advisors 無 warning/error。
- [-] TST-10 遠端 advisors：schema 無問題，Auth leaked-password protection 待啟用。
- [ ] TST-11 完整 E2E：登入→建立企業→報價→合約→工單→驗收。
- [ ] TST-12 效能、分頁、大檔匯入與併發寫入測試。

### REL：合併與上線

- [ ] REL-01 每一批功能維持 Draft PR，通過測試才標記 ready for review。
- [ ] REL-02 migration、API、前端與 runbook code review。
- [ ] REL-03 遠端 schema／資料備份與正式匯入演練。
- [ ] REL-04 選定 Railway 替代部署平台或恢復付費部署；目前不阻擋本機開發。
- [ ] REL-05 設定正式 secrets、CORS、網域、HTTPS、監控與錯誤告警。
- [ ] REL-06 完整驗證後才合併到 `main`。

## 10. 外部整合（不阻擋核心移植）

- [~] EXT-01 正式 Email OTP／通知服務。
- [~] EXT-02 財政部 B2B 電子發票 API。
- [~] EXT-03 ECPay／LINE Pay 金流。
- [~] EXT-04 LINE Messaging API 正式推播。
- [~] EXT-05 occupational-health 正式 PDF 報告格式。

## 11. 建議實作批次

1. **Batch A：企業、場域與部門管理** — 租戶範圍功能已完成；L5-01C 的跨企業總覽併入 `reibi_super` 登入批次。
2. **Batch B：報價→合約→工單→驗收閉環** — QT-01、CT-01、WO-01～WO-09。
3. **Batch C：L5 夥伴與財務** — L5-02、L5-03。
4. **Batch D：個人健康與職安** — MP-02、MP-03、MP-04。
5. **Batch E：組織分析與 Gemini 報告** — MP-05、L5-04C～L5-04F。
6. **Batch F：其餘設定、服務與外部整合介面** — MP-06、L5-04。
7. **Batch G：Artifact 匯出、`reibi_super`、正式資料匯入** — EXP、IAM-05、IMP。

第一個實作批次固定以「企業、場域與部門管理」開始，因報價、合約、工單、職安與彙整資料都依賴正確的企業與部門關聯。

## 12. Batch B 完成紀錄（2026-08-12）

- [x] QT-01A～QT-01H：快速試算、A–E 層計價、設備／施工場域、企業／經銷商／升級／續約流程、關聯防呆、並發安全編號、狀態流程、版本快照、列印／另存 PDF。
- [x] CT-01A～CT-01F：報價原子轉合約、企業／經銷商／補充／續約條款、簽署／用印／執行資料、90 天到期提醒、由合約建立升級／續約報價、不可變更快照與列印／另存 PDF。
- [x] WO-01～WO-09：由合約帶入客戶／施工場域／D 層項目、項目規格數量與備註、雙方範圍確認、完整生命週期、逐項 pass/fail、缺失改善、客戶簽署、狀態歷程與列印／另存 PDF。
- [x] DB-B01：正式文件編號改由 PostgreSQL sequence 產生，避免並發撞號。
- [x] DB-B02：報價轉合約由單一 PostgreSQL transaction 完成，避免重複轉換或半套資料。
- [x] DB-B03：新增函式與 sequence 僅授權 `service_role`，`anon`／`authenticated` 不可執行。
- [x] TST-B01：20 個 Python 單元測試、8 個 pgTAP 資料庫測試、Next.js production build 全部通過。

## 13. Batch C 完成紀錄（2026-08-12）

- [x] FIN-C01：依 L5 Artifact 唯一權威 `buildEntPaymentRows` 公式建立 A1–A3、B1–B3、C1–C3、D1–D2 應收時程，保留到期、待確認、部分付款、已付款與通知日期。
- [x] FIN-C02：匯款申報、人工比對、跨應收項目配置與原子沖帳；重複覆核由 FastAPI 擋下。
- [x] FIN-C03：發票草稿 CRUD、品項、5% 稅額、受控狀態、匯款與 B2C 訂閱關聯。
- [x] FIN-C04：個人訂閱審核、到期日與啟用碼重發；新碼只回傳一次，資料庫只保存 SHA-256 與末四碼，舊 Artifact 明碼保留待正式匯入預檢決策。
- [x] PAR-C01：經銷商主／次層級、區域、等級、服務人員、三方合約分配欄位與停用流程。
- [x] PAR-C02：銀／金／白金／戰略四等級 A/B/C 獨立分潤、LA200 併入 B 層、預設 65% REIBI 保留下限、資料庫觸發器護欄、月結帳冊與年度業績。
- [x] PAR-C03：合作夥伴／推薦人與 REIBI staff CRUD、預設比例、職稱、啟停用。
- [x] PAR-C04：一般企業只能讀寫自身財務；跨企業內部資料只限 `reibi_super`；經銷商入口只回傳自己的企業、應收與分潤，不回傳內部 staff／設定／其他經銷商資料。
- [x] DB-C01：Batch C migration 與後續佣金護欄 migration 已套用遠端 Supabase；所有新表啟用 RLS，browser roles 無權限，僅 FastAPI `service_role` 可存取。
- [x] TST-C01：26 個 Python 測試、18 個 pgTAP 資料庫測試、Next.js production build、本機 migration 全量重播與 database lint 全部通過；遠端 6 個 migration 與本機一致。

## 14. Batch D 完成紀錄（2026-08-12）

- [x] HLTH-D01：22 項行動打卡、同項 7 天間隔、不可為負的積分 ledger、兌換與管理調整稽核。
- [x] HLTH-D02：睡眠效率與睡眠／疼痛日誌歷史、888 週曲線、個人時間軸及季度回饋。
- [x] HLTH-D03：三高／BMI 個人資料、首次／年度／確診每月積分週期、更新提醒、明確 opt-in 與資料庫端 k≥5 彙整。
- [x] HLTH-D04：PHQ-4、PSS-4、正念三題、MHI、過勞、NMQ、BSRS-5、自殺意念緊急指引與不法侵害隱私聲明。
- [x] OHS-D01：職安問卷活躍度低於 5 份即隱藏；不法侵害不納入管理者活躍度統計，管理者看不到個人問卷答案。
- [x] OHS-D02：EAP 緊急／一般資源與內容管理；預設提供 1925、119 與專業轉介資訊。
- [x] OHS-D03：獨立 occupational-health PIN、roster 開關、去識別化員工代碼、排程／追蹤／面談與角色範圍限制。
- [x] OHS-D04：危害風險矩陣、改善措施、定期檢討、計畫版本快照及完整列印／另存 PDF。
- [x] DB-D01：新增資料表全面啟用 RLS；table、sequence 與 security-definer functions 均禁止 browser roles，僅 FastAPI `service_role` 可操作。
- [x] TST-D01：36 個 Python 測試、34 個 pgTAP 資料庫測試、本機 migration 全量重播、Next.js production build 與本機／遠端 database lint 通過；遠端 7 個 migrations 與本機一致。
- [~] TST-D02：遠端 security advisors 只留下既有的 leaked-password protection 警告；「RLS 無 policy」為刻意採 FastAPI `service_role` 邊界並撤銷 browser grants 的拒絕預設設計。新索引因剛建立、尚無正式流量，performance advisors 暫列 unused index 資訊。
- [ ] AI-D01：OHS／組織分析的 AI 報告統一改用 Gemini；依規劃留在 Batch E，不沿用 Artifact 的 Anthropic 呼叫。
