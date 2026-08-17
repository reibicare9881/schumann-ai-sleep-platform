# REIBI 本機開發與選用匯入流程

## 現階段環境邊界

- Railway Hobby 已建立 staging 後端；本機開發仍使用 `http://localhost:8000`，部署環境與本機環境不可混用 secrets。
- `baseline_remote_schema`、`harden_existing_access` 與 `extend_reibi_domain` 已於 2026-08-12 在本機重播驗證，並套用至已綁定的遠端 Supabase。
- 遠端已有 38 張 `reibi_*` 資料表，均由 migration 建立並採 deny-by-default RLS／grants；應用程式資料存取只經 FastAPI 的 `service_role`。
- 前端本機 API URL 為 `http://localhost:8000`。
- FastAPI 持有 `service_role`，前端永遠不可取得該 key，也不直接呼叫 Supabase Data API。
- 已發布 Artifact 的實際 `window.storage` 資料不在此 repo；依 [2026-08-14 範圍決策](reibi-legacy-data-scope-decision.md)，不匯出或搬移舊資料，新 Supabase 業務資料乾淨起始。

## 啟動順序

1. 開啟 Docker Desktop，確認 Engine running。
2. 從 repo 根目錄啟動本機 Supabase：

   ```powershell
   npm.cmd run supabase -- start
   npm.cmd run supabase -- db reset --local --no-seed
   ```

3. 將本機 Supabase URL 與 secret/service-role key 以環境變數提供給 FastAPI。不要覆寫或提交 `backend/.env` 的正式 secrets。
4. 啟動 FastAPI：

   ```powershell
   Set-Location C:\sleepm_merge\backend
   .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
   ```

5. 啟動 Next.js：

   ```powershell
   Set-Location C:\sleepm_merge\frontend
   npm.cmd run dev
   ```

6. 以單位 `admin` 登入，在儀表板開啟 `/reibi`。

## REIBI API 權限

| 功能 | `admin` | `reibi_super` |
|---|---:|---:|
| 查看／維護自己 org_code 的企業資料 | 是 | 是 |
| 查看／新增自己企業的報價、合約、工單 | 是 | 是 |
| 更新自己企業商務文件狀態 | 是 | 是 |
| Artifact JSON 預檢 | 是 | 是 |
| Artifact 跨組織匯入技術能力（目前範圍不執行） | 否 | 是 |
| L5 新案開通、流水號與安全憑證函 | 否 | 是（`reibi_finance` 亦可） |

受邀的主平台、REIBI 內部與經銷商角色統一使用 `/reibi-login`：Supabase Auth Email／密碼、已驗證 Email、`reibi_internal_users` 可信 registry 與可撤銷的 30 分鐘 server-side session。角色、企業、部門及經銷商範圍均由伺服器載入，瀏覽器不能自行指定。單位共用 PIN 永遠不能取得 L5 或經銷商角色；要求 MFA 的邀請會在 `/auth/complete` 完成 TOTP 設定，後續登入必須達 AAL2。`admin` 與 `reibi_super` 可使用 `/reibi/accounts`，但前者只能管理自己企業且不能授予 `admin`。第一位正式 `reibi_super` 已完成 TOTP 綁定及 staging AAL2 登入驗證；後續帳號與選用匯入操作見 [Batch G 手冊](reibi-batch-g-runbook.md)。

既有可信帳號可在 `/reibi/mfa` 補綁 TOTP。流程會要求再次輸入密碼、顯示 QR Code、驗證六位數代碼；只有 Supabase 回傳 AAL2 後，後端才透過版本化 transaction 設定 `mfa_required=true`，並撤銷所有舊 AAL1 應用工作階段。不得先在 Dashboard 或 SQL Editor 手動開啟該 flag。

## Artifact JSON 格式

本節只記錄已保留的選用搬遷能力，目前上線流程不要求產生或匯入舊 Artifact JSON。

標準格式（舊格式仍可預檢；正式匯出使用版本化 envelope）：

```json
{
  "schema_version": "reibi-artifact-export/1.0",
  "source_artifact": "l5",
  "source_version": "v2.14",
  "exported_at": "2026-08-12T08:00:00.000Z",
  "part": 1,
  "parts": 1,
  "export_sha256": "64-character-lowercase-hex",
  "entries": [
    {
      "storage_key": "l5_enterprises",
      "value": [
        {
          "id": "CASE_123",
          "orgCode": "ORG-ACME-26-001",
          "orgName": "範例企業"
        }
      ]
    }
  ]
}
```

管理頁也接受單純的 key/value JSON 物件，並在瀏覽器轉為標準格式：

```json
{
  "l5_enterprises": [],
  "l5_staff": [],
  "l5_invoices": []
}
```

限制：最多 5,000 個 storage entries、整份 JSON 最多 10 MB。陣列元素會拆成獨立匯入記錄。

## 匯入安全規則

- `sess`、PIN、備援碼、lock state、token、跨 Artifact handoff 一律不搬。
- 原始 payload 進資料庫前會再次移除 password/token/PIN/activation code 與 base64 匯款影像。
- 舊訂閱 activation code 不沿用，正式上線時重新核發。
- 歷史 AI 內容保留，但 provider 不會偽標為 Gemini；新 AI 產出只允許 Gemini。
- 組織彙整的 `sample_size` 小於 5 時拒絕匯入。
- 匯出內容以 SHA-256 辨識重複批次；完成過的相同檔案不重複匯入。
- 無法安全映射的 storage key 只保留在匯入紀錄並標為 skipped，不猜測欄位。

## 驗證命令

```powershell
Set-Location C:\sleepm_merge\backend
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v

Set-Location C:\sleepm_merge\frontend
npx.cmd tsc --noEmit
npm.cmd run build
```

截至 2026-08-17，Batch M 的 89 項 Python 測試、TypeScript no-emit、前端 production build、FastAPI 路由 smoke test 與遠端 16 個 migration 歷史核對已通過。`reibi_super`／`reibi_finance` 可在 `/reibi` 跨企業總覽選定企業，再管理基本資料、方案、授權、場域與部門；企業 `admin` 仍只限登入 token 內的自身企業。主經銷商在 `/reibi/service` 可選擇自身與直屬子經銷商企業，次級經銷商只限自身；案件清單、建立與 L5 聚合都由後端重新驗證，L5 作業流程會顯示服務案件的待處理與總筆數。服務中心的部門架構與 CSV 匯入會明確使用已選企業，超級管理員不再因缺少 `enterprise_id` 中斷載入。新案開通入口為 `/reibi/onboarding`；成功後可下載不含密碼的 PDF 憑證函，再到 `/reibi/workflow` 建立報價、合約與工單。新案企業會同步至 `organizations`，因此可直接在 `/reibi/accounts` 邀請該企業的可信帳號。遠端 advisor 尚有一項既有警告：Auth 的 leaked-password protection 未啟用；正式上線前應在 Supabase Auth 設定中開啟。

2026-08-14 已重新安裝 Python 3.11.9 並重建 `backend/.venv`；開發依賴由 `backend/requirements-dev.txt` 引用正式依賴並固定 pytest 8.4.2。2026-08-17 最近一次 `pip check` 無相依衝突，89 項 Python 後端測試通過。`.venv` 仍含基底 Python 的絕對路徑；若基底直譯器被移除，應直接依本文件重建，不應搬移或沿用舊環境。
