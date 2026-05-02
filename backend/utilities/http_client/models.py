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
