# noname-mcp

MCP server that exposes the local noname backend utilities as tools, so Claude Code (or any MCP client) can invoke `text_translate`, `transcribe_audio`, `hash_text`, etc. during a conversation.

## Tools

| Tool | Backend? | Notes |
|------|----------|-------|
| `text_translate` | yes | EN ↔ ES via local NMT |
| `detect_language` | yes | "en" or "es" |
| `translate_srt_text` | yes | translate subtitle text, timestamps preserved |
| `transcribe_audio` | yes | Whisper (faster-whisper) on a local file path |
| `translate_docx_file` | yes | translates and saves a new .docx |
| `http_send` | yes | send arbitrary HTTP via the local HTTP-client backend |
| `hash_text` | no | MD5 / SHA-1 / SHA-256 / SHA-512 |
| `format_convert` | no | JSON ↔ YAML ↔ TOML ↔ CSV |
| `qr_to_ascii` | no | terminal-printable QR |
| `generate_uuid` | no | batch UUID v4 |

"Backend? = yes" means the noname Django backend must be running (`make backend` from the project root).

## Install

From the project root:

```bash
cd mcp-server
poetry install
```

## Configure Claude Code

Add to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "noname": {
      "command": "poetry",
      "args": [
        "--directory",
        "/Users/josh/Documents/projects/noname/mcp-server",
        "run",
        "noname-mcp"
      ]
    }
  }
}
```

(Adjust the absolute path if your checkout lives elsewhere.)

Restart Claude Code. The `noname` server should appear under MCP servers, and its tools become available in any conversation. Test with `/mcp` inside Claude Code.

## Backend URL

By default the server talks to `http://localhost:8000`. Override with the `NONAME_BACKEND_URL` env var. The pure-stdlib tools (`hash_text`, `format_convert`, `qr_to_ascii`, `generate_uuid`) work without the backend running.

## Smoke-test the server manually

```bash
poetry run noname-mcp
# Server speaks JSON-RPC over stdio. Use the MCP Inspector for interactive testing:
poetry run mcp dev noname_mcp/server.py
```
