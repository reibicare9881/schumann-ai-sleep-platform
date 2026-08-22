"""Upload validation for /api/analyze (Schumann report PDF).

This endpoint used to accept any file the browser claimed was a PDF, with no
size cap, no content-type check, and a storage path built from the client's
own filename. These tests pin down the rejection paths added to close that
gap; the happy path (Gemini + PDF parsing) has no test harness in this suite
and is out of scope here.
"""

from __future__ import annotations

from support.identities import uid_for

INDIVIDUAL_UID = uid_for("individual", "primary")


def _headers(tokens):
    return tokens.header("individual")


class TestAnalyzeUploadValidation:
    def test_rejects_non_pdf_content_type(self, client, tokens):
        response = client.post(
            "/api/analyze",
            headers=_headers(tokens),
            data={"user_id": INDIVIDUAL_UID},
            files={"file": ("report.txt", b"not a pdf", "text/plain")},
        )
        assert response.status_code == 422

    def test_rejects_oversized_file(self, client, tokens):
        oversized = b"0" * (10 * 1024 * 1024 + 1)
        response = client.post(
            "/api/analyze",
            headers=_headers(tokens),
            data={"user_id": INDIVIDUAL_UID},
            files={"file": ("report.pdf", oversized, "application/pdf")},
        )
        assert response.status_code == 422

    def test_rejects_empty_file(self, client, tokens):
        response = client.post(
            "/api/analyze",
            headers=_headers(tokens),
            data={"user_id": INDIVIDUAL_UID},
            files={"file": ("report.pdf", b"", "application/pdf")},
        )
        assert response.status_code == 422

    def test_rejects_content_that_is_not_actually_a_pdf(self, client, tokens):
        # Declared as application/pdf and under the size cap, but the bytes
        # aren't a real PDF — structural validation should catch this before
        # it ever reaches the parser.
        response = client.post(
            "/api/analyze",
            headers=_headers(tokens),
            data={"user_id": INDIVIDUAL_UID},
            files={"file": ("report.pdf", b"not actually a pdf", "application/pdf")},
        )
        assert response.status_code == 422

    def test_still_rejects_uploading_for_someone_else(self, client, tokens):
        response = client.post(
            "/api/analyze",
            headers=_headers(tokens),
            data={"user_id": "someone-else"},
            files={"file": ("report.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert response.status_code == 403
