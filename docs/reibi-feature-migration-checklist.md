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
| FastAPI REIBI router | `[-]` | 主要業務、身分、L5 總覽與區域佈點 API 已完成，401／403 矩陣與 E2E 已涵蓋；尚待統一 response schema 與寫入稽核（FND-05／06） |
| Next.js REIBI 管理頁 | `[-]` | 主要商務、健康、分析、設定、帳號、L5 總覽與區域佈點已完成，瀏覽器 E2E 涵蓋 31 項；尚待場域前置選單與定價／About 內容 |
| Artifact 欄位映射 | `[x]` | 主要 storage keys 與目標表已完成程式對照；因舊資料不搬遷，不要求真實匯出檔驗證 |
| Python 測試環境 | `[x]` | Python 3.11.9 與 `backend/.venv` 已重建，`requirements-dev.txt` 固定 pytest 8.4.2；2026-08-18 為 3,369 項後端、159 項 pgTAP 與 37 項 Playwright E2E 通過 |
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
- [x] MP-01E 兩張表的量表不重疊，非重複儲存；實際問題是組織彙整缺同意保護，已依 2026-08-18 決策修正，見 §33。

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
- [x] MP-06D 預約排程、服務場域與預約前置帶入；場域選單、越權防護與清單顯示已完成，見 §32。
- [x] MP-06E 服務申請、變更需求與受控處理狀態。
- [x] MP-06F 應付款、匯款申報、私有憑證保存、Gemini OCR／信心標記與人工覆核。
- [x] MP-06G 個人訂閱申請、查詢、審核、一次性啟用碼與到期。
- [-] MP-06H 隱私、資安文件、稽核紀錄與版本／操作說明已整合；**方案與定價頁已於 2026-08-20 完成**（`/reibi/pricing`，見 §40）；**About REIBI 五分頁仍待文案**。
- [x] MP-06I 行業分類（Artifact `IndustryScreen`）：10 大類 × 10 子類分類體系，取代原本的自由文字輸入，見 §34。
- [x] MP-06J 帳號上限管控（Artifact `AccLimitScreen`）：企業自身的方案、授權上限、已啟用人數、使用率與方案級距對照，見 §34。
- [ ] MP-06K 體驗場域（Artifact `VenueScreen`）：REIBI 體驗中心清單、地址、交通方式與首次免費體驗預約。**尚未移植**，需先提供各體驗中心的正式資料。
- [x] MP-06L 個人訂閱功能閘門（Artifact `SubscribeScreen` 與 `isPro`）。判定沿用 Artifact 那一行：企業員工一律視為訂閱版（A 層授權費已涵蓋），只有 `individual` 受管轄。到期採**延遲判定**（`effective_status`）：不背景改寫任何資料，讀取時比對到期日，因此「自動降級但完整保留歷史」是實作方式而不只是文案。四道閘門全部在後端執行：AI 個人化建議在**生成前**擋下（免費用戶完全不呼叫 Gemini，前端退回標準衛教內容），年度改善追蹤回 402，睡眠與綜合歷史裁到最近 3 個月並回傳 `hidden_count`，優先預約旗標隨訂閱狀態寫入。使用者端新增 `/subscribe`：功能對照、五條條款與版本記錄、三種方案申請、一次性啟用碼認領。價格不在程式中 —— Artifact 的付款是人工審核制，金額由客服個別議定。見 §37。

## 5. L5 專屬管理後台

### L5-01 作業

- [x] L5-01A 依角色顯示的總覽、待辦與即時通知；採現有業務 table 動態聚合，不新增通知 table。FastAPI 依四種內部角色與兩種經銷商角色裁切欄位／企業範圍，Next.js 提供 L5 總覽入口。
- [x] L5-01B 新案開通三步驟、交易式企業／場域建立、並發安全案件／企業／憑證流水號，以及不含密碼或共用 PIN 的 PDF 憑證函。
- [x] L5-01C 企業管理基本資料；企業管理者只能維護自身企業，`reibi_super`／`reibi_finance` 可在跨企業目錄搜尋、篩選及選定企業，再管理基本資料、授權、場域與部門。所有讀寫仍由 FastAPI 逐次驗證 `org_code`。
- [x] L5-01D 企業場域、設備、A/B/C/D 四層方案、授權用量、平台帳號核對與合約狀態。
- [x] L5-01E 服務案件與企業範圍限制完成；主經銷商可查看及選擇自身與直屬子經銷商企業，次級經銷商只限自身企業。案件清單、建立案件與 L5 統計均由 FastAPI 重新驗證可信角色範圍。
- [x] L5-01F 預約管理與組織越權防護。
- [x] L5-01G 區域佈點（點線面）；里程碑時間軸依 2026-08-17 決策暫不移植，見 §31。

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
- [x] L5-04G Artifact 來源版本（`source_version`）已在匯入流程記錄；站內操作手冊已於 2026-08-19 補上 `/reibi/l5/manual`（六分頁）。角色權限表由權限 registry 產生、分潤比例與升級門檻由計價模組產生，因此手冊永遠等於實際設定，不是第二份會脫節的說明。見 §39。

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
- [x] TST-03 對 Supabase client 建立 fake／integration test 分層。
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

## 24. Batch N 測試地基（2026-08-17）

- [x] TST-N01：新增 `backend/tests/conftest.py`，在載入 `config` 前把 Supabase URL、service role key、JWT secret 與 Gemini key 全部釘死為假值。先前測試是讀 `backend/.env` 執行，等同指向正式 Supabase 專案；現在即使誤寫會連線的測試也打不到正式庫。
- [x] TST-N02：`supabase.create_client` 在 `import main` 之前換成 `FakeSupabaseClient`。REIBI 各 router 在建立時就把 client 收進 closure，因此替換必須早於 main 匯入。
- [x] TST-03／TST-N03：`tests/support/fake_supabase.py` 實作後端實際使用的 PostgREST 介面（`eq`／`neq`／`gt`／`gte`／`lt`／`lte`／`in_`／`is_`／`like`／`ilike`／`or_`／`order`／`limit`／`range`／`single`／`maybe_single`／`insert`／`update`／`upsert`／`delete`／`rpc`／storage），讀取回傳深拷貝，未註冊的 RPC 會明確失敗而非靜默回空值。
- [x] TST-N04：`tests/support/identities.py` 提供 14 角色 token 工廠與可信 session registry。範圍宣告直接由 `roles.ROLE_DEFINITIONS` 推導，角色 registry 變更時測試 token 會自動跟著變，不會與後端權威來源脫節。
- [x] TST-N05：可信 session registry 支援 revoke／deactivate／expire，讓 401 情境（未註冊 session、已撤銷、帳號停用、逾期）成為可測狀態而非只能靠遠端手測。
- [x] TST-N06：`backend/config.py` 改用 `SettingsConfigDict`，移除 Pydantic V2 class-based `Config` deprecation warning；`pytest.ini` 將該 warning 升為 error，避免再度回歸。
- [x] TST-N07：149 項 Python 測試通過（原 89 項全數維持綠燈，新增 60 項 harness 測試），`pip check` 無衝突，TypeScript no-emit 與 Next.js production build 通過。測試執行時間由 5.7 秒降至 1.0 秒。

## 25. Batch O1 認證邊界與個人紀錄授權（2026-08-17）

- [x] SEC-O01：修正 `GET /api/sleep/latest-profile/{user_id}` 的 IDOR。守門條件寫成 `current_user.get("system_role") == "individual"`，但 JWT 從未簽發 `system_role`（見 `main.py` 的 `token_payload`），條件恆為 false，任何已登入帳號都能讀取他人最新睡眠 profile。
- [x] SEC-O02：修正 `GET /api/history/{user_id}` 與 `GET /api/schumann/trend/{user_id}`。兩者用 `current_user["system_role"]` 取值，實際會拋 KeyError 並被外層 `except Exception` 轉成 500，端點對所有使用者皆不可用，且把原始例外字串回傳給前端。
- [x] SEC-O03：修正 `GET /api/pdf/{record_id}` 完全沒有擁有者檢查的 BOLA；任何已登入帳號可用流水號下載他人分析報告 PDF。查詢與授權移出 `try`，避免 403／404 被 `except Exception` 轉成 500。
- [x] SEC-O04：修正 `GET /api/schumann/reports` 與 `GET /api/schumann/reports/{report_id}` 只檢查角色不檢查組織的跨租戶洩漏；任一單位的 `admin`／`dept_head` 原本可讀取任何單位任何人的報告。
- [x] SEC-O05：個人紀錄存取規則統一為 `assert_can_read_user_records()`（本人，或同單位 `admin`），與既有 `/api/sleep/reports` 一致。此變更移除了 `dept_head` 的跨使用者讀取；前端所有呼叫端只傳自身 `session.uid`，無既有流程受影響。若日後需要部門主管檢視部門成員，應另行加入部門範圍條件，不應退回只檢查角色。
- [x] TST-O01：新增 `tests/test_permission_matrix.py`。路由表直接由 `main.app` 讀取，新端點掛載即納入涵蓋；公開路由改為明文允許清單，任何新增的未驗證端點會讓測試失敗。166 條受保護路由 × 6 種無效憑證情境（無 header、格式錯誤、過期、簽章偽造、可信 session 未註冊、session 已撤銷）全數回傳 401。
- [x] TST-O02：新增 `tests/test_object_authorization.py`，涵蓋 9 條個人紀錄路由 × 5 種越權身分（個人、他單位成員、他單位 admin、他單位 dept_head、REIBI 跨企業分析角色），並驗證本人與同單位 admin 的正常存取未被過度阻擋。
- [x] TST-O03：測試替身補上 PostgREST 的型別轉換語意（`.eq("id", "501")` 需匹配整數 501），避免測試因替身過嚴而產生真實資料庫不會出現的失敗。
- [x] TST-O04：1200 項 Python 測試通過，`pip check` 無衝突，TypeScript no-emit 與 Next.js production build 通過。
## 26. Batch O2 角色授權矩陣（2026-08-17）

- [x] TST-O05：新增 `tests/test_role_authorization.py`。守門由路由表推導而非人工列舉，因此新端點掛在既有守門下即自動納入涵蓋；出現新守門時 `test_every_guard_in_use_is_declared` 會失敗直到補上允許角色，守門被移除時另一項測試會提醒清除宣告。
- [x] TST-O06：133 條具名守門路由 × 14 角色的完整矩陣。不在允許集合內的角色一律驗證回傳 403；允許集合內的角色驗證「未被授權層拒絕」（後續 404／422 屬 handler 對空資料庫的正常回應，不在本測試範圍）。
- [x] TST-O07：測試 token 補上真實登入會簽發的 `dept` claim。Batch D／E 的部門範圍檢查比對的是部門名稱而非 `department_id`，缺這個 claim 會讓 `dept_head` 的正常路徑被誤判為權限問題。
- [x] TST-O08：跨企業角色（`reibi_super`／`reibi_finance`）在矩陣中一律明確帶 `org_code`，與 UI 行為一致；`{org_code}` 路徑參數使用該角色實際有權的代碼，避免用佔位符觸發合法的跨組織 403 而遮蔽守門本身的結果。
- [x] TST-O09：測試替身補上 `not_` 否定過濾（`reibi_batch_e` 的部門清單查詢使用 `not_.is_(...)`）。
- [x] SEC-O06：修正 `GET /api/reibi/finance/settings` 在設定列不存在時直接對空清單取 `[0]`，造成 IndexError → 500。改為 404 並附明確訊息；不憑空補一組預設分潤上限。
- [x] SEC-O07：`roles.py` 與 Batch D／E router 的授權落差已於 Batch R1 修正（見 §30）。`admin_hr` 取得職安管理與組織彙整、`reibi_data` 取得跨企業分析，守門改由 `has_permission()` 推導。
- [x] TST-O11：3070 項 Python 測試通過，`pip check` 無衝突，TypeScript no-emit 與 Next.js production build 通過。

## 27. Batch O3 內嵌授權路由（2026-08-17）

- [x] TST-O10：守門偵測改為收集路由上所有依賴 callable，不再只比對 `require_` 前綴。`reibi_onboarding` 的守門叫 `_actor`，前綴規則會讓那 5 條新案開通路由完全沒被測到；改版後具名守門路由由 133 條增為 138 條。
- [x] SEC-O08：修正 `POST /api/ai-trend/{user_id}` 只比對角色不比對組織的跨租戶問題。此端點會讀取指定使用者的睡眠與疼痛歷史並送進 Gemini 產生分析，原本任一單位的 `admin`／`dept_head` 都能對任何人執行。改用 `assert_can_read_user_records`。
- [x] TST-O12：新增 `tests/test_inline_authorization.py`，涵蓋授權寫在 handler 內、無法由矩陣自動產生的 19 條路由。包含兩種契約：明確拒絕（服務案件結案、L5 總覽、個人帳號公告報名、代他人提交評估／預約／切換平台）與範圍裁切（經銷商案件清單不含其他經銷商企業、個人帳號取得空清單）。
- [x] SEC-O09：驗證經銷商可建立案件但不可更新或結案（`partner_primary`／`partner_sub` 對 `PATCH /service/tickets/{id}` 一律 403），符合 Batch M 的設計；`service_manage` 僅 `reibi_cs` 與 `reibi_super` 持有。
- [x] SEC-O10：驗證取消公告報名只影響呼叫者自己的報名列；以他人 `profile_id` 的報名列測試回傳 404 且資料未被修改。
- [x] TST-O13：3192 項 Python 測試通過，`pip check` 無衝突，TypeScript no-emit 與 Next.js production build 通過。
- [ ] TST-O14：`GET /api/reibi/service/tickets` 與 `GET /api/reibi/announcements` 未做權限檢查而改以範圍裁切回應，與同模組 `/service/scope` 要求 `service_center` 權限的作法不一致。目前不造成越權（超出範圍者得到空清單），但行為契約應統一。

## 28. Batch P 本機資料庫回歸（2026-08-17）

- [x] TST-P01：Docker Desktop 與 CLI 在本次工作階段確認可用（Server 29.6.2），推翻交接手冊 §12「本次 PowerShell 找不到 Docker CLI」的紀錄。本機 Supabase 已啟動並完成 16 個 migration 於空資料庫全量重播。
- [x] TST-P02：修正 `supabase/tests/reibi_batch_k_onboarding.sql` 不是 pgTAP 格式的問題。該檔以 `raise exception` 做斷言且沒有 `plan()`，pg_prove 回報 `No plan found in TAP output`、計 0 項測試，並讓整個 `supabase test db` 以 FAIL 收場 —— 也就是 Batch K 的資料庫斷言從未被計入「135 項 pgTAP 通過」，而且這個指令本身無法當作驗收關卡。改寫為正規 pgTAP 後更名為 `reibi_batch_k_onboarding.test.sql`。
- [x] TST-P03：改寫後立即發現原斷言把企業代碼流水號寫死為 `ORG-MTST-26-000001`。PostgreSQL sequence 不隨 `rollback` 回退，該斷言只在資料庫重置後第一次執行成立，之後每次重跑都會誤報同步失敗。改為由實際產生的 `org_code` 反查，並加上代碼格式斷言；連續執行兩次均 PASS。
- [x] TST-P04：`organizations` 同步經直接查詢確認正常運作（`reibi_enterprises` 與 `organizations` 皆有對應列），先前的失敗來自測試寫法而非產品缺陷。
- [x] TST-08／TST-09：146 項 pgTAP 全數通過且 `supabase test db` 回傳 `Result: PASS`；`supabase db lint --level warning` 回報 `No schema errors found`。
- [x] TST-P05：新增 `npm run db:reset`／`db:test`／`db:lint` 便捷指令，讓資料庫回歸與後端、前端檢查一樣可一行執行。

## 29. Batch Q 瀏覽器 E2E（2026-08-17）

- [x] TST-Q01：導入 Playwright。`playwright.config.ts` 自行拉起後端（port 8001）與前端（port 3001），全部指向本機 Supabase，不碰 staging／正式共用專案；port 與開發者自己的 dev server 不衝突。
- [x] TST-Q02：E2E 跑 Next.js production build 而非 `next dev`。`next dev` 在首次請求才編譯路由，導致第一個抵達冷路由的測試逾時、單獨重跑卻通過；改用 production build 後穩定且更接近實際部署產物。
- [x] TST-Q03：`backend/tests/e2e_seed.py` 建立四個可信帳號（super／finance／cs／data）。腳本硬性檢查目標必須是 `http://127.0.0.1:54321`，指向其他專案時直接拒絕執行。
- [x] TST-07／TST-Q04：登入情境 6 項 —— 正確憑證、錯誤密碼、未註冊 Email 不洩漏帳號是否存在、未登入導回、登出後失效，以及驗證 localStorage 不含 service role 或 refresh token。
- [x] TST-11／TST-Q05：完整業務閉環 1 項 —— 新案開通 → 報價建立 → 已發送 → 已確認 → 轉合約 → 簽署／用印／執行快照 → 建立施工工單 → 五段狀態流轉 → 驗收簽署 → 驗收完成，全程由 UI 點擊驅動。
- [x] TST-Q06：新案開通 5 項 —— 三步驟建立、案件／組織／憑證函編號格式、必填欄位阻擋、憑證函 PDF 下載、新企業出現在 `/reibi` 清單。
- [x] TST-Q07：L5 角色裁切 5 項 —— super 看到完整流程卡與趨勢、`reibi_data` 看不到財務數字與作業流程、`reibi_finance` 看不到權限申請待辦、空狀態不是崩潰、後端 500 時頁面不是空白畫面。
- [x] TST-Q08：手機版 6 項（Pixel 5 視窗）—— L5、跨企業管理、新案開通、服務中心、商務文件五個頁面均無水平溢出，登入表單在窄視窗仍可完整操作。
- [x] TST-Q09：24 項 E2E 全數通過（18 desktop + 6 mobile）。新增 `npm run e2e`／`e2e:desktop`／`e2e:mobile`／`e2e:report`。
## 31. Batch S 區域佈點 L5-01G（2026-08-17）

- [x] L5-S01：新增 `GET /api/reibi/l5/regions` 與 `/reibi/l5/regions` 頁面，呈現全區佈點總達成率與北／中／南／東／海外五區的家數、目標與達成率。區域目標沿用 Artifact 數字（40／20／20／8／12，合計 100 家）。
- [x] L5-S02：**修正來源 Artifact 的缺陷。** `reibi-l5_v2_14` 的 `MapScreen`（第 4612 行）以 `enterprise.region` 分區，但其新案開通建立企業的物件（第 1035-1053 行）從未寫入該欄位，因此原版五個區域永遠顯示 0，只有最上方總數會動。照抄會複製一個壞掉的功能。
- [x] L5-S03：區域改由企業的 `partner_code` 關聯到 `reibi_distributors.region` 推導 —— 那是 Artifact 真正有在收集的欄位（第 2734 行「負責區域」下拉），新系統 schema 也已存在，**不需要 migration，也不需要回填企業資料**。次級經銷商未設定區域時沿用其主經銷商。
- [x] L5-S04：無法歸區的企業不會被靜默丟棄。回應與畫面會分別列出「未指定接案經銷商」「經銷商代碼查無資料」「經銷商未設定負責區域」三種原因與家數，並保證區域合計 ＋ 未歸區 ＝ 總家數。原版沒有這層說明，數字對不上時無從判斷是資料缺漏還是統計錯誤。
- [x] L5-S05：經銷商表單的「區域」由自由文字輸入改為五選一下拉。原本是自由文字，任意字串會讓分區統計無法可靠彙整；正規化函式仍容忍既有的中文標籤與大小寫差異。
- [x] SEC-S01：權限對齊 Artifact —— 點線面只開放 `super` 與數據分析師，財務與客服看不到，對應到 registry 即 `cross_org_analytics`（`reibi_super` 與 `reibi_data`）。回應只有家數，不含任何金額欄位。
- [x] TST-S01：41 項 Python 測試（區域正規化、次級經銷商繼承、達成率上限、未歸區歸因、加總守恆、端點權限與無金額欄位）與 6 項瀏覽器 E2E（兩種可見角色、兩種被擋角色、L5 入口依角色顯示、未歸區說明）。
- [x] TST-S02：3,322 項 Python 測試、146 項 pgTAP、31 項 E2E、`pip check`、TypeScript no-emit 與 Next.js production build 全數通過。
- [N/A] L5-S06：擴展里程碑時間軸**確定不移植**（2026-08-19 決策，原為 `[~]` 暫緩）。Artifact `MapScreen` 的六筆里程碑（2024 Q4 – 2026 Q2）是寫死的行銷文案，`done` 是硬編碼的布林值而非由資料推導 —— 那些勾勾是宣稱不是事實。盤點當日（2026-08-19）後三筆的時間全部已過，畫面上仍顯示為未完成，最後一筆過期逾兩個月且其後無新內容。補上新的一輪，明年同樣會再過期一次。
  同一個畫面的另一半（五大區域與目標家數 40／20／20／8／12）已於 `cada642` 移植，且改為由經銷商負責區域推導真實家數，見 `/reibi/l5/regions`。`MapScreen` 本來就是一半資料、一半海報；資料那半已完成，本項是海報那半。若日後確實需要，應做成可維護的資料表而非程式常數。

## 32. Batch S2 預約服務場域 MP-06D（2026-08-17）

- [x] MP-S01：`appointments.service_site_id` 與其外鍵早在 Batch F 就已建立，但 `POST /api/appointments` 的 payload 從未寫入該欄位，前端也沒有任何場域選單 —— 欄位存在卻永遠是 NULL。現已在建立預約時寫入場域與備註。
- [x] MP-S02：新增 `GET /api/appointments/sites`。原本唯一的場域清單端點 `/api/reibi/enterprise/sites` 需要 `manage_reibi` 權限，實際要預約的 `member`／`dept_head` 拿不到，因此預約流程需要一個只讀自身單位、欄位最小化的入口。
- [x] SEC-S02：建立預約時重新驗證 `service_site_id` 屬於登入者所屬單位，不接受瀏覽器自帶任意 id；越權時回 403 且不寫入任何資料。個人帳號（無 `org_code`）不得存取場域清單。
- [x] MP-S03：預約清單附上 `service_site_label` 供前端直接顯示，避免每列各發一次查詢；沒有場域的預約不受影響。
- [x] MP-S04：前端預約頁在單位確實有場域時才顯示選單，避免留下永遠空白的欄位；清單以標籤顯示場域。
- [x] A11Y-S01：修正預約表單的 `<label>` 未與輸入元件關聯（缺 `htmlFor`／`id`），螢幕閱讀器與自動化皆無法定位；時段按鈕群組改用 `role="group"` 與 `aria-labelledby`。
- [x] TST-S03：測試替身補上 PostgREST 的欄位投影語意。原本 `.select("id,label")` 會回傳整列，比真實資料庫寬鬆，會遮蔽 handler 多回傳欄位的問題；`*` 與嵌套查詢維持原行為，確保只收斂不放寬。
- [x] TST-S04：18 項 Python 測試（場域清單範圍、角色可讀性、跨單位場域阻擋、拒絕時不寫入、備註長度、清單標籤）與 6 項 E2E（含手機版）。E2E 種子新增一組單位成員帳號，連同企業、場域、部門與 `profiles` 一併建立以滿足 `reibi_internal_users` 的 scope constraint。
- [x] TST-S05：3,360 項 Python 測試、146 項 pgTAP、`pip check`、TypeScript no-emit 與 Next.js production build 全數通過。

## 33. Batch S3 組織彙整同意 MP-01E（2026-08-18）

盤點結果與清單原本的描述不同：`sleep_reports` 與 `reibi_health_assessments` 涵蓋的量表**不重疊**（前者為 ISI 睡眠／BPI 疼痛／工作影響，後者為 PHQ-4／PSS-4／正念／過勞／NMQ／BSRS-5／不法侵害），因此不存在重複儲存或去重問題。真正的缺陷在隱私：

- `reibi_health_assessments.consent_org_aggregate` 自 Batch D 建立後**從未被任何程式碼寫入或讀取**，是死欄位。
- `sleep_reports` 連該欄位都沒有。
- `reibi_org_health_snapshot`（單一企業彙整）**對兩張表都沒有同意過濾**，員工的睡眠、疼痛、工作分數與心理量表結果一律無條件進入雇主的組織報表。
- 跨企業彙整 `reibi_cross_org_health_snapshot` 則本來就以 `profiles.research_opt_in` 正確擋住兩張表，本次未更動。

- [x] DB-S01：新增 migration `20260818074631_sleep_reports_org_aggregate_consent.sql`（第 17 個）。`sleep_reports` 新增 `consent_org_aggregate boolean not null default false` 與 `(org_code, consent_org_aggregate, created_at desc)` 索引，並為兩張表的同意欄位補上 column comment。
- [x] SEC-S03：重建 `reibi_org_health_snapshot`，對 `sleep_reports` 與 `reibi_health_assessments` **對稱**加入同意過濾（各 2 處：eligible 樣本計算與 latest 明細）。預設 false，未明確同意者不進彙整。
- [x] SEC-S04：k≥5 抑制與本人同意是兩層**獨立**保護，互不取代。即使樣本足夠，未同意者仍被排除；即使全部同意，同意人數不足 5 仍抑制且不回傳任何指標。
- [x] MP-S05：`POST /api/sleep/assessment` 與 `POST /api/reibi/health/assessments` 均接受 `consent_org_aggregate` 並寫入資料列；預設 false，且**逐次評估獨立**，前一次同意不會延續到下一次。
- [x] MP-S06：評估表單最後一步（僅單位成員可見）新增同意勾選，說明「單位僅能看到 5 人以上的去識別統計，看不到你的個人分數；不勾選不影響取得個人報告」。
- [x] SEC-S05：組織彙整同意與跨企業研究同意（`profiles.research_opt_in`）是兩個獨立開關，測試確認勾選前者不會連帶開啟後者。
- [x] TST-S06：13 項 pgTAP（欄位定義、只計入同意者、撤回後抑制、全部撤回歸零、心理量表對稱受限）與 9 項 Python API 測試。既有 `reibi_batch_e.test.sql` 的測試資料同步補上同意值 —— 它原本失敗正好證明過濾生效。
- [x] TST-S07：3,369 項 Python 測試、**159 項 pgTAP**、37 項 E2E、`pip check`、TypeScript no-emit 與 Next.js production build 全數通過；17 個 migration 於空資料庫重播成功，`db:lint` 無錯誤。
- [x] OPS-S01：遠端 Supabase 已於 2026-08-20 套用第 17–19 個 migration，與 repo 同為 19 個版本。**既有 `sleep_reports` 資料列的同意值一律為 false**，因此組織彙整目前只反映套用後明確勾選同意的評估 —— 這是刻意的隱私預設，但**上線前仍應向企業客戶說明**，否則他們會發現彙整樣本數比預期少。

## 34. Batch S4 清單漏列項目補正（2026-08-18）

依使用者要求對四個 Artifact 的畫面與選單入口做**逐項比對**（主平台 53 個入口、L5 19 個），發現三項功能在本清單中**完全沒有對應條目** —— 不是標記為待辦，而是從未被列入盤點。

- [x] MP-06I：`IndustryScreen` 的 10 大類（科技／金融／製造／服務／醫療／教育／建築／傳播／政府／其他）× 各 10 子類分類體系已移植為 `frontend/lib/industries.ts` 與 `IndustryPicker` 元件，套用於新案開通與企業管理兩處。原本 `industry` 是自由文字輸入，同一產業會出現多種寫法，跨企業分析無法據此分群。儲存格式維持單一文字欄位 `大類／子類`，既有自由文字資料不會失效，畫面會提示重新選擇。
- [x] MP-06J：新增 `GET /api/reibi/enterprise/account-usage` 與 `/reibi/accounts` 的「帳號上限管控」區塊。L5 端原本就看得到所有企業的授權使用率，但企業管理者沒有任何入口看自己的。授權上限以合約 `member_limit` 為準，方案級距（基本 100／成長 300／專業 500／旗艦 1000）僅供升級參考；90% 警示與超限為兩種不同狀態。
- [x] MP-S07：**Artifact 的使用人數是寫死的假資料**（`AccLimitScreen` 內為 `Math.floor(limit*0.72)`）。新系統改用 `reibi_enterprises.used_count` 的實際值。
- [ ] MP-06K：`VenueScreen` 體驗場域尚未移植。Artifact 內含台北／新北體驗中心的名稱、地址、所在區域、交通方式與「首次免費體驗（每人限一次）」預約入口，全為寫死內容，需先確認各中心的正式資料。
- [x] TST-S08：17 項 Python 測試（使用率計算、警示門檻、超限、除零、合約上限優先於級距、方案級距數值、跨企業不外洩、角色權限）。
- [x] AUDIT-S01：同時修正兩項先前的誤判 —— `AnnualStatsScreen` 年度統計實際上由 `/kpi` 涵蓋（含期間篩選、燈號分佈、有效評估人次、部門維度）；`LinePushScreen` 實際上已接在 `/reibi/service`。兩者均無缺口。

## 35. Batch S5 欄位級比對（2026-08-18）

對計價、分潤、計分、積分、狀態機逐一比對 Artifact 常數與公式。

### 完全一致，無須修改

- 報價 A 層四段級距（100／300／500／1000 → 60／120／180／300 萬）與付款折扣（年繳 0.95、半年 1.0、季繳 1.03）。
- A 層「人數空白不套級距」防呆（Artifact v1.9 專門修過的錯誤 AH）。
- B 層設備單價（床 800,000／椅 750,000／LA200 149,400）。
- C 層四方案（35,000／70,000／105,000／210,000）與高風險高管 14,000。
- D 層六項的 min／max 金額。
- 經銷商佣金四等級（銀 8／10／5、金 14／15／8、白金 20／20／12、戰略 28／28／18）、REIBI 保留下限預設 65%、每層上限檢查、D 層不分潤。
- 七個量表的計分與燈號門檻，含 PSS-4 第 3／4 題反向計分、BSRS-5 附加題 ≥2 強制紅燈、NMQ 取部位最大值、過勞加計風險因子（上限 4）。
- 22 項行動打卡的六個分類、標籤與數量，以及同項目 7 天間隔規則。
- 積分：打卡 5、日記 3、三高首次 20、PHQ-4／正念 5、PSS-4 10、回饋 `dept_head` 15／其他 10。
- 報價、合約、工單三個狀態機的狀態集合與轉移規則（「已到期」在 Artifact 是顯示標籤而非儲存狀態）。

### 已修正的缺口

- [x] QT-S01：**E 層完整結構**。Artifact `PRICING.E` 定義設備延保（原價 5–10%／年）、四項加值服務（3／5／4／8 萬）與續約 CPI 調幅上限 5%，共 13 個欄位；新系統原本只有一個由業務自行輸入的 `e_layer_fee` 數字。現已實作 `calculate_e_layer()`，延保與加值服務只在續約報價適用，CPI 以 `min(輸入值, 5%)` 強制截斷並在畫面標示已截去。
- [x] QT-S02：**升級報價差額 `calcUpgradeDiff`**。Artifact 以「（新年費 − 原年費）÷ 12 × 原合約剩餘月份」計算補收金額，剩餘月份以 30 天為一個月無條件進位；新系統原本完全沒有此計算，業務需自行心算。已實作 `calculate_upgrade_supplement()` 並照抄 30 天進位規則，否則同一份升級報價在兩套系統會算出不同金額。
- [x] MP-S08：**主平台評估的 10 積分**。Artifact `AssessWizard` 完成評估給 +10 積分（第 699 行），新系統的 `POST /api/sleep/assessment` 完全沒有給分。已補上，並確保積分寫入失敗時已儲存的報告仍正常回傳 —— 積分是附帶獎勵，不該讓報告變成錯誤。

### 刻意保留的差異

- B 層底價（床 520,000／椅 487,500／LA200 97,110）刻意不移植，程式碼註解已載明不對外暴露內部底價。副作用是沒有「低於底價」的防呆，折扣過大時不會被擋。
- 佣金 A 層基數：Artifact 在 `aLayerFee` 為空時會退回方案定價、再退回 240,000；新系統一律使用實際簽約的 `a_layer_fee`。以實際金額計算分潤較正確，但屬行為差異。
- C 層方案的 `execs`（含幾位高管）與 `days`（服務天數）未移植，兩者在 Artifact 僅作下拉選單的說明文字。
- 新系統新增 `discount_percent`（整單折扣），Artifact 沒有此欄位。

- [x] TST-S09：48 項新測試（E 層延保費率邊界、加值服務去重、CPI 截斷與 A 層套用、僅續約適用、升級差額進位與到期歸零、評估積分與 ledger 失敗容錯），並加測 A–D 層數值未因新增 E 層而改變。
- [x] TST-S10：3,445 項 Python 測試、159 項 pgTAP、37 項 E2E、`pip check`、TypeScript no-emit 與 Next.js production build 全數通過。

## 36. Batch S6 逐檔重掃四個 Artifact（2026-08-19）

依使用者要求「確保所有功能都移植」，這輪不看畫面清單，改逐檔翻 JSX 原始碼，重點放在**已移植畫面內部**被漏掉的東西 —— 上一輪的方法只比對畫面是否存在，抓不到這一類。

### 已補上

- [x] WO-S01：**D 層施工項目規格目錄**。Artifact `reibi-workorder_v1_4` 的 `D_ITEMS` 為六個項目各自帶著單位、預設數量、3–4 組規格下拉選項、交付項目與驗收標準；新系統的工單項目只有 name／spec／quantity／note 四個自由文字欄位。目錄已移植為 `backend/reibi_work_order_catalog.py`，由 `GET /api/reibi/work-orders/catalog` 供前端渲染，是唯一權威來源。
- [x] WO-S02：**逐條驗收**。Artifact 的驗收畫面把選中項目的 `acceptCriteria` 攤平成逐條 pass/fail＋備註，用「已通過／總條數」算進度，且只有全數通過才允許「驗收通過」。新系統原本每個項目只有一個 pass/fail、也沒有標準可對。已補上逐條勾核、進度條與後端強制：全部通過才能登錄「驗收完成」，且驗收勾核對不到已選項目時回 422（避免項目取消勾選後殘留的勾核讓分子超過分母）。
- [x] WO-S03：工單 `globalNote`（整體備註）與 `specialTerms`（特殊條款）欄位（原缺口報告 B1／B2）。
- [x] WO-S04：工單的施工場域檢視（原缺口報告 B3）。資料原本就從報價快照帶入 `items.dSites`，但表單完全沒有介面。
- [x] QT-S03：報價 `note`、`bCustomNote`、`dNote` 與盤點時另外發現的 `eNote` 四個備註欄位（原缺口報告 B4 只列了前三個）。
- [x] QT-S04：報價 C 層 `cFeeBase`／`cHighRiskFee` 拆分（原缺口報告 B5）。`c_layer_fee` 仍是唯一被分潤與付款時程引用的權威金額，兩個新欄位是明細。
- [x] QT-S05：**D 層場勘需求單**。Artifact `QuoteForm`／`ContractView` 的 `showSurvey` 是一張可列印的單子（已選項目、場域地點、現場勘查記錄欄）。新系統整個沒有。已補上，並讓報價、合約、工單三種文件都能產生同一份。
- [x] QT-S06：**人數級距建議配置**（Artifact `QuickQuote` 的 `applyTier`）。選定級距一併帶入 B 層設備數量（1/1/1、2/2/2、3/3/3、5/5/5）與 C 層方案。1000 人以上為定制型，Artifact 不給建議數量，此處同樣不提供。
- [x] QT-S07：**D 層套組快選**（`PRICING.D.bundles` 的基礎型／標準型／完整型）。只作為勾選預設值，不帶套組標價 —— Artifact 的套組金額是「快速試算」頁的區間中位數，與正式報價單逐項加總的結果本來就不同（完整型套組標 10–20 萬，六項逐項加總是 10.5–21.5 萬）。正式報價一律以逐項為準。
- [x] SUB-S01：**個人訂閱季繳方案**。Artifact 主平台 `SUB_PLANS` 與 L5 `PERSONAL_SUB_PLANS` 都是月繳 1／季繳 3／年繳 12 三個方案，新系統的 `plan_code` 只認 `monthly` 與 `annual`，發碼時以「不是 annual 就給一個月」計算到期日，季繳無從表達。三個方案的月數已改由 `SUBSCRIPTION_PLAN_MONTHS` 決定。
- [x] PTS-S01：**積分兌換目錄**。Artifact `PointsScreen` 有五個兌換項（生物資訊檢測 100／自律神經量測 200／體驗加次 50／優先預約 30／企業自訂彈性設定），新系統前端只寫死一顆「50 分兌換健康諮詢」按鈕。目錄已移到後端。第五項「企業自訂」在 Artifact 沒有固定點數，維持不列入自助兌換，畫面標示洽詢管道。
- [x] WO-S05：**工單指派服務人員**。`reibi_work_orders.service_staff_id` 自 Batch B 建表起就有欄位、外鍵與索引，但沒有任何程式碼寫入或讀取 —— 與 `cada642` 的企業區域、`7870028` 的預約服務場域同一類的死欄位。Artifact v1.4 的 `serviceStaffId` 是綁 L5 服務人員清單的下拉。已補上表單下拉、API 欄位與 Artifact 匯入時的 `artifact_id` 對照；原本的 `staff_names` 維持為現場人員名單，兩者不互相取代。
- [x] SEC-S01：順手修掉 `POST /api/reibi/health/points/redeem` 的自訂價格問題。原本 `cost` 是前端傳來的參數，等於讓使用者自己標價（Artifact 的兌換鈕只是 alert 請聯絡客服、不扣點，所以價格放前端不會有事；新系統會真的扣點）。現在只收 `reward_code`，點數一律查後端目錄。

### 核對後確認無缺口

- L5 `buildEntPaymentRows` 應收明細（A1–A3／B1–B3／C1–C3／D1–D2 共 11 列）與 `build_payment_schedule()` 逐列一致，含 B 層 30/40/30、D 層 50/50 與付款狀態初值。差異僅 C1 說明文字少了「(N 人)」，即已記錄的 `execs` 決策。
- `ParamsScreen` 的 ROI 三情境（保守 0.6／中性 1.0／樂觀 1.4）、三年淨 ROI 與回本月數，與 `calculate_roi()` 一致。
- `OSHActivityScreen` 職安問卷填答活躍度已移植，含「送出份數而非完成率」與不列入不法侵害的說明。
- `PointsScreen` 積分表列的 14 種獲取方式中，燈號改善 +20、連續 12 週 +60、舒曼波／LA200 體驗 +15、生物資訊檢測 +20、自律神經量測 +30、OKR 達標 +50 這幾項在 **Artifact 本身也只是靜態顯示文字**，從未呼叫 `DB.addPts`。實際會發分的項目新系統全數對上，非缺口。
- 工單 `pickDoc`（手動挑選既有合約／報價帶入）由「合約 → 建立施工工單」按鈕搭配 `contract_id` 外鍵取代。

### 待處理

- [x] AUDIT-S02：`L5-04G` 先前誤標為完成。已於 2026-08-19 在站內補上 `/reibi/l5/manual`，見 §39。
- [x] TST-S11：新增 `tests/test_work_order_catalog.py`（55 項：目錄與 Artifact 逐項比對、進度計算、孤兒勾核、由報價 D 層推導工單項目，以及 HTTP 層的路由順序、驗收把關與服務人員指派）與 `tests/test_migration_gap_fixes.py`（29 項：C 層拆分與折扣、三個訂閱方案月數、兌換目錄價格與前端不得帶價）。
- [x] TST-S12：3,549 項 Python 測試與 159 項 pgTAP 通過，TypeScript no-emit 與 Next.js production build 通過，18 個 migration 於空資料庫全量重播後 pgTAP 仍全綠。

## 30. Batch R1 讓 registry 成為 Batch D／E 的授權來源（2026-08-17）

背景：`roles.py` 定義 26 個權限字串，但後端只查詢其中 4 個（`manage_reibi`、`service_center`／`service_manage`、`enterprise_manage`），其餘 22 個從未被引用。實際授權靠 Batch D／E 各自寫死的角色集合，而那些集合成形於 14 角色 registry 之前。本批依 2026-08-17 決策只修 `admin_hr` 與 `reibi_data`。

- [x] IAM-R01：`reibi_batch_d.py` 的 `require_ohs_manager`、`require_occupational`、`require_aggregate_viewer` 改由 `has_permission()` 推導。`admin_hr` 取得職安管理與組織彙整存取，符合 §9 職掌；`admin_finance` 因 registry 持有 `org_analytics` 一併取得彙整檢視。
- [x] IAM-R02：`reibi_batch_e.py` 的 `require_org_analytics`、`require_org_report` 同步改為權限推導。`org_reports` 只有 `admin` 持有，故 AI 組織報告產生範圍不變（`reibi_super` 因 `all` 亦可）。
- [x] IAM-R03：新增 `require_cross_org_analytics`，`/analytics/cross-org` 與 `/analytics/cross-org/reports` 改用之，`reibi_data` 得以執行其定義職掌「跨企業去識別分析」。
- [x] SEC-R01：`/analytics/directory` **維持 `reibi_super` 限定**，不隨 `cross_org_analytics` 開放。該端點回傳 `contact_name`、`phone`、`email` 與四層費用，是客戶聯絡資料與定價，不是去識別分析。
- [x] SEC-R02：`/analytics/cross-org` 對沒有財務職掌的角色遮蔽金額（`contracted_revenue`、各經銷商 `revenue`、`goals.annual_revenue`），並回傳 `financials_redacted: true`。Batch J 已決定 `reibi_data` 在 L5 看不到合約費用與訂閱營收；若此端點照原樣回傳，同一份數字換個路徑就取得得到。樣本數、企業數、授權人數與健康彙整均保留。
- [x] SEC-R03：跨企業 AI 報告產生（`POST /analytics/reports` 的 `cross_org`）維持 `reibi_super` 限定。閱讀分析與產生報告是不同性質的行為，後者會呼叫 Gemini 並寫入紀錄。
- [x] SEC-R04：確認保護機制都在守門下方而非守門本身 —— k≥5 由 SQL 強制（`reibi_three_highs_aggregate` 等在 `v_n < 5` 時抑制）、OHS 寫入會剝除 `employee_name`／`name` 只留去識別員工代碼、`_org_code()`／`_org_scope()` 仍鎖租戶。放行角色不會削弱這三項。
- [x] TST-R01：新增 `tests/test_registry_backed_authorization.py`（81 項）。以參數化方式斷言每個守門放行的角色集合**恰好等於**持有對應權限的角色集合，並涵蓋不得連帶放行的角色、`/directory` 仍限 super、以及跨企業回應在真實請求下確實不含任何金額欄位。
- [x] TST-R02：更新 `test_role_authorization.py` 的守門宣告表。原本記錄落差的 `TestPermissionRegistryDivergence` 改寫為 `TestRegistryIsHonouredOverTheWire`，改為驗證 registry 已被遵守。
- [x] TST-R03：3275 項 Python 測試通過，`pip check` 無衝突，TypeScript no-emit 與 Next.js production build 通過。
- [ ] IAM-R04：`admin_it` 的 `security_audit` 尚無任何端點會查詢，該角色目前仍只有服務中心可用；`reibi_finance` 的 `distributor_manage`／`finance_manage` 亦然（經銷商、staff、訂閱仍為 `require_reibi_super`）。其餘 20 個未實作的 registry 權限一併列此。

- [ ] TST-Q10：企業 `admin`、`occupational_health` 與兩種經銷商角色的瀏覽器 E2E 尚未建立；這些角色需要先透過邀請流程建立帳號（Mailpit 已可自動收信），目前其權限已由 Python 矩陣完整覆蓋。

## 37. Batch S7 個人訂閱功能閘門（2026-08-19）

清單先前只有 `MP-01D`（一條**測試**項目）側面提到訂閱閘門，實作從未被列為待辦。`MP-06G` 的 L5 端
（申請、審核、一次性啟用碼、到期、發票權限）早已完成，但個人用戶端沒有任何閘門 —— 收款流程蓋好了，
門沒有裝，付費與否拿到的東西一模一樣。本批把門裝上。

### 判定

- [x] SUB-S02：判定沿用 Artifact 的 `isPro` 那一行 —— 企業員工一律視為訂閱版（A 層授權費已涵蓋），
  只有 `individual` 受管轄。未知角色不因「不認識」而被降級。
- [x] SUB-S03：到期採**延遲判定**（`effective_status`，對應 Artifact `effectiveSubStatus`）。
  不背景改寫任何資料列，讀取時才比對到期日。「到期自動降級但完整保留歷史資料」因此是實作方式，
  不只是文案：測試明確斷言到期後資料列數不變。
- [x] SUB-S04：訂閱改綁 `profiles.id`（新增 `profile_id`），不再以會員碼作為唯一憑證。
  Artifact 用會員碼是因為當時沒有帳號系統；理由與跨檔案交接索引改用外鍵相同。
  `member_code` 保留為客服查詢碼與 Artifact 匯入的對應鍵。

### 四道閘門（全部在後端執行）

- [x] SUB-S05：**AI 個人化建議**擋在**生成前**。免費個人用戶的評估照常儲存、燈號照常計算，
  但完全不呼叫 Gemini；前端 `recs` 為空時退回既有的標準衛教內容並標示可升級。
  擋在顯示端等於付錢產生一份不給看的報告。
- [x] SUB-S06：**年度改善追蹤報告**（`POST /api/ai-trend/{user_id}`）回 **402** 而非 403 ——
  402 是付費牆，403 會被前端當成「你不該來這裡」。閘門排在歷史查詢與 Gemini 呼叫之前。
- [x] SUB-S07：**歷史 3 個月限制**套用於 `/api/sleep/reports` 與 `/api/history/{user_id}`，
  並回傳 `hidden_count`。隱藏不是刪除，不回報筆數使用者會以為紀錄消失。
  限制只在查自己時套用：管理者查轄下員工看的是企業合約涵蓋的範圍。
- [x] SUB-S08：**優先預約**旗標隨訂閱狀態寫入預約紀錄（Artifact `isPriorityBooker`）。

### 使用者端

- [x] SUB-S09：`/subscribe` 頁 —— 目前狀態與到期提醒（前 30 天）、免費版與訂閱版功能對照、
  五條服務條款與同意版本記錄、三種方案申請、一次性啟用碼認領。
  企業員工看到的是「合約已涵蓋，不需訂閱」，不會對著一個買不到也不必買的頁面。
- [x] SUB-S10：頁面上**沒有金額**。Artifact 的付款是人工審核制（「請透過 LINE 或 Email 提供付款證明」），
  價格由客服個別議定，程式裡從來沒有這個數字，因此不需要外部提供任何內容即可完成移植。
- [x] SUB-S11：啟用碼比對雜湊，明碼不落地。查無此碼與碼已被使用回同一句話 ——
  分別回應等於讓人可以試出哪些碼存在。

### 順手修正

- [x] SEC-S02：`API.request` 原本把 HTTP 狀態碼吞掉，只回傳一句 message，
  呼叫端無從分辨付費牆與真正的失敗。改為保留 `status_code`，402 才能呈現為升級提示而不是「產生失敗」。
- [x] SUB-S12：方案月數與名稱改由 `reibi_subscription_gate` 單一定義，
  `reibi_batch_c` 改為引用。使用者端顯示的到期日與財務端核發啟用碼算出的到期日必須來自同一組數字 ——
  Artifact 就是因為兩份複本而在註解裡特別警告過。

- [x] TST-S13：新增 `tests/test_subscription_gate.py`（50 項純邏輯：角色管轄、延遲判定、
  到期提醒邊界、歷史裁切與隱藏筆數）與 `tests/test_subscription_endpoints.py`（33 項 HTTP：
  申請、條款版本、啟用碼一次性與不可枚舉、歷史限制、402 付費牆、企業員工不受影響）。
- [x] TST-S14：3,650 項 Python 測試與 159 項 pgTAP 通過（19 個 migration 於空資料庫全量重播後），
  TypeScript no-emit 與 Next.js production build 通過。

## 38. Batch S8 經銷商升級門檻與年簽約額基數（2026-08-19）

盤點 `ManualScreen`「分潤規則」分頁時對照程式碼發現的。手冊本身不是重點，是讀它的過程翻出了計價錯誤。

- [x] COM-S01：**修正年簽約額基數**。`calculate_distributor_commission` 原本回傳
  `annual_sales = a_base + b_base + c_base`，並以「年度業績」顯示在 `/reibi/operations` 的
  經銷商等級旁邊 —— 正好是超管決定升等時會看的那個數字。Artifact 實際執行的程式碼
  （`reibi-l5.jsx:4402` 的 `yearAmt`）**只計 A 層授權費**。一張雲朵床 80 萬，賣十台就跨過金牌
  800 萬門檻，而升等是永久的邊際成本（A 層 8% → 14%）。三層加總改由 `commission_base_total` 另外回傳，
  佣金金額不受影響。
- [x] COM-S02：**Artifact 自身矛盾的裁決**。手冊分頁 3920 行寫「年累積 **A+C** 層簽約額」，
  但同一分頁 3913 行的 C 層註記寫「不計入年累積業績」，策略頁 4389 行寫「僅計 A 層授權費，不含 B/C 層」，
  程式碼只算 A 層。四處三處一致，以程式碼為準。**手寫的手冊本身就是錯的** ——
  這是「手冊要由程式產生而非照抄」最直接的證據。
- [x] COM-S03：**補上升級門檻與進度**（`tier_progress`）。銀→金 800 萬、金→白金 2,000 萬。
  戰略級手冊註明「另議」，Artifact 也不自動判定，因此同樣不自動化。差別：Artifact 對白金顯示
  「最高等級」，本實作改為「戰略等級門檻另議」—— 戰略級是存在的，白金不是頂。
- [x] COM-S04：進度**不自動改變 `level_code`**。達標只顯示「已達門檻」，實際升等仍由超管操作：
  升等牽涉永久的分潤成本，不該因業績跨線而自己跳等。
- [x] COM-S05：`/reibi/operations` 的標籤由「年度業績」改為「年簽約額（A 層）」，並加上進度條。
  原標籤在基數修正後會產生歧義。
- [x] TST-S15：新增 `tests/test_commission_tier_basis.py`（29 項：基數只計 A 層、設備銷售不推進升級、
  佣金金額不因基數修正而變動、門檻邊界與進度上限、白金不標成最高等級、方案定價 fallback 維持不移植）。
  同時修正 `test_reibi_api.py` 中原本斷言 `annual_sales == 350000` 的那一行 —— 它把錯誤釘住了。
- [x] TST-S16：3,679 項 Python 測試通過，TypeScript no-emit 與 Next.js production build 通過。

## 39. Batch S9 L5 站內操作手冊與里程碑決策（2026-08-19）

- [x] MAN-S01：`/reibi/l5/manual` 六分頁上線（角色說明／新案開通／月結流程／分潤規則／常見問題／緊急操作），
  入口在 L5 總覽。開放給所有進得了 L5 的角色，包含經銷商 —— 他們也要對月結與分潤，
  手冊的用途就是讓操作的人查得到規則，限縮反而違背目的。內容純為規則說明，不含任何企業或個人資料。
- [x] MAN-S02：**會變的內容一律由程式產生，不另存靜態複本**。角色權限表取自 `roles.ROLE_DEFINITIONS`，
  分潤比例與升級門檻取自 `reibi_batch_c` 的 `COMMISSION_LEVELS` 與 `COMMISSION_TIER_THRESHOLDS`。
  新增角色或調整比例，手冊自動跟著變。
- [x] MAN-S03：`roles.py` 新增 `PERMISSION_LABELS`（30 個權限的人話說明）與 `documented_role_catalog()`。
  少了說明，角色表會把權限顯示成程式代碼，等於沒寫；`missing_permission_labels()` 讓漏補的情況直接測試失敗。
- [x] MAN-S04：**刻意不照抄 Artifact 的手寫內容**，三個原因都是盤點時實際踩到的：
  （1）「分潤規則」分頁寫「年累積 A+C 層簽約額」，與它自己的程式碼矛盾（見 §38 COM-S02）；
  （2）兩條 FAQ 描述的是 Artifact 的限制（「LINE 推播目前為模擬記錄」「大數據為模擬示範數據」），
  在新系統已不成立，照抄就是公布錯誤資訊；
  （3）三條緊急操作在講共用 PIN 與備援碼，那是已記錄的刻意不移植項（改用 Supabase Auth 邀請與 TOTP），
  照抄等於教操作人員去點不存在的功能。FAQ 與緊急操作已重寫為新系統的實況。
- [x] MAN-S05：**月結時程保留**（每月 30 日彙整 → 隔月 10 日對帳 → 隔月 15 日匯款）。
  這是 Artifact 手冊唯一在新系統完全沒有別處記載的營運知識，也是保留這一頁的主要理由。
- [x] MAN-S06：新案開通步驟改寫。Artifact 最後一步是「自動生成 orgCode、initPin、backupCode、
  memberPin、deptPin、adminPin」，共用 PIN 制已不存在，改為 Email 邀請、本人設定密碼與管理者 TOTP 綁定。
- [x] TST-S17：新增 `tests/test_manual.py`（51 項：角色表等於 registry、權限不得顯示成代碼、
  分潤比例與門檻等於計價模組、A+C 錯誤不得重現、已作廢字串不得出現、經銷商可讀而企業角色不可讀、
  回應不含企業或個人資料）。
- [x] TST-S18：3,736 項 Python 測試通過，TypeScript no-emit 與 Next.js production build 通過。

## 40. Batch S10 方案與定價頁（2026-08-20）

- [x] PRI-S01：`/reibi/pricing` 上線（Artifact `PricingScreen`）。A 層級距與付款係數、B 層設備單價與
  依人數級距的建議配置、C 層四方案與高風險加購、D 層六項估算區間、E 層延保與加值服務，涵蓋 Artifact 全部內容。
- [x] PRI-S02：**頁面上沒有任何寫死的金額**。Artifact 把「NT$60萬/年」「NT$169.94萬」直接打在頁面上，
  與報價計算是兩份各自維護的複本 —— 改了設備單價，報價單會變、定價頁不會。
  本實作全部由計價常數推導，B 層套組金額是設備單價乘出來的。
- [x] PRI-S03：為此把 `a_tiers`、`pay_factors`、`c_tiers`、`d_prices` 由 `calculate_quote_fees` 的**區域變數
  提升為模組常數**（`A_LAYER_TIERS` 等）。這是「單一權威來源」得以成立的前提；
  提升前它們在函式內，定價頁根本讀不到，只能再抄一份。
- [x] PRI-S04：與 Artifact 一樣是**登入後的站內頁面**（需 `manage_reibi`），不是對外公開的價目表。
  是否對外公開是尚未做出的商業決策，未在本批處理。
- [~] PRI-S05：**定價數字的有效性尚未經業務端正式確認。** 2026-08-20 以「先當作有效」為前提實作。
  頁面上明白揭露此前提（`disclaimer`），並註明實際成交以正式報價單為準 ——
  這個假設應該讓讀者看得見，而不是只寫在程式註解裡。要調價改 `A_LAYER_TIERS` 等常數即可，
  報價單與定價頁會同步跟著變。
- [x] TST-S19：新增 `tests/test_pricing_catalog.py`（45 項）。核心是**逐級距斷言頁面數字等於
  `calculate_quote_fees` 實際算出來的金額**，而不是斷言等於某個特定數字 ——
  後者會在調價時變成需要一起改的第三個地方，正好重蹈 Artifact 的覆轍。
- [x] TST-S20：3,801 項 Python 測試通過，TypeScript no-emit 與 Next.js production build 通過。
