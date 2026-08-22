# REIBI 文件索引

最後校正：2026-08-21（Asia/Taipei）

本目錄以 [REIBI 移植專案：完整進度與缺漏報告](reibi-migration-status-report.md) 為目前狀態的唯一摘要；遇到與其他文件不一致時，以已提交程式碼、migration、遠端 Supabase 查詢與當次測試結果為準。

## 先讀什麼

1. [完整進度與缺漏報告](reibi-migration-status-report.md)：目前功能、部署、資料庫、風險與待辦。
2. [完整建置、進度與操作交接手冊](reibi-merge-master-handoff.md)：本機建置、日常操作、測試與發布流程。
3. [合併前發布檢查清單](reibi-release-checklist.md)：Draft PR、正式環境、備份與上線驗收。

## 設計與歷史依據

- [完整功能移植清單](reibi-feature-migration-checklist.md)：44 個批次的逐項歷史與未完成項目。批次中的測試數量是當時紀錄，不是目前總數。
- [JSX 移植缺口報告](reibi-jsx-migration-gap-report.md)：四個 Artifact 的逐檔比對、刻意不移植項目與尚未逐欄核對的範圍。
- [Artifact 資料映射](reibi-artifact-mapping.md)：僅供程式對照與日後另行核准的選用搬遷，不得據此執行舊資料匯入。
- [舊 Artifact 資料不搬遷決策](reibi-legacy-data-scope-decision.md)：目前有效的範圍決策。
- [本機開發流程](reibi-local-development.md)：本機服務與選用匯入能力的安全邊界。
- [ClamAV 上傳掃描部署說明](reibi-clamav-setup.md)：程式碼已就緒且本機驗證過，Railway 尚未套用；含實測記憶體用量與部署前需要的臨時環境驗證步驟。

## 已移除的過期文件

- `reibi-pull-request.md`：Draft PR 已建立，範本的 commit、migration、資料表與測試數量已過期。
- `reibi-batch-g-runbook.md`：包含過期的 AAL1/MFA 狀態與已不執行的舊資料匯入操作；現行帳號操作收斂至交接手冊與本機開發文件。
- `supabase-inventory.md`：是 2026-08-10 至 08-14 的早期快照，含已修復的安全問題，不可再稱為「現況」。版本化 migration 與 Git 歷史仍保留該階段的稽核依據。

## 目前固定事實

- 工作分支：`codex/reibi-fastapi-merge`；基準 commit：`ed75d9b`。
- repo 與遠端 Supabase：**21 個 migration**，完全同步（2026-08-22 套用第 21 個：單位通行碼登入節流）。
- 遠端：47 張 `public` tables，其中 41 張為 `reibi_*`。
- Python：3,959 tests；pgTAP：170 項（2026-08-22 於本機空資料庫全量重播 21 個 migration 後通過，`db:lint` 無錯誤）；TypeScript 與 production build 最近一次均已通過。
- 已決定不匯出或匯入舊 Artifact 的 `window.storage`。
- 第一位 `reibi_super` 已完成 TOTP 與 AAL2；不得在 SQL 直接把未驗證帳號的 `mfa_required` 設為 `true`。
