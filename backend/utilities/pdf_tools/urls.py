from django.urls import path

from .views import (
    ExtractTextView,
    FormFieldsView,
    FormFillView,
    ManipulateView,
    MergeView,
    OcrView,
    SearchableView,
    SplitView,
    ThumbnailsView,
)

urlpatterns = [
    path("merge", MergeView.as_view(), name="pdf-merge"),
    path("split", SplitView.as_view(), name="pdf-split"),
    path("extract-text", ExtractTextView.as_view(), name="pdf-extract-text"),
    path("ocr", OcrView.as_view(), name="pdf-ocr"),
    path("searchable", SearchableView.as_view(), name="pdf-searchable"),
    path("thumbnails", ThumbnailsView.as_view(), name="pdf-thumbnails"),
    path("manipulate", ManipulateView.as_view(), name="pdf-manipulate"),
    path("form/fields", FormFieldsView.as_view(), name="pdf-form-fields"),
    path("form/fill", FormFillView.as_view(), name="pdf-form-fill"),
]
