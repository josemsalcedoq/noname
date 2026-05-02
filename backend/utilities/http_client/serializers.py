from rest_framework import serializers

from .models import Collection, Environment, Folder, RequestNode


class RequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequestNode
        fields = (
            "id",
            "collection",
            "folder",
            "name",
            "method",
            "url",
            "headers",
            "params",
            "body",
            "body_type",
            "position",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class FolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ("id", "collection", "parent", "name", "position", "created_at")
        read_only_fields = ("id", "created_at")


class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ("id", "name", "description", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class EnvironmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Environment
        fields = ("id", "name", "variables", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class TreeNodeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    kind = serializers.ChoiceField(choices=["folder", "request"])
    method = serializers.CharField(required=False, allow_null=True)
    children = serializers.ListField(required=False)


class SendRequestSerializer(serializers.Serializer):
    method = serializers.CharField()
    url = serializers.CharField()
    headers = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    params = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    body = serializers.CharField(
        allow_blank=True, required=False, default="", trim_whitespace=False
    )
    body_type = serializers.ChoiceField(
        choices=[c.value for c in RequestNode.BodyType], required=False, default="none"
    )
    environment_id = serializers.IntegerField(required=False, allow_null=True)
