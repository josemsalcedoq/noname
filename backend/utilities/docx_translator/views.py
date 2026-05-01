import io

from django.http import FileResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.nmt import engine

from .services import translate_docx

MAX_BYTES = 25 * 1024 * 1024
SUPPORTED = ("en", "es")
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class TranslateView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        source = request.data.get("source")
        target = request.data.get("target")

        if upload is None:
            return _error(status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required.")
        if source not in SUPPORTED or target not in SUPPORTED:
            return _error(status.HTTP_400_BAD_REQUEST, "unsupported_language", "Source/target must be 'en' or 'es'.")
        if source == target:
            return _error(status.HTTP_400_BAD_REQUEST, "same_language", "Source and target must differ.")
        if upload.size > MAX_BYTES:
            return _error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large", "Maximum size is 25 MB.")
        if not upload.name.lower().endswith(".docx"):
            return _error(status.HTTP_400_BAD_REQUEST, "unsupported_format", "Only .docx files are accepted.")

        try:
            translated_bytes = translate_docx(
                io.BytesIO(upload.read()),
                source=source,
                target=target,
                translator=engine.translate,
            )
        except Exception as exc:  # noqa: BLE001 — surface a generic error
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_docx", str(exc))

        stem = upload.name.rsplit(".", 1)[0]
        filename = f"{stem}_{target}.docx"
        response = FileResponse(io.BytesIO(translated_bytes), as_attachment=True, filename=filename, content_type=DOCX_MIME)
        return response


def _error(http_status: int, code: str, detail: str) -> Response:
    return Response({"error": code, "detail": detail}, status=http_status)
