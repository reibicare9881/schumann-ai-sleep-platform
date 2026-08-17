# PR 標題與內文（貼到 GitHub）

開啟網址：`https://github.com/reibicare9881/schumann-ai-sleep-platform/compare/main...codex/reibi-fastapi-merge?expand=1`

建立時請勾選 **Create draft pull request**。

---

## 標題

```
REIBI 移植：FastAPI 唯一資料層、14 角色權限、完整測試與安全修正
```

---

## 內文（以下整段複製）

```markdown
把 `reibi/` 四個獨立 JSX Artifact 的業務能力重構並移植進 SleepM 平台，形成
Next.js 前端 + FastAPI 唯一後端資料層 + Supabase（Postgres／Auth／Storage）+ Gemini。

## 範圍

- 27 個 commit，108 個檔案
- 16 個版化 migration，38 張 `reibi_*` 業務表
- 10 個 `/reibi/*` 前端頁面
- 176 條路由，其中 166 條需驗證、10 條為刻意公開

已核准的範圍決策：**不搬遷**舊 Artifact 的 `window.storage` 資料
（見 `docs/reibi-legacy-data-scope-decision.md`）。`reibi_artifact_import_*`
維持 0 筆是預期狀態，不是移植失敗。

## 功能

| 批次 | 內容 |
|---|---|
| A | REIBI domain schema、企業／場域／L1-L4 部門、tenant 範圍 |
| B | 報價 → 合約 → 工單 → 驗收閉環，含防並發單號與交易式轉換 |
| C | 付款時程、匯款、發票、訂閱、經銷商、夥伴、佣金 |
| D | 個人健康、心理量表、職安、OHS、k≥5 隱私限制 |
| E | 組織 KPI／OKR／ESG／ROI／GRI 與 Gemini 報告 |
| F | 部門 CSV、服務案件、公告、LINE、匯款 OCR |
| G | Artifact 匯入能力、Supabase Auth 可信登入、30 分鐘可撤銷 session |
| H／MFA | 14 角色權威 registry、邀請、TOTP、AAL2、停用與 session 撤銷 |
| J／K／L／M | L5 角色化總覽、新案開通、跨企業管理、經銷商服務案件 |
| N～R | 測試地基、權限矩陣、資料庫回歸、瀏覽器 E2E、registry 授權對齊 |

## 安全修正

以下缺陷皆**先以測試重現、再修正**：

| 端點 | 問題 |
|---|---|
| `GET /api/sleep/latest-profile/{user_id}` | 守門條件比對 JWT 從未簽發的 `system_role` claim，恆為 false —— 任何登入者可讀他人睡眠 profile |
| `GET /api/pdf/{record_id}` | 完全無擁有者檢查，可用流水號下載他人分析報告 PDF |
| `POST /api/ai-trend/{user_id}` | 只比對角色不比對組織，任一單位管理者可將他人健康史送進 Gemini |
| `GET /api/schumann/reports`（列表與詳情） | 只比對角色不比對組織，跨租戶讀取 |
| `GET /api/history/{user_id}`、`/api/schumann/trend/{user_id}` | 守門 `KeyError` 被外層 `except Exception` 轉成 500，並回傳原始例外字串 |
| `GET /api/reibi/finance/settings` | 空結果取 `[0]` 造成 500 |

六個個人紀錄端點統一走 `assert_can_read_user_records()`：**本人，或同一 `org_code` 的 `admin`**。
此變更移除 `dept_head` 的跨使用者讀取（原本可讀任何單位任何人）；前端所有呼叫端
只傳自身 `session.uid`，無既有流程受影響。

## 權限 registry 對齊

`roles.py` 被文件列為唯一權威，但定義的 26 個權限字串中只有 4 個曾被後端查詢，
其餘授權靠 Batch D／E 寫死的角色集合（成形於 14 角色 registry 之前）。結果是
`admin_hr` 無法執行職安管理與組織彙整、`reibi_data` 無法執行跨企業分析，儘管
registry 明文授予這些權限。

本 PR 依決策只修 `admin_hr` 與 `reibi_data`（`admin_finance` 因 registry 持有
`org_analytics` 一併生效），兩個刻意例外：

- `/analytics/directory` **維持 `reibi_super` 限定** —— 回傳 `contact_name`、
  `phone`、`email` 與四層費用，是客戶聯絡資料與定價，不是去識別分析。
- `/analytics/cross-org` 對無財務職掌者**遮蔽金額**，與 Batch J 在 L5 的裁切一致，
  否則同一份數字換個端點就取得得到。

`admin_it` 的 `security_audit` 等 20 個 registry 權限尚無端點實作，已記錄為 IAM-R04。

## 測試

| 層級 | 數量 |
|---|---|
| Python | 3,275 passed |
| pgTAP | 146 passed（`supabase test db` 現在回傳 PASS） |
| Playwright E2E | 24 passed（18 desktop + 6 mobile） |
| `pip check` | 無衝突 |
| TypeScript `--noEmit` / Next.js build | 通過 |

測試基礎建設的兩個修正值得注意：

1. **後端測試原本讀 `backend/.env` 執行**，等同指向正式 Supabase 專案；沒出事是
   運氣不是設計。現已在載入 config 前把所有 Supabase 與 secret 變數釘死為假值，
   並在 `import main` 前把 `create_client` 換成記憶體替身。
2. **`supabase test db` 原本一直回傳 FAIL**。Batch K 的資料庫斷言不是 pgTAP 格式，
   pg_prove 計 0 項並讓整個指令失敗 —— 該批斷言從未被計入先前宣稱的「135 項通過」。
   改寫後又發現原斷言把流水號寫死，而 sequence 不隨 rollback 回退。

E2E 全程只寫入本機 Supabase，種子腳本硬性拒絕非 `127.0.0.1:54321` 的目標。

## 合併前仍需專案負責人執行

見 `docs/reibi-release-checklist.md`：

- [ ] 啟用 Supabase leaked-password protection（目前 advisor 唯一 WARN）
- [ ] 備份確認與還原演練
- [ ] 監控與錯誤告警
- [ ] 正式 secrets／CORS／網域／HTTPS 核對
- [ ] Code review
- [ ] 合併後正式 smoke test

## Review 建議起點

1. `backend/main.py` 的 `assert_can_read_user_records()`
2. `backend/reibi_batch_d.py`、`reibi_batch_e.py` 的守門改為 `has_permission()`
3. `backend/reibi_batch_e.py` 的 `redact_financial_figures()`
4. `backend/tests/test_permission_matrix.py` 的 `PUBLIC_ROUTES` —— 請確認這 10 條
   刻意公開的路由都同意

## 兩個尚未決定的事項

1. `reibi/` 目錄含 **15,322 行**原始 Artifact 素材（四個 JSX 與規格文件），佔本 PR
   插入行數約 44%。要留在 `main` 或移到封存分支，尚未決定；不影響任何功能。
2. 工作區的 `.gitignore` 與兩個 `backend/modules/__pycache__/*.pyc` 有未提交的
   使用者變更，本次移植全程未觸碰。
```
