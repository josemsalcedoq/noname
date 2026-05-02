"""In-process tools — no backend required."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import uuid
from typing import Any

import qrcode
import tomli_w
import yaml

ALGORITHMS = {
    "MD5": hashlib.md5,
    "SHA-1": hashlib.sha1,
    "SHA-256": hashlib.sha256,
    "SHA-512": hashlib.sha512,
}


def hash_text(text: str, algorithm: str = "SHA-256") -> str:
    if algorithm not in ALGORITHMS:
        raise ValueError(f"Unsupported algorithm: {algorithm}. Pick one of {sorted(ALGORITHMS)}.")
    return ALGORITHMS[algorithm](text.encode("utf-8")).hexdigest()


def format_convert(text: str, from_format: str, to_format: str) -> str:
    data = _parse(text, from_format)
    return _serialize(data, to_format)


def _parse(text: str, fmt: str) -> Any:
    fmt = fmt.lower()
    if fmt == "json":
        return json.loads(text)
    if fmt == "yaml":
        return yaml.safe_load(text)
    if fmt == "toml":
        import tomllib

        return tomllib.loads(text)
    if fmt == "csv":
        rows = list(csv.DictReader(io.StringIO(text.strip())))
        return rows
    raise ValueError(f"Unsupported source format: {fmt}")


def _serialize(data: Any, fmt: str) -> str:
    fmt = fmt.lower()
    if fmt == "json":
        return json.dumps(data, indent=2)
    if fmt == "yaml":
        return yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    if fmt == "toml":
        if not isinstance(data, dict):
            raise ValueError("TOML output requires a top-level object.")
        return tomli_w.dumps(data)
    if fmt == "csv":
        if not isinstance(data, list) or not all(isinstance(row, dict) for row in data):
            raise ValueError("CSV output requires an array of objects.")
        if not data:
            return ""
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(data[0].keys()))
        writer.writeheader()
        writer.writerows(data)
        return buffer.getvalue().rstrip("\n")
    raise ValueError(f"Unsupported target format: {fmt}")


def qr_to_ascii(text: str) -> str:
    if not text:
        raise ValueError("text must be non-empty")
    qr = qrcode.QRCode(border=1)
    qr.add_data(text)
    qr.make(fit=True)
    buffer = io.StringIO()
    qr.print_ascii(out=buffer, invert=True)
    return buffer.getvalue()


def generate_uuid(count: int = 1) -> list[str]:
    if count < 1 or count > 1000:
        raise ValueError("count must be between 1 and 1000")
    return [str(uuid.uuid4()) for _ in range(count)]
