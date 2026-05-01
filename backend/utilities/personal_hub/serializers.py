from rest_framework import serializers

from .models import Note, Todo

MAX_NOTE_BODY = 50_000
MAX_TAGS = 10


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ("id", "title", "body", "tags", "archived_at", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_body(self, value: str) -> str:
        if len(value) > MAX_NOTE_BODY:
            raise serializers.ValidationError(f"Body exceeds {MAX_NOTE_BODY} character limit.")
        return value

    def validate_tags(self, value: list[str]) -> list[str]:
        if len(value) > MAX_TAGS:
            raise serializers.ValidationError(f"At most {MAX_TAGS} tags allowed.")
        return value


class TodoSerializer(serializers.ModelSerializer):
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Todo
        fields = (
            "id",
            "title",
            "body",
            "tags",
            "due_at",
            "remind_at",
            "last_fired_at",
            "completed_at",
            "is_overdue",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "last_fired_at", "is_overdue", "created_at", "updated_at")

    def validate_tags(self, value: list[str]) -> list[str]:
        if len(value) > MAX_TAGS:
            raise serializers.ValidationError(f"At most {MAX_TAGS} tags allowed.")
        return value

    def validate(self, attrs):
        due_at = attrs.get("due_at", getattr(self.instance, "due_at", None))
        remind_at = attrs.get("remind_at", getattr(self.instance, "remind_at", None))
        if due_at and remind_at and remind_at > due_at:
            raise serializers.ValidationError({"remind_at": "Cannot be after due_at."})
        return attrs


class SnoozeSerializer(serializers.Serializer):
    minutes = serializers.IntegerField(min_value=1, max_value=24 * 60)
