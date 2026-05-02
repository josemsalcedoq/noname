from __future__ import annotations

import re
import time
from typing import Any

import requests
from django.db import transaction

from .models import Collection, Environment, Folder, RequestNode

VAR_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}")
TIMEOUT_SECONDS = 30
MAX_RESPONSE_BYTES = 10 * 1024 * 1024  # 10 MB


class SendError(Exception):
    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.detail = detail


def interpolate(text: str, variables: dict[str, str]) -> tuple[str, list[str]]:
    unknown: list[str] = []

    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key in variables:
            return variables[key]
        if key not in unknown:
            unknown.append(key)
        return match.group(0)

    return VAR_RE.sub(replace, text), unknown


def env_variables(environment_id: int | None) -> dict[str, str]:
    if environment_id is None:
        return {}
    env = Environment.objects.filter(pk=environment_id).first()
    if env is None:
        return {}
    return {
        item.get("key"): item.get("value", "")
        for item in env.variables
        if item.get("enabled", True) and item.get("key")
    }


def send_request(payload: dict[str, Any]) -> dict[str, Any]:
    variables = env_variables(payload.get("environment_id"))
    unknown_vars: list[str] = []

    url, missing = interpolate(payload["url"], variables)
    unknown_vars.extend(missing)

    headers: dict[str, str] = {}
    for entry in payload.get("headers") or []:
        if not entry.get("enabled", True):
            continue
        key = (entry.get("key") or "").strip()
        if not key:
            continue
        value, missing = interpolate(entry.get("value") or "", variables)
        unknown_vars.extend(missing)
        headers[key] = value

    params_pairs: list[tuple[str, str]] = []
    for entry in payload.get("params") or []:
        if not entry.get("enabled", True):
            continue
        key = (entry.get("key") or "").strip()
        if not key:
            continue
        value, missing = interpolate(entry.get("value") or "", variables)
        unknown_vars.extend(missing)
        params_pairs.append((key, value))

    body_type = payload.get("body_type", "none")
    body_text = payload.get("body") or ""
    body_text, missing = interpolate(body_text, variables)
    unknown_vars.extend(missing)

    request_kwargs: dict[str, Any] = {
        "method": (payload.get("method") or "GET").upper(),
        "url": url,
        "headers": headers,
        "params": params_pairs,
        "timeout": TIMEOUT_SECONDS,
        "allow_redirects": True,
    }
    if body_type == "json":
        request_kwargs["data"] = body_text
        request_kwargs["headers"].setdefault("Content-Type", "application/json")
    elif body_type == "raw":
        request_kwargs["data"] = body_text
    elif body_type == "urlencoded":
        request_kwargs["data"] = body_text
        request_kwargs["headers"].setdefault("Content-Type", "application/x-www-form-urlencoded")

    started = time.monotonic()
    try:
        response = requests.request(**request_kwargs)
    except requests.exceptions.Timeout as exc:
        raise SendError("upstream_timeout", str(exc)) from exc
    except requests.exceptions.ConnectionError as exc:
        raise SendError("upstream_unreachable", str(exc)) from exc
    except requests.exceptions.RequestException as exc:
        raise SendError("upstream_error", str(exc)) from exc

    duration_ms = int((time.monotonic() - started) * 1000)
    raw_body = response.content
    truncated = False
    if len(raw_body) > MAX_RESPONSE_BYTES:
        raw_body = raw_body[:MAX_RESPONSE_BYTES]
        truncated = True
    try:
        body = raw_body.decode(response.encoding or "utf-8", errors="replace")
    except (LookupError, TypeError):
        body = raw_body.decode("utf-8", errors="replace")

    return {
        "status": response.status_code,
        "status_text": response.reason or "",
        "headers": dict(response.headers),
        "body": body,
        "duration_ms": duration_ms,
        "size_bytes": len(response.content),
        "truncated": truncated,
        "resolved_url": str(response.url),
        "unknown_vars": list(dict.fromkeys(unknown_vars)),
    }


@transaction.atomic
def import_postman_v21(payload: dict[str, Any]) -> Collection:
    info = payload.get("info") or {}
    collection = Collection.objects.create(
        name=info.get("name") or "Imported collection",
        description=info.get("description") or "",
    )
    _import_items(collection, payload.get("item") or [], parent_folder=None, position_offset=0)
    return collection


def _import_items(
    collection: Collection,
    items: list[dict[str, Any]],
    parent_folder: Folder | None,
    position_offset: int,
) -> None:
    folder_pos = position_offset
    request_pos = position_offset
    for item in items:
        if "request" in item:
            url, headers, params, body_text, body_type = _translate_request(item.get("request") or {})
            RequestNode.objects.create(
                collection=collection,
                folder=parent_folder,
                name=item.get("name") or "untitled",
                method=(item.get("request") or {}).get("method", "GET").upper(),
                url=url,
                headers=headers,
                params=params,
                body=body_text,
                body_type=body_type,
                position=request_pos,
            )
            request_pos += 1
        elif "item" in item:
            folder = Folder.objects.create(
                collection=collection,
                parent=parent_folder,
                name=item.get("name") or "folder",
                position=folder_pos,
            )
            _import_items(collection, item.get("item") or [], folder, position_offset=0)
            folder_pos += 1


def _translate_request(req: dict[str, Any]) -> tuple[str, list[dict], list[dict], str, str]:
    url_field = req.get("url")
    if isinstance(url_field, str):
        url = url_field
    elif isinstance(url_field, dict):
        url = url_field.get("raw") or ""
    else:
        url = ""

    headers = [
        {"key": h.get("key", ""), "value": h.get("value", ""), "enabled": not h.get("disabled", False)}
        for h in req.get("header") or []
        if h.get("key")
    ]

    params: list[dict] = []
    if isinstance(url_field, dict):
        for q in url_field.get("query") or []:
            params.append(
                {"key": q.get("key", ""), "value": q.get("value", ""), "enabled": not q.get("disabled", False)}
            )

    body_text = ""
    body_type = "none"
    body = req.get("body") or {}
    mode = body.get("mode")
    if mode == "raw":
        body_text = body.get("raw") or ""
        language = (body.get("options") or {}).get("raw", {}).get("language", "").lower()
        body_type = "json" if language == "json" else "raw"
    elif mode == "urlencoded":
        pairs = [
            f"{p.get('key', '')}={p.get('value', '')}"
            for p in body.get("urlencoded") or []
            if not p.get("disabled", False)
        ]
        body_text = "&".join(pairs)
        body_type = "urlencoded"

    return url, headers, params, body_text, body_type


def collection_tree(collection: Collection) -> list[dict[str, Any]]:
    folders = list(collection.folders.all())
    requests_qs = list(collection.requests.all())
    by_parent: dict[int | None, list[dict[str, Any]]] = {}

    for folder in folders:
        node = {
            "id": folder.id,
            "name": folder.name,
            "kind": "folder",
            "position": folder.position,
            "children": [],
        }
        by_parent.setdefault(folder.parent_id, []).append(node)

    for request_node in requests_qs:
        node = {
            "id": request_node.id,
            "name": request_node.name,
            "kind": "request",
            "method": request_node.method,
            "position": request_node.position,
        }
        by_parent.setdefault(request_node.folder_id, []).append(node)

    def attach(parent_key: int | None) -> list[dict[str, Any]]:
        nodes = sorted(by_parent.get(parent_key, []), key=lambda n: (n["position"], n["name"]))
        for node in nodes:
            if node["kind"] == "folder":
                node["children"] = attach(node["id"])
        return nodes

    return attach(None)
