# REIBI 完整功能移植清單

專案環境、部署、操作與接手流程請見 [完整建置、進度與操作交接手冊](reibi-merge-master-handoff.md)。

最後盤點日期：2026-08-17
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
- `[N/A]` 經核准的範圍決策明確排除，不列入未完成進度

舊 Artifact 資料搬遷已依 [2026-08-14 範圍決策](reibi-legacy-data-scope-decision.md) 排除：不匯出或匯入既有 `window.storage`，新 Supabase 業務資料乾淨起始；既有匯出／匯入能力保留為選用復原工具。

任何模組只有同時符合以下條件，才可改為 `[x]`：

1. Artifact 行為與欄位已逐項對照，已記錄刻意不搬移的差異。
2. Supabase schema、索引、外鍵、資料保留規則與 migration 完整。
3. FastAPI 具備輸入驗證、分頁、錯誤處理、權限與組織範圍限制。
4. 前端具備載入中、空狀態、錯誤狀態、成功回饋及手機版可用性。
5. `service_role` 不出現在前端；瀏覽器不直接操作 REIBI 資料表。
6. 後端單元／API 測試、前端型別／production build、資料庫 advisor 均通過。
7. 涉及且已核准搬移既有 Artifact 資料時，完成 dry-run、筆數核對、重複匯入與失敗回復測試；目前舊資料搬遷為 `[N/A]`。
8. 涉及 AI 時只使用 Gemini，並記錄實際 `ai_model`；歷史文字不得偽標為 Gemini 產出。

## 2. 目前整體狀態

| 項目 | 狀態 | 現況 |
|---|---|---|
| Draft Pull Request | `[x]` | 已由使用者建立 |
| Supabase baseline | `[x]` | 本機與遠端 migration 一致 |
| Database hardening | `[x]` | `anon`／`authenticated` 無 REIBI 表權限 |
| REIBI domain schema | `[x]` | 38 張 `reibi_*` 表，均由 migration 建立並採 deny-by-default RLS／grants |
| FastAPI REIBI router | `[-]` | 主要業務、身分與 L5 角色化總覽 API 已完成；尚待統一 response／稽核、全 endpoint 權限矩陣及 E2E |
| Next.js REIBI 管理頁 | `[-]` | 主要商務、健康、分析、設定、帳號及 L5 總覽流程已完成；尚待地圖、部分 UX 與瀏覽器 E2E |
| Artifact 欄位映射 | `[x]` | 主要 storage keys 與目標表已完成程式對照；因舊資料不搬遷，不要求真實匯出檔驗證 |
| Python 測試環境 | `[x]` | Python 3.11.9 與 `backend/.venv` 已重建，`requirements-dev.txt` 固定 pytest 8.4.2；2026-08-17 為 84 項後端與 135 項 pgTAP 測試通過 |
| 四 Artifact JSON 匯出 | `[N/A]` | JSX 已具備匯出工具，但依範圍決策不重新發布、不執行真實匯出 |
| `reibi_super` 安全登入 | `[x]` | 第一位正式帳號 `reibicare9881@gmail.com`（麗媚AI）已完成 Email、密碼、TOTP 綁定及 staging AAL2 登入驗證 |
| 既有資料正式匯入 | `[N/A]` | 依範圍決策不搬移舊 `window.storage`；新 Supabase 業務資料乾淨起始 |

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
- [x] IAM-02 將 Artifact 的 15 個來源角色正規化為 14 個可信角色，後端 `roles.py` 為權限判定來源；`admin_reibi` 與 L5 `super` 合併為 `reibi_super`。
- [x] IAM-03 支援 `admin_hr/admin_finance/admin_it/occupational_health` 的 Supabase Auth 可信身分與企業／部門範圍。
- [x] IAM-04 支援 L5 `reibi_super/reibi_finance/reibi_data/reibi_cs` 與兩種經銷商可信角色；新增角色不能由舊共用 PIN 取得。
- [x] IAM-05 已完成 Supabase Auth、內部白名單、可撤銷 session、登入限速、既有帳號 TOTP self-enrollment 與 AAL2 強制流程；第一位正式 `reibi_super` 已完成 QR Code 綁定及 AAL2 登入。
- [x] IAM-06 `reibi_super` 可跨範圍邀請、停用及撤銷 session；單位 `admin` 只能管理自己企業的非 admin 角色，並防止自我停用與最後一位超管被停用。
- [-] IAM-07 已有 14 角色、權限、可信 session 與資料庫 scope 測試；全站逐 endpoint 的 401／403 矩陣仍併入 TST-04。
- [x] IAM-08 五種部門必選角色由 DB constraint、跨表 trigger 與 FastAPI 同時驗證，登入 token 的 `session.dept` 取自伺服器資料。

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

- [x] MP-05A KPI、OKR、高風險、ESG 現有 sleepm 頁面。
- [x] MP-05B 888 計畫總覽、完整報告及時間軸。
- [x] MP-05C 年度統計、部門趨勢與 dept_head 專屬篩選。
- [x] MP-05D ROI 參數與財務效益計算。
- [x] MP-05E GRI 403-6 報告。
- [x] MP-05F ESG／OKR／高風險／KPI／ROI／888 的 Gemini 組織報告。
- [x] MP-05G CSV/PDF 匯出與列印（在一般瀏覽器環境重做，不沿用 Artifact 沙盒 workaround）。

### MP-06 組織設定與服務流程

- [x] MP-06A 部門 L1-L4 CRUD、排序、直接／含下層人數、上層關係與循環防護。
- [x] MP-06B 部門 CSV 範本、匯入預檢、原子取代與架構確認書列印。
- [x] MP-06C 組織設定、帳號上限、產業別與方案設定。
- [-] MP-06D 預約排程、服務場域與預約前置帶入；既有排程與場域可用，Batch F 已補組織越權防護及場域欄位，場域前置選單仍待 UX 整合。
- [x] MP-06E 服務申請、變更需求與受控處理狀態。
- [x] MP-06F 應付款、匯款申報、私有憑證保存、Gemini OCR／信心標記與人工覆核。
- [x] MP-06G 個人訂閱申請、查詢、審核、一次性啟用碼與到期。
- [-] MP-06H 隱私、資安文件、稽核紀錄與版本／操作說明已整合；完整定價與 About REIBI 專頁仍待內容確認。

## 5. L5 專屬管理後台

### L5-01 作業

- [x] L5-01A 依角色顯示的總覽、待辦與即時通知；採現有業務 table 動態聚合，不新增通知 table。FastAPI 依四種內部角色與兩種經銷商角色裁切欄位／企業範圍，Next.js 提供 L5 總覽入口。
- [x] L5-01B 新案開通三步驟、交易式企業／場域建立、並發安全案件／企業／憑證流水號，以及不含密碼或共用 PIN 的 PDF 憑證函。
- [x] L5-01C 企業管理基本資料；企業管理者只能維護自身企業，`reibi_super`／`reibi_finance` 可在跨企業目錄搜尋、篩選及選定企業，再管理基本資料、授權、場域與部門。所有讀寫仍由 FastAPI 逐次驗證 `org_code`。
- [x] L5-01D 企業場域、設備、A/B/C/D 四層方案、授權用量、平台帳號核對與合約狀態。
- [x] L5-01E 服務案件與企業範圍限制完成；主經銷商可查看及選擇自身與直屬子經銷商企業，次級經銷商只限自身企業。案件清單、建立案件與 L5 統計均由 FastAPI 重新驗證可信角色範圍。
- [x] L5-01F 預約管理與組織越權防護。
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

- [-] L5-04A 已完成不保存明文 PIN 的憑證復原／權限申請、人工核驗佇列、正式 `reibi_super` 登入及邀請密碼設定；完整管理者復原情境 E2E 仍待驗收。
- [-] L5-04B 已完成 LINE 範本、草稿、人工複製、API 發送與失敗記錄；正式上線仍須提供 LINE channel access token 並做端對端驗收。
- [x] L5-04C 跨企業健康大數據（明確研究同意且每個企業及指標子群均為 k≥5）。
- [x] L5-04D 報表中心、日期篩選、CSV 與列印／另存 PDF。
- [x] L5-04E 企業／經銷商名冊查詢；不提供個人健康名冊。
- [x] L5-04F 策略面板與區域／夥伴分析。
- [x] L5-04G 操作手冊、Artifact 來源版本、API 與 Batch 版本資訊。

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

本節的技術能力已保留，但真實舊資料搬遷依 [範圍決策](reibi-legacy-data-scope-decision.md) 不執行；下列 `[N/A]` 不計入未完成進度。

### EXP：四個 Artifact 匯出

- [x] EXP-01 定義版本化 JSON envelope、來源版本、匯出時間與 SHA-256。
- [x] EXP-02 主平台匯出工具；排除 session、PIN、token、lock 與暫存資料。
- [x] EXP-03 L5 匯出工具。
- [x] EXP-04 quote 匯出工具。
- [x] EXP-05 workorder 匯出工具。
- [N/A] EXP-06 不重新發布已發布 Artifact，也不以真實舊資料執行匯出驗收。
- [x] EXP-07 大資料分批／分檔與 20 MB Artifact 限制處理。
- [N/A] EXP-08 不產生真實舊資料匯出檔與筆數截圖。

### IMP：預檢與匯入

- [x] IMP-01 JSON schema、10 MB／5,000 entries 限制、敏感欄位移除、SHA-256 驗證與 target planning。
- [x] IMP-02 import batch／record、SHA-256 去重、失敗摘要與 retry lineage。
- [N/A] IMP-03 不取得真實匯出檔，因此不執行逐 key 預檢與差異報告。
- [x] IMP-04 前端只開放 `reibi_super` 的正式匯入確認流程。
- [x] IMP-05 匯入前資料庫備份／還原點與操作 runbook。
- [x] IMP-06 分 Artifact、分批匯入與可重跑策略。
- [N/A] IMP-07 不執行舊資料來源／目標筆數與關聯核對。
- [N/A] IMP-08 不執行舊資料匯入抽樣；新資料仍須遵守敏感資料、k≥5、憑證與 Gemini 規則。
- [N/A] IMP-09 不需要舊資料匯入簽核；舊 Artifact 的唯讀保留／退役日期另依保留需求決定。

## 9. 測試、品質與發布

### TST：測試環境

- [x] TST-01 安裝 Python 3.11.9，重建工作區 `.venv`。
- [x] TST-02 `pip check`、compile、unit test 與 FastAPI TestClient 均通過。
- [ ] TST-03 對 Supabase client 建立 fake／integration test 分層。
- [ ] TST-04 每個角色的 401／403、跨組織 IDOR/BOLA 測試。
- [ ] TST-05A Artifact mapping 的合成 fixture 回歸測試。
- [N/A] TST-05B 真實 Artifact 匯出樣本回歸測試；依範圍決策不取得真實舊資料。
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
- [ ] REL-03 遠端 schema／新系統資料備份與乾淨起始演練；舊 Artifact 正式匯入演練為 `[N/A]`。
- [x] REL-04 Railway Hobby staging 後端已建立，可進行遠端整合測試。
- [ ] REL-05 設定正式 secrets、CORS、網域、HTTPS、監控與錯誤告警。
- [ ] REL-06 完整驗證後才合併到 `main`。

## 10. 外部整合（不阻擋核心移植）

- [~] EXT-01 正式 Email OTP／通知服務。
- [~] EXT-02 財政部 B2B 電子發票 API。
- [~] EXT-03 ECPay／LINE Pay 金流。
- [~] EXT-04 LINE Messaging API 正式推播。
- [~] EXT-05 occupational-health 正式 PDF 報告格式。

## 11. 建議實作批次

1. **Batch A：企業、場域與部門管理** — 租戶範圍與 `reibi_super` 登入已完成；L5-01C 的跨企業總覽 UI／E2E 仍待補齊。
2. **Batch B：報價→合約→工單→驗收閉環** — QT-01、CT-01、WO-01～WO-09。
3. **Batch C：L5 夥伴與財務** — L5-02、L5-03。
4. **Batch D：個人健康與職安** — MP-02、MP-03、MP-04。
5. **Batch E：組織分析與 Gemini 報告** — MP-05、L5-04C～L5-04F。
6. **Batch F：其餘設定、服務與外部整合介面** — MP-06、L5-04。
7. **Batch G：Artifact 匯出／匯入能力與 `reibi_super`** — EXP、IAM-05、IMP 的技術能力已完成；真實舊資料執行面依 2026-08-14 決策為 `[N/A]`。

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
- [x] FIN-C04：個人訂閱審核、到期日與啟用碼重發；新碼只回傳一次，資料庫只保存 SHA-256 與末四碼；舊 Artifact 明碼依範圍決策不匯入。
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
- [x] AI-D01：OHS／組織分析的 AI 報告統一由 FastAPI 後端呼叫 Gemini，不沿用 Artifact 的 Anthropic 瀏覽器呼叫。

## 15. Batch E 完成紀錄（2026-08-12）

- [x] ANL-E01：新增組織分析中心，整合 KPI／OKR、高風險、ESG、部門比較、日期篩選及 dept_head 自身部門限制。
- [x] ANL-E02：依 Artifact 公式完成 WPAI／ROI 參數、保守／中性／樂觀三情境、三年 ROI、回本期與 D 層參與增益試算。
- [x] ANL-E03：完成三個 80%、八週時間軸與 GRI 403-6／403-9 揭露草稿；正式揭露仍須由組織查核。
- [x] AI-E01：ESG、OKR、高風險、KPI、ROI、888、GRI、OHS 與跨企業報告統一使用後端 Gemini；保存模型、彙整快照、生成者與版本時間。
- [x] PRIV-E01：組織統計由 PostgreSQL 強制整體與各指標子群 k≥5；跨企業統計只納入明確 opt-in，個人可隨時撤回。
- [x] L5-E01：完成跨企業健康、企業／經銷名冊、日期篩選、報表歷史、區域／夥伴／收入策略與 NPS 追蹤名單；不提供個人健康名冊。
- [x] EXP-E01：分析表格支援 UTF-8 CSV，畫面與 Gemini 報告支援瀏覽器列印／另存 PDF。
- [x] DB-E01：Batch E migration 已套用遠端 Supabase；新表啟用 RLS 並撤銷 browser roles，彙整函式只授權 FastAPI `service_role`。
- [x] TST-E01：46 個 Python 測試、52 個 pgTAP 資料庫測試、Next.js production build、本機 migration 全量重播及 database lint 全部通過。
- [~] TST-E02：遠端 advisors 沒有 Batch E 新增警告；security 唯一 WARN 仍為既有 leaked-password protection，performance 僅有 INFO。

## 16. Batch F 完成紀錄（2026-08-12）

- [x] ORG-F01：部門 UTF-8 CSV 範本、四層關係預檢、重複／孤兒檢查、單一 PostgreSQL transaction 取代與失敗回滾，並提供架構確認資料及列印。
- [x] SVC-F01：整合 Main 與 L5 Artifact 的服務類型、優先級、希望日期、案件歷程、處理人、回覆與關閉時間；一般使用者只見自身案件，企業管理者只見自身企業。
- [x] ANN-F01：十種公告範本、草稿／發布／關閉、名額與報名／取消；資料庫以列鎖避免同時報名超收。
- [x] FIN-F01：匯款憑證保存於私有 Storage bucket，Gemini 2.5 Flash 回傳結構化 OCR、SHA-256、信心與警告；低信心或警告一律標為人工覆核，沖帳仍由人員確認。
- [x] IAM-F01：以可稽核的身分核驗申請取代 Artifact 共用 PIN／備援碼重設，不接收、不回傳、不保存明文憑證。
- [x] MSG-F01：LINE provider-neutral 草稿／佇列／人工複製／成功／失敗結果；沒有 token 時拒絕 API 發送，不偽造送達結果。
- [x] SEC-F01：新表均啟用 RLS，撤銷 `anon`／`authenticated` table 與 RPC 權限，只授權 FastAPI `service_role`；預約更新與刪除補上組織範圍檢查。
- [x] TST-F01：51 個 Python 測試、75 個 pgTAP 資料庫測試、本機 migration 全量重播、Next.js production build 與 database lint 全部通過。

## 17. Batch G 實作紀錄（2026-08-12）

- [x] EXP-G01：四個 Artifact 皆加入版本化 JSON、來源版本、匯出時間、分檔編號與 SHA-256；明確排除 session、PIN、token、lock、remember-login 與 handoff。
- [x] EXP-G02：匯出依約 7.5 MB／5,000 entries 自動分檔，後端以相同穩定 JSON 規則重算並驗證 SHA-256。
- [x] IAM-G01：`reibi_super` 改由 Supabase Auth Email／密碼、內部 UUID 白名單、已驗證 Email、登入限速與 30 分鐘可撤銷工作階段建立；共用 PIN 無法取得該角色。
- [x] IAM-G02：內部帳號可要求 TOTP；後端在同一次登入挑戰並驗證 AAL2，沒有通過時不建立應用工作階段。瀏覽器不接收 service-role 或 Supabase refresh token。
- [x] IMP-G01：管理頁新增只對 `reibi_super` 顯示的正式匯入確認；完成檔案去重，失敗重跑保留 retry lineage 並跳過先前成功來源記錄。
- [x] OPS-G01：完成內部帳號 bootstrap、Artifact 重發／匯出、還原點、匯入順序、核對與緊急撤銷 runbook。
- [x] TST-G01：56 個 Python 測試、95 個 pgTAP 測試、四份 Artifact JSX 語法解析、本機 migration 全量重播與 Next.js production build 通過。
- [N/A] DATA-G01：專案負責人於 2026-08-14 決定不匯出／匯入四個已發布 Artifact 的既有 `window.storage`；import batches/records 維持 0 筆是預期狀態。

## 18. Batch H 身分／角色系統（2026-08-13）

- [x] IAM-H01：建立 14 角色後端權威 registry，涵蓋主平台、L5 內部與經銷商；可信專屬角色一律要求 server-side session 驗證。
- [x] IAM-H02：擴充 `reibi_internal_users` 的 profile、企業、部門、staff、distributor 與 MFA 綁定，DB constraint 與 trigger 阻擋錯誤範圍。
- [x] IAM-H03：完成帳號邀請、邀請密碼設定、TOTP 設定／驗證、可信登入、停用、重新啟用及 session 撤銷 API 與前端頁面。
- [x] SEC-H01：身分、session 與稽核表維持 RLS；`anon`／`authenticated` 無 table access，瀏覽器不取得 service-role、Supabase access token 或 refresh token。
- [x] TST-H01：66 個 Python 測試、127 個 pgTAP、全量 migration 重播、database lint、FastAPI 路由 smoke test 與 Next.js production build 通過。
- [x] OPS-H01：第一位正式 `reibi_super` `reibicare9881@gmail.com`（麗媚AI）已建立，Email 與密碼設定完成並成功登入。
- [x] OPS-H02：`/reibi/mfa` self-enrollment、TOTP 驗證、原子設定 `mfa_required=true`、撤銷舊 AAL1 session 與 audit 已完成；正式 `reibi_super` 已完成 QR Code 綁定及實際 AAL2 重新登入。

## 19. MFA 既有帳號補綁（2026-08-14）

- [x] MFA-I01：新增受可信 session 保護的 `/reibi/mfa`，既有帳號須重新輸入密碼後才取得 TOTP QR Code／設定密鑰。
- [x] MFA-I02：Supabase `challenge_and_verify` 回傳 AAL2 後，後端才呼叫 `reibi_enable_mfa`；AAL1 或錯誤驗證碼不得啟用要求。
- [x] MFA-I03：版本化 transaction 會原子設定 `mfa_required=true`、撤銷所有既有應用工作階段並寫入 identity audit；`anon`／`authenticated` 不可執行 RPC。
- [x] MFA-I04：70 項 Python、135 項 pgTAP、TypeScript 與 Next.js production build 通過；本機／遠端 14 個 migration 版本一致，遠端回滾測試通過。
- [x] MFA-I05：`reibicare9881@gmail.com` 已在 staging 掃描 QR Code、驗證六位數代碼並重新登入；2026-08-14 遠端 Auth log 與可信 session 均確認 AAL2。

## 20. Batch J L5 角色化總覽（2026-08-14）

- [x] L5-J01：新增 `/api/reibi/l5/overview`，由現有企業、報價、合約、工單、服務、應收、匯款、訂閱及權限申請資料即時聚合。
- [x] L5-J02：`reibi_super`、財務、數據、客服及兩種經銷商角色各自只收到所需 KPI、待辦與通知；主經銷商可涵蓋直屬子經銷商，子經銷商只限自身企業。
- [x] L5-J03：新增 `/reibi/l5` 及 dashboard 入口，包含角色／範圍、KPI、待辦、即時通知、作業流程與真實近 12 月企業趨勢。
- [x] TST-J01：76 項 Python 測試（含主／子經銷商實際 query scope）、TypeScript no-emit、Next.js production build 與 FastAPI 路由 smoke test 通過。
- [x] DB-J01：本批未新增 Supabase schema；通知不保存已讀狀態，既有 RLS 與僅由後端 service-role 存取的界線維持不變。

## 21. Batch K L5 新案開通（2026-08-14）

- [x] L5-K01：新增 `/reibi/onboarding` 三步驟開案，涵蓋企業基本資料、方案／授權、B/C/D 層、場域與四層費用確認。
- [x] L5-K02：`reibi_open_enterprise_case` 以單一 PostgreSQL transaction 建立企業、場域與案件；案件、企業代碼與憑證函各用獨立 sequence，避免並發撞號。
- [x] L5-K03：憑證函只列案件、組織代碼、管理員 Email 與登入入口；密碼由 Supabase 邀請設定，MFA 依可信帳號政策完成，不移植 Artifact 的共用 PIN／備援碼。
- [x] L5-K04：商務文件頁新增企業範圍選擇；`reibi_super`／`reibi_finance` 可明確指定 `org_code`，企業 `admin` 仍只能操作 token 內的自身企業。
- [x] L5-K05：新案企業會在同一 transaction 同步至主平台 `organizations`；已回填既有測試企業，企業名稱後續更新亦同步。舊版三個 NOT NULL PIN 欄位只保存彼此獨立、明文從未保存的隨機 bcrypt placeholder，不恢復共用 PIN。
- [x] SEC-K01：新表啟用 RLS 並撤銷 browser roles；transaction RPC 與 sequences 只授權後端 `service_role`。
- [x] TST-K01：82 項 Python 測試、Next.js production build、16 個空白本機 migrations 全量重播及可回滾 SQL 交易／權限／organizations 同步測試通過。

## 22. Batch L 跨企業管理總覽（2026-08-17）

- [x] L5-L01：`/reibi` 新增跨企業管理總覽，包含企業名稱／代碼／產業／經銷商搜尋、狀態篩選、企業總數、啟用／試用、90 天內到期與授權使用率警示。
- [x] L5-L02：選定企業後，基本資料、方案、授權、合約、場域與四層部門 API 全部明確帶入 `org_code`；商務文件入口沿用相同企業範圍。
- [x] SEC-L01：跨企業選擇只顯示給 `reibi_super`／`reibi_finance`；後端 `require_reibi_manager` 仍是權限來源，企業 `admin` 指定其他組織會回傳 403，瀏覽器不取得 Supabase service role。
- [x] TST-L01：84 項 Python 測試（含跨企業目錄與企業管理員自身範圍）、TypeScript no-emit、Next.js production build、FastAPI 企業路由 smoke test 與 16 個 migration 歷史核對通過；全 14 角色瀏覽器 E2E 仍列於 TST-04／TST-11。

## 23. Batch M 經銷商服務案件整合（2026-08-17）

- [x] L5-M01：主經銷商服務範圍包含自己與直屬子經銷商，次級經銷商只包含自身；經銷商入口企業清單亦使用同一個 server-side 範圍函式。
- [x] L5-M02：`/reibi/service` 依可信角色提供企業選擇，建立案件時重新驗證 `enterprise_id`；案件清單不接受瀏覽器自訂範圍，避免 IDOR／BOLA。
- [x] L5-M03：`reibi_cs` 可查看及處理全域服務案件；經銷商可查看與建立自己服務企業的案件，但不能自行結案。
- [x] L5-M04：L5 經銷商總覽加入服務案件 KPI、待辦、通知及流程統計，且只聚合授權企業的案件。
- [x] SEC-M01：沿用既有 RLS、撤銷 browser table grants 與 FastAPI server-side Supabase client；不新增 table 或 migration，遠端 16 個 migration 歷史維持一致。
- [x] L5-M05：遠端驗收修正 `reibi_super` 服務中心部門架構未帶 `enterprise_id` 的問題；架構讀取與 CSV 匯入均沿用已選服務企業，企業管理員仍不能指定其他企業。
- [x] L5-M06：L5 前端補齊服務案件流程卡片，顯示待處理與全部案件數並連往 `/reibi/service`；四個流程卡片採自適應版面。
- [x] TST-M01：89 項 Python 測試（含主／次經銷商企業、案件 scope 及部門跨企業防護）、TypeScript no-emit、Next.js production build、FastAPI 路由 smoke test 及遠端 schema／RLS／migration 核對通過。
