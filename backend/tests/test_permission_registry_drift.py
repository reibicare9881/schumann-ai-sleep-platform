"""權限登錄表與實際守門之間的落差。

`roles.py` 的權限有兩個用途，很容易被當成只有一個：

1. **執行**：`has_permission()` 直接檢查權限字串。
2. **公開**：`documented_role_catalog()` 會把權限標籤渲染到 `/reibi/l5/manual` 的角色
   權限表，也就是**對使用者的承諾**。

只有 13 個權限走第一條路，其餘 16 個的能力其實是由角色守門函式（`require_reibi_super`
一類）落實的。這本身沒問題 —— 但一旦某個權限「既沒有 has_permission 檢查、對應端點的
角色守門又不含持有該權限的角色」，手冊就會承諾一個該角色做不到的能力，而且不會有任何
測試失敗。2026-08-22 的複查就抓到兩個這種情況（見下方 KNOWN_UNBACKED）。

這支測試的作用是：**新增權限時必須先分類**，否則測試失敗。分類本身不保證正確，但它
逼人在加權限的當下就回答「這個承諾由誰兌現」，而不是留給日後的稽核去撿。
"""

from __future__ import annotations

import os
import re

import pytest

from roles import ROLE_DEFINITIONS, PERMISSION_LABELS

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 由 has_permission() 直接檢查的權限，掃描原始碼驗證。
# 這一組不需要手動維護內容，只需要維護「它必須非空」的事實。

# 能力由角色守門函式落實，而非 has_permission。值為負責的守門或機制，
# 寫下來是為了讓下一個人不必重新追一遍。
ENFORCED_BY_ROLE_GUARD = {
    "appointments_manage": "require_member_or_above（/api/appointments 系列）",
    "appointments_read": "require_member_or_above（/api/appointments 系列）",
    "distributor_manage": "reibi_api 的經銷商 CRUD 端點守門",
    "identity_manage_all": "require_identity_admin（含 reibi_super）",
    "identity_manage_org": "require_identity_admin（含 admin，並限制在自身 org_code）",
    "org_settings": "reibi_api 的單位設定端點守門",
    "partner_commission": "require_reibi_partner（/partner-portal/summary）",
    "partner_enterprises": "require_reibi_partner（/partner-portal/summary）",
    "partner_finance": "require_reibi_partner（/partner-portal/summary）",
    "partner_subscriptions": "require_reibi_partner + partner_scope_codes 的次級範圍推導",
    "reibi_overview": "/api/reibi/l5/overview 依角色裁切內容",
    "health_self": "個人資料端點的物件層本人檢查（見 test_object_authorization）",
    "submit_org": "評估寫入時的 consent_org_aggregate 旗標，非端點守門",
    # 2026-08-23 決定：維持現狀，不補專屬端點也不改名。
    # admin_hr 想看高風險族群時走的是 /api/org/records（由 org_analytics 守門，該角色也持有），
    # 前端 /highrisk 就是這樣取數的。能力真的存在，只是標籤比實作細一階 ——
    # 屬命名粒度而非權限缺口，不影響任何人能做什麼。
    "high_risk": "org_analytics 的 /api/org/records 涵蓋；標籤粒度較細，非獨立端點",
}

# 已知「有承諾、沒有對應能力」的權限。列在這裡代表**已知且尚未決定怎麼處理**，
# 不是預設可接受 —— 每一項都應該收斂成：補上端點、改守門、或從登錄表移除承諾。
KNOWN_UNBACKED = {
    # security_audit 已於 2026-08-23 收斂：新增 GET /api/reibi/audit，
    # 以 has_permission("security_audit") 守門並強制綁定呼叫者的 org_code。
    # 這正是這支測試的用意 —— 補上端點後，上面那兩條測試會失敗逼人回來更新這裡。
    "message_manage": (
        "reibi_cs（客服）持有，但 /integrations/messages 系列（含 LINE dispatch）"
        "由 require_reibi_super 守門，客服打不進去。手冊承諾與實際守門不一致。"
    ),
}


def _backend_sources() -> str:
    chunks = []
    for dirpath, dirnames, filenames in os.walk(BACKEND):
        dirnames[:] = [d for d in dirnames if d not in {".venv", "__pycache__", ".pytest_cache", "tests"}]
        for name in filenames:
            if name.endswith(".py") and name != "roles.py":
                with open(os.path.join(dirpath, name), encoding="utf-8", errors="replace") as handle:
                    chunks.append(handle.read())
    return "\n".join(chunks)


SOURCES = _backend_sources()
DECLARED = {p for d in ROLE_DEFINITIONS.values() for p in d.permissions} - {"all"}


def _is_checked_in_code(permission: str) -> bool:
    return bool(re.search(r'["\']' + re.escape(permission) + r'["\']', SOURCES))


class TestEveryPermissionIsAccountedFor:
    def test_no_permission_is_left_unclassified(self):
        """新增權限而未分類就會踩到這條。

        分類的目的不是形式，是逼人回答「這個權限對使用者的承諾由誰兌現」。
        """
        classified = set(ENFORCED_BY_ROLE_GUARD) | set(KNOWN_UNBACKED)
        unclassified = sorted(
            p for p in DECLARED
            if not _is_checked_in_code(p) and p not in classified
        )
        assert unclassified == [], (
            "以下權限既沒有 has_permission 檢查，也沒有登記由哪個角色守門落實："
            f"{unclassified}。請補上端點、指出負責的守門，或從 roles.py 移除這個承諾。"
        )

    def test_classifications_do_not_claim_permissions_that_no_longer_exist(self):
        stale = sorted((set(ENFORCED_BY_ROLE_GUARD) | set(KNOWN_UNBACKED)) - DECLARED)
        assert stale == [], f"這些權限已從 roles.py 移除，分類表也該一併清掉：{stale}"

    def test_a_permission_cannot_be_in_both_buckets(self):
        both = sorted(set(ENFORCED_BY_ROLE_GUARD) & set(KNOWN_UNBACKED))
        assert both == [], f"同一個權限不可既有守門又無實作：{both}"

    def test_permissions_checked_in_code_are_not_listed_as_unbacked(self):
        # 若日後補上了端點，KNOWN_UNBACKED 必須同步縮短，否則這份清單會變成謊言。
        contradictory = sorted(p for p in KNOWN_UNBACKED if _is_checked_in_code(p))
        assert contradictory == [], (
            f"這些權限已經在程式碼裡被檢查，不該再列為未實作：{contradictory}"
        )


class TestKnownGaps:
    """把已知落差釘住，避免它們在無人注意時擴大。"""

    def test_the_known_gap_list_does_not_grow_silently(self):
        assert set(KNOWN_UNBACKED) == {"message_manage"}, (
            "已知落差清單變動了。新增代表又出現一個手冊承諾但做不到的能力，"
            "移除代表已經處理完 —— 兩者都應該是有意識的決定並更新文件。"
        )

    @pytest.mark.parametrize("permission", sorted(KNOWN_UNBACKED))
    def test_every_known_gap_still_carries_a_reason(self, permission):
        assert KNOWN_UNBACKED[permission].strip(), f"{permission} 缺少說明"

    def test_admin_it_can_actually_do_what_the_manual_promises(self):
        """2026-08-23 之前這條是反過來寫的 —— 斷言該角色幾乎是空的。

        補上 `GET /api/reibi/audit` 後改成正向斷言：IT 管理者的每一項公告能力
        都要有實際支撐，任何一項退回無實作都會在這裡失敗。
        """
        permissions = set(ROLE_DEFINITIONS["admin_it"].permissions)
        assert permissions == {"security_audit", "service_center"}
        unbacked = {p for p in permissions if not (_is_checked_in_code(p) or p in ENFORCED_BY_ROLE_GUARD)}
        assert unbacked == set(), f"admin_it 又出現做不到的公告能力：{sorted(unbacked)}"


class TestManualPromises:
    def test_every_permission_has_a_label_for_the_manual(self):
        # 手冊直接渲染這些標籤；缺標籤會讓使用者看到原始的權限字串。
        missing = sorted(p for p in DECLARED if p not in PERMISSION_LABELS)
        assert missing == [], f"這些權限沒有中文標籤，會以原始字串出現在 L5 手冊：{missing}"
