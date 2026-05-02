from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Bookmark, Note, Todo
from .serializers import BookmarkSerializer, NoteSerializer, SnoozeSerializer, TodoSerializer


class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer

    def get_queryset(self):
        queryset = Note.objects.all()
        if self.action != "list":
            return queryset
        archived = self.request.query_params.get("archived")
        if archived == "true":
            queryset = queryset.filter(archived_at__isnull=False)
        elif archived == "all":
            pass
        else:
            queryset = queryset.filter(archived_at__isnull=True)
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(body__icontains=search))
        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(tags__contains=[tag])
        return queryset

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        note = self.get_object()
        note.archived_at = timezone.now()
        note.save(update_fields=["archived_at", "updated_at"])
        return Response(NoteSerializer(note).data)

    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        note = self.get_object()
        note.archived_at = None
        note.save(update_fields=["archived_at", "updated_at"])
        return Response(NoteSerializer(note).data)


class TodoViewSet(viewsets.ModelViewSet):
    serializer_class = TodoSerializer

    def get_queryset(self):
        queryset = Todo.objects.all()
        if self.action != "list":
            return queryset
        status_filter = self.request.query_params.get("status")
        if status_filter == "open":
            queryset = queryset.filter(completed_at__isnull=True)
        elif status_filter == "done":
            queryset = queryset.filter(completed_at__isnull=False)
        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(tags__contains=[tag])
        return queryset

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        todo = self.get_object()
        todo.completed_at = timezone.now()
        todo.save(update_fields=["completed_at", "updated_at"])
        return Response(TodoSerializer(todo).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        todo = self.get_object()
        todo.completed_at = None
        todo.save(update_fields=["completed_at", "updated_at"])
        return Response(TodoSerializer(todo).data)

    @action(detail=True, methods=["post"])
    def snooze(self, request, pk=None):
        serializer = SnoozeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        todo = self.get_object()
        base = todo.remind_at or timezone.now()
        todo.remind_at = base + timedelta(minutes=serializer.validated_data["minutes"])
        todo.last_fired_at = None
        todo.save(update_fields=["remind_at", "last_fired_at", "updated_at"])
        return Response(TodoSerializer(todo).data)


class DueRemindersView(viewsets.ViewSet):
    """Returns todos whose remind_at falls within the next ?within= seconds and have not been fired recently."""

    def list(self, request):
        within_seconds = int(request.query_params.get("within", "300"))
        now = timezone.now()
        horizon = now + timedelta(seconds=within_seconds)
        cooldown = now - timedelta(seconds=120)

        queryset = (
            Todo.objects.filter(
                completed_at__isnull=True,
                remind_at__isnull=False,
                remind_at__lte=horizon,
            )
            .filter(Q(last_fired_at__isnull=True) | Q(last_fired_at__lte=cooldown))
            .order_by("remind_at")
        )

        ids = list(queryset.values_list("id", flat=True))
        Todo.objects.filter(id__in=ids).update(last_fired_at=now)
        refreshed = Todo.objects.filter(id__in=ids).order_by("remind_at")
        return Response(
            {"reminders": TodoSerializer(refreshed, many=True).data}, status=status.HTTP_200_OK
        )


class BookmarkViewSet(viewsets.ModelViewSet):
    serializer_class = BookmarkSerializer

    def get_queryset(self):
        queryset = Bookmark.objects.all()
        if self.action != "list":
            return queryset
        archived = self.request.query_params.get("archived")
        if archived == "true":
            queryset = queryset.filter(archived_at__isnull=False)
        elif archived != "all":
            queryset = queryset.filter(archived_at__isnull=True)
        search = self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(url__icontains=search) | Q(notes__icontains=search)
            )
        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(tags__contains=[tag])
        return queryset

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        bookmark = self.get_object()
        bookmark.archived_at = timezone.now()
        bookmark.save(update_fields=["archived_at", "updated_at"])
        return Response(BookmarkSerializer(bookmark).data)

    @action(detail=True, methods=["post"])
    def unarchive(self, request, pk=None):
        bookmark = self.get_object()
        bookmark.archived_at = None
        bookmark.save(update_fields=["archived_at", "updated_at"])
        return Response(BookmarkSerializer(bookmark).data)
