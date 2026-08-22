# REIBI 移植：合併 `main` 前的發布檢查清單

建立日期：2026-08-17（Asia/Taipei）；目前狀態校正：2026-08-21

分支：`codex/reibi-fastapi-merge` → `main`

本清單的每一項都標明**由誰執行**。標「開發代理」的項目已完成或可由 AI 代理完成；標「專案負責人」的項目需要 Supabase Dashboard、GitHub 或雲端主控台權限，**不應由代理代為操作**。

---

## 1. 自動化驗證關卡（開發代理，每次提交前）

四道關卡都必須綠燈才可推送。下表的舊數字僅為 2026-08-17 歷史紀錄；目前基準與缺口請見 [完整進度與缺漏報告](reibi-migration-status-report.md)。

```powershell
Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
Set-Location C:\sleepm_merge\frontend
npx.cmd tsc --noEmit
npm.cmd run build
```

```powershell
Set-Location C:\sleepm_merge
npm.cmd run db:reset
npm.cmd run db:test
npm.cmd run db:lint
```

```powershell
Set-Location C:\sleepm_merge\frontend
npm.cmd run e2e
```

| 關卡 | 現況（2026-08-17） | 執行者 |
|---|---|---|
| `pip check` | 無衝突 | 開發代理 |
| Python 測試 | 歷史：3,275 passed；目前基準：3,903 passed | 開發代理 |
| TypeScript `--noEmit` | 通過 | 開發代理 |
| Next.js production build | 通過 | 開發代理 |
| pgTAP（`db:test`） | 歷史：146 passed；目前 159 項計畫，需在 Docker 本機堆疊重跑 | 開發代理 |
| Database lint | `No schema errors found` | 開發代理 |
| Playwright E2E | 24 passed（18 desktop + 6 mobile） | 開發代理 |

E2E 前置條件：Docker Desktop Engine running → `npm run supabase -- start` → `npm run db:reset` → `backend\.venv\Scripts\python.exe tests\e2e_seed.py`。

---

## 2. 安全驗收

| 項目 | 狀態 | 執行者 |
|---|---|---|
| 全路由 401 邊界（166 條受保護路由 × 6 種無效憑證） | ✅ 完成 | 開發代理 |
| 公開路由明文允許清單（10 條，新增未登記者測試失敗） | ✅ 完成 | 開發代理 |
| 14 角色 × 具名守門的 403 矩陣 | ✅ 完成 | 開發代理 |
| 個人健康紀錄 IDOR／BOLA | ✅ 完成並修正 5 個缺陷 | 開發代理 |
| 跨企業 `org_code` 越權 | ✅ 完成 | 開發代理 |
| 瀏覽器不取得 service role／refresh token | ✅ E2E 驗證 | 開發代理 |
| k≥5 隱私門檻（SQL 層強制） | ✅ 驗證 | 開發代理 |
| **Supabase leaked-password protection** | ⬜ **未啟用，2026-08-22 查明需要 Pro 方案** | **專案負責人** |
| **正式 secrets 最終核對** | ⬜ 待辦 | **專案負責人** |
| **正式 CORS／網域／HTTPS** | ⬜ 待辦 | **專案負責人** |

### 2.1 啟用 leaked-password protection（專案負責人）

**2026-08-22 查明：Dashboard 上該開關標註「Only available on Pro plan and above」，目前 Free 方案下無法確認能否真的存檔生效。** 與第 3.3 節「Supabase 升級 Pro」綁在一起處理，待升級後再回來完成下列步驟。

1. Supabase Dashboard → Authentication → Sign In / Providers → Email → Prevent use of leaked passwords。
2. 開啟 “Prevent use of leaked passwords”。
3. 回歸測試：
   - 用一個**已知外洩的弱密碼**（例如 `password123456`）走一次 `/auth/complete` 邀請設定密碼，應被拒絕並顯示可理解的訊息。
   - 用一組強密碼重做同一流程，應成功。
   - 既有帳號 `reibicare9881@gmail.com` 登入不受影響。
4. 確認 Dashboard → Advisors → Security 的唯一 WARN 消失。

不需要資料 migration。啟用前請先準備好客服說明，因為既有使用者下次改密碼時可能被擋。

### 2.2 正式 secrets 與 CORS 核對（專案負責人）

Railway 後端必須有：`GEMINI_API_KEY`、`JWT_SECRET_KEY`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`FRONTEND_URL`、`DEBUG=false`。

Vercel 前端必須有：`NEXT_PUBLIC_API_URL` 指向正式 backend。

檢查重點：

- `SUPABASE_SERVICE_ROLE_KEY` 只存在 Railway，**不得**出現在任何 `NEXT_PUBLIC_*`。
- `FRONTEND_URL` 必須等於實際的 Vercel 正式網址，否則 CORS 與邀請 callback 會失敗。
- `DEBUG` 在正式環境必須為 `false`。
- 改任何變數後**必須重新部署**，並實際在瀏覽器 Network 確認生效 —— Dashboard 有變數名稱不代表新 deployment 取得了值。
- `JWT_SECRET_KEY` 若變更，既有應用 JWT 立即失效，需搭配公告與強制重新登入。

---

## 2.3 ⚠️ Railway production 環境自 2026-06-02 起部署失敗（專案負責人）

2026-08-17 以 GitHub deployment 紀錄查證：

| 環境 | 分支／commit | 最後狀態 |
|---|---|---|
| Railway `staging` | `codex/reibi-fastapi-merge`（基準 `ed75d9b`） | 正常，**這是實際在服務的後端** |
| Vercel `Preview` | `codex/reibi-fastapi-merge`（基準 `ed75d9b`） | 正常，**這是實際在使用的前端** |
| Railway `production` | — | **連續三次 failure**（2026-06-02 ×2、2026-06-05），之後未再嘗試；**2026-08-22 已刪除** |
| Vercel `Production` | `main` `b1e7af3`（2026-06-05） | 部署成功但其後端不通 |

也就是說目前**以 staging 環境充當正式環境**，而 Railway 的 production 環境是壞的。

這對合併 `main` 有直接影響 —— 合併會觸發 production 部署，而該環境自 6 月起未曾成功。合併前必須先決定：

- [ ] **選項 A**：修好 Railway production 環境（找出 6/2 起的失敗原因、補齊 §2.2 的所有環境變數），合併後才有可用的正式站。
- [x] **選項 B（2026-08-22 已決定並執行）**：正式承認 staging 環境就是正式環境，更新本文件與交接手冊的用語，並確認其環境變數符合 §2.2 的正式要求（特別是 `DEBUG=false`）。**未**變更 Railway 環境名稱或網域（仍為 `schumann-ai-sleep-platform-staging.up.railway.app`），刻意避免網域切換造成的服務中斷風險。
- [x] **選項 C（2026-08-22 以刪除取代停用）**：原計畫僅停用 production 環境的自動部署，但 Railway CLI 的來源分支設定為整個 service 共用一份、無法個別環境停用；且該環境持續失敗兩個多月、選項 B 已使 staging 成為正式認定環境，故直接**刪除**該 Railway `production` 環境（ID `085c8256-1f29-45c5-9818-4083178f0b0f`），不再保留。刪除前確認 staging 部署與 `/health` 未受影響。

無論選哪一個，都要確認 Vercel `Production` 的 `NEXT_PUBLIC_API_URL` 指向實際可用的後端；目前它指向的後端不通，且其對應的 Railway `production` 環境已不存在，需另外決定 Vercel Production 要指向哪個後端。

**2026-08-22 執行結果**：確認 Railway `staging` 環境的 `DEBUG=False`、`GEMINI_API_KEY`／`JWT_SECRET_KEY`／`SUPABASE_URL`／`SUPABASE_SERVICE_ROLE_KEY`／`FRONTEND_URL` 均已設定，符合 §2.2 正式要求。`FRONTEND_URL` 指向 Vercel Preview（受 SSO 保護），因為那就是目前實際服務的前端。Railway `production` 環境已刪除。**Vercel 那一側（Production 網域指向哪個後端、是否／如何解除 SSO）尚未變更**，需要另外決定，見下方待辦。

### 這與資安無關

`main`（`b1e7af3`）確實仍含 §2 記錄的個人健康紀錄 IDOR／BOLA，但因其後端未在運行，**這些漏洞未暴露在任何可運作的系統上**。實際服務的 staging + Preview 跑的是已修正的 feature branch。合併後漏洞即隨程式碼一併修補。

---

## 2.4 🟡 單位通行碼沒有任何自助重設管道（2026-08-22 已補上 email 重設路徑，PIN 本身仍保留）

**2026-08-20 實際踩到。** 這一項比功能缺口更接近「會擋住上線」。

**2026-08-22 執行結果**：選擇下方選項 2（遷移到 Supabase Auth 邀請制），且發現既有的邀請
（`/reibi/accounts`）、登入（`/reibi-login`）、設定密碼（`/auth/complete`）三段基礎建設
早已完整支援組織角色（`ORG_ADMIN_ASSIGNABLE_ROLES` 已含 `member`／`dept_head`／
`occupational_health` 等），只是從未被串上「忘記密碼」——`reibi_manual.py` 站內手冊文字
宣稱「密碼由本人透過 Email 重設」，但程式碼裡完全沒有觸發重設信的機制，文件與實作對不上。

補上的東西：
- 後端 `POST /api/auth/request-password-reset`（`backend/reibi_batch_g.py`）：呼叫 Supabase
  `reset_password_for_email`，導回既有的 `/auth/complete` 設密碼頁；不論帳號是否存在都回相同
  訊息，避免被拿來枚舉已註冊信箱。已登記進 `test_permission_matrix.py` 的 `PUBLIC_ROUTES`。
- 前端 `/reibi-login/forgot-password`：輸入 email 觸發重設信，`/reibi-login` 加上入口連結。
- `/auth/complete` 文案微調為邀請與重設共用（原本寫死「完成邀請」）。
- 四道驗證關卡（`pip check`、3,903 項 pytest、`tsc --noEmit`、Next.js build）均已重跑通過。
- **2026-08-22 補充**：`/api/analyze` 上傳防護補完後，pytest 增至 3,907 項；再加上結構性惡意內容檢查後增至 3,920 項；再加上 ClamAV 病毒掃描整合（`scan_for_malware()`，本機 Docker 完整驗證，見 [ClamAV 部署說明](reibi-clamav-setup.md)）後，最終 **3,925 項全數通過**。

**這解決的範圍**：任何已經被邀請、有 Supabase Auth email 帳號的人，忘記密碼可以自救。
**這沒解決的範圍**：既有靠 PIN 自動建立、從未留下 email 的帳號，仍然沒有 email 可寄，
必須先由組織 admin 提供姓名＋email 名冊、經 `reibi_super` 或已遷移的組織 admin 逐一補發邀請，
這步驟本質是人工協調，非程式可解。PIN 登入本身**沒有移除**，與 email 登入並存，待各組織
陸續遷移完成後再個別評估是否關閉。

企業成員、部門主管與單位管理者透過 `/login` 以「單位代碼 + 通行碼」登入，通行碼是
`organizations` 表上的 bcrypt 雜湊（`member_pin`／`dept_pin`／`admin_pin`）。**忘記之後沒有任何管道可以救：**

| 途徑 | 狀態 |
|---|---|
| 站內自助重設 | ❌ 不存在 |
| Artifact 的備用碼重設 | ❌ 刻意不移植（改用 Supabase Auth 邀請與 TOTP，見缺口報告 C 類） |
| 人工核驗佇列 | ⚠️ 已實作，但要 `reibi_super` 才能處理 |
| 直接改資料庫 | ⚠️ 目前唯一可行，需要有人下 SQL |

死結在於：一般企業客戶**不會有 `reibi_super` 帳號，也不會有人幫他們下 SQL**。
今天的情境是自家人忘記測試企業的 `admin_pin`，改用受邀帳號繞過；正式客戶沒有這個備案。

重設用的 SQL（pgcrypto 已確認可用，且既有雜湊為 `crypt()` 認得的 bcrypt 格式）：

```sql
update public.organizations
set admin_pin = crypt('新通行碼', gen_salt('bf', 12))
where org_code = 'ORG-XXXX-26-000001';
```

**上線前至少要三選一：**

1. 做一個站內重設流程（例如以單位聯絡 Email 寄一次性連結）
2. 把單位角色也遷移到 Supabase Auth 邀請制，讓 Email 重設涵蓋全部角色 —— 與 Batch H 的方向一致
3. 正式接受「只能人工處理」，但**必須**先寫好客服 runbook 並確認有人有權限執行

另外附帶一個相關風險：`/login` 的個人模式與單位模式在 `profiles` 找不到人時會**自動建立帳號**
（`main.py` 約 333 行）。因此知道單位代碼與通行碼的人可以用任意姓名無限產生帳號 ——
遠端目前 25 個 `member`、10 個 `admin`、20 個 `individual` 多半由此累積。
這在 staging 無害，但與 §8.3「staging 與正式共用同一個 Supabase 專案」相加就不是無害。

---

## 3. 資料庫與備份（專案負責人）

| 項目 | 說明 |
|---|---|
| ⬜ 備份確認 | Supabase Dashboard → Database → Backups，確認自動備份已啟用且有可用還原點 |
| ⬜ 還原演練 | 在**非正式**專案或分支資料庫實際還原一次，記錄耗時與步驟 |
| ✅ 套用待補的 migration | 2026-08-20 已套用第 17–19 個版本；其後第 20 個場域 migration 亦已套用，遠端與 repo 同為 20 個 |
| ✅ Migration 歷史核對 | 遠端與 repo 目前 20 筆對齊 |
| ⬜ 監控與告警 | 設定後端錯誤率、Supabase 連線數與 Gemini 失敗的告警管道 |

> 這段原本寫「本次移植未新增任何 migration，遠端 schema 維持 16 個版本」。該敘述自 2026-08-18 起不成立，
> 已於 2026-08-19 更正並於 2026-08-20 完成套用。保留此段是為了記錄「敘述過期會讓人跳過必要步驟」這件事。

**2026-08-20 歷史紀錄。** 當時遠端與 repo 同為 19 個 migration；目前已為 20 個。套用前後的實際步驟：

| 步驟 | 結果 |
|---|---|
| 自動備份查詢 | `pitr_enabled: false`、`backups: []` —— **查不到可用還原點**，因此改採手動 schema dump |
| 手動備份 | `backups/schema-before-migration-20260820.sql`（6,677 行、51 個 CREATE TABLE／FUNCTION／POLICY），未進版控 |
| 唯一索引預檢 | `reibi_subscriptions.activation_code_hash` 重複組數 `0`，索引可乾淨建立 |
| 套用 | 三個 migration 成功，19 筆 local／remote 對齊 |
| 物件驗證 | 以遠端唯讀查詢確認：`consent_org_aggregate` 1 欄、報價 6 欄、工單 2 欄、訂閱 2 欄與 2 個索引全部存在 |

三個 migration 均為純新增（無 `drop`／`truncate`／型別變更），因此 schema dump 已足以作為回滾依據，
不需要匯出含真實健康資料的 data dump。

三個 migration 都已在本機資料庫以 `supabase db reset` 全量重播驗證，159 項 pgTAP 通過。

---

## 4. Code review 與合併（專案負責人）

| 步驟 | 說明 |
|---|---|
| ✅ 開 Draft PR | 已由專案負責人建立；仍待 review 與轉為 ready |
| ⬜ Review 範圍 | migration、API 授權、前端、runbook |
| ⬜ 轉 Ready for review | 四道自動化關卡全綠後 |
| ⬜ 合併 `main` | Review 通過後 |
| ⬜ 正式 smoke test | 合併後依 §5 執行 |

### Review 時建議優先看的檔案

1. `backend/main.py` 的 `assert_can_read_user_records()` —— 個人健康紀錄的統一存取規則。
2. `backend/reibi_batch_d.py`、`reibi_batch_e.py` 的守門改為 `has_permission()`。
3. `backend/reibi_batch_e.py` 的 `redact_financial_figures()` —— 跨企業金額遮蔽。
4. `backend/tests/test_permission_matrix.py` 的 `PUBLIC_ROUTES` —— 10 條刻意公開的路由是否都同意。

---

## 5. 合併後正式 smoke test（專案負責人）

在**正式**網址上依序確認：

1. `/reibi-login` 以 `reibicare9881@gmail.com` 登入，MFA 要求六位碼並到達 AAL2。
2. `/reibi` 跨企業列表載入。
3. `/reibi/l5` 顯示四個流程卡。
4. `/reibi/service` 顯示合法企業與部門架構。
5. 未登入呼叫任一 `/api/reibi/*` 收到 401。
6. 企業 `admin` 指定其他 `org_code` 收到 403。
7. 瀏覽器 Network 確認前端連到正式 backend，而非 localhost 或 staging。
8. 開啟一份既有報告，確認 PDF 產生正常。

---

## 5.1 staging 實測結果（2026-08-20，已完成）

套用第 17–19 個 migration 後在 staging／Preview 上實際操作，不是只看 migration 帳本。

| 驗證項目 | 對應 migration | 結果 |
|---|---|---|
| 個人模式送出睡眠評估 → 跳出報告頁 → 歷史有紀錄 | 17（`consent_org_aggregate`） | ✅ 通過 |
| 受邀 `admin` 帳號建立報價，填三個備註後重開確認留存 | 18（報價備註欄位） | ✅ 通過 |
| 遠端唯讀查詢確認欄位與索引存在 | 17／18／19 | ✅ 全部存在 |
| 個人訂閱申請與啟用碼寫入路徑 | 19（`profile_id`） | ⬜ 未實測 |

**第 17 個特別值得記一筆**：它與用到它的程式碼自 2026-08-18 起就在 `origin`，但遠端資料庫直到
2026-08-20 才套用。`main.py` 的評估 insert 帶了該欄位，因此這段期間 staging 的睡眠評估很可能一直是壞的。
這正是 §3 那句過期敘述（「本次移植未新增任何 migration」）造成的實際後果。

**第 19 個尚未端對端實測。** 訂閱閘門在查詢失敗時的設計是「視為未訂閱」（fail closed），
因此畫面上「免費用戶」與「查詢壞掉」長得完全一樣 —— 點畫面證明不了它有效，只能證明它沒有誤放行。
要真正驗證需走 `/subscribe` 的申請流程，那會在共用的 Supabase 專案寫入一筆訂閱資料。

**測試資料**：本次於遠端建立了報價 `TEST-備註驗證-0820` 與若干個人評估紀錄。
合併前請一併決定清理方式，見 §8.3。

---

## 6. Pull Request（`gh` CLI 未安裝，請用網頁開啟）

開啟以下網址即可建立 PR：

```
https://github.com/reibicare9881/schumann-ai-sleep-platform/compare/main...codex/reibi-fastapi-merge?expand=1
```

Draft PR 已建立。更新 PR 描述時，請以[完整進度與缺漏報告](reibi-migration-status-report.md)與當次測試輸出為準，不要沿用已刪除的過期範本。

---

## 7. 已知且**不**阻擋合併的項目

這些已記錄在 [reibi-feature-migration-checklist.md](reibi-feature-migration-checklist.md)，屬外部依賴或後續批次：

- `admin_it` 的 `security_audit` 與 `reibi_finance` 的 `distributor_manage`／`finance_manage` 等 20 個 registry 權限尚無端點實作（IAM-R04）。
- 企業 `admin`、`occupational_health`、兩種經銷商角色的**瀏覽器** E2E 尚未建立；其權限已由 Python 矩陣完整覆蓋（TST-Q10）。
- 共用 API response schema、correlation ID、audit log、統一分頁（FND-05～FND-11）。
- L5 點線面地圖、場域前置選單 UX、完整定價頁。
- 正式 Email／SMTP、電子發票 API、ECPay／LINE Pay、LINE 正式 token（EXT-01～05）。
- 舊 Artifact `window.storage` 依 2026-08-14 決策不搬遷。

---

## 8. 這條分支上**不**該被忽略的三件事

1. **`.gitignore` 與兩個 `.pyc` 有未提交的使用者變更**，本次移植全程未觸碰。合併前請自行決定要提交或捨棄。
2. **`reibi/` 目錄含 15,322 行原始 Artifact 素材**（四個 JSX 與規格文件），佔整條分支插入行數約 44%。要不要讓它們進 `main` 是尚未決定的事項；不影響任何功能，但會大幅影響 PR 可讀性。
3. **staging 與正式方向共用同一個 Supabase 專案**。所有自動化測試已改為只寫入本機 Supabase，但任何手動測試寫入前仍請先確認資料內容與清理方式。
