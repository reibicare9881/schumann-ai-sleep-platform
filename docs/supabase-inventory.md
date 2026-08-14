# Supabase 現況盤點

初始盤點：2026-08-10；最近文件校正：2026-08-14
Project：`Schumann-AI-Platform`  
Project ref：`wfgqnjupemzfhaosmogx`  
盤點方式：Supabase MCP 唯讀 metadata 查詢、本機程式碼對照與 Supabase CLI baseline pull

## 摘要

- 專案狀態為 `ACTIVE_HEALTHY`，PostgreSQL 17.6。
- 初始 `public` schema 有 6 個資料表；Batch A–H migrations 套用後目前有 44 張 public tables，其中 38 張為 `reibi_*`。
- 本機與遠端共有 14 個 migrations，最新為 `20260814032823_reibi_mfa_self_enrollment`。
- 沒有 Edge Functions。
- 沒有 public views 或一般 table triggers。
- 已安裝的主要 extension：`pgcrypto`、`uuid-ossp`、`supabase_vault`、`pg_stat_statements`、`plpgsql`。
- 後端使用 `service_role` 存取 Supabase，因此應用程式層授權失誤會直接繞過 RLS。

## Public tables

| Table | 用途 | RLS | Policy | 主要關聯 |
| --- | --- | --- | --- | --- |
| `profiles` | 使用者基本資料、角色與組織歸屬 | 已啟用 | 使用者自己的 `id` | `org_code -> organizations.org_code` |
| `analysis_records` | 舒曼分析結果 | 已啟用 | 使用者自己的 `user_id` | `user_id -> profiles.id`，cascade delete |
| `appointments` | 預約與活動 | 已啟用 | 使用者自己的 `user_id` | `user_id -> profiles.id`，cascade delete |
| `organizations` | 組織、PIN hash 與 KPI/OKR 參數 | 已啟用 | 無 | 無外部 FK |
| `audit_logs` | 稽核紀錄 | 已啟用 | 無 | `user_id -> profiles.id`，set null |
| `sleep_reports` | 睡眠、疼痛、工作評估與建議 | 已啟用 | 無 | 目前沒有 FK |

## RLS 與權限

目前只有三個 policy：

- `profiles`: `auth.uid() = id`
- `analysis_records`: `auth.uid() = user_id`
- `appointments`: `auth.uid() = user_id`

三者都是 `FOR ALL`、角色為 `public`。Performance Advisor 建議將每列重算的 `auth.uid()` 改為 `(select auth.uid())`。

下列表雖已啟用 RLS，但沒有 policy，因此一般 Data API 角色無法透過 RLS 取得資料：

- `organizations`
- `audit_logs`
- `sleep_reports`

目前所有 public tables 都對 `anon`、`authenticated`、`service_role` 保留非常寬的 table privileges，包括 `TRUNCATE`、`REFERENCES`、`TRIGGER`。此外，public schema 的 default ACL 也會讓未來新建 table/function/sequence 繼承寬權限。後續 migration 應改成明確、最小權限的 grants。

## Security Advisor

### 必須先處理

1. `public.rls_auto_enable()` 是 `SECURITY DEFINER` event-trigger function，且 `anon`、`authenticated` 具有 `EXECUTE`。Supabase Advisor 判定它可透過 Data API RPC 呼叫。應撤銷 public/anon/authenticated execute 權限，或將管理函式移出 exposed schema。
2. FastAPI 全域使用 `supabase_service_role_key`。這本身可以是合理的 server-side 架構，但所有 API endpoint 都必須有完整的身分、組織與資源所有權檢查，因為資料庫 RLS 不會保護 service-role 查詢。
3. `GET /api/org/settings/{org_code}` 沒有登入依賴，且以 service role 對 `organizations` 執行 `select("*")`。這可能回傳 `member_pin`、`dept_pin`、`admin_pin` 的 hash，必須改成已授權 endpoint 並限定欄位。

### 需要納入 schema 整理

- `organizations`、`audit_logs`、`sleep_reports` 缺少符合實際角色模型的 policies。
- `sleep_reports.user_id` 與 `sleep_reports.org_code` 沒有 FK。
- `appointments.org_code` 與 `audit_logs.org_code` 沒有 FK。
- `profiles.id` 並未連到 `auth.users.id`；目前系統採自建 JWT 與 profile-based identity，需明確決定是否維持，不能在 migration 中默認改接 Supabase Auth。
- `organizations` 的三種 PIN 欄位需要保證只保存 bcrypt hash，並避免出現在一般讀取 response。
- 所有業務表目前都未啟用 `FORCE ROW LEVEL SECURITY`；若繼續由 service role 存取，仍需依賴 FastAPI 授權層。

## Performance Advisor

目前只有 primary-key indexes。Supabase Advisor 指出以下 foreign key 缺少 covering index：

- `analysis_records.user_id`
- `appointments.user_id`
- `audit_logs.user_id`
- `profiles.org_code`

依現有 FastAPI 查詢模式，後續也應評估：

- `sleep_reports(user_id, created_at)`
- `sleep_reports(org_code, created_at)`
- `analysis_records(user_id, created_at)`
- `appointments(org_code, service_type, execution_date, appointment_time)`
- `profiles(org_code, system_role)`
- `profiles(full_name, system_role)`

是否建立這些複合索引，應在有實際查詢量或 `EXPLAIN` 證據後確認；目前不直接建立。

## 資料與遷移結論

2026-08-14 範圍決策：不匯出或匯入舊 Artifact 的 `window.storage`，新 Supabase 業務資料乾淨起始。匯出／匯入架構保留為選用復原能力；詳見 [REIBI 舊 Artifact 資料不搬遷決策](reibi-legacy-data-scope-decision.md)。

- Supabase 目前沒有業務資料，已發布 Artifact 的既有資料並不在這個 project 裡。
- `reibi` 四個已發布 Claude Artifact 的原始碼未使用 Supabase URL、client 或 `anon`/`authenticated` key；它們使用各 Artifact 隔離的 `window.storage`，所以 database hardening 不會切斷既有 Artifact 資料。
- 若未來另行核准 Artifact 資料搬移，必須走獨立 export/import pipeline，不能假設 `db pull` 會帶回這些資料。
- CLI 已完成 `link` 與 `db pull`，baseline 位於 `supabase/migrations/20260810032520_baseline_remote_schema.sql`。
- baseline 只代表目前 Supabase schema；安全修正與 reibi 擴充必須拆成後續、可審查的 migrations。
- baseline 保留遠端現況，包括寬鬆 grants、公開可執行的 `SECURITY DEFINER` function，以及移除本機預設 `pg_net`/`pg_graphql` extension 的語句；這些項目應在後續 migration 處理，而不是改寫已記錄為 applied 的 baseline。

## Migration 順序與進度

1. `baseline_remote_schema`：已完成，只捕捉現有遠端 schema。
2. `harden_existing_access`：已套用遠端；撤銷瀏覽器角色直接 table access、鎖定 event-trigger function、優化 RLS policy 並保護敏感 settings endpoint。
3. `extend_reibi_domain`：已套用遠端；建立 REIBI 業務、健康與 Artifact 匯入基礎 tables、constraints、FK indexes、RLS 與明確 grants。
4. Batch B–F：商務閉環、財務夥伴、健康職安、Gemini 組織分析、設定服務及安全索引均已套用遠端。
5. `reibi_batch_g_secure_import`：已套用遠端；新增內部 Auth 白名單、可撤銷 session、登入稽核與可恢復 Artifact 匯入欄位。
6. Batch H identity roles：兩個 migrations 已套用遠端；完成可信角色 registry、邀請、TOTP 流程與交易式身分更新。
7. MFA self-enrollment：已套用遠端；只有 Supabase TOTP 驗證達 AAL2 後，才原子要求 MFA、撤銷舊應用 session 並寫入 audit。
8. Artifact data import：依 2026-08-14 範圍決策不執行；相關資料表維持 0 筆為預期。選用映射見 [Artifact 資料映射](reibi-artifact-mapping.md)，保留操作見 [Batch G 手冊](reibi-batch-g-runbook.md)。

## 本機驗證紀錄

- 全部 14 個 migrations 可從空白本機 Supabase Postgres 依序成功套用。
- 所有 Batch A–H 新增 REIBI public tables 均啟用 RLS；`anon`/`authenticated`/`PUBLIC` 沒有直接 table grants，`service_role` 只由 FastAPI 後端使用。
- `anon`、`authenticated` 對 `public` tables 的直接 grants 數量為 0。
- `anon`、`authenticated`、`service_role` 均無法直接執行 `public.rls_auto_enable()`。
- 三個既有 ownership policies 已限定為 `authenticated`，並同時包含快取式 `(select auth.uid())` ownership check 與 `WITH CHECK`。
- 本機 database lint 無 warning/error，2026-08-14 驗證為 135 個 pgTAP 測試全部通過。
- 遠端 14 個 migrations 與本機一致；MFA transaction 已以回滾測試確認 flag、session revocation 與 audit。Security advisors 只有既有的 [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) WARN，其他為刻意採 deny-by-default 的 RLS INFO；performance advisors 只有新系統尚無正式流量造成的 unused-index INFO。
- Railway Hobby 已建立 staging 後端，供遠端整合測試；舊 Artifact 正式網路匯入因範圍決策不執行。

## Advisor references

- RLS enabled without policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Public SECURITY DEFINER execution: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Authenticated SECURITY DEFINER execution: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Unindexed foreign keys: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- RLS init plan: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
- Leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
