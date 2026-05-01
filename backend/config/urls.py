from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", health),
    path("api/text-translator/", include("utilities.text_translator.urls")),
    path("api/docx-translator/", include("utilities.docx_translator.urls")),
    path("admin/", admin.site.urls),
]
