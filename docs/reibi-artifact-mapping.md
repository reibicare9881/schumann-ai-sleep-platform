# REIBI Artifact 資料映射

## 範圍與原則

盤點來源為 `reibi` 內四個已發布 Artifact 的實際 `window.storage` 讀寫程式碼，而非只依畫面或規格文件推測。四個 Artifact 的儲存空間彼此隔離，因此同名或互相引用的 key 不代表資料真的已同步。

移植採兩層策略：常用且需要關聯查詢的欄位正規化；每筆資料另存 `source_payload`（匯入佇列使用 `raw_payload`），確保 Artifact 新舊版本的額外欄位不會遺失。正式瀏覽器不直接存取這些表，FastAPI 使用 `service_role` 並負責授權。

## 主平台 (`reibi-v10_3_34`)

| Artifact storage key | 內容 | 目標 |
|---|---|---|
| `sess`、`rem_*` | 登入 session、記住登入 | 不搬移；改用 Supabase Auth/FastAPI session |
| `pin_*`、`rc_*`、`lk_*` | PIN、備援碼、鎖定狀態 | 不搬明碼/舊雜湊；上線時重新核發憑證 |
| `rpts` | 個人綜合評估：`profile`、ISI `sScore/sL`、BPI `pScore/pL`、工作分數、AI 建議 | 既有 `sleep_reports` 為相容目標；匯入追蹤寫入 `reibi_artifact_import_records`。額外職健量表寫 `reibi_health_assessments` |
| `org_{orgCode}` | 組織去識別評估摘要，最多 500 筆 | `reibi_health_assessments` 或重新彙整至 `reibi_org_aggregates` |
| `pts_{uid}`、`ci_{uid}` | 點數、簽到 | 暫留原始匯入記錄；待點數規則定案後再建 ledger，避免只搬不可稽核餘額 |
| `appt_{orgCode}` | 組織預約 | 既有 `appointments`，並保留匯入來源 |
| `svc_{orgCode}`、`prs` | 服務請求、問題回報 | `reibi_service_tickets` |
| `setup_{orgCode}`、`dept_struct_{orgCode}` | 組織設定、L1–L4 部門樹 | `reibi_departments`；非結構設定保留於 enterprise `source_payload` |
| `params_{orgCode}` | ROI 參數 | 既有 `organizations` ROI 欄位 |
| `reibi_orgs`、`org_members_{orgCode}` | 已註冊組織與成員索引 | 組織/會員資料匯入時重建，不把索引陣列當權威資料 |
| `th_{uid}` | 三高、BMI、部門與同意狀態 | `reibi_health_assessments`，同意資訊保留在 `source_payload` |
| `sleep_diary_{uid}`、`pain_diary_{uid}` | 睡眠／疼痛日誌 | `reibi_health_diary_entries` |
| `ow_hist_*`、`msk_hist_*`、`bsrs5_hist_*`、`viol_hist_*`、`mental_hist_*` | 職場過勞、肌骨、BSRS-5、職場暴力與心理量表歷史 | `reibi_health_assessments`，以 `assessment_type` 區分 |
| `osh_cnt_{type}_{orgCode}` | 量表累計計數器 | 不直接搬移；由 assessment 明細重算 |
| `ow_roster_{orgCode}` | 職健名冊（員工代號、部門） | `reibi_ohs_records(record_type='roster')` |
| `ohs_hazards_*`、`ohs_measures_*`、`ohs_reviews_*`、`ohs_meta_*` | 危害、措施、審查與職安後設資料 | `reibi_ohs_records` |
| `org_th_*`、`org_th_dept_*` | k>=5 的組織／部門健康彙整 | `reibi_org_aggregates`；資料庫約束 `sample_size >= 5` |
| `subs` | 個人訂閱申請、同意、核准與到期 | `reibi_subscriptions` |
| `remit_{orgCode}` | 匯款認領、影像、AI OCR 結果與人工更正 | `reibi_remittances`；影像改放 Supabase Storage，表內只存路徑 |
| `reibi_versions`、`reibi_snapshots` | Artifact 版本與本機快照 | 不當成正式業務資料；匯入批次記錄來源版本與檔案雜湊 |

## L5 後台 (`reibi-l5_v2_14`)

| Artifact storage key | 主要欄位 | 目標 |
|---|---|---|
| `l5_session`、`l5_active_context`、`l5_pin_*`、`l5_pin_partner_*` | session、跨 Artifact 暫存身份、PIN | 不搬移；改用正式身分與權限模型 |
| `l5_enterprises` | `orgCode/orgName/orgAlias`、聯絡資料、UBN、地址、`dSites`、方案、人數、合約日期、A–D 層費用、設備、狀態、來源 | `reibi_enterprises` + `reibi_enterprise_sites` |
| `l5_distributors` | 上下級經銷商、區域、等級、統編、地址、聯絡資料、服務人員、分潤 | `reibi_distributors` |
| `l5_partners` | 推薦夥伴、聯絡人、預設分潤 | `reibi_partners` |
| `l5_staff` | 員工代號、姓名、職稱、電話、Email | `reibi_staff` |
| `l5_settings` | REIBI 保留比例等營運設定 | 先保留在匯入原始記錄；設定 API 實作時再建立具名設定欄位 |
| `l5_invoices` | 發票號碼／日期、企業、層級、品項、未稅額、稅額、總額、狀態 | `reibi_invoices`（品項暫存 JSONB） |
| `l5_personal_subs` | 會員碼、方案、金額、發票、核准與啟用碼 | `reibi_subscriptions` |
| `l5_tickets` | 企業、類型、優先級、期望日期、處理人、狀態 | `reibi_service_tickets` |
| `l5_line_logs` | 對象、範本、訊息、發送人與模擬狀態 | `reibi_message_logs` |
| `l5_remit_index`、`l5_mhi_agg_index` | 跨 key 查詢索引 | 不搬移；由資料表索引與查詢取代 |
| `l5_mhi_agg_{orgCode}`、`l5_health_agg_{orgCode}` | k>=5 去識別彙整 | `reibi_org_aggregates` |
| 佣金 ledger、變更請求等 L5 擴充 key | 分潤歷程、管理變更 | 先完整進 `reibi_artifact_import_records`；財務規則確認後再正規化，避免錯誤結算 |

## 報價／合約 (`reibi-quote_v1_13`)

| Artifact storage key | 主要欄位 | 目標 |
|---|---|---|
| `rq_session` | 本機操作身份 | 不搬移 |
| `rq_quotes` | 單號、類型、狀態、客戶／經銷商快照、地址／場域、A–E 層費用與設定、來源人員、原合約、版本歷程 | `reibi_quotes`；複合設定寫 `config`，整筆保留於 `source_payload` |
| `rq_contracts` | 從報價複製的商務快照、合約單號、來源報價、狀態 | `reibi_contracts`，以 `quote_id` 關聯 |
| `__rq_handoff_*` | 跨 Artifact 一次性 handoff payload/index | 不作正式資料；正式系統改由資料表關聯與 API 操作 |

## 工單 (`reibi-workorder_v1_4`)

| Artifact storage key | 主要欄位 | 目標 |
|---|---|---|
| `rq_workorders` | 工單號、合約號、客戶／場域、服務人員、施工排程、項目規格與數量、雙方範圍確認、驗收勾選、異常清單、簽名、狀態歷程 | `reibi_work_orders`；項目／驗收／狀態歷程分別存 JSONB 並保留 `source_payload` |

## 匯入流程

1. 從每個已發布 Artifact 個別匯出其 `window.storage`；四份 export 不可互相替代。
2. 建立 `reibi_artifact_import_batches`，記錄 Artifact、版本與 export SHA-256。
3. 每個 storage key／陣列元素先寫入 `reibi_artifact_import_records`，以 `(batch_id, storage_key, source_record_id)` 保證可重跑。
4. 驗證日期、金額、單號與關聯後，再 upsert 到目標表；無法映射的欄位仍留在 raw payload，錯誤列標為 `rejected`。
5. 比對每個 key 的來源筆數、匯入筆數、拒絕筆數與金額合計；完成後才把 batch 設為 `completed`。

目前 repo 只有 Artifact 原始碼，沒有已發布環境中的 `window.storage` 實際資料，因此 migration 能先完成，真正搬移仍需要四個 Artifact 各自的 export。

FastAPI 已提供 `/api/reibi/artifacts/validate` 預檢與 `/api/reibi/artifacts/import` 正式匯入骨架。JSON 格式、權限及本機啟動方式見 `docs/reibi-local-development.md`。目前網頁只開放預檢；跨組織匯入必須使用尚待接入正式身分系統的 `reibi_super`。

## AI 統一規則

新資料只接受 `ai_provider = 'gemini'`。Artifact 既有 Claude 呼叫程式不會移植；歷史 AI 文字可作為來源內容保留，但不能偽標成 Gemini。FastAPI 實作時應由後端呼叫 Gemini，並記錄實際 `ai_model`。
