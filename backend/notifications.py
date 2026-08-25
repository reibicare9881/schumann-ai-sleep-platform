"""服務案件與工單的狀態通知信。

範圍是刻意收窄的（2026-08-25 決定）：**只通知企業管理者、只通知服務案件與工單狀態**。
理由有兩層：

* 企業一般成員多半是靠共用通行碼登入、系統裡根本沒有他們的 email，做了也寄不出去。
* 更要緊的是**健康資料絕不進信件**。這個專案為了不讓睡眠分數、量表答案、BSRS-5 的
  自殺意念題答案落進 log，特地做了脫敏模組（見 safe_logging）。信件是明文、留在信箱
  伺服器、會被轉寄 —— 把評估結果寫進通知信，等於把那整套努力繞過去。案件與工單狀態
  不含健康資料，這也是為什麼先做這兩項。

沿用 LINE 推播那條線的原則：**沒設定就不假裝送達**。未設定 SMTP 時回傳
`configured=False`，呼叫端據此顯示「未寄出」，而不是靜靜地什麼都沒發生。

寄信失敗一律不影響業務操作 —— 與稽核軌跡同一個取捨：狀態沒改成功是災難，
通知沒寄到只是遺憾。
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Any, Iterable, Optional

from config import settings
from safe_logging import log_exception

# 會收到企業端通知的角色。刻意不含 individual 與一般 member：
# 前者不屬於任何企業，後者多半沒有 email 帳號。
NOTIFY_ROLES = ("admin", "admin_hr", "admin_finance", "admin_it", "occupational_health")


def is_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from)


def recipients_for_org(client: Any, org_code: Optional[str]) -> list[dict[str, str]]:
    """取得該企業內、有 email 且仍啟用的管理者。

    來源是 `reibi_internal_users`（受邀帳號），不是 `reibi_enterprises.email` ——
    後者是單一業務聯絡窗口，不一定是實際在用系統的人。
    """
    if not org_code:
        return []
    try:
        rows = (
            client.table("reibi_internal_users")
            .select("email,display_name,internal_role")
            .eq("org_code", org_code)
            .eq("is_active", True)
            .in_("internal_role", list(NOTIFY_ROLES))
            .execute()
            .data
            or []
        )
    except Exception as exc:
        log_exception("notifications.recipients", exc)
        return []
    return [row for row in rows if row.get("email")]


def send_email(to: Iterable[str], subject: str, body: str) -> bool:
    """寄一封純文字信。回傳是否真的送出。

    這裡不做重試：呼叫端已經把它當成「best effort」，重試只會讓狀態變更的
    回應時間變長，而使用者要的是狀態趕快改好。
    """
    targets = [address for address in to if address]
    if not targets or not is_configured():
        return False
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from}>"
    # 收件人放進 Bcc：同一封通知會寄給多位管理者，用 To 會讓彼此看見對方信箱。
    message["To"] = settings.smtp_from
    message["Bcc"] = ", ".join(targets)
    message.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return True
    except Exception as exc:
        log_exception("notifications.send", exc)
        return False


def _body(label: str, doc_no: str, previous: str, current: str, org_name: str) -> str:
    # 內容刻意只有狀態，不含金額、聯絡人或任何健康資料；細節請登入系統查看。
    return (
        f"{org_name} 您好：\n\n"
        f"您的{label} {doc_no} 狀態已更新。\n\n"
        f"　原狀態：{previous}\n"
        f"　新狀態：{current}\n\n"
        f"詳細內容請登入 REIBI 健康自主管理平台查看。\n"
        f"本信由系統自動發送，請勿直接回覆。\n"
    )


def notify_status_change(
    client: Any,
    *,
    org_code: Optional[str],
    org_name: str,
    label: str,
    doc_no: str,
    previous: str,
    current: str,
) -> dict[str, Any]:
    """通知企業管理者某份文件的狀態變更。

    回傳結果供呼叫端放進 API 回應，讓操作者看得到「通知有沒有寄出去」——
    靜靜地失敗會讓人以為客戶已經知道了。
    """
    if not is_configured():
        return {"configured": False, "sent": False, "recipients": 0}
    people = recipients_for_org(client, org_code)
    if not people:
        return {"configured": True, "sent": False, "recipients": 0, "reason": "此企業沒有可通知的管理者帳號"}
    sent = send_email(
        [person["email"] for person in people],
        f"[REIBI] {label} {doc_no} 狀態更新為「{current}」",
        _body(label, doc_no, previous, current, org_name),
    )
    return {"configured": True, "sent": sent, "recipients": len(people)}
