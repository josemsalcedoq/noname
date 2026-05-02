from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", health),
    path("api/text-translator/", include("utilities.text_translator.urls")),
    path("api/docx-translator/", include("utilities.docx_translator.urls")),
    path("api/youtube-downloader/", include("utilities.youtube_downloader.urls")),
    path("api/personal-hub/", include("utilities.personal_hub.urls")),
    path("api/skills/", include("utilities.skills_catalog.urls")),
    path("api/http-client/", include("utilities.http_client.urls")),
    path("api/srt-translator/", include("utilities.srt_translator.urls")),
    path("api/audio-transcriber/", include("utilities.audio_transcriber.urls")),
    path("admin/", admin.site.urls),
]
