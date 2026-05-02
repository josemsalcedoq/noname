import json
from pathlib import Path
from unittest.mock import patch

import pytest
import requests
from django.test import Client
from pytest_bdd import given, parsers, scenarios, then, when

from utilities.http_client.models import Collection, Environment, Folder, RequestNode

FEATURES_DIR = Path(__file__).parent / "features"
scenarios(str(FEATURES_DIR / "send.feature"))
scenarios(str(FEATURES_DIR / "import.feature"))

pytestmark = pytest.mark.django_db


class FakeResponse:
    def __init__(self, status_code: int = 200, body: bytes = b"", headers: dict | None = None, url: str = ""):
        self.status_code = status_code
        self.content = body
        self.headers = headers or {}
        self.encoding = "utf-8"
        self.reason = "OK"
        self.url = url


@pytest.fixture
def state():
    return {
        "response": None,
        "captured": {},
        "collection": None,
        "request_node": None,
        "import_payload": None,
    }


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def fake_requests(monkeypatch, state):
    state["captured"] = {}

    def fake_request(**kwargs):
        captured = state["captured"]
        captured["method"] = kwargs.get("method")
        captured["url"] = kwargs.get("url")
        captured["headers"] = kwargs.get("headers", {})
        captured["params"] = kwargs.get("params", [])
        captured["data"] = kwargs.get("data", "")

        host = kwargs.get("url", "")
        if "example.invalid" in host:
            raise requests.exceptions.ConnectionError("Name resolution failure")
        return FakeResponse(status_code=200, body=b"ok", headers={}, url=kwargs.get("url", ""))

    monkeypatch.setattr("utilities.http_client.services.requests.request", fake_request)
    return state


@given(parsers.parse('an environment "{name}" with variables host="{host}" and token="{token}"'))
def _env(state, name, host, token):
    Environment.objects.create(
        name=name,
        variables=[
            {"key": "host", "value": host, "enabled": True},
            {"key": "token", "value": token, "enabled": True},
        ],
    )


@when(parsers.parse('the client sends GET to "{url}" with header "{header}" using environment "{env_name}"'))
def _send_with_env(client, fake_requests, state, url, header, env_name):
    env = Environment.objects.get(name=env_name)
    key, value = header.split("=", 1)
    state["response"] = client.post(
        "/api/http-client/send",
        data=json.dumps(
            {
                "method": "GET",
                "url": url,
                "headers": [{"key": key, "value": value, "enabled": True}],
                "environment_id": env.id,
            }
        ),
        content_type="application/json",
    )


@when(parsers.parse('the client sends GET to "{url}" with no environment'))
def _send_no_env(client, fake_requests, state, url):
    state["response"] = client.post(
        "/api/http-client/send",
        data=json.dumps({"method": "GET", "url": url}),
        content_type="application/json",
    )


@when(parsers.parse('the client sends GET to "{url}"'))
def _send_basic(client, fake_requests, state, url):
    state["response"] = client.post(
        "/api/http-client/send",
        data=json.dumps({"method": "GET", "url": url}),
        content_type="application/json",
    )


@when(parsers.parse('the client sends POST to "{url}" with json body "{body}"'))
def _send_json(client, fake_requests, state, url, body):
    state["response"] = client.post(
        "/api/http-client/send",
        data=json.dumps({"method": "POST", "url": url, "body": body, "body_type": "json"}),
        content_type="application/json",
    )


@then(parsers.parse('the upstream received URL is "{url}"'))
def _upstream_url(state, url):
    assert state["captured"]["url"] == url


@then(parsers.parse('the upstream received header "{name}" equals "{value}"'))
def _upstream_header(state, name, value):
    assert state["captured"]["headers"].get(name) == value


@then(parsers.parse('the response unknown_vars contains "{name}"'))
def _response_unknown_vars(state, name):
    assert name in state["response"].json()["unknown_vars"]


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code, state["response"].content


@then(parsers.parse('the response error code is "{code}"'))
def _error_code(state, code):
    assert state["response"].json()["error"] == code


@given(parsers.parse('a Postman v2.1 payload with collection "{name}" and folder "{folder}" containing requests "{r1}" and "{r2}"'))
def _payload_collection(state, name, folder, r1, r2):
    state["import_payload"] = {
        "info": {"name": name, "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
        "item": [
            {
                "name": folder,
                "item": [
                    {"name": r1, "request": {"method": "GET", "url": {"raw": "https://example.test/users"}}},
                    {"name": r2, "request": {"method": "GET", "url": {"raw": "https://example.test/users/1"}}},
                ],
            }
        ],
    }


@given(parsers.parse('a Postman v2.1 payload with a request whose url is "{url}"'))
def _payload_url(state, url):
    state["import_payload"] = {
        "info": {"name": "X", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
        "item": [{"name": "r", "request": {"method": "GET", "url": {"raw": url}}}],
    }


@given("a JSON payload without an info object")
def _bad_payload(state):
    state["import_payload"] = {"item": []}


@when("the client posts the payload to import")
def _post_import(state, client):
    state["response"] = client.post(
        "/api/http-client/collections/import",
        data=json.dumps(state["import_payload"]),
        content_type="application/json",
    )


@then(parsers.parse('the collection tree has folder "{folder_name}" with {count:d} requests'))
def _tree_folder(state, client, folder_name, count):
    collection_id = state["response"].json()["id"]
    response = client.get(f"/api/http-client/collections/{collection_id}/tree")
    items = response.json()["items"]
    folder = next(item for item in items if item["kind"] == "folder" and item["name"] == folder_name)
    assert len(folder["children"]) == count


@then(parsers.parse('the imported request url is "{url}"'))
def _imported_url(state, url):
    collection_id = state["response"].json()["id"]
    request_node = RequestNode.objects.filter(collection_id=collection_id).first()
    assert request_node is not None
    assert request_node.url == url
