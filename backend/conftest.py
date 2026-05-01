import pytest


@pytest.fixture
def fake_translate(monkeypatch):
    def _translate(text: str, source: str, target: str) -> str:
        return f"[{source}->{target}] {text}"

    monkeypatch.setattr("shared.nmt.engine.translate", _translate)
    return _translate


@pytest.fixture
def fake_detect(monkeypatch):
    holder = {"value": "en"}

    def _detect(text: str) -> str | None:
        return holder["value"]

    def _set(value: str | None):
        holder["value"] = value

    monkeypatch.setattr("shared.nmt.engine.detect", _detect)
    return _set
