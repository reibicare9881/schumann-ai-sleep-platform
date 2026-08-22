"""集中式稽核記錄（FND-06）。

`audit_logs` 表與一個寫入函式早就存在，但只有部門管理（reibi_batch_f）在用。
報價、合約、工單、分潤、訂閱的寫入 —— 尤其是碰錢的那些 —— 全都沒有記錄。
現在若有人問「這筆分潤是誰、在什麼時候確認匯款的」，資料庫裡查不到答案。

這個模組把記錄集中成一個函式，讓所有狀態變更與金額相關的操作都留下軌跡。

兩個刻意的設計：

* **稽核寫入失敗不得回滾業務寫入。** 沒記到 log 是遺憾，把已完成的分潤匯款倒回去
  是災難。失敗只記進應用 log（且經 safe_logging 遮蔽），不向上拋。
* **detail 一律先遮蔽。** 稽核記的是「誰對哪筆單做了什麼」，不需要、也不該把
  健康資料或憑證抄進另一張表。
"""

from __future__ import annotations

from typing import Any, Optional

from safe_logging import log_exception, redact

# 金流與生命週期相關的動作代碼。集中定義，避免各處寫成不一致的字串，
# 日後要依動作查詢或告警才有穩定的鍵。
ACTION_QUOTE_CREATE = "quote.create"
ACTION_QUOTE_UPDATE = "quote.update"
ACTION_QUOTE_STATUS = "quote.status"
ACTION_QUOTE_CONVERT = "quote.convert"
ACTION_CONTRACT_STATUS = "contract.status"
ACTION_CONTRACT_EXECUTION = "contract.execution"
ACTION_WORKORDER_STATUS = "workorder.status"
ACTION_WORKORDER_ACCEPT = "workorder.accept"
ACTION_INVOICE_STATUS = "invoice.status"
ACTION_REMITTANCE_RECONCILE = "remittance.reconcile"
ACTION_COMMISSION_CONFIRM = "commission.confirm"
ACTION_COMMISSION_PAID = "commission.paid"
ACTION_SUBSCRIPTION_REVIEW = "subscription.review"
ACTION_SUBSCRIPTION_REISSUE = "subscription.reissue"


def record(
    client: Any,
    user: dict[str, Any],
    action: str,
    detail: str,
    *,
    org_code: Optional[str] = None,
) -> None:
    """寫一筆稽核紀錄。永不因失敗而中斷呼叫端。

    `detail` 應該是「對哪筆單做了什麼」的摘要（例如 "分潤 #42 標記已匯款，NT$120,000"），
    不是完整的資料列 —— 但仍先經遮蔽，以防金額以外的欄位夾帶個資。
    """
    try:
        client.table("audit_logs").insert({
            "user_id": user.get("uid"),
            "org_code": org_code if org_code is not None else user.get("org_code"),
            "action": action,
            "detail": redact(detail),
            "role_at_time": user.get("role"),
        }).execute()
    except Exception as exc:  # noqa: BLE001 — 見模組 docstring：稽核失敗不回滾業務寫入
        log_exception(f"audit.{action}", exc)
