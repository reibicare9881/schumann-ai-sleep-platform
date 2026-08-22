"""不會把個資或健康資料寫進 log 的例外記錄。

新系統原本用 `print(f"...失敗: {e}")` 記錄例外。問題在於 Supabase 與 Pydantic 的
例外訊息**常帶著失敗那筆資料的欄位值** —— 睡眠分數、疼痛分數、PHQ-4／PSS-4，
乃至 BSRS-5 的自殺意念題答案。這些字串會進 Railway 的 log，而 log 通常沒有跟
資料庫同等的存取控制。

這裡的原則：log 記「哪裡、什麼類型的錯」，不記「錯誤訊息內容」。訊息內容可能安全，
但無法逐一保證，因此預設不記；真的需要細節時在 DEBUG 模式下才輸出，且仍經過遮蔽。
"""

from __future__ import annotations

import logging
import re
from typing import Any

try:
    from config import settings
    _DEBUG = bool(getattr(settings, "debug", False))
except Exception:  # noqa: BLE001 — 設定不可用時一律採最保守（不輸出內容）
    _DEBUG = False

logger = logging.getLogger("reibi")

# 一旦在字串中偵測到這些鍵名附近的值，就遮蔽。涵蓋健康分數、量表答案、
# 身分憑證與聯絡資訊 —— 都是不該進 log 的東西。
_SENSITIVE_HINTS = (
    "sleep_score", "pain_score", "work_score", "score", "answers", "answer",
    "phq", "pss", "bsrs", "suicide", "mind", "msk", "violence", "overwork",
    "consent", "profile", "birth", "gender", "diagnosis", "hypertension", "diabetes",
    "email", "phone", "pin", "password", "token", "activation", "member_code",
    "full_name", "name", "address", "contact",
)

_HINT_ALT = "|".join(re.escape(h) for h in _SENSITIVE_HINTS)

# key=value 或 key: value。hint 後允許再接數字或底線（phq4、bsrs5、sleep_score），
# 以及一段非分隔字元（bsrs5_total），值一路吃到下一個分隔符為止。
_KV_PATTERN = re.compile(
    r"(?i)\b(" + _HINT_ALT + r")[\w]*"
    r"(\s*[=:]\s*)"
    r"('[^']*'|\"[^\"]*\"|[^,;)\}\s]+)"
)

# Postgres 複合鍵錯誤：Key (col_a, col_b)=(val_a, val_b)。
# 左括號的欄位名含任一 hint 時，整個右括號的值都遮蔽 ——
# 這是 Supabase unique 違反最常見的格式，值就直接攤在錯誤訊息裡。
_PG_KEY_PATTERN = re.compile(
    r"(?i)\(([^)]*(?:" + _HINT_ALT + r")[^)]*)\)\s*=\s*\(([^)]*)\)"
)

# 獨立出現的長數字串（可能是身分證、電話、會員碼）也遮掉。
_LONG_DIGITS = re.compile(r"\b\d{6,}\b")
# Email 形狀。
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")


def redact(text: Any) -> str:
    """把字串中看起來像個資或健康資料的片段換成佔位。

    不是密碼學保證，是「預設不外洩」的防線：寧可過度遮蔽，
    也不要讓一筆睡眠分數因為夾在例外訊息裡而進了 log。
    """
    value = str(text)
    # 先處理 Postgres 複合鍵，否則裡面的欄位名會被 KV pattern 拆散。
    value = _PG_KEY_PATTERN.sub(lambda m: f"({m.group(1)})=([redacted])", value)
    value = _KV_PATTERN.sub(lambda m: f"{m.group(1)}{m.group(2)}[redacted]", value)
    value = _EMAIL.sub("[email]", value)
    value = _LONG_DIGITS.sub("[num]", value)
    return value


def log_exception(where: str, exc: BaseException, *, extra: str | None = None) -> None:
    """記錄一個例外，只留位置與類型，不留可能含個資的訊息內容。

    `where` 是人可讀的位置標籤（例如 "sleep_assessment.recommendations"）。
    DEBUG 模式下額外輸出**經遮蔽的**訊息，方便本機排錯；正式環境完全不輸出內容。
    """
    label = f"[{where}] {type(exc).__name__}"
    if extra:
        label += f" ({redact(extra)})"
    if _DEBUG:
        logger.warning("%s: %s", label, redact(str(exc)))
    else:
        logger.warning("%s", label)


def log_message(where: str, message: str) -> None:
    """記錄一則非例外訊息，同樣先經遮蔽。"""
    logger.info("[%s] %s", where, redact(message))
