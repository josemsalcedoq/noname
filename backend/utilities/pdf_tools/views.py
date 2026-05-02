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


class FormFieldsView(APIView):
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
            result = services.discover_form_fields(io.BytesIO(upload.read()))
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_pdf", str(exc))
        return Response(result)


class FormFillView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        import json as json_lib

        upload = request.FILES.get("file")
        values_raw = request.data.get("values", "{}")
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
            values = json_lib.loads(values_raw)
            if not isinstance(values, dict):
                raise ValueError("values must be an object")
        except (json_lib.JSONDecodeError, ValueError) as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_values", str(exc))
        try:
            result = services.fill_form_fields(io.BytesIO(upload.read()), values)
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "fill_failed", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(result, content_type=PDF_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_filled.pdf"'
        return response


class AnnotateView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        import json as json_lib

        upload = request.FILES.get("file")
        annotations_raw = request.data.get("annotations", "[]")
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
            annotations = json_lib.loads(annotations_raw)
            if not isinstance(annotations, list):
                raise ValueError("annotations must be a list")
        except (json_lib.JSONDecodeError, ValueError) as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_annotations", str(exc))
        try:
            result = services.annotate_pdf(io.BytesIO(upload.read()), annotations)
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "annotate_failed", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(result, content_type=PDF_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_annotated.pdf"'
        return response


class StampView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        mode = (request.data.get("mode") or "").strip()
        text = request.data.get("text", "")
        position = request.data.get("position", "bottom-right")
        font_size_raw = request.data.get("font_size", "36")
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
            font_size = int(font_size_raw)
        except (TypeError, ValueError):
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_font_size", "font_size must be an integer.")
        try:
            result = services.stamp_pdf(
                io.BytesIO(upload.read()),
                mode=mode,
                text=text,
                position=position,
                font_size=font_size,
            )
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "stamp_failed", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(result, content_type=PDF_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_stamped.pdf"'
        return response


class EncryptView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        owner = request.data.get("owner_password", "") or ""
        user = request.data.get("user_password", "") or ""
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
            result = services.encrypt_pdf(
                io.BytesIO(upload.read()), owner_password=owner, user_password=user
            )
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "encrypt_failed", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(result, content_type=PDF_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_encrypted.pdf"'
        return response


class DecryptView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        password = request.data.get("password", "") or ""
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
            result = services.decrypt_pdf(io.BytesIO(upload.read()), password=password)
        except services.PdfError as exc:
            return _error(status.HTTP_403_FORBIDDEN, "decrypt_failed", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(result, content_type=PDF_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_decrypted.pdf"'
        return response


class SearchableView(APIView):
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
            result = services.make_searchable(io.BytesIO(upload.read()), languages=languages)
        except services.PdfError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "ocr_failed", str(exc))
        stem = Path(upload.name).stem
        response = HttpResponse(result, content_type=PDF_MIME)
        response["Content-Disposition"] = f'attachment; filename="{stem}_searchable.pdf"'
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
