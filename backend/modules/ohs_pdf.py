"""職業安全衛生管理計畫的 PDF 產生。

在此之前這份計畫只能靠瀏覽器 `window.print()` 輸出，版面會隨瀏覽器與印表機設定
變動，同一份計畫不同人印出來不一樣 —— 職安記錄依規定要留存數年，不適合用這種
每次都可能不同的方式產生。改由伺服器產出固定版面：頁首抬頭、頁尾頁碼與產生時間、
末頁簽核欄。

**這份版面是「專業的一般格式」，不是主管機關指定表單**（2026-08-25 確認的範圍）。
若日後需要符合勞動部特定指引的表單樣式，必須取得該表單的實際範本再另行實作 ——
憑印象生成一份格式錯誤的法規文件，比沒有更糟。
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from fpdf import FPDF

SECTIONS = (
    ("meta", "一、計畫版本紀錄"),
    ("hazard", "二、危害辨識"),
    ("measure", "三、改善措施"),
    ("review", "四、定期檢討"),
)

SIGNATURE_ROLES = ("職業安全衛生人員", "部門主管", "雇主／代表人")

# 風險等級在資料庫是英文代碼（見 reibi_batch_d.RISK_MATRIX）。正式文件上不該出現
# high／medium 這種原始值，但也不能因為對照不到就整個吞掉 —— 未知代碼原樣印出，
# 讓人看得出是資料有問題，而不是以為那一欄本來就空的。
RISK_LABELS = {"extreme": "極高", "high": "高", "medium": "中", "low": "低"}


def _font_path() -> Optional[str]:
    path = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "NotoSansTC-Regular.ttf")
    return path if os.path.exists(path) else None


class _PlanPdf(FPDF):
    """帶頁首頁尾的 A4 文件。

    fpdf2 會在每次換頁時自動呼叫 header()／footer()，所以抬頭與頁碼不需要在
    內容邏輯裡重複處理 —— 內容再長、跨多少頁都會一致。
    """

    def __init__(self, org_name: str, org_code: str, generated_at: str, font: str):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.org_name = org_name
        self.org_code = org_code
        self.generated_at = generated_at
        self.font_name = font
        self.set_auto_page_break(auto=True, margin=20)

    def header(self) -> None:
        self.set_font(self.font_name, "", 9)
        self.set_text_color(110, 110, 110)
        self.cell(0, 5, f"{self.org_name}（{self.org_code}）", align="L")
        self.cell(0, 5, "REIBI 健康自主管理平台", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(200, 200, 200)
        self.line(self.l_margin, self.get_y() + 1, self.w - self.r_margin, self.get_y() + 1)
        self.ln(5)
        self.set_text_color(0, 0, 0)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font(self.font_name, "", 8)
        self.set_text_color(130, 130, 130)
        self.cell(0, 5, f"產生時間：{self.generated_at}", align="L")
        # {nb} 由 alias_nb_pages() 在輸出時替換成總頁數。
        self.cell(0, 5, f"第 {self.page_no()} 頁／共 {{nb}} 頁", align="R")
        self.set_text_color(0, 0, 0)


def _row_lines(kind: str, row: dict[str, Any]) -> tuple[str, list[str]]:
    payload = row.get("source_payload") if isinstance(row.get("source_payload"), dict) else {}
    title = str(payload.get("title") or payload.get("employee_key") or f"{kind} #{row.get('id', '')}").strip()
    lines: list[str] = []
    detail = payload.get("details") or payload.get("action")
    if detail:
        lines.append(str(detail))
    meta: list[str] = []
    if row.get("risk_level"):
        code = str(row["risk_level"])
        meta.append(f"風險等級：{RISK_LABELS.get(code, code)}")
    if row.get("status"):
        meta.append(f"狀態：{row['status']}")
    if row.get("owner"):
        meta.append(f"負責人：{row['owner']}")
    if row.get("due_date"):
        meta.append(f"期限：{str(row['due_date'])[:10]}")
    if payload.get("version"):
        meta.append(f"版本：{payload['version']}")
    if meta:
        lines.append("　".join(meta))
    return title, lines


def build_ohs_plan_pdf(snapshot: dict[str, Any], org_name: str) -> bytes:
    """把 /ohs/plan/snapshot 的內容排成 PDF。"""
    org_code = str(snapshot.get("org_code") or "")
    raw_generated = str(snapshot.get("generated_at") or datetime.now(timezone.utc).isoformat())
    generated_at = raw_generated[:16].replace("T", " ")

    font_path = _font_path()
    font_name = "NotoSansTC" if font_path else "Helvetica"

    pdf = _PlanPdf(org_name or org_code, org_code, generated_at, font_name)
    if font_path:
        pdf.add_font(font_name, "", font_path)
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.set_font(font_name, "", 18)
    pdf.multi_cell(0, 10, "職業安全衛生管理計畫", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    for kind, label in SECTIONS:
        rows = snapshot.get(kind) or []
        pdf.set_font(font_name, "", 13)
        pdf.set_fill_color(238, 244, 243)
        pdf.multi_cell(0, 8, f" {label}（{len(rows)} 筆）", fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

        if not rows:
            pdf.set_font(font_name, "", 10)
            pdf.set_text_color(130, 130, 130)
            pdf.multi_cell(0, 6, "　本節尚無記錄。", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
        for row in rows:
            title, lines = _row_lines(kind, row)
            pdf.set_font(font_name, "", 11)
            pdf.multi_cell(0, 6, f"　• {title}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font(font_name, "", 9)
            pdf.set_text_color(90, 90, 90)
            for line in lines:
                pdf.multi_cell(0, 5, f"　　{line}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(0, 0, 0)
            pdf.ln(1)
        pdf.ln(4)

    # 簽核欄：留在最後，且不允許被拆到跨頁 —— 半張簽核表沒有意義。
    needed = 44
    if pdf.get_y() + needed > pdf.h - pdf.b_margin:
        pdf.add_page()
    pdf.set_font(font_name, "", 13)
    pdf.multi_cell(0, 8, "五、簽核", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    width = (pdf.w - pdf.l_margin - pdf.r_margin) / len(SIGNATURE_ROLES)
    pdf.set_font(font_name, "", 10)
    for role in SIGNATURE_ROLES:
        pdf.cell(width, 6, role, align="C")
    pdf.ln(20)
    for _ in SIGNATURE_ROLES:
        pdf.cell(width, 6, "簽章：______________", align="C")
    pdf.ln(10)
    for _ in SIGNATURE_ROLES:
        pdf.cell(width, 6, "日期：______________", align="C")

    output = pdf.output()
    return bytes(output)
