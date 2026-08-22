# ClamAV 上傳掃描：部署說明

建立日期：2026-08-22（Asia/Taipei）

本文說明 `backend/Dockerfile`／`backend/docker-entrypoint.sh` 這組 ClamAV 整合實際上做了什麼、
本機驗證過什麼，以及要在 Railway 上真正啟用它還缺哪些步驟。**尚未套用到 Railway**——
目前 Railway 仍用 Railpack 建置，這組 Dockerfile 只存在於 repo 裡，沒有任何線上服務受影響。

---

## 1. 現況：程式碼已就緒，Railway 尚未切換

- [backend/upload_safety.py](../backend/upload_safety.py) 的 `scan_for_malware()` 是選用的：
  沒設定 `CLAMAV_HOST` 就完全不掃描（跟現在 Railway 上的行為一模一樣）。已接到
  `/api/analyze`（Schumann 報告）與匯款單據 OCR 兩個上傳點，在既有的結構性檢查之後執行。
- 設定了 `CLAMAV_HOST` 之後：掃描服務打不到（連線失敗、逾時）一律**擋下上傳**（503），
  不會悄悄跳過——已決定啟用防護後，連不上就是要老實回報，而不是假裝掃過了。
- [backend/Dockerfile](../backend/Dockerfile)、[backend/docker-entrypoint.sh](../backend/docker-entrypoint.sh)：
  在同一個容器內跑 ClamAV（`clamd` + `freshclam`）與 FastAPI，兩者透過 `127.0.0.1:3310` 溝通，
  不對外開放、不外送任何檔案。

## 2. 本機已完整驗證（非紙上作業）

用本機 Docker Desktop 實際建置並跑過全套流程，過程中抓到兩個 ClamAV 官方套件本身的坑：

| 問題 | 現象 | 修法 |
|---|---|---|
| Debian 套件的 `clamd.conf` 預設**完全沒有** `TCPSocket`／`TCPAddr` 這兩行（不是註解掉，是根本不存在） | `clamd` 啟動報錯 `Please define server type` | 用 `printf >> clamd.conf` 直接附加這兩行，而不是 `sed` 取代不存在的行 |
| `clamd` 不帶 `--config-file` 時會退回一個內建預設路徑（不是 `/etc/clamav/clamd.conf`），且即使設定裡完全沒有 `LocalSocket`，還是會嘗試綁定預設的本地 socket 路徑 `/var/run/clamav/clamd.ctl` | `LOCAL: Could not create socket directory: /var/run/clamav: Permission denied`，`clamd` 直接當掉 | (1) 明確帶 `--config-file=/etc/clamav/clamd.conf`；(2) 額外建立 `/var/run/clamav` 目錄並給 `clamav` 使用者權限，即使本意只想用 TCP |

驗證結果（用 EICAR 業界標準測試字串，非真實病毒）：

```
EICAR result: 'stream: Eicar-Test-Signature FOUND'
Clean result: 'stream: OK'
```

`/`（服務資訊）回應 200；`/health` 回應 503——這是**預期行為**，因為本機測試用的是假
`SUPABASE_URL`，證明健康檢查真的有在檢查依賴，不是隨口回 200。

## 3. 實測資源使用量（Railway 方案選型要參考這個）

- `clamd` 載入病毒資料庫後常駐記憶體約 **985 MB**（另外 FastAPI 本身還要再加）。
- 從 `freshclam` 抓完特徵庫到 `clamd` 開始接受連線，約 **12 秒**（特徵庫已存在、僅檢查更新的情況下；
  全新環境第一次下載完整資料庫（主資料庫約 89 MB＋每日更新約 23 MB）會更久，取決於網路速度）。
- **這代表 Railway 上跑這個服務的方案，記憶體至少要抓 1.5–2 GB**，比現在單純跑 FastAPI 高出一截，
  會影響費用。

## 4. 要在 Railway 上真正啟用，還缺什麼（尚未執行，需要你決定）

1. **把 Railway `staging` 環境的建置方式從 Railpack 改成 Dockerfile。** 這是會影響目前唯一在服務的
   環境的變動——建議先在 Railway 建一個新的臨時環境（例如 `clamav-trial`），指向這個 Dockerfile
   測過一輪部署成功、`/health` 正常、資源用量在方案內，**確認沒問題後才切換 staging**，不要直接
   對線上環境動手。這是吸取這次 session 稍早那次「改分支設定不小心影響到 staging」的教訓。
2. 確認 Railway 方案的記憶體上限足夠（見第 3 節）。
3. 在 staging 環境設定 `CLAMAV_HOST=127.0.0.1`、`CLAMAV_PORT=3310`（Dockerfile 已內建這兩個
   `ENV` 預設值，通常不需要額外在 Railway Dashboard 重複設定，除非要覆寫）。
4. 部署後跑一次 EICAR 測試字串上傳，確認正式環境真的擋下來，而不是只在本機測試通過。

**目前不建議在沒有先做過第 1 點臨時環境驗證的情況下，直接把 staging 切成 Dockerfile 建置。**
