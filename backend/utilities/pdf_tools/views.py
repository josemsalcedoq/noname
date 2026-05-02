import io
from pathlib import Path

from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services

PDF_MIME = "application/pdf"
ZIP_MIME = "application/zip"
MAX_BYTES = 100 * 1024 * 1024


def _error(http_status: int, code: str, detail: str) -> Response:
    return Response({"error": code, "detail": detail}, status=http_status)


def _read_pdfs(files) -> list[io.BytesIO]:
    buffers: list[io.BytesIO] = []
    for upload in files:
        if not upload.name.lower().endswith(".pdf"):
            raise services.PdfError(f"'{upload.name}' is not a .pdf")
        if upload.size > MAX_BYTES:
            raise services.PdfError(f"'{upload.name}' exceeds the 100 MB limit")
        buffers.append(io.BytesIO(upload.read()))
    return buffers


class MergeView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploads = list(request.FILES.getlist("files"))
        if len(uploads) < 2:
            return _error(
                status.HTTP_400_BAD_REQUEST, "too_few_files", "Provide at least two PDFs."
            )
        try:
            buffers = _read_pdfs(uploads)
            merged = services.merge_pdfs(buffers)
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_input", str(exc))
        response = HttpResponse(merged, content_type=PDF_MIME)
        response["Content-Disposition"] = 'attachment; filename="merged.pdf"'
        return response


class SplitView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        ranges = request.data.get("ranges", "")
        if upload is None:
            return _error(
                status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required."
            )
        if not upload.name.lower().endswith(".pdf"):
            return _error(
                status.HTTP_400_BAD_REQUEST, "unsupported_format", "Only .pdf files accepted."
            )
        if upload.size > MAX_BYTES:
            return _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large", "Maximum 100 MB."
            )
        try:
            zip_bytes = services.split_pdf(io.BytesIO(upload.read()), ranges)
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_ranges", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(zip_bytes, content_type=ZIP_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_split.zip"'
        return response


class ExtractTextView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return _error(
                status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required."
            )
        if not upload.name.lower().endswith(".pdf"):
            return _error(
                status.HTTP_400_BAD_REQUEST, "unsupported_format", "Only .pdf files accepted."
            )
        if upload.size > MAX_BYTES:
            return _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large", "Maximum 100 MB."
            )
        try:
            result = services.extract_text(io.BytesIO(upload.read()))
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_pdf", str(exc))
        return Response(result)


class ThumbnailsView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is None:
            return _error(
                status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required."
            )
        if not upload.name.lower().endswith(".pdf"):
            return _error(
                status.HTTP_400_BAD_REQUEST, "unsupported_format", "Only .pdf files accepted."
            )
        if upload.size > MAX_BYTES:
            return _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large", "Maximum 100 MB."
            )
        try:
            result = services.thumbnails(io.BytesIO(upload.read()))
        except Exception as exc:  # noqa: BLE001
            return _error(status.HTTP_400_BAD_REQUEST, "render_failed", str(exc))
        return Response(result)


class ManipulateView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        import json as json_lib

        upload = request.FILES.get("file")
        operations_raw = request.data.get("operations", "[]")
        if upload is None:
            return _error(
                status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required."
            )
        if not upload.name.lower().endswith(".pdf"):
            return _error(
                status.HTTP_400_BAD_REQUEST, "unsupported_format", "Only .pdf files accepted."
            )
        if upload.size > MAX_BYTES:
            return _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large", "Maximum 100 MB."
            )
        try:
            operations = json_lib.loads(operations_raw)
            if not isinstance(operations, list):
                raise ValueError("operations must be a list")
        except (json_lib.JSONDecodeError, ValueError) as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_operations", str(exc))
        try:
            result = services.manipulate_pages(io.BytesIO(upload.read()), operations)
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_operations", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(result, content_type=PDF_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_edited.pdf"'
        return response


class OcrView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        languages = request.data.get("languages", "eng+spa")
        if upload is None:
            return _error(
                status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required."
            )
        if not upload.name.lower().endswith(".pdf"):
            return _error(
                status.HTTP_400_BAD_REQUEST, "unsupported_format", "Only .pdf files accepted."
            )
        if upload.size > MAX_BYTES:
            return _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large", "Maximum 100 MB."
            )
        try:
            result = services.ocr_pdf(io.BytesIO(upload.read()), languages=languages)
        except Exception as exc:  # noqa: BLE001
            return _error(status.HTTP_400_BAD_REQUEST, "ocr_failed", str(exc))
        return Response(result)
