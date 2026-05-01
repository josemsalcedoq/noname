from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DueRemindersView, NoteViewSet, TodoViewSet

router = DefaultRouter(trailing_slash=False)
router.register("notes", NoteViewSet, basename="note")
router.register("todos", TodoViewSet, basename="todo")
router.register("due", DueRemindersView, basename="due")

urlpatterns = [
    path("", include(router.urls)),
]
