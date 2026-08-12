# REIBI Batch G：Artifact 資料搬移與內部帳號操作手冊

## 完成範圍

- 四個 Artifact 皆有「匯出搬移資料」按鈕。
- 匯出格式固定為 `reibi-artifact-export/1.0`，包含來源、版本、匯出時間、分檔編號與 SHA-256。
- session、PIN、備援碼、token、lock、remember-login 與 handoff 暫存資料不匯出。
- 單檔以約 7.5 MB、最多 5,000 個 storage entries 分割，保留低於後端 10 MB 限制的安全空間。
- FastAPI 會再次驗證 SHA-256、移除敏感欄位、進行欄位映射與 k≥5 檢查。
- 完成過的相同 SHA-256 不重複匯入；失敗批次重跑時會跳過先前已成功的來源記錄。
- 正式匯入只接受 Supabase Auth 驗證、內部白名單啟用且 server-side session 未撤銷的 `reibi_super`。

## 1. 套用 migration

先在本機完成 `db reset`、pgTAP 與 database lint，再把 `20260812145751_reibi_batch_g_secure_import.sql` 推到遠端。不要直接在 Dashboard 手改 table；所有 schema 變更以 migration 為準。

## 2. 建立第一位 REIBI 內部帳號

1. 在 Supabase Dashboard 的 Authentication → Users 建立使用者，使用個人工作 Email，不使用共用信箱。
2. 確認 Email 已驗證，並複製該 Auth user UUID。
3. 在 SQL Editor 執行以下內容，替換三個值：

```sql
insert into public.reibi_internal_users
  (auth_user_id, email, display_name, internal_role, is_active, mfa_required)
values
  ('AUTH_USER_UUID', lower('operator@example.com'), '內部人員姓名', 'reibi_super', true, false);
```

建立資料列不等於建立 Auth 密碼；密碼仍完全由 Supabase Auth 管理。`user_metadata` 不作為權限依據。

若該 Auth user 已完成 TOTP enrollment，可把 `mfa_required` 改為 `true`。之後登入頁必須同時提供六位數驗證碼，後端驗到 AAL2 才會建立工作階段。尚未 enrollment 時不要先開啟，否則系統會按設計拒絕登入。

## 3. 匯出四個已發布 Artifact

必須重新發布含 Batch G 匯出工具的四個檔案，然後在各自的已發布 Artifact 執行：

1. 截圖該 Artifact 主要清單與筆數。
2. 點右下角「匯出搬移資料」。
3. 保存所有 `partNofM.json`；同一輪所有分檔的匯出時間應相同。
4. 不要編輯 JSON。任何修改都會造成 SHA-256 預檢失敗。
5. 四個 Artifact 的 storage 彼此隔離，必須各自匯出，不能只匯出其中一個。

## 4. 正式匯入前還原點

正式遠端匯入前，先在 Supabase 建立可用的資料庫 backup／PITR 還原點，並記錄：備份時間、操作者、project ref、四個來源版本、各檔 SHA-256、來源筆數截圖。沒有可驗證的還原點時只允許預檢，不執行正式寫入。

## 5. 預檢與匯入

1. 用一般企業 `admin` 可先進管理中心執行預檢，但不可正式匯入。
2. 以 `/reibi-login` 登入 `reibi_super`。
3. 逐檔載入 JSON；版本化匯出檔的來源與版本以 envelope 為準。
4. 確認 storage keys、目標 tables、warnings、record count 與 SHA-256。
5. 依 `main → l5 → quote → workorder` 順序匯入；同一來源依 part 由小到大。
6. 每檔完成後記錄 batch id、imported、rejected、resumed 與 target counts。
7. 若 batch 為 `failed`，修正映射或資料後重送同一份原始檔；系統會建立 retry lineage 並跳過前次成功記錄。

## 6. 完成核對

- 四個來源的匯出筆數與 import batch/record 筆數一致。
- `rejected_count = 0`；skipped 僅能是已知不搬移或無安全映射項目。
- 報價→合約→工單關聯、企業與場域關聯完整。
- 舊 activation code 未沿用；需要時重新核發。
- 歷史 AI 內容沒有偽標成 Gemini；新產出仍只使用 Gemini。
- 組織彙整沒有小於 5 人的資料。
- 完成簽核前，舊 Artifact 保持唯讀且不要刪除原始匯出檔。

## 7. 緊急撤銷內部存取

```sql
update public.reibi_internal_users
set is_active = false, deactivated_at = now(), updated_at = now()
where auth_user_id = 'AUTH_USER_UUID';

update public.reibi_internal_sessions
set revoked_at = now(), revoked_reason = 'security_response'
where auth_user_id = 'AUTH_USER_UUID' and revoked_at is null;
```

這會讓後續 FastAPI 請求立即失效；仍應同時在 Supabase Auth 停用或刪除該使用者，並依事件處理程序輪替可能受影響的 secrets。
