# 08 — MCP server (expose utilities to Claude Code)

## Goal
A local **Model Context Protocol** server that wraps the noname backend utilities as MCP tools. Claude Code (and any MCP-compatible client) can invoke `text_translate`, `transcribe_audio`, `hash_text`, etc. directly inside a conversation — no copy-paste, no GUI round-trip.

## Why
- The user lives in Claude Code (skills catalog confirms it).
- Today the utilities are GUI-only. An MCP wrapper makes them callable as tools during a chat.
- This is the feature that makes the project legitimately unique — a personal utilities hub that Claude itself can use.

## Architecture
- New top-level `mcp-server/` Poetry project (separate from `backend/` to keep deps small).
- Talks to the running local backend via HTTP (`localhost:8000`), reusing the same endpoints the frontend uses. **Single source of truth.**
- **Stdio transport** — Claude Code spawns the server as a subprocess and talks via stdin/stdout.
- Backend URL configurable via `NONAME_BACKEND_URL` env var (default `http://localhost:8000`).

## Tools (Phase 1)

| Tool | Backed by | Notes |
|------|-----------|-------|
| `text_translate` | `POST /api/text-translator/translate` | text in, text out, lang interpolation |
| `detect_language` | same as above (uses `auto`) | returns the detected source code |
| `translate_srt_text` | `POST /api/srt-translator/translate` | accepts SRT string, returns translated SRT string |
| `transcribe_audio` | `POST /api/audio-transcriber/transcribe` | takes a local file path, posts multipart |
| `translate_docx_file` | `POST /api/docx-translator/translate` | takes a local file path, returns saved-to-disk path |
| `http_send` | `POST /api/http-client/send` | thin wrapper to send arbitrary HTTP from inside Claude |
| `hash_text` | (in-process) | MD5 / SHA-1 / SHA-256 / SHA-512 — pure stdlib |
| `format_convert` | (in-process) | JSON ↔ YAML ↔ TOML ↔ CSV |
| `qr_to_ascii` | (in-process) | text → ASCII QR for terminal rendering |
| `generate_uuid` | (in-process) | uuid4 / nanoid |

In-process tools don't need the backend running — they're pure stdlib.

## Out of scope (v1)
- YouTube downloader tool (long-polling makes it awkward as a synchronous MCP call — Phase 2 with a `wait_for_job` design).
- MCP Resources (e.g. expose collections / notes as readable resources).
- MCP Prompts (templated workflows).
- Authentication (single-user local — Claude Code already runs as the user).

## Configuration
After `poetry install` in `mcp-server/`, the user adds this to their `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "noname": {
      "command": "poetry",
      "args": ["--directory", "/Users/josh/Documents/projects/noname/mcp-server", "run", "noname-mcp"]
    }
  }
}
```

Or, after `pipx install` of the wheel:

```json
{
  "mcpServers": {
    "noname": {
      "command": "noname-mcp"
    }
  }
}
```

The backend must be running (`make backend`) for the network-backed tools. In-process tools work without it.

## BDD-style smoke checks (no full pytest harness in v1)

```gherkin
Feature: MCP tools

  Scenario: text_translate returns expected shape
    Given the noname backend is running
    When the client calls tool "text_translate" with text="Hello", source="en", target="es"
    Then the response is {"text": "Hola", "detected_source": null}

  Scenario: hash_text computes SHA-256 in-process
    When the client calls tool "hash_text" with text="abc", algorithm="SHA-256"
    Then the response.digest equals "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

  Scenario: format_convert handles JSON to YAML
    When the client calls tool "format_convert" with text='{"a":1}', from_format="json", to_format="yaml"
    Then the response.text equals "a: 1\n"
```

## Tech notes
- Python 3.13.
- Deps: `mcp[cli]` (high-level FastMCP), `requests`, `pyyaml`, `tomli-w`, `qrcode`.
- Layout:
  ```
  mcp-server/
  ├── pyproject.toml
  ├── poetry.lock
  ├── README.md
  └── noname_mcp/
      ├── __init__.py
      ├── __main__.py
      ├── server.py        # FastMCP + tool registrations
      ├── backend.py       # HTTP client wrapping the backend
      └── pure.py          # in-process tools (hash, format, qr, uuid)
  ```
- `pyproject.toml` declares a `noname-mcp` console script entry point so `poetry run noname-mcp` (or `noname-mcp` after `pipx install`) starts the server.

## Risks / open questions
- **Backend not running** — tools that need it return a clear error to Claude ("backend not reachable, run `make backend`"). In-process tools still work.
- **Long-running tools** (YouTube download, big audio transcription) — MCP tools are synchronous; client may time out. Skip in v1 or split into start+wait pair in v2.
- **File path semantics** — local file path arguments only work when MCP server and Claude Code run on the same machine. Documented.
- **Backend API changes** — if backend endpoint shape changes, MCP wrapper breaks. Tests are minimal in v1; integration tests later.
