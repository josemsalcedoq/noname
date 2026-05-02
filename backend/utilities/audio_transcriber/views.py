import shutil
import uuid
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services

MAX_BYTES = 200 * 1024 * 1024
ACCEPTED_EXTENSIONS = {
    ".mp3",
    ".mp4",
    ".m4a",
    ".wav",
    ".webm",
    ".ogg",
    ".opus",
    ".flac",
    ".aac",
    ".mkv",
    ".mov",
}


class TranscribeView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get("file")
        model_size = request.data.get("model_size", services.DEFAULT_MODEL)
        language = request.data.get("language") or None
        if language == "auto":
            language = None

        if upload is None:
            return _error(
                status.HTTP_400_BAD_REQUEST, "missing_file", "A 'file' field is required."
            )
        if upload.size > MAX_BYTES:
            return _error(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "file_too_large",
                "Maximum size is 200 MB.",
            )
        ext = Path(upload.name).suffix.lower()
        if ext not in ACCEPTED_EXTENSIONS:
            return _error(
                status.HTTP_400_BAD_REQUEST,
                "unsupported_format",
                f"Accepted: {', '.join(sorted(ACCEPTED_EXTENSIONS))}",
            )
        if model_size not in services.SUPPORTED_MODELS:
            return _error(
                status.HTTP_400_BAD_REQUEST,
                "unsupported_model",
                f"Accepted: {', '.join(services.SUPPORTED_MODELS)}",
            )

        tmp_dir = Path(settings.TMP_DIR) / f"transcribe-{uuid.uuid4().hex}"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        temp_path = tmp_dir / upload.name
        try:
            with temp_path.open("wb") as fh:
                for chunk in upload.chunks():
                    fh.write(chunk)
            try:
                result = services.transcribe(temp_path, model_size=model_size, language=language)
            except Exception as exc:  # noqa: BLE001
                return _error(status.HTTP_400_BAD_REQUEST, "transcription_failed", str(exc))
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

        return Response(result.to_dict())


def _error(http_status: int, code: str, detail: str) -> Response:
    return Response({"error": code, "detail": detail}, status=http_status)
