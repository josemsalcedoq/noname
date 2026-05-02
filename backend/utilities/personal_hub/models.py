from django.contrib.postgres.fields import ArrayField
from django.db import models


class Note(models.Model):
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Bookmark(models.Model):
    url = models.URLField(max_length=2000)
    title = models.CharField(max_length=300, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class Todo(models.Model):
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default="")
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    remind_at = models.DateTimeField(null=True, blank=True)
    last_fired_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["completed_at", "due_at", "-created_at"]

    @property
    def is_open(self) -> bool:
        return self.completed_at is None

    @property
    def is_overdue(self) -> bool:
        if not self.is_open or self.due_at is None:
            return False
        from django.utils import timezone

        return self.due_at < timezone.now()
