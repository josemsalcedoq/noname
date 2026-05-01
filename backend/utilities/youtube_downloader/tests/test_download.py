import json
from pathlib import Path

import pytest
from django.test import Client
from pytest_bdd import given, parsers, scenarios, then, when

from utilities.youtube_downloader.models import YoutubeJob

scenarios(str(Path(__file__).parent / "features" / "download.feature"))

pytestmark = pytest.mark.django_db


@pytest.fixture
def state():
    return {"response": None, "job": None}


@pytest.fixture
def client():
    return Client()


@pytest.fixture(autouse=True)
def disable_thread_spawn(monkeypatch):
    monkeypatch.setattr(
        "utilities.youtube_downloader.services.start_download",
        lambda job: None,
    )


@given(parsers.parse('a running job exists for "{url}"'))
def _running_job(state, url):
    state["job"] = YoutubeJob.objects.create(
        url=url, mode=YoutubeJob.Mode.VIDEO, quality="720p", status=YoutubeJob.Status.RUNNING,
    )


@given(parsers.parse('a finished job exists for "{url}"'))
def _finished_job(state, url):
    state["job"] = YoutubeJob.objects.create(
        url=url, mode=YoutubeJob.Mode.VIDEO, quality="720p", status=YoutubeJob.Status.DONE,
    )


@when(parsers.parse('the client probes the URL "{url}"'))
def _probe(state, client, url):
    state["response"] = client.post(
        "/api/youtube-downloader/probe",
        data=json.dumps({"url": url}),
        content_type="application/json",
    )


@when(parsers.parse('the client requests a download for "{url}" with mode "{mode}" and quality "{quality}"'))
def _download(state, client, url, mode, quality):
    state["response"] = client.post(
        "/api/youtube-downloader/download",
        data=json.dumps({"url": url, "mode": mode, "quality": quality}),
        content_type="application/json",
    )


@when("the client cancels the job")
def _cancel(state, client):
    state["response"] = client.post(f"/api/youtube-downloader/cancel/{state['job'].id}")


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code


@then(parsers.parse('the response error code is "{code}"'))
def _error_code(state, code):
    assert state["response"].json()["error"] == code


@then(parsers.parse('the job status is "{value}"'))
def _job_status(state, value):
    state["job"].refresh_from_db()
    assert state["job"].status == value
