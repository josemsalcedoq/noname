import json

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Collection, Environment, Folder, RequestNode, RequestRun
from .serializers import (
    CollectionSerializer,
    EnvironmentSerializer,
    FolderSerializer,
    RequestRunSerializer,
    RequestRunSummarySerializer,
    RequestSerializer,
    SendRequestSerializer,
)

MAX_STORED_RESPONSE_BYTES = 64 * 1024  # cap history body at 64 KB to keep DB tidy


class CollectionViewSet(viewsets.ModelViewSet):
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer

    @action(detail=True, methods=["get"])
    def tree(self, request, pk=None):
        collection = self.get_object()
        return Response(
            {
                "id": collection.id,
                "name": collection.name,
                "items": services.collection_tree(collection),
            }
        )


class FolderViewSet(viewsets.ModelViewSet):
    queryset = Folder.objects.all()
    serializer_class = FolderSerializer


class RequestViewSet(viewsets.ModelViewSet):
    queryset = RequestNode.objects.all()
    serializer_class = RequestSerializer


class EnvironmentViewSet(viewsets.ModelViewSet):
    queryset = Environment.objects.all()
    serializer_class = EnvironmentSerializer


class SendView(APIView):
    parser_classes = [JSONParser]

    def post(self, request):
        serializer = SendRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        request_node_id = request.data.get("request_node_id")

        try:
            payload = services.send_request(validated)
        except services.SendError as exc:
            self._record_run(validated, request_node_id, error=exc, payload=None)
            return Response(
                {"error": exc.code, "detail": exc.detail},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        self._record_run(validated, request_node_id, error=None, payload=payload)
        return Response(payload)

    def _record_run(self, validated: dict, request_node_id, *, error, payload) -> None:
        snapshot = {
            "headers": validated.get("headers", []),
            "params": validated.get("params", []),
            "body": validated.get("body", ""),
            "body_type": validated.get("body_type", "none"),
            "environment_id": validated.get("environment_id"),
        }
        run_kwargs: dict = {
            "method": validated["method"],
            "url": validated["url"],
            "snapshot": snapshot,
        }
        if request_node_id is not None:
            try:
                run_kwargs["request_node_id"] = int(request_node_id)
            except (TypeError, ValueError):
                pass
        if error is not None:
            run_kwargs["error"] = f"{error.code}: {error.detail}"[:8000]
        if payload is not None:
            body = payload.get("body", "") or ""
            if len(body) > MAX_STORED_RESPONSE_BYTES:
                body = body[:MAX_STORED_RESPONSE_BYTES]
            run_kwargs.update(
                {
                    "status": payload.get("status"),
                    "status_text": (payload.get("status_text") or "")[:200],
                    "response_headers": payload.get("headers", {}),
                    "response_body": body,
                    "duration_ms": payload.get("duration_ms"),
                    "size_bytes": payload.get("size_bytes"),
                    "truncated": bool(payload.get("truncated")),
                }
            )
        RequestRun.objects.create(**run_kwargs)


class RunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RequestRun.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        request_node = self.request.query_params.get("request_node")
        if request_node:
            queryset = queryset.filter(request_node_id=request_node)
        try:
            limit = int(self.request.query_params.get("limit", "50"))
        except ValueError:
            limit = 50
        limit = max(1, min(limit, 200))
        return queryset[:limit]

    def get_serializer_class(self):
        if self.action == "list":
            return RequestRunSummarySerializer
        return RequestRunSerializer


class ImportPostmanView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if upload is not None:
            try:
                payload = json.loads(upload.read().decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                return Response(
                    {"error": "invalid_json", "detail": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            payload = request.data
        if not isinstance(payload, dict) or "info" not in payload:
            return Response(
                {"error": "not_postman_v21", "detail": "Missing top-level 'info' object."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        collection = services.import_postman_v21(payload)
        return Response(CollectionSerializer(collection).data, status=status.HTTP_201_CREATED)
