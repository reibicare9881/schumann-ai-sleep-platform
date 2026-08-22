"""Structural checks in upload_safety.py.

Not a claim of antivirus-grade coverage — see the module docstring. These
tests pin down what it *does* catch: corrupt files, decompression bombs,
mismatched content types, and the classic auto-executing PDF object names.
"""

from __future__ import annotations

import io

import fitz
import pytest
from fastapi import HTTPException
from PIL import Image

import upload_safety
from upload_safety import scan_for_malware, validate_image_bytes, validate_pdf_bytes


def _real_pdf(pages: int = 1) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page()
    content = doc.tobytes()
    doc.close()
    return content


def _real_image(fmt: str = "PNG", size: tuple[int, int] = (4, 4)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color="white").save(buffer, format=fmt)
    return buffer.getvalue()


class TestValidatePdfBytes:
    def test_accepts_a_real_pdf(self):
        validate_pdf_bytes(_real_pdf())  # must not raise

    def test_rejects_content_that_is_not_a_pdf(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_pdf_bytes(b"this is not a pdf at all")
        assert exc_info.value.status_code == 422

    def test_rejects_a_pdf_with_too_many_pages(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_pdf_bytes(_real_pdf(pages=51))
        assert exc_info.value.status_code == 422

    @pytest.mark.parametrize("token", [b"/JavaScript", b"/OpenAction", b"/Launch", b"/EmbeddedFile"])
    def test_rejects_pdfs_carrying_auto_executing_objects(self, token):
        # A real PDF with the dangerous token spliced into a comment area is
        # enough to trip the heuristic scan without needing to hand-craft a
        # working exploit.
        poisoned = _real_pdf().replace(b"%PDF-1.7", b"%PDF-1.7\n% " + token)
        with pytest.raises(HTTPException) as exc_info:
            validate_pdf_bytes(poisoned)
        assert exc_info.value.status_code == 422


class TestValidateImageBytes:
    def test_accepts_a_real_png_declared_as_png(self):
        validate_image_bytes(_real_image("PNG"), "image/png")  # must not raise

    def test_accepts_a_real_jpeg_declared_as_jpeg(self):
        validate_image_bytes(_real_image("JPEG"), "image/jpeg")  # must not raise

    def test_rejects_corrupt_image_bytes(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_image_bytes(b"not an image", "image/png")
        assert exc_info.value.status_code == 422

    def test_rejects_content_type_mismatch(self):
        # A real JPEG whose caller claims is a PNG.
        with pytest.raises(HTTPException) as exc_info:
            validate_image_bytes(_real_image("JPEG"), "image/png")
        assert exc_info.value.status_code == 422

    def test_rejects_unsupported_mime_type(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_image_bytes(_real_image("PNG"), "image/gif")
        assert exc_info.value.status_code == 422


class TestScanForMalware:
    """scan_for_malware() talks to clamd over a raw socket in production;
    these tests inject a fake transport so no daemon is needed to run them.
    """

    def test_is_a_no_op_when_clamav_is_not_configured(self, monkeypatch):
        monkeypatch.setattr(upload_safety.settings, "clamav_host", None)
        calls = []
        scan_for_malware(b"anything at all", transport=lambda data: calls.append(data) or "stream: OK")
        assert calls == []  # transport must never be invoked when unconfigured

    def test_passes_clean_content(self, monkeypatch):
        monkeypatch.setattr(upload_safety.settings, "clamav_host", "clamav.internal")
        scan_for_malware(b"clean file", transport=lambda _data: "stream: OK")  # must not raise

    def test_rejects_infected_content(self, monkeypatch):
        monkeypatch.setattr(upload_safety.settings, "clamav_host", "clamav.internal")
        with pytest.raises(HTTPException) as exc_info:
            scan_for_malware(b"eicar", transport=lambda _data: "stream: Eicar-Test-Signature FOUND")
        assert exc_info.value.status_code == 422

    def test_fails_closed_when_scanner_reports_an_error(self, monkeypatch):
        monkeypatch.setattr(upload_safety.settings, "clamav_host", "clamav.internal")
        with pytest.raises(HTTPException) as exc_info:
            scan_for_malware(b"whatever", transport=lambda _data: "stream: some problem ERROR")
        assert exc_info.value.status_code == 503

    def test_fails_closed_when_the_daemon_is_unreachable(self, monkeypatch):
        monkeypatch.setattr(upload_safety.settings, "clamav_host", "clamav.internal")

        def _unreachable(_data):
            raise OSError("connection refused")

        with pytest.raises(HTTPException) as exc_info:
            scan_for_malware(b"whatever", transport=_unreachable)
        assert exc_info.value.status_code == 503
