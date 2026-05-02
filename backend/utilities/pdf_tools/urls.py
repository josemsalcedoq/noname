from django.urls import path

from .views import (
    AnnotateView,
    DecryptView,
    EncryptView,
    ExtractTextView,
    FormFieldsView,
    FormFillView,
    ManipulateView,
    MergeView,
    OcrView,
    SearchableView,
    SplitView,
    StampView,
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
    path("annotate", AnnotateView.as_view(), name="pdf-annotate"),
    path("stamp", StampView.as_view(), name="pdf-stamp"),
    path("encrypt", EncryptView.as_view(), name="pdf-encrypt"),
    path("decrypt", DecryptView.as_view(), name="pdf-decrypt"),
    path("form/fields", FormFieldsView.as_view(), name="pdf-form-fields"),
    path("form/fill", FormFillView.as_view(), name="pdf-form-fill"),
]
