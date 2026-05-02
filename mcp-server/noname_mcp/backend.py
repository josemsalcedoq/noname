from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import requests

DEFAULT_BACKEND = "http://localhost:8000"


class BackendUnavailable(RuntimeError):
    """Raised when the noname backend is not reachable."""


def _base_url() -> str:
    return os.environ.get("NONAME_BACKEND_URL", DEFAULT_BACKEND).rstrip("/")


def _post_json(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_base_url()}{path}"
    try:
        response = requests.post(url, json=payload, timeout=60)
    except requests.exceptions.ConnectionError as exc:
        raise BackendUnavailable(
            f"Could not reach the noname backend at {_base_url()}. "
            "Start it with `make backend` from the project root."
        ) from exc
    response.raise_for_status()
    return response.json()


def _post_multipart(path: str, files: dict[str, Any], data: dict[str, str]) -> requests.Response:
    url = f"{_base_url()}{path}"
    try:
        response = requests.post(url, files=files, data=data, timeout=600)
    except requests.exceptions.ConnectionError as exc:
        raise BackendUnavailable(
            f"Could not reach the noname backend at {_base_url()}. "
            "Start it with `make backend` from the project root."
        ) from exc
    response.raise_for_status()
    return response


def text_translate(text: str, source: str, target: str) -> dict[str, Any]:
    return _post_json(
        "/api/text-translator/translate",
        {"text": text, "source": source, "target": target},
    )


def srt_translate_text(srt_content: str, source: str, target: str) -> str:
    files = {"file": ("input.srt", srt_content.encode("utf-8"), "application/x-subrip")}
    data = {"source": source, "target": target}
    response = _post_multipart("/api/srt-translator/translate", files=files, data=data)
    return response.content.decode("utf-8")


def transcribe_audio(file_path: str, *, model_size: str = "base", language: str | None = None) -> dict[str, Any]:
    path = Path(file_path).expanduser()
    if not path.is_file():
        raise FileNotFoundError(f"No such file: {path}")
    with path.open("rb") as fh:
        files = {"file": (path.name, fh, "application/octet-stream")}
        data: dict[str, str] = {"model_size": model_size}
        if language:
            data["language"] = language
        response = _post_multipart("/api/audio-transcriber/transcribe", files=files, data=data)
    return response.json()


def docx_translate(file_path: str, *, source: str, target: str, output_dir: str | None = None) -> str:
    path = Path(file_path).expanduser()
    if not path.is_file():
        raise FileNotFoundError(f"No such file: {path}")
    with path.open("rb") as fh:
        files = {"file": (path.name, fh, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        data = {"source": source, "target": target}
        response = _post_multipart("/api/docx-translator/translate", files=files, data=data)
    out_dir = Path(output_dir).expanduser() if output_dir else path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{path.stem}_{target}.docx"
    out_path.write_bytes(response.content)
    return str(out_path)


def http_send(method: str, url: str, *, headers: list[dict[str, str]] | None = None, body: str = "", body_type: str = "none") -> dict[str, Any]:
    return _post_json(
        "/api/http-client/send",
        {
            "method": method,
            "url": url,
            "headers": headers or [],
            "params": [],
            "body": body,
            "body_type": body_type,
        },
    )


def youtube_probe(url: str) -> dict[str, Any]:
    return _post_json("/api/youtube-downloader/probe", {"url": url})


def youtube_download(url: str, *, mode: str = "video", quality: str = "720p") -> dict[str, Any]:
    return _post_json(
        "/api/youtube-downloader/download",
        {"url": url, "mode": mode, "quality": quality},
    )


def youtube_job(job_id: str) -> dict[str, Any]:
    response = requests.get(f"{_base_url()}/api/youtube-downloader/progress/{job_id}", timeout=10)
    response.raise_for_status()
    return response.json()


def get_collections() -> list[dict[str, Any]]:
    response = requests.get(f"{_base_url()}/api/http-client/collections", timeout=10)
    response.raise_for_status()
    return response.json()


def get_notes() -> list[dict[str, Any]]:
    response = requests.get(f"{_base_url()}/api/personal-hub/notes", timeout=10)
    response.raise_for_status()
    return response.json()


def get_todos(*, status: str = "open") -> list[dict[str, Any]]:
    response = requests.get(
        f"{_base_url()}/api/personal-hub/todos?status={status}", timeout=10
    )
    response.raise_for_status()
    return response.json()


def get_bookmarks() -> list[dict[str, Any]]:
    response = requests.get(f"{_base_url()}/api/personal-hub/bookmarks", timeout=10)
    response.raise_for_status()
    return response.json()
