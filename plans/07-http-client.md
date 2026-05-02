# 07 — Utility: HTTP client (Postman-lite local)

## Goal
A local HTTP client like Postman / Insomnia: organize saved requests in collections + nested folders, run them against environments with `{{variable}}` interpolation, see the response, and import Postman v2.1 collection JSON to bring existing work in.

## Why
- Daily-use tool for any backend dev.
- Existing tools (Postman, Insomnia) push you toward cloud sync, accounts, telemetry. We want the opposite: 100% local, single-user, owned by the laptop.
- Sending the request **from the backend** sidesteps CORS entirely.

## Scope by phase

| Phase | Deliverable                                                                           | Status |
|-------|---------------------------------------------------------------------------------------|--------|
| 1     | Collections, nested folders, saved requests, environments, send, Postman v2.1 import  | done   |
| 2.1   | cURL import (paste a `curl ...` command, fill the editor)                              | done   |
| 2.2   | "Copy as cURL" export (build curl command from current state, copy to clipboard)      | done   |
| 2.3   | Request history (auto-recorded `RequestRun`, replay by clicking)                      | done   |
| 2.4   | Auth tabs (Basic, Bearer) that auto-inject the `Authorization` header                 | future |
| 2.5   | Drag-drop reorder in the tree                                                         | future |
| 3     | Pre-request and test scripts (sandboxed JS), GraphQL/WebSocket support                | future |

Phase 1 details below; Phase 2.1–2.3 details inline under "Tech notes" → "Phase 2 additions".

## Inputs / Outputs

### Send a request
- **Input:** `{ method, url, headers, params, body, environmentId? }`. Backend interpolates `{{var}}` from the chosen environment.
- **Output:** `{ status, statusText, headers, body, durationMs, size }`. Body is returned as text; binary truncated to a placeholder.

### Import Postman v2.1 collection
- **Input:** JSON file (multipart upload).
- **Output:** Created Collection + Folders + Requests (recursively from `item[]`). Returns the new `collectionId`.

### CRUD for collections / folders / requests / environments
- Standard REST: GET list, GET detail, POST create, PATCH update, DELETE.

## Functional requirements

### F-Collections / Folders
- F1. A collection has a name and contains a tree of folders + requests.
- F2. Folders can be nested arbitrarily deep (parent_id self-reference).
- F3. Reordering inside a parent uses an integer `position`.
- F4. Deleting a folder cascades to children (folders + requests).

### F-Requests
- F5. Each saved request has: name, method, url (string with `{{var}}` placeholders allowed), headers (list of `{key, value, enabled}`), params (same shape), body (text), body type (`raw`, `form-urlencoded`, `json`, `none`).
- F6. A request belongs to a collection and optionally to a folder (if folder is null → top-level inside the collection).

### F-Environments
- F7. An environment has a name and a list of variables (`{key, value, enabled}`).
- F8. The active environment is selected per-tab in the frontend; backend receives the id at send time.
- F9. Variable resolution: simple `{{name}}` substitution in URL, headers, params, and body. Unknown vars stay as-is and a warning is returned.

### F-Send
- F10. Backend sends the request via `requests`, capping timeout at 30s and response body at 10MB (truncated with notice if exceeded).
- F11. Response includes status code, status text, all headers, body (text), elapsed ms, and approximate size in bytes.
- F12. Errors (timeout, DNS failure, connection refused) return status 502 with `{ error, detail }`.

### F-Postman import
- F13. Accept a JSON file matching Postman Collection v2.1 schema.
- F14. Walk `info.name` → Collection name; recursively walk `item[]` to materialize folders and requests.
- F15. Translate Postman fields: `method`, `url.raw` (preserved with `{{var}}` placeholders), `header[]`, `body.raw` / `body.urlencoded`, `request.url.query[]` → params.
- F16. Import is atomic: failures roll back via Django transaction.

## Non-functional
- NF1. Reuses existing Postgres + Redis. No new infra.
- NF2. Send timeout fixed at 30s. Body cap 10MB. Truncation surfaced to the UI.
- NF3. Response bodies stored in history are JSONB-friendly text; binary preview is "<binary, N bytes>".
- NF4. Send respects the user's threat model: single-user local, so SSRF isn't a concern (in fact it's a feature — `http://localhost:*` is expected).

## BDD Scenarios

```gherkin
Feature: Collections, folders, requests CRUD

  Scenario: Create collection and add a request
    When the client creates a collection "API"
    And the client creates a request "list users" inside that collection
    Then the collection tree contains the request "list users" at the root

  Scenario: Add a folder and move a request into it
    Given a collection "API" with a request "list users" at the root
    When the client creates a folder "users" inside the collection
    And the client moves "list users" into that folder
    Then the collection tree contains "users" at the root with "list users" inside

  Scenario: Delete a folder cascades to its requests
    Given a collection "API" with a folder "users" containing a request "list users"
    When the client deletes the folder
    Then the request no longer exists

Feature: Send a request

  Scenario: Send a real HTTP GET
    Given the upstream returns status 200 with body "hello"
    When the client sends GET to that URL
    Then the response status is 200
    And the response body equals "hello"
    And duration_ms is greater than 0

  Scenario: Variable interpolation
    Given an environment "dev" with variable "host" = "example.test"
    When the client sends GET to "https://{{host}}/health" with environment "dev"
    Then the resolved URL is "https://example.test/health"

  Scenario: Timeout returns 502
    Given the upstream takes longer than the request timeout
    When the client sends the request
    Then the response status is 502
    And the response error code is "upstream_timeout"

Feature: Postman import

  Scenario: Import a v2.1 collection with one folder and two requests
    Given a Postman v2.1 file with collection "Sample" containing folder "users" with requests "list" and "get"
    When the client imports the file
    Then the response status is 201
    And the collection tree has folder "users" with two requests

  Scenario: Round-trip a request URL with placeholders
    Given a Postman request with url "{{host}}/users/{{id}}"
    When the file is imported
    Then the saved request has url "{{host}}/users/{{id}}"
```

## Out of scope (v1)
- Pre-request and test scripts (no JS sandbox).
- WebSocket, GraphQL, gRPC.
- Insomnia format import (only Postman v2.1).
- Cookie jar / per-environment cookies.
- Auth helpers beyond setting raw `Authorization` headers.
- Cloud sync, sharing, comments.
- Curl export / import (Phase 2).
- History panel (data is captured but UI is Phase 2).
- Drag-drop reordering (use position number for v1; UI for reorder is Phase 2).

## Tech notes

### Backend data model
- `Collection(id, name, description, created_at, updated_at)`
- `Folder(id, collection FK, parent FK to Folder nullable, name, position, created_at)`
- `RequestNode(id, collection FK, folder FK nullable, name, method, url, headers JSON, params JSON, body text, body_type, position, created_at, updated_at)`
- `Environment(id, name, variables JSON [{key,value,enabled}], created_at)`
- `RequestRun(id, request FK nullable, snapshot JSON, status, headers JSON, body text, duration_ms, size_bytes, error text, sent_at)` — captured for history (Phase 2).

### Backend endpoints
- `GET/POST /api/http-client/collections` and `GET/PATCH/DELETE /collections/<id>`
- `GET /api/http-client/collections/<id>/tree` — full nested tree (folders + requests)
- `GET/POST /api/http-client/folders` and `GET/PATCH/DELETE /folders/<id>`
- `GET/POST /api/http-client/requests` and `GET/PATCH/DELETE /requests/<id>`
- `GET/POST /api/http-client/environments` and `GET/PATCH/DELETE /environments/<id>`
- `POST /api/http-client/send` — `{ method, url, headers, params, body, environmentId? }` → response.
- `POST /api/http-client/collections/import` — multipart Postman v2.1 file.

### Backend libs
- `requests` (already installed) for sending.
- `transaction.atomic` for import.

### Frontend
- New route `/http-client` with two-pane layout:
  - **Left:** collapsible tree of collections / folders / requests + environment selector at the top + "import" / "new collection" buttons.
  - **Right:** request editor (method dropdown, URL bar with `{{var}}` highlighting, tabs for Params, Headers, Body) → "Send" button → response viewer (status, time, size, tabs for Body / Headers).
- TanStack Query for everything; mutations invalidate the tree query.
- Body view: pretty-print JSON / XML; show as plain text otherwise.

### Phase 2 additions (implemented)

**cURL import** (`frontend/src/routes/http-client/-components/curl.ts`):
- Tokenizer: `shell-quote` `parse()` to handle quoted strings + line continuations.
- Recognized flags: `-X`/`--request`, `-H`/`--header`, `-d`/`--data`/`--data-raw`/`--data-binary`/`--data-ascii`, `--data-urlencode`, `-u`/`--user` (→ Basic auth header), `-b`/`--cookie`, `-A`/`--user-agent`, `-e`/`--referer`. Boolean flags (`-L`, `-k`, `-s`, etc.) accepted as no-ops.
- `--data-*` implies `POST` if no method specified.
- Body type guessed from `Content-Type` header, then heuristics on the body shape.

**cURL export** (same file):
- Outputs a multi-line `curl ... \\\n  -X ... \\\n  -H ...` form for readability.
- Uses minimal POSIX shell escaping; safe characters left bare, otherwise single-quoted.
- Includes any enabled query params (folded back into URL).

**Request history**:
- Backend model `RequestRun(method, url, snapshot JSON, status, response_headers, response_body, duration_ms, size_bytes, truncated, error, sent_at, request_node FK nullable)`.
- `SendView` writes a row on every send (success or failure). Response bodies capped at 64 KB in storage to keep the table tidy.
- `RunViewSet` (read-only) at `GET /api/http-client/runs?limit=N&request_node=ID`. List uses `RequestRunSummarySerializer`; detail uses full `RequestRunSerializer`.
- Frontend `HistoryPanel` is a third column on the page with the latest 30 runs. Click → loads working state from the run's snapshot for replay.

### Risks / open questions
- **Body size cap** at 10MB — surfacing the truncation cleanly in UI.
- **Streaming responses** — we read fully; v1 does not stream large bodies.
- **Timeouts** — 30s upper bound; for genuinely long-running endpoints, user can edit the request to a smaller endpoint or split the work. Documented.
- **Postman dynamic variables** (`{{$randomInt}}`, `{{$timestamp}}`) — preserved as-is in v1 (treated as unresolved). Phase 3 implements them.
- **Headers casing** — Postman v2.1 keeps original casing; we preserve it.
- **History grows unbounded** — every send adds a row. v3 will add a retention policy or "clear history" action. For now, runs older than ~50 fall off the panel naturally because we only fetch the last 30–50.
- **cURL parser edge cases** — scripts with `eval`-style escapes, ANSI-quoted strings, `--header=value` (vs space-separated): not all covered. Documented in the parser.
