from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from shared.nmt import engine

from .serializers import TranslateRequestSerializer, TranslateResponseSerializer


class TranslateView(APIView):
    def post(self, request):
        request_serializer = TranslateRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        payload = request_serializer.validated_data

        text: str = payload["text"]
        target: str = payload["target"]
        source: str = payload["source"]

        detected_source: str | None = None
        if source == "auto":
            detected_source = engine.detect(text)
            if detected_source is None:
                return Response(
                    {"error": "language_undetected", "detail": "Could not detect source language."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            source = detected_source

        if source == target or not text.strip():
            translated = text
        else:
            translated = engine.translate(text, source, target)

        response = TranslateResponseSerializer({"text": translated, "detected_source": detected_source})
        return Response(response.data)
