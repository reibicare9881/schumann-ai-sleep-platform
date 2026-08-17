# REIBI 移植：合併 `main` 前的發布檢查清單

建立日期：2026-08-17（Asia/Taipei）

分支：`codex/reibi-fastapi-merge` → `main`

本清單的每一項都標明**由誰執行**。標「開發代理」的項目已完成或可由 AI 代理完成；標「專案負責人」的項目需要 Supabase Dashboard、GitHub 或雲端主控台權限，**不應由代理代為操作**。

---

## 1. 自動化驗證關卡（開發代理，每次提交前）

四道關卡都必須綠燈才可推送。

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
| Python 測試 | 3,275 passed | 開發代理 |
| TypeScript `--noEmit` | 通過 | 開發代理 |
| Next.js production build | 通過 | 開發代理 |
| pgTAP（`db:test`） | 146 passed，`Result: PASS` | 開發代理 |
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
| **Supabase leaked-password protection** | ⬜ **未啟用** | **專案負責人** |
| **正式 secrets 最終核對** | ⬜ 待辦 | **專案負責人** |
| **正式 CORS／網域／HTTPS** | ⬜ 待辦 | **專案負責人** |

### 2.1 啟用 leaked-password protection（專案負責人）

1. Supabase Dashboard → Authentication → Policies → Password security。
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

## 3. 資料庫與備份（專案負責人）

| 項目 | 說明 |
|---|---|
| ⬜ 備份確認 | Supabase Dashboard → Database → Backups，確認自動備份已啟用且有可用還原點 |
| ⬜ 還原演練 | 在**非正式**專案或分支資料庫實際還原一次，記錄耗時與步驟 |
| ⬜ Migration 歷史核對 | 遠端 16 個 migration 與 repo 一致（本批未新增 schema） |
| ⬜ 監控與告警 | 設定後端錯誤率、Supabase 連線數與 Gemini 失敗的告警管道 |

本次移植**未新增任何 migration**，遠端 schema 維持 16 個版本。

---

## 4. Code review 與合併（專案負責人）

| 步驟 | 說明 |
|---|---|
| ⬜ 開 Draft PR | 見下方 §6，`gh` CLI 未安裝，需用網頁開啟 |
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

## 6. Pull Request（`gh` CLI 未安裝，請用網頁開啟）

開啟以下網址即可建立 PR：

```
https://github.com/reibicare9881/schumann-ai-sleep-platform/compare/main...codex/reibi-fastapi-merge?expand=1
```

建立時請勾選 **Create draft pull request**。標題與內文見 [reibi-pull-request.md](reibi-pull-request.md)。

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
