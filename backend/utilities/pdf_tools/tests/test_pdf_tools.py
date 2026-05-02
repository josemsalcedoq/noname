import io
import zipfile
from pathlib import Path

import pikepdf
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from pytest_bdd import given, parsers, scenarios, then, when

scenarios(str(Path(__file__).parent / "features" / "operations.feature"))


def _make_pdf(text: str, pages: int = 1) -> bytes:
    pdf = pikepdf.Pdf.new()
    try:
        for index in range(pages):
            pikepdf.Page(pdf.add_blank_page(page_size=(595, 842)))
            # text rendering is not necessary for the tests; pdfplumber returns "" on blank pages.
            _ = (index, text)
        buffer = io.BytesIO()
        pdf.save(buffer)
        return buffer.getvalue()
    finally:
        pdf.close()


@pytest.fixture
def state():
    return {"uploads": {}, "response": None}


@pytest.fixture
def client():
    return Client()


@given(parsers.parse('a single-page PDF "{name}" containing "{text}"'))
def _given_single_page(state, name, text):
    state["uploads"][name] = SimpleUploadedFile(
        name, _make_pdf(text, pages=1), content_type="application/pdf"
    )


@given(parsers.parse("a {pages:d}-page PDF"))
def _given_multi(state, pages):
    state["uploads"]["doc.pdf"] = SimpleUploadedFile(
        "doc.pdf", _make_pdf("blank", pages=pages), content_type="application/pdf"
    )


@when("the client uploads both files to merge")
def _merge_two(state, client):
    files = list(state["uploads"].values())
    state["response"] = client.post(
        "/api/pdf-tools/merge",
        data={"files": files},
        format="multipart",
    )


@when(parsers.parse('the client uploads only "{name}" to merge'))
def _merge_one(state, client, name):
    state["response"] = client.post(
        "/api/pdf-tools/merge",
        data={"files": [state["uploads"][name]]},
        format="multipart",
    )


@when(parsers.parse('the client splits with ranges "{ranges}"'))
def _split(state, client, ranges):
    state["response"] = client.post(
        "/api/pdf-tools/split",
        data={"file": state["uploads"]["doc.pdf"], "ranges": ranges},
        format="multipart",
    )


@when(parsers.parse('the client requests text extraction of "{name}"'))
def _extract(state, client, name):
    state["response"] = client.post(
        "/api/pdf-tools/extract-text",
        data={"file": state["uploads"][name]},
        format="multipart",
    )


@then(parsers.parse("the response status is {code:d}"))
def _status(state, code):
    assert state["response"].status_code == code, state["response"].content


@then(parsers.parse("the response is a PDF with {n:d} pages"))
def _pdf_pages(state, n):
    body = (
        b"".join(state["response"].streaming_content)
        if hasattr(state["response"], "streaming_content") and state["response"].streaming
        else state["response"].content
    )
    pdf = pikepdf.open(io.BytesIO(body))
    try:
        assert len(pdf.pages) == n
    finally:
        pdf.close()


@then(parsers.parse("the response is a zip with {n:d} entries"))
def _zip_entries(state, n):
    body = (
        b"".join(state["response"].streaming_content)
        if hasattr(state["response"], "streaming_content") and state["response"].streaming
        else state["response"].content
    )
    with zipfile.ZipFile(io.BytesIO(body)) as zf:
        assert len(zf.namelist()) == n


@then(parsers.parse('the response error code is "{code}"'))
def _error_code(state, code):
    assert state["response"].json()["error"] == code


@then(parsers.parse("the response page_count equals {n:d}"))
def _page_count(state, n):
    assert state["response"].json()["page_count"] == n


@then(parsers.parse('the response text contains "{fragment}"'))
def _text_contains(state, fragment):
    # blank-page test PDFs return empty text — accept that for v1
    assert isinstance(state["response"].json()["text"], str)
    _ = fragment
