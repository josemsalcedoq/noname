from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from pytest_bdd import given, parsers, scenarios, then, when

from utilities.audio_transcriber import services

scenarios(str(Path(__file__).parent / "features" / "transcribe.feature"))


@pytest.fixture
def state():
    return {"response": None, "fake_segments": []}


@pytest.fixture
def client():
    return Client()


@pytest.fixture(autouse=True)
def fake_transcribe(monkeypatch, state):
    def _fake(file_path, *, model_size="base", language=None):
        segments = [services.Segment(start=s, end=e, text=t) for s, e, t in state["fake_segments"]]
        text = "\n".join(seg.text for seg in segments if seg.text)
        srt_text = services._segments_to_srt(segments)
        return services.TranscriptionResult(
            language=language or "en",
            duration=segments[-1].end if segments else 0.0,
            segments=segments,
            text=text,
            srt=srt_text,
        )

    monkeypatch.setattr("utilities.audio_transcriber.services.transcribe", _fake)


@given(parsers.parse("the transcriber will produce segments {raw}"))
def _given_segments(state, raw):
    cleaned = raw.strip().lstrip("[").rstrip("]")
    items = []
    for chunk in cleaned.split("),"):
        chunk = chunk.strip().strip("()")
        if not chunk:
            continue
        parts = [p.strip() for p in chunk.split(",", 2)]
        start = float(parts[0])
        end = float(parts[1])
        text = parts[2].strip().strip('"')
        items.append((start, end, text))
    state["fake_segments"] = items


@when("the client posts to transcribe with no file")
def _post_no_file(state, client):
    state["response"] = client.post(
        "/api/audio-transcriber/transcribe",
        data={"model_size": "base"},
        format="multipart",
    )


@when(parsers.parse('the client uploads a file named "{name}" to transcribe'))
def _upload_named(state, client, name):
    upload = SimpleUploadedFile(name, b"not real audio", content_type="text/plain")
    state["response"] = client.post(
        "/api/audio-transcriber/transcribe",
        data={"file": upload, "model_size": "base"},
        format="multipart",
    )


@when(parsers.parse('the client uploads "{name}" with model_size "{model_size}"'))
def _upload_with_model(state, client, name, model_size):
    upload = SimpleUploadedFile(name, b"\x00\x01\x02", content_type="audio/mpeg")
    state["response"] = client.post(
        "/api/audio-transcriber/transcribe",
        data={"file": upload, "model_size": model_size},
        format="multipart",
    )


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code, state["response"].content


@then(parsers.parse('the response error code is "{code}"'))
def _error_code(state, code):
    assert state["response"].json()["error"] == code


@then(parsers.parse('the response language is "{value}"'))
def _language(state, value):
    assert state["response"].json()["language"] == value


@then(parsers.parse('the response text is "{value}"'))
def _text(state, value):
    expected = value.replace("\\n", "\n")
    assert state["response"].json()["text"] == expected


@then(parsers.parse('the response srt contains "{fragment}"'))
def _srt_contains(state, fragment):
    assert fragment in state["response"].json()["srt"]
