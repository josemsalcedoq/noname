from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import YoutubeJob
from .serializers import DownloadRequestSerializer, JobSerializer, ProbeRequestSerializer


def _error(http_status: int, code: str, detail: str) -> Response:
    return Response({"error": code, "detail": detail}, status=http_status)


class ProbeView(APIView):
    def post(self, request):
        serializer = ProbeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        url = serializer.validated_data["url"]
        if not services.is_youtube_url(url):
            return _error(status.HTTP_400_BAD_REQUEST, "unsupported_host", "Only YouTube URLs are supported.")
        try:
            metadata = services.probe(url)
        except Exception as exc:  # noqa: BLE001
            return _error(status.HTTP_400_BAD_REQUEST, "probe_failed", str(exc))
        return Response(metadata)


class DownloadView(APIView):
    def post(self, request):
        serializer = DownloadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not services.is_youtube_url(data["url"]):
            return _error(status.HTTP_400_BAD_REQUEST, "unsupported_host", "Only YouTube URLs are supported.")
        if YoutubeJob.objects.filter(status=YoutubeJob.Status.RUNNING).exists():
            return _error(status.HTTP_409_CONFLICT, "job_already_running", "Another download is in progress.")
        job = YoutubeJob.objects.create(url=data["url"], mode=data["mode"], quality=data["quality"])
        services.start_download(job)
        return Response(JobSerializer(job).data, status=status.HTTP_201_CREATED)


class ProgressView(APIView):
    def get(self, request, job_id):
        job = get_object_or_404(YoutubeJob, id=job_id)
        return Response(JobSerializer(job).data)


class CancelView(APIView):
    def post(self, request, job_id):
        job = get_object_or_404(YoutubeJob, id=job_id)
        if job.status not in {YoutubeJob.Status.PENDING, YoutubeJob.Status.RUNNING}:
            return _error(status.HTTP_409_CONFLICT, "not_cancellable", f"Job is {job.status}.")
        services.cancel(job)
        job.refresh_from_db()
        return Response(JobSerializer(job).data)
