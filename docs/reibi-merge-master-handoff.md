# SleepM × REIBI：建置、操作與發布交接手冊

最後校正：2026-08-21（Asia/Taipei）

工作區：`C:\sleepm_merge`

開發分支：`codex/reibi-fastapi-merge`

目前基準 commit：`ed75d9b`

正式部署分支：`main`（尚未合併本分支）

本手冊只保留可操作的現況。功能完成度、已知缺口與歷史驗證請先讀[完整進度與缺漏報告](reibi-migration-status-report.md)；遇到文件與程式碼不一致時，以程式碼、versioned migration、遠端唯讀查詢與當次測試為準。

## 1. 已確認的現況

- 四個 REIBI JSX Artifact 已重構為 Next.js 前端、FastAPI 唯一資料層、Supabase 與 Gemini。
- 舊 Artifact 的 `window.storage` **不匯出、不匯入**；新系統資料乾淨起始。選用匯入程式雖保留，未經新的範圍核准不得使用。
- repo 與遠端 Supabase 目前同為 **20 個 migration**；遠端有 47 張 `public` tables，其中 41 張為 `reibi_*`。
- 第一位正式 `reibi_super` 已完成 Email、TOTP 與 AAL2；本 repo 不保存密碼、TOTP secret 或 recovery code。
- 最近一次完整本機驗證：3,925 項 Python 測試通過、TypeScript 檢查與 production build 通過；pgTAP 有 159 項計畫，重跑須使用 Docker 的本機 Supabase。
- Railway Staging：`https://schumann-ai-sleep-platform-staging.up.railway.app`；Vercel Preview 受 SSO 保護。**2026-08-22 起正式認定為正式環境**（環境變數已核對符合正式要求），但網域與名稱未變更、Vercel SSO 保護尚未處理，見 [完整進度與缺漏報告第 11 節](reibi-migration-status-report.md)。

## 2. 架構與安全邊界

```text
Browser / Next.js
  └─ FastAPI（應用 JWT、角色、企業範圍、可撤銷 session）
       ├─ Gemini
       ├─ PDF 產生
       └─ Supabase service_role
            ├─ Postgres
            ├─ Auth（邀請、Email/密碼、TOTP）
            └─ Storage
```

- `SUPABASE_SERVICE_ROLE_KEY` 只能放在後端，不得出現在任何 `NEXT_PUBLIC_*` 變數。
- 瀏覽器不直接讀寫 REIBI tables；所有授權與企業範圍由 FastAPI 驗證。
- REIBI tables 採 deny-by-default：RLS 啟用且 `anon`／`authenticated` 沒有直接存取權。Security Advisor 的 RLS INFO 因此屬預期。
- Auth 的 leaked-password protection 目前尚未啟用，這是遠端唯一 Security Advisor WARN。
- 不得以 SQL 或 Dashboard 直接將尚未驗證 TOTP 的帳號設為 `mfa_required = true`；必須由 `/reibi/mfa` 完成 QR Code、六位碼與 AAL2 驗證。
- 健康彙整、組織與跨企業分析必須維持 k≥5 與既有同意條件；日誌不得記錄健康答案、密碼或 token。

## 3. 本機環境

### 必要工具

- Windows PowerShell
- Node.js 與 npm（版本以 lockfile 為準）
- Python 3.11.9；`backend/.venv` 目前可用
- Docker Desktop（只在本機 Supabase、pgTAP、Playwright E2E 時需要）

### 首次安裝或重建

```powershell
Set-Location C:\sleepm_merge
npm.cmd ci

Set-Location C:\sleepm_merge\frontend
npm.cmd ci

Set-Location C:\sleepm_merge\backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pip check
```

若 `py -3.11` 不存在，先安裝 Python 3.11.9；不要複製別台電腦的 `.venv`。虛擬環境會記住基底 Python 的絕對路徑，移除基底直譯器後應重建 `.venv`。

### 本機設定與啟動

`backend/.env` 僅供本機後端，至少需要：

```dotenv
GEMINI_API_KEY=<local development key>
JWT_SECRET_KEY=<local random secret>
SUPABASE_URL=<local or explicitly selected development project URL>
SUPABASE_SERVICE_ROLE_KEY=<matching server-side key>
FRONTEND_URL=http://localhost:3000
DEBUG=true
```

`frontend/.env.local`：

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

不要把 staging／正式 secrets 覆寫進 `.env`，也不要提交任何 `.env`。

本機服務：

```powershell
# PowerShell 1：本機資料庫（Docker Engine 必須 running）
Set-Location C:\sleepm_merge
npm.cmd run supabase -- start
npm.cmd run db:reset

# PowerShell 2：FastAPI
Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# PowerShell 3：Next.js
Set-Location C:\sleepm_merge\frontend
npm.cmd run dev
```

本機網址：前端 `http://localhost:3000`、API `http://localhost:8000`、Swagger `http://localhost:8000/docs`。

## 4. 日常操作

### 帳號與 MFA

- 可信 REIBI／企業細分角色／經銷商角色由 `/reibi-login` 登入。
- 既有可信帳號到 `/reibi/mfa` 補綁 TOTP；驗證成功後系統才原子設定 MFA 並撤銷舊 AAL1 session。
- `reibi_super` 可使用 `/reibi/accounts` 邀請合法角色；企業 `admin` 只能管理自己企業，不能授予 `admin`、REIBI 或 partner 角色。
- 若需緊急停用帳號，先在站內帳號管理停用並撤銷 session；再依事件流程在 Supabase Auth 停用帳號。不要把密碼、TOTP 或 recovery code 記入文件。

### REIBI 作業流程

1. `/reibi/onboarding` 建立測試或正式企業、場域、方案與費用；憑證函不含密碼。
2. `/reibi/accounts` 邀請該企業的可信帳號。
3. `/reibi/workflow` 完成報價 → 合約 → 工單 → 逐條驗收。
4. `/reibi/l5` 查看角色範圍內的 KPI、待辦、通知與流程卡。
5. `/reibi/service` 處理服務案件與部門 CSV；跨企業角色必須先選定合法企業。

`reibi_super`／`reibi_finance` 的跨企業 API 必須明確帶 `org_code`；企業 `admin` 指定其他組織應得到 403。若頁面顯示「跨組織操作必須指定 org_code」，先選企業而不是在瀏覽器自行填任意代碼。

## 5. 驗證

```powershell
# 後端
Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pytest -q

# 前端
Set-Location C:\sleepm_merge\frontend
npx.cmd tsc --noEmit
npm.cmd run build

# 資料庫與 E2E（只對本機 Supabase 執行）
Set-Location C:\sleepm_merge
npm.cmd run db:reset
npm.cmd run db:test
npm.cmd run db:lint

Set-Location C:\sleepm_merge\frontend
npm.cmd run e2e
```

Playwright 會將後端與前端指向 `127.0.0.1:54321` 的本機 Supabase；不可把 E2E 改成共用遠端 Supabase。任何聲稱「全數通過」的變更，都要記錄當次命令、日期與結果。

## 6. 發布前必做

1. 啟用 Supabase leaked-password protection，並驗證邀請、強密碼、既有帳號與 MFA 登入。
2. 確認備份、還原演練、錯誤監控與告警。
3. 核對 Railway／Vercel production 的 `SUPABASE_*`、`GEMINI_API_KEY`、`JWT_SECRET_KEY`、`FRONTEND_URL`、`NEXT_PUBLIC_API_URL`、CORS、HTTPS 與 `DEBUG=false`。
4. **2026-08-22 已決定並執行**：正式採用 staging／Preview 作為正式環境（網域未變更）；Railway 上原本部署失敗中的獨立 `production` 環境已直接刪除。仍待處理：Vercel `Production` 網域是否／如何指向此後端；Vercel SSO 保護是否解除。
5. 完成 Draft PR review、全套驗證與 production smoke test，才合併 `main`。

詳細核對項目在[合併前發布檢查清單](reibi-release-checklist.md)。

## 7. 文件地圖

- [文件索引](README.md)
- [完整進度與缺漏報告](reibi-migration-status-report.md)：現況與缺口的權威摘要
- [完整功能移植清單](reibi-feature-migration-checklist.md)：逐批次歷史
- [JSX 移植缺口報告](reibi-jsx-migration-gap-report.md)：Artifact 對照與明確差異
- [Artifact 資料映射](reibi-artifact-mapping.md)：選用搬遷的程式對照
- [舊資料不搬遷決策](reibi-legacy-data-scope-decision.md)
- [本機開發流程](reibi-local-development.md)
- [合併前發布檢查清單](reibi-release-checklist.md)
