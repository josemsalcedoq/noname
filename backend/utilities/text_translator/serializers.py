from rest_framework import serializers

SUPPORTED_LANGUAGES = ("en", "es")
SOURCE_CHOICES = (*SUPPORTED_LANGUAGES, "auto")
MAX_INPUT_LENGTH = 50_000


class TranslateRequestSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=SOURCE_CHOICES)
    target = serializers.ChoiceField(choices=SUPPORTED_LANGUAGES)
    text = serializers.CharField(
        allow_blank=True, max_length=MAX_INPUT_LENGTH, trim_whitespace=False
    )


class TranslateResponseSerializer(serializers.Serializer):
    text = serializers.CharField(allow_blank=True, trim_whitespace=False)
    detected_source = serializers.CharField(required=False, allow_null=True)
