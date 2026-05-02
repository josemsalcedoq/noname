from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

import srt
from django.conf import settings

SUPPORTED_MODELS = ("tiny", "base", "small", "medium")
DEFAULT_MODEL = "base"

os.environ.setdefault("HF_HOME", str(Path(settings.MODELS_DIR) / "huggingface"))


@dataclass(frozen=True)
class Segment:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class TranscriptionResult:
    language: str
    duration: float
    segments: list[Segment]
    text: str
    srt: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "language": self.language,
            "duration": self.duration,
            "segments": [{"start": s.start, "end": s.end, "text": s.text} for s in self.segments],
            "text": self.text,
            "srt": self.srt,
        }


_model_cache: dict[str, object] = {}


def _get_model(model_size: str):
    if model_size not in _model_cache:
        from faster_whisper import WhisperModel

        _model_cache[model_size] = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _model_cache[model_size]


def transcribe(
    file_path: Path, *, model_size: str = DEFAULT_MODEL, language: str | None = None
) -> TranscriptionResult:
    if model_size not in SUPPORTED_MODELS:
        raise ValueError(f"Unsupported model_size: {model_size}")

    model = _get_model(model_size)
    segments_iter, info = model.transcribe(
        str(file_path),
        language=language,
        beam_size=1,
        vad_filter=True,
    )

    segments = [Segment(start=s.start, end=s.end, text=s.text.strip()) for s in segments_iter]
    text = "\n".join(seg.text for seg in segments if seg.text)
    srt_text = _segments_to_srt(segments)
    return TranscriptionResult(
        language=info.language,
        duration=info.duration,
        segments=segments,
        text=text,
        srt=srt_text,
    )


def _segments_to_srt(segments: list[Segment]) -> str:
    items = [
        srt.Subtitle(
            index=i + 1,
            start=timedelta(seconds=seg.start),
            end=timedelta(seconds=seg.end),
            content=seg.text,
        )
        for i, seg in enumerate(segments)
        if seg.text.strip()
    ]
    return srt.compose(items)
