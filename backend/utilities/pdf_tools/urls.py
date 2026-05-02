from django.urls import path

from .views import ExtractTextView, MergeView, OcrView, SplitView

urlpatterns = [
    path("merge", MergeView.as_view(), name="pdf-merge"),
    path("split", SplitView.as_view(), name="pdf-split"),
    path("extract-text", ExtractTextView.as_view(), name="pdf-extract-text"),
    path("ocr", OcrView.as_view(), name="pdf-ocr"),
]
