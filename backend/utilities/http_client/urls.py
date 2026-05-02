from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CollectionViewSet,
    EnvironmentViewSet,
    FolderViewSet,
    ImportPostmanView,
    RequestViewSet,
    RunViewSet,
    SendView,
)

router = DefaultRouter(trailing_slash=False)
router.register("collections", CollectionViewSet, basename="collection")
router.register("folders", FolderViewSet, basename="folder")
router.register("requests", RequestViewSet, basename="request")
router.register("environments", EnvironmentViewSet, basename="environment")
router.register("runs", RunViewSet, basename="run")

urlpatterns = [
    path("collections/import", ImportPostmanView.as_view(), name="http-import"),
    path("send", SendView.as_view(), name="http-send"),
    path("", include(router.urls)),
]
