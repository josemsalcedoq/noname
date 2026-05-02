# 04 — Utility: Dev Tools (multi-tab page)

## Goal
A single page bundling small developer-oriented helpers as tabs. Each tab is independently usable; sharing a page keeps the navigation tidy because none of these tools justifies its own sidebar entry.

## Why
- Day-to-day micro-tasks (decode a JWT, format JSON, hash a file, generate a QR) currently live across 5–10 random websites, most loaded with ads and tracking.
- Doing it locally means **no data leaves the browser** — important for tokens, secrets, and API responses.

## Scope — twelve tabs

### Original six (v1)
1. **Format converter:** JSON ↔ YAML ↔ TOML ↔ CSV, with formatter / minifier / structural diff.
2. **Encoder/decoder:** Base64 (text + file), URL-encode/decode, hex.
3. **Hash / checksum:** MD5, SHA-1, SHA-256, SHA-512 — over text input or an uploaded file.
4. **QR generator:** text → PNG/SVG, copy or download.
5. **Regex tester:** live matches highlighted, named groups listed, flags toggleable, replace mode.
6. **Markdown live preview:** split-pane editor + rendered HTML, GFM-flavored.

### Added in v1.1 (six more)
7. **JWT decoder** (split out of the encoder tab): pretty header + payload, highlights for `exp`/`iat`/`nbf` with relative time, opaque signature display, "signature not verified" notice. Lib: in-process base64url decode + JSON parse.
8. **Cron explainer + builder:** human description (`cronstrue`), next 10 fires (`cron-parser`), preset shortcuts.
9. **Diff viewer:** two textareas, `diff` lib, line/word/char modes, inline highlighting + add/remove counts.
10. **UUID / nanoid generator:** batch generation, configurable count and (for nanoid) length.
11. **Timestamp converter:** Unix epoch ↔ ISO 8601 ↔ RFC 2822 ↔ local ↔ relative; auto-detects seconds vs milliseconds.
12. **Password generator:** crypto-strong random with charset toggles (A-Z, 0-9, !@#), entropy estimate, copy-per-result.

## Inputs / Outputs (per tab)
| Tab | Input | Output |
|-----|-------|--------|
| Format converter | text in source format | text in target format, error on parse failure |
| Encoder/decoder | text or file | encoded/decoded text or file |
| Hash | text or file (≤ 500 MB streamed in chunks) | hex digest(s) |
| QR generator | text/URL (≤ 2,000 chars) | PNG and SVG, configurable size and error-correction level |
| Regex tester | pattern + test string + flags | highlighted matches, capture groups |
| Markdown preview | markdown source | rendered HTML preview |

## Functional requirements
- F1. Tabs persist in the URL via TanStack Router search params (e.g. `/dev-tools?tab=hash`) so deep links work.
- F2. Each tab's input is preserved when switching tabs (in component state, not localStorage by default).
- F3. **Everything runs client-side** — no API calls, no backend involvement. This is core to the privacy promise; do not regress it.
- F4. Copy-to-clipboard buttons on every output.
- F5. File-based inputs (Base64, hash) stream the file rather than loading it whole when possible.
- F6. Errors surface inline next to the relevant input (toast only for clipboard ops).

## Non-functional requirements
- NF1. Initial route load < 200 KB gzipped (lazy-load heavy libs per tab — `markdown-it`, `qrcode`, etc.).
- NF2. Hash 100 MB file in ≤ 5s on a developer laptop.
- NF3. Zero network requests after the page is loaded (verify in DevTools when reviewing).
- NF4. No data persistence: nothing written to localStorage / IndexedDB / cookies by this utility.

## BDD scenarios

```gherkin
Feature: Dev Tools — format converter

  Scenario: JSON to YAML
    Given the source format is JSON and the target format is YAML
    And the input is valid JSON
    When conversion runs
    Then the output is the equivalent YAML
    And no error is shown

  Scenario: Invalid JSON
    Given the source format is JSON
    And the input is "{ foo: }"
    When conversion runs
    Then an inline error shows the parse position
    And the output is empty

  Scenario: CSV to JSON
    Given the source is CSV with a header row
    And the target is JSON
    When conversion runs
    Then the output is an array of objects keyed by the header columns

Feature: Dev Tools — encoder/decoder

  Scenario: Base64 encode text
    Given mode is "Base64 encode" and input is "hello"
    Then the output is "aGVsbG8="

  Scenario: Decode JWT
    Given mode is "JWT decode" and input is a valid JWT
    Then the header and payload are shown as formatted JSON
    And the signature is shown as opaque base64
    And the UI explicitly states "signature not verified"

  Scenario: URL decode invalid input
    Given mode is "URL decode" and input contains "%ZZ"
    Then an inline error is shown
    And no output is produced

Feature: Dev Tools — hash

  Scenario: SHA-256 of text
    Given the algorithm is SHA-256 and input is "abc"
    Then the digest equals "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

  Scenario: SHA-256 of a 50 MB file
    Given the user uploads a 50 MB file
    When SHA-256 runs
    Then a progress indicator advances 0 -> 100%
    And the resulting digest matches what `shasum -a 256` produces on the same file
    And memory usage stays bounded (file processed in chunks)

Feature: Dev Tools — QR generator

  Scenario: Generate QR for a URL
    Given input is "https://example.com"
    When generation runs
    Then a QR code is rendered
    And the user can download it as PNG or SVG

  Scenario: Input too long
    Given input length > 2000 characters
    Then an inline error is shown
    And no QR is generated

Feature: Dev Tools — regex tester

  Scenario: Highlight matches
    Given pattern "\d+" and test string "a1 b22 c333"
    Then "1", "22", "333" are highlighted
    And the matches list shows their positions

  Scenario: Named groups
    Given pattern "(?<year>\d{4})" and test string "released 2026"
    Then the matches list shows a "year" group with value "2026"

  Scenario: Invalid pattern
    Given pattern "[unclosed"
    Then an inline error shows the regex parse error
    And no highlights are applied

Feature: Dev Tools — markdown preview

  Scenario: Live preview
    Given the editor contains "# Hello\n\n**bold**"
    Then the preview pane shows an h1 "Hello" and a bold "bold"

  Scenario: GitHub-flavored extras
    Given the editor contains a fenced code block with language "python"
    Then the preview pane shows a syntax-highlighted code block

  Scenario: No raw HTML by default
    Given the editor contains "<script>alert(1)</script>"
    Then the preview escapes it (no script execution)
```

## Out of scope (v1)
- JWT signature verification (would require key input + crypto lib — separate feature if needed).
- Diff view across formats (added later if desired).
- Saving / favoriting snippets across sessions.
- Cron expression explainer, JSON-schema validator, color-picker, lorem-ipsum, etc. — easy to add as more tabs once the shell exists.
- Encrypt/decrypt (AES, etc.) — out for now to avoid building a half-baked crypto UX.

## Tech notes
- **Architecture:** 100% frontend. **No Django app, no backend route.** This utility lives entirely under `frontend/src/routes/dev-tools/`.
- **Routing:** TanStack Router parent route `/dev-tools` with the active tab in `search` params. Each tab's component is lazy-loaded (`createLazyRoute` or React.lazy) to keep initial bundle small.
- **State:** plain React state per tab. **No TanStack Query** here — no async server state to cache.
- **Libs (all free, MIT/ISC):**
  - Format converter: `js-yaml` (YAML), `smol-toml` (TOML), `papaparse` (CSV), native `JSON`. Diff via `jsondiffpatch`.
  - Encoder: native `btoa/atob`, `TextEncoder`, `encodeURIComponent`.
  - JWT: split on `.` and base64url-decode the header/payload (dedicated tab as of v1.1).
  - Hash: **Web Crypto API** (`crypto.subtle.digest`) for SHA-1/256/512, plus `js-md5` for MD5 (Web Crypto doesn't support MD5).
  - QR: `qrcode` (npm).
  - Regex: native `RegExp`.
  - Markdown: `markdown-it`, with HTML disabled.
  - Cron: `cronstrue` + `cron-parser`.
  - Diff: `diff` (npm) — line/word/char modes.
  - UUID: native `crypto.randomUUID` for v4, `nanoid` for nanoid.
  - Timestamp: native `Date` + `Intl.RelativeTimeFormat`.
  - Password: `crypto.getRandomValues` (rejection sampling so charset modulo doesn't bias).

## Risks / open questions
- Bundle size: six tabs' worth of libs adds up. **Mitigation:** lazy-load per tab, verify Lighthouse.
- Web Crypto MD5 gap — `js-md5` is small (~5 KB) and the alternative is "drop MD5 from v1". Default to including it.
- `markdown-it`'s default config allows raw HTML. Disable via `{ html: false }` to avoid surprising XSS in the preview pane (we render the user's own input, but the muscle memory is good).
- Streaming hash on huge files is fiddly — confirm chunked SubtleCrypto pattern works without buffering the whole file.
