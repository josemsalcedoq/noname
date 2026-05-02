from django.db import models


class Collection(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class Folder(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="folders")
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    name = models.CharField(max_length=200)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "name"]


class RequestNode(models.Model):
    class BodyType(models.TextChoices):
        NONE = "none"
        RAW = "raw"
        JSON = "json"
        URLENCODED = "urlencoded"

    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="requests")
    folder = models.ForeignKey(
        Folder, on_delete=models.CASCADE, null=True, blank=True, related_name="requests"
    )
    name = models.CharField(max_length=200)
    method = models.CharField(max_length=10, default="GET")
    url = models.TextField()
    headers = models.JSONField(default=list)
    params = models.JSONField(default=list)
    body = models.TextField(blank=True, default="")
    body_type = models.CharField(max_length=20, choices=BodyType.choices, default=BodyType.NONE)
    pre_request_script = models.TextField(blank=True, default="")
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "name"]


class Environment(models.Model):
    name = models.CharField(max_length=200, unique=True)
    variables = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]


class RequestRun(models.Model):
    request_node = models.ForeignKey(
        RequestNode,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="runs",
    )
    method = models.CharField(max_length=10)
    url = models.TextField()
    snapshot = models.JSONField(default=dict)
    status = models.IntegerField(null=True, blank=True)
    status_text = models.CharField(max_length=200, blank=True, default="")
    response_body = models.TextField(blank=True, default="")
    response_headers = models.JSONField(default=dict)
    duration_ms = models.IntegerField(null=True, blank=True)
    size_bytes = models.IntegerField(null=True, blank=True)
    truncated = models.BooleanField(default=False)
    error = models.TextField(blank=True, default="")
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at"]
