from django.urls import path

from .views import CancelView, DownloadView, ProbeView, ProgressView

urlpatterns = [
    path("probe", ProbeView.as_view(), name="yt-probe"),
    path("download", DownloadView.as_view(), name="yt-download"),
    path("progress/<uuid:job_id>", ProgressView.as_view(), name="yt-progress"),
    path("cancel/<uuid:job_id>", CancelView.as_view(), name="yt-cancel"),
]
