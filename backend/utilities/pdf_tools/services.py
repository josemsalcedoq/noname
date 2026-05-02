from __future__ import annotations

import io
import re
import zipfile
from collections.abc import Iterable

import pdfplumber
import pikepdf

PAGE_RANGE_RE = re.compile(r"^\s*(\d+)(?:\s*-\s*(\d+))?\s*$")


class PdfError(Exception):
    pass


def merge_pdfs(streams: list[io.BytesIO]) -> bytes:
    if not streams:
        raise PdfError("no input files")
    output = pikepdf.Pdf.new()
    try:
        for stream in streams:
            stream.seek(0)
            with pikepdf.open(stream) as pdf:
                output.pages.extend(pdf.pages)
        buffer = io.BytesIO()
        output.save(buffer)
        return buffer.getvalue()
    finally:
        output.close()


def split_pdf(stream: io.BytesIO, ranges: str) -> bytes:
    stream.seek(0)
    with pikepdf.open(stream) as source:
        total = len(source.pages)
        groups = parse_ranges(ranges, total)
        if not groups:
            raise PdfError("no valid page ranges")

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for index, pages in enumerate(groups, start=1):
                slice_pdf = pikepdf.Pdf.new()
                try:
                    for page_num in pages:
                        slice_pdf.pages.append(source.pages[page_num - 1])
                    slice_buffer = io.BytesIO()
                    slice_pdf.save(slice_buffer)
                finally:
                    slice_pdf.close()
                label = _range_label(pages)
                zf.writestr(f"part-{index:02d}-{label}.pdf", slice_buffer.getvalue())
        return zip_buffer.getvalue()


def extract_text(stream: io.BytesIO) -> dict:
    stream.seek(0)
    pages: list[str] = []
    try:
        with pdfplumber.open(stream) as pdf:
            for page in pdf.pages:
                pages.append(page.extract_text() or "")
    except Exception as exc:  # noqa: BLE001
        raise PdfError(f"could not parse PDF: {exc}") from exc
    return {
        "pages": pages,
        "text": "\n\n".join(pages),
        "page_count": len(pages),
    }


def ocr_pdf(stream: io.BytesIO, *, languages: str = "eng+spa", dpi: int = 200) -> dict:
    """Run Tesseract OCR on every page rendered as an image.

    Returns text per page. Does not produce a searchable PDF in v1 — that
    requires ocrmypdf or a custom text-overlay step (Phase 2).
    """
    import pypdfium2 as pdfium
    import pytesseract

    stream.seek(0)
    document = pdfium.PdfDocument(stream)
    pages: list[str] = []
    try:
        for index in range(len(document)):
            page = document[index]
            pil_image = page.render(scale=dpi / 72).to_pil()
            text = pytesseract.image_to_string(pil_image, lang=languages)
            pages.append(text.strip())
    finally:
        document.close()
    return {
        "pages": pages,
        "text": "\n\n".join(pages),
        "page_count": len(pages),
        "languages": languages,
    }


def parse_ranges(spec: str, total_pages: int) -> list[list[int]]:
    if not spec.strip():
        return []
    groups: list[list[int]] = []
    for part in spec.split(","):
        match = PAGE_RANGE_RE.match(part)
        if not match:
            raise PdfError(f"invalid range: '{part.strip()}'")
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else start
        if start < 1 or end < 1 or start > total_pages or end > total_pages:
            raise PdfError(
                f"range '{part.strip()}' is out of bounds (document has {total_pages} pages)"
            )
        if end < start:
            raise PdfError(f"range '{part.strip()}' is reversed")
        groups.append(list(range(start, end + 1)))
    return groups


def _range_label(pages: Iterable[int]) -> str:
    nums = list(pages)
    if not nums:
        return "empty"
    if len(nums) == 1:
        return f"p{nums[0]}"
    return f"p{nums[0]}-{nums[-1]}"
