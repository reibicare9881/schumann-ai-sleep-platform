"""單位通行碼登入的暴力破解節流。

Artifact（reibi-v10 的 checkLk／failPin／clearLk）有這個機制：通行碼錯 5 次鎖 30 分鐘，
SetupWizard 畫面還對使用者明白承諾過。移植時漏掉，導致四條登入路徑裡防護最弱的那條
反而完全沒有節流 —— 單位通行碼是全組織共用、通常較短，猜中一次就能讀取整間企業的
健康資料，而 Supabase Auth 那條（reibi_batch_g.trusted_login）早就有 10 分鐘 5 次的限制。

鎖定分兩層，因為單層都有明顯破口：
  * 只鎖單位 → 任何知道單位代碼的人都能故意輸錯，癱瘓整間公司的登入。
  * 只鎖 IP  → 擋不住分散來源的嘗試。
所以第一層鎖「單位＋角色＋IP」（門檻嚴，對應 Artifact 的 5 次），第二層鎖「單位＋角色」
跨 IP（門檻寬，只有真的在被攻擊時才會踩到）。兩層都是滾動時間窗自動解除 —— 通行碼
目前沒有任何自助重設管道，若需要人工解鎖等於把使用者鎖死。
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import HTTPException

from config import settings
from safe_logging import log_exception

WINDOW_MINUTES = 30
IP_FAILURE_LIMIT = 5
ORG_FAILURE_LIMIT = 20
_TABLE = "reibi_org_login_attempts"


def fingerprint(value: Optional[str]) -> Optional[str]:
    """與 reibi_batch_g._fingerprint 同一套做法：只存 HMAC，不存明文。"""
    if not value:
        return None
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _window_start() -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=WINDOW_MINUTES)).isoformat()


def _count_failures(client: Any, org_hash: str, role: str, ip_hash: Optional[str], limit: int) -> int:
    query = (
        client.table(_TABLE)
        .select("id")
        .eq("org_hash", org_hash)
        .eq("role", role)
        .eq("succeeded", False)
        .gte("created_at", _window_start())
    )
    if ip_hash is not None:
        query = query.eq("ip_hash", ip_hash)
    return len(query.limit(limit).execute().data or [])


def assert_not_throttled(client: Any, org_code: str, role: str, ip: Optional[str]) -> None:
    """通行碼比對前呼叫。超過門檻時丟 429。

    讀取失敗時**放行**並記錄例外：節流是縱深防禦，讓它的儲存出問題就擋掉所有單位使用者
    登入，是拿真實的可用性損失換邊際的安全收益，何況攻擊者仍要過 bcrypt 那一關。
    但「放行」不等於「靜悄悄」—— 表不存在（例如 migration 沒套用）會在 log 留下痕跡，
    另有 pgTAP 與 Python 測試守住這張表與這段行為，避免重演「程式上線但 migration 沒套」
    那次兩天的無聲中斷。
    """
    org_hash = fingerprint(org_code)
    if not org_hash:
        return
    ip_hash = fingerprint(ip)
    try:
        if ip_hash is not None and _count_failures(client, org_hash, role, ip_hash, IP_FAILURE_LIMIT) >= IP_FAILURE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"通行碼錯誤次數過多，請 {WINDOW_MINUTES} 分鐘後再試",
            )
        if _count_failures(client, org_hash, role, None, ORG_FAILURE_LIMIT) >= ORG_FAILURE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"此單位近期登入失敗次數過多，請 {WINDOW_MINUTES} 分鐘後再試",
            )
    except HTTPException:
        raise
    except Exception as exc:
        log_exception("org_login_throttle.check", exc)


def record_attempt(client: Any, org_code: str, role: str, ip: Optional[str], succeeded: bool) -> None:
    """記錄一次嘗試。寫入失敗不影響登入結果 —— 與稽核軌跡同一個原則。"""
    org_hash = fingerprint(org_code)
    if not org_hash:
        return
    try:
        client.table(_TABLE).insert({
            "org_hash": org_hash,
            "role": role,
            "ip_hash": fingerprint(ip),
            "succeeded": succeeded,
            # 時間戳由應用端寫入而非依賴資料庫預設值：時間窗起點也是應用端算的，
            # 兩邊用同一個時鐘才不會在資料庫與 API 時鐘有偏差時算錯次數。
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as exc:
        log_exception("org_login_throttle.record", exc)
