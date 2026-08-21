"""會真的檢查依賴的健康檢查（REL-05 的前置）。

原本的 `/` 回傳寫死的 `{"status": "online"}`。Supabase 斷線、金鑰過期、
資料庫負載滿載，它都照樣回 200 —— 監控接上去只會確認「這台機器還活著」，
而不是「這個服務還能用」。那種健康檢查在故障時最不可靠，因為它永遠是綠的。

這裡實際去碰依賴：對 Supabase 下一個極輕量的查詢，並確認 Gemini 金鑰有設定。
任一必要依賴失敗就回 **503**，讓 Railway 的告警與 load balancer 能據此動作。

刻意不回傳的東西：例外訊息、連線字串、金鑰片段。健康檢查通常是**未經驗證**
就能存取的端點，任何細節都等於對外公開。回應只說哪個依賴不健康，不說為什麼。
"""

from __future__ import annotations

import time
from typing import Any, Callable

from config import settings
from safe_logging import log_exception

# 單一依賴檢查的逾時上限（秒）。健康檢查本身不該變成拖垮服務的來源，
# 因此寧可判定為不健康，也不要無限等待。
DEPENDENCY_TIMEOUT_SECONDS = 5.0


def _check_database(client: Any) -> dict[str, Any]:
    """對 Supabase 下一個最小查詢。只看「回不回得來」，不看內容。"""
    started = time.perf_counter()
    try:
        client.table("organizations").select("org_code").limit(1).execute()
    except Exception as exc:  # noqa: BLE001 — 健康檢查要把任何失敗都算成不健康
        log_exception("health.database", exc)
        return {"healthy": False, "latency_ms": None}
    return {"healthy": True, "latency_ms": round((time.perf_counter() - started) * 1000)}


def _check_ai_key() -> dict[str, Any]:
    """確認 Gemini 金鑰有設定。

    刻意不真的呼叫 Gemini：健康檢查每分鐘會被打很多次，
    每次都燒一次 API 額度並不合理。這裡只擋「忘了設定」這個最常見的部署失誤。
    """
    key = getattr(settings, "gemini_api_key", "") or ""
    return {"healthy": bool(key.strip())}


def build_health_report(client: Any, *, checks: dict[str, Callable[[], dict[str, Any]]] | None = None) -> dict[str, Any]:
    """組出健康報告。`checks` 可注入，測試不必真的連線。"""
    runners = checks or {
        "database": lambda: _check_database(client),
        "ai_key": _check_ai_key,
    }
    results: dict[str, Any] = {}
    for name, runner in runners.items():
        try:
            results[name] = runner()
        except Exception as exc:  # noqa: BLE001 — 檢查本身壞掉也算不健康
            log_exception(f"health.{name}", exc)
            results[name] = {"healthy": False}

    healthy = all(bool(result.get("healthy")) for result in results.values())
    return {
        "status": "healthy" if healthy else "unhealthy",
        "service": "統一多平台 API",
        "version": "2.0.0",
        # 只說哪個依賴不健康，不說為什麼 —— 這個端點通常未經驗證即可存取。
        "dependencies": {name: bool(result.get("healthy")) for name, result in results.items()},
        "database_latency_ms": results.get("database", {}).get("latency_ms"),
    }
