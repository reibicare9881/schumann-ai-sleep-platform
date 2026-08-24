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

from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from roles import has_permission
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


def create_reibi_audit_router(client: Any) -> APIRouter:
    """稽核紀錄的讀取端。

    在此之前，七個寫入點一直在累積資料，卻沒有任何介面能看 —— 連 `reibi_super`
    都看不到。同時 `admin_it`（IT 管理者）在 L5 手冊上被公告擁有「資安稽核紀錄檢視」，
    但全站沒有對應端點，那個角色實際上只剩服務申請可用（見 test_permission_registry_drift）。
    這支端點把兩件事一起收掉：讓已收集的資料看得到，也讓那個承諾成真。

    範圍規則是這裡最要緊的部分：`audit_logs` 是跨企業共用一張表，稽核內容又正好是
    「誰對哪筆單做了什麼」，一旦漏掉範圍限制就是直接的跨組織外洩。因此企業角色
    **一律**只能讀到自己的 `org_code`，帶了別家的代碼會被拒絕而不是被安靜忽略 ——
    安靜忽略會讓呼叫端以為自己看到的是別家資料。
    """
    router = APIRouter(prefix="/api/reibi", tags=["REIBI Audit"])

    @router.get("/audit")
    def list_audit(
        page: int = Query(1, ge=1),
        size: int = Query(50, ge=1, le=200),
        action: Optional[str] = Query(None, max_length=100),
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        org_code: Optional[str] = Query(None, max_length=64),
        current_user: dict = Depends(get_current_user),
    ):
        if not has_permission(current_user, "security_audit"):
            raise HTTPException(status_code=403, detail="權限不足：限具資安稽核權限的角色")

        # reibi_super 持有 "all"，但同時也**沒有** org_code；其餘角色一律綁自己的企業。
        is_platform = current_user.get("role") == "reibi_super"
        caller_org = str(current_user.get("org_code") or "").upper()
        requested_org = org_code.upper() if org_code else None

        if is_platform:
            target_org = requested_org  # None 代表跨企業檢視
        else:
            if not caller_org:
                raise HTTPException(status_code=403, detail="此帳號沒有企業歸屬，無法檢視稽核紀錄")
            if requested_org and requested_org != caller_org:
                raise HTTPException(status_code=403, detail="不可檢視其他企業的稽核紀錄")
            target_org = caller_org

        query = client.table("audit_logs").select("id,user_id,org_code,action,detail,role_at_time,created_at")
        if target_org:
            query = query.eq("org_code", target_org)
        if action:
            query = query.eq("action", action)
        if date_from:
            query = query.gte("created_at", date_from.isoformat())
        if date_to:
            # date_to 當成「含當天」：使用者輸入的是日期，不是時間戳。
            query = query.lt("created_at", f"{date_to.isoformat()}T23:59:59.999999+00:00")

        # 多取一筆判斷還有沒有下一頁，避免為了分頁再打一次 count 查詢。
        offset = (page - 1) * size
        rows = query.order("created_at", desc=True).range(offset, offset + size).execute().data or []
        has_more = len(rows) > size
        rows = rows[:size]

        return {
            "status": "success",
            "data": {
                "rows": rows,
                "page": page,
                "size": size,
                "has_more": has_more,
                "org_code": target_org,
                "actions": sorted(AUDIT_ACTION_CATALOG),
            },
        }

    return router


# 供前端做動作篩選下拉；集中在這裡才不會前後端各維護一份會脫節的清單。
AUDIT_ACTION_CATALOG = (
    ACTION_QUOTE_CREATE, ACTION_QUOTE_UPDATE, ACTION_QUOTE_STATUS, ACTION_QUOTE_CONVERT,
    ACTION_CONTRACT_STATUS, ACTION_CONTRACT_EXECUTION,
    ACTION_WORKORDER_STATUS, ACTION_WORKORDER_ACCEPT,
    ACTION_INVOICE_STATUS, ACTION_REMITTANCE_RECONCILE,
    ACTION_COMMISSION_CONFIRM, ACTION_COMMISSION_PAID,
    ACTION_SUBSCRIPTION_REVIEW, ACTION_SUBSCRIPTION_REISSUE,
)
