# SleepM × REIBI 移植專案：完整建置、進度與操作交接手冊

最後核對日期：2026-08-17（Asia/Taipei）

工作區：`C:\sleepm_merge`

目前開發分支：`codex/reibi-fastapi-merge`

本文件記錄的功能基準提交：`b62fa47 feat: honour the role registry in batch d and e guards`

正式部署分支：`main`（目前尚未將本次移植分支合併到 `main`）

> 本文件是新對話、新開發者或新電腦接手時的主要入口。若本文件與程式碼不一致，以已提交的 migration、後端 `roles.py`、FastAPI 路由及當下測試結果為準；再同步修正文件。

---

## 1. 專案目標與範圍

本專案把 `reibi` 資料夾內四個獨立 JSX Artifact 的完整業務能力，重構並移植進原有 `sleepm` 睡眠健康平台，形成：

- Next.js 前端；
- FastAPI 唯一後端資料存取層；
- Supabase Postgres、Auth 與 Storage；
- Gemini 統一 AI 供應商；
- Railway 後端 staging；
- Vercel 前端 preview／staging。

四個來源 Artifact：

| 來源檔 | 原用途 | 新系統主要對應 |
|---|---|---|
| `reibi/reibi-v10_3_34_20260730.jsx` | 主平台、健康評估、組織管理、服務與分析 | 既有 SleepM 頁面、`/reibi/health`、`/reibi/analytics`、`/reibi/service` |
| `reibi/reibi-l5_v2_14_20260717.jsx` | REIBI L5 營運、財務、夥伴、跨企業管理 | `/reibi`、`/reibi/l5`、`/reibi/operations`、`/reibi/accounts` |
| `reibi/reibi-quote_v1_13_20260717.jsx` | 報價與合約 | `/reibi/workflow` |
| `reibi/reibi-workorder_v1_4_20260707.jsx` | D 層工單、施工與驗收 | `/reibi/workflow` |

### 已核准的範圍決策

2026-08-14 已決定：**不匯出、不匯入原 Artifact 的 `window.storage` 舊資料**。

- 新 Supabase 業務資料乾淨起始。
- 已完成的 JSON 匯出／預檢／匯入程式保留作為選用復原工具。
- `reibi_artifact_import_batches` 與 `reibi_artifact_import_records` 維持 0 筆是預期狀態。
- 不應把「沒有舊資料」誤判為移植失敗。
- 詳細決策見 [reibi-legacy-data-scope-decision.md](reibi-legacy-data-scope-decision.md)。

---

## 2. 接手時先讀：目前狀態摘要

### 2.1 可直接使用的能力

- 第一位正式 `reibi_super` 已建立、完成 Email 密碼設定、TOTP 綁定與 AAL2 staging 登入。
- 正式帳號：`reibicare9881@gmail.com`，顯示名稱「麗媚AI」。本 repo 與本文件**不保存密碼、TOTP secret 或 recovery code**。
- 可由 `/reibi` 搜尋並選取企業，跨企業管理企業基本資料、授權、場域與部門。
- 可由 `/reibi/l5` 查看依角色裁切的 KPI、待辦、通知、報價／合約／工單／服務案件統計。
- 可由 `/reibi/onboarding` 建立新案企業、場域、方案、授權與費用，並下載不含密碼的 PDF 憑證函。
- 新案企業會同步至主平台 `organizations`，可在 `/reibi/accounts` 邀請企業帳號。
- 可完成報價 → 合約 → 工單 → 驗收的資料閉環。
- 可管理付款時程、匯款、發票、訂閱、經銷商、合作夥伴、內部 staff 與佣金。
- 可使用個人健康、心理量表、職安、OHS、服務中心、部門 CSV 與跨企業分析。
- 新 AI 功能只呼叫 Gemini，主要模型固定為 `gemini-2.5-flash`。

### 2.2 量化進度

`docs/reibi-feature-migration-checklist.md` 於 2026-08-17 的標記統計：

| 狀態 | 數量 | 說明 |
|---|---:|---|
| `[x]` 完成 | 246 | 已實作且有對應驗證紀錄 |
| `[-]` 部分完成 | 10 | 已有功能，但仍缺完整 UX 或部分角色 E2E |
| `[ ]` 待完成 | 24 | 主要是共用工程品質、未實作的 registry 權限與發布作業 |
| `[~]` 外部依賴／延後 | 8 | leaked-password、LINE、金流、發票等 |
| `[N/A]` 不適用 | 8 | 主要為已決定不執行的舊 Artifact 資料搬遷 |

以「完成／（完成＋部分＋待完成）」計算，完整完成約 **88%**。這是清單完成率，不代表正式上線風險已完成 88%；正式上線仍受監控、備份與安全設定影響。

### 2.3 最近驗證結果

2026-08-17 於本機實測：

| 關卡 | 結果 |
|---|---|
| Python 測試 | `3275 passed`（無 warning） |
| `pip check` | 無衝突 |
| pgTAP（`npm run db:test`） | `146 passed`，`Result: PASS` |
| Database lint | `No schema errors found` |
| 16 個 migration 空庫重播 | 全數成功 |
| TypeScript `--noEmit` | 通過 |
| Next.js production build | 通過 |
| Playwright E2E（`npm run e2e`） | `24 passed`（18 desktop + 6 mobile） |

- Git：提交 `b62fa47` 已推到 `origin/codex/reibi-fastapi-merge`。
- Supabase 遠端：`Schumann-AI-Platform` 為 `ACTIVE_HEALTHY`，16 個 migration 與 repo 一致；本次移植未新增 schema。
- Docker Desktop 與 CLI 在本次工作階段可用（Server 29.6.2）。

> 兩個測試基礎建設的重要修正：後端測試原本讀 `backend/.env` 執行，等同指向**正式** Supabase 專案（現已釘死為假值）；`supabase test db` 原本一直回傳 FAIL，Batch K 的斷言從未被計入先前宣稱的「135 項 pgTAP 通過」。詳見 checklist §28。

### 2.4 下一個主要里程碑

功能移植、權限矩陣與 E2E 已完成，剩下的是**只能由專案負責人執行**的發布作業。完整清單見 [reibi-release-checklist.md](reibi-release-checklist.md)：

1. 啟用 Supabase leaked-password protection（目前 advisor 唯一 WARN）。
2. 備份確認與還原演練。
3. 設定監控與錯誤告警。
4. 正式 secrets／CORS／網域／HTTPS 核對。
5. 開 Draft PR（`gh` CLI 未安裝，需用網頁；標題與內文已備妥於 [reibi-pull-request.md](reibi-pull-request.md)）。
6. Code review 通過後合併 `main`，再執行正式 smoke test。

---

## 3. 系統架構與安全邊界

```text
Browser / Next.js
  ├─ 一般 SleepM 登入：/login
  ├─ 可信 REIBI 登入：/reibi-login
  └─ Authorization: Bearer <30 分鐘應用 JWT>
                    │
                    ▼
FastAPI / Railway
  ├─ 驗證 JWT、可信 session、角色與企業／部門／經銷商範圍
  ├─ 呼叫 Gemini
  ├─ 產生 PDF
  └─ 以 server-side service role 存取 Supabase
                    │
                    ▼
Supabase
  ├─ Postgres：SleepM + 38 張 reibi_* 業務表
  ├─ Auth：Email／密碼、邀請、TOTP MFA、AAL2
  └─ Storage：私有匯款憑證等檔案
```

安全原則：

- `SUPABASE_SERVICE_ROLE_KEY` 只能存在 FastAPI 環境，不能放入任何 `NEXT_PUBLIC_*` 變數。
- REIBI 瀏覽器不直接查詢 REIBI table；資料一律經 FastAPI。
- REIBI tables 啟用 RLS，並撤銷 `anon`／`authenticated` table 或 RPC 權限。
- Advisor 顯示多筆 `RLS Enabled No Policy` INFO 是目前 deny-by-default 設計的一部分，不應為消除 INFO 而新增寬鬆 policy。
- `reibi_super`、REIBI 內部角色與經銷商角色必須綁定 server-side 可撤銷 session。
- 高權限帳號使用 TOTP；啟用 `mfa_required` 前必須先完成 factor verify 並確認 AAL2，否則可能鎖住帳號。
- JWT 應用工作階段 30 分鐘；停用帳號或撤銷 session 後，後端每次請求都會重新查驗可信 session。
- 組織健康彙整強制 k≥5；不得在 UI、log 或匯出中洩漏個人健康資料。

---

## 4. Repository 結構

```text
C:\sleepm_merge
├─ backend/                         FastAPI、權限、AI、PDF、測試
│  ├─ main.py                       主平台 API 與 router 掛載
│  ├─ auth.py                       JWT、30 分鐘 session、權限依賴
│  ├─ roles.py                      14 角色的後端權威 registry
│  ├─ reibi_api.py                  企業、場域、部門、報價、合約、工單、Artifact API
│  ├─ reibi_batch_c.py              財務、訂閱、經銷商、佣金
│  ├─ reibi_batch_d.py              個人健康、心理、職安、OHS
│  ├─ reibi_batch_e.py              組織分析與 Gemini 報告
│  ├─ reibi_batch_f.py              部門 CSV、服務、公告、LINE、匯款 OCR
│  ├─ reibi_batch_g.py              Supabase Auth、邀請、MFA、帳號與 session
│  ├─ reibi_l5.py                   L5 角色化 KPI／待辦／通知
│  ├─ reibi_onboarding.py           新案開通與憑證函
│  ├─ requirements.txt              正式固定版本套件
│  ├─ requirements-dev.txt          正式依賴 + pytest 8.4.2
│  └─ tests/                         89 項 Python 測試
├─ frontend/                        Next.js 14 前端
│  ├─ app/                           App Router 頁面
│  ├─ components/AuthProvider.tsx   瀏覽器 session 管理
│  └─ lib/api.ts                    FastAPI client
├─ supabase/
│  ├─ migrations/                   16 個版本化 SQL migration
│  ├─ tests/                        pgTAP SQL 測試
│  └─ config.toml                   本機 Supabase 設定
├─ reibi/                           四個原始 Artifact 與規格文件
├─ docs/                            盤點、映射、runbook、決策與本交接文件
├─ package.json                     repo 層 Supabase CLI 2.113.0
└─ .gitignore                       secrets、venv、node_modules、build 排除
```

關鍵文件：

- [完整功能移植清單](reibi-feature-migration-checklist.md)
- [合併前發布檢查清單](reibi-release-checklist.md)　←　**接手發布作業從這裡開始**
- [PR 標題與內文](reibi-pull-request.md)
- [本機開發流程](reibi-local-development.md)
- [Supabase 現況盤點](supabase-inventory.md)
- [Artifact 欄位映射](reibi-artifact-mapping.md)
- [Batch G 帳號與選用匯入手冊](reibi-batch-g-runbook.md)
- [舊資料不搬遷決策](reibi-legacy-data-scope-decision.md)

---

## 5. 環境建置

### 5.1 已驗證版本

| 工具 | 目前版本／狀態 |
|---|---|
| Windows | PowerShell 工作流程 |
| Node.js | `v24.14.1` |
| npm | `11.11.0` |
| Python base | `3.11.9`，位於 `.tools/python311` |
| backend virtualenv | Python `3.11.9`，`backend/.venv` |
| pytest | `8.4.2` |
| Supabase CLI | repo 固定 `2.113.0` |
| Postgres | 遠端 17.6；本機 `config.toml` major 17 |
| Next.js | 14.2.x（lockfile 為準） |
| FastAPI | 0.136.1 |

2026-08-17 後續工作階段已確認 Docker Desktop 與 CLI 均可用（`docker version` 回報 Server 29.6.2），本機 Supabase、pgTAP 與 Playwright E2E 都已在該環境實跑通過。若換機後找不到 `docker` 指令，先確認 Docker Desktop Engine running 並重新開 PowerShell；不要因為 GUI 可開啟就假設 CLI 一定可用。

### 5.2 首次安裝或重新建置

在 repo 根目錄：

```powershell
Set-Location C:\sleepm_merge

# repo 工具（Supabase CLI）
npm.cmd ci

# 前端
Set-Location C:\sleepm_merge\frontend
npm.cmd ci
```

Python：

```powershell
Set-Location C:\sleepm_merge

# 若 .tools/python311 已存在且可用
.\.tools\python311\python.exe -m venv backend\.venv

Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pip check
```

若 `.tools/python311` 不存在，先安裝 Python 3.11.9，再使用該直譯器重建 `backend/.venv`。**不要複製其他電腦的 `.venv`**。

### 5.3 為什麼 `.venv` 有時會突然不能用

Python virtual environment 的 `pyvenv.cfg` 會保存基底 Python 的絕對路徑。若 Windows 更新、Python 移除、使用者目錄改變或 `.tools/python311` 被刪除，舊 `.venv` 即使資料夾仍在也可能失效。

完整解法是：

1. 確認一個固定位置的 Python 3.11.9 可執行。
2. 刪除或改名失效的 `backend/.venv`。
3. 用固定基底 Python 重新建立 `.venv`。
4. 從 `requirements-dev.txt` 重裝，不手動猜套件。
5. 執行 `pip check` 與 89 項測試。

不要修改 `.venv` 內檔案來硬改路徑，也不要提交 `.venv` 到 Git。

### 5.4 環境變數

後端 `backend/.env`：

```dotenv
GEMINI_API_KEY=<Gemini API key>
JWT_SECRET_KEY=<足夠長度的隨機 JWT 簽章密鑰>
SUPABASE_URL=https://wfgqnjupemzfhaosmogx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase server-side service role key>
FRONTEND_URL=http://localhost:3000
DEBUG=true

# 選用；留空時 LINE 只允許人工複製，不會假裝送達
LINE_CHANNEL_ACCESS_TOKEN=
LINE_API_URL=https://api.line.me/v2/bot/message/push
```

前端 `frontend/.env.local`：

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

注意：

- `.env` 與 `.env.local` 都已被 `.gitignore` 排除。
- 不要在文件、commit、PR、聊天或截圖貼出任何 secret。
- Vercel 只需要公開的 FastAPI URL；目前前端不需要 Supabase service role。
- Railway 必須設後端所有必填變數，`FRONTEND_URL` 必須是對應 Vercel preview／正式網址，否則 CORS 或邀請 callback 可能失敗。
- `JWT_SECRET_KEY` 改變會使既有應用 JWT 立即失效，變更前要有登出與公告計畫。

### 5.5 本機 Supabase

先確認 Docker Desktop Engine running：

```powershell
docker version
```

再於 repo 根目錄：

```powershell
Set-Location C:\sleepm_merge
npx.cmd --no-install supabase --help
npm.cmd run supabase -- start
npm.cmd run supabase -- db reset --local --no-seed
```

本 repo 目前沒有 `supabase/seed.sql`，所以重置時固定使用 `--no-seed`。本機常用服務：

| 服務 | 預設網址／port |
|---|---|
| Supabase API | `http://127.0.0.1:54321` |
| Postgres | `127.0.0.1:54322` |
| Studio | `http://127.0.0.1:54323` |
| Local SMTP／Mailpit | `http://127.0.0.1:54324` |

若 Supabase CLI 報 `.supabase/telemetry.json` 無法寫入，檢查目前 Windows 使用者對 `%USERPROFILE%\.supabase` 的寫入權限，並在一般使用者 PowerShell 重試。不要用修改 migration 或刪除專案資料來處理 telemetry 權限問題。

### 5.6 啟動三個本機服務

PowerShell 1：Docker Desktop + Supabase。

PowerShell 2：FastAPI。

```powershell
Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

PowerShell 3：Next.js。

```powershell
Set-Location C:\sleepm_merge\frontend
npm.cmd run dev
```

檢查：

- 前端：`http://localhost:3000`
- FastAPI root：`http://localhost:8000/`
- FastAPI Swagger：`http://localhost:8000/docs`

---

## 6. Supabase 遠端現況與操作規則

### 6.1 專案資訊

| 項目 | 值 |
|---|---|
| Project name | `Schumann-AI-Platform` |
| Project ref | `wfgqnjupemzfhaosmogx` |
| Region | `ap-southeast-2` |
| 狀態 | `ACTIVE_HEALTHY`（2026-08-17 查驗） |
| Postgres | 17.6 |
| 遠端 migrations | 16，與 repo 一致 |
| Public tables | 46，其中 38 張 `reibi_*` |

遠端現有少量 staging 資料：1 個 organization／enterprise、1 個 site、2 個 trusted internal users；報價、合約、工單與服務案件目前為 0。不要為 E2E 直接污染共用 Supabase；先規劃可辨識且可安全清理的測試資料。

### 6.2 16 個 migration 順序

1. `20260810032520_baseline_remote_schema.sql`
2. `20260810033150_harden_existing_access.sql`
3. `20260810035451_extend_reibi_domain.sql`
4. `20260812063423_reibi_batch_b_workflow.sql`
5. `20260812072400_reibi_batch_c_finance_partners.sql`
6. `20260812074255_harden_reibi_batch_c_commission_guard.sql`
7. `20260812080840_reibi_batch_d_health_ohs.sql`
8. `20260812131151_reibi_batch_e_analytics_gemini.sql`
9. `20260812140246_reibi_batch_f_settings_services_integrations.sql`
10. `20260812142500_harden_reibi_batch_f_indexes.sql`
11. `20260812145751_reibi_batch_g_secure_import.sql`
12. `20260813054337_reibi_batch_h_identity_roles.sql`
13. `20260813061137_reibi_batch_h_identity_update_transaction.sql`
14. `20260814032823_reibi_mfa_self_enrollment.sql`
15. `20260814080434_reibi_batch_k_onboarding.sql`
16. `20260814093150_reibi_batch_k_organizations_sync.sql`

### 6.3 Schema 變更標準流程

1. 先確認需求是否真的需要 schema 變更。
2. 讀目前 Supabase changelog／官方文件，不憑記憶猜 CLI 參數。
3. 用 `supabase migration new <descriptive_name>` 建立 migration 檔名。
4. 先在本機空資料庫重播。
5. 補 pgTAP 或 Python 測試。
6. 執行 database advisor／lint。
7. review SQL，特別檢查 RLS、grants、`SECURITY DEFINER` 與 function execute 權限。
8. 備份／還原點確認後才推遠端。
9. 遠端查詢 schema、migration history 與 advisor 驗證。
10. migration、API、前端與文件在同一批提交。

禁止事項：

- 不在 SQL Editor 做沒有 migration 的正式 schema 變更。
- 不把 `service_role` 給瀏覽器。
- 不為清除 advisor INFO 而開放 `anon`／`authenticated` 讀取 REIBI table。
- 不直接刪除或重置遠端專案。
- 不把正式 Supabase 當成可任意清除的獨立 staging DB；目前 staging 與正式前端共用同一 Supabase。

### 6.4 目前 Advisor

- 唯一 WARN：`Leaked Password Protection Disabled`。
- 多筆 INFO：`RLS Enabled No Policy`，目前屬預期 deny-by-default。
- 正式上線前應在 Supabase Dashboard 的 Auth password security 中啟用 leaked-password protection，再測試新邀請、密碼設定與既有帳號登入。
- 啟用前不需要資料 migration，但要準備測試帳號、強密碼與客服說明。

---

## 7. Railway、Vercel 與 Git 工作流

### 7.1 已知部署

| 用途 | 位置 |
|---|---|
| Railway **staging** backend（實際服務中） | `https://schumann-ai-sleep-platform-staging.up.railway.app` |
| Vercel **Preview** frontend（實際服務中） | `https://schumann-ai-sleep-platform-git-c-1719da-reibicare9881s-projects.vercel.app` |
| Supabase | `Schumann-AI-Platform`／`wfgqnjupemzfhaosmogx` |
| Railway project | `08448f6e-4e89-41b2-842c-0c6073d59565` |

Vercel preview URL 可能因 deployment alias 改變；應以 Vercel 當次 deployment 或 GitHub commit status 顯示的網址為準。

**重要：目前是以 staging／Preview 環境充當正式環境。** Railway 的 `production` 環境自 2026-06-02 起連續三次部署失敗且未再嘗試；Vercel `Production` 停在 `main` 的 `b1e7af3`（2026-06-05），其後端不通。合併 `main` 前必須先處理，見 [reibi-release-checklist.md](reibi-release-checklist.md) §2.3。

### 7.2 分支規則

- `main`：正式部署分支。
- `codex/reibi-fastapi-merge`：目前 REIBI 移植與 staging／preview 驗收分支。
- 每完成一個 batch：測試 → 文件 → commit → push 此 feature branch。
- 未完成完整 E2E、安全與 release checklist 前，不合併 `main`。
- 不把 feature branch 誤稱為正式部署分支。

### 7.3 每批提交前檢查

```powershell
Set-Location C:\sleepm_merge
git status --short
git diff --check

Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pytest -q

Set-Location C:\sleepm_merge\frontend
npx.cmd tsc --noEmit
npm.cmd run build
```

只 stage 本批相關檔案。工作區長期存在三個與本批無關的使用者變更，除非使用者另有指示，不要覆蓋或提交：

- `.gitignore`
- `backend/modules/__pycache__/ai_analyzer_module.cpython-311.pyc`
- `backend/modules/__pycache__/pdf_generator_module.cpython-311.pyc`

### 7.4 部署環境變數核對

Railway：

- `GEMINI_API_KEY`
- `JWT_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`
- `DEBUG=false`（正式環境）
- 選用 `LINE_CHANNEL_ACCESS_TOKEN`、`LINE_API_URL`

Vercel：

- `NEXT_PUBLIC_API_URL=<Railway staging 或 production backend URL>`

修改任一環境變數後必須重新部署，並實際檢查瀏覽器 Network／頁面行為；只看 Dashboard 中有變數名稱不代表新 deployment 已取得值。

---

## 8. 移植批次與已完成內容

### 初始整合與 Batch A

- 建立 REIBI domain schema、企業、場域、L1-L4 部門。
- FastAPI 成為 REIBI 唯一資料層。
- 完成 tenant／`org_code` 範圍限制與企業管理骨架。

### Batch B：報價、合約、工單、驗收

- A-E 層計價、設備、場域、付款模式與快速試算。
- 報價草稿／發送／確認／作廢／轉合約。
- 合約簽署、用印、執行、到期、續約／升級。
- 從合約建立 D 層工單、逐項驗收、缺失、簽名與列印。
- PostgreSQL sequence 防止並發單號衝突。
- 報價轉合約以單一 transaction 保證一致性。

### Batch C：財務與夥伴

- 付款時程、匯款申報、配置與人工覆核。
- 發票品項、5% 稅額、狀態與關聯。
- 個人訂閱審核、一次性啟用碼、到期與重發。
- 主／次經銷商、等級、區域、服務人員。
- 合作夥伴、REIBI staff、佣金 ledger 與分潤護欄。

### Batch D：健康與 OHS

- 每日行動打卡與不可只存總額的 points ledger。
- 睡眠／疼痛日記、三高／BMI、888 時間軸。
- PHQ-4、PSS-4、BSRS-5、過勞、NMQ、不法侵害等量表。
- EAP、occupational-health roster／訪談與 OHS 計畫。
- 組織資料 k≥5 隱私限制。

### Batch E：分析與 Gemini

- 組織 KPI／OKR、高風險、ESG、WPAI／ROI、GRI 403。
- 跨企業健康分析、名冊、策略與報告中心。
- ESG／OKR／KPI／ROI／888／GRI／OHS AI 報告統一 Gemini。
- 保存 `ai_provider=gemini`、`ai_model`、snapshot、建立者與版本時間。

### Batch F：設定、服務與整合

- 部門 CSV 範本、預檢、交易式取代與確認單。
- 服務案件、處理狀態、回覆與跨組織範圍。
- 公告、名額與報名。
- 私有匯款憑證與 Gemini OCR；低信心必須人工覆核。
- LINE 草稿／人工複製／API 發送；無 token 時不偽造成功。
- 身分核驗申請取代共用 PIN／備援碼重設。

### Batch G：安全匯入能力與可信登入

- 四 Artifact 版本化 JSON、SHA-256、分檔與敏感資料排除。
- 預檢、import batch／record、去重與 retry lineage。
- Supabase Auth Email／密碼、可信 registry、登入限速與 30 分鐘 session。
- Artifact 真實資料搬遷後續依決策列為 N/A。

### Batch H／MFA

- 14 角色後端權威 registry。
- 帳號邀請、密碼設定、TOTP、停用、重新啟用與 session 撤銷。
- `/reibi/mfa` 讓既有帳號補綁 TOTP。
- 只有 Supabase 回傳 AAL2 後才原子設定 `mfa_required=true`。
- 第一位正式 `reibi_super` 已遠端驗證。

### Batch J：L5 角色化總覽

- 依角色與經銷商範圍聚合 KPI、待辦、通知、流程與趨勢。
- 不另建通知 inbox table；通知是當下條件聚合。

### Batch K：新案開通

- 三步驟建立企業、場域、方案、授權與費用。
- 安全並發流水號與 PDF 憑證函。
- 同步 `reibi_enterprises` 與主平台 `organizations`。

### Batch L：跨企業管理

- `/reibi` 企業搜尋、狀態篩選、授權使用率與到期資訊。
- `reibi_super`／`reibi_finance` 可明確選企業；企業 `admin` 仍只限自身。

### Batch M：經銷商服務案件

- 主經銷商可服務自身與直屬子經銷商企業；次級只限自身。
- 經銷商可看／建授權範圍內案件，但不能自行結案。
- `reibi_cs` 可管理全域服務案件。
- 修正 super 部門架構操作缺少 `enterprise_id`。
- L5 已顯示服務案件待處理與總數。

---

## 9. 角色與權限操作概念

後端 `backend/roles.py` 是唯一權威；前端角色表只用於顯示，不能代替後端授權。

| 角色 | 主要範圍 |
|---|---|
| `individual` | 個人健康與服務中心 |
| `member` | 自身健康、提交企業、所屬部門 |
| `dept_head` | 自身＋所屬部門去識別分析 |
| `admin_hr` | 企業健康、高風險、預約、OHS |
| `admin_finance` | 企業分析與財務 |
| `admin_it` | 安全稽核與服務中心 |
| `admin` | 自身企業平台與可委派帳號管理 |
| `occupational_health` | 去識別 roster 與臨場健康訪談 |
| `reibi_super` | 全域 REIBI、跨企業與全帳號管理 |
| `reibi_finance` | 跨企業、財務、經銷商與報表 |
| `reibi_data` | 跨企業去識別分析與報表 |
| `reibi_cs` | 全域服務案件、訊息與客服 |
| `partner_primary` | 自身及直屬子經銷商服務企業 |
| `partner_sub` | 自身服務企業 |

五種角色必須綁部門：`member`、`dept_head`、`admin_hr`、`admin_finance`、`admin_it`。經銷商角色必須綁 distributor。企業角色必須綁正確 `org_code`。

帳號管理防護：

- `reibi_super` 可邀請所有合法角色。
- 企業 `admin` 只能管理自己企業，且不能授予 `admin` 或 REIBI／partner 角色。
- 防止帳號自我停用。
- 防止停用最後一位 super。
- 停用或權限變更時應撤銷既有應用 session。

---

## 10. 網頁操作手冊

### 10.1 登入入口

| 路徑 | 使用者 |
|---|---|
| `/login` | 原 SleepM／企業／個人流程 |
| `/reibi-login` | Supabase Auth 可信帳號：REIBI 內部、細分企業管理角色、經銷商 |
| `/auth/complete` | 接受邀請後設定密碼、首次 MFA |
| `/reibi/mfa` | 已登入既有可信帳號補綁 TOTP |

若顯示「REIBI 內部工作階段已失效」：

1. 回 `/reibi-login` 重新登入。
2. 若帳號要求 MFA，輸入 authenticator 六位碼。
3. 確認系統到達 AAL2 後才會建立應用 session。
4. 若仍失效，檢查 Railway 與 Supabase Auth／API log、可信帳號是否 active、session 是否被撤銷，以及前後端是否使用相同 `JWT_SECRET_KEY`。

### 10.2 REIBI 管理首頁 `/reibi`

- Super／finance：搜尋與篩選所有企業。
- 選擇企業後讀取基本資料、方案、授權、場域與部門。
- 企業 admin：只會操作 token 內自身企業，不應看到跨企業選擇。
- 跨企業 API 必須明確帶 `org_code`；不要只依賴前端目前選中的文字。

### 10.3 L5 總覽 `/reibi/l5`

- 顯示角色與資料範圍。
- KPI：企業、服務人數、合約費用、訂閱、經銷商等，依角色裁切。
- 我的待辦與即時通知是現有資料即時計算；若沒有符合條件資料，顯示「目前沒有待辦／異常通知」是正常結果。
- 流程卡：報價、合約、工單、服務案件。
- 經銷商 KPI 必須只聚合可服務企業。

### 10.4 新案開通 `/reibi/onboarding`

建議 staging 測試資料：

- 企業名稱明確包含 `TEST` 或「測試」。
- 統編、Email、電話使用明確測試值，不使用真實客戶個資。
- 使用唯一企業別名，避免流水號或企業代碼混淆。
- 授權人數、場域與 A-D 層費用填小而可辨識的值。

流程：

1. 填企業基本資料。
2. 選方案、授權、B/C/D 層與場域。
3. 確認四層費用並建立。
4. 立即下載 PDF 憑證函。
5. 若漏下載，可回 onboarding 案件詳情重新下載；不要重開一筆相同企業。
6. 到 `/reibi/accounts` 邀請管理帳號。

憑證函只應包含案件、企業代碼、管理 Email 與登入入口，不含密碼、共用 PIN、TOTP secret。

### 10.5 帳號邀請 `/reibi/accounts`

1. 選企業／部門／角色。
2. 輸入實際可收信的測試 Email。
3. 送出邀請後，Supabase 會寄信至該 Email。
4. 收件者點邀請連結，在 `/auth/complete` 設定至少 12 字元密碼。
5. 若帳號政策要求 MFA，完成 QR Code 與六位碼驗證。
6. 回 `/reibi-login` 測試登入與權限。

不要在文件或聊天保存測試密碼。即使是 staging 帳號，也應視為可被濫用的憑證。

### 10.6 商務文件 `/reibi/workflow`

建議驗收順序：

1. 選定企業。
2. 建立報價並核對 A-E 層與總額。
3. 變更狀態：草稿 → 發送 → 確認。
4. 轉成合約，確認只產生一次。
5. 填簽署／用印／執行資訊。
6. 從合約建立工單。
7. 填施工項目與雙方範圍。
8. 逐項驗收 pass／fail，失敗項目應有異常說明。
9. 完成客戶簽名與驗收日期。
10. 列印或另存 PDF，確認版本快照沒有被後續編輯改寫。

### 10.7 服務中心 `/reibi/service`

- 企業 selector 依角色顯示合法範圍。
- Super 與企業 manager 的部門架構讀取必須帶目前企業。
- 部門 CSV：先下載範本 → 貼入 UTF-8 CSV → 預檢 → 確認匯入。
- 正式匯入會 transaction 取代當前架構；預檢未通過時按鈕不得可用。
- 經銷商只能建立範圍內企業案件；不可自行結案。
- `reibi_cs` 可處理與結案全域案件。

### 10.8 財務與夥伴 `/reibi/operations`

- 應收時程與狀態。
- 匯款申報、OCR 結果、人工覆核與沖帳。
- 發票與品項。
- 個人訂閱與一次性啟用碼。
- 經銷商、夥伴、staff、佣金與年度業績。
- 匯款 OCR 低信心時不能自動完成沖帳。

### 10.9 健康與分析

| 路徑 | 內容 |
|---|---|
| `/reibi/health` | 行動、積分、日記、三高、心理量表、EAP、OHS |
| `/reibi/analytics` | 組織 KPI、ROI、ESG、GRI、Gemini 報告與跨企業分析 |
| `/analysis` | PDF／睡眠報告分析 |
| `/assessment` | 個人評估 |
| `/history` | 個人歷史 |
| `/report/[id]` | 報告詳情／列印 |
| `/kpi`、`/okr`、`/esg`、`/highrisk` | 既有組織管理頁 |

Gemini 失敗時應顯示真實錯誤，不得用假報告冒充成功。健康資料的管理畫面必須使用去識別或 k≥5 彙整。

---

## 11. 測試手冊

### 11.1 後端

```powershell
Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pytest -q
```

2026-08-17：`3275 passed`，無 warning（`config.py` 已改用 `SettingsConfigDict`，並在 `pytest.ini` 將該 deprecation 升為 error 防止回歸）。

測試套件在載入 `config` 前會把 Supabase URL、service role key、JWT secret 與 Gemini key 全部釘死為假值，並在 `import main` 之前把 `supabase.create_client` 換成記憶體替身。**任何測試都不會連到遠端 Supabase**；若你新增的測試需要資料，請 seed `fake_supabase` fixture，不要改這層保護。

### 11.2 前端

```powershell
Set-Location C:\sleepm_merge\frontend
npx.cmd tsc --noEmit
npm.cmd run build
```

兩項都必須成功。只跑 `npm run dev` 不算 production build 驗證。

### 11.3 Database

Docker／本機 Supabase 可用時：

```powershell
Set-Location C:\sleepm_merge
npm.cmd run supabase -- start
npm.cmd run db:reset
npm.cmd run db:test
npm.cmd run db:lint
```

2026-08-17 實跑：16 個 migration 空庫重播成功、**146 項 pgTAP 通過且 `Result: PASS`**、lint 回報 `No schema errors found`，並連續執行兩次確認可重複。

先前文件記載的「135 項」不含 Batch K —— 那個檔案不是 pgTAP 格式，pg_prove 計 0 項並讓整個 `supabase test db` 以 FAIL 收場。已改寫為正規 pgTAP，該指令現在可以當驗收關卡使用。重新宣稱 pgTAP 通過前，仍必須在當次工作階段重新跑過。

### 11.4 瀏覽器 E2E

```powershell
Set-Location C:\sleepm_merge\frontend
npm.cmd run e2e
```

前置條件（依序）：

1. Docker Desktop Engine running。
2. `npm run supabase -- start`（repo 根目錄）。
3. `npm run db:reset`。
4. `backend\.venv\Scripts\python.exe tests\e2e_seed.py` —— 建立四個本機可信帳號。

Playwright 會自行拉起後端（port 8001）與前端 production build（port 3001），兩者都指向**本機** Supabase。種子腳本硬性拒絕非 `127.0.0.1:54321` 的目標，所以 E2E 不會寫入 staging／正式共用的專案。

2026-08-17 實跑：24 項通過（18 desktop + 6 mobile），涵蓋登入契約、新案開通、報價→合約→工單→驗收全閉環、L5 角色裁切、空狀態與 API 失敗、五個頁面的手機版無水平溢出。

### 11.5 遠端 smoke test

至少驗證：

1. `/reibi-login` 正確登入。
2. MFA 帳號要求六位碼並到達 AAL2。
3. `/reibi` 跨企業列表載入。
4. `/reibi/l5` 顯示四個流程卡。
5. `/reibi/service` 顯示合法企業與架構。
6. 一般企業 admin 指定其他 `org_code` 收到 403。
7. 未登入 API 收到 401。
8. Vercel 前端確實連到 staging Railway，而不是 localhost 或舊 backend。

### 11.6 測試涵蓋現況

已完成：

| 項目 | 涵蓋方式 |
|---|---|
| 401：無 token、格式錯誤、過期、簽章偽造、可信 session 未註冊／已撤銷 | 166 條受保護路由 × 6 種情境，路由表由 `main.app` 自動讀取 |
| 公開路由 | 10 條明文允許清單；新增未登記的公開端點會讓測試失敗 |
| 403：14 角色 × 具名守門 | 守門宣告表，放行集合必須等於持有對應權限的角色集合 |
| 403：handler 內授權的路由 | `test_inline_authorization.py` |
| IDOR/BOLA：個人健康紀錄 | 9 條路由 × 5 種越權身分 |
| 跨企業 `org_code` 越權 | 已涵蓋 |
| 全業務閉環 | Playwright：新案 → 報價 → 合約 → 工單 → 驗收 |
| 手機版、空狀態、API 失敗 | Playwright |

尚待補：

- 企業 `admin`、`occupational_health`、兩種經銷商角色的**瀏覽器** E2E；其權限已由 Python 矩陣完整覆蓋（TST-Q10）。
- 邀請 → 設密碼 → MFA 綁定的瀏覽器全流程（本機 Mailpit 已可自動收信，尚未串接）。
- 效能、大資料、分頁與併發測試（TST-12）。

---

## 12. 已知問題、限制與技術債

### 必須在合併 `main` 前處理（全部只能由專案負責人執行）

完整步驟見 [reibi-release-checklist.md](reibi-release-checklist.md)。

- Supabase leaked-password protection 尚未啟用（遠端 advisor 唯一 WARN）。
- 正式備份／還原演練、監控與錯誤告警尚未完成。
- 正式 CORS、正式網域、HTTPS 與 secrets 最終核對尚未簽核。
- PR 尚未建立（`gh` CLI 未安裝，需用網頁；內容已備妥於 [reibi-pull-request.md](reibi-pull-request.md)），仍需 code review 並由 Draft 轉 ready。

401／403／IDOR/BOLA 與全流程瀏覽器 E2E **已於 2026-08-17 完成**，見 §11.6。

### 未實作的 registry 權限（IAM-R04）

`roles.py` 定義 26 個權限字串，目前只有 6 個會被後端查詢。以下角色可登入但職掌未實作：

- `admin_it` 的 `security_audit` —— 尚無稽核端點，該角色目前只有服務中心可用。
- `reibi_finance` 的 `distributor_manage`／`finance_manage` —— 經銷商、staff、訂閱仍為 `require_reibi_super`；付款、匯款、發票可用。

邀請這些角色的帳號前請先知悉此限制。另注意 `reibi_internal_users.permission_overrides` 只對會被查詢的權限有效。

### 功能與 UX 待補

- L5 點線面地圖／區域視圖。
- 場域前置選單的 UX 整合。
- 完整定價與 About REIBI 內容。
- 共用 API response schema、錯誤碼、correlation ID。
- 統一分頁、排序、搜尋、日期參數。
- 共用 REIBI layout、權限式選單、breadcrumb 與表格／表單元件。
- PII／健康資料 log redaction 與錯誤訊息脫敏（部分端點仍把原始例外字串放進 response detail）。
- 檔案上傳 MIME／雜湊／大小／惡意內容防護。
- 效能、大資料、分頁與併發測試。

### 外部服務，核心移植不因此阻擋

- 正式 Email 通知／SMTP。
- 財政部 B2B 電子發票 API。
- ECPay／LINE Pay。
- LINE Messaging API 正式 token 與端對端驗收。
- occupational-health 正式 PDF 格式。

### 目前環境注意

- Docker Desktop 與 CLI 已確認可用（Server 29.6.2）；本機 Supabase、pgTAP 與 Playwright 均實跑通過。
- Supabase CLI 在受限環境可能因 telemetry 檔寫入權限報錯。
- `backend/.venv` 可用，但仍依賴固定基底 Python 3.11.9 路徑。
- staging 與正式方向目前共用同一 Supabase。**所有自動化測試已改為只寫入本機 Supabase**，但手動測試寫入前仍請先確認資料內容與清理方式。
- `reibi/` 目錄含 15,322 行原始 Artifact 素材，佔本分支插入行數約 44%。要不要讓它們進 `main` 尚未決定；不影響任何功能，但會大幅影響 PR 可讀性。
- 工作區長期存在三個與移植無關的使用者變更（`.gitignore` 與兩個 `.pyc`），全程未觸碰。

---

## 13. 故障排除

### Docker 顯示 virtualization support not detected

- 登入 Docker 帳號通常不能修復虛擬化問題。
- 檢查 BIOS／UEFI virtualization、Windows Virtual Machine Platform、WSL 2 與 Hyper-V 需求。
- 修復後 Docker Desktop 左下角應顯示 Engine running。
- Docker Desktop 登入可跳過；本機容器不一定需要 Docker Hub 帳號。

### Docker GUI 可開但 PowerShell 找不到 `docker`

- 完全關閉並重新開 PowerShell。
- 在 Docker Desktop Settings 確認安裝完成。
- 檢查 Docker CLI 是否存在及 PATH。
- 不要把「GUI 有畫面」直接視為 Engine 與 CLI 都正常。

### Supabase CLI `NonInteractiveError`

CLI 使用 JSON output 時不能互動提示。依 `--help` 補齊所有必要 flag，或移除 JSON output 讓登入流程可互動。不要反覆重跑同一個缺參數指令。

### 邀請連結顯示缺少驗證資訊

- 檢查 Supabase Auth Site URL 與 Redirect URLs。
- 檢查邀請 URL 是否完整，沒有被郵件系統截斷。
- 檢查 `/auth/complete` 是否能處理 URL fragment／token。
- 過期或已使用的邀請需要管理者重寄，不要手動拼 token。

### MFA 驗證未達 AAL2

- 必須先完成 TOTP factor enrollment／verify。
- 再 challenge + verify 六位碼。
- 後端只有取得 AAL2 才設定 `mfa_required=true`。
- 已修正 Supabase response token 讀取差異；相關提交 `3274fff`。
- 若仍失敗，檢查 Auth logs、factor status 與裝置時間同步。

### REIBI 工作階段已失效

- 重新由 `/reibi-login` 登入。
- 確認可信帳號 active、角色與 scope 關聯完整。
- 檢查 `reibi_internal_sessions` 是否 revoked／expired。
- 確認 Railway 使用正確 Supabase 與 JWT secret。

### 「跨組織操作必須指定 org_code／enterprise_id」

- Super／finance 必須先在頁面選企業。
- API 呼叫要帶所選企業 ID／code。
- 不能用瀏覽器自行輸入任意企業；後端仍會驗證。
- 服務部門架構的 `enterprise_id` 問題已於 `d73736e` 修正。

### 邀請企業帳號時顯示 organizations 尚未同步

- 新案 transaction 現在會同步 `reibi_enterprises` 與 `organizations`。
- 修正提交 `40d146d`。
- 舊測試企業需確認是否已回填；不要用建立重複企業規避。

### PDF 上傳後沒有跳分析結果

- 檢查瀏覽器 Network 中 `/api/analyze` response。
- 檢查 Railway logs 與 `NEXT_PUBLIC_API_URL`。
- 確認回傳 `record_id` 後前端有導向正確 report route。
- 檢查 Gemini key、PDF parser 與 Supabase insert 是否成功。
- 這個問題屬 SleepM 主流程，不要與 REIBI Artifact 匯入混淆。

---

## 14. 下一個對話建議執行順序

### 第一階段：重新確認環境（只讀）

1. `Get-Location` 確認 `C:\sleepm_merge`。
2. `git branch --show-current` 確認 feature branch。
3. `git status --short`，保留三個既有未提交變更。
4. 驗證 Python、Node、npm。
5. 驗證 Docker Desktop／CLI。
6. 唯讀確認 Supabase project healthy、16 migrations 與 advisor。
7. 確認 Vercel／Railway 最新部署指向同一 feature commit。

### 第二階段：跑一次完整驗證

依 [reibi-release-checklist.md](reibi-release-checklist.md) §1 的四道關卡逐一執行，確認本機仍是綠燈。

### 第三階段：發布（專案負責人）

1. 啟用 leaked-password protection 並回歸邀請與登入。
2. 完成備份／還原演練。
3. 設定監控與錯誤告警。
4. 檢查正式 CORS、網域與 secrets。
5. 用網頁開 Draft PR，內容取自 [reibi-pull-request.md](reibi-pull-request.md)。
6. PR code review。
7. 完整驗收後才合併 `main`，再執行 §11.5 的正式 smoke test。

### 尚待決定

1. `reibi/` 的 15,322 行原始 Artifact 素材要留在 `main` 或移到封存分支。
2. 未實作的 registry 權限（IAM-R04）要補端點，或把那些權限標為保留並修正角色說明。

---

## 15. 新對話可直接貼上的接手提示

```text
工作區是 C:\sleepm_merge。

請先完整閱讀：
1. docs/reibi-merge-master-handoff.md
2. docs/reibi-release-checklist.md
3. docs/reibi-feature-migration-checklist.md
4. docs/reibi-local-development.md

目前開發分支是 codex/reibi-fastapi-merge，正式部署分支是 main。
不要覆蓋或提交既有的 .gitignore 與兩個 backend/modules/__pycache__ 變更。

功能移植、14 角色權限矩陣與瀏覽器 E2E 已完成；剩下的是需要 Supabase Dashboard
與 GitHub 權限的發布作業，那些由我執行，不要嘗試代做。

每完成一個 batch，必須跑四道關卡（後端 pytest + pip check、TypeScript --noEmit、
Next production build、pgTAP db:test），更新文件，commit 並 push 到 feature branch。
需要動到 UI 或業務流程時，另外跑 frontend 的 npm run e2e。

專案使用 FastAPI + Next.js + Supabase，AI 一律 Gemini，service role 只能在後端。
舊 Artifact window.storage 已決定不搬遷。
自動化測試一律只寫入本機 Supabase；staging 與正式共用同一個遠端專案，
任何手動測試寫入前先告訴我資料內容與清理方式。
roles.py 是授權的唯一權威 —— 新增守門請用 has_permission()，不要寫死角色名稱集合。

請先只讀確認工作區、Git、Python、Node、Docker 與 Supabase 狀態，再告訴我檢查結果；
不要立刻修改程式或資料。
```

---

## 16. 完成定義

只有同時達成以下條件，才可宣稱「REIBI 移植與正式上線完成」：

| 條件 | 狀態 |
|---|---|
| 核心功能與核准差異都已記錄 | ✅ |
| 所有 schema 變更都有版本化 migration | ✅ 16 個，空庫重播通過 |
| FastAPI 的輸入、權限與 tenant scope 完整 | ✅ |
| 前端載入、空、錯誤、成功與手機版可用 | ✅ Playwright 驗證 |
| service role 未外洩，RLS／grants／RPC 經過安全 review | ✅ E2E 驗證瀏覽器端無 service role |
| 14 角色 401／403／IDOR/BOLA 測試完成 | ✅ 見 §11.6 |
| 登入、新案、帳號、報價、合約、工單、驗收 E2E 完成 | ✅ 帳號邀請流程僅 API 層覆蓋 |
| Gemini、PDF、Storage 與外部整合有真實失敗處理 | ✅ |
| Supabase leaked-password protection 已啟用 | ⬜ **專案負責人** |
| 備份、還原、監控、告警、正式 CORS／網域／secrets 已驗證 | ⬜ **專案負責人** |
| PR review 通過並合併 `main` | ⬜ **專案負責人** |
| 合併後 production smoke test 通過 | ⬜ **專案負責人** |

在此之前，較準確的描述是：**功能移植、權限矩陣與端對端測試已完成，剩下的全部是需要 Dashboard／GitHub 權限的發布作業。**
