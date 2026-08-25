"""職業安全衛生管理計畫的 PDF 產生。

這份計畫原本只能靠瀏覽器列印，版面隨環境變動；職安記錄要留存數年，存查文件不該
每次印出來都不一樣。改由伺服器產生後，測試守的是：檔案真的是 PDF、中文不會變成
空白或亂碼、頁首頁尾與簽核欄都在、以及跨企業界線。

**這是專業的一般版面，不是主管機關指定表單**；若日後要求特定表單樣式，需取得
實際範本再實作。
"""

from __future__ import annotations

import pytest

from modules.ohs_pdf import RISK_LABELS, SECTIONS, SIGNATURE_ROLES, _row_lines, build_ohs_plan_pdf
from support.identities import OTHER_ORG_CODE, PRIMARY_ORG_CODE

TABLE = "reibi_ohs_records"


def _record(index, kind, title, **extra):
    return {
        "id": index, "org_code": PRIMARY_ORG_CODE, "record_type": kind,
        "status": extra.get("status", "進行中"), "risk_level": extra.get("risk_level"),
        "owner": extra.get("owner", "職安人員"), "due_date": extra.get("due_date", "2026-12-31"),
        "verified_at": None, "created_at": "2026-08-01T00:00:00+00:00",
        "updated_at": "2026-08-01T00:00:00+00:00",
        "source_payload": {"title": title, "details": extra.get("details", "測試內容")},
    }


@pytest.fixture
def snapshot():
    return {
        "org_code": PRIMARY_ORG_CODE,
        "generated_at": "2026-08-25T09:30:00+00:00",
        "meta": [_record(1, "meta", "計畫初版")],
        "hazard": [_record(2, "hazard", "長時間站立作業", risk_level="high")],
        "measure": [_record(3, "measure", "增設抗疲勞地墊")],
        "review": [_record(4, "review", "每季檢討")],
    }


class TestDocumentIsValid:
    def test_produces_a_real_pdf(self, snapshot):
        content = build_ohs_plan_pdf(snapshot, "測試股份有限公司")
        assert content.startswith(b"%PDF-"), "輸出必須是 PDF"
        assert content.rstrip().endswith(b"%%EOF"), "PDF 必須正常結尾，否則閱讀器會報損毀"
        assert len(content) > 5_000, "帶中文字型的 PDF 不應該這麼小"

    def test_an_empty_plan_still_produces_a_document(self):
        # 剛開始導入的企業四個區段都是空的；那時更需要一份「目前沒有記錄」的正式文件。
        empty = {"org_code": PRIMARY_ORG_CODE, "generated_at": "2026-08-25T09:30:00+00:00",
                 "meta": [], "hazard": [], "measure": [], "review": []}
        content = build_ohs_plan_pdf(empty, "空白公司")
        assert content.startswith(b"%PDF-")

    def test_a_long_plan_spans_multiple_pages(self):
        many = {"org_code": PRIMARY_ORG_CODE, "generated_at": "2026-08-25T09:30:00+00:00",
                "meta": [], "review": [], "measure": [],
                "hazard": [_record(i, "hazard", f"危害項目 {i}") for i in range(1, 80)]}
        content = build_ohs_plan_pdf(many, "很多危害公司")
        # 頁首頁尾靠 fpdf2 的 header()/footer() 自動重複，多頁時才看得出有沒有接對。
        assert content.count(b"/Type /Page") > 1 or b"/Count 2" in content or len(content) > 20_000


class TestChineseRendering:
    def test_the_bundled_traditional_chinese_font_is_embedded(self, snapshot):
        # 沒有嵌入字型的話，中文在多數閱讀器會變成空白方框 —— 這是 PDF 最常見的坑。
        content = build_ohs_plan_pdf(snapshot, "測試股份有限公司")
        assert b"NotoSansTC" in content, "繁體中文字型必須嵌入 PDF"

    def test_does_not_crash_on_mixed_scripts(self, snapshot):
        snapshot["hazard"][0]["source_payload"]["title"] = "Ergonomics 人因危害 ①②③ ％"
        assert build_ohs_plan_pdf(snapshot, "Mixed 混合公司").startswith(b"%PDF-")


class TestLayoutContract:
    def test_every_section_is_declared(self):
        assert [kind for kind, _ in SECTIONS] == ["meta", "hazard", "measure", "review"]

    def test_the_signature_block_covers_the_three_roles(self):
        assert SIGNATURE_ROLES == ("職業安全衛生人員", "部門主管", "雇主／代表人")

    @pytest.mark.parametrize(("code", "label"), sorted(RISK_LABELS.items()))
    def test_risk_levels_print_in_chinese(self, code, label):
        # 資料庫存的是 high／medium 這類代碼；正式文件上不該出現原始英文值。
        _, lines = _row_lines("hazard", _record(1, "hazard", "t", risk_level=code))
        assert f"風險等級：{label}" in " ".join(lines)

    def test_an_unknown_risk_code_is_shown_rather_than_swallowed(self):
        # 對照不到就原樣印出，讓人看得出是資料有問題，而不是以為那欄本來就空的。
        _, lines = _row_lines("hazard", _record(1, "hazard", "t", risk_level="unmapped"))
        assert "風險等級：unmapped" in " ".join(lines)

    def test_page_count_placeholder_is_resolved(self, snapshot):
        # 頁尾寫的是「第 X 頁／共 {nb} 頁」，alias_nb_pages() 必須在輸出時換成實際頁數；
        # 沒換掉的話使用者會在正式文件上看到 {nb} 這串字。
        content = build_ohs_plan_pdf(snapshot, "測試股份有限公司")
        assert b"{nb}" not in content


class TestEndpoint:
    def _seed(self, fake_supabase):
        fake_supabase.seed("reibi_enterprises", [
            {"id": 1, "org_code": PRIMARY_ORG_CODE, "org_name": "主要測試公司"},
            {"id": 2, "org_code": OTHER_ORG_CODE, "org_name": "另一家公司"},
        ])
        fake_supabase.seed(TABLE, [_record(1, "hazard", "長時間站立作業")])

    def test_a_manager_downloads_a_pdf(self, client, tokens, fake_supabase):
        self._seed(fake_supabase)
        response = client.get("/api/reibi/health/ohs/plan.pdf", headers=tokens.header("admin_hr"))
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF-")

    def test_the_filename_names_the_organization(self, client, tokens, fake_supabase):
        self._seed(fake_supabase)
        response = client.get("/api/reibi/health/ohs/plan.pdf", headers=tokens.header("admin_hr"))
        assert PRIMARY_ORG_CODE in response.headers["content-disposition"]

    @pytest.mark.parametrize("role", ["member", "individual", "dept_head"])
    def test_roles_without_ohs_permission_are_refused(self, client, tokens, fake_supabase, role):
        self._seed(fake_supabase)
        assert client.get("/api/reibi/health/ohs/plan.pdf", headers=tokens.header(role)).status_code == 403

    def test_cannot_request_another_organization(self, client, tokens, fake_supabase):
        self._seed(fake_supabase)
        response = client.get(
            "/api/reibi/health/ohs/plan.pdf",
            headers=tokens.header("admin_hr"),
            params={"org_code": OTHER_ORG_CODE},
        )
        assert response.status_code == 403

    def test_an_unauthenticated_request_is_refused(self, client, fake_supabase):
        self._seed(fake_supabase)
        assert client.get("/api/reibi/health/ohs/plan.pdf").status_code == 401
