import json

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Collection, Environment, Folder, RequestNode
from .serializers import (
    CollectionSerializer,
    EnvironmentSerializer,
    FolderSerializer,
    RequestSerializer,
    SendRequestSerializer,
)


class CollectionViewSet(viewsets.ModelViewSet):
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer

    @action(detail=True, methods=["get"])
    def tree(self, request, pk=None):
        collection = self.get_object()
        return Response({"id": collection.id, "name": collection.name, "items": services.collection_tree(collection)})


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
        try:
            payload = services.send_request(serializer.validated_data)
        except services.SendError as exc:
            return Response(
                {"error": exc.code, "detail": exc.detail},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(payload)


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
