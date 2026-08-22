# REIBI 舊 Artifact 資料不搬遷決策

狀態：已接受

決策日期：2026-08-14

決策者：專案負責人

## 背景

四個已發布 Claude Artifact 的既有業務資料分別保存在各自隔離的 `window.storage`，不在 Git repository 或 Supabase 專案內。Batch G 已完成版本化 JSON 匯出、FastAPI 預檢／匯入、雜湊去重、重試 lineage 與稽核資料表，但尚未從已發布 Artifact 取得真實匯出檔。

## 決策

1. 不為了資料搬遷重新發布四個 Artifact，也不匯出其既有 `window.storage`。
2. 不把舊 Artifact 的企業、報價、合約、工單、健康或其他業務資料匯入 Supabase。
3. 新系統從乾淨的 Supabase 業務資料開始；正式使用後產生的新資料才是新系統的權威資料。
4. repo 內既有的 Artifact 匯出程式、欄位映射、匯入 API、migration、資料表及操作手冊保留，作為日後經另行核准的復原或選用搬遷能力，不在目前上線流程執行。
5. `reibi_artifact_import_batches` 與 `reibi_artifact_import_records` 維持 0 筆是此決策下的預期狀態，不代表部署失敗。

## 範圍與驗收影響

- 真實 Artifact JSON 的逐 key 預檢、來源／目標筆數核對、正式匯入、重複匯入、失敗恢復及舊資料簽核，改列為不適用（`[N/A]`）。
- Artifact 匯出與匯入程式本身仍屬已完成的技術能力，不因本決策刪除。
- 舊 Artifact 暫時維持唯讀／可查詢狀態；是否退役或刪除，須另依財務、法務、客戶查詢與資料保留需求決定。
- 本決策不免除新系統的 MFA、角色權限、401／403、IDOR/BOLA、E2E、備份、監控及新資料驗收。

## 已知後果

- 舊 Artifact 中的歷史企業、報價、合約、工單、健康及營運資料不會自動出現在新系統。
- 若日後需要查閱舊資料，應先從原始已發布 Artifact 查詢；新發布或複製的 Artifact 不保證具有原本的 `window.storage`。
- 若未來要反轉本決策，必須另開有明確資料範圍、法遵依據、備份、真實匯出檔與驗收標準的搬遷作業，不可直接在正式環境臨時匯入。

## 相關文件

- [完整功能移植清單](reibi-feature-migration-checklist.md)
- [Artifact 資料映射](reibi-artifact-mapping.md)
- [完整建置、進度與操作交接手冊](reibi-merge-master-handoff.md)
- [本機開發與匯入流程](reibi-local-development.md)
