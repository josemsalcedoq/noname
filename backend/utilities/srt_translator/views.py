from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.nmt import engine

from .services import InvalidSrt, translate_srt

MAX_BYTES = 5 * 1024 * 1024
SUPPORTED = ("en", "es")


class TranslateView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        source = request.data.get("source")
        target = request.data.get("target")

        if upload is None:
            return _error(
                status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required."
            )
        if source not in SUPPORTED or target not in SUPPORTED:
            return _error(
                status.HTTP_400_BAD_REQUEST,
                "unsupported_language",
                "Source/target must be 'en' or 'es'.",
            )
        if source == target:
            return _error(
                status.HTTP_400_BAD_REQUEST, "same_language", "Source and target must differ."
            )
        if upload.size > MAX_BYTES:
            return _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file_too_large", "Maximum size is 5 MB."
            )
        if not upload.name.lower().endswith(".srt"):
            return _error(
                status.HTTP_400_BAD_REQUEST, "unsupported_format", "Only .srt files are accepted."
            )

        try:
            content = upload.read().decode("utf-8")
        except UnicodeDecodeError as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_encoding", str(exc))

        try:
            translated = translate_srt(
                content, source=source, target=target, translator=engine.translate
            )
        except InvalidSrt as exc:
            return _error(status.HTTP_400_BAD_REQUEST, "invalid_srt", str(exc))

        stem = upload.name.rsplit(".", 1)[0]
        filename = f"{stem}_{target}.srt"
        response = HttpResponse(translated.encode("utf-8"), content_type="application/x-subrip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


def _error(http_status: int, code: str, detail: str) -> Response:
    return Response({"error": code, "detail": detail}, status=http_status)
