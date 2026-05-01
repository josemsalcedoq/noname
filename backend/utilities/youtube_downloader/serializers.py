from rest_framework import serializers

from .models import YoutubeJob

VIDEO_QUALITIES = ("best", "1080p", "720p", "480p")
AUDIO_QUALITIES = ("audio-128k", "audio-192k")


class ProbeRequestSerializer(serializers.Serializer):
    url = serializers.URLField()


class DownloadRequestSerializer(serializers.Serializer):
    url = serializers.URLField()
    mode = serializers.ChoiceField(choices=[YoutubeJob.Mode.VIDEO, YoutubeJob.Mode.AUDIO])
    quality = serializers.CharField()

    def validate(self, attrs):
        mode = attrs["mode"]
        quality = attrs["quality"]
        if mode == YoutubeJob.Mode.VIDEO and quality not in VIDEO_QUALITIES:
            raise serializers.ValidationError({"quality": f"Must be one of {VIDEO_QUALITIES}."})
        if mode == YoutubeJob.Mode.AUDIO and quality not in AUDIO_QUALITIES:
            raise serializers.ValidationError({"quality": f"Must be one of {AUDIO_QUALITIES}."})
        return attrs


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = YoutubeJob
        fields = ("id", "url", "mode", "quality", "status", "progress", "file_path", "error", "started_at", "finished_at")
        read_only_fields = fields
