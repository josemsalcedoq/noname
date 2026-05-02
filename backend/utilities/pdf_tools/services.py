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


def thumbnails(stream: io.BytesIO, *, max_width: int = 220) -> dict:
    """Render every page as a small JPEG and return them base64-encoded."""
    import base64

    import pypdfium2 as pdfium

    stream.seek(0)
    document = pdfium.PdfDocument(stream)
    images: list[str] = []
    try:
        for index in range(len(document)):
            page = document[index]
            scale = max_width / page.get_width()
            pil = page.render(scale=scale).to_pil()
            buffer = io.BytesIO()
            pil.save(buffer, format="JPEG", quality=70, optimize=True)
            images.append("data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode())
    finally:
        document.close()
    return {"page_count": len(images), "thumbnails": images}


def manipulate_pages(stream: io.BytesIO, operations: list[dict]) -> bytes:
    """Reorder / rotate / drop / insert blank pages.

    Each operation in the desired output order is one of:
    - {"source": <1-indexed page>, "rotation": 0|90|180|270} — keep + rotate
    - {"blank": true, "width": <pt>, "height": <pt>} — insert a blank page (defaults to A4)
    """
    if not operations:
        raise PdfError("at least one page must be kept")
    stream.seek(0)
    with pikepdf.open(stream) as source:
        total = len(source.pages)
        output = pikepdf.Pdf.new()
        try:
            for op in operations:
                if op.get("blank"):
                    width = float(op.get("width") or 595)
                    height = float(op.get("height") or 842)
                    output.add_blank_page(page_size=(width, height))
                    continue
                src_index = int(op.get("source", 0))
                if src_index < 1 or src_index > total:
                    raise PdfError(f"page {src_index} out of bounds (document has {total} pages)")
                rotation = int(op.get("rotation", 0))
                if rotation not in (0, 90, 180, 270):
                    raise PdfError(f"invalid rotation {rotation}; must be 0/90/180/270")
                output.pages.append(source.pages[src_index - 1])
                if rotation:
                    output.pages[-1].rotate(rotation, relative=True)
            buffer = io.BytesIO()
            output.save(buffer)
            return buffer.getvalue()
        finally:
            output.close()


def discover_form_fields(stream: io.BytesIO) -> dict:
    """Inspect AcroForm fields and return their names + types + current values."""
    stream.seek(0)
    fields: list[dict] = []
    with pikepdf.open(stream) as pdf:
        root = pdf.Root.get("/AcroForm")
        if root is None or "/Fields" not in root:
            return {"fields": []}
        seen: set[str] = set()
        for field in _walk_fields(root["/Fields"]):
            name = field.get("/T")
            if not name:
                continue
            name_str = str(name)
            if name_str in seen:
                continue
            seen.add(name_str)
            ft = field.get("/FT")
            ft_str = str(ft) if ft else ""
            kind = {
                "/Tx": "text",
                "/Btn": "checkbox",
                "/Ch": "choice",
                "/Sig": "signature",
            }.get(ft_str, ft_str or "unknown")
            value = field.get("/V")
            fields.append(
                {
                    "name": name_str,
                    "kind": kind,
                    "value": str(value) if value is not None else "",
                }
            )
    return {"fields": fields}


def _walk_fields(fields):
    for field in fields:
        yield field
        kids = field.get("/Kids")
        if kids is not None:
            yield from _walk_fields(kids)


def fill_form_fields(stream: io.BytesIO, values: dict[str, str]) -> bytes:
    """Write values into AcroForm fields by name. Returns the new PDF bytes."""
    stream.seek(0)
    with pikepdf.open(stream) as pdf:
        root = pdf.Root.get("/AcroForm")
        if root is None or "/Fields" not in root:
            raise PdfError("PDF has no AcroForm fields")
        for field in _walk_fields(root["/Fields"]):
            name = field.get("/T")
            if not name:
                continue
            name_str = str(name)
            if name_str not in values:
                continue
            field["/V"] = pikepdf.String(str(values[name_str]))
            if "/AP" in field:
                del field["/AP"]
        root["/NeedAppearances"] = True
        buffer = io.BytesIO()
        pdf.save(buffer)
        return buffer.getvalue()


def annotate_pdf(stream: io.BytesIO, annotations: list[dict]) -> bytes:
    """Add sticky-note text annotations to a PDF.

    Each annotation: {page: 1-indexed, x, y, text, color?: "yellow"|"red"|"blue"}.
    Coordinates are in PDF points from the bottom-left of the page.
    """
    if not annotations:
        raise PdfError("at least one annotation is required")
    color_map = {
        "yellow": [1, 0.95, 0.4],
        "red": [1, 0.5, 0.5],
        "blue": [0.5, 0.7, 1.0],
    }
    stream.seek(0)
    with pikepdf.open(stream) as pdf:
        total = len(pdf.pages)
        for ann in annotations:
            page_idx = int(ann.get("page", 0))
            if page_idx < 1 or page_idx > total:
                raise PdfError(f"page {page_idx} out of bounds (document has {total} pages)")
            x = float(ann.get("x", 36))
            y = float(ann.get("y", 36))
            text = str(ann.get("text", "")).strip()
            if not text:
                continue
            color = color_map.get(str(ann.get("color", "yellow")).lower(), color_map["yellow"])
            page = pdf.pages[page_idx - 1]
            note = pikepdf.Dictionary(
                Type=pikepdf.Name("/Annot"),
                Subtype=pikepdf.Name("/Text"),
                Rect=[x, y, x + 24, y + 24],
                Contents=pikepdf.String(text),
                Open=False,
                Name=pikepdf.Name("/Comment"),
                C=color,
            )
            existing = page.get("/Annots")
            if existing is None:
                page["/Annots"] = pikepdf.Array([note])
            else:
                existing.append(note)
        buffer = io.BytesIO()
        pdf.save(buffer)
        return buffer.getvalue()


def make_searchable(stream: io.BytesIO, *, languages: str = "eng+spa") -> bytes:
    """Run ocrmypdf to add a text layer to a scanned PDF and return the new PDF bytes.

    Requires ocrmypdf + ghostscript + tesseract on the host.
    """
    import shutil
    import subprocess
    import tempfile
    from pathlib import Path as _Path

    if not shutil.which("ocrmypdf"):
        raise PdfError("ocrmypdf binary not found; install with `brew install ocrmypdf`")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = _Path(tmp)
        input_path = tmp_path / "in.pdf"
        output_path = tmp_path / "out.pdf"
        input_path.write_bytes(stream.getvalue())

        result = subprocess.run(
            [
                "ocrmypdf",
                "--language",
                languages,
                "--skip-text",
                "--quiet",
                "--output-type",
                "pdf",
                str(input_path),
                str(output_path),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise PdfError(
                f"ocrmypdf failed (exit {result.returncode}): {result.stderr.strip()[:500]}"
            )
        return output_path.read_bytes()


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
