# 10 — Utility: Audio transcriber (Whisper local)

## Goal
Drop an audio or video file; get back transcribed text + per-segment timestamps + a ready-to-use `.srt`. Runs locally via `faster-whisper` (CTranslate2 backend, CPU-friendly). **NOT an LLM** — Whisper is classical neural ASR.

## Why
- Pairs with utility 03 (YouTube downloader) and utility 09 (SRT translator) to form a real local pipeline:
  `YouTube URL → mp4 → transcribe → SRT → translate → done`, all on the laptop.
- Most "transcribe a meeting / podcast / lecture" workflows today require uploading to a paid service. Local Whisper is just as good for clean audio and free.

## Inputs / Outputs
- **Input:** audio or video file (`.mp3 .m4a .wav .webm .mp4 .mov .mkv .ogg .opus .flac .aac`, ≤ 200 MB), model size, optional language.
- **Output:** JSON with detected language, total duration, per-segment `[{start, end, text}]`, the full text, and a generated `.srt` string.

## Functional requirements
- F1. Accept upload via the web UI; reject unsupported extensions.
- F2. Pick model: `tiny | base | small | medium`. Default `base`. Larger = more accurate, slower, more disk.
- F3. Optional `language` (`auto | en | es | …`); when omitted Whisper auto-detects.
- F4. Run with `vad_filter=True` to skip silence; `beam_size=1` for speed.
- F5. Build `.srt` server-side from the segments (1-indexed, `HH:MM:SS,mmm`).
- F6. Delete the temporary upload from disk after the response is sent (success or failure).
- F7. Returned segments include floating-point start/end seconds + cleaned text.

## Non-functional requirements
- NF1. CPU only by default (`device="cpu"`, `compute_type="int8"`). Avoids GPU dependencies for portability.
- NF2. Model downloaded from Hugging Face on first use, cached under `backend/models/huggingface/`.
- NF3. Synchronous request — for typical clip sizes < 5 minutes the response stays under HTTP timeout. Larger jobs may need async (out of scope v1).
- NF4. Concurrency: one job per request; multi-job queue is out of scope.

## BDD scenarios

```gherkin
Feature: Transcribe an audio file

  Scenario: Reject missing file
    When the client posts to transcribe with no file
    Then the response status is 400
    And the response error code is "missing_file"

  Scenario: Reject unsupported extension
    When the client uploads a file named "notes.txt" to transcribe
    Then the response status is 400
    And the response error code is "unsupported_format"

  Scenario: Reject unsupported model size
    When the client uploads "clip.mp3" with model_size "huge"
    Then the response status is 400
    And the response error code is "unsupported_model"

  Scenario: Returns segments and srt for accepted file
    Given the transcriber will produce segments [(0.0, 1.5, "hello"), (1.5, 3.0, "world")]
    When the client uploads "clip.mp3" with model_size "base"
    Then the response status is 200
    And the response language is "en"
    And the response text is "hello\nworld"
    And the response srt contains "00:00:00,000 --> 00:00:01,500"
```

## Out of scope (v1)
- Diarization (multi-speaker labels). `pyannote.audio` is an option for v2.
- Real-time / streaming transcription.
- Async job queue with progress polling — fine for short clips today, follow-up for long-form.
- Translation as part of transcription (Whisper has a `translate` task) — we keep concerns separate; pipe through utility 02 / 09 instead.
- Word-level timestamps. (Optional; flag in v2 if requested.)

## Tech notes
- **Lib**: `faster-whisper` (uses CTranslate2 + tokenizers under the hood). Same runtime stack we already use for Argos.
- **Backend** (Django + DRF): app at `backend/utilities/audio_transcriber/`. Single endpoint `POST /api/audio-transcriber/transcribe` (multipart upload).
- **Model cache**: `HF_HOME=backend/models/huggingface`. Auto-downloaded on first use; gitignored.
- **SRT generation**: same `srt` lib as utility 09 to keep cue formatting consistent.
- **Frontend (TanStack)**: route at `src/routes/audio-transcriber/`. Drag-and-drop dropzone, model + language selectors, segments preview + `.txt` / `.srt` download buttons.
- **Chain buttons**: result pane has "translate text →" (sends to text translator) and "translate subtitles →" (sends to SRT translator) via `frontend/src/lib/handoff.ts`.
- **Tests**: pytest-bdd against a mocked transcribe function — no real model invocation in CI.

## Risks / open questions
- **First-run model download** is ~140 MB for `base`, ~480 MB for `small`, ~1.5 GB for `medium`. Slow on first use. Documented in README.
- **CPU performance**: `base` model handles 1× real-time on Apple Silicon; longer clips will hold the request open. Async is the proper long-term path.
- **VAD silences**: `vad_filter=True` can cut very-quiet narration. Add toggle in v2 if it bites.
- **Compute type `int8`** trades a bit of accuracy for speed and lower RAM. Acceptable for typical use.
