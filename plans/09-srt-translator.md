# 09 — Utility: SRT subtitle translator (EN ↔ ES)

## Goal
Drop a `.srt` subtitle file in English or Spanish; download the same `.srt` translated to the other language with timestamps preserved exactly. Reuses the same NMT engine as utilities 01/02 — no LLMs, no paid APIs.

## Why
- Pairs naturally with utility 10 (audio transcriber): record / transcribe → translate subs → embed in player.
- Pairs with utility 03 (YouTube downloader): grab a video, transcribe, translate the subs.
- Off-the-shelf options either cost money or require uploading subs to a third-party service.

## Inputs / Outputs
- **Input:** `.srt` file (≤ 5 MB, UTF-8), source language (`en`|`es`), target language (`en`|`es`).
- **Output:** `.srt` file with same name suffixed `_<targetLang>` (e.g. `clip_es.srt`); cue indices, start/end timestamps, and blank lines preserved exactly.

## Functional requirements
- F1. Accept `.srt` upload via the web UI; reject any other extension.
- F2. Translate cue text only — never modify cue indices or timestamps.
- F3. Skip empty cues (no NMT call when `text.strip() == ""`).
- F4. Surface clear errors for malformed `.srt` (`invalid_srt`) and bad encoding (`invalid_encoding`).
- F5. Stream the translated file back as `application/x-subrip` with `Content-Disposition: attachment`.

## Non-functional requirements
- NF1. Fully offline after Argos models are downloaded (utility 04 prereq).
- NF2. Translation of a 1,000-cue file completes in < 30s on a developer laptop (CPU).
- NF3. Reuses `shared.nmt.engine` — single source of truth for translation.

## BDD scenarios

```gherkin
Feature: Translate an SRT subtitle file

  Scenario: Translate cues
    Given an SRT with cues "Hello there." and "How are you?"
    When the client uploads it with source "en" and target "es"
    Then the response status is 200
    And the response is an SRT with cues "[en->es] Hello there." and "[en->es] How are you?"
    And the response filename ends with "_es.srt"

  Scenario: Reject non-srt file
    Given an upload that is not an srt file
    When the client uploads it with source "en" and target "es"
    Then the response status is 400
    And the response error code is "unsupported_format"

  Scenario: Reject same source and target
    Given an SRT with cues "x"
    When the client uploads it with source "en" and target "en"
    Then the response status is 400
    And the response error code is "same_language"

  Scenario: Reject malformed srt
    Given an upload "bad.srt" with content "not actually srt content"
    When the client uploads it with source "en" and target "es"
    Then the response status is 400
    And the response error code is "invalid_srt"
```

## Out of scope (v1)
- WebVTT (`.vtt`), SAMI (`.smi`), TTML, or any non-SRT format.
- Languages other than EN/ES.
- Speaker labels, cue style overrides, multi-line wrap rules.
- Re-syncing timestamps to a different audio file.
- Inline translation memory or per-domain glossary.

## Tech notes
- **Backend** (Django + DRF): app at `backend/utilities/srt_translator/`. Single endpoint `POST /api/srt-translator/translate` accepts `multipart/form-data` (file + source + target). Response is `application/x-subrip`.
- **SRT lib**: `srt` (Python) — robust, handles indexing, timestamps, multi-line cues. Don't hand-parse.
- **Translation**: shared `engine.translate(text, source, target)` from `backend/shared/nmt/`.
- **Frontend (TanStack)**: route at `src/routes/srt-translator/`. `useTranslateSrt` mutation with `FormData` → response `Blob` → trigger browser download via temporary `<a>`.
- **Chain integration**: receives `srt` handoffs (see `frontend/src/lib/handoff.ts`) from the audio transcriber — pre-fills file + source/target lang, single click → download.

## Risks / open questions
- **Cue text containing HTML-style tags** (e.g. `<i>italics</i>`): Argos may translate or strip these. v1 sends the raw text and accepts whatever Argos returns. Document.
- **Multi-line cue text**: Argos handles newlines; cue boundaries are preserved by the `srt` lib.
- **Long cues** can blow up Argos memory — practically rare. Cue-by-cue translation keeps memory bounded.
