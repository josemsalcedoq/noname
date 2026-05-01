import os
from pathlib import Path

from django.conf import settings

_models_root: Path = settings.MODELS_DIR / "argos"
_models_root.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("ARGOS_PACKAGES_DIR", str(_models_root))

import argostranslate.package  # noqa: E402
import argostranslate.translate  # noqa: E402
from lingua import Language, LanguageDetectorBuilder  # noqa: E402

_supported_languages = (Language.ENGLISH, Language.SPANISH)
_detector = LanguageDetectorBuilder.from_languages(*_supported_languages).build()
_language_to_code = {Language.ENGLISH: "en", Language.SPANISH: "es"}


def translate(text: str, source: str, target: str) -> str:
    if not text.strip():
        return text
    return argostranslate.translate.translate(text, source, target)


def detect(text: str) -> str | None:
    if not text.strip():
        return None
    language = _detector.detect_language_of(text)
    return _language_to_code.get(language) if language else None
