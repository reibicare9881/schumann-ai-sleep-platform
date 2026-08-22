"""Structural validation, plus optional ClamAV scanning, for uploaded files.

The structural checks (validate_pdf_bytes / validate_image_bytes) are not
antivirus — they can't catch a payload smuggled inside a compressed PDF
stream or a byte-for-byte crafted exploit. They target the class of attack
aimed at our own parsers: corrupt or oversized files, decompression bombs,
and PDFs carrying auto-executing actions.

scan_for_malware() is real signature-based scanning against a clamd daemon,
but it's opt-in: with no CLAMAV_HOST configured it's a no-op, so this module
behaves the same whether or not clamd has been provisioned. See
docs/reibi-clamav-setup.md for what deploying clamd actually requires.

Every endpoint that accepts a file should run its bytes through the
structural check, then scan_for_malware(), before handing them to a parser
or AI model.
"""

from __future__ import annotations

import io
import socket
import struct
from typing import Callable

import fitz
from fastapi import HTTPException
from PIL import Image

from config import settings

MAX_PDF_PAGES = 50

# Object names that make a PDF viewer/parser *do* something on open, rather
# than just render content. A legitimate device-generated report never needs
# any of these.
_DANGEROUS_PDF_TOKENS = (
    b"/JavaScript", b"/JS", b"/OpenAction", b"/Launch",
    b"/EmbeddedFile", b"/RichMedia", b"/AA", b"/SubmitForm",
    b"/GoToE", b"/GoToR",
)

_IMAGE_FORMATS = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def validate_pdf_bytes(content: bytes) -> None:
    for token in _DANGEROUS_PDF_TOKENS:
        if token in content:
            raise HTTPException(status_code=422, detail="PDF 含有不允許的自動執行內容")
    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as exc:
        raise HTTPException(status_code=422, detail="PDF 檔案已損毀或格式不正確") from exc
    try:
        if doc.page_count < 1 or doc.page_count > MAX_PDF_PAGES:
            raise HTTPException(status_code=422, detail="PDF 頁數超出允許範圍")
    finally:
        doc.close()


def validate_image_bytes(content: bytes, mime_type: str) -> None:
    expected_format = _IMAGE_FORMATS.get(mime_type)
    if expected_format is None:
        raise HTTPException(status_code=422, detail="不支援的圖片格式")
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.load()  # 強制完整解碼；同時觸發 Pillow 內建的解壓縮炸彈防護
            actual_format = image.format
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail="圖片檔案已損毀、過大或不是有效的圖片") from exc
    if actual_format != expected_format:
        raise HTTPException(status_code=422, detail="圖片內容與宣稱的格式不符")


def _clamd_instream(content: bytes, host: str, port: int, *, timeout: float = 15.0) -> str:
    """Speak clamd's INSTREAM protocol directly; no client library needed."""
    chunk_size = 1024 * 1024
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(b"zINSTREAM\0")
        for offset in range(0, len(content), chunk_size):
            chunk = content[offset:offset + chunk_size]
            sock.sendall(struct.pack("!L", len(chunk)) + chunk)
        sock.sendall(struct.pack("!L", 0))
        response = bytearray()
        while True:
            data = sock.recv(4096)
            if not data:
                break
            response += data
    return response.decode("utf-8", errors="replace").strip("\0").strip()


def scan_for_malware(content: bytes, *, transport: Callable[[bytes], str] | None = None) -> None:
    """Scan against clamd if CLAMAV_HOST is configured; no-op otherwise.

    A configured-but-unreachable scanner fails closed (503) — once an
    operator has turned this on, a silent skip would be worse than an
    honest "try again later".
    """
    host = settings.clamav_host
    if not host:
        return
    call = transport or (lambda data: _clamd_instream(data, host, settings.clamav_port))
    try:
        result = call(content)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="病毒掃描服務暫時無法使用，請稍後再試") from exc
    if result.endswith("ERROR"):
        raise HTTPException(status_code=503, detail="病毒掃描服務暫時無法使用，請稍後再試")
    if "FOUND" in result:
        raise HTTPException(status_code=422, detail="檔案未通過安全掃描")
