import json
from pathlib import Path

import pytest
from django.test import Client
from pytest_bdd import given, parsers, scenarios, then, when

scenarios(str(Path(__file__).parent / "features" / "translate.feature"))


@pytest.fixture
def state():
    return {"payload": {}, "response": None}


@pytest.fixture
def client():
    return Client()


@given(parsers.parse('the source language is "{source}" and the target language is "{target}"'))
def _languages(state, source, target):
    state["payload"]["source"] = source
    state["payload"]["target"] = target


@given(parsers.parse('the input text is "{text}"'))
def _input_text(state, text):
    state["payload"]["text"] = text


@given('the input text is ""')
def _empty_input_text(state):
    state["payload"]["text"] = ""


@given("the input text exceeds 50000 characters")
def _oversize_input(state):
    state["payload"]["text"] = "a" * 50_001


@given(parsers.parse('the language detector reports "{value}"'))
def _detector_returns(fake_detect, value):
    fake_detect(value)


@given("the language detector reports nothing")
def _detector_returns_none(fake_detect):
    fake_detect(None)


@when("the client posts to the translate endpoint")
def _post(client, state, fake_translate):
    state["response"] = client.post(
        "/api/text-translator/translate",
        data=json.dumps(state["payload"]),
        content_type="application/json",
    )


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code


@then(parsers.parse('the response text equals "{value}"'))
def _text_equals(state, value):
    assert state["response"].json()["text"] == value


@then('the response text equals ""')
def _text_empty(state):
    assert state["response"].json()["text"] == ""


@then(parsers.parse('the response detected_source equals "{value}"'))
def _detected_source(state, value):
    assert state["response"].json()["detected_source"] == value
