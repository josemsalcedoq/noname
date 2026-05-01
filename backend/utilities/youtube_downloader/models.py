import uuid

from django.db import models


class YoutubeJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        DONE = "done"
        ERROR = "error"
        CANCELLED = "cancelled"

    class Mode(models.TextChoices):
        VIDEO = "video"
        AUDIO = "audio-only"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    url = models.TextField()
    mode = models.CharField(max_length=20, choices=Mode.choices)
    quality = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    progress = models.FloatField(default=0.0)
    file_path = models.TextField(blank=True, default="")
    error = models.TextField(blank=True, default="")
    pid = models.IntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]
