from __future__ import annotations

from collections.abc import Callable

import srt

Translator = Callable[[str, str, str], str]


class InvalidSrt(Exception):
    pass


def translate_srt(content: str, *, source: str, target: str, translator: Translator) -> str:
    try:
        subtitles = list(srt.parse(content))
    except (srt.SRTParseError, ValueError) as exc:
        raise InvalidSrt(str(exc)) from exc

    for subtitle in subtitles:
        if subtitle.content.strip():
            subtitle.content = translator(subtitle.content, source, target)

    return srt.compose(subtitles)
