"""金流與生命週期操作的稽核軌跡（FND-06）。

`audit_logs` 表與寫入函式早就存在，但只有部門管理在用。報價、合約、工單、
分潤、訂閱 —— 尤其是碰錢的那些 —— 完全沒有記錄。要回答「這筆分潤是誰、
在什麼時候確認匯款的」，資料庫裡查不到。

這些測試釘住三件事：碰錢的操作一定留下軌跡、稽核失敗不得回滾業務寫入、
以及 detail 不會把個資抄進另一張表。
"""

from __future__ import annotations

import pytest

import reibi_audit
from reibi_audit import record


class _Boom:
    """一個 insert 一定失敗的假 client，用來驗證稽核失敗不會往上炸。"""

    def table(self, _name):
        return self

    def insert(self, _payload):
        return self

    def execute(self):
        raise RuntimeError("audit table unavailable")


class TestRecord:
    def test_a_row_is_written_with_actor_action_and_detail(self, fake_supabase):
        record(fake_supabase, {"uid": "u1", "org_code": "ORG1", "role": "reibi_super"},
               reibi_audit.ACTION_COMMISSION_PAID, "分潤 #42 標記已匯款")
        row = fake_supabase.tables["audit_logs"][0]
        assert row["user_id"] == "u1"
        assert row["action"] == reibi_audit.ACTION_COMMISSION_PAID
        assert "#42" in row["detail"]
        assert row["role_at_time"] == "reibi_super"

    def test_the_org_code_can_be_overridden(self, fake_supabase):
        # 分潤記在經銷商的 org_code 上，而不是操作者（超管）的。
        record(fake_supabase, {"uid": "u1", "org_code": "REIBI"}, "x", "detail", org_code="DIST01")
        assert fake_supabase.tables["audit_logs"][0]["org_code"] == "DIST01"

    def test_the_actor_org_code_is_used_by_default(self, fake_supabase):
        record(fake_supabase, {"uid": "u1", "org_code": "ORG1"}, "x", "detail")
        assert fake_supabase.tables["audit_logs"][0]["org_code"] == "ORG1"

    def test_detail_is_redacted_before_storage(self, fake_supabase):
        # 稽核記的是「誰對哪筆單做了什麼」，不該把健康資料抄進另一張表。
        record(fake_supabase, {"uid": "u1"}, "x", "sleep_score: 21 for patient@example.com")
        detail = fake_supabase.tables["audit_logs"][0]["detail"]
        assert "21" not in detail
        assert "patient@example.com" not in detail

    def test_an_audit_failure_never_propagates(self):
        # 沒記到 log 是遺憾；把已完成的分潤匯款倒回去是災難。
        record(_Boom(), {"uid": "u1"}, "x", "detail")  # 不應拋出

    def test_every_action_constant_is_namespaced(self):
        actions = [value for name, value in vars(reibi_audit).items() if name.startswith("ACTION_")]
        assert actions, "沒有定義任何動作代碼"
        assert all("." in action for action in actions), "動作代碼應為 域.動作 格式"

    def test_action_constants_are_unique(self):
        actions = [value for name, value in vars(reibi_audit).items() if name.startswith("ACTION_")]
        assert len(actions) == len(set(actions))


class TestMoneyOperationsAreAudited:
    """碰錢的端點一定要留下軌跡 —— 這是稽核的硬需求，不是加分項。"""

    @pytest.fixture
    def seeded(self, fake_supabase):
        from support.identities import PRIMARY_ORG_CODE

        fake_supabase.seed("reibi_enterprises", [
            {"id": 1, "org_code": PRIMARY_ORG_CODE, "org_name": "測試企業", "status": "active"},
        ])
        return fake_supabase

    def test_marking_a_commission_paid_is_recorded(self, client, tokens, seeded):
        seeded.seed("reibi_commission_ledger", [
            {"id": 7, "distributor_id": 1, "status": "已確認待匯款", "total_commission": 120000},
        ])
        response = client.post("/api/reibi/commissions/ledger/7/paid", headers=tokens.header("reibi_super"))
        assert response.status_code == 200
        rows = seeded.tables.get("audit_logs", [])
        assert any(row["action"] == reibi_audit.ACTION_COMMISSION_PAID for row in rows)

    def test_an_invoice_status_change_is_recorded(self, client, tokens, seeded):
        seeded.seed("reibi_invoices", [{"id": 3, "enterprise_id": 1, "status": "草稿"}])
        response = client.patch("/api/reibi/finance/invoices/3/status",
                                headers=tokens.header("reibi_super"), json={"status": "已開票"})
        assert response.status_code == 200
        rows = seeded.tables.get("audit_logs", [])
        entry = next(row for row in rows if row["action"] == reibi_audit.ACTION_INVOICE_STATUS)
        # 前後狀態都要留下，否則看不出改了什麼。
        assert "草稿" in entry["detail"] and "已開票" in entry["detail"]

    def test_a_document_status_transition_is_recorded(self, client, tokens, seeded):
        seeded.seed("reibi_quotes", [
            {"id": 5, "enterprise_id": 1, "doc_no": "Q-2608-001", "status": "草稿", "versions": []},
        ])
        response = client.patch("/api/reibi/quotes/5/status",
                                headers=tokens.header("admin"), json={"status": "已發送"})
        assert response.status_code == 200
        rows = seeded.tables.get("audit_logs", [])
        entry = next(row for row in rows if row["action"] == reibi_audit.ACTION_QUOTE_STATUS)
        assert "Q-2608-001" in entry["detail"]

    def test_a_failed_transition_leaves_no_audit_row(self, client, tokens, seeded):
        # 沒有發生的事不該留下紀錄。
        seeded.seed("reibi_quotes", [
            {"id": 6, "enterprise_id": 1, "doc_no": "Q-2608-002", "status": "草稿", "versions": []},
        ])
        response = client.patch("/api/reibi/quotes/6/status",
                                headers=tokens.header("admin"), json={"status": "已轉合約"})
        assert response.status_code == 409
        assert seeded.tables.get("audit_logs", []) == []
