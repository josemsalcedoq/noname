from datetime import timedelta
from pathlib import Path

import pytest
import srt
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from pytest_bdd import given, parsers, scenarios, then, when

scenarios(str(Path(__file__).parent / "features" / "translate.feature"))


def _build_srt(cues: list[str]) -> bytes:
    items = [
        srt.Subtitle(
            index=i + 1,
            start=timedelta(seconds=i * 4),
            end=timedelta(seconds=i * 4 + 3),
            content=cue,
        )
        for i, cue in enumerate(cues)
    ]
    return srt.compose(items).encode("utf-8")


@pytest.fixture
def state():
    return {"upload": None, "response": None}


@pytest.fixture
def client():
    return Client()


@given(parsers.parse('an SRT with cues "{a}" and "{b}"'))
def _given_two(state, a, b):
    state["upload"] = SimpleUploadedFile(
        "input.srt", _build_srt([a, b]), content_type="application/x-subrip"
    )


@given(parsers.parse('an SRT with cues "{a}"'))
def _given_one(state, a):
    state["upload"] = SimpleUploadedFile(
        "input.srt", _build_srt([a]), content_type="application/x-subrip"
    )


@given("an upload that is not an srt file")
def _given_non_srt(state):
    state["upload"] = SimpleUploadedFile("notes.txt", b"plain text", content_type="text/plain")


@given(parsers.parse('an upload "{name}" with content "{content}"'))
def _given_named(state, name, content):
    state["upload"] = SimpleUploadedFile(
        name, content.encode("utf-8"), content_type="application/x-subrip"
    )


@when(parsers.parse('the client uploads it with source "{source}" and target "{target}"'))
def _upload(state, client, fake_translate, source, target):
    state["response"] = client.post(
        "/api/srt-translator/translate",
        data={"file": state["upload"], "source": source, "target": target},
        format="multipart",
    )


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code, state["response"].content


@then(parsers.parse('the response is an SRT with cues "{a}" and "{b}"'))
def _response_cues(state, a, b):
    body = (
        b"".join(state["response"].streaming_content)
        if state["response"].streaming
        else state["response"].content
    )
    parsed = list(srt.parse(body.decode("utf-8")))
    assert [s.content for s in parsed] == [a, b]


@then(parsers.parse('the response filename ends with "{suffix}"'))
def _filename(state, suffix):
    assert suffix in state["response"]["Content-Disposition"]


@then(parsers.parse('the response error code is "{code}"'))
def _error_code(state, code):
    assert state["response"].json()["error"] == code
