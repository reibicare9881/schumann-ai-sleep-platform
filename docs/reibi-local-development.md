# REIBI 本機開發與匯入流程

## 現階段環境邊界

- 暫不使用 Railway；這不影響本機開發或 Supabase schema／資料搬移。
- `baseline_remote_schema`、`harden_existing_access` 與 `extend_reibi_domain` 已於 2026-08-12 在本機重播驗證，並套用至已綁定的遠端 Supabase。
- 遠端已有 20 張 `reibi_*` 資料表，20/20 均啟用 RLS；只有 `postgres` 與 `service_role` 具有表權限。
- 前端本機 API URL 為 `http://localhost:8000`。
- FastAPI 持有 `service_role`，前端永遠不可取得該 key，也不直接呼叫 Supabase Data API。
- 已發布 Artifact 的實際 `window.storage` 資料不在此 repo；必須分別從四個已發布 Artifact 匯出 JSON，才能進行資料搬移。

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
| Artifact 跨組織正式匯入 | 否 | 是 |

`reibi_super` 尚未接上正式登入流程。這是刻意限制：不能用單位共用 PIN 取得跨企業 service-role 權限。正式匯入前必須先完成 REIBI 內部帳號與角色模型；在此之前，管理頁只提供預檢，不提供正式寫入按鈕。

## Artifact JSON 格式

標準格式：

```json
{
  "source_artifact": "l5",
  "source_version": "v2.14",
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

截至 2026-08-12，migration 重播、前端 production build，以及本機／遠端資料表、RLS、權限與 Database Advisors 已完成驗證。遠端 advisor 尚有一項既有警告：Auth 的 leaked-password protection 未啟用；正式上線前應在 Supabase Auth 設定中開啟。

後端 Python 測試仍須在可用的 Python 環境執行。目前工作站原有虛擬環境指向已移除的 Python 3.11，不能把該啟動失敗誤判為 FastAPI 測試失敗。
